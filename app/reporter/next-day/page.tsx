import { existsSync } from "fs";
import path from "path";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { logoutAction } from "@/actions/auth";
import { updateGuestMealCountsAction } from "@/actions/guest-meal-orders";
import { ReporterAutomationStatus } from "@/components/reporter/automation-status";
import { PrintReportButton } from "@/components/reporter/print-report-button";
import { ReporterPrintPageStyle } from "@/components/reporter/reporter-print-page-style";
import { ThemeToggle } from "@/components/theme-toggle";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { UserRole } from "@/app/generated/prisma/client";
import { requireReporterAccess } from "@/lib/auth/session";
import { reportDocumentMarkup } from "@/lib/reporter/report-document";
import { getNextDayMealReport } from "@/lib/reporter/next-day-report";

type SearchParams = Promise<{ error?: string; saved?: string }>;

type NextDayReport = Awaited<ReturnType<typeof getNextDayMealReport>>;

const savedMessages: Record<string, string> = {
  "guest-counts": "تعداد مهمان‌ها ذخیره شد.",
};

const errorMessages: Record<string, string> = {
  "non-workday": "برای روز غیرکاری امکان ثبت مهمان وجود ندارد.",
  "invalid-date": "تاریخ فرم با گزارش روز بعد مطابقت ندارد.",
  "invalid-guest-count": "تعداد مهمان‌ها معتبر نیست.",
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
  const companyLogoExists = existsSync(
    path.join(process.cwd(), "public", "company-logo.png"),
  );

  return (
    <main
      dir="rtl"
      className="dashboard-aurora-shell min-h-screen p-6 text-right text-foreground md:p-8"
    >
      <ReporterPrintPageStyle />
      <div className="dashboard-aurora dashboard-aurora-one reporter-no-print" />
      <div className="dashboard-aurora dashboard-aurora-two reporter-no-print" />
      <div className="dashboard-aurora dashboard-aurora-three reporter-no-print" />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6">
        <header className="dashboard-glass-card reporter-no-print flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                آمار پرسنل و مهمان‌ها برای روز کاری آینده
              </p>
              <h1 className="mt-1 text-3xl font-bold">
                گزارش وعده‌های روز کاری بعد
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                تاریخ گزارش: {report.reportDateLabel}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
              <ThemeToggle />
              <form action={logoutAction}>
                <PendingSubmitButton
                  className="dashboard-action-button"
                  pendingText="در حال خروج..."
                >
                  خروج
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
            <Link
              href="/reporter/next-day/export"
              className="dashboard-primary-button"
            >
              دریافت فایل Excel
            </Link>
          </div>
        </header>

        <ReporterAutomationStatus
          dateKey={report.reportDateKey}
          admin={currentUser.role === UserRole.ADMIN}
        />

        {params.saved ? (
          <div className="dashboard-muted-panel reporter-no-print border border-emerald-400/40 text-sm text-emerald-200">
            {savedMessages[params.saved] ?? params.saved}
          </div>
        ) : null}

        {params.error ? (
          <div className="dashboard-muted-panel reporter-no-print border border-rose-400/40 text-sm text-rose-200">
            {errorMessages[params.error] ?? params.error}
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
                  <p className="mt-1 text-2xl font-bold">
                    {meal.employeeCount}
                  </p>
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
              فقط تعداد مهمان‌های هر وعده را وارد کنید؛ اسامی مهمان‌ها به‌صورت
              خودکار در فرم چاپی با عنوان مهمان ۱، مهمان ۲ و ... نمایش داده
              می‌شود.
            </p>
            <form
              action={updateGuestMealCountsAction}
              className="grid gap-3 md:grid-cols-2"
            >
              <input type="hidden" name="date" value={report.reportDateKey} />
              <label className="space-y-2 text-sm font-semibold">
                <span>تعداد مهمان‌های صبحانه</span>
                <input
                  name="breakfastGuestCount"
                  type="number"
                  min={0}
                  max={500}
                  defaultValue={report.guestCounts.breakfast}
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
                  defaultValue={report.guestCounts.lunch}
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
          <div
            dangerouslySetInnerHTML={{
              __html: reportDocumentMarkup(
                report,
                companyLogoExists ? "/company-logo.png" : undefined,
              ),
            }}
          />
        </section>
      </div>
    </main>
  );
}
