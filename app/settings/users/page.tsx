import Link from "next/link";
import { UserRole } from "@/app/generated/prisma/client";
import {
  createUserAction,
  resetUserPasswordAction,
  updateUserStatusAction,
} from "@/actions/users";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const roleLabels = {
  [UserRole.ADMIN]: "مدیر",
  [UserRole.USER]: "کاربر",
};

type SearchParams = Promise<{ error?: string }>;

function renderError(error?: string) {
  if (error === "duplicate-username") {
    return "این نام کاربری قبلاً ثبت شده است.";
  }

  if (error === "last-admin") {
    return "غیرفعال کردن آخرین مدیر فعال مجاز نیست.";
  }

  if (error === "missing") {
    return "لطفاً تمام فیلدهای ضروری را کامل کنید.";
  }

  if (error === "user-not-found" || error === "invalid-user") {
    return "کاربر مورد نظر یافت نشد.";
  }

  return null;
}

export default async function UsersManagementPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;

  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "asc",
    },
  });

  const errorMessage = renderError(params.error);

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-950 p-8 text-right text-zinc-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">مدیریت کاربران</h1>
            <ThemeToggle />
          </div>
          <p className="mt-2 text-sm text-zinc-400">ایجاد کاربر جدید، مدیریت وضعیت فعال بودن و بازنشانی رمز عبور.</p>
          <Link href="/" className="mt-4 inline-block rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-100 transition hover:bg-zinc-800">
            بازگشت به داشبورد
          </Link>
          {errorMessage ? <p className="mt-4 text-sm text-red-400">{errorMessage}</p> : null}
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-semibold">ایجاد کاربر جدید</h2>
          <form action={createUserAction} className="grid gap-3 md:grid-cols-4">
            <input name="username" placeholder="نام کاربری" className="rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm" required />
            <input name="name" placeholder="نام" className="rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm" required />
            <input name="password" type="password" placeholder="رمز عبور" className="rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm" required />
            <select name="role" defaultValue={UserRole.USER} className="rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm">
              <option value={UserRole.USER}>کاربر</option>
              <option value={UserRole.ADMIN}>مدیر</option>
            </select>
            <button type="submit" className="rounded-xl bg-zinc-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 md:col-span-4">ایجاد کاربر</button>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-semibold">لیست کاربران</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-right text-sm">
              <thead className="border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="p-3">نام کاربری</th>
                  <th className="p-3">نام</th>
                  <th className="p-3">نقش</th>
                  <th className="p-3">وضعیت</th>
                  <th className="p-3">تغییر وضعیت</th>
                  <th className="p-3">بازنشانی رمز عبور</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-zinc-800 align-top">
                    <td className="p-3">{user.username}</td>
                    <td className="p-3">{user.name}</td>
                    <td className="p-3">{roleLabels[user.role]}</td>
                    <td className="p-3">{user.isActive ? "فعال" : "غیرفعال"}</td>
                    <td className="p-3">
                      <form action={updateUserStatusAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="isActive" value={user.isActive ? "false" : "true"} />
                        <button type="submit" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs transition hover:bg-zinc-800">
                          {user.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                        </button>
                      </form>
                    </td>
                    <td className="p-3">
                      <form action={resetUserPasswordAction} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <input name="password" type="password" required placeholder="رمز جدید" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs" />
                        <button type="submit" className="rounded-lg bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-950">ثبت</button>
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
