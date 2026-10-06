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
    });
    if (!res.ok)
      throw new AutomationError(
        res.status === 401
          ? "NEXTCLOUD_AUTH_FAILED"
          : res.status === 403
            ? "NEXTCLOUD_PERMISSION_DENIED"
            : "NEXTCLOUD_HTTP_ERROR",
        res.status,
        init.method === "POST" && res.status >= 500,
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
    if (![100, 200].includes(Number(data.ocs?.meta?.statuscode)))
      throw new AutomationError(
        "NEXTCLOUD_OCS_ERROR",
        Number(data.ocs?.meta?.statuscode) || null,
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
  async talk(message: string, referenceId: string) {
    if (!this.config.technicalConversation)
      throw new AutomationError("TALK_NOT_CONFIGURED");
    const room = await this.ocs(
      "/ocs/v2.php/apps/spreed/api/v4/room/" +
        encodeURIComponent(this.config.technicalConversation),
    );
    if (![2, 3].includes(Number(room.type)))
      throw new AutomationError("TALK_ROOM_NOT_GROUP");
    const result = await this.ocs(
      "/ocs/v2.php/apps/spreed/api/v1/chat/" +
        encodeURIComponent(this.config.technicalConversation),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, referenceId }),
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
export class BaleClient {
  private transport: Fetcher;
  constructor(transport?: Fetcher) {
    this.transport = transport ?? ((u, i) => safeFetch(u, i, ["tapi.bale.ai"]));
  }
  async call(
    method: "getMe" | "getChat" | "sendMessage",
    payload: Record<string, unknown> = {},
  ) {
    const token = process.env.BALE_BOT_TOKEN;
    if (!token) throw new AutomationError("BALE_NOT_CONFIGURED");
    let response: Response;
    try {
      response = await this.transport(
        `https://tapi.bale.ai/bot${token}/${method}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
    } catch (e) {
      if (method !== "sendMessage" && e instanceof AutomationError)
        throw new AutomationError(e.code, e.httpStatus, false);
      throw e;
    }
    let data;
    try {
      data = JSON.parse((await boundedBytes(response, 1024 * 1024)).toString());
    } catch {
      throw new AutomationError(
        "BALE_INVALID_RESPONSE",
        response.status,
        method === "sendMessage",
      );
    }
    if (!data.ok)
      throw new AutomationError(
        "BALE_REJECTED",
        Number(data.error_code) || response.status,
      );
    if (!response.ok)
      throw new AutomationError(
        "BALE_HTTP_ERROR",
        response.status,
        method === "sendMessage",
      );
    return data.result;
  }
  async send(recipient: string, text: string) {
    const chat = await this.call("getChat", { chat_id: recipient });
    if (chat.type !== "private" || String(chat.id) !== recipient)
      throw new AutomationError("BALE_RECIPIENT_NOT_PRIVATE");
    const r = await this.call("sendMessage", { chat_id: recipient, text });
    if (!r.message_id)
      throw new AutomationError("BALE_MISSING_RECEIPT", null, true);
    return String(r.message_id);
  }
  async health() {
    await this.call("getMe");
    return true;
  }
}
