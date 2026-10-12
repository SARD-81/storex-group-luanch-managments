import { test } from "node:test";
import assert from "node:assert/strict";
import { BaleClient } from "../lib/automation/integrations";
import {
  latestPrivateBaleSender,
  discoverLatestBaleSender,
  pendingBaleCandidate,
} from "../lib/automation/bale-recipient-discovery";

const NOW = 1_791_800_000;
function update(id: number, chatId: number, date = NOW - 12, type = "private") {
  return {
    update_id: id,
    message: {
      chat: { id: chatId, type },
      from: { id: chatId, is_bot: false },
      date,
      text: "do not expose incoming message contents",
    },
  };
}

test("chooses last private human update rather than last group or bot message", () => {
  const events = [
    update(101, 111),
    update(104, 444, NOW - 1, "group"),
    update(103, 333),
    update(102, 222),
    { ...update(105, 555), message: { ...update(105, 555).message, from: { id: 555, is_bot: true } } },
  ];
  assert.deepEqual(latestPrivateBaleSender(events, NOW), {
    chatId: "333", updateId: 103, messageDate: NOW - 12,
  });
});

test("rejects identity mismatch, unsafe identifiers, old messages and future timestamp", () => {
  assert.throws(() => latestPrivateBaleSender([
    { ...update(1, 123), message: { ...update(1, 123).message, from: { id: 456 } } },
  ], NOW), /BALE_NO_PRIVATE_SENDER/);
  assert.throws(() => latestPrivateBaleSender([update(1, 123, NOW - 601)], NOW),
    /BALE_LAST_PRIVATE_MESSAGE_STALE/);
  assert.throws(() => latestPrivateBaleSender([update(1, 123, NOW + 61)], NOW),
    /BALE_LAST_PRIVATE_MESSAGE_STALE/);
  assert.throws(() => latestPrivateBaleSender([update(1, -123)], NOW),
    /BALE_NO_PRIVATE_SENDER/);
  assert.throws(() => latestPrivateBaleSender([update(1, Number.MAX_SAFE_INTEGER + 1)], NOW),
    /BALE_NO_PRIVATE_SENDER/);
});

test("does not pretend to know latest sender when queue is full", () => {
  assert.throws(() => latestPrivateBaleSender(
    Array.from({ length: 100 }, (_, i) => update(i, 123)), NOW,
  ), /BALE_UPDATES_BACKLOG_FULL/);
  assert.throws(() => latestPrivateBaleSender({ result: [] }, NOW), /BALE_UPDATES_INVALID/);
});

test("uses only read-only Bale calls with no offset or webhook modifications", async () => {
  const calls: { method: string; payload: Record<string, unknown> }[] = [];
  process.env.BALE_BOT_TOKEN = "synthetic-test-token";
  const bale = new BaleClient(async (url, init) => {
    const method = url.split("/").pop()!;
    const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
    calls.push({ method, payload });
    if (method === "getMe")
      return Response.json({ ok: true, result: { is_bot: true, username: "storex_lunch_notify_bot" } });
    if (method === "getWebhookInfo")
      return Response.json({ ok: true, result: { url: "" } });
    return Response.json({ ok: true, result: [update(1, 123456)] });
  });
  assert.deepEqual(await discoverLatestBaleSender(bale, NOW), {
    chatId: "123456", updateId: 1, messageDate: NOW - 12,
  });
  assert.deepEqual(calls.map(x => x.method), ["getMe", "getWebhookInfo", "getUpdates"]);
  assert.deepEqual(calls[2].payload, { limit: 100, timeout: 0 });
});

test("webhook-active discovery does not touch updates or remove the webhook", async () => {
  const calls: string[] = [];
  process.env.BALE_BOT_TOKEN = "synthetic-test-token";
  const bale = new BaleClient(async url => {
    const method = url.split("/").pop()!;
    calls.push(method);
    if (method === "getMe")
      return Response.json({ ok: true, result: { is_bot: true, username: "storex_lunch_notify_bot" } });
    return Response.json({ ok: true, result: { url: "https://hooks.example.com/bale" } });
  });
  await assert.rejects(() => discoverLatestBaleSender(bale, NOW), /BALE_WEBHOOK_ACTIVE/);
  assert.deepEqual(calls, ["getMe", "getWebhookInfo"]);
});

test("server-rendered candidate is admin-bound and expires after ten minutes", () => {
  const now = 1791800000000;
  const health = {
    baleRecipientCandidate: {
      chatId: "123456",
      updateId: 41,
      messageDate: 1791799990,
      actorId: "test-admin",
      discoveredAt: now - 1000,
    },
  };
  assert.deepEqual(pendingBaleCandidate(health, "test-admin", now), {
    chatId: "123456",
    updateId: 41,
    messageDate: 1791799990,
    actorId: "test-admin",
    discoveredAt: now - 1000,
  });
  assert.equal(pendingBaleCandidate(health, "different-admin", now), null);
  assert.equal(pendingBaleCandidate(health, "test-admin", now + 600001), null);
  assert.equal(pendingBaleCandidate({
    baleRecipientCandidate: { ...health.baleRecipientCandidate, chatId: "-10" },
  }, "test-admin", now), null);
});
