"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseDateKey, getDateKey } from "@/lib/date/date-key";
import { isSelectableAttendanceDate } from "@/lib/attendance/rules";

type AttendanceDatePickerProps = {
  selectedDateKey: string;
};

function formatPersianDate(date: Date) {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(date);
}

export function AttendanceDatePicker({ selectedDateKey }: AttendanceDatePickerProps) {
  const router = useRouter();
  const selectedDate = parseDateKey(selectedDateKey);

  const selectedText = useMemo(() => {
    if (!selectedDate) {
      return "انتخاب تاریخ";
    }

    return formatPersianDate(selectedDate);
  }, [selectedDate]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start text-right">
          {selectedText}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate ?? undefined}
          onSelect={(date) => {
            if (!date) {
              return;
            }

            const dateKey = getDateKey(date);
            router.push(`/?date=${dateKey}`);
          }}
          disabled={(date) => !isSelectableAttendanceDate(date, new Date())}
        />
      </PopoverContent>
    </Popover>
  );
}
