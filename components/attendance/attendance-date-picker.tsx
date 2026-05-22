"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";
import DateObject from "react-date-object";
import { getDateKey } from "@/lib/date/date-key";
import { isSelectableAttendanceDate } from "@/lib/attendance/rules";
import { Button } from "@/components/ui/button";

type AttendanceDatePickerProps = {
  selectedDateKey: string;
};

function dateKeyToDateObject(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  return new DateObject({
    date: new Date(Date.UTC(year, month - 1, day)),
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

export function AttendanceDatePicker({
  selectedDateKey,
}: AttendanceDatePickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
          className="h-10 min-w-36 justify-center rounded-2xl border-white/10 bg-white/10 px-4 text-center text-sm font-semibold backdrop-blur transition hover:bg-white/15 dark:bg-white/[0.04]"
        >
          {isPending ? "در حال تغییر..." : value || "انتخاب تاریخ"}
        </Button>
      )}
      mapDays={({ date }) => {
        const gregorianDate = dateObjectToGregorianDate(date);
        const disabled = !isSelectableAttendanceDate(gregorianDate);

        return {
          disabled,
          className: disabled ? "opacity-40" : "",
        };
      }}
      onChange={(value) => {
        if (!value || Array.isArray(value)) {
          return;
        }

        const gregorianDate = dateObjectToGregorianDate(value);
        startTransition(() => {
          router.push(`/?date=${getDateKey(gregorianDate)}`);
        });
      }}
    />
  );
}