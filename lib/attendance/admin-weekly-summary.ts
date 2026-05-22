import { MealType } from "@/app/generated/prisma/client";
import { MEAL_LABELS } from "@/lib/attendance/meals";
import { getAppDayOfWeekFromDate } from "@/lib/attendance/rules";
import { WORK_DAYS } from "@/lib/attendance/week";

type WeeklyPreference = {
  dayOfWeek: number;
  mealType: MealType;
  isEnabled: boolean;
};

export function shouldShowNextWeekPlan(now = new Date()) {
  const day = getAppDayOfWeekFromDate(now);

  return day === 5 || day === 6;
}

export function getAdminPlanWindowLabel(now = new Date()) {
  return shouldShowNextWeekPlan(now) ? "برنامه هفته آینده" : "برنامه هفته جاری";
}

export function formatUserWeeklyMealPlan(weeklyPreferences: WeeklyPreference[]) {
  const enabledPreferences = weeklyPreferences.filter((preference) => preference.isEnabled);

  if (enabledPreferences.length === 0) {
    return "برنامه‌ای ثبت نشده است";
  }

  const planByDay = WORK_DAYS.map(({ dayOfWeek, label }) => {
    const meals = enabledPreferences
      .filter((preference) => preference.dayOfWeek === dayOfWeek)
      .map((preference) => MEAL_LABELS[preference.mealType]);

    return `${label}: ${meals.length > 0 ? meals.join("، ") : "—"}`;
  });

  return planByDay.join(" | ");
}
