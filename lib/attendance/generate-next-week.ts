import { AttendanceStatus, UserRole } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  getNextWorkWeekRange,
  isWorkDay,
} from "@/lib/attendance/week";

export async function generateNextWeekAttendance() {
  const { weekStart, weekEndExclusive } = getNextWorkWeekRange();

  const preferences = await prisma.weeklyMealPreference.findMany({
    where: {
      isEnabled: true,
      dayOfWeek: {
        gte: 0,
        lte: 4,
      },
      user: {
        isActive: true,
        role: { not: UserRole.REPORTER },
      },
    },
    select: {
      userId: true,
      dayOfWeek: true,
      mealType: true,
    },
  });

  const attendanceRows = preferences
    .filter((preference) => isWorkDay(preference.dayOfWeek))
    .map((preference) => ({
      userId: preference.userId,
      date: addDays(weekStart, preference.dayOfWeek),
      mealType: preference.mealType,
      status: AttendanceStatus.PRESENT,
      generatedFromWeeklyPlan: true,
      manuallyEdited: false,
    }));

  if (attendanceRows.length === 0) {
    return {
      attempted: 0,
      created: 0,
      weekStart,
      weekEndExclusive,
    };
  }

  const result = await prisma.mealAttendance.createMany({
    data: attendanceRows,
    skipDuplicates: true,
  });

  return {
    attempted: attendanceRows.length,
    created: result.count,
    weekStart,
    weekEndExclusive,
  };
}