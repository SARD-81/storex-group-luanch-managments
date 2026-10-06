"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";
import { getDateKey } from "@/lib/date/date-key";

type ReportDateFilterProps = {
  fromDateKey: string;
  toDateKey: string;
};

function dateKeyToDateObject(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  return new DateObject({
    date: new Date(year, month - 1, day),
    calendar: persian,
    locale: persianFa,
  });
}

function dateObjectToGregorianDate(value: DateObject) {
  const date = value.toDate();

  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

export function ReportDateFilter({
  fromDateKey,
  toDateKey,
}: ReportDateFilterProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draftFrom, setDraftFrom] = useState(fromDateKey);
  const [draftTo, setDraftTo] = useState(toDateKey);
  const fromValue = useMemo(() => dateKeyToDateObject(draftFrom), [draftFrom]);
  const toValue = useMemo(() => dateKeyToDateObject(draftTo), [draftTo]);
  const rangeError =
    draftFrom > draftTo
      ? "تاریخ پایان قبل از شروع است."
      : (Date.parse(draftTo) - Date.parse(draftFrom)) / 86400000 >= 366
        ? "حداکثر بازه گزارش ۳۶۶ روز است."
        : null;

  const updateRange = (nextFromDateKey: string, nextToDateKey: string) => {
    startTransition(() => {
      router.push(
        `/reports?from=${encodeURIComponent(nextFromDateKey)}&to=${encodeURIComponent(nextToDateKey)}`,
      );
    });
  };

  return (
    <section className="dashboard-glass-card">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-2 text-sm">
          <span>از تاریخ</span>
          <DatePicker
            calendar={persian}
            locale={persianFa}
            value={fromValue}
            calendarPosition="bottom-right"
            portal
            zIndex={10000}
            render={(value, openCalendar) => (
              <button
                type="button"
                onClick={openCalendar}
                className="dashboard-muted-panel min-h-10 min-w-36 rounded-xl px-4 py-2 text-right text-sm"
              >
                {value || "انتخاب تاریخ"}
              </button>
            )}
            onChange={(value) => {
              if (!value || Array.isArray(value)) {
                return;
              }

              const gregorianDate = dateObjectToGregorianDate(value);
              setDraftFrom(getDateKey(gregorianDate));
            }}
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span>تا تاریخ</span>
          <DatePicker
            calendar={persian}
            locale={persianFa}
            value={toValue}
            calendarPosition="bottom-right"
            portal
            zIndex={10000}
            render={(value, openCalendar) => (
              <button
                type="button"
                onClick={openCalendar}
                className="dashboard-muted-panel min-h-10 min-w-36 rounded-xl px-4 py-2 text-right text-sm"
              >
                {value || "انتخاب تاریخ"}
              </button>
            )}
            onChange={(value) => {
              if (!value || Array.isArray(value)) {
                return;
              }

              const gregorianDate = dateObjectToGregorianDate(value);
              setDraftTo(getDateKey(gregorianDate));
            }}
          />
        </label>

        <button
          type="button"
          className="dashboard-primary-button"
          disabled={isPending || !!rangeError}
          onClick={() => {
            if (draftFrom !== fromDateKey || draftTo !== toDateKey)
              updateRange(draftFrom, draftTo);
          }}
        >
          اعمال فیلتر
        </button>
        {rangeError ? <p role="alert">{rangeError}</p> : null}
        {isPending ? (
          <p className="text-sm text-zinc-300">در حال به‌روزرسانی گزارش...</p>
        ) : null}

        <Link
          href={`/reports/export?from=${encodeURIComponent(fromDateKey)}&to=${encodeURIComponent(toDateKey)}`}
          className="rounded-xl border border-zinc-700 px-5 py-2 text-sm text-zinc-100 transition hover:bg-zinc-800"
        >
          دریافت فایل Excel
        </Link>
      </div>
    </section>
  );
}
