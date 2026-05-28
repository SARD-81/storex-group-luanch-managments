import type { PrismaClient } from "../../app/generated/prisma/client";
import {
  type CalendarDayView,
  getTodayIranDateKey,
  getCalendarDayByDateKey,
  getCalendarDayByJalaliDateKey,
  getCalendarDaysByDateRange,
} from "../calendar/calendar-service";

export type AttendanceDatePolicyReason =
  | "AVAILABLE"
  | "OUT_OF_SELECTABLE_RANGE"
  | "CALENDAR_DAY_NOT_FOUND"
  | "NON_WORKDAY";

export type AttendanceSelectableDateRange = {
  todayDateKey: string;
  maxDateKey: string;
};

export type CalendarAttendanceDatePolicy = {
  dateKey: string;
  jalaliDateKey: string | null;
  dayNameFa: string | null;
  isSelectable: boolean;
  isWithinSelectableRange: boolean;
  isWorkday: boolean | null;
  isWeeklyOffDay: boolean | null;
  isOfficialHoliday: boolean | null;
  isManualHoliday: boolean | null;
  isForcedWorkday: boolean | null;
  holidayTitle: string | null;
  eventCount: number;
  reasons: AttendanceDatePolicyReason[];
  calendarDay: CalendarDayView | null;
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getAttendanceSelectableDateRange(now?: Date): AttendanceSelectableDateRange {
  const todayDateKey = getTodayIranDateKey(now);

  return {
    todayDateKey,
    maxDateKey: addOneCalendarMonthToDateKey(todayDateKey),
  };
}

export function isDateKeyWithinAttendanceSelectableRange(dateKey: string, now?: Date): boolean {
  assertDateKey(dateKey, "dateKey");

  const { todayDateKey, maxDateKey } = getAttendanceSelectableDateRange(now);
  return dateKey >= todayDateKey && dateKey <= maxDateKey;
}

export async function getAttendanceDatePolicyByDateKey(
  prisma: PrismaClient,
  dateKey: string,
  now?: Date,
): Promise<CalendarAttendanceDatePolicy> {
  assertDateKey(dateKey, "dateKey");

  const day = await getCalendarDayByDateKey(prisma, dateKey);
  return day ? buildPolicyFromCalendarDay(day, now) : buildMissingCalendarDayPolicy(dateKey, now);
}

export async function getAttendanceDatePolicyByJalaliDateKey(
  prisma: PrismaClient,
  jalaliDateKey: string,
  now?: Date,
): Promise<CalendarAttendanceDatePolicy> {
  assertDateKey(jalaliDateKey, "jalaliDateKey");

  const day = await getCalendarDayByJalaliDateKey(prisma, jalaliDateKey);
  return day ? buildPolicyFromCalendarDay(day, now) : buildMissingCalendarDayPolicy(jalaliDateKey, now);
}

export async function canSelectAttendanceDateByDateKey(
  prisma: PrismaClient,
  dateKey: string,
  now?: Date,
): Promise<boolean> {
  const policy = await getAttendanceDatePolicyByDateKey(prisma, dateKey, now);
  return policy.isSelectable;
}

export async function canSelectAttendanceDateByJalaliDateKey(
  prisma: PrismaClient,
  jalaliDateKey: string,
  now?: Date,
): Promise<boolean> {
  const policy = await getAttendanceDatePolicyByJalaliDateKey(prisma, jalaliDateKey, now);
  return policy.isSelectable;
}

export async function getAttendanceDatePoliciesByDateRange(
  prisma: PrismaClient,
  startDateKey: string,
  endDateKey: string,
  now?: Date,
): Promise<CalendarAttendanceDatePolicy[]> {
  assertDateKey(startDateKey, "startDateKey");
  assertDateKey(endDateKey, "endDateKey");

  if (startDateKey > endDateKey) {
    throw new Error("startDateKey must be less than or equal to endDateKey.");
  }

  const days = await getCalendarDaysByDateRange(prisma, startDateKey, endDateKey);
  return days.map((day) => buildPolicyFromCalendarDay(day, now));
}

function assertDateKey(value: string, label: string): void {
  if (!DATE_KEY_PATTERN.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD format.`);
  }

  parseDateKeyToUtcDate(value);
}

function parseDateKeyToUtcDate(value: string): Date {
  if (!DATE_KEY_PATTERN.test(value)) {
    throw new Error("date key must use YYYY-MM-DD format.");
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date key: ${value}.`);
  }

  return date;
}

function formatUtcDateKey(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addOneCalendarMonthToDateKey(dateKey: string): string {
  const date = parseDateKeyToUtcDate(dateKey);
  date.setUTCMonth(date.getUTCMonth() + 1);

  return formatUtcDateKey(date);
}

function buildPolicyFromCalendarDay(day: CalendarDayView, now?: Date): CalendarAttendanceDatePolicy {
  const isWithinSelectableRange = isDateKeyWithinAttendanceSelectableRange(day.dateKey, now);
  const isSelectable = isWithinSelectableRange && day.isWorkday;
  const reasons: AttendanceDatePolicyReason[] = [];

  if (isSelectable) {
    reasons.push("AVAILABLE");
  } else {
    if (!isWithinSelectableRange) {
      reasons.push("OUT_OF_SELECTABLE_RANGE");
    }

    if (!day.isWorkday) {
      reasons.push("NON_WORKDAY");
    }
  }

  return {
    dateKey: day.dateKey,
    jalaliDateKey: day.jalaliDateKey,
    dayNameFa: day.dayNameFa,
    isSelectable,
    isWithinSelectableRange,
    isWorkday: day.isWorkday,
    isWeeklyOffDay: day.isWeeklyOffDay,
    isOfficialHoliday: day.isOfficialHoliday,
    isManualHoliday: day.isManualHoliday,
    isForcedWorkday: day.isForcedWorkday,
    holidayTitle: day.holidayTitle,
    eventCount: day.events.length,
    reasons,
    calendarDay: day,
  };
}

function buildMissingCalendarDayPolicy(dateKey: string, now?: Date): CalendarAttendanceDatePolicy {
  const isWithinSelectableRange = isDateKeyWithinAttendanceSelectableRange(dateKey, now);
  const reasons: AttendanceDatePolicyReason[] = ["CALENDAR_DAY_NOT_FOUND"];

  if (!isWithinSelectableRange) {
    reasons.push("OUT_OF_SELECTABLE_RANGE");
  }

  return {
    dateKey,
    jalaliDateKey: null,
    dayNameFa: null,
    isSelectable: false,
    isWithinSelectableRange,
    isWorkday: null,
    isWeeklyOffDay: null,
    isOfficialHoliday: null,
    isManualHoliday: null,
    isForcedWorkday: null,
    holidayTitle: null,
    eventCount: 0,
    reasons,
    calendarDay: null,
  };
}
