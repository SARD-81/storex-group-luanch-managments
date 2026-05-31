import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { UserRole } from "@/app/generated/prisma/client";
import { logoutAction } from "@/actions/auth";
import {
  createGuestMealOrderAction,
  deleteGuestMealOrderAction,
} from "@/actions/guest-meal-orders";
import { PrintReportButton } from "@/components/reporter/print-report-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { requireReporterAccess } from "@/lib/auth/session";
import { MEAL_LABELS, MEAL_TYPES } from "@/lib/attendance/meals";
import { getNextDayMealReport } from "@/lib/reporter/next-day-report";

type SearchParams = Promise<{ error?: string; saved?: string }>;

const savedMessages: Record<string, string> = {
  "guest-created": "سفارش مهمان ثبت شد.",
  "guest-deleted": "سفارش مهمان حذف شد.",
};

const errorMessages: Record<string, string> = {
  "non-workday": "برای روز غیرکاری امکان ثبت مهمان وجود ندارد.",
  "invalid-date": "تاریخ فرم با گزارش روز بعد مطابقت ندارد.",
  "invalid-meal": "وعده انتخاب‌شده معتبر نیست.",
  "invalid-guest": "اطلاعات مهمان معتبر نیست.",
  "guest-not-found": "سفارش مهمان پیدا نشد.",
};

export const dynamic = "force-dynamic";

export default async function NextDayReporterPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  noStore();
  const currentUser = await requireReporterAccess();
  const params = await searchParams;
  const report = await getNextDayMealReport();
  const allGuestOrders = report.meals.flatMap((meal) =>
    meal.guestOrders.map((order) => ({ ...order, mealLabel: meal.mealLabel })),
  );

  return (
    <main
      dir="rtl"
      className="dashboard-aurora-shell min-h-screen p-6 text-right text-foreground md:p-8"
    >
      <div className="dashboard-aurora dashboard-aurora-one reporter-no-print" />
      <div className="dashboard-aurora dashboard-aurora-two reporter-no-print" />
      <div className="dashboard-aurora dashboard-aurora-three reporter-no-print" />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6">
        <header className="dashboard-glass-card reporter-no-print flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                آمار پرسنل و مهمان‌ها برای تحویل وعده‌های روز بعد
              </p>
              <h1 className="mt-1 text-3xl font-bold">
                گزارش وعده‌های غذایی روز بعد
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                تاریخ گزارش: {report.reportDateLabel}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ThemeToggle />
              <form action={logoutAction}>
                <PendingSubmitButton
                  className="dashboard-action-button"
                  pendingText="در حال خروج..."
                >
                  خروج از حساب
                </PendingSubmitButton>
              </form>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {currentUser.role === UserRole.ADMIN ? (
              <Link href="/" className="dashboard-action-button">
                بازگشت به داشبورد
              </Link>
            ) : null}
            <PrintReportButton />
            <Link href="/reporter/next-day/export" className="dashboard-primary-button">
              دانلود Excel
            </Link>
          </div>
        </header>

        {params.saved && savedMessages[params.saved] ? (
          <div className="dashboard-muted-panel reporter-no-print border border-emerald-400/40 text-sm text-emerald-200">
            {savedMessages[params.saved]}
          </div>
        ) : null}
        {params.error && errorMessages[params.error] ? (
          <div className="dashboard-muted-panel reporter-no-print border border-rose-400/40 text-sm text-rose-200">
            {errorMessages[params.error]}
          </div>
        ) : null}

        {report.policy.isWorkday !== true ? (
          <section className="dashboard-glass-card reporter-no-print border border-amber-400/40">
            <h2 className="text-lg font-semibold text-amber-200">
              هشدار تقویم
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              تاریخ {report.reportDateLabel} طبق تقویم سامانه روز کاری نیست؛ ثبت
              سفارش مهمان غیرفعال است.
            </p>
          </section>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 reporter-no-print">
          {report.meals.map((meal) => (
            <div key={meal.mealType} className="dashboard-glass-card">
              <h2 className="text-lg font-semibold">{meal.mealLabel}</h2>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
                <div className="dashboard-muted-panel">
                  <p className="text-xs text-muted-foreground">پرسنل</p>
                  <p className="mt-1 text-2xl font-bold">{meal.employeeCount}</p>
                </div>
                <div className="dashboard-muted-panel">
                  <p className="text-xs text-muted-foreground">مهمان</p>
                  <p className="mt-1 text-2xl font-bold">{meal.guestCount}</p>
                </div>
                <div className="dashboard-muted-panel">
                  <p className="text-xs text-muted-foreground">جمع</p>
                  <p className="mt-1 text-2xl font-bold">{meal.totalCount}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {report.policy.isWorkday === true ? (
          <section className="dashboard-glass-card reporter-no-print">
            <h2 className="mb-4 text-lg font-semibold">ثبت سفارش مهمان</h2>
            <form action={createGuestMealOrderAction} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="date" value={report.reportDateKey} />
              <select name="mealType" className="dashboard-muted-panel p-3 text-sm" required>
                {MEAL_TYPES.map((mealType) => (
                  <option key={mealType} value={mealType}>
                    {MEAL_LABELS[mealType]}
                  </option>
                ))}
              </select>
              <input
                name="title"
                placeholder="عنوان سفارش"
                maxLength={120}
                className="dashboard-muted-panel p-3 text-sm"
                required
              />
              <input
                name="guestName"
                placeholder="نام مهمان (اختیاری)"
                maxLength={120}
                className="dashboard-muted-panel p-3 text-sm"
              />
              <input
                name="organization"
                placeholder="سازمان (اختیاری)"
                maxLength={120}
                className="dashboard-muted-panel p-3 text-sm"
              />
              <input
                name="count"
                type="number"
                min={1}
                max={500}
                defaultValue={1}
                className="dashboard-muted-panel p-3 text-sm"
                required
              />
              <textarea
                name="note"
                placeholder="یادداشت (اختیاری)"
                maxLength={500}
                className="dashboard-muted-panel min-h-24 p-3 text-sm md:col-span-2"
              />
              <PendingSubmitButton
                type="submit"
                pendingText="در حال ثبت..."
                className="dashboard-primary-button md:col-span-2"
              >
                ثبت سفارش مهمان
              </PendingSubmitButton>
            </form>
          </section>
        ) : null}

        <section className="dashboard-glass-card reporter-no-print">
          <h2 className="mb-4 text-lg font-semibold">سفارش‌های مهمان ثبت‌شده</h2>
          {allGuestOrders.length > 0 ? (
            <div className="grid gap-3">
              {allGuestOrders.map((order) => (
                <div key={order.id} className="dashboard-muted-panel flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold">{order.mealLabel}: {order.title}</p>
                    <p className="text-muted-foreground">
                      تعداد: {order.count}
                      {order.guestName ? ` | مهمان: ${order.guestName}` : ""}
                      {order.organization ? ` | سازمان: ${order.organization}` : ""}
                    </p>
                    {order.note ? <p className="text-muted-foreground">{order.note}</p> : null}
                  </div>
                  <form action={deleteGuestMealOrderAction}>
                    <input type="hidden" name="guestOrderId" value={order.id} />
                    <PendingSubmitButton
                      pendingText="در حال حذف..."
                      className="rounded-xl bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-500/30 dark:text-rose-200"
                    >
                      حذف
                    </PendingSubmitButton>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">سفارش مهمانی ثبت نشده است.</p>
          )}
        </section>

        <section className="reporter-print-area dashboard-glass-card">
          <h2 className="text-2xl font-bold">فرم تحویل آمار وعده‌های غذایی روز بعد</h2>
          <p className="mt-2 text-sm">تاریخ گزارش: {report.reportDateLabel}</p>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border p-2">وعده</th>
                  <th className="border p-2">پرسنل</th>
                  <th className="border p-2">مهمان</th>
                  <th className="border p-2">جمع</th>
                </tr>
              </thead>
              <tbody>
                {report.meals.map((meal) => (
                  <tr key={meal.mealType}>
                    <td className="border p-2">{meal.mealLabel}</td>
                    <td className="border p-2 text-center">{meal.employeeCount}</td>
                    <td className="border p-2 text-center">{meal.guestCount}</td>
                    <td className="border p-2 text-center">{meal.totalCount}</td>
                  </tr>
                ))}
                <tr>
                  <td className="border p-2 font-semibold">جمع کل</td>
                  <td className="border p-2 text-center font-semibold">{report.totals.employeeMeals}</td>
                  <td className="border p-2 text-center font-semibold">{report.totals.guestMeals}</td>
                  <td className="border p-2 text-center font-semibold">{report.totals.allMeals}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {report.meals.map((meal) => (
              <div key={meal.mealType}>
                <h3 className="font-semibold">پرسنل {meal.mealLabel}</h3>
                <p className="mt-2 text-sm leading-7">
                  {meal.employeeNames.length > 0 ? meal.employeeNames.join("، ") : "—"}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border p-2">وعده</th>
                  <th className="border p-2">عنوان</th>
                  <th className="border p-2">نام مهمان</th>
                  <th className="border p-2">سازمان</th>
                  <th className="border p-2">تعداد</th>
                  <th className="border p-2">یادداشت</th>
                </tr>
              </thead>
              <tbody>
                {allGuestOrders.length > 0 ? (
                  allGuestOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="border p-2">{order.mealLabel}</td>
                      <td className="border p-2">{order.title}</td>
                      <td className="border p-2">{order.guestName ?? "—"}</td>
                      <td className="border p-2">{order.organization ?? "—"}</td>
                      <td className="border p-2 text-center">{order.count}</td>
                      <td className="border p-2">{order.note ?? "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="border p-2 text-center" colSpan={6}>
                      سفارش مهمانی ثبت نشده است.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-4 text-center text-sm">
            <div className="border p-6">تحویل‌دهنده</div>
            <div className="border p-6">تحویل‌گیرنده</div>
            <div className="border p-6">تاریخ و امضا</div>
          </div>
        </section>
      </div>
    </main>
  );
}