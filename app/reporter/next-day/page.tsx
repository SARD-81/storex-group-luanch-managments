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

function renderCompactA5MealTable(breakfastMeal: MealReport, lunchMeal: MealReport) {
  const rowCount = Math.max(
    breakfastMeal.employeeNames.length,
    breakfastMeal.guestLabels.length,
    lunchMeal.employeeNames.length,
    lunchMeal.guestLabels.length,
    1,
  );

  return (
    <table className="reporter-a5-grid-table">
      <thead>
        <tr>
          <th>ردیف</th>
          <th>پرسنل صبحانه</th>
          <th>ردیف مهمان</th>
          <th>مهمان صبحانه</th>
          <th>ردیف</th>
          <th>پرسنل ناهار</th>
          <th>ردیف مهمان</th>
          <th>مهمان ناهار</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rowCount }, (_, index) => {
          const breakfastEmployee = breakfastMeal.employeeNames[index];
          const breakfastGuest = breakfastMeal.guestLabels[index];
          const lunchEmployee = lunchMeal.employeeNames[index];
          const lunchGuest = lunchMeal.guestLabels[index];

          return (
            <tr key={`compact-a5-meal-row-${index}`}>
              <td>{breakfastEmployee ? formatDisplayNumber(index + 1) : ""}</td>
              <td>{breakfastEmployee ?? ""}</td>
              <td>{breakfastGuest ? formatDisplayNumber(index + 1) : ""}</td>
              <td>{breakfastGuest ?? ""}</td>
              <td>{lunchEmployee ? formatDisplayNumber(index + 1) : ""}</td>
              <td>{lunchEmployee ?? ""}</td>
              <td>{lunchGuest ? formatDisplayNumber(index + 1) : ""}</td>
              <td>{lunchGuest ?? ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
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
          <div className="reporter-form-paper reporter-form-paper-a5">
            <div>
              <div>
                {companyLogoExists ? (
                  <img
                    src="/company-logo.png"
                    alt="لوگوی شرکت"
                  />
                ) : (
                  <div>لوگوی شرکت</div>
                )}
              </div>
              <h2>فرم تحویل آمار وعده‌های غذایی</h2>
              <div>تاریخ: {report.reportDateLabel}</div>
            </div>

            {renderCompactA5MealTable(breakfastMeal, lunchMeal)}

            <div className="reporter-a5-totals">
              <span>جمع صبحانه: {formatDisplayNumber(breakfastMeal.totalCount)}</span>
              <span>جمع ناهار: {formatDisplayNumber(lunchMeal.totalCount)}</span>
              <span>جمع کل: {formatDisplayNumber(report.totals.allMeals)}</span>
            </div>

            <p className="reporter-a5-note">{formalNote}</p>

            <div className="reporter-a5-signatures">
              <div>تحویل‌دهنده</div>
              <div>تحویل‌گیرنده</div>
              <div>تاریخ و امضا</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
