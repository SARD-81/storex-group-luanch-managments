import { AttendanceStatus } from "@/app/generated/prisma/client";
import type { CalendarAttendanceDatePolicy } from "@/lib/attendance/calendar-attendance-policy";
import { getAdminPlanWeekRange } from "@/lib/attendance/admin-weekly-summary";
import type { AdminWeeklyPlanCalendarDay } from "@/lib/attendance/admin-weekly-summary";
import {
  formatCalendarWeeklyPlanDayStatus,
  getCalendarWeeklyPlanWindow,
  type CalendarWeeklyPlanDay,
} from "@/lib/attendance/calendar-weekly-plan";
import {
  getAttendanceDeadline,
  canEditAttendance,
} from "@/lib/attendance/rules";
import {
  getAttendanceSelectableDateRange,
  getAttendanceDatePolicyByDateKey,
  getAttendanceDatePoliciesByDateRange,
} from "@/lib/attendance/calendar-attendance-policy";
import { parseDateKey, getDateKey } from "@/lib/date/date-key";
import { prisma } from "@/lib/prisma";

export type DashboardDatePickerPolicy = {
  dateKey: string;
  jalaliDateKey: string | null;
  dayNameFa: string | null;
  isSelectable: boolean;
  isWorkday: boolean | null;
  isWeeklyOffDay: boolean | null;
  isOfficialHoliday: boolean | null;
  isManualHoliday: boolean | null;
  isForcedWorkday: boolean | null;
  holidayTitle: string | null;
  eventCount: number;
  reasons: string[];
};

function mapAdminWeeklyPlanCalendarDay(
  day: CalendarWeeklyPlanDay,
): AdminWeeklyPlanCalendarDay {
  return {
    dateKey: day.dateKey,
    jalaliDateKey: day.jalaliDateKey,
    dayNameFa: day.dayNameFa,
    dayOfWeek: day.dayOfWeek,
    isWorkday: day.isWorkday,
    isWeeklyOffDay: day.isWeeklyOffDay,
    isOfficialHoliday: day.isOfficialHoliday,
    isManualHoliday: day.isManualHoliday,
    isForcedWorkday: day.isForcedWorkday,
    holidayTitle: day.holidayTitle,
    eventTitles: day.eventTitles,
    eventCount: day.eventCount,
    statusLabel: formatCalendarWeeklyPlanDayStatus(day),
  };
}

function mapDatePickerPolicy(
  policy: CalendarAttendanceDatePolicy,
): DashboardDatePickerPolicy {
  return {
    dateKey: policy.dateKey,
    jalaliDateKey: policy.jalaliDateKey,
    dayNameFa: policy.dayNameFa,
    isSelectable: policy.isSelectable,
    isWorkday: policy.isWorkday,
    isWeeklyOffDay: policy.isWeeklyOffDay,
    isOfficialHoliday: policy.isOfficialHoliday,
    isManualHoliday: policy.isManualHoliday,
    isForcedWorkday: policy.isForcedWorkday,
    holidayTitle: policy.holidayTitle,
    eventCount: policy.eventCount,
    reasons: policy.reasons,
  };
}

export async function getDefaultSelectedDateKey(now = new Date()) {
  const { todayDateKey, maxDateKey } = getAttendanceSelectableDateRange(now);
  const policies = await getAttendanceDatePoliciesByDateRange(
    prisma,
    todayDateKey,
    maxDateKey,
    now,
  );
  const firstSelectablePolicy = policies.find((policy) => policy.isSelectable);

  return firstSelectablePolicy?.dateKey ?? todayDateKey;
}

export async function resolveSelectedDate(dateParam?: string) {
  const parsed = dateParam ? parseDateKey(dateParam) : null;
  const now = new Date();

  if (parsed) {
    const dateKey = getDateKey(parsed);
    const policy = await getAttendanceDatePolicyByDateKey(prisma, dateKey, now);

    if (policy.isSelectable) {
      return {
        selectedDateKey: dateKey,
        selectedDate: parsed,
      };
    }
  }

  const selectedDateKey = await getDefaultSelectedDateKey(now);
  const selectedDate = parseDateKey(selectedDateKey) ?? now;

  return {
    selectedDateKey,
    selectedDate,
  };
}

export async function getAdminDashboardData(selectedDate: Date) {
  const now = new Date();
  const { weekStart, weekEndExclusive } = getAdminPlanWeekRange(now);
  const selectableRange = getAttendanceSelectableDateRange(now);
  const [
    users,
    attendances,
    weeklyPlanAttendances,
    datePickerPolicies,
    calendarWeeklyPlanWindow,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      include: {
        weeklyPreferences: {
          where: {
            isEnabled: true,
            dayOfWeek: { gte: 0, lte: 4 },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.mealAttendance.findMany({
      where: { date: selectedDate },
      include: { user: true },
      orderBy: [{ mealType: "asc" }, { user: { name: "asc" } }],
    }),
    prisma.mealAttendance.findMany({
      where: {
        date: { gte: weekStart, lt: weekEndExclusive },
        status: AttendanceStatus.PRESENT,
      },
      select: {
        userId: true,
        date: true,
        mealType: true,
        status: true,
      },
    }),
    getAttendanceDatePoliciesByDateRange(
      prisma,
      selectableRange.todayDateKey,
      selectableRange.maxDateKey,
      now,
    ),
    getCalendarWeeklyPlanWindow(prisma, now),
  ]);

  const selectedDateKey = getDateKey(selectedDate);
  const selectedDatePolicy = await getAttendanceDatePolicyByDateKey(
    prisma,
    selectedDateKey,
    now,
  );

  return {
    users,
    attendances,
    selectedDate,
    selectedDateKey,
    selectedDatePolicy,
    datePickerPolicies: datePickerPolicies.map(mapDatePickerPolicy),
    now,
    deadline: getAttendanceDeadline(selectedDate),
    canEditSelectedDate:
      selectedDatePolicy.isSelectable && canEditAttendance(selectedDate, now),
    weeklyPlanAttendances,
    adminPlanWeekStart: weekStart,
    adminPlanWeekEndExclusive: weekEndExclusive,
    adminPlanWindowLabel: calendarWeeklyPlanWindow.label,
    adminCalendarPlanDays: calendarWeeklyPlanWindow.days.map(
      mapAdminWeeklyPlanCalendarDay,
    ),
  };
}

export async function getUserDashboardData(userId: string, selectedDate: Date) {
  const now = new Date();
  const selectableRange = getAttendanceSelectableDateRange(now);
  const [users, attendances, datePickerPolicies] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        id: userId,
      },
      include: {
        weeklyPreferences: {
          where: {
            isEnabled: true,
            dayOfWeek: { gte: 0, lte: 4 },
          },
        },
      },
    }),
    prisma.mealAttendance.findMany({
      where: {
        userId,
        date: selectedDate,
      },
      include: { user: true },
      orderBy: [{ mealType: "asc" }],
    }),
    getAttendanceDatePoliciesByDateRange(
      prisma,
      selectableRange.todayDateKey,
      selectableRange.maxDateKey,
      now,
    ),
  ]);

  const selectedDateKey = getDateKey(selectedDate);
  const selectedDatePolicy = await getAttendanceDatePolicyByDateKey(
    prisma,
    selectedDateKey,
    now,
  );

  return {
    users,
    attendances,
    selectedDate,
    selectedDateKey,
    selectedDatePolicy,
    datePickerPolicies: datePickerPolicies.map(mapDatePickerPolicy),
    now,
    deadline: getAttendanceDeadline(selectedDate),
    canEditSelectedDate:
      selectedDatePolicy.isSelectable && canEditAttendance(selectedDate, now),
    weeklyPlanAttendances: [],
    adminPlanWeekStart: selectedDate,
    adminPlanWeekEndExclusive: selectedDate,
  };
}
