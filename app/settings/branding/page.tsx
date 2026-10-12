import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  BrandingError,
  readBrandingAsset,
  getCurrentLogo,
} from "@/lib/branding/logo";
import { previewLogoAction, applyLogoAction } from "@/actions/branding";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { formatPersianDateTime } from "@/lib/date/tehran-time";
export const dynamic = "force-dynamic";
const errors: Record<string, string> = {
  ADMIN_REQUIRED: "فقط مدیر مجاز به تغییر لوگو است.",
  IMAGE_SIZE_LIMIT:
    "یک تصویر PNG، JPEG یا WebP با حجم حداکثر ۲ مگابایت انتخاب کنید.",
  INVALID_IMAGE_FORMAT:
    "فرمت واقعی فایل معتبر نیست؛ SVG و فایل اجرایی پذیرفته نمی‌شود.",
  IMAGE_DIMENSIONS_INVALID:
    "تصویر باید تک‌فریم، با ابعاد ۱۶ تا ۶۰۰۰ پیکسل و حداکثر ۱۶ میلیون پیکسل باشد.",
  IMAGE_DECODE_FAILED: "فایل تصویر آسیب دیده یا قابل خواندن نیست.",
  BRANDING_STORAGE_NOT_CONFIGURED:
    "محل ذخیره‌سازی پایدار لوگو باید توسط مسئول سرور تنظیم شود.",
  BRANDING_STORAGE_UNAVAILABLE:
    "ذخیره‌سازی لوگو در دسترس نیست؛ وضعیت قبلی تغییر نکرده است.",
  ASSET_CHECKSUM_MISMATCH:
    "فایل ذخیره‌شده با نسخهٔ ثبت‌شده مطابقت ندارد؛ بازیابی نسخهٔ سالم لازم است.",
  ASSET_NOT_FOUND: "نسخهٔ پیش‌نمایش یافت نشد؛ تصویر را دوباره بررسی کنید.",
  STALE_BRANDING_PREVIEW:
    "مدیر دیگری لوگو را تغییر داده است؛ پیش‌نمایش تازه را بررسی و دوباره تأیید کنید.",
  PREVIOUS_LOGO_UNAVAILABLE: "هنوز نسخهٔ قبلی ثبت نشده است.",
  CONFIRMATION_REQUIRED: "تأیید اعمال تغییر لازم است.",
  INVALID_ASSET_REFERENCE: "شناسهٔ تصویر معتبر نیست.",
  INVALID_REVISION: "نسخهٔ پیش‌نمایش معتبر نیست.",
  UPLOAD_RATE_LIMIT:
    "تعداد بررسی تصاویر زیاد است؛ یک دقیقه بعد دوباره تلاش کنید.",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    preview?: string;
    revision?: string;
    error?: string;
    saved?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const [config, history, logo] = await Promise.all([
    prisma.brandingConfig.findUnique({ where: { id: "singleton" } }),
    prisma.brandingAudit.findMany({
      where: { action: { not: "UPLOAD_ATTEMPT" } },
      orderBy: { occurredAt: "desc" },
      take: 20,
    }),
    getCurrentLogo(prisma),
  ]);
  const revision = config?.revision ?? 0;
  let preview: null | { hash: string; width: number; height: number } = null;
  let storageError = "";
  if (config?.activeHash)
    try {
      await readBrandingAsset(prisma, config.activeHash);
    } catch (e) {
      storageError =
        e instanceof BrandingError ? e.message : "BRANDING_STORAGE_UNAVAILABLE";
    }
  if (typeof params.preview === "string")
    try {
      preview = await readBrandingAsset(prisma, params.preview);
    } catch (e) {
      storageError = e instanceof BrandingError ? e.message : "ASSET_NOT_FOUND";
    }
  return (
    <main
      dir="rtl"
      className="dashboard-aurora-shell min-h-screen p-6 text-foreground"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="dashboard-glass-card">
          <h1 className="text-2xl font-bold">مدیریت لوگوی شرکت</h1>
          <Link href="/" className="dashboard-action-button mt-4 inline-block">
            داشبورد
          </Link>
        </header>
        {(params.error || storageError) && (
          <p role="alert" className="dashboard-glass-card">
            {errors[params.error ?? storageError] ??
              "تغییر لوگو انجام نشد؛ دوباره تلاش کنید."}
          </p>
        )}
        {params.saved && (
          <p role="status" className="dashboard-glass-card">
            لوگوی شرکت در همهٔ بخش‌ها اعمال شد.
          </p>
        )}
        <section className="dashboard-glass-card">
          <h2 className="text-lg font-bold">نسخهٔ جاری</h2>
          <p>
            نسخه: {revision} —{" "}
            {config?.activeHash ? "لوگوی سفارشی" : "نسخهٔ اولیه"}
          </p>
          {logo ? (
            <img
              src={`/api/branding/logo?v=${revision}`}
              alt="لوگوی جاری"
              className="my-4 h-24 max-w-64 object-contain"
            />
          ) : (
            <p className="my-4">
              در نسخهٔ اولیه تصویر لوگو ثبت نشده است؛ عنوان‌های فعلی شرکت نمایش
              داده می‌شوند.
            </p>
          )}
          <form
            action={previewLogoAction}
            className="flex flex-col items-start gap-4"
          >
            <label htmlFor="logo">
              تصویر جدید (PNG، JPEG یا WebP؛ حداکثر ۲ مگابایت)
            </label>
            <input
              id="logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              required
            />
            <PendingSubmitButton
              className="dashboard-action-button"
              pendingText="در حال بررسی..."
            >
              بررسی و پیش‌نمایش
            </PendingSubmitButton>
          </form>
        </section>
        {preview && (
          <section className="dashboard-glass-card">
            <h2 className="text-lg font-bold">پیش‌نمایش تغییر</h2>
            <img
              src={`/settings/branding/preview/${preview.hash}`}
              alt="پیش‌نمایش لوگوی جدید"
              className="my-4 h-32 max-w-full object-contain"
            />
            <p>
              {preview.width} × {preview.height} پیکسل؛ تا تأیید، لوگوی جاری
              تغییر نمی‌کند.
            </p>
            <form action={applyLogoAction} className="mt-4">
              <input
                type="hidden"
                name="revision"
                value={params.revision ?? ""}
              />
              <input type="hidden" name="target" value={preview.hash} />
              <input type="hidden" name="confirm" value="yes" />
              <PendingSubmitButton
                className="dashboard-action-button"
                pendingText="در حال اعمال..."
              >
                تأیید و اعمال سراسری
              </PendingSubmitButton>
            </form>
          </section>
        )}
        <section className="dashboard-glass-card">
          <h2 className="text-lg font-bold">بازگردانی</h2>
          <div className="mt-4 flex flex-wrap gap-4">
            {[
              ["PREVIOUS", "بازگردانی نسخهٔ قبلی"],
              ["DEFAULT", "بازگردانی نسخهٔ اولیه"],
            ].map(([target, label]) => (
              <form key={target} action={applyLogoAction}>
                <input type="hidden" name="revision" value={revision} />
                <input type="hidden" name="target" value={target} />
                <input type="hidden" name="confirm" value="yes" />
                <PendingSubmitButton
                  className="dashboard-action-button"
                  disabled={target === "PREVIOUS" && revision === 0}
                  pendingText="در حال بازگردانی..."
                >
                  {label}
                </PendingSubmitButton>
              </form>
            ))}
          </div>
          <p className="mt-4">
            تغییر فقط در خروجی‌های تازه اعمال می‌شود؛ فایل‌های گزارش قبلی حفظ
            می‌شوند.
          </p>
        </section>
        <section className="dashboard-glass-card">
          <h2 className="text-lg font-bold">تاریخچهٔ تغییرات</h2>
          <ul className="mt-4 space-y-2">
            {history.map((item) => (
              <li key={item.id}>
                {formatPersianDateTime(item.occurredAt)} — {item.actorName} —{" "}
                {item.action === "APPLY_LOGO"
                  ? "اعمال لوگو"
                  : item.action === "RESTORE_PREVIOUS"
                    ? "بازگردانی قبلی"
                    : "بازگردانی اولیه"}{" "}
                — نسخهٔ {item.revision}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
