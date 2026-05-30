import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import {
  deleteMyAvatarAction,
  updateMyAvatarAction,
  updateMyPasswordAction,
  updateMyProfileAction,
} from "@/actions/profile";
import { ThemeToggle } from "@/components/theme-toggle";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { UserAvatar } from "@/components/user/user-avatar";
import { requireUser } from "@/lib/auth/session";

type SearchParams = Promise<{ error?: string; saved?: string }>;

function splitDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  noStore();
  await searchParams;
  const currentUser = await requireUser();
  const fallbackName = splitDisplayName(currentUser.name);
  const firstName = currentUser.firstName ?? fallbackName.firstName;
  const lastName = currentUser.lastName ?? fallbackName.lastName;

  return (
    <main
      dir="rtl"
      className="dashboard-aurora-shell min-h-screen p-6 text-right text-foreground md:p-8"
    >
      <div className="dashboard-aurora dashboard-aurora-one" />
      <div className="dashboard-aurora dashboard-aurora-two" />
      <div className="dashboard-aurora dashboard-aurora-three" />

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-6">
        <header className="dashboard-glass-card flex flex-col gap-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="mb-2 text-sm text-muted-foreground">
                ویرایش اطلاعات شخصی، رمز عبور و تصویر پروفایل
              </p>
              <h1 className="text-3xl font-bold">حساب کاربری من</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ThemeToggle />
              <Link href="/" className="dashboard-action-button">
                بازگشت به داشبورد
              </Link>
            </div>
          </div>

          <div className="dashboard-muted-panel flex flex-col gap-4 sm:flex-row sm:items-center">
            <UserAvatar
              user={{
                id: currentUser.id,
                name: currentUser.name,
                avatarUpdatedAt: currentUser.avatarUpdatedAt,
              }}
              size="lg"
            />
            <div>
              <p className="text-lg font-semibold text-foreground">
                {currentUser.name}
              </p>
              <p className="text-sm text-muted-foreground">
                اطلاعات قابل ویرایش: نام، نام خانوادگی، رمز عبور و تصویر پروفایل
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <form
            action={updateMyProfileAction}
            className="dashboard-glass-card space-y-4"
          >
            <div>
              <h2 className="text-xl font-semibold">اطلاعات شخصی</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                نام نمایشی سامانه از نام و نام خانوادگی ساخته می‌شود.
              </p>
            </div>
            <label className="block space-y-2 text-sm font-medium">
              <span>نام</span>
              <input
                name="firstName"
                defaultValue={firstName}
                minLength={2}
                maxLength={64}
                required
                className="dashboard-muted-panel w-full p-3"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              <span>نام خانوادگی</span>
              <input
                name="lastName"
                defaultValue={lastName}
                minLength={2}
                maxLength={64}
                required
                className="dashboard-muted-panel w-full p-3"
              />
            </label>
            <PendingSubmitButton
              className="dashboard-primary-button"
              pendingText="در حال ذخیره..."
            >
              ذخیره اطلاعات
            </PendingSubmitButton>
          </form>

          <form
            action={updateMyPasswordAction}
            className="dashboard-glass-card space-y-4"
          >
            <div>
              <h2 className="text-xl font-semibold">رمز عبور</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                برای امنیت حساب، تغییر رمز عبور نیازمند رمز فعلی است.
              </p>
            </div>
            <label className="block space-y-2 text-sm font-medium">
              <span>رمز فعلی</span>
              <input
                name="currentPassword"
                type="password"
                required
                className="dashboard-muted-panel w-full p-3"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              <span>رمز جدید</span>
              <input
                name="newPassword"
                type="password"
                minLength={8}
                required
                className="dashboard-muted-panel w-full p-3"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              <span>تکرار رمز جدید</span>
              <input
                name="confirmPassword"
                type="password"
                minLength={8}
                required
                className="dashboard-muted-panel w-full p-3"
              />
            </label>
            <PendingSubmitButton
              className="dashboard-primary-button"
              pendingText="در حال تغییر..."
            >
              تغییر رمز عبور
            </PendingSubmitButton>
          </form>
        </section>

        <section className="dashboard-glass-card space-y-4">
          <div>
            <h2 className="text-xl font-semibold">تصویر پروفایل</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              فرمت‌های مجاز: PNG، JPG، WEBP — حداکثر ۵۱۲ کیلوبایت
            </p>
          </div>
          <form
            action={updateMyAvatarAction}
            className="flex flex-col gap-4 md:flex-row md:items-end"
          >
            <label className="block flex-1 space-y-2 text-sm font-medium">
              <span>انتخاب تصویر</span>
              <input
                name="avatar"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                required
                className="dashboard-muted-panel w-full p-3 file:ml-3 file:rounded-xl file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
              />
            </label>
            <PendingSubmitButton
              className="dashboard-primary-button"
              pendingText="در حال ذخیره..."
            >
              ذخیره تصویر
            </PendingSubmitButton>
          </form>
          {currentUser.avatarUpdatedAt ? (
            <form action={deleteMyAvatarAction}>
              <PendingSubmitButton
                className="dashboard-action-button border-rose-400/40 text-rose-600 dark:text-rose-300"
                pendingText="در حال حذف..."
              >
                حذف تصویر پروفایل
              </PendingSubmitButton>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}
