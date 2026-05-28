import type { PrismaClient } from "../../app/generated/prisma/client";

export type CalendarEventView = {
  eventKey: string | null;
  title: string;
  displayOrder: number;
  type: string;
  calendarType: string;
  isHoliday: boolean;
  isOfficial: boolean;
  referenceDate: string | null;
  description: string | null;
  sourceName: string | null;
  sourceVersion: string | null;
  sourcePage: number | null;
  sourceSection: string | null;
};

export type CalendarDayView = {
  id: string;
  dateKey: string;
  jalaliDateKey: string;
  jalaliYear: number;
  jalaliMonth: number;
  jalaliDay: number;
  dayOfWeek: number;
  dayNameFa: string;
  isWeeklyOffDay: boolean;
  isOfficialHoliday: boolean;
  isManualHoliday: boolean;
  isForcedWorkday: boolean;
  isWorkday: boolean;
  holidayTitle: string | null;
  description: string | null;
  events: CalendarEventView[];
};

export const IRAN_TIME_ZONE = "Asia/Tehran";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const calendarEventOrderBy = [{ displayOrder: "asc" as const }, { title: "asc" as const }];

const calendarDaySelect = {
  id: true,
  dateKey: true,
  jalaliDateKey: true,
  jalaliYear: true,
  jalaliMonth: true,
  jalaliDay: true,
  dayOfWeek: true,
  dayNameFa: true,
  isWeeklyOffDay: true,
  isOfficialHoliday: true,
  isManualHoliday: true,
  isForcedWorkday: true,
  isWorkday: true,
  holidayTitle: true,
  description: true,
  events: {
    select: {
      eventKey: true,
      title: true,
      displayOrder: true,
      type: true,
      calendarType: true,
      isHoliday: true,
      isOfficial: true,
      referenceDate: true,
      description: true,
      sourceName: true,
      sourceVersion: true,
      sourcePage: true,
      sourceSection: true,
    },
    orderBy: calendarEventOrderBy,
  },
};

type SelectedCalendarEvent = {
  eventKey: string | null;
  title: string;
  displayOrder: number;
  type: string;
  calendarType: string;
  isHoliday: boolean;
  isOfficial: boolean;
  referenceDate: string | null;
  description: string | null;
  sourceName: string | null;
  sourceVersion: string | null;
  sourcePage: number | null;
  sourceSection: string | null;
};

type SelectedCalendarDay = {
  id: string;
  dateKey: string;
  jalaliDateKey: string;
  jalaliYear: number;
  jalaliMonth: number;
  jalaliDay: number;
  dayOfWeek: number;
  dayNameFa: string;
  isWeeklyOffDay: boolean;
  isOfficialHoliday: boolean;
  isManualHoliday: boolean;
  isForcedWorkday: boolean;
  isWorkday: boolean;
  holidayTitle: string | null;
  description: string | null;
  events: SelectedCalendarEvent[];
};

export function getIranDateKeyFromDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: IRAN_TIME_ZONE,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to resolve Iran date key from formatted date parts.");
  }

  return `${year}-${month}-${day}`;
}

export function getTodayIranDateKey(now?: Date): string {
  return getIranDateKeyFromDate(now ?? new Date());
}

export async function getCalendarDayByDateKey(
  prisma: PrismaClient,
  dateKey: string,
): Promise<CalendarDayView | null> {
  assertDateKey(dateKey, "dateKey");

  const day = await prisma.calendarDay.findUnique({
    where: { dateKey },
    select: calendarDaySelect,
  });

  return day ? mapCalendarDayToView(day) : null;
}

export async function getCalendarDayByJalaliDateKey(
  prisma: PrismaClient,
  jalaliDateKey: string,
): Promise<CalendarDayView | null> {
  assertDateKey(jalaliDateKey, "jalaliDateKey");

  const day = await prisma.calendarDay.findUnique({
    where: { jalaliDateKey },
    select: calendarDaySelect,
  });

  return day ? mapCalendarDayToView(day) : null;
}

export async function getTodayCalendarDay(prisma: PrismaClient, now?: Date): Promise<CalendarDayView | null> {
  const dateKey = getTodayIranDateKey(now);
  return getCalendarDayByDateKey(prisma, dateKey);
}

export async function getCalendarDaysByDateRange(
  prisma: PrismaClient,
  startDateKey: string,
  endDateKey: string,
): Promise<CalendarDayView[]> {
  assertDateKey(startDateKey, "startDateKey");
  assertDateKey(endDateKey, "endDateKey");

  if (startDateKey > endDateKey) {
    throw new Error("startDateKey must be less than or equal to endDateKey.");
  }

  const days = await prisma.calendarDay.findMany({
    where: {
      dateKey: {
        gte: startDateKey,
        lte: endDateKey,
      },
    },
    select: calendarDaySelect,
    orderBy: { date: "asc" },
  });

  return days.map(mapCalendarDayToView);
}

export async function getCalendarDaysByJalaliMonth(
  prisma: PrismaClient,
  jalaliYear: number,
  jalaliMonth: number,
): Promise<CalendarDayView[]> {
  assertJalaliYear(jalaliYear);
  assertJalaliMonth(jalaliMonth);

  const days = await prisma.calendarDay.findMany({
    where: {
      jalaliYear,
      jalaliMonth,
    },
    select: calendarDaySelect,
    orderBy: { date: "asc" },
  });

  return days.map(mapCalendarDayToView);
}

export async function isWorkdayByDateKey(prisma: PrismaClient, dateKey: string): Promise<boolean> {
  const day = await getCalendarDayByDateKey(prisma, dateKey);

  if (!day) {
    throw new Error(`CalendarDay was not found for dateKey ${dateKey}.`);
  }

  return day.isWorkday;
}

export async function isWorkdayByJalaliDateKey(prisma: PrismaClient, jalaliDateKey: string): Promise<boolean> {
  const day = await getCalendarDayByJalaliDateKey(prisma, jalaliDateKey);

  if (!day) {
    throw new Error(`CalendarDay was not found for jalaliDateKey ${jalaliDateKey}.`);
  }

  return day.isWorkday;
}

function mapCalendarEventToView(event: SelectedCalendarEvent): CalendarEventView {
  return {
    eventKey: event.eventKey,
    title: event.title,
    displayOrder: event.displayOrder,
    type: event.type,
    calendarType: event.calendarType,
    isHoliday: event.isHoliday,
    isOfficial: event.isOfficial,
    referenceDate: event.referenceDate,
    description: event.description,
    sourceName: event.sourceName,
    sourceVersion: event.sourceVersion,
    sourcePage: event.sourcePage,
    sourceSection: event.sourceSection,
  };
}

function mapCalendarDayToView(day: SelectedCalendarDay): CalendarDayView {
  return {
    id: day.id,
    dateKey: day.dateKey,
    jalaliDateKey: day.jalaliDateKey,
    jalaliYear: day.jalaliYear,
    jalaliMonth: day.jalaliMonth,
    jalaliDay: day.jalaliDay,
    dayOfWeek: day.dayOfWeek,
    dayNameFa: day.dayNameFa,
    isWeeklyOffDay: day.isWeeklyOffDay,
    isOfficialHoliday: day.isOfficialHoliday,
    isManualHoliday: day.isManualHoliday,
    isForcedWorkday: day.isForcedWorkday,
    isWorkday: day.isWorkday,
    holidayTitle: day.holidayTitle,
    description: day.description,
    events: day.events.map(mapCalendarEventToView),
  };
}

function assertDateKey(value: string, label: string): void {
  if (!DATE_KEY_PATTERN.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD format.`);
  }
}

function assertJalaliYear(value: number): void {
  if (!Number.isInteger(value) || value < 1200 || value > 1700) {
    throw new Error("jalaliYear must be an integer between 1200 and 1700.");
  }
}

function assertJalaliMonth(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 12) {
    throw new Error("jalaliMonth must be an integer between 1 and 12.");
  }
}
