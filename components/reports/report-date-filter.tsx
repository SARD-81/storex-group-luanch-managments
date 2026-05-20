import Link from "next/link";

type ReportDateFilterProps = {
  fromDateKey: string;
  toDateKey: string;
};

export function ReportDateFilter({ fromDateKey, toDateKey }: ReportDateFilterProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <form method="GET" action="/reports" className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-2 text-sm">
          <span>از تاریخ</span>
          <input
            type="date"
            name="from"
            defaultValue={fromDateKey}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span>تا تاریخ</span>
          <input
            type="date"
            name="to"
            defaultValue={toDateKey}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
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
