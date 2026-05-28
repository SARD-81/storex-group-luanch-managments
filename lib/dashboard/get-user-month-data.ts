import { AttendanceStatus, MealType } from "@/app/generated/prisma/client";
import { getAttendanceDatePoliciesByDateRange } from "@/lib/attendance/calendar-attendance-policy";
import { getCurrentJalaliMonthRange } from "@/lib/attendance/month";
import { canEditAttendance, getAttendanceDeadline } from "@/lib/attendance/rules";
import { getDateKey } from "@/lib/date/date-key";
import { getTehranDateKey } from "@/lib/date/tehran-time";
import { prisma } from "@/lib/prisma";

const dateLabelFormatter = new Intl.DateTimeFormat("fa-IR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function parseDateKeyToUtcDate(dateKey: string) {
  const [yearText, monthText, dayText] = dateKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  return new Date(Date.UTC(year, month - 1, day));
}

export async function getUserCurrentMonthAttendanceData(userId: string) {
  const now = new Date();
  const { monthStart, nextMonthStart } = getCurrentJalaliMonthRange(now);
  const monthStartKey = getDateKey(monthStart);
  const monthEndDate = new Date(nextMonthStart);
  monthEndDate.setUTCDate(monthEndDate.getUTCDate() - 1);
  const monthEndKey = getDateKey(monthEndDate);

  const policies = await getAttendanceDatePoliciesByDateRange(
    prisma,
    monthStartKey,
    monthEndKey,
    now,
  );

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
    const dateKey = getDateKey(attendance.date);
    const byMeal = attendanceMap.get(dateKey) ?? new Map<MealType, AttendanceStatus>();
    byMeal.set(attendance.mealType, attendance.status);
    attendanceMap.set(dateKey, byMeal);
  }

  return policies.map((policy) => {
    const date = policy.calendarDay
      ? new Date(`${policy.dateKey}T00:00:00.000Z`)
      : parseDateKeyToUtcDate(policy.dateKey);
    const meals = attendanceMap.get(policy.dateKey);

    return {
      date,
      dateKey: policy.dateKey,
      dayNameFa: policy.dayNameFa ?? "",
      persianDateLabel: dateLabelFormatter.format(date),
      canEdit: policy.isSelectable && canEditAttendance(date, now),
      isSelectable: policy.isSelectable,
      deadline: getAttendanceDeadline(date),
      isToday: getTehranDateKey(now) === policy.dateKey,
      breakfastStatus: meals?.get(MealType.BREAKFAST) ?? AttendanceStatus.ABSENT,
      lunchStatus: meals?.get(MealType.LUNCH) ?? AttendanceStatus.ABSENT,
      isWorkDay: policy.isWorkday === true,
      jalaliDateKey: policy.jalaliDateKey,
      isWeeklyOffDay: policy.isWeeklyOffDay === true,
      isOfficialHoliday: policy.isOfficialHoliday === true,
      isManualHoliday: policy.isManualHoliday === true,
      isForcedWorkday: policy.isForcedWorkday === true,
      holidayTitle: policy.holidayTitle,
      eventTitles: policy.calendarDay?.events.map((event) => event.title) ?? [],
      eventCount: policy.eventCount,
      nonSelectableReasons: policy.reasons,
    };
  });
}
