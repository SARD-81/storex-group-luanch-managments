import { AttendanceStatus } from "@/app/generated/prisma/client";
import { getAdminPlanWeekRange } from "@/lib/attendance/admin-weekly-summary";
import { getAttendanceDeadline, canEditAttendance, isSelectableAttendanceDate } from "@/lib/attendance/rules";
import { addDays } from "@/lib/attendance/week";
import { parseDateKey, getDateKey } from "@/lib/date/date-key";
import { prisma } from "@/lib/prisma";

export function getDefaultSelectedDateKey(now = new Date()) {
  if (isSelectableAttendanceDate(now, now)) {
    return getDateKey(now);
  }

  for (let dayOffset = 1; dayOffset <= 31; dayOffset += 1) {
    const candidate = addDays(now, dayOffset);
    if (isSelectableAttendanceDate(candidate, now)) {
      return getDateKey(candidate);
    }
  }

  return getDateKey(now);
}

export function resolveSelectedDate(dateParam?: string) {
  const parsed = dateParam ? parseDateKey(dateParam) : null;
  const now = new Date();

  if (parsed && isSelectableAttendanceDate(parsed, now)) {
    return {
      selectedDateKey: getDateKey(parsed),
      selectedDate: parsed,
    };
  }

  const selectedDateKey = getDefaultSelectedDateKey(now);
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

  return {
    users,
    attendances,
    selectedDate,
    selectedDateKey: getDateKey(selectedDate),
    now,
    deadline: getAttendanceDeadline(selectedDate),
    canEditSelectedDate: canEditAttendance(selectedDate, now),
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

  return {
    users,
    attendances,
    selectedDate,
    selectedDateKey: getDateKey(selectedDate),
    now,
    deadline: getAttendanceDeadline(selectedDate),
    canEditSelectedDate: canEditAttendance(selectedDate, now),
    weeklyPlanAttendances: [],
    adminPlanWeekStart: selectedDate,
    adminPlanWeekEndExclusive: selectedDate,
  };
}
