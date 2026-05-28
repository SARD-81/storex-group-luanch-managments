import type { PrismaClient } from "../../app/generated/prisma/client";
import { getAdminPlanWeekRange, getAdminPlanWindowLabel } from "./admin-weekly-summary";
import {
  getAttendanceDatePoliciesByDateRange,
  type CalendarAttendanceDatePolicy,
} from "./calendar-attendance-policy";
import { getDateKey } from "../date/date-key";

export type CalendarWeeklyPlanDay = {
  dateKey: string;
  jalaliDateKey: string | null;
  dayNameFa: string | null;
  dayOfWeek: number | null;
  isSelectable: boolean;
  isWorkday: boolean | null;
  isWeeklyOffDay: boolean | null;
  isOfficialHoliday: boolean | null;
  isManualHoliday: boolean | null;
  isForcedWorkday: boolean | null;
  holidayTitle: string | null;
  eventTitles: string[];
  eventCount: number;
  reasons: string[];
};

export type CalendarWeeklyPlanWindow = {
  label: string;
  weekStartDateKey: string;
  weekEndExclusiveDateKey: string;
  days: CalendarWeeklyPlanDay[];
  workdays: CalendarWeeklyPlanDay[];
  nonWorkdays: CalendarWeeklyPlanDay[];
};

export async function getCalendarWeeklyPlanWindow(
  prisma: PrismaClient,
  now?: Date,
): Promise<CalendarWeeklyPlanWindow> {
  const { weekStart, weekEndExclusive } = getAdminPlanWeekRange(now);
  const label = getAdminPlanWindowLabel(now);
  const weekStartDateKey = getDateKey(weekStart);
  const weekEndExclusiveDateKey = getDateKey(weekEndExclusive);
  const weekEndInclusiveDate = new Date(weekEndExclusive);
  weekEndInclusiveDate.setUTCDate(weekEndInclusiveDate.getUTCDate() - 1);
  const weekEndInclusiveDateKey = getDateKey(weekEndInclusiveDate);

  const policies = await getAttendanceDatePoliciesByDateRange(
    prisma,
    weekStartDateKey,
    weekEndInclusiveDateKey,
    now,
  );
  const days = policies.map(mapPolicyToCalendarWeeklyPlanDay);
  const workdays = days.filter((day) => day.isWorkday === true);
  const nonWorkdays = days.filter((day) => day.isWorkday !== true);

  return {
    label,
    weekStartDateKey,
    weekEndExclusiveDateKey,
    days,
    workdays,
    nonWorkdays,
  };
}

export async function getCalendarWeeklyPlanWorkDateKeys(prisma: PrismaClient, now?: Date): Promise<string[]> {
  const window = await getCalendarWeeklyPlanWindow(prisma, now);
  return window.workdays.map((day) => day.dateKey);
}

export function formatCalendarWeeklyPlanDayStatus(day: CalendarWeeklyPlanDay): string {
  if (day.isWorkday === true) {
    return "روز کاری";
  }

  if (day.isOfficialHoliday === true && day.holidayTitle) {
    return `تعطیل رسمی: ${day.holidayTitle}`;
  }

  if (day.isOfficialHoliday === true) {
    return "تعطیل رسمی";
  }

  if (day.isWeeklyOffDay === true) {
    return "تعطیلی هفتگی";
  }

  if (day.isManualHoliday === true) {
    return "تعطیلی دستی";
  }

  return "غیرکاری";
}

function mapPolicyToCalendarWeeklyPlanDay(policy: CalendarAttendanceDatePolicy): CalendarWeeklyPlanDay {
  const eventTitles = policy.calendarDay?.events.map((event) => event.title) ?? [];

  return {
    dateKey: policy.dateKey,
    jalaliDateKey: policy.jalaliDateKey,
    dayNameFa: policy.dayNameFa,
    dayOfWeek: policy.calendarDay?.dayOfWeek ?? null,
    isSelectable: policy.isSelectable,
    isWorkday: policy.isWorkday,
    isWeeklyOffDay: policy.isWeeklyOffDay,
    isOfficialHoliday: policy.isOfficialHoliday,
    isManualHoliday: policy.isManualHoliday,
    isForcedWorkday: policy.isForcedWorkday,
    holidayTitle: policy.holidayTitle,
    eventTitles,
    eventCount: policy.eventCount,
    reasons: policy.reasons,
  };
}
