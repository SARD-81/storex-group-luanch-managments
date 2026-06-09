import { existsSync } from "fs";
import path from "path";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { logoutAction } from "@/actions/auth";
import { updateGuestMealCountsAction } from "@/actions/guest-meal-orders";
import { PrintReportButton } from "@/components/reporter/print-report-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { requireReporterAccess } from "@/lib/auth/session";
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

function formatDisplayNumber(value: number) {
  return new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(value);
}

function renderCheckMark(present: boolean) {
  return present ? "✓" : "";
}

function renderPrintableRows(report: NextDayReport) {
  const manualRowCount = 4;
  const userRows = report.peopleRows.map((row, index) => ({
    key: row.userId,
    rowNumber: index + 1,
    name: row.name,
    breakfast: renderCheckMark(row.breakfastPresent),
    lunch: renderCheckMark(row.lunchPresent),
    notes: "",
    variant: "user" as const,
  }));

  const manualRows = Array.from({ length: manualRowCount }, (_, index) => ({
    key: `manual-${index}`,
    rowNumber: userRows.length + index + 1,
    name: "",
    breakfast: "",
    lunch: "",
    notes: "",
    variant: "manual" as const,
  }));

  const guestRowNumber = userRows.length + manualRowCount + 1;
  const guestRow = {
    key: "guest-row",
    rowNumber: guestRowNumber,
    name: "مهمان",
    breakfast: formatDisplayNumber(report.guestCounts.breakfast),
    lunch: formatDisplayNumber(report.guestCounts.lunch),
    notes: "",
    variant: "guest" as const,
  };

  const totalRow = {
    key: "total-row",
    rowNumber: guestRowNumber + 1,
    name: "جمع کل",
    breakfast: formatDisplayNumber(report.totals.breakfastAll),
    lunch: formatDisplayNumber(report.totals.lunchAll),
    notes: "",
    variant: "total" as const,
  };

  return [...userRows, ...manualRows, guestRow, totalRow];
}

function printReportHeader(report: NextDayReport, companyLogoExists: boolean) {
  return (
    <div className="reporter-next-day-header">
      <div className="reporter-next-day-header__logo">
        {companyLogoExists ? (
          <img src="/company-logo.png" alt="لوگوی بهاران" />
        ) : (
          <div className="reporter-next-day-logo-placeholder">لوگوی بهاران</div>
        )}
      </div>

      <div className="reporter-next-day-header__title">
        <h2>آمار صبحانه، ناهار بهاران</h2>
      </div>

      <div className="reporter-next-day-header__date">
        <span>تاریخ گزارش</span>
        <strong>{report.reportDateLabel}</strong>
      </div>
    </div>
  );
}

function renderPrintableTable(report: NextDayReport) {
  const rows = renderPrintableRows(report);

  return (
    <table className="reporter-next-day-table">
      <colgroup>
        <col style={{ width: "9mm" }} />
        <col style={{ width: "80mm" }} />
        <col style={{ width: "15mm" }} />
        <col style={{ width: "15mm" }} />
        <col style={{ width: "66mm" }} />
      </colgroup>
      <thead>
        <tr>
          <th>ردیف</th>
          <th>نام و نام خانوادگی</th>
          <th>صبحانه</th>
          <th>ناهار</th>
          <th>توضیحات</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.key}
            className={row.variant === "total" ? "reporter-next-day-table__total-row" : undefined}
          >
            <td>{formatDisplayNumber(row.rowNumber)}</td>
            <td className="reporter-next-day-table__name-cell">{row.name}</td>
            <td className="reporter-next-day-table__meal-cell">{row.breakfast}</td>
            <td className="reporter-next-day-table__meal-cell">{row.lunch}</td>
            <td className="reporter-next-day-table__notes-cell">{row.notes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function renderPrintableFooter() {
  return (
    <div className="reporter-next-day-footer">
      <span>نام و نام خانوادگی مسئول مربوطه :</span>
      <span className="reporter-next-day-footer__line" aria-hidden="true" />
    </div>
  );
}

export default async function NextDayReporterPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  noStore();
  await requireReporterAccess();
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
              <h1 className="mt-1 text-3xl font-bold">گزارش وعده‌های غذایی روز بعد</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                تاریخ گزارش: {report.reportDateLabel}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
              <PrintReportButton />
              <Link href="/reporter/next-day/export" className="dashboard-primary-button">
                دریافت فایل Excel
              </Link>
              <ThemeToggle />
            </div>
          </div>

          <form action={logoutAction} className="self-start reporter-no-print">
            <PendingSubmitButton type="submit" pendingText="در حال خروج...">
              خروج
            </PendingSubmitButton>
          </form>
        </header>

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
            <h2 className="text-lg font-semibold text-amber-200">هشدار تقویم</h2>
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
              فقط تعداد مهمان‌های هر وعده را وارد کنید؛ اسامی مهمان‌ها به‌صورت خودکار
              در فرم چاپی با عنوان مهمان ۱، مهمان ۲ و ... نمایش داده می‌شود.
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
          <div className="reporter-form-paper reporter-next-day-paper">
            {printReportHeader(report, companyLogoExists)}

            {renderPrintableTable(report)}

            {renderPrintableFooter()}
          </div>
        </section>
      </div>
    </main>
  );
}
