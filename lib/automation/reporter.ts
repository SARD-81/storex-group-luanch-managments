import { reporterReviewUrl } from "./reminder-link";
import type {
  AutomationConfig,
  PrismaClient,
} from "@/app/generated/prisma/client";
import { getMealReportForDate } from "@/lib/reporter/next-day-report";
import { generateReportPdf } from "@/lib/reporter/generate-pdf";
import { formatPersianDateTime } from "@/lib/date/tehran-time";
import { AutomationError } from "./http";
import {
  BaleClient,
  NextcloudClient,
  validateBalePdf,
  type BaleDocumentReceipt,
} from "./integrations";
import { cleanupProbeFile, PROBE_CLEANUP_PENDING } from "./capability-probe";
import {
  checkPublicCapability,
  cleanError,
  queueAlert,
  storeArtifact,
  readPrivateArtifact,
} from "./jobs";
export async function deliverReport(
  db: PrismaClient,
  config: AutomationConfig,
  dateKey: string,
  stage: (s: string) => Promise<void>,
  now = new Date(),
  _legacyCloud?: NextcloudClient,
  bale = new BaleClient(),
  pdf = generateReportPdf,
) {
  let delivery = await db.reportDelivery.upsert({
    where: { reportDateKey: dateKey },
    create: { reportDateKey: dateKey, deliveryKind: "BALE_DOCUMENT" },
    update: {},
  });
  if (delivery.status === "SUCCESS") return; // Deletion never grants permission to resend.
  if (delivery.stage === "DELIVERING")
    throw new AutomationError("AMBIGUOUS_DELIVERY", null, true);
  if (delivery.shareId || delivery.deliveryKind !== "BALE_DOCUMENT")
    throw new AutomationError("LEGACY_REPORT_REVIEW_REQUIRED", null, true);
  if (!config.reportRecipient)
    throw new AutomationError("REPORT_RECIPIENT_MISSING");
  const current = await getMealReportForDate(dateKey, now);
  if (current.policy.isWorkday !== true)
    throw new AutomationError("REPORT_DATE_NOT_WORKDAY");
  if (!delivery.artifactId) {
    await stage("GENERATING");
    const bytes = await pdf(current),
      deliveryId = delivery.id;
    delivery = await db.$transaction(async (tx) => {
      const artifact = await storeArtifact(tx, {
        artifactKey: `report:${dateKey}`,
        type: "REPORT_PDF",
        target: dateKey,
        extension: "pdf",
        bytes,
        nextcloudPath: null,
      });
      return tx.reportDelivery.update({
        where: { id: deliveryId },
        data: {
          artifactId: artifact.id,
          stage: "GENERATED",
          snapshot: {
            label: current.reportDateLabel,
            totals: current.totals,
            generatedAt: now.toISOString(),
          },
        },
      });
    });
  }
  const artifact = await db.automationArtifact.findUniqueOrThrow({
    where: { id: delivery.artifactId! },
  });
  const bytes = await readPrivateArtifact(artifact);
  const snapshot = delivery.snapshot as {
    label: string;
    totals: typeof current.totals;
    generatedAt: string;
  };
  const t = snapshot.totals;
  const caption = `گزارش روز کاری بعد: ${snapshot.label}\nصبحانه: پرسنل ${t.breakfastEmployees}، مهمان ${t.breakfastGuests}، جمع ${t.breakfastAll}\nناهار: پرسنل ${t.lunchEmployees}، مهمان ${t.lunchGuests}، جمع ${t.lunchAll}\nتولید: ${formatPersianDateTime(new Date(snapshot.generatedAt))}\nحذف برنامه‌ریزی‌شدهٔ پیام: ۲۴ ساعت پس از ارسال؛ نسخه‌های دانلودشده حذف نمی‌شوند.`;
  const input = {
    bytes,
    mimeType: "application/pdf",
    filename: `next-workday-${current.policy.jalaliDateKey}.pdf`,
    sha256: artifact.sha256,
    caption,
  };
  validateBalePdf(input);
  await stage("DELIVERING");
  await db.reportDelivery.update({
    where: { id: delivery.id },
    data: {
      stage: "DELIVERING",
      status: "RUNNING",
      baleChatId: config.reportRecipient,
      sendAttemptedAt: now,
    },
  });
  let receipt: BaleDocumentReceipt;
  try {
    receipt = await bale.sendDocument(config.reportRecipient, input);
  } catch (e) {
    const uncertain = !(e instanceof AutomationError) || e.uncertain;
    await db.reportDelivery.update({
      where: { id: delivery.id },
      data: {
        status: uncertain ? "MANUAL_ACTION_REQUIRED" : "RETRYING",
        stage: uncertain ? "DELIVERING" : "GENERATED",
      },
    });
    throw uncertain && !(e instanceof AutomationError)
      ? new AutomationError("AMBIGUOUS_DELIVERY", null, true)
      : e;
  }
  // Reject stale/contradictory API timestamps; fallback is the successful receipt time.
  const apiTime =
    receipt.apiSentAt && receipt.apiSentAt.getTime() >= now.getTime() - 60000
      ? receipt.apiSentAt
      : null;
  const sentAt = apiTime ?? receipt.receivedAt;
  try {
    await db.reportDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "SUCCESS",
        stage: "DELIVERED",
        baleChatId: receipt.chatId,
        baleMessageId: receipt.messageId,
        sentAt,
        sentTimeSource: apiTime ? "BALE_MESSAGE_DATE" : "API_RECEIPT_TIME",
        deleteDueAt: new Date(sentAt.getTime() + 86400000),
        // Conservative deadline when the API omits date: never extend the real window by network latency.
        deleteBeforeAt: new Date(
          Math.min(sentAt.getTime(), now.getTime()) + 2 * 86400000,
        ),
        deletionStatus: "SCHEDULED",
        nextRetryAt: null,
      },
    });
  } catch {
    throw new AutomationError("BALE_RECEIPT_PERSIST_FAILED", null, true);
  }
  const failures = await db.automationJobRun.count({
    where: { jobType: "REPORT_DELIVERY", target: dateKey, attempt: { gt: 1 } },
  });
  if (failures)
    await queueAlert(
      db,
      "REPORTER",
      dateKey,
      `reporter-recovered:${dateKey}`,
      `RECOVERED: گزارش ${dateKey} با موفقیت ارسال شد.`,
    );
}
export async function sendGuestReminder(
  db: PrismaClient,
  config: AutomationConfig,
  dateKey: string,
  jobId: string,
  stage: (s: string) => Promise<void>,
  now = new Date(),
  bale = new BaleClient(),
) {
  const job = await db.automationJobRun.findUniqueOrThrow({
    where: { id: jobId },
  });
  if (job.stage === "REMINDER_SENT") return;
  if (job.stage === "REMINDER_SENDING")
    throw new AutomationError("AMBIGUOUS_DELIVERY", null, true);
  const report = await getMealReportForDate(dateKey, now);
  if (report.policy.isWorkday !== true)
    throw new AutomationError("REPORT_DATE_NOT_WORKDAY");
  const reviewUrl = reporterReviewUrl();
  await stage("REMINDER_SENDING");
  let messageId: string;
  try {
    messageId = await bale.send(
      config.reportRecipient,
      `یادآوری بررسی مهمان‌ها برای ${report.reportDateLabel}\nصبحانه: ${report.guestCounts.breakfast}\nناهار: ${report.guestCounts.lunch}\nبرای بررسی یا اصلاح، وارد حساب مجاز گزارش‌گیر شوید:\n${reviewUrl}\nدر صورت نیاز تعداد را در سامانه تغییر دهید. بدون تغییر، مقادیر فعلی پذیرفته می‌شود.`,
    );
  } catch (e) {
    if (e instanceof AutomationError && !e.uncertain) {
      await stage("REMINDER_REJECTED");
      throw e;
    }
    throw new AutomationError("AMBIGUOUS_DELIVERY", null, true);
  }
  await db.automationJobRun.update({
    where: { id: jobId },
    data: { metadata: { messageId }, stage: "REMINDER_SENT" },
  });
}
export async function revokeExpiredShares(
  db: PrismaClient,
  cloud: NextcloudClient,
  now = new Date(),
) {
  const probes = await db.automationShareLease.findMany({
    where: {
      OR: [
        { shareId: { not: null }, expiresAt: { lte: now }, revokedAt: null },
        { revokedAt: { not: null }, cleanupError: PROBE_CLEANUP_PENDING },
      ],
    },
  });
  for (const p of probes) {
    try {
      if (!p.revokedAt) {
        await cloud.revokeShare(p.shareId!);
        await db.automationShareLease.update({
          where: { id: p.id },
          data: { revokedAt: now, cleanupError: PROBE_CLEANUP_PENDING },
        });
      }
      await cleanupProbeFile(db, cloud, p);
    } catch (e) {
      await db.automationShareLease.update({
        where: { id: p.id },
        data: {
          cleanupError: (
            await db.automationShareLease.findUniqueOrThrow({
              where: { id: p.id },
            })
          ).revokedAt
            ? PROBE_CLEANUP_PENDING
            : cleanError(e).code,
        },
      });
      throw e;
    }
  }
  const deliveries = await db.reportDelivery.findMany({
    where: { shareId: { not: null }, expiresAt: { lte: now }, revokedAt: null },
  });
  for (const d of deliveries) {
    try {
      await cloud.revokeShare(d.shareId!);
      await db.reportDelivery.update({
        where: { id: d.id },
        data: { revokedAt: now, cleanupError: null },
      });
    } catch (e) {
      await db.reportDelivery.update({
        where: { id: d.id },
        data: { cleanupError: cleanError(e).code },
      });
      await queueAlert(
        db,
        "SHARE_CLEANUP",
        d.reportDateKey,
        `share-cleanup:${d.id}:${now.toISOString().slice(0, 10)}`,
        `خطای لغو لینک منقضی گزارش ${d.reportDateKey}: ${cleanError(e).code}`,
      );
      throw e;
    }
  }
}
