"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";
import { getDateKey } from "@/lib/date/date-key";
import { Button } from "@/components/ui/button";

type CalendarOverrideDatePickerProps = {
  selectedDateKey: string;
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function dateKeyToDateObject(dateKey: string): DateObject | null {
  if (!isValidDateKey(dateKey)) {
    return null;
  }

  const [year, month, day] = dateKey.split("-").map(Number);

  return new DateObject({
    date: new Date(Date.UTC(year, month - 1, day)),
    calendar: persian,
    locale: persianFa,
  });
}

export function dateObjectToGregorianDate(value: DateObject): Date {
  const date = value.toDate();

  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

export function getTodayDateKey(): string {
  return getDateKey(new Date());
}

export default function CalendarOverrideDatePicker({
  selectedDateKey,
}: CalendarOverrideDatePickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const todayDateKey = getTodayDateKey();

  return (
    <DatePicker
      calendar={persian}
      locale={persianFa}
      value={dateKeyToDateObject(selectedDateKey)}
      calendarPosition="bottom-right"
      portal
      zIndex={10000}
      render={(value, openCalendar) => (
        <Button
          type="button"
          variant="outline"
          onClick={openCalendar}
          disabled={isPending}
          className="h-10 min-w-40 justify-center rounded-2xl border-white/10 bg-white/10 px-4 text-center text-sm font-semibold backdrop-blur transition hover:bg-white/15 dark:bg-white/[0.04]"
        >
          {isPending ? "در حال تغییر تاریخ..." : value || "انتخاب تاریخ"}
        </Button>
      )}
      mapDays={({ date }) => {
        const gregorianDate = dateObjectToGregorianDate(date);
        const dateKey = getDateKey(gregorianDate);
        const disabled = dateKey < todayDateKey;

        return {
          disabled,
          className: disabled ? "opacity-40" : undefined,
          title: disabled ? "تاریخ گذشته قابل انتخاب نیست" : undefined,
        };
      }}
      onChange={(value) => {
        if (!value || Array.isArray(value)) {
          return;
        }

        const gregorianDate = dateObjectToGregorianDate(value);
        const dateKey = getDateKey(gregorianDate);

        if (dateKey < todayDateKey) {
          return;
        }

        startTransition(() => {
          router.push(`/settings/calendar-overrides?date=${dateKey}`);
        });
      }}
    />
  );
}
