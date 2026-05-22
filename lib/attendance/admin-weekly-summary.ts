import { AttendanceStatus, MealType } from "@/app/generated/prisma/client";
import { MEAL_LABELS } from "@/lib/attendance/meals";
import { getAppDayOfWeekFromDate } from "@/lib/attendance/rules";
import { addDays, WORK_DAYS } from "@/lib/attendance/week";
import { getDateKey, parseDateKey } from "@/lib/date/date-key";
import { getTehranDateKey } from "@/lib/date/tehran-time";

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

function getTodayDateOnly(now = new Date()) {
  const tehranDateKey = getTehranDateKey(now);
  const parsedDate = parseDateKey(tehranDateKey);

  return parsedDate ?? now;
}

export function shouldShowNextWeekPlan(now = new Date()) {
  const today = getTodayDateOnly(now);
  const day = getAppDayOfWeekFromDate(today);

  return day === 5 || day === 6;
}

export function getAdminPlanWindowLabel(now = new Date()) {
  return shouldShowNextWeekPlan(now) ? "برنامه هفته آینده" : "برنامه هفته جاری";
}

export function getAdminPlanWeekRange(now = new Date()) {
  const today = getTodayDateOnly(now);
  const appDay = getAppDayOfWeekFromDate(today);
  const daysUntilWeekStart = appDay <= 4 ? -appDay : 7 - appDay;
  const weekStart = addDays(today, daysUntilWeekStart);
  const weekEndExclusive = addDays(weekStart, WORK_DAYS.length);

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
        .filter((attendance) => getDateKey(attendance.date) === getDateKey(dayDate))
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
