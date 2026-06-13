import { isWorkDay } from "@/lib/attendance/week";
import { getDateKey, parseDateKey } from "@/lib/date/date-key";
import {
  createTehranDateTimeInstant,
  getTehranDateKey,
} from "@/lib/date/tehran-time";

function addDaysToDateKey(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);

  if (!date) {
    return dateKey;
  }

  date.setUTCDate(date.getUTCDate() + days);

  return getDateKey(date);
}

export function getMaxSelectableDate(now = new Date()) {
  const todayKey = getTehranDateKey(now);
  const today = parseDateKey(todayKey) ?? now;
  const result = new Date(today);

  result.setUTCMonth(result.getUTCMonth() + 1);

  return result;
}

export function getAttendanceDeadline(targetDate: Date) {
  const targetDateKey = getDateKey(targetDate);
  const previousDateKey = addDaysToDateKey(targetDateKey, -1);

  return createTehranDateTimeInstant(previousDateKey, 12, 0);
}

export function canEditAttendance(targetDate: Date, now = new Date()) {
  return now < getAttendanceDeadline(targetDate);
}

export function getAppDayOfWeekFromDate(date: Date) {
  return (date.getUTCDay() + 1) % 7;
}

export function isDateWithinSelectableRange(targetDate: Date, now = new Date()) {
  const todayKey = getTehranDateKey(now);
  const maxDateKey = getDateKey(getMaxSelectableDate(now));
  const targetKey = getDateKey(targetDate);

  return targetKey >= todayKey && targetKey <= maxDateKey;
}

export function isSelectableAttendanceDate(targetDate: Date, now = new Date()) {
  const appDay = getAppDayOfWeekFromDate(targetDate);

  return isWorkDay(appDay) && isDateWithinSelectableRange(targetDate, now);
}
