"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import gregorian from "react-date-object/calendars/gregorian";
import persianFa from "react-date-object/locales/persian_fa";
import gregorianEn from "react-date-object/locales/gregorian_en";
import { resolveReportDateRange } from "@/lib/reports/report-date-range";

function dateObject(dateKey: string) {
  return new DateObject({
    date: dateKey,
    format: "YYYY-MM-DD",
    calendar: gregorian,
    locale: gregorianEn,
  }).convert(persian, persianFa);
}
function dateKey(value: DateObject) {
  return new DateObject(value)
    .convert(gregorian, gregorianEn)
    .format("YYYY-MM-DD");
}

/** Keep one filter instance throughout navigation; sync drafts only on applied URL changes. */
export function ReportDateFilter({
  fromDateKey,
  toDateKey,
  valid = true,
}: {
  fromDateKey: string;
  toDateKey: string;
  valid?: boolean;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(() => dateObject(fromDateKey));
  const [to, setTo] = useState(() => dateObject(toDateKey));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setFrom((current) =>
      dateKey(current) === fromDateKey ? current : dateObject(fromDateKey),
    );
    setTo((current) =>
      dateKey(current) === toDateKey ? current : dateObject(toDateKey),
    );
    setError(null);
  }, [fromDateKey, toDateKey]);
  return (
    <section className="dashboard-glass-card">
      <form
        className="flex flex-wrap items-end gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const range = resolveReportDateRange({
            from: dateKey(from),
            to: dateKey(to),
          });
          setError(range.error);
          if (range.error) return;
          if (
            range.fromDateKey === fromDateKey &&
            range.toDateKey === toDateKey &&
            valid
          )
            return;
          startTransition(() =>
            router.push(
              `/reports?from=${range.fromDateKey}&to=${range.toDateKey}`,
              { scroll: false },
            ),
          );
        }}
      >
        {[
          { label: "از تاریخ", value: from, set: setFrom },
          { label: "تا تاریخ", value: to, set: setTo },
        ].map((field) => (
          <label key={field.label} className="flex flex-col gap-2 text-sm">
            <span>{field.label}</span>
            <DatePicker
              calendar={persian}
              locale={persianFa}
              value={field.value}
              calendarPosition="bottom-right"
              portal
              zIndex={10000}
              render={(value, openCalendar) => (
                <button
                  type="button"
                  aria-label={field.label}
                  onClick={openCalendar}
                  className="dashboard-muted-panel min-h-10 min-w-36 rounded-xl px-4 py-2 text-right text-sm"
                >
                  {value || "انتخاب تاریخ"}
                </button>
              )}
              onChange={(value) => {
                if (value && !Array.isArray(value)) {
                  field.set((current) =>
                    dateKey(current) === dateKey(value)
                      ? current
                      : new DateObject(value),
                  );
                  setError(null);
                }
              }}
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={isPending}
          className="dashboard-primary-button"
        >
          اعمال فیلتر
        </button>
        {isPending && (
          <p role="status" className="text-sm">
            در حال به‌روزرسانی گزارش...
          </p>
        )}
        {valid && (
          <a
            href={`/reports/export?from=${fromDateKey}&to=${toDateKey}`}
            className="dashboard-action-button"
          >
            دریافت فایل Excel
          </a>
        )}
        {error && (
          <p role="alert" className="w-full text-sm text-rose-600">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
