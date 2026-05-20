import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { ReportDateFilter } from "@/components/reports/report-date-filter";
import { requireAdmin } from "@/lib/auth/session";
import { getAttendanceReport } from "@/lib/reports/get-attendance-report";
import { resolveReportDateRange } from "@/lib/reports/report-date-range";

type ReportSearchParams = Promise<{ from?: string; to?: string }>;

const statusLabels = {
  PRESENT: "حاضر",
  ABSENT: "غایب",
} as const;

export default async function ReportsPage({ searchParams }: { searchParams: ReportSearchParams }) {
  await requireAdmin();

  const params = await searchParams;
  const { fromDate, toDate, fromDateKey, toDateKey } = resolveReportDateRange(params);
  const { dailySummary, userRows } = await getAttendanceReport(fromDate, toDate);

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-950 p-8 text-right text-zinc-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">گزارش حضور</h1>
            <ThemeToggle />
          </div>
          <p className="mt-2 text-sm text-zinc-400">در این گزارش فقط روزهای کاری شنبه تا چهارشنبه نمایش داده می‌شوند.</p>
          <Link href="/" className="mt-4 inline-block rounded-xl border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-800">بازگشت به داشبورد</Link>
        </header>

        <ReportDateFilter fromDateKey={fromDateKey} toDateKey={toDateKey} />

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-xl font-semibold">خلاصه روزانه</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-400">
                <tr>
                  <th className="p-3">تاریخ میلادی</th><th className="p-3">تاریخ شمسی</th><th className="p-3">صبحانه (حاضر)</th><th className="p-3">ناهار (حاضر)</th>
                </tr>
              </thead>
              <tbody>
                {dailySummary.map((row) => (
                  <tr key={row.dateKey} className="border-b border-zinc-800">
                    <td className="p-3">{row.dateKey}</td><td className="p-3">{row.persianDateLabel}</td><td className="p-3">{row.breakfastCount}</td><td className="p-3">{row.lunchCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-xl font-semibold">جزئیات کاربران</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-400">
                <tr>
                  <th className="p-3">تاریخ میلادی</th><th className="p-3">تاریخ شمسی</th><th className="p-3">نام</th><th className="p-3">نام کاربری</th><th className="p-3">صبحانه</th><th className="p-3">ناهار</th>
                </tr>
              </thead>
              <tbody>
                {userRows.map((row) => (
                  <tr key={`${row.dateKey}-${row.username}`} className="border-b border-zinc-800">
                    <td className="p-3">{row.dateKey}</td><td className="p-3">{row.persianDateLabel}</td><td className="p-3">{row.userName}</td><td className="p-3">{row.username}</td><td className="p-3">{statusLabels[row.breakfastStatus]}</td><td className="p-3">{statusLabels[row.lunchStatus]}</td>
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
