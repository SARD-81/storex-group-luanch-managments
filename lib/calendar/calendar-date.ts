import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";

export const APP_DAY_NAMES_FA = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"] as const;

export type AppDayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type BaseCalendarDayInput = {
  date: Date;
  dateKey: string;
  gregorianYear: number;
  gregorianMonth: number;
  gregorianDay: number;
  jalaliYear: number;
  jalaliMonth: number;
  jalaliDay: number;
  jalaliDateKey: string;
  dayOfWeek: AppDayOfWeek;
  dayNameFa: string;
};

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function createUtcDateOnly(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

export function getGregorianDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getGregorianParts(date: Date): { year: number; month: number; day: number; dateKey: string } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  return {
    year,
    month,
    day,
    dateKey: getGregorianDateKey(date),
  };
}

export function getAppDayOfWeekFromUtcDate(date: Date): AppDayOfWeek {
  return ((date.getUTCDay() + 1) % 7) as AppDayOfWeek;
}

export function getAppDayNameFa(dayOfWeek: AppDayOfWeek): string {
  return APP_DAY_NAMES_FA[dayOfWeek];
}

export function jalaliToUtcDateOnly(year: number, month: number, day: number): Date {
  const dateObject = new DateObject({
    calendar: persian,
    year,
    month,
    day,
  });

  const date = dateObject.toDate();
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

export function getJalaliPartsFromUtcDate(date: Date): { year: number; month: number; day: number; dateKey: string } {
  const localDateOnly = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

  const jalaliDateObject = new DateObject({
    date: localDateOnly,
    calendar: persian,
  });

  const year = Number(jalaliDateObject.year);
  const month = Number(jalaliDateObject.month.number);
  const day = Number(jalaliDateObject.day);

  return {
    year,
    month,
    day,
    dateKey: `${year}-${pad2(month)}-${pad2(day)}`,
  };
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function buildBaseJalaliYearDays(jalaliYear: number): BaseCalendarDayInput[] {
  if (!Number.isInteger(jalaliYear) || jalaliYear < 1200 || jalaliYear > 1700) {
    throw new Error("Jalali year must be an integer between 1200 and 1700.");
  }

  const startDate = jalaliToUtcDateOnly(jalaliYear, 1, 1);
  const endDateExclusive = jalaliToUtcDateOnly(jalaliYear + 1, 1, 1);

  const rows: BaseCalendarDayInput[] = [];

  for (let cursor = startDate; cursor < endDateExclusive; cursor = addUtcDays(cursor, 1)) {
    const gregorian = getGregorianParts(cursor);
    const jalali = getJalaliPartsFromUtcDate(cursor);

    if (jalali.year !== jalaliYear) {
      throw new Error(
        `Generated day has unexpected Jalali year ${jalali.year} for Gregorian date ${gregorian.dateKey}. Expected ${jalaliYear}.`,
      );
    }

    const dayOfWeek = getAppDayOfWeekFromUtcDate(cursor);

    rows.push({
      date: createUtcDateOnly(gregorian.year, gregorian.month, gregorian.day),
      dateKey: gregorian.dateKey,
      gregorianYear: gregorian.year,
      gregorianMonth: gregorian.month,
      gregorianDay: gregorian.day,
      jalaliYear: jalali.year,
      jalaliMonth: jalali.month,
      jalaliDay: jalali.day,
      jalaliDateKey: jalali.dateKey,
      dayOfWeek,
      dayNameFa: getAppDayNameFa(dayOfWeek),
    });
  }

  return rows;
}
