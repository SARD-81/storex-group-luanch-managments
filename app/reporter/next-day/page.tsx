import { existsSync } from "fs";
import path from "path";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { UserRole, MealType } from "@/app/generated/prisma/client";
import { logoutAction } from "@/actions/auth";
import { updateGuestMealCountsAction } from "@/actions/guest-meal-orders";
import { PrintReportButton } from "@/components/reporter/print-report-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { requireReporterAccess } from "@/lib/auth/session";
import { getNextDayMealReport } from "@/lib/reporter/next-day-report";

type SearchParams = Promise<{ error?: string; saved?: string }>;
type MealReport = Awaited<ReturnType<typeof getNextDayMealReport>>["meals"][number];

const savedMessages: Record<string, string> = {
  "guest-counts": "تعداد مهمان‌ها ذخیره شد.",
};

const errorMessages: Record<string, string> = {
  "non-workday": "برای روز غیرکاری امکان ثبت مهمان وجود ندارد.",
  "invalid-date": "تاریخ فرم با گزارش روز بعد مطابقت ندارد.",
  "invalid-guest-count": "تعداد مهمان‌ها معتبر نیست.",
};

const formalNote =
  "غذای مهمان با ثبت تعداد در سامانه قابل قبول است. هر کارمند و مهمان فقط غذای ثبت‌شده خود را دریافت می‌کند و امکان اضافه کردن غذا در همان روز وجود ندارد.";

export const dynamic = "force-dynamic";

function formatDisplayNumber(value: number) {
  return new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(value);
}

function renderMealSection(meal: MealReport) {
  const rowCount = Math.max(meal.employeeNames.length, meal.guestLabels.length, 1);

  return (
    <section key={meal.mealType} className="reporter-form-paper-meal mt-6">
      <h3 className="rounded-t-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-lg font-bold text-slate-950">
        {meal.mealLabel}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm text-slate-950">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-300 p-2 text-center">ردیف</th>
              <th className="border border-slate-300 p-2 text-center">
                نام و نام خانوادگی پرسنل
              </th>
              <th className="border border-slate-300 p-2 text-center">ردیف مهمان</th>
              <th className="border border-slate-300 p-2 text-center">مهمان</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, index) => (
              <tr key={`${meal.mealType}-${index}`}>
                <td className="w-20 border border-slate-300 p-2 text-center">
                  {meal.employeeNames[index] ? formatDisplayNumber(index + 1) : ""}
                </td>
                <td className="border border-slate-300 p-2">
                  {meal.employeeNames[index] ?? ""}
                </td>
                <td className="w-24 border border-slate-300 p-2 text-center">
                  {meal.guestLabels[index] ? formatDisplayNumber(index + 1) : ""}
                </td>
                <td className="border border-slate-300 p-2">
                  {meal.guestLabels[index] ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rounded-b-2xl border-x border-b border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-950">
        جمع کل {meal.mealLabel} = {formatDisplayNumber(meal.totalCount)}
      </p>
    </section>
  );
}

export default async function NextDayReporterPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  noStore();
  const currentUser = await requireReporterAccess();
  const params = await searchParams;
  const report = await getNextDayMealReport();
  const companyLogoExists = existsSync(
    path.join(process.cwd(), "public", "company-logo.png"),
  );
  const breakfastMeal = report.meals.find(
    (meal) => meal.mealType === MealType.BREAKFAST,
  ) as MealReport;
  const lunchMeal = report.meals.find(
    (meal) => meal.mealType === MealType.LUNCH,
  ) as MealReport;

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
              دانلود فرم Excel
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
            <h2 className="mb-2 text-lg font-semibold">ثبت تعداد مهمان‌ها</h2>
            <p className="mb-4 text-sm leading-7 text-muted-foreground">
              فقط تعداد مهمان‌های هر وعده را وارد کنید؛ اسامی مهمان‌ها به‌صورت خودکار در فرم چاپی با عنوان مهمان ۱، مهمان ۲ و ... نمایش داده می‌شود.
            </p>
            <form action={updateGuestMealCountsAction} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="date" value={report.reportDateKey} />
              <label className="space-y-2 text-sm font-semibold">
                <span>تعداد مهمان‌های صبحانه</span>
                <input
                  name="breakfastGuestCount"
                  type="number"
                  min={0}
                  max={500}
                  defaultValue={breakfastMeal.guestCount}
                  className="dashboard-muted-panel w-full p-3 text-sm"
                  required
                />
              </label>
              <label className="space-y-2 text-sm font-semibold">
                <span>تعداد مهمان‌های ناهار</span>
                <input
                  name="lunchGuestCount"
                  type="number"
                  min={0}
                  max={500}
                  defaultValue={lunchMeal.guestCount}
                  className="dashboard-muted-panel w-full p-3 text-sm"
                  required
                />
              </label>
              <PendingSubmitButton
                type="submit"
                pendingText="در حال ذخیره..."
                className="dashboard-primary-button md:col-span-2"
              >
                ذخیره تعداد مهمان‌ها
              </PendingSubmitButton>
            </form>
          </section>
        ) : null}

        <section className="reporter-print-area dashboard-glass-card">
          <div className="reporter-form-paper">
            <div className="grid gap-4 border-b border-slate-300 pb-5 text-slate-950 md:grid-cols-3 md:items-center">
              <div className="flex justify-start md:justify-start">
                {companyLogoExists ? (
                  <img
                    src="/company-logo.png"
                    alt="لوگوی شرکت"
                    className="h-20 max-w-36 object-contain"
                  />
                ) : (
                  <div className="flex h-20 w-36 items-center justify-center rounded-xl border border-slate-400 text-sm font-semibold">
                    لوگوی شرکت
                  </div>
                )}
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold">
                  فرم تحویل آمار وعده‌های غذایی
                </h2>
              </div>
              <div className="text-left text-sm font-semibold md:text-left">
                تاریخ: {report.reportDateLabel}
              </div>
            </div>

            {renderMealSection(breakfastMeal)}
            {renderMealSection(lunchMeal)}

            <div className="mt-6 grid gap-3 text-center text-sm font-bold text-slate-950 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                جمع کل صبحانه: {formatDisplayNumber(breakfastMeal.totalCount)}
              </div>
              <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                جمع کل ناهار: {formatDisplayNumber(lunchMeal.totalCount)}
              </div>
              <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                جمع کل وعده‌ها: {formatDisplayNumber(report.totals.allMeals)}
              </div>
            </div>

            <p className="mt-6 rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm font-semibold leading-8 text-slate-950">
              {formalNote}
            </p>

            <div className="mt-8 grid grid-cols-3 gap-4 text-center text-sm font-semibold text-slate-950">
              <div className="rounded-2xl border border-slate-300 p-8">تحویل‌دهنده</div>
              <div className="rounded-2xl border border-slate-300 p-8">تحویل‌گیرنده</div>
              <div className="rounded-2xl border border-slate-300 p-8">تاریخ و امضا</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
