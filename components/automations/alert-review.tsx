import { resolveTechnicalAlertAction } from "@/actions/automations";
export function AlertReview({ id }: { id: string }) {
  return (
    <form action={resolveTechnicalAlertAction} className="mt-3 grid gap-2">
      <input type="hidden" name="alertId" value={id} />
      <p>
        ابتدا گروه و شناسهٔ اجرای هشدار را بررسی کنید؛ نتیجهٔ نامشخص خودکار
        تکرار نمی‌شود.
      </p>
      <label>
        <input name="resolution" type="radio" value="DELIVERED" required /> پیام
        دیده شد و رسید واقعی ثبت می‌شود
      </label>
      <label>
        <input name="resolution" type="radio" value="NOT_SENT" required /> بررسی
        کردم؛ پیام ارسال نشده است
      </label>
      <label>
        شناسهٔ پیام؛ برای تحویل‌شده لازم است
        <input
          name="receipt"
          dir="ltr"
          className="dashboard-muted-panel w-full"
        />
      </label>
      <label>
        دلیل بررسی؛ بدون Secret
        <textarea
          name="note"
          minLength={10}
          maxLength={500}
          required
          className="dashboard-muted-panel w-full"
        />
      </label>
      <label>
        <input name="confirmReview" type="checkbox" required /> مقصد و نتیجه را
        بررسی کرده‌ام
      </label>
      <button className="dashboard-action-button">ثبت بررسی هشدار فنی</button>
    </form>
  );
}
