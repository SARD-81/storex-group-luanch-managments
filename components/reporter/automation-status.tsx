import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPersianDateTime } from "@/lib/date/tehran-time";
import { STATUS_LABELS } from "@/components/automations/admin-shell";
export async function ReporterAutomationStatus({
  dateKey,
  admin,
}: {
  dateKey: string;
  admin: boolean;
}) {
  const [config, delivery, job] = await Promise.all([
    prisma.automationConfig.findUnique({ where: { id: "singleton" } }),
    prisma.reportDelivery.findUnique({ where: { reportDateKey: dateKey } }),
    prisma.automationJobRun.findFirst({
      where: { jobType: "REPORT_DELIVERY", target: dateKey },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const manual = !config?.reporterEnabled;
  return (
    <section className="dashboard-glass-card reporter-no-print">
      <h2 className="text-lg font-semibold">وضعیت گزارش خودکار</h2>
      <p className="mt-2">
        {manual
          ? "حالت دستی — چاپ و Excel در دسترس است"
          : "تحویل خودکار فعال است"}
      </p>
      <p className="mt-2 text-sm">
        تحویل گزارش‌های جدید با فایل مستقیم بله است؛ وضعیت Talk و اشتراک عمومی
        مانع آن نیست.
      </p>
      {delivery?.status === "SUCCESS" ? (
        <>
          <p>
            گزارش این روز ارسال شده است —{" "}
            {delivery.sentAt ? formatPersianDateTime(delivery.sentAt) : "—"}
          </p>
          {delivery.deliveryKind === "BALE_DOCUMENT" ? (
            <>
              <p>
                حذف برنامه‌ریزی‌شده:{" "}
                {delivery.deleteDueAt
                  ? formatPersianDateTime(delivery.deleteDueAt)
                  : "—"}
              </p>
              <p>وضعیت حذف: {STATUS_LABELS[delivery.deletionStatus]}</p>
              {delivery.deletedAt ? (
                <p>حذف تأییدشده: {formatPersianDateTime(delivery.deletedAt)}</p>
              ) : null}
              {delivery.deleteDueAt &&
              delivery.deleteDueAt <= new Date() &&
              delivery.deletionStatus !== "DELETED" ? (
                <p role="alert">
                  حذف هنوز تأیید نشده؛ بررسی مسئول سیستم لازم است.
                </p>
              ) : null}
            </>
          ) : (
            <p>
              روش قدیمی لینک عمومی؛ اعتبار تا{" "}
              {delivery.expiresAt
                ? formatPersianDateTime(delivery.expiresAt)
                : "—"}
            </p>
          )}
          {delivery.publicUrl &&
          !delivery.revokedAt &&
          delivery.expiresAt &&
          delivery.expiresAt > new Date() ? (
            <a
              href={delivery.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              مشاهدهٔ PDF ارسال‌شده
            </a>
          ) : delivery.deliveryKind === "LEGACY_NEXTCLOUD" ? (
            <p>لینک منقضی یا لغو شده است.</p>
          ) : null}
        </>
      ) : (
        <p className="mt-2">
          وضعیت: {job ? STATUS_LABELS[job.status] : "هنوز تحویل نشده"}{" "}
          {job?.errorCode ? <code>({job.errorCode})</code> : null}
          {job?.nextRetryAt
            ? ` — نوبت بعد: ${formatPersianDateTime(job.nextRetryAt)}`
            : ""}
        </p>
      )}
      {admin ? (
        <Link
          href="/settings/automations/reporter"
          className="mt-3 inline-block underline"
        >
          تنظیمات، اجرا و بازیابی گزارش
        </Link>
      ) : null}
    </section>
  );
}
