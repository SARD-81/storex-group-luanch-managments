import { AttendanceStatus, MealType } from "@/app/generated/prisma/client";
import { getCurrentJalaliMonthDays } from "@/lib/attendance/month";
import { prisma } from "@/lib/prisma";

export async function getUserCurrentMonthAttendanceData(userId: string) {
const { monthStart, nextMonthStart, days } = getCurrentJalaliMonthDays();

  const attendances = await prisma.mealAttendance.findMany({
    where: {
      userId,
      date: {
        gte: monthStart,
        lt: nextMonthStart,
      },
    },
    select: {
      date: true,
      mealType: true,
      status: true,
    },
  });

  const attendanceMap = new Map<string, Map<MealType, AttendanceStatus>>();

  for (const attendance of attendances) {
    const dateKey = attendance.date.toISOString().slice(0, 10);
    const byMeal = attendanceMap.get(dateKey) ?? new Map<MealType, AttendanceStatus>();
    byMeal.set(attendance.mealType, attendance.status);
    attendanceMap.set(dateKey, byMeal);
  }

  return days.map((day) => {
    const meals = attendanceMap.get(day.dateKey);

    return {
      ...day,
      breakfastStatus: meals?.get(MealType.BREAKFAST) ?? AttendanceStatus.ABSENT,
      lunchStatus: meals?.get(MealType.LUNCH) ?? AttendanceStatus.ABSENT,
    };
  });
}
