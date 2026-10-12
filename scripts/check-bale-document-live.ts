/** Opt-in synthetic document probe. Never invoked by CI. No automatic message deletion. */
import "dotenv/config";
import { randomUUID, createHash } from "node:crypto";
import { prisma } from "../lib/prisma";
import { BaleClient } from "../lib/automation/integrations";
import { getAutomationConfig } from "../lib/automation/config";
import { cleanError, storeArtifact } from "../lib/automation/jobs";
import { probePdf } from "../lib/automation/capability-probe";
import { withWorkerLock } from "../lib/automation/worker";
async function main() {
  const mode = process.argv[2] ?? "--check";
  if (
    !["--check", "--send-document-once"].includes(mode) ||
    process.argv.length > 3
  )
    throw Error("INVALID_TEST_ARGUMENT");
  if (process.env.STOREX_ENVIRONMENT !== "staging")
    throw Error("CONTROLLED_STAGING_REQUIRED");
  const c = await getAutomationConfig(prisma),
    bale = new BaleClient();
  if (c.reporterEnabled) throw Error("PAUSE_REPORTER_DURING_PROBE");
  await bale.health();
  await bale.privateChat(c.reportRecipient);
  console.log(
    JSON.stringify({
      stage: "BOT_AND_PRIVATE_CHAT_VERIFIED",
      success: true,
      mode,
    }),
  );
  if (mode === "--check") return;
  await withWorkerLock(async () => {
    if (
      await prisma.reportDelivery.count({
        where: {
          reportDateKey: { startsWith: "live-probe:" },
          stage: "DELIVERING",
        },
      })
    )
      throw Error("AMBIGUOUS_PROBE_REQUIRES_REVIEW");
    const marker = randomUUID().slice(0, 8),
      key = `live-probe:${randomUUID()}`,
      bytes = probePdf(),
      sha256 = createHash("sha256").update(bytes).digest("hex"),
      attemptedAt = new Date();
    const artifact = await storeArtifact(prisma, {
      artifactKey: key,
      type: "REPORT_PDF",
      target: key,
      extension: "pdf",
      bytes,
      nextcloudPath: null,
    });
    const d = await prisma.reportDelivery.create({
      data: {
        reportDateKey: key,
        deliveryKind: "BALE_DOCUMENT",
        artifactId: artifact.id,
        stage: "DELIVERING",
        status: "MANUAL_ACTION_REQUIRED",
        baleChatId: c.reportRecipient,
        sendAttemptedAt: attemptedAt,
      },
    });
    const receipt = await bale.sendDocument(c.reportRecipient, {
      bytes,
      sha256,
      mimeType: "application/pdf",
      filename: `storex-test-${marker}.pdf`,
      caption: `آزمون PDF مصنوعی StoreX؛ فاقد اطلاعات کارکنان؛ کد ${marker}. پیام آزمایشی به‌صورت خودکار حذف نمی‌شود.`,
    });
    const sentAt = receipt.apiSentAt ?? receipt.receivedAt;
    await prisma.reportDelivery.update({
      where: { id: d.id },
      data: {
        status: "SUCCESS",
        stage: "DELIVERED",
        sentAt,
        baleMessageId: receipt.messageId,
        sentTimeSource: receipt.apiSentAt
          ? "BALE_MESSAGE_DATE"
          : "API_RECEIPT_TIME",
        deleteDueAt: null,
        deleteBeforeAt: null,
        deletionStatus: "NOT_APPLICABLE",
      },
    });
    console.log(
      JSON.stringify({
        success: true,
        probeId: d.id,
        messageId: receipt.messageId,
        marker,
        manualReceptionConfirmationRequired: true,
        automaticDeletion: false,
      }),
    );
  });
}
main()
  .catch((e) => {
    console.error(
      JSON.stringify({
        success: false,
        code:
          e instanceof Error && /^[A-Z_]+$/.test(e.message)
            ? e.message
            : cleanError(e).code,
      }),
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
