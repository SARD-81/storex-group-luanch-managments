import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import {
  canEditAttendance,
  getAppDayOfWeekFromDate,
  getAttendanceDeadline,
  isSelectableAttendanceDate,
} from "@/lib/attendance/rules";
import { isWorkDay } from "@/lib/attendance/week";
import { getDateKey, parseDateKey } from "@/lib/date/date-key";
import { getTehranDateKey } from "@/lib/date/tehran-time";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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

function addUtcDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
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

export function getNextJalaliMonthRange(now = new Date()) {
  const { nextMonthStart } = getCurrentJalaliMonthRange(now);
  const nextMonthStartInPersian = new DateObject({
    date: nextMonthStart,
    calendar: persian,
  });
  const followingMonthStartInPersian = new DateObject(
    nextMonthStartInPersian,
  ).add(1, "month");

  return {
    monthStart: nextMonthStart,
    nextMonthStart: dateObjectToUtcDateOnly(followingMonthStartInPersian),
  };
}

export function isInLastJalaliMonthWeek(now = new Date()) {
  const todayKey = getTehranDateKey(now);
  const today = parseDateKey(todayKey) ?? new Date();
  const { nextMonthStart } = getCurrentJalaliMonthRange(now);
  const daysUntilNextMonth = Math.ceil(
    (nextMonthStart.getTime() - today.getTime()) / ONE_DAY_MS,
  );

  return daysUntilNextMonth > 0 && daysUntilNextMonth <= 7;
}

export function getAttendanceReservationWindow(now = new Date()) {
  const currentMonthRange = getCurrentJalaliMonthRange(now);
  const includeNextMonth = isInLastJalaliMonthWeek(now);
  const monthEndExclusive = includeNextMonth
    ? getNextJalaliMonthRange(now).nextMonthStart
    : currentMonthRange.nextMonthStart;
  const maxDate = addUtcDays(monthEndExclusive, -1);

  return {
    monthStart: currentMonthRange.monthStart,
    monthEndExclusive,
    todayDateKey: getTehranDateKey(now),
    maxDateKey: getDateKey(maxDate),
    includeNextMonth,
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

    if (!workDay) {
      continue;
    }

    days.push({
      date: currentDate,
      dateKey,
      dayNameFa: dayNameFormatter.format(currentDate),
      persianDateLabel: dateLabelFormatter.format(currentDate),
      isWorkDay: true,
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
