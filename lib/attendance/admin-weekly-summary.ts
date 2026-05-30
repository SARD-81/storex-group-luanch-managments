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

export type AdminWeeklyPlanCalendarDay = {
  dateKey: string;
  jalaliDateKey: string | null;
  dayNameFa: string | null;
  dayOfWeek: number | null;
  isWorkday: boolean | null;
  isWeeklyOffDay: boolean | null;
  isOfficialHoliday: boolean | null;
  isManualHoliday: boolean | null;
  isForcedWorkday: boolean | null;
  holidayTitle: string | null;
  eventTitles: string[];
  eventCount: number;
  statusLabel: string;
};

type AdminWeeklyPlanDisplayDay = {
  dayOfWeek: number;
  label: string;
  date: Date;
  dateKey: string;
  isWorkday: boolean | null;
  statusLabel: string;
  isCalendarDay: boolean;
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
  calendarPlanDays,
}: {
  weeklyAttendances: WeeklyAttendance[];
  weeklyPreferences: WeeklyPreference[];
  weekStart: Date;
  calendarPlanDays?: AdminWeeklyPlanCalendarDay[];
}) {
  const hasCalendarPlanDays = calendarPlanDays !== undefined;
  const calendarDisplayDays = (calendarPlanDays ?? [])
    .filter((day) => day.dayOfWeek !== null)
    .map((day) => ({
      dayOfWeek: day.dayOfWeek as number,
      label: day.dayNameFa ?? `روز ${day.dayOfWeek}`,
      date:
        parseDateKey(day.dateKey) ??
        addDays(weekStart, day.dayOfWeek as number),
      dateKey: day.dateKey,
      isWorkday: day.isWorkday,
      statusLabel: day.statusLabel,
      isCalendarDay: true,
    }));
  const fallbackDisplayDays = WORK_DAYS.map(({ dayOfWeek, label }) => {
    const date = addDays(weekStart, dayOfWeek);

    return {
      dayOfWeek,
      label,
      date,
      dateKey: getDateKey(date),
      isWorkday: true,
      statusLabel: "روز کاری",
      isCalendarDay: false,
    };
  });
  const displayDays: AdminWeeklyPlanDisplayDay[] =
    calendarDisplayDays.length > 0 ? calendarDisplayDays : fallbackDisplayDays;
  const presentAttendances = weeklyAttendances.filter(
    (attendance) => attendance.status === AttendanceStatus.PRESENT,
  );

  if (presentAttendances.length > 0) {
    return displayDays
      .map((day) => {
        const meals = presentAttendances
          .filter((attendance) => getDateKey(attendance.date) === day.dateKey)
          .map((attendance) => MEAL_LABELS[attendance.mealType]);

        if (day.isCalendarDay && day.isWorkday !== true) {
          return meals.length > 0
            ? `${day.label}: ${day.statusLabel} / ثبت‌شده: ${meals.join("، ")}`
            : `${day.label}: ${day.statusLabel}`;
        }

        return `${day.label}: ${meals.length > 0 ? meals.join("، ") : "—"}`;
      })
      .join(" | ");
  }

  const enabledPreferences = weeklyPreferences.filter(
    (preference) => preference.isEnabled,
  );

  if (enabledPreferences.length === 0 && !hasCalendarPlanDays) {
    return "برنامه‌ای ثبت نشده است";
  }

  return displayDays
    .map((day) => {
      if (day.isCalendarDay && day.isWorkday !== true) {
        return `${day.label}: ${day.statusLabel}`;
      }

      const meals = enabledPreferences
        .filter((preference) => preference.dayOfWeek === day.dayOfWeek)
        .map((preference) => MEAL_LABELS[preference.mealType]);

      return `${day.label}: ${meals.length > 0 ? meals.join("، ") : "—"}`;
    })
    .join(" | ");
}
