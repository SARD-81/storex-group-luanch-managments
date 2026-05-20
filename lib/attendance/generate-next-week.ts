import { AttendanceStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { addDays, getNextWeekRange } from "@/lib/attendance/week";

export async function generateNextWeekAttendance() {
  const { weekStart, weekEndExclusive } = getNextWeekRange();

  const preferences = await prisma.weeklyMealPreference.findMany({
    where: {
      isEnabled: true,
      user: {
        isActive: true,
      },
    },
    select: {
      userId: true,
      dayOfWeek: true,
      mealType: true,
    },
  });

  const attendanceRows = preferences.map((preference) => ({
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