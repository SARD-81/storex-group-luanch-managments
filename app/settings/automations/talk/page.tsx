import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { credentialStatus, getAutomationConfig } from "@/lib/automation/config";
import {
  AutomationShell,
  AutomationNotice,
  STATUS_LABELS,
} from "@/components/automations/admin-shell";
import {
  queueAutomationJobAction,
  updateAutomationConfigAction,
} from "@/actions/automations";
import { formatPersianDateTime } from "@/lib/date/tehran-time";
import { AlertReview } from "@/components/automations/alert-review";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdmin();
  const [params, c, alerts, lastSuccessful] = await Promise.all([
    searchParams,
    getAutomationConfig(prisma),
    prisma.automationAlert.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.automationAlert.findFirst({
      where: { status: "SUCCESS" },
      orderBy: { sentAt: "desc" },
    }),
  ]);
  const health = c.health as {
    credentialsConfigured?: { nextcloud?: boolean };
    talk?: { state?: string; errorCode?: string; checkedAt?: string };
  } | null;
  const configured = c.nextcloudBaseUrl && c.technicalConversation;
  const failed =
    health?.talk?.state === "ERROR" ||
    alerts.some(
      (a) =>
        ["RETRYING", "MANUAL_ACTION_REQUIRED"].includes(a.status) &&
        a.errorCode,
    );
  const state = !configured
    ? "Not Configured"
    : !c.talkEnabled
      ? "Disabled"
      : !(
            health?.credentialsConfigured?.nextcloud ??
            credentialStatus().nextcloud
          )
        ? "Not Configured"
        : failed
          ? "Error"
          : health?.talk?.state === "READY"
            ? "Ready"
            : "Not Checked";
  return (
    <AutomationShell title="اعلان‌های فنی اختیاری Nextcloud Talk">
      <AutomationNotice {...params} />
      <section className="dashboard-glass-card space-y-3">
        <p>
          وضعیت: <span dir="ltr">{state}</span> —{" "}
          {health?.talk?.errorCode ?? "بدون خطای ثبت‌شده"}
        </p>
        <p>
          این کانال فقط برای مسئولان فنی است. غیرفعال‌بودن آن گزارش، حذف پیام
          PDF و تقویم را متوقف نمی‌کند.
        </p>
        <p>
          آخرین بررسی:{" "}
          {health?.talk?.checkedAt
            ? formatPersianDateTime(new Date(health.talk.checkedAt))
            : "—"}
        </p>
        <p>
          آخرین هشدار موفق:{" "}
          {lastSuccessful?.sentAt
            ? formatPersianDateTime(lastSuccessful.sentAt)
            : "—"}{" "}
          — رسید {lastSuccessful?.remoteMessageId ?? "—"}
        </p>
        <form action={updateAutomationConfigAction} className="grid gap-4">
          <input type="hidden" name="scope" value="talk" />
          <label>
            <input
              type="checkbox"
              name="talkEnabled"
              defaultChecked={c.talkEnabled}
            />{" "}
            فعال‌کردن ارسال اعلان‌های جدید به گروه فنی
          </label>
          <label>
            نشانی HTTPS سرویس Nextcloud
            <input
              name="nextcloudBaseUrl"
              dir="ltr"
              defaultValue={c.nextcloudBaseUrl}
              maxLength={500}
              className="dashboard-muted-panel mt-2 w-full"
            />
          </label>
          <label>
            Conversation Token گروه خصوصی StoreX Automation Alerts
            <input
              name="technicalConversation"
              dir="ltr"
              defaultValue={c.technicalConversation}
              maxLength={100}
              className="dashboard-muted-panel mt-2 w-full"
            />
          </label>
          <label>
            مسیر بایگانی اختیاری تقویم
            <input
              name="calendarDirectory"
              dir="ltr"
              defaultValue={c.calendarDirectory}
              maxLength={200}
              className="dashboard-muted-panel mt-2 w-full"
            />
          </label>
          <label>
            مسیر تاریخی فایل‌های Nextcloud؛ گزارش‌های جدید از آن استفاده
            نمی‌کنند
            <input
              name="reportsDirectory"
              dir="ltr"
              defaultValue={c.reportsDirectory}
              maxLength={200}
              className="dashboard-muted-panel mt-2 w-full"
            />
          </label>
          <p>
            Service Account و App Password فقط در ENV هستند. با فعال‌سازی،
            هشدارهای قبل از زمان فعال‌سازی فقط در پنل می‌مانند؛ حداکثر سه هشدار
            جدید در هر tick ارسال می‌شود.
          </p>
          <button className="dashboard-primary-button">
            ذخیرهٔ تنظیمات کانال فنی
          </button>
        </form>
        <form action={queueAutomationJobAction}>
          <input type="hidden" name="jobType" value="TALK_HEALTH" />
          <button className="dashboard-action-button">
            بررسی اتصال و مجوز بدون ارسال
          </button>
        </form>
        <form action={queueAutomationJobAction} className="space-y-2">
          <input type="hidden" name="jobType" value="TALK_TEST" />
          <label>
            <input type="checkbox" name="confirmSend" required /> گروه مقصد را
            بررسی کرده‌ام و ارسال یک پیام آزمون مجاز است
          </label>
          <button className="dashboard-action-button">
            ثبت پیام آزمون برای worker
          </button>
        </form>
      </section>
      <section className="dashboard-glass-card">
        <h2 className="text-lg font-bold">صف و تاریخچهٔ هشدارهای داخلی</h2>
        {alerts.map((a) => (
          <article key={a.id} className="border-t py-3">
            <p>{a.message}</p>
            <p>
              {STATUS_LABELS[a.status]} — {a.errorCode ?? "—"} — تلاش{" "}
              {a.attempt} — رسید {a.remoteMessageId ?? "—"}
            </p>
            <p>
              ارسال موفق: {a.sentAt ? formatPersianDateTime(a.sentAt) : "—"}؛
              تلاش بعد:{" "}
              {a.nextRetryAt ? formatPersianDateTime(a.nextRetryAt) : "—"}
            </p>
            {a.status === "MANUAL_ACTION_REQUIRED" ? (
              <AlertReview id={a.id} />
            ) : null}
          </article>
        ))}
      </section>
    </AutomationShell>
  );
}
