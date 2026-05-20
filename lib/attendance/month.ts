import { canEditAttendance, getAttendanceDeadline, isSelectableAttendanceDate } from "@/lib/attendance/rules";
import { getDateKey } from "@/lib/date/date-key";
import { getTehranDateKey } from "@/lib/date/tehran-time";

const dayNameFormatter = new Intl.DateTimeFormat("fa-IR", { weekday: "long", timeZone: "UTC" });
const dateLabelFormatter = new Intl.DateTimeFormat("fa-IR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function getCurrentMonthRange(now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    monthStart,
    nextMonthStart,
  };
}

export function getCurrentMonthWorkDays(now = new Date()) {
  const { monthStart, nextMonthStart } = getCurrentMonthRange(now);
  const todayKey = getTehranDateKey(now);
  const days = [];

  for (let date = new Date(monthStart); date < nextMonthStart; date.setUTCDate(date.getUTCDate() + 1)) {
    const dayOfWeek = (date.getUTCDay() + 1) % 7;
    if (dayOfWeek < 0 || dayOfWeek > 4) {
      continue;
    }

    const currentDate = new Date(date);
    const dateKey = getDateKey(currentDate);
    const deadline = getAttendanceDeadline(currentDate);

    days.push({
      date: currentDate,
      dateKey,
      dayNameFa: dayNameFormatter.format(currentDate),
      persianDateLabel: dateLabelFormatter.format(currentDate),
      canEdit: canEditAttendance(currentDate, now),
      isSelectable: isSelectableAttendanceDate(currentDate, now),
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
