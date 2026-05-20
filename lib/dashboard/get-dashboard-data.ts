import { prisma } from "@/lib/prisma";
import { getNextWorkWeekRange } from "@/lib/attendance/week";

export async function getAdminDashboardData() {
  const { weekStart, weekEndExclusive } = getNextWorkWeekRange();

  const [users, attendances] = await Promise.all([
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
      where: {
        date: {
          gte: weekStart,
          lt: weekEndExclusive,
        },
      },
      include: { user: true },
      orderBy: [{ date: "asc" }, { mealType: "asc" }],
    }),
  ]);

  return {
    users,
    attendances,
    weekStart,
    weekEndExclusive,
  };
}

export async function getUserDashboardData(userId: string) {
  const { weekStart, weekEndExclusive } = getNextWorkWeekRange();

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
      orderBy: { createdAt: "asc" },
    }),
    prisma.mealAttendance.findMany({
      where: {
        userId,
        date: {
          gte: weekStart,
          lt: weekEndExclusive,
        },
      },
      include: { user: true },
      orderBy: [{ date: "asc" }, { mealType: "asc" }],
    }),
  ]);

  return {
    users,
    attendances,
    weekStart,
    weekEndExclusive,
  };
}