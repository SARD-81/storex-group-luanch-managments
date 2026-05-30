"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";
import DateObject from "react-date-object";
import { getDateKey } from "@/lib/date/date-key";
import { Button } from "@/components/ui/button";

type AttendanceDatePickerPolicy = {
  dateKey: string;
  jalaliDateKey: string | null;
  dayNameFa: string | null;
  isSelectable: boolean;
  isWorkday: boolean | null;
  isWeeklyOffDay: boolean | null;
  isOfficialHoliday: boolean | null;
  isManualHoliday: boolean | null;
  isForcedWorkday: boolean | null;
  holidayTitle: string | null;
  eventCount: number;
  reasons: string[];
};

type AttendanceDatePickerProps = {
  selectedDateKey: string;
  datePickerPolicies: AttendanceDatePickerPolicy[];
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
  datePickerPolicies,
}: AttendanceDatePickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const policyByDateKey = new Map(
    datePickerPolicies.map((policy) => [policy.dateKey, policy]),
  );

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
          className="h-10 min-w-36 justify-center rounded-2xl border-border/60 bg-muted/50 px-4 text-center text-sm font-semibold text-foreground backdrop-blur transition hover:bg-muted/70"
        >
          {isPending ? "در حال تغییر..." : value || "انتخاب تاریخ"}
        </Button>
      )}
      mapDays={({ date }) => {
        const gregorianDate = dateObjectToGregorianDate(date);
        const dateKey = getDateKey(gregorianDate);
        const policy = policyByDateKey.get(dateKey);
        const disabled = policy?.isSelectable !== true;
        const classNames = [
          disabled ? "opacity-40" : "",
          policy?.isOfficialHoliday ? "text-rose-300" : "",
          policy?.isWeeklyOffDay ? "text-amber-300" : "",
        ].filter(Boolean);

        return {
          disabled,
          className: classNames.join(" "),
          title:
            policy?.holidayTitle ?? (disabled ? "غیرقابل انتخاب" : undefined),
        };
      }}
      onChange={(value) => {
        if (!value || Array.isArray(value)) {
          return;
        }

        const gregorianDate = dateObjectToGregorianDate(value);
        const dateKey = getDateKey(gregorianDate);

        if (policyByDateKey.get(dateKey)?.isSelectable !== true) {
          return;
        }

        startTransition(() => {
          router.push(`/?date=${dateKey}`);
        });
      }}
    />
  );
}
