export const WORK_DAYS = [
  { dayOfWeek: 0, label: "شنبه" },
  { dayOfWeek: 1, label: "یکشنبه" },
  { dayOfWeek: 2, label: "دوشنبه" },
  { dayOfWeek: 3, label: "سه‌شنبه" },
  { dayOfWeek: 4, label: "چهارشنبه" },
] as const;

export const WORK_DAY_COUNT = WORK_DAYS.length;

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
  return (date.getDay() + 1) % 7;
}

export function getNextWorkWeekStartDate(baseDate = new Date()) {
  const appDay = getAppDayOfWeek(baseDate);
  const daysUntilNextSaturday = appDay === 0 ? 7 : 7 - appDay;

  const today = createUtcDateOnly(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
  );

  return addDays(today, daysUntilNextSaturday);
}

export function getNextWorkWeekRange(baseDate = new Date()) {
  const weekStart = getNextWorkWeekStartDate(baseDate);
  const weekEndExclusive = addDays(weekStart, WORK_DAY_COUNT);

  return {
    weekStart,
    weekEndExclusive,
  };
}

export function getWorkWeekDays(weekStart: Date) {
  return WORK_DAYS.map((day) => {
    const date = addDays(weekStart, day.dayOfWeek);

    return {
      ...day,
      date,
      dateKey: toDateKey(date),
    };
  });
}

export function isWorkDay(dayOfWeek: number) {
  return dayOfWeek >= 0 && dayOfWeek < WORK_DAY_COUNT;
}