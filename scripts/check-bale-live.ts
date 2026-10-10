/**
 * One-off LIVE Bale Bot API smoke test. Never called by CI or the scheduler.
 *
 * Run on staging with the existing secure service environment loaded:
 *   node --import tsx scripts/check-bale-live.ts
 *   node --import tsx scripts/check-bale-live.ts --send-once
 *
 * The second command intentionally sends ONE test message to the configured
 * private REPORT_RECIPIENT. Do not use a real recipient without permission.
 * BALE_BOT_TOKEN is read only from ENV and never printed.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { BaleClient } from "../lib/automation/integrations";
import { cleanError } from "../lib/automation/jobs";

async function main() {
  const mode = process.argv[2] ?? "--check";
  if (!["--check", "--send-once"].includes(mode) || process.argv.length > 3) {
    throw new Error("INVALID_TEST_ARGUMENT");
  }
  if (!process.env.BALE_BOT_TOKEN) {
    throw new Error("BALE_NOT_CONFIGURED");
  }
  const config = await prisma.automationConfig.findUnique({
    where: { id: "singleton" },
    select: { reportRecipient: true },
  });
  const recipient = config?.reportRecipient?.trim();
  if (!recipient || !/^\\d{1,30}$/.test(recipient)) {
    throw new Error("BALE_PRIVATE_RECIPIENT_NOT_CONFIGURED");
  }

  const client = new BaleClient();
  const me = (await client.call("getMe")) as { id?: unknown; is_bot?: unknown };
  if (!me?.id) throw new Error("BALE_GET_ME_INVALID");
  const chat = (await client.call("getChat", { chat_id: recipient })) as {
    id?: unknown;
    type?: unknown;
  };
  if (chat.type !== "private" || String(chat.id) !== recipient) {
    throw new Error("BALE_CHAT_NOT_PRIVATE_OR_MISMATCHED");
  }
  console.log(JSON.stringify({
    stage: "BOT_AND_PRIVATE_CHAT_VERIFIED",
    mode,
    success: true,
  }));
  if (mode === "--check") {
    console.log("No message sent. To send exactly one test, rerun with --send-once.");
    return;
  }

  const marker = randomUUID().slice(0, 8);
  const text =
    "🧪 آزمون اتصال بله - سامانه StoreX\\n" +
    "این پیام فقط برای تأیید ارتباط Bot API است و گزارش واقعی نیست.\\n" +
    `کد تأیید آزمون: ${marker}`;
  const messageId = await client.send(recipient, text);
  console.log(JSON.stringify({
    stage: "TEST_MESSAGE_ACCEPTED_BY_BALE",
    success: true,
    messageId,
    marker,
    manualVerificationRequired: "Recipient must confirm that the message appeared in Bale.",
  }));
}

main()
  .catch((error: unknown) => {
    const code = error instanceof Error &&
      /^[A-Z][A-Z0-9_]+$/.test(error.message)
        ? error.message
        : cleanError(error).code;
    console.error(JSON.stringify({ success: false, code }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
