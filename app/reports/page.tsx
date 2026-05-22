import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { ThemeToggle } from "@/components/theme-toggle";
import { ReportDateFilter } from "@/components/reports/report-date-filter";
import { requireAdmin } from "@/lib/auth/session";
import { formatPersianWeekdayDate } from "@/lib/date/persian-format";
import { getAttendanceReport } from "@/lib/reports/get-attendance-report";
import { resolveReportDateRange } from "@/lib/reports/report-date-range";

type ReportSearchParams = Promise<{ from?: string; to?: string }>;

const statusLabels = {
  PRESENT: "حاضر",
  ABSENT: "غایب",
} as const;

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: ReportSearchParams }) {
  await requireAdmin();
  noStore();

  const params = await searchParams;
  const { fromDate, toDate, fromDateKey, toDateKey } = resolveReportDateRange(params);
  const { dailySummary, userRows } = await getAttendanceReport(fromDate, toDate);
  const activeRangeLabel = `${formatPersianWeekdayDate(fromDate)} تا ${formatPersianWeekdayDate(toDate)}`;

  return (
    <main dir="rtl" className="dashboard-aurora-shell min-h-screen p-6 text-right text-zinc-50 md:p-8">
      <div className="dashboard-aurora dashboard-aurora-one" />
      <div className="dashboard-aurora dashboard-aurora-two" />
      <div className="dashboard-aurora dashboard-aurora-three" />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6">
        <header className="dashboard-glass-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">گزارش حضور</h1>
            <ThemeToggle />
          </div>
          <p className="mt-2 text-sm text-zinc-400">در این گزارش فقط روزهای کاری شنبه تا چهارشنبه نمایش داده می‌شوند.</p>
          <p className="dashboard-muted-panel mt-4 text-sm">بازهٔ فعال گزارش: {activeRangeLabel}</p>
          <Link href="/" className="mt-4 inline-block rounded-xl border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-800">بازگشت به داشبورد</Link>
        </header>

        <ReportDateFilter fromDateKey={fromDateKey} toDateKey={toDateKey} />

        <section className="dashboard-glass-card">
          <h2 className="mb-4 text-xl font-semibold">خلاصه روزانه</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-400">
                <tr>
                  <th className="p-3">تاریخ جلالی</th><th className="p-3">صبحانه حاضر</th><th className="p-3">ناهار حاضر</th>
                </tr>
              </thead>
              <tbody>
                {dailySummary.map((row) => (
                  <tr key={row.dateKey} className="border-b border-zinc-800">
                    <td className="p-3">{row.persianDateLabel}</td><td className="p-3">{row.breakfastCount}</td><td className="p-3">{row.lunchCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dashboard-glass-card">
          <h2 className="mb-4 text-xl font-semibold">جزئیات کاربران</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-400">
                <tr>
                  <th className="p-3">تاریخ جلالی</th><th className="p-3">کاربر</th><th className="p-3">صبحانه</th><th className="p-3">ناهار</th>
                </tr>
              </thead>
              <tbody>
                {userRows.map((row) => (
                  <tr key={`${row.dateKey}-${row.username}`} className="border-b border-zinc-800">
                    <td className="p-3">{row.persianDateLabel}</td>
                    <td className="p-3">{row.userName} <span className="text-zinc-400">({row.username})</span></td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${row.breakfastStatus === "PRESENT" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                        {statusLabels[row.breakfastStatus]}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${row.lunchStatus === "PRESENT" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                        {statusLabels[row.lunchStatus]}
                      </span>
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
