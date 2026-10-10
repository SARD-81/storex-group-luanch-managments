import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { credentialStatus, getAutomationConfig } from "@/lib/automation/config";
import { formatPersianDateTime } from "@/lib/date/tehran-time";
import {
  AutomationNotice,
  AutomationShell,
  STATUS_LABELS,
} from "@/components/automations/admin-shell";
import { JobHistory } from "@/components/automations/job-history";
import { queueAutomationJobAction } from "@/actions/automations";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const [config, jobs, alerts, lastReconcile] = await Promise.all([
    getAutomationConfig(prisma),
    prisma.automationJobRun.findMany({
      where: { jobType: { notIn: ["SHARE_CLEANUP", "ATTENDANCE_RECONCILE"] } },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    prisma.automationAlert.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.automationJobRun.findFirst({
      where: { jobType: "ATTENDANCE_RECONCILE" },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const health = config.health as {
    workerLastTick?: string;
    credentialsConfigured?: ReturnType<typeof credentialStatus>;
  } | null;
  const env = health?.credentialsConfigured ?? credentialStatus();
  return (
    <AutomationShell title="مدیریت اتوماسیون">
      <AutomationNotice {...params} />
      <section className="dashboard-glass-card">
        <div className="grid gap-4 md:grid-cols-2">
          <p>
            گزارش: {config.reporterEnabled ? "فعال" : "مکث"}
            <br />
            تقویم: {config.calendarEnabled ? "فعال" : "مکث"}
          </p>
          <p>
            اشتراک عمومی:{" "}
            {STATUS_LABELS[config.publicSharingState] ??
              config.publicSharingState}
            <br />
            آخرین بررسی:{" "}
            {config.capabilityCheckedAt
              ? formatPersianDateTime(config.capabilityCheckedAt)
              : "—"}
          </p>
          <p>
            اطلاعات محرمانهٔ Nextcloud:{" "}
            {env.nextcloud ? "در سرور تنظیم شده" : "تنظیم نشده"}
            <br />
            توکن بله: {env.bale ? "در سرور تنظیم شده" : "تنظیم نشده"}
          </p>
          <p>
            آخرین فعالیت worker:{" "}
            {health?.workerLastTick
              ? formatPersianDateTime(new Date(health.workerLastTick))
              : "هنوز اجرا نشده"}
            <br />
            همسان‌سازی حضور:{" "}
            {lastReconcile ? STATUS_LABELS[lastReconcile.status] : "—"}
          </p>
        </div>
        <p className="mt-4">
          اجرای کارها مستقل از باز بودن سایت است. مکث گزارش، کنترل‌های دستی
          Reporter و لغو لینک‌های منقضی را متوقف نمی‌کند.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {[
            ["NEXTCLOUD_HEALTH", "آزمون Nextcloud و لینک عمومی"],
            ["BALE_HEALTH", "آزمون بله"],
            ["TALK_TEST", "ارسال پیام آزمون به گروه فنی"],
            ["ATTENDANCE_RECONCILE", "همسان‌سازی حضور اکنون"],
          ].map(([type, label]) => (
            <form key={type} action={queueAutomationJobAction}>
              <input type="hidden" name="jobType" value={type} />
              <button className="dashboard-action-button">{label}</button>
            </form>
          ))}
        </div>
        <Link
          className="mt-4 block underline"
          href="/settings/automations/reporter"
        >
          تنظیمات و کنترل‌های گزارش
        </Link>
      </section>
      <JobHistory jobs={jobs} />
      <section className="dashboard-glass-card">
        <h2 className="mb-3 text-lg font-bold">اعلان‌های فنی Nextcloud Talk</h2>
        {alerts.map((a) => (
          <div key={a.id} className="border-t border-border py-3">
            <p>{a.message}</p>
            <small>
              {STATUS_LABELS[a.status]} — {formatPersianDateTime(a.createdAt)}
              {a.remoteMessageId ? ` — پیام ${a.remoteMessageId}` : ""}
            </small>
          </div>
        ))}
      </section>
    </AutomationShell>
  );
}
