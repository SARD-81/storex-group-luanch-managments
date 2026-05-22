"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const messages: Record<string, { error?: Record<string, string>; saved?: Record<string, string> }> = {
  "/login": { error: { missing: "نام کاربری و رمز عبور را وارد کنید.", invalid: "اطلاعات ورود نامعتبر است یا حساب شما فعال نیست." } },
  "/": { error: { deadline: "مهلت ثبت یا تغییر حضور برای این تاریخ گذشته است.", "invalid-date": "تاریخ انتخاب‌شده معتبر نیست." }, saved: { "1": "وضعیت حضور شما ذخیره شد." } },
  "/settings/users": { error: { "duplicate-username": "این نام کاربری قبلاً ثبت شده است.", "last-admin": "غیرفعال کردن آخرین مدیر فعال مجاز نیست.", missing: "لطفاً تمام فیلدهای ضروری را کامل کنید.", "user-not-found": "کاربر مورد نظر یافت نشد.", "invalid-user": "کاربر مورد نظر یافت نشد." }, saved: { created: "کاربر جدید با موفقیت ایجاد شد.", status: "وضعیت کاربر با موفقیت به‌روزرسانی شد.", password: "رمز عبور کاربر با موفقیت بازنشانی شد." } },
  "/settings/weekly-plan": { saved: { "1": "برنامه هفتگی با موفقیت ذخیره شد و اطلاعات از دیتابیس به‌روزرسانی شد." } },
} as const;

export default function ToastQueryMessages() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const shownRef = useRef<string | null>(null);

  useEffect(() => {
    const error = searchParams.get("error");
    const saved = searchParams.get("saved");
    if (!error && !saved) return;
    const key = `${pathname}|${error ?? ""}|${saved ?? ""}`;
    if (shownRef.current === key) return;
    shownRef.current = key;

    const pathMessages = messages[pathname];
    if (error) toast.error(pathMessages?.error?.[error] ?? "عملیات با خطا مواجه شد.");
    if (saved) toast.success(pathMessages?.saved?.[saved] ?? "عملیات با موفقیت انجام شد.");

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("error");
    nextParams.delete("saved");
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return null;
}
