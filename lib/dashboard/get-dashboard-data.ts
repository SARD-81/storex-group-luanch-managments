import { AttendanceStatus } from "@/app/generated/prisma/client";
import { getAdminPlanWeekRange } from "@/lib/attendance/admin-weekly-summary";
import { getAttendanceDeadline, canEditAttendance } from "@/lib/attendance/rules";
import {
  getAttendanceSelectableDateRange,
  getAttendanceDatePolicyByDateKey,
  getAttendanceDatePoliciesByDateRange,
} from "@/lib/attendance/calendar-attendance-policy";
import { parseDateKey, getDateKey } from "@/lib/date/date-key";
import { prisma } from "@/lib/prisma";

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
  const [users, attendances, weeklyPlanAttendances] = await Promise.all([
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
    now,
    deadline: getAttendanceDeadline(selectedDate),
    canEditSelectedDate:
      selectedDatePolicy.isSelectable && canEditAttendance(selectedDate, now),
    weeklyPlanAttendances,
    adminPlanWeekStart: weekStart,
    adminPlanWeekEndExclusive: weekEndExclusive,
  };
}

export async function getUserDashboardData(userId: string, selectedDate: Date) {
  const now = new Date();
  const [users, attendances] = await Promise.all([
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
    now,
    deadline: getAttendanceDeadline(selectedDate),
    canEditSelectedDate:
      selectedDatePolicy.isSelectable && canEditAttendance(selectedDate, now),
    weeklyPlanAttendances: [],
    adminPlanWeekStart: selectedDate,
    adminPlanWeekEndExclusive: selectedDate,
  };
}
