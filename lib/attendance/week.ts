export const WEEK_DAYS = [
  { dayOfWeek: 0, label: "Saturday", faLabel: "شنبه" },
  { dayOfWeek: 1, label: "Sunday", faLabel: "یکشنبه" },
  { dayOfWeek: 2, label: "Monday", faLabel: "دوشنبه" },
  { dayOfWeek: 3, label: "Tuesday", faLabel: "سه‌شنبه" },
  { dayOfWeek: 4, label: "Wednesday", faLabel: "چهارشنبه" },
  { dayOfWeek: 5, label: "Thursday", faLabel: "پنجشنبه" },
  { dayOfWeek: 6, label: "Friday", faLabel: "جمعه" },
] as const;

export function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function createUtcDateOnly(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day));
}

function getAppDayOfWeek(date: Date) {
  // JavaScript: Sunday = 0, Monday = 1, ..., Saturday = 6
  // App: Saturday = 0, Sunday = 1, ..., Friday = 6
  return (date.getDay() + 1) % 7;
}

export function getNextWeekStartDate(baseDate = new Date()) {
  const appDay = getAppDayOfWeek(baseDate);
  const daysUntilNextSaturday = appDay === 0 ? 7 : 7 - appDay;

  const today = createUtcDateOnly(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
  );

  return addDays(today, daysUntilNextSaturday);
}

export function getNextWeekRange(baseDate = new Date()) {
  const weekStart = getNextWeekStartDate(baseDate);
  const weekEndExclusive = addDays(weekStart, 7);

  return {
    weekStart,
    weekEndExclusive,
  };
}

export function getWeekDays(weekStart: Date) {
  return WEEK_DAYS.map((day) => {
    const date = addDays(weekStart, day.dayOfWeek);

    return {
      ...day,
      date,
      dateKey: toDateKey(date),
    };
  });
}