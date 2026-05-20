import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import {
  canEditAttendance,
  getAppDayOfWeekFromDate,
  getAttendanceDeadline,
  isSelectableAttendanceDate,
} from "@/lib/attendance/rules";
import { isWorkDay } from "@/lib/attendance/week";
import { getDateKey } from "@/lib/date/date-key";
import { getTehranDateKey } from "@/lib/date/tehran-time";

const dayNameFormatter = new Intl.DateTimeFormat("fa-IR", {
  weekday: "long",
  timeZone: "UTC",
});

const dateLabelFormatter = new Intl.DateTimeFormat("fa-IR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function dateObjectToUtcDateOnly(value: DateObject) {
  const date = value.toDate();

  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

export function getCurrentJalaliMonthRange(now = new Date()) {
  const nowInPersian = new DateObject({
    date: now,
    calendar: persian,
  });

  const monthStartInPersian = new DateObject({
    calendar: persian,
    year: nowInPersian.year,
    month: nowInPersian.month.number,
    day: 1,
  });

  const nextMonthStartInPersian = new DateObject(monthStartInPersian).add(
    1,
    "month",
  );

  return {
    monthStart: dateObjectToUtcDateOnly(monthStartInPersian),
    nextMonthStart: dateObjectToUtcDateOnly(nextMonthStartInPersian),
  };
}

export function getCurrentJalaliMonthDays(now = new Date()) {
  const { monthStart, nextMonthStart } = getCurrentJalaliMonthRange(now);
  const todayKey = getTehranDateKey(now);
  const days = [];

  for (
    let cursor = new Date(monthStart);
    cursor < nextMonthStart;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const currentDate = new Date(cursor);
    const dateKey = getDateKey(currentDate);
    const appDay = getAppDayOfWeekFromDate(currentDate);
    const workDay = isWorkDay(appDay);
    const selectable = workDay && isSelectableAttendanceDate(currentDate, now);
    const deadline = getAttendanceDeadline(currentDate);

    days.push({
      date: currentDate,
      dateKey,
      dayNameFa: dayNameFormatter.format(currentDate),
      persianDateLabel: dateLabelFormatter.format(currentDate),
      isWorkDay: workDay,
      canEdit: selectable && canEditAttendance(currentDate, now),
      isSelectable: selectable,
      deadline,
      isToday: todayKey === dateKey,
    });
  }

  return {
    monthStart,
    nextMonthStart,
    days,
  };
}