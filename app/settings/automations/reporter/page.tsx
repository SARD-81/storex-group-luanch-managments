import Link from "next/link";
import { BaleRecipientDiscovery } from "@/components/automations/bale-recipient-discovery";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getAutomationConfig, credentialStatus } from "@/lib/automation/config";
import { formatPersianDateTime } from "@/lib/date/tehran-time";
import {
  AutomationNotice,
  AutomationShell,
  STATUS_LABELS,
} from "@/components/automations/admin-shell";
import { JobHistory } from "@/components/automations/job-history";
import {
  queueAutomationJobAction,
  resolveReportDeliveryAction,
  updateAutomationConfigAction,
} from "@/actions/automations";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; discovery?: string; discoveryError?: string }>;
}) {
  const actor = await requireAdmin();
  const params = await searchParams;
  const [c, jobs, deliveries] = await Promise.all([
    getAutomationConfig(prisma),
    prisma.automationJobRun.findMany({
      where: {
        OR: [
          { jobType: { startsWith: "REPORT_" } },
          { jobType: "BALE_MESSAGE_DELETE" },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.reportDelivery.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const settings = [
    ["reportRecipient", "شناسهٔ چت تک‌نفرهٔ گیرندهٔ بله"],
  ] as const;
  const health = c.health as {
    credentialsConfigured?: { bale?: boolean };
    bale?: { state?: string; checkedAt?: string; errorCode?: string };
  } | null;
  const times = [
    ["reminder1", "یادآوری اول"],
    ["reminder2", "یادآوری دوم"],
    ["deliveryTime", "تحویل اصلی"],
    ["retry1", "تلاش مجدد اول"],
    ["retry2", "تلاش مجدد دوم"],
    ["finalRetry", "تلاش نهایی / ارجاع"],
  ] as const;
  return (
    <AutomationShell title="اتوماسیون گزارش روز کاری بعد">
      <AutomationNotice {...params} />
      <section className="dashboard-glass-card">
        <p>
          گزارش‌های جدید به‌صورت فایل PDF مستقیماً در چت خصوصی بله ارسال
          می‌شوند؛ Nextcloud و Talk اختیاری‌اند.
        </p>
        <p className="mt-2">
          توکن بله:{" "}
          {(health?.credentialsConfigured?.bale ?? credentialStatus().bale)
            ? "در سرور تنظیم شده"
            : "تنظیم نشده"}{" "}
          — اتصال و گیرندهٔ خصوصی:{" "}
          {health?.bale?.state === "READY"
            ? "تأیید شده"
            : health?.bale?.state === "ERROR"
              ? `خطا: ${health.bale.errorCode ?? "نامشخص"}`
              : "بررسی نشده"}
        </p>
        <p>
          گیرندهٔ اصلی باید جداگانه تأیید شود؛ شناسهٔ حساب تست مقصد تولید نیست.
        </p>
        <form action={queueAutomationJobAction} className="mt-3">
          <input type="hidden" name="jobType" value="BALE_HEALTH" />
          <button className="dashboard-action-button">
            بررسی بله و گیرندهٔ خصوصی بدون ارسال
          </button>
        </form>
        <form
          action={updateAutomationConfigAction}
          className="mt-4 grid gap-4 md:grid-cols-2"
        >
          <input type="hidden" name="scope" value="reporter" />
          <label className="md:col-span-2">
            <input
              type="checkbox"
              name="reporterEnabled"
              defaultChecked={c.reporterEnabled}
            />{" "}
            فعال‌بودن گزارش خودکار (برداشتن علامت = مکث)
          </label>
          {settings.map(([key, label]) => (
            <label key={key} className="text-sm">
              {label}
              <input
                name={key}
                defaultValue={c[key]}
                maxLength={500}
                dir="ltr"
                className="dashboard-muted-panel mt-2 w-full"
              />
            </label>
          ))}
          {times.map(([key, label]) => (
            <label key={key} className="text-sm">
              {label} — تهران
              <input
                type="time"
                name={key}
                defaultValue={c[key]}
                required
                dir="ltr"
                className="dashboard-muted-panel mt-2 w-full"
              />
            </label>
          ))}
          <p className="text-sm md:col-span-2">
            نام کاربری سرویس، App Password و توکن بله فقط در ENV سرور تنظیم
            می‌شوند.
          </p>
          <button className="dashboard-primary-button md:col-span-2">
            ذخیرهٔ تنظیمات
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={queueAutomationJobAction}>
            <input type="hidden" name="jobType" value="REPORT_DELIVERY" />
            <button className="dashboard-action-button">
              اجرای گزارش اکنون
            </button>
          </form>
          <Link href="/reporter/next-day" className="dashboard-action-button">
            گزارش، چاپ و Excel دستی
          </Link>
        </div>
      </section>
      <BaleRecipientDiscovery
        currentRecipient={c.reportRecipient}
        reporterEnabled={c.reporterEnabled}
        health={c.health}
        actorId={actor.id}
        discovery={params.discovery}
        discoveryError={params.discoveryError}
      />
      <section className="dashboard-glass-card">
        <h2 className="mb-3 text-lg font-bold">تاریخچه تحویل PDF</h2>
        <p>
          پیام‌های PDF در بله به‌صورت خودکار حذف نمی‌شوند. وضعیت حذف مربوط به سوابق قدیمی صرفاً برای ثبت تاریخچه باقی مانده است.
        </p>
        {deliveries.map((d) => (
          <article key={d.id} className="border-t border-border py-4">
            <p>
              {d.reportDateKey} — {STATUS_LABELS[d.status]} —{" "}
              <code>{d.stage}</code>
            </p>
            <p className="text-sm">
              ارسال: {d.sentAt ? formatPersianDateTime(d.sentAt) : "—"} | انقضا:{" "}
              {d.expiresAt ? formatPersianDateTime(d.expiresAt) : "—"} | لغو:{" "}
              {d.revokedAt ? formatPersianDateTime(d.revokedAt) : "—"}
            </p>
            <p className="text-sm">
              رسید بله: {d.baleMessageId ?? "—"} | خطای لغو:{" "}
              {d.cleanupError ?? "—"}
            </p>
            {d.deliveryKind === "BALE_DOCUMENT" ? (
              <div className="mt-2 space-y-1 text-sm">
                <p>
                  روش: PDF مستقیم — چت مقصد:{" "}
                  <span dir="ltr">{d.baleChatId ?? "—"}</span>
                </p>
                {d.deletionStatus !== "NOT_APPLICABLE" ? (
                  <p>سابقه حذف قدیمی: {STATUS_LABELS[d.deletionStatus]} (دیگر به‌صورت خودکار اجرا نمی‌شود)</p>
                ) : (
                  <p>بدون انقضای خودکار پیام</p>
                )}
                {d.artifactId ? (
                  <Link
                    className="underline"
                    href={`/settings/automations/artifacts/${d.artifactId}`}
                  >
                    دریافت PDF خصوصی ثبت‌شده
                  </Link>
                ) : null}
              </div>
            ) : (
              <p>
                روش قدیمی Nextcloud — لغو share تاریخی همچنان پیگیری می‌شود.
              </p>
            )}
            {d.publicUrl &&
            !d.revokedAt &&
            d.expiresAt &&
            d.expiresAt > new Date() ? (
              <a
                href={d.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                مشاهدهٔ PDF عمومی
              </a>
            ) : null}
            {d.stage === "DELIVERING" && d.status !== "SUCCESS" ? (
              <form
                action={resolveReportDeliveryAction}
                className="mt-4 grid gap-3"
              >
                <input type="hidden" name="deliveryId" value={d.id} />
                <p>
                  نتیجهٔ ارسال نامشخص است. ابتدا چت گیرنده را بررسی کنید؛ تأیید
                  «ارسال نشده» یک تلاش جدید را مجاز می‌کند.
                </p>
                <label>
                  <input
                    type="radio"
                    name="resolution"
                    value="DELIVERED"
                    required
                  />{" "}
                  پیام تحویل شده است
                </label>
                <label>
                  <input
                    type="radio"
                    name="resolution"
                    value="NOT_SENT"
                    required
                  />{" "}
                  بررسی کردم؛ پیام ارسال نشده است
                </label>
                <input
                  name="receipt"
                  placeholder="شناسهٔ پیام؛ برای تحویل‌شده لازم است"
                  className="dashboard-muted-panel"
                />
                <label>
                  زمان واقعی پیام با منطقهٔ زمانی؛ برای «تحویل‌شده» لازم است
                  <input
                    name="sentAt"
                    placeholder="2026-10-12T09:30:00+03:30"
                    dir="ltr"
                    className="dashboard-muted-panel w-full"
                  />
                </label>
                <textarea
                  name="note"
                  minLength={10}
                  maxLength={500}
                  required
                  placeholder="نتیجه و دلیل بررسی"
                  className="dashboard-muted-panel"
                />
                <button className="dashboard-primary-button">
                  ثبت نتیجهٔ بررسی
                </button>
              </form>
            ) : null}
          </article>
        ))}
      </section>
      <JobHistory jobs={jobs} />
    </AutomationShell>
  );
}
