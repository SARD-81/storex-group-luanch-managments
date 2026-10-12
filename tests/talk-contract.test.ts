import { test } from "node:test";
import assert from "node:assert/strict";
import { NextcloudClient } from "../lib/automation/integrations";
import type { AutomationConfig } from "../app/generated/prisma/client";
const c = {
  nextcloudBaseUrl: "https://cloud.example.test",
  technicalConversation: "groupabc",
  talkEnabled: true,
} as AutomationConfig;
const ocs = (data: unknown) =>
  Response.json({ ocs: { meta: { statuscode: 100 }, data } });
process.env.NEXTCLOUD_USERNAME = "synthetic-service";
process.env.NEXTCLOUD_APP_PASSWORD = "synthetic-password";
test("Talk validates a private writable group before posting a minimal technical alert", async () => {
  const calls: string[] = [];
  const client = new NextcloudClient(c, async (url, init) => {
    calls.push(url);
    assert.ok(
      new Headers(init?.headers).get("Authorization")?.startsWith("Basic "),
    );
    if (url.includes("/room/"))
      return ocs({
        type: 2,
        participantType: 3,
        readOnly: 0,
        permissions: 128,
      });
    assert.deepEqual(JSON.parse(String(init?.body)), {
      message: "خطای فنی مصنوعی",
      referenceId: "0".repeat(64),
    });
    return ocs({ id: 42 });
  });
  assert.equal(await client.talk("خطای فنی مصنوعی", "0".repeat(64)), "42");
  assert.equal(calls.length, 2);
});
for (const [name, room, code] of [
  ["private one-to-one", { type: 1 }, "TALK_ROOM_NOT_GROUP"],
  ["public group", { type: 3 }, "TALK_ROOM_NOT_GROUP"],
  [
    "read-only",
    { type: 2, participantType: 3, readOnly: 1 },
    "TALK_SEND_PERMISSION_MISSING",
  ],
  [
    "guest",
    { type: 2, participantType: 4, readOnly: 0 },
    "TALK_SEND_PERMISSION_MISSING",
  ],
  [
    "missing posting permission",
    { type: 2, participantType: 3, readOnly: 0, permissions: 1 },
    "TALK_SEND_PERMISSION_MISSING",
  ],
] as const)
  test(`Talk ${name} cannot receive the technical post`, async () => {
    const client = new NextcloudClient(c, async (url) => {
      assert.ok(url.includes("/room/"));
      return ocs(room);
    });
    await assert.rejects(
      () => client.talk("synthetic", "key"),
      new RegExp(code),
    );
  });
for (const [status, code] of [
  [401, "NEXTCLOUD_AUTH_FAILED"],
  [403, "NEXTCLOUD_PERMISSION_DENIED"],
  [404, "NEXTCLOUD_HTTP_ERROR"],
  [429, "NEXTCLOUD_HTTP_ERROR"],
] as const)
  test(`Talk connection HTTP ${status} is reported without exposing response/secret`, async () => {
    const client = new NextcloudClient(
      c,
      async () => new Response("do not log credentials", { status }),
    );
    await assert.rejects(() => client.talkHealth(), new RegExp(code));
  });
test("Talk malformed send acknowledgement is ambiguous rather than automatically duplicated", async () => {
  const client = new NextcloudClient(c, async (url) =>
    url.includes("/room/")
      ? ocs({ type: 2, participantType: 3, readOnly: 0, permissions: 128 })
      : new Response("invalid response"),
  );
  await assert.rejects(
    () => client.talk("synthetic", "key"),
    (e) =>
      e instanceof Error &&
      e.message === "NEXTCLOUD_INVALID_RESPONSE" &&
      (e as { uncertain?: boolean }).uncertain === true,
  );
});
