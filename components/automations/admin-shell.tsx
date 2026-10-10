import { CompanyLogo } from "@/components/branding/company-logo";
import Link from "next/link";
import type { ReactNode } from "react";
export async function AutomationShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main
      dir="rtl"
      className="dashboard-aurora-shell min-h-screen p-4 text-foreground md:p-8"
    >
      <div className="relative mx-auto flex max-w-7xl flex-col gap-6">
        <header className="dashboard-glass-card">
          <CompanyLogo />
          <h1 className="text-2xl font-bold">{title}</h1>
          <nav className="mt-4 flex flex-wrap gap-3">
            <Link href="/" className="dashboard-action-button">
              داشبورد
            </Link>
            <Link
              href="/settings/automations"
              className="dashboard-action-button"
            >
              نمای کلی اتوماسیون
            </Link>
            <Link
              href="/settings/automations/reporter"
              className="dashboard-action-button"
            >
              اتوماسیون گزارش
            </Link>
            <Link
              href="/settings/automations/calendar"
              className="dashboard-action-button"
            >
              اتوماسیون تقویم
            </Link>
            <Link
              href="/settings/attendance"
              className="dashboard-action-button"
            >
              حضور روزانه
            </Link>
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
export const STATUS_LABELS: Record<string, string> = {
  PENDING: "در صف",
  RUNNING: "در حال اجرا",
  SUCCESS: "موفق",
  FAILED: "ناموفق؛ نیاز به اقدام",
  RETRYING: "در انتظار تلاش مجدد",
  BLOCKED: "متوقف به دلیل محدودیت",
  MANUAL_ACTION_REQUIRED: "نیاز به بررسی دستی",
  SKIPPED: "اجرا نشد",
  UNKNOWN: "بررسی نشده",
  AVAILABLE: "لینک عمومی تأیید شده",
  DISABLED: "اشتراک عمومی غیرفعال",
  STAGED: "پیش‌نمایش",
  REVIEW_REQUIRED: "نیاز به تأیید مدیر",
  VERIFIED: "تأیید و وارد شده",
};
export const JOB_LABELS: Record<string, string> = {
  REPORT_DELIVERY: "تحویل گزارش",
  REPORT_REMINDER_1: "یادآوری اول",
  REPORT_REMINDER_2: "یادآوری دوم",
  CALENDAR_IMPORT: "دریافت تقویم",
  CALENDAR_DRY_RUN: "پیش‌آزمون تقویم",
  NEXTCLOUD_HEALTH: "آزمون Nextcloud",
  BALE_HEALTH: "آزمون بله",
  TALK_TEST: "آزمون گروه فنی",
  PUBLIC_CAPABILITY: "بررسی لینک عمومی",
  SHARE_CLEANUP: "لغو لینک‌های منقضی",
  ARTIFACT_SYNC: "همگام‌سازی فایل",
  ATTENDANCE_RECONCILE: "همسان‌سازی حضور",
};
export function AutomationNotice({
  error,
  saved,
}: {
  error?: string;
  saved?: string;
}) {
  const messages: Record<string, string> = {
    "invalid-config":
      "نشانی، مسیر یا ترتیب زمان‌ها معتبر نیست. میزبان باید در فهرست مجاز سرور باشد.",
    "incomplete-config":
      "نشانی Nextcloud، گیرندهٔ گزارش و گروه فنی را کامل کنید.",
    "invalid-job": "درخواست اجرا معتبر نیست.",
    "invalid-year": "سال جلالی معتبر نیست.",
    "missing-calendar": "تقویم روز کاری آینده ندارد.",
    "delivery-review":
      "تحویل قبلی موفق یا نتیجهٔ ارسال نامشخص است؛ ابتدا وضعیت را بررسی کنید.",
    "already-running": "این اجرا در حال انجام است.",
    "invalid-retry": "این اجرا قابل تکرار نیست.",
    "invalid-resolution":
      "نتیجهٔ بررسی، توضیح کافی و در حالت ارسال‌شده شناسهٔ پیام لازم است.",
    "csv-too-large": "حجم ورودی باید حداکثر یک مگابایت باشد.",
    "invalid-holidays":
      "ورودی شامل تاریخ/عنوان نامعتبر، عنوان تکراری متفاوت یا مجموعهٔ خالی است. ورودی را اصلاح و دوباره پیش‌نمایش بگیرید.",
    "confirmation-required": "تأیید اختلاف‌های نمایش داده‌شده لازم است.",
    "apply-rejected":
      "اعمال رد شد: پیش‌نمایش قدیمی، parser تأییدنشده یا تأیید جایگزینی منبع اضطراری. هیچ تغییر ناقصی اعمال نشد.",
  };
  return (
    <>
      {error ? (
        <p
          role="alert"
          className="dashboard-muted-panel border border-rose-500"
        >
          {messages[error] ?? "درخواست معتبر نیست."}
        </p>
      ) : null}
      {saved ? (
        <p
          role="status"
          className="dashboard-muted-panel border border-emerald-500"
        >
          {saved === "queued"
            ? "درخواست ثبت شد؛ worker مستقل آن را اجرا می‌کند."
            : saved === "applied"
              ? "تقویم با موفقیت اعمال شد."
              : "تغییرات ذخیره شد."}
        </p>
      ) : null}
    </>
  );
}
