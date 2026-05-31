import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { UserRole } from "@/app/generated/prisma/client";
import {
  createUserAction,
  resetUserPasswordAction,
  updateUserStatusAction,
} from "@/actions/users";
import { ThemeToggle } from "@/components/theme-toggle";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { ROLE_LABELS, USER_ROLE_OPTIONS } from "@/lib/auth/roles";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";


type SearchParams = Promise<{ error?: string; saved?: string }>;

export default async function UsersManagementPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  noStore();

  await searchParams;

  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "asc",
    },
  });

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.isActive).length;
  const activeAdmins = users.filter(
    (user) => user.isActive && user.role === UserRole.ADMIN,
  ).length;
  const activeReporters = users.filter(
    (user) => user.isActive && user.role === UserRole.REPORTER,
  ).length;

  return (
    <main
      dir="rtl"
      className="dashboard-aurora-shell min-h-screen p-6 text-right text-foreground md:p-8"
    >
      <div className="dashboard-aurora dashboard-aurora-one" />
      <div className="dashboard-aurora dashboard-aurora-two" />
      <div className="dashboard-aurora dashboard-aurora-three" />

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6">
        <header className="dashboard-glass-card flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">
                مدیریت کاربران سامانه
              </p>
              <h1 className="mt-1 text-3xl font-bold">تنظیمات کاربران</h1>
            </div>
            <ThemeToggle />
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="dashboard-action-button inline-flex items-center gap-2"
            >
              بازگشت به داشبورد
            </Link>
          </div>
        </header>

        <section className="dashboard-glass-card">
          <h2 className="text-lg font-semibold">نمای کلی کاربران</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <div className="dashboard-muted-panel">
              <p className="text-xs text-muted-foreground">کل کاربران</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {totalUsers}
              </p>
            </div>
            <div className="dashboard-muted-panel">
              <p className="text-xs text-muted-foreground">کاربران فعال</p>
              <p className="mt-1 text-2xl font-bold text-emerald-200">
                {activeUsers}
              </p>
            </div>
            <div className="dashboard-muted-panel">
              <p className="text-xs text-muted-foreground">مدیران فعال</p>
              <p className="mt-1 text-2xl font-bold text-amber-200">
                {activeAdmins}
              </p>
            </div>
            <div className="dashboard-muted-panel">
              <p className="text-xs text-muted-foreground">گزارش‌گیران فعال</p>
              <p className="mt-1 text-2xl font-bold text-violet-200">
                {activeReporters}
              </p>
            </div>
          </div>
        </section>

        <section className="dashboard-glass-card">
          <h2 className="mb-4 text-lg font-semibold">ایجاد کاربر جدید</h2>
          <form action={createUserAction} className="grid gap-3 md:grid-cols-4">
            <input
              name="username"
              placeholder="نام کاربری"
              className="dashboard-muted-panel p-3 text-sm"
              required
            />
            <input
              name="name"
              placeholder="نام"
              className="dashboard-muted-panel p-3 text-sm"
              required
            />
            <input
              name="password"
              type="password"
              placeholder="رمز عبور"
              className="dashboard-muted-panel p-3 text-sm"
              required
            />
            <select
              name="role"
              defaultValue={UserRole.USER}
              className="dashboard-muted-panel p-3 text-sm"
            >
              {USER_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <PendingSubmitButton
              type="submit"
              pendingText="در حال ایجاد..."
              className="dashboard-primary-button md:col-span-4"
            >
              ایجاد کاربر
            </PendingSubmitButton>
          </form>
        </section>

        <section className="dashboard-glass-card">
          <h2 className="mb-4 text-lg font-semibold">لیست کاربران</h2>
          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-right text-sm">
              <thead>
                <tr className="bg-muted/60 text-foreground">
                  <th className="sticky right-0 z-30 min-w-[220px] border-b border-border/60 bg-muted/50 p-3 text-right">
                    کاربر
                  </th>
                  <th className="border-b border-border/60 p-3">نام</th>
                  <th className="border-b border-border/60 p-3">نقش</th>
                  <th className="border-b border-border/60 p-3">وضعیت</th>
                  <th className="border-b border-border/60 p-3">تغییر وضعیت</th>
                  <th className="border-b border-border/60 p-3">
                    بازنشانی رمز عبور
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="odd:bg-muted/30 align-top">
                    <td className="sticky right-0 z-20 border-b border-border/60 bg-card/80 p-3 backdrop-blur-xl">
                      <p className="font-semibold text-foreground">
                        @{user.username}
                      </p>
                    </td>
                    <td className="border-b border-border/60 p-3">
                      {user.name}
                    </td>
                    <td className="border-b border-border/60 p-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${user.role === UserRole.ADMIN ? "bg-amber-400/20 text-amber-700 dark:text-amber-200" : user.role === UserRole.REPORTER ? "bg-violet-400/20 text-violet-700 dark:text-violet-200" : "bg-sky-400/20 text-sky-700 dark:text-sky-200"}`}
                      >
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="border-b border-border/60 p-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${user.isActive ? "bg-emerald-400/20 text-emerald-700 dark:text-emerald-200" : "bg-muted/70 text-foreground"}`}
                      >
                        {user.isActive ? "فعال" : "غیرفعال"}
                      </span>
                    </td>
                    <td className="border-b border-border/60 p-3">
                      <form action={updateUserStatusAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input
                          type="hidden"
                          name="isActive"
                          value={user.isActive ? "false" : "true"}
                        />
                        <PendingSubmitButton
                          pendingText="در حال تغییر..."
                          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${user.isActive ? "bg-rose-500/20 text-rose-700 dark:text-rose-200 hover:bg-rose-500/30" : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-500/30"}`}
                        >
                          {user.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                        </PendingSubmitButton>
                      </form>
                    </td>
                    <td className="border-b border-border/60 p-3">
                      <form
                        action={resetUserPasswordAction}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="userId" value={user.id} />
                        <input
                          name="password"
                          type="password"
                          required
                          placeholder="رمز جدید"
                          className="dashboard-muted-panel min-w-[170px] px-3 py-2 text-xs"
                        />
                        <PendingSubmitButton
                          pendingText="در حال ثبت..."
                          className="dashboard-primary-button rounded-xl px-3 py-2 text-xs"
                        >
                          ثبت
                        </PendingSubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
