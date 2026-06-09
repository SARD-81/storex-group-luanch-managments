import {
  AttendanceStatus,
  MealType,
  UserRole,
} from "@/app/generated/prisma/client";
import { getAttendanceDatePolicyByDateKey } from "@/lib/attendance/calendar-attendance-policy";
import { MEAL_LABELS, MEAL_TYPES } from "@/lib/attendance/meals";
import { getTodayIranDateKey } from "@/lib/calendar/calendar-service";
import { getDateKey, parseDateKey } from "@/lib/date/date-key";
import { formatPersianDate } from "@/lib/date/persian-format";

import { prisma } from "@/lib/prisma";

type ReportMealType = (typeof MealType)[keyof typeof MealType];

const SYSTEM_ADMIN_USERNAME = "admin";
const SYSTEM_ADMIN_NAME = "مدیر سیستم";

export type NextDayReportPeopleRow = {
  userId: string;
  name: string;
  username: string;
  breakfastPresent: boolean;
  lunchPresent: boolean;
};

export type NextDayReportMealSummary = {
  mealType: ReportMealType;
  mealLabel: string;
  employeeCount: number;
  guestCount: number;
  totalCount: number;
  employeeNames: string[];
  guestLabels: string[];
};

export type NextDayReportGuestCounts = {
  breakfast: number;
  lunch: number;
};

export type NextDayReportTotals = {
  breakfastEmployees: number;
  lunchEmployees: number;
  breakfastGuests: number;
  lunchGuests: number;
  breakfastAll: number;
  lunchAll: number;
  allMeals: number;
  employeeMeals: number;
  guestMeals: number;
};

export type NextDayMealReport = {
  reportDate: Date;
  reportDateKey: string;
  reportDateLabel: string;
  policy: Awaited<ReturnType<typeof getAttendanceDatePolicyByDateKey>>;
  peopleRows: NextDayReportPeopleRow[];
  guestCounts: NextDayReportGuestCounts;
  totals: NextDayReportTotals;
  meals: NextDayReportMealSummary[];
};

function formatPersianNumber(value: number) {
  return new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(value);
}

function createGuestLabels(count: number) {
  return Array.from({ length: count }, (_, index) =>
    `مهمان ${formatPersianNumber(index + 1)}`,
  );
}

function buildMealSummary(
  mealType: ReportMealType,
  peopleRows: NextDayReportPeopleRow[],
  guestCount: number,
) {
  const employeeNames = peopleRows
    .filter((row) =>
      mealType === MealType.BREAKFAST ? row.breakfastPresent : row.lunchPresent,
    )
    .map((row) => row.name);

  return {
    mealType,
    mealLabel: MEAL_LABELS[mealType],
    employeeCount: employeeNames.length,
    guestCount,
    totalCount: employeeNames.length + guestCount,
    employeeNames,
    guestLabels: createGuestLabels(guestCount),
  } satisfies NextDayReportMealSummary;
}

export function addOneUtcCalendarDayToDateKey(dateKey: string) {
  const date = parseDateKey(dateKey);

  if (!date) {
    throw new Error("Invalid date key.");
  }

  date.setUTCDate(date.getUTCDate() + 1);
  return getDateKey(date);
}

export async function getNextDayMealReport(): Promise<NextDayMealReport> {
  const todayIranDateKey = getTodayIranDateKey();
  const reportDateKey = addOneUtcCalendarDayToDateKey(todayIranDateKey);
  const reportDate = parseDateKey(reportDateKey);

  if (!reportDate) {
    throw new Error("Unable to resolve next-day report date.");
  }

  const [policy, users, attendances, guestOrders] = await Promise.all([
    getAttendanceDatePolicyByDateKey(prisma, reportDateKey),
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { not: UserRole.REPORTER },
        NOT: [{ username: SYSTEM_ADMIN_USERNAME }, { name: SYSTEM_ADMIN_NAME }],
      },
      select: {
        id: true,
        name: true,
        username: true,
      },
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    }),
    prisma.mealAttendance.findMany({
      where: {
        date: reportDate,
        status: AttendanceStatus.PRESENT,
        user: {
          isActive: true,
          role: { not: UserRole.REPORTER },
          NOT: [{ username: SYSTEM_ADMIN_USERNAME }, { name: SYSTEM_ADMIN_NAME }],
        },
      },
      select: {
        userId: true,
        mealType: true,
      },
    }),
    prisma.guestMealOrder.findMany({
      where: { date: reportDate },
      select: {
        mealType: true,
        count: true,
      },
      orderBy: [{ mealType: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const reportDateLabel = formatPersianDate(reportDate);

  const attendanceByUserId = new Map<
    string,
    { breakfastPresent: boolean; lunchPresent: boolean }
  >();

  for (const attendance of attendances) {
    const existing = attendanceByUserId.get(attendance.userId) ?? {
      breakfastPresent: false,
      lunchPresent: false,
    };

    if (attendance.mealType === MealType.BREAKFAST) {
      existing.breakfastPresent = true;
    }

    if (attendance.mealType === MealType.LUNCH) {
      existing.lunchPresent = true;
    }

    attendanceByUserId.set(attendance.userId, existing);
  }

  const peopleRows: NextDayReportPeopleRow[] = users.map((user) => {
    const attendance = attendanceByUserId.get(user.id) ?? {
      breakfastPresent: false,
      lunchPresent: false,
    };

    return {
      userId: user.id,
      name: user.name,
      username: user.username,
      breakfastPresent: attendance.breakfastPresent,
      lunchPresent: attendance.lunchPresent,
    };
  });

  const guestCounts = {
    breakfast: guestOrders
      .filter((order) => order.mealType === MealType.BREAKFAST)
      .reduce((sum, order) => sum + order.count, 0),
    lunch: guestOrders
      .filter((order) => order.mealType === MealType.LUNCH)
      .reduce((sum, order) => sum + order.count, 0),
  } satisfies NextDayReportGuestCounts;

  const breakfastEmployees = peopleRows.filter((row) => row.breakfastPresent).length;
  const lunchEmployees = peopleRows.filter((row) => row.lunchPresent).length;
  const guestMeals = guestCounts.breakfast + guestCounts.lunch;
  const employeeMeals = breakfastEmployees + lunchEmployees;

  const totals = {
    breakfastEmployees,
    lunchEmployees,
    breakfastGuests: guestCounts.breakfast,
    lunchGuests: guestCounts.lunch,
    breakfastAll: breakfastEmployees + guestCounts.breakfast,
    lunchAll: lunchEmployees + guestCounts.lunch,
    allMeals: employeeMeals + guestMeals,
    employeeMeals,
    guestMeals,
  } satisfies NextDayReportTotals;

  const meals = MEAL_TYPES.map((mealType) =>
    buildMealSummary(
      mealType,
      peopleRows,
      mealType === MealType.BREAKFAST ? guestCounts.breakfast : guestCounts.lunch,
    ),
  );

  return {
    reportDate,
    reportDateKey,
    reportDateLabel,
    policy,
    peopleRows,
    guestCounts,
    totals,
    meals,
  };
}

export const REPORTER_MEAL_TYPES = [MealType.BREAKFAST, MealType.LUNCH] as const;
