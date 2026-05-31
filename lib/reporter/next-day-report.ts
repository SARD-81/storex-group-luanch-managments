import {
  AttendanceStatus,
  MealType,
  UserRole,
} from "@/app/generated/prisma/client";
import { getAttendanceDatePolicyByDateKey } from "@/lib/attendance/calendar-attendance-policy";
import { MEAL_LABELS, MEAL_TYPES } from "@/lib/attendance/meals";
import { getTodayIranDateKey } from "@/lib/calendar/calendar-service";
import { getDateKey, parseDateKey } from "@/lib/date/date-key";
import { formatPersianWeekdayDate } from "@/lib/date/persian-format";

import { prisma } from "@/lib/prisma";

function formatPersianNumber(value: number) {
  return new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(value);
}

function createGuestLabels(count: number) {
  return Array.from({ length: count }, (_, index) =>
    `مهمان ${formatPersianNumber(index + 1)}`,
  );
}

export function addOneUtcCalendarDayToDateKey(dateKey: string) {
  const date = parseDateKey(dateKey);

  if (!date) {
    throw new Error("Invalid date key.");
  }

  date.setUTCDate(date.getUTCDate() + 1);
  return getDateKey(date);
}

export async function getNextDayMealReport() {
  const todayIranDateKey = getTodayIranDateKey();
  const reportDateKey = addOneUtcCalendarDayToDateKey(todayIranDateKey);
  const reportDate = parseDateKey(reportDateKey);

  if (!reportDate) {
    throw new Error("Unable to resolve next-day report date.");
  }

  const [policy, attendances, guestOrders] = await Promise.all([
    getAttendanceDatePolicyByDateKey(prisma, reportDateKey),
    prisma.mealAttendance.findMany({
      where: {
        date: reportDate,
        status: AttendanceStatus.PRESENT,
        user: {
          isActive: true,
          role: { not: UserRole.REPORTER },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
      orderBy: [{ mealType: "asc" }, { user: { name: "asc" } }],
    }),
    prisma.guestMealOrder.findMany({
      where: { date: reportDate },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
      orderBy: [{ mealType: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const reportDateLabel = policy.jalaliDateKey
    ? `${policy.dayNameFa ?? ""} ${policy.jalaliDateKey}`.trim()
    : formatPersianWeekdayDate(reportDate);

  const meals = MEAL_TYPES.map((mealType) => {
    const employeeNames = attendances
      .filter((attendance) => attendance.mealType === mealType)
      .map((attendance) => attendance.user.name);
    const mealGuestOrders = guestOrders.filter(
      (order) => order.mealType === mealType,
    );
    const guestCount = mealGuestOrders.reduce(
      (sum, order) => sum + order.count,
      0,
    );
    const employeeCount = employeeNames.length;

    return {
      mealType,
      mealLabel: MEAL_LABELS[mealType],
      employeeCount,
      guestCount,
      totalCount: employeeCount + guestCount,
      employeeNames,
      guestLabels: createGuestLabels(guestCount),
    };
  });

  const totals = meals.reduce(
    (acc, meal) => ({
      employeeMeals: acc.employeeMeals + meal.employeeCount,
      guestMeals: acc.guestMeals + meal.guestCount,
      allMeals: acc.allMeals + meal.totalCount,
    }),
    { employeeMeals: 0, guestMeals: 0, allMeals: 0 },
  );

  return {
    reportDate,
    reportDateKey,
    reportDateLabel,
    policy,
    meals,
    totals,
  };
}

export const REPORTER_MEAL_TYPES = [MealType.BREAKFAST, MealType.LUNCH] as const;
