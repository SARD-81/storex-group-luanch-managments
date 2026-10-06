import type {
  AutomationConfig,
  PrismaClient,
} from "@/app/generated/prisma/client";
import { getMealReportForDate } from "@/lib/reporter/next-day-report";
import { generateReportPdf } from "@/lib/reporter/generate-pdf";
import { formatPersianDateTime } from "@/lib/date/tehran-time";
import { AutomationError } from "./http";
import { BaleClient, NextcloudClient } from "./integrations";
import {
  checkPublicCapability,
  cleanError,
  queueAlert,
  storeArtifact,
  uploadArtifact,
} from "./jobs";
export async function deliverReport(
  db: PrismaClient,
  config: AutomationConfig,
  dateKey: string,
  stage: (s: string) => Promise<void>,
  now = new Date(),
  cloud = new NextcloudClient(config),
  bale = new BaleClient(),
  pdf = generateReportPdf,
) {
  let delivery = await db.reportDelivery.upsert({
    where: { reportDateKey: dateKey },
    create: { reportDateKey: dateKey },
    update: {},
  });
  if (delivery.status === "SUCCESS") return;
  if (delivery.stage === "DELIVERING")
    throw new AutomationError("AMBIGUOUS_DELIVERY", null, true);
  await stage("PUBLIC_CAPABILITY");
  const capability = await checkPublicCapability(db, config, cloud, now);
  if (capability !== "AVAILABLE")
    throw new AutomationError(
      capability === "DISABLED" ? "PUBLIC_SHARING_DISABLED" : capability,
    );
  if (!config.reportRecipient)
    throw new AutomationError("REPORT_RECIPIENT_MISSING");
  // Re-check Calendar even when resuming a persisted artifact.
  const current = await getMealReportForDate(dateKey, now);
  if (current.policy.isWorkday !== true)
    throw new AutomationError("REPORT_DATE_NOT_WORKDAY");
  if (!delivery.artifactId) {
    await stage("GENERATING");
    const jalali = current.policy.jalaliDateKey!;
    const [year, month] = jalali.split("-");
    const bytes = await pdf(current);
    const artifact = await storeArtifact(db, {
      artifactKey: `report:${dateKey}`,
      type: "REPORT_PDF",
      target: dateKey,
      extension: "pdf",
      bytes,
      nextcloudPath: `${config.reportsDirectory}/${year}/${month}/next-workday-${jalali}.pdf`,
    });
    delivery = await db.reportDelivery.update({
      where: { id: delivery.id },
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
  }
  await stage("UPLOADING");
  const artifact = await uploadArtifact(db, delivery.artifactId!, cloud);
  if (!delivery.shareId) {
    await stage("CREATING_PUBLIC_LINK");
    const share = await cloud.getOrCreateShare(artifact.nextcloudPath!, now);
    delivery = await db.reportDelivery.update({
      where: { id: delivery.id },
      data: {
        shareId: share.id,
        publicUrl: share.url,
        shareCreatedAt: share.createdAt,
        expiresAt: new Date(share.createdAt.getTime() + 86400000),
        stage: "PUBLIC_READY",
      },
    });
  }
  if (!delivery.expiresAt || delivery.expiresAt <= now || delivery.revokedAt)
    throw new AutomationError("REPORT_SHARE_EXPIRED");
  await stage("VERIFYING_PUBLIC_LINK");
  await cloud.verifyPublic(delivery.publicUrl!, artifact.sha256);
  const snapshot = delivery.snapshot as {
    label: string;
    totals: typeof current.totals;
    generatedAt: string;
  };
  const t = snapshot.totals;
  const text = `گزارش روز کاری بعد: ${snapshot.label}\nصبحانه: پرسنل ${t.breakfastEmployees}، مهمان ${t.breakfastGuests}، جمع ${t.breakfastAll}\nناهار: پرسنل ${t.lunchEmployees}، مهمان ${t.lunchGuests}، جمع ${t.lunchAll}\nPDF: ${delivery.publicUrl}\nتولید: ${formatPersianDateTime(new Date(snapshot.generatedAt))}\nارسال: ${formatPersianDateTime(now)}`;
  await stage("DELIVERING");
  await db.reportDelivery.update({
    where: { id: delivery.id },
    data: { stage: "DELIVERING", status: "RUNNING" },
  });
  try {
    const id = await bale.send(config.reportRecipient, text);
    await db.reportDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "SUCCESS",
        stage: "DELIVERED",
        baleMessageId: id,
        sentAt: now,
        nextRetryAt: null,
      },
    });
    const failures = await db.automationJobRun.count({
      where: {
        jobType: "REPORT_DELIVERY",
        target: dateKey,
        attempt: { gt: 1 },
      },
    });
    if (failures)
      await queueAlert(
        db,
        "REPORTER",
        dateKey,
        `reporter-recovered:${dateKey}`,
        `RECOVERED: گزارش ${snapshot.label} با موفقیت ارسال شد.`,
      );
  } catch (e) {
    const safe = cleanError(e);
    await db.reportDelivery.update({
      where: { id: delivery.id },
      data: {
        status: safe.uncertain ? "MANUAL_ACTION_REQUIRED" : "RETRYING",
        stage: safe.uncertain ? "DELIVERING" : "PUBLIC_READY",
      },
    });
    throw e;
  }
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
  await stage("REMINDER_SENDING");
  try {
    const messageId = await bale.send(
      config.reportRecipient,
      `یادآوری بررسی مهمان‌ها برای ${report.reportDateLabel}\nصبحانه: ${report.guestCounts.breakfast}\nناهار: ${report.guestCounts.lunch}\nدر صورت نیاز تعداد را در سامانه تغییر دهید. بدون تغییر، مقادیر فعلی پذیرفته می‌شود.`,
    );
    await db.automationJobRun.update({
      where: { id: jobId },
      data: { metadata: { messageId }, stage: "REMINDER_SENT" },
    });
  } catch (e) {
    if (!cleanError(e).uncertain) await stage("REMINDER_REJECTED");
    throw e;
  }
}
export async function revokeExpiredShares(
  db: PrismaClient,
  cloud: NextcloudClient,
  now = new Date(),
) {
  const probes = await db.automationShareLease.findMany({
    where: { shareId: { not: null }, expiresAt: { lte: now }, revokedAt: null },
  });
  for (const p of probes) {
    try {
      await cloud.revokeShare(p.shareId!);
      await db.automationShareLease.update({
        where: { id: p.id },
        data: { revokedAt: now, cleanupError: null },
      });
    } catch (e) {
      await db.automationShareLease.update({
        where: { id: p.id },
        data: { cleanupError: cleanError(e).code },
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
