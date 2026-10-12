import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  BaleClient,
  validateBalePdf,
  BALE_DOCUMENT_MAX_BYTES,
  classifyBaleDocumentBadRequest,
} from "../lib/automation/integrations";
import { AutomationError } from "../lib/automation/http";
import { probePdf } from "../lib/automation/capability-probe";
import { readPrivateArtifact } from "../lib/automation/jobs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const clock = new Date("2026-10-12T06:00:00Z");
test("private artifact reader rejects traversal outside the configured spool", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "artifact-boundary-")),
    other = await mkdtemp(path.join(tmpdir(), "artifact-outside-")),
    old = process.env.AUTOMATION_SPOOL_DIR;
  try {
    process.env.AUTOMATION_SPOOL_DIR = root;
    const file = path.join(other, "private.pdf");
    await writeFile(file, probePdf());
    await assert.rejects(
      () => readPrivateArtifact({ spoolPath: file, sha256: input().sha256 }),
      /ARTIFACT_PATH_INVALID/,
    );
  } finally {
    if (old === undefined) delete process.env.AUTOMATION_SPOOL_DIR;
    else process.env.AUTOMATION_SPOOL_DIR = old;
    await rm(root, { recursive: true, force: true });
    await rm(other, { recursive: true, force: true });
  }
});
const input = () => ({
  bytes: probePdf(),
  mimeType: "application/pdf",
  filename: "next-workday-1405-07-21.pdf",
  caption: "گزارش روز کاری بعد",
  sha256: createHash("sha256").update(probePdf()).digest("hex"),
});
process.env.BALE_BOT_TOKEN = "synthetic-test-token";
function bot(
  final: () => Response | Promise<Response>,
  chat = { id: 123456, type: "private" },
) {
  let sent = 0;
  const client = new BaleClient(
    async (url, init) => {
      if (url.endsWith("/getMe"))
        return Response.json({
          ok: true,
          result: { is_bot: true, username: "storex_lunch_notify_bot" },
        });
      if (url.endsWith("/getChat"))
        return Response.json({ ok: true, result: chat });
      if (url.endsWith("/sendDocument")) {
        sent++;
        assert.ok(init?.body instanceof FormData);
        const file = init.body.get("document") as File;
        assert.equal(file.type, "application/pdf");
        assert.equal(file.name, input().filename);
        assert.deepEqual(Buffer.from(await file.arrayBuffer()), input().bytes);
        assert.equal(init.body.get("chat_id"), "123456");
        assert.equal(init.body.get("caption"), input().caption);
        assert.equal(new Headers(init.headers).has("Content-Type"), false);
      }
      return final();
    },
    () => clock,
  );
  return { client, sent: () => sent };
}
test("Bale document is multipart private PDF bytes and persists the official timestamp receipt", async () => {
  const b = bot(() =>
    Response.json({
      ok: true,
      result: {
        message_id: 42,
        chat: { id: 123456, type: "private" },
        date: clock.getTime() / 1000,
      },
    }),
  );
  const r = await b.client.sendDocument("123456", input());
  assert.equal(r.messageId, "42");
  assert.equal(r.chatId, "123456");
  assert.equal(r.apiSentAt!.toISOString(), clock.toISOString());
  assert.equal(b.sent(), 1);
});

test("Bale 400 document errors are classified without ever exposing remote descriptions", async () => {
  const cases = [
    ["Bad Request: missing document", "BALE_DOCUMENT_MISSING_FILE"],
    ["Bad Request: invalid multipart boundary", "BALE_DOCUMENT_MULTIPART_REJECTED"],
    ["Bad Request: chat_id is invalid", "BALE_DOCUMENT_CHAT_REJECTED"],
    ["Bad Request: caption too long", "BALE_DOCUMENT_CAPTION_REJECTED"],
    ["Bad Request: unsupported file format", "BALE_DOCUMENT_FILE_REJECTED"],
    ["Bad Request: not allowed", "BALE_DOCUMENT_PERMISSION_REJECTED"],
    ["opaque provider rejection with confidential-token-x", "BALE_DOCUMENT_BAD_REQUEST"],
  ] as const;
  for (const [description, expected] of cases) {
    assert.equal(classifyBaleDocumentBadRequest(description), expected);
    const b = bot(() =>
      Response.json({ ok: false, error_code: 400, description }, { status: 400 }),
    );
    await assert.rejects(
      () => b.client.sendDocument("123456", input()),
      (error) => error instanceof AutomationError &&
        error.code === expected &&
        error.httpStatus === 400 &&
        error.uncertain === false &&
        !error.message.includes("confidential-token-x"),
    );
  }
});

test("missing Bale date uses the response-receipt timestamp", async () => {
  const b = bot(() =>
    Response.json({
      ok: true,
      result: { message_id: 42, chat: { id: 123456, type: "private" } },
    }),
  );
  const r = await b.client.sendDocument("123456", input());
  assert.equal(r.apiSentAt, null);
  assert.equal(r.receivedAt, clock);
});
for (const [name, change, code] of [
  ["MIME", { mimeType: "text/html" }, "BALE_INVALID_PDF"],
  [
    "PDF signature",
    { bytes: Buffer.from("<html>not a PDF</html>") },
    "BALE_INVALID_PDF",
  ],
  [
    "truncated PDF",
    { bytes: Buffer.from("%PDF-1.4\n" + "x".repeat(100)) },
    "BALE_INVALID_PDF",
  ],
  ["SHA-256", { sha256: "0".repeat(64) }, "ARTIFACT_CHECKSUM_MISMATCH"],
  ["filename traversal", { filename: "../private.pdf" }, "BALE_INVALID_PDF"],
] as const)
  test(`invalid ${name} is rejected before any outbound request`, () =>
    assert.throws(
      () => validateBalePdf({ ...input(), ...change }),
      new RegExp(code),
    ));
test("Bale document size is bounded before outbound requests", () => {
  assert.throws(
    () =>
      validateBalePdf({
        ...input(),
        bytes: Buffer.alloc(BALE_DOCUMENT_MAX_BYTES + 1),
      }),
    /BALE_PDF_TOO_LARGE/,
  );
});
for (const chat of [
  { id: 123456, type: "group" },
  { id: 654321, type: "private" },
])
  test(`wrong destination ${chat.type}/${chat.id} prevents PDF send`, async () => {
    const b = bot(() => {
      throw Error("must never send");
    }, chat);
    await assert.rejects(
      () => b.client.sendDocument("123456", input()),
      /BALE_RECIPIENT_NOT_PRIVATE/,
    );
    assert.equal(b.sent(), 0);
  });
for (const [name, response, code, uncertain] of [
  [
    "invalid token",
    () => Response.json({ ok: false, error_code: 401, description: "secret" }),
    "BALE_AUTH_FAILED",
    false,
  ],
  [
    "rate limit",
    () =>
      Response.json({
        ok: false,
        error_code: 429,
        parameters: { retry_after: 120 },
      }),
    "BALE_RATE_LIMITED",
    false,
  ],
  [
    "timeout",
    () => {
      throw new AutomationError("REMOTE_UNAVAILABLE", null, true);
    },
    "REMOTE_UNAVAILABLE",
    true,
  ],
  [
    "malformed response",
    () => new Response("not JSON", { status: 502 }),
    "BALE_INVALID_RESPONSE",
    true,
  ],
  [
    "mismatched receipt",
    () =>
      Response.json({
        ok: true,
        result: { message_id: 1, chat: { id: 654321, type: "private" } },
      }),
    "BALE_DOCUMENT_RECEIPT_INVALID",
    true,
  ],
] as const)
  test(`document ${name} has correct safe/ambiguous classification`, async () => {
    const b = bot(response);
    await assert.rejects(
      () => b.client.sendDocument("123456", input()),
      (e) =>
        e instanceof AutomationError &&
        e.code === code &&
        e.uncertain === uncertain,
    );
  });
test("deleteMessage requires literal confirmed true and sends only the stored identity", async () => {
  let calls = 0;
  const client = new BaleClient(async (url, init) => {
    if (url.endsWith("/getMe"))
      return Response.json({
        ok: true,
        result: { is_bot: true, username: "storex_lunch_notify_bot" },
      });
    assert.ok(url.endsWith("/deleteMessage"));
    assert.deepEqual(JSON.parse(String(init?.body)), {
      chat_id: "123456",
      message_id: 42,
    });
    calls++;
    return Response.json({ ok: true, result: calls === 1 ? false : true });
  });
  await assert.rejects(
    () => client.deleteMessage("123456", "42"),
    /BALE_DELETE_UNCONFIRMED/,
  );
  assert.equal(await client.deleteMessage("123456", "42"), true);
});

test("delete deadline is checked again after a slow identity preflight", async () => {
  let clockValue = new Date(clock.getTime() - 1000),
    deleted = false;
  const b = new BaleClient(
    async (url) => {
      if (url.endsWith("/getMe")) {
        clockValue = clock;
        return Response.json({
          ok: true,
          result: { is_bot: true, username: "storex_lunch_notify_bot" },
        });
      }
      deleted = true;
      return Response.json({ ok: true, result: true });
    },
    () => clockValue,
  );
  await assert.rejects(
    () => b.deleteMessage("123456", "42", clock),
    /BALE_DELETE_WINDOW_EXPIRED/,
  );
  assert.equal(deleted, false);
});
