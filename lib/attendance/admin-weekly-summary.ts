import { AttendanceStatus, MealType } from "@/app/generated/prisma/client";
import { MEAL_LABELS } from "@/lib/attendance/meals";
import { getAppDayOfWeekFromDate } from "@/lib/attendance/rules";
import { addDays, getWorkWeekStartDate, WORK_DAYS } from "@/lib/attendance/week";

type WeeklyPreference = {
  dayOfWeek: number;
  mealType: MealType;
  isEnabled: boolean;
};

type WeeklyAttendance = {
  date: Date;
  mealType: MealType;
  status: AttendanceStatus;
};

export function shouldShowNextWeekPlan(now = new Date()) {
  const day = getAppDayOfWeekFromDate(now);

  return day === 5 || day === 6;
}

export function getAdminPlanWindowLabel(now = new Date()) {
  return shouldShowNextWeekPlan(now) ? "برنامه هفته آینده" : "برنامه هفته جاری";
}

export function getAdminPlanWeekRange(now = new Date()) {
  const currentWeekStart = getWorkWeekStartDate(now);
  const weekStart = shouldShowNextWeekPlan(now) ? addDays(currentWeekStart, 7) : currentWeekStart;
  const weekEndExclusive = addDays(weekStart, 5);

  return { weekStart, weekEndExclusive };
}

export function formatUserAdminWeeklyPlan({
  weeklyAttendances,
  weeklyPreferences,
  weekStart,
}: {
  weeklyAttendances: WeeklyAttendance[];
  weeklyPreferences: WeeklyPreference[];
  weekStart: Date;
}) {
  const presentAttendances = weeklyAttendances.filter((attendance) => attendance.status === AttendanceStatus.PRESENT);

  if (presentAttendances.length > 0) {
    return WORK_DAYS.map(({ dayOfWeek, label }) => {
      const dayDate = addDays(weekStart, dayOfWeek);
      const meals = presentAttendances
        .filter((attendance) => attendance.date.getTime() === dayDate.getTime())
        .map((attendance) => MEAL_LABELS[attendance.mealType]);

      return `${label}: ${meals.length > 0 ? meals.join("، ") : "—"}`;
    }).join(" | ");
  }

  const enabledPreferences = weeklyPreferences.filter((preference) => preference.isEnabled);

  if (enabledPreferences.length === 0) {
    return "برنامه‌ای ثبت نشده است";
  }

  return WORK_DAYS.map(({ dayOfWeek, label }) => {
    const meals = enabledPreferences
      .filter((preference) => preference.dayOfWeek === dayOfWeek)
      .map((preference) => MEAL_LABELS[preference.mealType]);

    return `${label}: ${meals.length > 0 ? meals.join("، ") : "—"}`;
  }).join(" | ");
}
