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
              href="/settings/automations/talk"
              className="dashboard-action-button"
            >
              اعلان‌های فنی اختیاری
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
  SCHEDULED: "حذف برنامه‌ریزی‌شده",
  UNCERTAIN: "حذف تأیید نشده؛ نتیجه نامشخص",
  DELETED: "حذف با رسید API تأیید شده",
  WINDOW_EXPIRED: "فرصت ۴۸ساعته گذشته؛ اقدام انسانی لازم است",
  NOT_APPLICABLE: "روش قدیمی؛ حذف پیام ندارد",
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
  TALK_HEALTH: "بررسی دسترسی گروه فنی",
  BALE_MESSAGE_DELETE: "حذف PDF از بله",
  PUBLIC_CAPABILITY: "بررسی لینک عمومی",
  SHARE_CLEANUP: "لغو لینک‌های منقضی",
  ARTIFACT_SYNC: "همگام‌سازی فایل",
  ATTENDANCE_RECONCILE: "همسان‌سازی حضور",
};
export const ERROR_LABELS: Record<string, string> = {
  BALE_PDF_TOO_LARGE: "PDF بیش از حد مجاز ۵۰ مگابایت است؛ گزارش را بررسی کنید.",
  BALE_INVALID_PDF: "فرمت یا پایان فایل PDF معتبر نیست؛ فایل ارسال نشد.",
  ARTIFACT_CHECKSUM_MISMATCH:
    "محتوای فایل با SHA-256 ثبت‌شده همسان نیست؛ ذخیره‌سازی را بررسی کنید.",
  BALE_RECIPIENT_NOT_PRIVATE:
    "مقصد بله چت خصوصی تأییدشده نیست؛ شناسهٔ گیرنده را بررسی کنید.",
  BALE_AUTH_FAILED: "توکن بات بله معتبر نیست؛ مسئول سرور باید آن را بررسی کند.",
  BALE_RATE_LIMITED: "محدودیت نرخ API؛ تلاش بعدی زمان‌بندی شده است.",
  BALE_MESSAGE_NOT_FOUND:
    "پیام پیدا نشد؛ حذف موفق فرض نشده و بررسی انسانی لازم است.",
  BALE_FORBIDDEN: "بله اجازهٔ عملیات را نداد؛ مقصد، بات و مجوز را بررسی کنید.",
  BALE_DELETE_WINDOW_EXPIRED:
    "بازهٔ کمتر از ۴۸ ساعت گذشته است؛ اقدام انسانی لازم است.",
  BALE_RECEIPT_PERSIST_FAILED:
    "رسید ارسال در دیتابیس ثبت نشد؛ چت را بررسی کنید و ارسال را تکرار نکنید.",
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
      "شناسهٔ چت خصوصی گیرندهٔ بله را کامل کنید؛ Nextcloud برای گزارش مستقیم لازم نیست.",
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
