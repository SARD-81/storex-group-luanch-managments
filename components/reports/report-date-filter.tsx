import Link from "next/link";
import { parseDateKey } from "@/lib/date/date-key";
import { formatPersianWeekdayDate } from "@/lib/date/persian-format";

type ReportDateFilterProps = {
  fromDateKey: string;
  toDateKey: string;
};

export function ReportDateFilter({ fromDateKey, toDateKey }: ReportDateFilterProps) {
  const fromDate = parseDateKey(fromDateKey);
  const toDate = parseDateKey(toDateKey);

  return (
    <section className="dashboard-glass-card">
      <form method="GET" action="/reports" className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-2 text-sm">
          <span>از تاریخ</span>
          <input
            type="date"
            name="from"
            defaultValue={fromDateKey}
            className="dashboard-muted-panel"
          />
          <span className="text-xs text-zinc-300">{fromDate ? formatPersianWeekdayDate(fromDate) : "—"}</span>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span>تا تاریخ</span>
          <input
            type="date"
            name="to"
            defaultValue={toDateKey}
            className="dashboard-muted-panel"
          />
          <span className="text-xs text-zinc-300">{toDate ? formatPersianWeekdayDate(toDate) : "—"}</span>
        </label>

        <button
          type="submit"
          className="rounded-xl bg-zinc-50 px-5 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
        >
          اعمال فیلتر
        </button>

        <Link
          href={`/reports/export?from=${encodeURIComponent(fromDateKey)}&to=${encodeURIComponent(toDateKey)}`}
          className="rounded-xl border border-zinc-700 px-5 py-2 text-sm text-zinc-100 transition hover:bg-zinc-800"
        >
          دریافت CSV
        </Link>
      </form>
    </section>
  );
}
