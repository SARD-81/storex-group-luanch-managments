import {
  discoverBaleRecipientFormAction,
  confirmBaleRecipientFormAction,
} from "@/actions/bale-recipient-discovery";
import { pendingBaleCandidate } from "@/lib/automation/bale-recipient-discovery";

const ERRORS: Record<string, string> = {
  BALE_NOT_CONFIGURED: "توکن بات بله در ENV تنظیم نشده است.",
  BALE_BOT_IDENTITY_MISMATCH: "توکن مربوط به بات StoreX نیست.",
  BALE_WEBHOOK_ACTIVE: "بات Webhook فعال دارد؛ getUpdates در این حالت قابل استفاده نیست. Webhook به‌طور خودکار تغییر نمی‌کند.",
  BALE_WEBHOOK_INFO_INVALID: "اطلاعات Webhook معتبر نیست.",
  BALE_NO_PRIVATE_SENDER: "در صف دریافت بات پیام خصوصی معتبری نبود. از گیرنده بخواهید اکنون /start بفرستد.",
  BALE_LAST_PRIVATE_MESSAGE_STALE: "آخرین پیام قابل‌دریافت قدیمی‌تر از ۱۰ دقیقه است. یک پیام خصوصی تازه بفرستید.",
  BALE_UPDATES_BACKLOG_FULL: "صف پیام‌ها پر است و تعیین آخرین فرستنده قابل اطمینان نیست.",
  BALE_UPDATES_INVALID: "پاسخ API بله معتبر نیست.",
  BALE_PAUSE_REPORTER_FIRST: "برای تغییر گیرنده ابتدا گزارش خودکار را خاموش و ذخیره کنید.",
  BALE_UNRESOLVED_REPORTS: "ابتدا گزارش‌های در صف یا دارای وضعیت مبهم را بررسی کنید.",
  BALE_RECIPIENT_CONFIRM_REQUIRED: "تأیید صریح مدیر الزامی است.",
  BALE_RECIPIENT_EXPIRED_RECHECK: "پیشنهاد قبلی منقضی شده یا برای مدیر دیگری است؛ دوباره شناسایی کنید.",
  BALE_RECIPIENT_CHANGED_RECHECK: "آخرین فرستنده تغییر کرده است؛ دوباره شناسایی کنید.",
  BALE_RECIPIENT_CONCURRENT_CHANGE: "تنظیمات گیرنده هم‌زمان تغییر کرده؛ صفحه را تازه کنید.",
  BALE_WORKER_BUSY: "Worker در حال فعالیت است. بعداً مجدداً تلاش کنید.",
  BALE_DISCOVERY_FAILED: "ارتباط با API بله یا ذخیره نتیجه ناموفق بود.",
  BALE_REJECTED: "API بله درخواست را رد کرد.",
  BALE_RATE_LIMITED: "بله محدودیت درخواست اعمال کرده است.",
  BALE_REQUEST_FAILED: "دسترسی به API بله برقرار نیست.",
  BALE_FORBIDDEN: "مجوز دسترسی به API بله رد شد.",
  BALE_AUTH_FAILED: "توکن بات توسط بله رد شد.",
  BALE_RECIPIENT_NOT_PRIVATE: "مقصد یک گفت‌وگوی خصوصی معتبر نیست.",
};

export function BaleRecipientDiscovery({
  currentRecipient,
  reporterEnabled,
  health,
  actorId,
  discovery,
  discoveryError,
}: {
  currentRecipient: string;
  reporterEnabled: boolean;
  health: unknown;
  actorId: string;
  discovery?: string;
  discoveryError?: string;
}) {
  const candidate = pendingBaleCandidate(health, actorId);
  return (
    <section className="dashboard-glass-card space-y-3">
      <h2 className="text-lg font-bold">شناسایی گیرنده از پیام‌های بات بله</h2>
      <p className="text-sm">
        شناسه فعلی: <code dir="ltr">{currentRecipient || "تنظیم نشده"}</code>.
        گیرنده موردنظر باید همین الان در گفت‌وگوی خصوصی بات StoreX یک پیام مانند
        <code dir="ltr"> /start </code> بفرستد؛ سپس دکمه شناسایی را انتخاب کنید.
      </p>
      <p className="text-sm">
        این فرم حتی بدون فعال بودن JavaScript مرورگر نیز کار می‌کند. فقط شناسه
        پیام خصوصی موجود در صف خوانده می‌شود؛ متن پیام یا اطلاعات هویتی ذخیره
        نمی‌شود. آخرین پیام‌دهنده الزاماً گیرنده مجاز گزارش نیست.
      </p>
      <form action={discoverBaleRecipientFormAction}>
        <button type="submit" className="dashboard-action-button">
          شناسایی آخرین فرستنده خصوصی
        </button>
      </form>
      {discoveryError ? (
        <p role="alert" className="text-sm text-rose-500">
          {ERRORS[discoveryError] ?? "خطا هنگام بررسی بله. وضعیت سرور را بررسی کنید."}
        </p>
      ) : null}
      {discovery === "confirmed" ? (
        <p role="status" className="text-sm">
          گیرنده جدید با ثبت در Audit Log ذخیره شد. گزارش خودکار همچنان خاموش است.
        </p>
      ) : null}
      {candidate ? (
        <div className="dashboard-muted-panel space-y-3 p-3">
          <p>
            آخرین فرستنده خصوصی قابل مشاهده:
            {" "}<strong dir="ltr">{candidate.chatId}</strong>
          </p>
          <p className="text-sm">
            زمان پیام (تهران): {new Intl.DateTimeFormat("fa-IR", {
              timeZone: "Asia/Tehran", dateStyle: "medium", timeStyle: "short",
            }).format(candidate.messageDate * 1000)}
          </p>
          <p className="text-sm">
            صحت هویت و رضایت این فرد را جداگانه بررسی کنید. تا زمان تأیید،
            مقصد گزارش‌های StoreX تغییری نمی‌کند.
          </p>
          {reporterEnabled ? (
            <p role="alert">گزارش خودکار را متوقف و تنظیمات را ذخیره کنید.</p>
          ) : (
            <form action={confirmBaleRecipientFormAction} className="space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="confirmRecipient" value="yes" required />
                <span>هویت و مجوز گیرنده را تأیید می‌کنم و تغییر مقصد گزارش‌های آینده را می‌پذیرم.</span>
              </label>
              <button type="submit" className="dashboard-primary-button">
                تأیید و ثبت به‌عنوان گیرنده گزارش
              </button>
            </form>
          )}
        </div>
      ) : null}
    </section>
  );
}
