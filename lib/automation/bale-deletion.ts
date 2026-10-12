import type { PrismaClient } from "@/app/generated/prisma/client";
import { BaleClient } from "./integrations";
import { AutomationError } from "./http";
import { cleanError, ensureJob, queueAlert } from "./jobs";

/** Called under the existing session worker lock, before ordinary work. */
export async function processBaleDeletions(
  db: PrismaClient,
  now = new Date(),
  bale = new BaleClient(),
) {
  const deliveries = await db.reportDelivery.findMany({
    where: {
      deliveryKind: "BALE_DOCUMENT",
      deleteDueAt: { lte: now },
      deletionStatus: {
        notIn: ["NOT_APPLICABLE", "DELETED", "WINDOW_EXPIRED"],
      },
    },
    orderBy: { deleteBeforeAt: "asc" },
    take: 100,
  });
  for (const d of deliveries) {
    const job = await ensureJob(
      db,
      "BALE_MESSAGE_DELETE",
      `bale-delete:${d.id}`,
      d.id,
    );
    const alert = (kind: string, message: string) =>
      queueAlert(
        db,
        "BALE_DELETION",
        d.reportDateKey,
        `bale-delete-${kind}:${d.id}`,
        `${message}؛ گزارش ${d.reportDateKey}؛ اجرا ${job.id}`,
      );
    const deadline =
      d.deleteBeforeAt ??
      (d.sentAt ? new Date(d.sentAt.getTime() + 172800000) : null);
    if (!deadline || !d.baleChatId || !d.baleMessageId) {
      await db.reportDelivery.update({
        where: { id: d.id },
        data: {
          deletionStatus: "MANUAL_ACTION_REQUIRED",
          deletionErrorCode: "BALE_DELETE_IDENTITY_MISSING",
        },
      });
      await db.automationJobRun.update({
        where: { id: job.id },
        data: {
          status: "MANUAL_ACTION_REQUIRED",
          errorCode: "BALE_DELETE_IDENTITY_MISSING",
          nextRetryAt: null,
        },
      });
      await alert("identity", "رسید حذف کامل نیست؛ بررسی انسانی لازم است");
      continue;
    }
    if (now >= deadline) {
      await db.$transaction([
        db.reportDelivery.update({
          where: { id: d.id },
          data: {
            deletionStatus: "WINDOW_EXPIRED",
            deletionErrorCode: "BALE_DELETE_WINDOW_EXPIRED",
            deletionNextRetryAt: null,
          },
        }),
        db.automationJobRun.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            stage: "WINDOW_EXPIRED",
            errorCode: "BALE_DELETE_WINDOW_EXPIRED",
            nextRetryAt: null,
            finishedAt: now,
          },
        }),
      ]);
      await alert(
        "expired",
        "محدودیت ۴۸ساعته حذف پیام گذشته است؛ حذف API تضمین‌پذیر نیست و اقدام انسانی لازم است",
      );
      continue;
    }
    if (now.getTime() > d.deleteDueAt!.getTime()) {
      if (!d.deletionOverdueAt)
        await db.reportDelivery.update({
          where: { id: d.id },
          data: { deletionOverdueAt: now },
        });
      await alert("overdue", "حذف پیام از موعد ۲۴ساعته عقب افتاده است");
    }
    if (deadline.getTime() - now.getTime() <= 6 * 3600000)
      await alert(
        "critical",
        "هشدار فوری: کمتر از ۶ ساعت تا پایان فرصت حذف پیام باقی مانده است",
      );
    if (
      d.deletionStatus === "MANUAL_ACTION_REQUIRED" ||
      (d.deletionNextRetryAt && d.deletionNextRetryAt > now)
    )
      continue;
    await db.$transaction([
      db.reportDelivery.update({
        where: { id: d.id },
        data: {
          deletionStatus: "UNCERTAIN",
          deletionAttempts: { increment: 1 },
        },
      }),
      db.automationJobRun.update({
        where: { id: job.id },
        data: {
          status: "RUNNING",
          stage: "DELETING_BALE_MESSAGE",
          attempt: { increment: 1 },
          startedAt: now,
          finishedAt: null,
        },
      }),
    ]);
    let confirmed = false;
    try {
      await bale.deleteMessage(d.baleChatId, d.baleMessageId);
      await db.$transaction([
        db.reportDelivery.update({
          where: { id: d.id },
          data: {
            deletionStatus: "DELETED",
            deletedAt: now,
            deletionNextRetryAt: null,
            deletionErrorCode: null,
            deletionReceipt: {
              method: "deleteMessage",
              ok: true,
              result: true,
              confirmedAt: now.toISOString(),
            },
          },
        }),
        db.automationJobRun.update({
          where: { id: job.id },
          data: {
            status: "SUCCESS",
            stage: "COMPLETE",
            finishedAt: now,
            nextRetryAt: null,
            errorCode: null,
            errorMessage: null,
          },
        }),
      ]);
      confirmed = true;
    } catch (error) {
      const safe = cleanError(error);
      const delay = Math.max(
        error instanceof AutomationError ? (error.retryAfterSeconds ?? 0) : 0,
        [60, 120, 300, 900, 1800][Math.min(d.deletionAttempts, 4)],
      );
      const retryAt = new Date(now.getTime() + delay * 1000);
      const terminal =
        [
          "BALE_MESSAGE_NOT_FOUND",
          "BALE_FORBIDDEN",
          "BALE_DELETE_IDENTITY_INVALID",
        ].includes(safe.code) || retryAt >= deadline;
      const code =
        retryAt >= deadline ? "BALE_DELETE_RETRY_BEYOND_WINDOW" : safe.code;
      // A failed DB acknowledgement or ambiguous deletion is safe to retry for this exact ID.
      // "Not found" is not proof of our successful deletion and requires manual review.
      await db.$transaction([
        db.reportDelivery.update({
          where: { id: d.id },
          data: {
            deletionStatus: terminal
              ? "MANUAL_ACTION_REQUIRED"
              : safe.uncertain || !(error instanceof AutomationError)
                ? "UNCERTAIN"
                : "RETRYING",
            deletionErrorCode: code,
            deletionNextRetryAt: terminal ? null : retryAt,
          },
        }),
        db.automationJobRun.update({
          where: { id: job.id },
          data: {
            status: terminal ? "MANUAL_ACTION_REQUIRED" : "RETRYING",
            errorCode: code,
            errorMessage: code,
            finishedAt: now,
            nextRetryAt: terminal ? null : retryAt,
          },
        }),
      ]);
      await alert(
        terminal ? "manual" : "failure",
        `حذف پیام تأیید نشد: ${code}${terminal ? "؛ بررسی دستی لازم است" : "؛ تلاش مجدد برنامه‌ریزی شد"}`,
      );
    }
    if (confirmed && (d.deletionAttempts || d.deletionOverdueAt))
      await alert("recovered", "RECOVERED: حذف پیام بله با رسید موفق تأیید شد");
  }
}
