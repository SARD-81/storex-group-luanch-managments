import { isWorkDay } from "@/lib/attendance/week";
import { getDateKey, getTodayDateKey } from "@/lib/date/date-key";

export function getMaxSelectableDate(now = new Date()) {
  const result = new Date(now);
  result.setMonth(result.getMonth() + 1);
  return result;
}

export function getAttendanceDeadline(targetDate: Date) {
  const deadline = new Date(targetDate);
  deadline.setUTCDate(deadline.getUTCDate() - 1);
  deadline.setUTCHours(8, 0, 0, 0);
  return deadline;
}

export function canEditAttendance(targetDate: Date, now = new Date()) {
  return now < getAttendanceDeadline(targetDate);
}

export function getAppDayOfWeekFromDate(date: Date) {
  return (date.getUTCDay() + 1) % 7;
}

export function isDateWithinSelectableRange(targetDate: Date, now = new Date()) {
  const todayKey = getTodayDateKey(now);
  const maxDateKey = getDateKey(getMaxSelectableDate(now));
  const targetKey = getDateKey(targetDate);

  return targetKey >= todayKey && targetKey <= maxDateKey;
}

export function isSelectableAttendanceDate(targetDate: Date, now = new Date()) {
  const appDay = getAppDayOfWeekFromDate(targetDate);

  return isWorkDay(appDay) && isDateWithinSelectableRange(targetDate, now);
}
