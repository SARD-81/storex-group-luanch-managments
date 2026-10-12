import { createHash } from "node:crypto";
import type { AutomationConfig } from "@/app/generated/prisma/client";
import { AutomationError, boundedBytes, safeFetch } from "./http";
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export type PublicShare = { id: string; url: string; createdAt: Date };
export class NextcloudClient {
  readonly base: string;
  private transport: Fetcher;
  private headers: Record<string, string>;
  constructor(
    readonly config: AutomationConfig,
    transport?: Fetcher,
  ) {
    this.base = config.nextcloudBaseUrl.replace(/\/$/, "");
    const user = process.env.NEXTCLOUD_USERNAME,
      password = process.env.NEXTCLOUD_APP_PASSWORD;
    if (!user || !password || !this.base)
      throw new AutomationError("NEXTCLOUD_NOT_CONFIGURED");
    this.headers = {
      Authorization:
        "Basic " + Buffer.from(`${user}:${password}`).toString("base64"),
      "OCS-APIRequest": "true",
      Accept: "application/json",
    };
    this.transport =
      transport ??
      ((url, init) =>
        safeFetch(
          url,
          init,
          (process.env.AUTOMATION_ALLOWED_NEXTCLOUD_HOSTS ?? "")
            .split(",")
            .map((s) => s.trim()),
          (process.env.AUTOMATION_ALLOWED_PRIVATE_HOSTS ?? "")
            .split(",")
            .map((s) => s.trim()),
        ));
  }
  async request(path: string, init: RequestInit = {}) {
    const res = await this.transport(this.base + path, {
      ...init,
      headers: { ...this.headers, ...init.headers },
    }).catch((error) => {
      if (error instanceof AutomationError) throw error;
      throw new AutomationError(
        "NEXTCLOUD_REQUEST_FAILED",
        null,
        init.method === "POST",
      );
    });
    if (!res.ok)
      throw new AutomationError(
        res.status === 401
          ? "NEXTCLOUD_AUTH_FAILED"
          : res.status === 403
            ? "NEXTCLOUD_PERMISSION_DENIED"
            : "NEXTCLOUD_HTTP_ERROR",
        res.status,
        init.method === "POST" && (res.status >= 500 || res.status === 408),
      );
    return res;
  }
  async ocs(path: string, init: RequestInit = {}) {
    const response = await this.request(
      path + (path.includes("?") ? "&" : "?") + "format=json",
      init,
    );
    let data;
    try {
      data = JSON.parse((await boundedBytes(response, 1024 * 1024)).toString());
    } catch {
      throw new AutomationError(
        "NEXTCLOUD_INVALID_RESPONSE",
        null,
        init.method === "POST",
      );
    }
    if (![100, 200, 201].includes(Number(data.ocs?.meta?.statuscode)))
      throw new AutomationError(
        "NEXTCLOUD_OCS_ERROR",
        Number(data.ocs?.meta?.statuscode) || null,
        init.method === "POST" &&
          (!Number.isFinite(Number(data.ocs?.meta?.statuscode)) ||
            Number(data.ocs?.meta?.statuscode) >= 500),
      );
    return data.ocs.data;
  }
  davPath(file: string) {
    return (
      "/remote.php/dav/files/" +
      encodeURIComponent(process.env.NEXTCLOUD_USERNAME!) +
      file.split("/").map(encodeURIComponent).join("/")
    );
  }
  async upload(file: string, bytes: Buffer, type: string) {
    const parts = file.split("/").filter(Boolean);
    let path = "";
    for (const part of parts.slice(0, -1)) {
      path += "/" + part;
      const r = await this.transport(this.base + this.davPath(path), {
        method: "MKCOL",
        headers: this.headers,
      });
      if (!r.ok && r.status !== 405)
        throw new AutomationError("WEBDAV_DIRECTORY_FAILED", r.status);
    }
    await this.request(this.davPath(file), {
      method: "PUT",
      headers: { "Content-Type": type },
      body: new Uint8Array(bytes),
    });
  }
  async deleteFile(file: string) {
    const r = await this.transport(this.base + this.davPath(file), {
      method: "DELETE",
      headers: this.headers,
    });
    if (!r.ok && r.status !== 404)
      throw new AutomationError("WEBDAV_DELETE_FAILED", r.status);
  }
  async capability() {
    const data = await this.ocs("/ocs/v2.php/cloud/capabilities");
    return data.capabilities?.files_sharing?.public?.enabled === true;
  }
  async getOrCreateShare(file: string, now = new Date()): Promise<PublicShare> {
    const path = "/ocs/v2.php/apps/files_sharing/api/v1/shares";
    const shares = await this.ocs(path + "?path=" + encodeURIComponent(file));
    let share = Array.isArray(shares)
      ? shares.find(
          (s) =>
            Number(s.share_type) === 3 &&
            s.path === file &&
            Number(s.permissions) === 1,
        )
      : undefined;
    if (!share) {
      const expires = new Date(now.getTime() + 48 * 3600000)
        .toISOString()
        .slice(0, 10);
      try {
        share = await this.ocs(path, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            path: file,
            shareType: "3",
            permissions: "1",
            publicUpload: "false",
            expireDate: expires,
          }),
        });
      } catch (e) {
        if (e instanceof AutomationError && e.uncertain)
          throw new AutomationError("SHARE_CREATE_UNCERTAIN");
        throw e;
      }
    }
    if (
      Number(share.share_type) !== 3 ||
      Number(share.permissions) !== 1 ||
      share.password ||
      !share.id ||
      !share.url
    )
      throw new AutomationError("UNSAFE_PUBLIC_SHARE");
    const url = new URL(share.url);
    if (
      url.origin !== new URL(this.base).origin ||
      !url.pathname.startsWith(
        new URL(this.base).pathname.replace(/\/$/, "") + "/s/",
      )
    )
      throw new AutomationError("UNTRUSTED_PUBLIC_URL");
    const createdAt = new Date(Number(share.stime) * 1000);
    if (
      !share.stime ||
      !Number.isFinite(createdAt.getTime()) ||
      createdAt.getTime() > now.getTime() + 60000
    )
      throw new AutomationError("SHARE_CREATION_TIME_INVALID");
    return { id: String(share.id), url: share.url, createdAt };
  }
  async revokeShare(id: string) {
    try {
      await this.ocs(
        "/ocs/v2.php/apps/files_sharing/api/v1/shares/" +
          encodeURIComponent(id),
        { method: "DELETE" },
      );
    } catch (e) {
      if (!(e instanceof AutomationError && e.httpStatus === 404)) throw e;
    }
  }
  async verifyPublic(url: string, sha256: string) {
    const response = await this.transport(url.replace(/\/$/, "") + "/download");
    if (!response.ok)
      throw new AutomationError("PUBLIC_LINK_UNAVAILABLE", response.status);
    const bytes = await boundedBytes(response);
    if (
      bytes.subarray(0, 5).toString() !== "%PDF-" ||
      createHash("sha256").update(bytes).digest("hex") !== sha256
    )
      throw new AutomationError("PUBLIC_PDF_VERIFICATION_FAILED");
  }
  async talkHealth() {
    if (!this.config.technicalConversation)
      throw new AutomationError("TALK_NOT_CONFIGURED");
    const room = await this.ocs(
      "/ocs/v2.php/apps/spreed/api/v4/room/" +
        encodeURIComponent(this.config.technicalConversation),
    );
    if (Number(room.type) !== 2)
      throw new AutomationError("TALK_ROOM_NOT_GROUP");
    if (
      ![1, 2, 3].includes(Number(room.participantType)) ||
      Number(room.readOnly) !== 0 ||
      (room.permissions !== undefined && (Number(room.permissions) & 128) === 0)
    )
      throw new AutomationError("TALK_SEND_PERMISSION_MISSING");
    return true;
  }
  async talk(message: string, referenceId: string) {
    await this.talkHealth();
    const result = await this.ocs(
      "/ocs/v2.php/apps/spreed/api/v1/chat/" +
        encodeURIComponent(this.config.technicalConversation),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          referenceId: /^[a-f0-9]{64}$/.test(referenceId)
            ? referenceId
            : createHash("sha256").update(referenceId).digest("hex"),
        }),
      },
    );
    if (!result.id)
      throw new AutomationError("TALK_MISSING_RECEIPT", null, true);
    return String(result.id);
  }
  async health() {
    await this.request(
      "/remote.php/dav/files/" +
        encodeURIComponent(process.env.NEXTCLOUD_USERNAME!) +
        "/",
      { method: "PROPFIND", headers: { Depth: "0" } },
    );
    return true;
  }
}
export const BALE_DOCUMENT_MAX_BYTES = 50_000_000;
export function validateBalePdf(input: {
  bytes: Buffer;
  mimeType: string;
  filename: string;
  sha256: string;
}) {
  if (input.bytes.length > BALE_DOCUMENT_MAX_BYTES)
    throw new AutomationError("BALE_PDF_TOO_LARGE");
  if (
    input.mimeType !== "application/pdf" ||
    !/^[a-zA-Z0-9_-]+\.pdf$/.test(input.filename) ||
    input.bytes.length < 40 ||
    !/^%PDF-\d\.\d/.test(input.bytes.subarray(0, 8).toString()) ||
    !input.bytes.subarray(-1024).toString().trimEnd().endsWith("%%EOF")
  )
    throw new AutomationError("BALE_INVALID_PDF");
  if (createHash("sha256").update(input.bytes).digest("hex") !== input.sha256)
    throw new AutomationError("ARTIFACT_CHECKSUM_MISMATCH");
}
export type BaleDocumentReceipt = {
  messageId: string;
  chatId: string;
  receivedAt: Date;
  apiSentAt: Date | null;
};
export class BaleClient {
  private transport: Fetcher;
  constructor(
    transport?: Fetcher,
    private clock: () => Date = () => new Date(),
  ) {
    this.transport = transport ?? ((u, i) => safeFetch(u, i, ["tapi.bale.ai"]));
  }
  async call(
    method:
      "getMe" | "getChat" | "sendMessage" | "sendDocument" | "deleteMessage",
    payload: Record<string, unknown> | FormData = {},
  ) {
    const token = process.env.BALE_BOT_TOKEN;
    if (!token) throw new AutomationError("BALE_NOT_CONFIGURED");
    const mutation = ["sendMessage", "sendDocument", "deleteMessage"].includes(
      method,
    );
    let response: Response;
    try {
      response = await this.transport(
        `https://tapi.bale.ai/bot${token}/${method}`,
        {
          method: "POST",
          ...(payload instanceof FormData
            ? { body: payload }
            : {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              }),
        },
      );
    } catch (e) {
      throw new AutomationError(
        e instanceof AutomationError ? e.code : "BALE_REQUEST_FAILED",
        e instanceof AutomationError ? e.httpStatus : null,
        mutation && (!(e instanceof AutomationError) || e.uncertain),
      );
    }
    let data;
    try {
      data = JSON.parse((await boundedBytes(response, 1024 * 1024)).toString());
    } catch {
      throw new AutomationError(
        "BALE_INVALID_RESPONSE",
        response.status,
        mutation,
      );
    }
    if (data.ok !== true) {
      const status = Number(data.error_code) || response.status;
      const description =
        typeof data.description === "string"
          ? data.description.toLowerCase()
          : "";
      const code =
        status === 429
          ? "BALE_RATE_LIMITED"
          : status === 401
            ? "BALE_AUTH_FAILED"
            : status === 403
              ? "BALE_FORBIDDEN"
              : method === "deleteMessage" &&
                  (status === 404 ||
                    /message.*not found|message.*not exist/.test(description))
                ? "BALE_MESSAGE_NOT_FOUND"
                : method === "deleteMessage"
                  ? "BALE_DELETE_REJECTED"
                  : "BALE_REJECTED";
      const retry = Number(data.parameters?.retry_after);
      throw new AutomationError(
        code,
        status,
        data.ok !== false && mutation,
        status === 429 && Number.isFinite(retry) && retry > 0
          ? Math.min(Math.ceil(retry), 86400)
          : null,
      );
    }
    if (!response.ok)
      throw new AutomationError("BALE_HTTP_ERROR", response.status, mutation);
    return data.result;
  }
  async privateChat(recipient: string) {
    if (
      !/^[1-9]\d{0,15}$/.test(recipient) ||
      !Number.isSafeInteger(Number(recipient))
    )
      throw new AutomationError("BALE_RECIPIENT_INVALID");
    const chat = await this.call("getChat", { chat_id: recipient });
    if (chat?.type !== "private" || String(chat.id) !== recipient)
      throw new AutomationError("BALE_RECIPIENT_NOT_PRIVATE");
    return true;
  }
  async send(recipient: string, text: string) {
    await this.health();
    await this.privateChat(recipient);
    const r = await this.call("sendMessage", { chat_id: recipient, text });
    if (!/^[1-9]\d{0,15}$/.test(String(r?.message_id)))
      throw new AutomationError("BALE_MISSING_RECEIPT", null, true);
    return String(r.message_id);
  }
  async sendDocument(
    recipient: string,
    input: {
      bytes: Buffer;
      mimeType: string;
      filename: string;
      sha256: string;
      caption: string;
    },
  ): Promise<BaleDocumentReceipt> {
    const attemptedAt = this.clock();
    validateBalePdf(input);
    if (input.caption.length > 4096)
      throw new AutomationError("BALE_CAPTION_TOO_LONG");
    await this.health();
    await this.privateChat(recipient);
    const body = new FormData();
    body.set("chat_id", recipient);
    body.set("caption", input.caption);
    body.set(
      "document",
      new Blob([new Uint8Array(input.bytes)], { type: input.mimeType }),
      input.filename,
    );
    const r = await this.call("sendDocument", body),
      receivedAt = this.clock();
    if (
      !/^[1-9]\d{0,15}$/.test(String(r?.message_id)) ||
      !Number.isSafeInteger(Number(r?.message_id)) ||
      r?.chat?.type !== "private" ||
      String(r.chat.id) !== recipient
    )
      throw new AutomationError("BALE_DOCUMENT_RECEIPT_INVALID", null, true);
    const date = Number(r.date);
    const apiSentAt =
      Number.isSafeInteger(date) &&
      date > 0 &&
      date * 1000 >= attemptedAt.getTime() - 60000 &&
      date * 1000 <= receivedAt.getTime() + 60000
        ? new Date(date * 1000)
        : null;
    return {
      messageId: String(r.message_id),
      chatId: recipient,
      receivedAt,
      apiSentAt,
    };
  }
  async deleteMessage(
    chatId: string,
    messageId: string,
    deleteBeforeAt?: Date,
  ) {
    if (
      !/^[1-9]\d{0,15}$/.test(chatId) ||
      !/^[1-9]\d{0,15}$/.test(messageId) ||
      !Number.isSafeInteger(Number(messageId)) ||
      !Number.isSafeInteger(Number(chatId))
    )
      throw new AutomationError("BALE_DELETE_IDENTITY_INVALID");
    if (deleteBeforeAt && this.clock() >= deleteBeforeAt)
      throw new AutomationError("BALE_DELETE_WINDOW_EXPIRED");
    await this.health();
    // Recheck after the read-only preflight; network latency cannot extend the API window.
    if (deleteBeforeAt && this.clock() >= deleteBeforeAt)
      throw new AutomationError("BALE_DELETE_WINDOW_EXPIRED");
    const result = await this.call("deleteMessage", {
      chat_id: chatId,
      message_id: Number(messageId),
    });
    if (result !== true)
      throw new AutomationError("BALE_DELETE_UNCONFIRMED", null, true);
    return true;
  }
  async health() {
    const me = await this.call("getMe");
    if (
      me?.is_bot !== true ||
      String(me.username).toLowerCase() !== "storex_lunch_notify_bot"
    )
      throw new AutomationError("BALE_BOT_IDENTITY_MISMATCH");
    return true;
  }
}
