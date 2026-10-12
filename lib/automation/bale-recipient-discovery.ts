import { BaleClient } from "./integrations";
import { AutomationError } from "./http";

/**
 * Read-only discovery. Never calls getUpdates with an offset (which could
 * acknowledge another consumer's pending updates), never changes webhooks,
 * and never stores message text or sender profile data.
 */
export type PendingBaleCandidate = {
  chatId: string;
  updateId: number;
  messageDate: number;
  actorId: string;
  discoveredAt: number;
};

export function pendingBaleCandidate(
  health: unknown,
  actorId: string,
  now = Date.now(),
): PendingBaleCandidate | null {
  const outer = health && typeof health === "object" && !Array.isArray(health)
    ? (health as Record<string, unknown>)
    : {};
  const raw = outer.baleRecipientCandidate;
  const entry = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  if (
    entry.actorId !== actorId ||
    typeof entry.chatId !== "string" ||
    !/^[1-9]\d{0,15}$/.test(entry.chatId) ||
    !Number.isSafeInteger(Number(entry.chatId)) ||
    !Number.isSafeInteger(entry.updateId) ||
    Number(entry.updateId) < 0 ||
    !Number.isSafeInteger(entry.messageDate) ||
    !Number.isSafeInteger(entry.discoveredAt) ||
    Number(entry.discoveredAt) > now ||
    now - Number(entry.discoveredAt) > 600000
  ) return null;
  return {
    chatId: entry.chatId,
    updateId: Number(entry.updateId),
    messageDate: Number(entry.messageDate),
    actorId,
    discoveredAt: Number(entry.discoveredAt),
  };
}

export type BaleSenderCandidate = {
  chatId: string;
  updateId: number;
  messageDate: number;
};
type Update = {
  update_id?: unknown;
  message?: {
    date?: unknown;
    from?: { id?: unknown; is_bot?: unknown };
    chat?: { id?: unknown; type?: unknown };
  };
};
const RECENT_SECONDS = 10 * 60;

export function latestPrivateBaleSender(
  input: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
): BaleSenderCandidate {
  if (!Array.isArray(input) || input.length > 100)
    throw new AutomationError("BALE_UPDATES_INVALID");
  // With 100 results we cannot prove that newer updates have not been omitted.
  if (input.length === 100)
    throw new AutomationError("BALE_UPDATES_BACKLOG_FULL");

  const candidates: BaleSenderCandidate[] = [];
  for (const item of input as Update[]) {
    const updateId = item?.update_id;
    const message = item?.message;
    const chatId = String(message?.chat?.id ?? "");
    if (
      !Number.isSafeInteger(updateId) ||
      Number(updateId) < 0 ||
      message?.chat?.type !== "private" ||
      !/^[1-9]\d{0,15}$/.test(chatId) ||
      !Number.isSafeInteger(Number(chatId)) ||
      message?.from?.is_bot === true ||
      String(message?.from?.id ?? "") !== chatId ||
      !Number.isSafeInteger(message?.date) ||
      Number(message?.date) <= 0
    ) continue;
    candidates.push({
      chatId,
      updateId: Number(updateId),
      messageDate: Number(message!.date),
    });
  }
  if (!candidates.length) throw new AutomationError("BALE_NO_PRIVATE_SENDER");
  candidates.sort((a, b) => b.updateId - a.updateId);
  const candidate = candidates[0];
  if (
    candidate.messageDate < nowSeconds - RECENT_SECONDS ||
    candidate.messageDate > nowSeconds + 60
  ) throw new AutomationError("BALE_LAST_PRIVATE_MESSAGE_STALE");
  return candidate;
}

export async function discoverLatestBaleSender(
  bale = new BaleClient(),
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  await bale.health();
  const webhook = await bale.call("getWebhookInfo");
  if (!webhook || typeof webhook !== "object")
    throw new AutomationError("BALE_WEBHOOK_INFO_INVALID");
  if (typeof webhook.url === "string" && webhook.url.length > 0)
    throw new AutomationError("BALE_WEBHOOK_ACTIVE");
  // No offset: reading does not acknowledge, discard or consume queued updates.
  const updates = await bale.call("getUpdates", { limit: 100, timeout: 0 });
  return latestPrivateBaleSender(updates, nowSeconds);
}
