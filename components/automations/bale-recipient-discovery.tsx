"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  discoverBaleRecipientAction,
  confirmBaleRecipientAction,
} from "@/actions/bale-recipient-discovery";

type Candidate = { chatId: string; updateId: number; messageDate: number };
const ERROR_MESSAGES: Record<string, string> = {
  BALE_NOT_CONFIGURED: "توکن بات بله در ENV تنظیم نشده است.",
  BALE_BOT_IDENTITY_MISMATCH: "توکن مربوط به بات تأییدشده StoreX نیست.",
  BALE_WEBHOOK_ACTIVE: "بات Webhook فعال دارد؛ دریافت مستقیم getUpdates در این حالت ممکن نیست. Webhook خودکار حذف نمی‌شود.",
  BALE_WEBHOOK_INFO_INVALID: "پاسخ بررسی Webhook معتبر نیست.",
  BALE_NO_PRIVATE_SENDER: "در پیام‌های دریافت‌نشده، پیام خصوصی معتبری دیده نشد. در چت بات /start بفرستید و دوباره تلاش کنید.",
  BALE_LAST_PRIVATE_MESSAGE_STALE: "آخرین پیام خصوصی موجود قدیمی‌تر از ۱۰ دقیقه است. پیام تازه بفرستید و دوباره بررسی کنید.",
  BALE_UPDATES_BACKLOG_FULL: "صف ۱۰۰ پیام یا بیشتر دارد و آخرین فرستنده قابل اثبات نیست. با مصرف‌کننده رسمی بات هماهنگ کنید.",
  BALE_UPDATES_INVALID: "ساختار پاسخ به‌روزرسانی‌های بله معتبر نیست.",
  BALE_PAUSE_REPORTER_FIRST: "ابتدا گزارش خودکار را خاموش و تنظیمات را ذخیره کنید.",
  BALE_UNRESOLVED_REPORTS: "گزارش ارسال‌نشده یا مبهم در صف وجود دارد؛ قبل از تغییر گیرنده آن را بررسی کنید.",
  BALE_RECIPIENT_CONFIRM_REQUIRED: "تأیید صریح مدیر لازم است.",
  BALE_RECIPIENT_CHANGED_RECHECK: "آخرین فرستنده تغییر کرده است؛ دوباره شناسایی کنید.",
  BALE_RECIPIENT_CONCURRENT_CHANGE: "مدیر دیگری تنظیمات گیرنده را تغییر داده است؛ صفحه را تازه کنید.",
  BALE_WORKER_BUSY: "Worker در حال کار است؛ پس از پایان اجرا دوباره امتحان کنید.",
  BALE_DISCOVERY_FAILED: "بررسی بله ناموفق شد. اتصال و لاگ‌های سرور را بررسی کنید.",
  BALE_REJECTED: "API بله درخواست را رد کرد. وضعیت بات و Webhook را بررسی کنید.",
  BALE_RATE_LIMITED: "محدودیت درخواست API بله؛ کمی بعد تلاش کنید.",
};

export function BaleRecipientDiscovery({
  currentRecipient,
  reporterEnabled,
}: {
  currentRecipient: string;
  reporterEnabled: boolean;
}) {
  const router = useRouter();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [approved, setApproved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function discover() {
    setCandidate(null);
    setApproved(false);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await discoverBaleRecipientAction();
        if (!result.ok) {
          setMessage(ERROR_MESSAGES[result.code] ?? `خطای بله: ${result.code}`);
          return;
        }
        setCandidate({
          chatId: result.chatId,
          updateId: result.updateId,
          messageDate: result.messageDate,
        });
      } catch {
        setMessage("خطا در ارتباط با سرور؛ دوباره تلاش کنید.");
      }
    });
  }

  function confirm() {
    if (!candidate || !approved || reporterEnabled) return;
    const selected = candidate;
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await confirmBaleRecipientAction(
          selected.chatId,
          selected.updateId,
          approved,
        );
        if (!result.ok) {
          setMessage(ERROR_MESSAGES[result.code] ?? `خطا: ${result.code}`);
          return;
        }
        setCandidate(null);
        setApproved(false);
        setMessage("گیرنده جدید ثبت و در Audit Log ثبت شد. گزارش خودکار همچنان خاموش است.");
        router.refresh();
      } catch {
        setMessage("خطا در ذخیره گیرنده؛ دوباره بررسی کنید.");
      }
    });
  }

  return (
    <section className="dashboard-glass-card space-y-3">
      <h2 className="text-lg font-bold">شناسایی گیرنده از پیام‌های بات بله</h2>
      <p className="text-sm">
        گیرنده فعلی: <code dir="ltr">{currentRecipient || "تنظیم نشده"}</code>.
        برای یافتن یک گیرنده، او باید در گفت‌وگوی خصوصی بات StoreX پیامی مانند
        <code dir="ltr"> /start </code> بفرستد. سپس «شناسایی آخرین فرستنده» را بزنید.
        فقط پیام‌های ۱۰ دقیقه اخیرِ در صف بررسی می‌شوند؛ متن پیام خوانده یا ذخیره نمی‌شود.
      </p>
      <p className="text-sm">
        این ابزار به‌جای اجرای کد پایتون دلخواه در سرور، درخواست محدود و امن
        getUpdates را اجرا می‌کند. خواندن پیام‌ها بدون تغییر offset است و
        Webhook فعال را غیرفعال نمی‌کند.
      </p>
      <button type="button" className="dashboard-action-button" onClick={discover} disabled={isPending}>
        {isPending ? "در حال بررسی…" : "شناسایی آخرین فرستنده خصوصی"}
      </button>
      {candidate ? (
        <div className="dashboard-muted-panel space-y-3 p-3">
          <p>آخرین شناسه خصوصی قابل مشاهده: <strong dir="ltr">{candidate.chatId}</strong></p>
          <p className="text-sm">
            زمان پیام (تهران): {new Intl.DateTimeFormat("fa-IR", {
              timeZone: "Asia/Tehran", dateStyle: "medium", timeStyle: "short",
            }).format(candidate.messageDate * 1000)}
          </p>
          <p className="text-sm">
            این فرد صرفاً آخرین پیام‌دهنده است و خودبه‌خود مجاز به دریافت گزارش‌های شرکت نیست.
            هویت و رضایت او را خارج از این پنل تأیید کنید.
          </p>
          {reporterEnabled ? (
            <p role="alert">برای تغییر گیرنده، ابتدا گزارش خودکار را خاموش و فرم بالا را ذخیره کنید.</p>
          ) : (
            <>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
                <span>هویت و مجوز این گیرنده را بررسی کرده‌ام و تغییر مقصد PDFهای آتی را تأیید می‌کنم.</span>
              </label>
              <button type="button" className="dashboard-primary-button" onClick={confirm} disabled={!approved || isPending}>
                تأیید و ثبت به‌عنوان گیرنده گزارش
              </button>
            </>
          )}
        </div>
      ) : null}
      {message ? <p role="status" className="text-sm">{message}</p> : null}
    </section>
  );
}
