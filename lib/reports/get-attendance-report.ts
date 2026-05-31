import { AttendanceStatus, MealType, UserRole } from "@/app/generated/prisma/client";
import { getAttendanceDatePoliciesByDateRange } from "@/lib/attendance/calendar-attendance-policy";
import { getDateKey } from "@/lib/date/date-key";
import { formatPersianWeekdayDate } from "@/lib/date/persian-format";
import { prisma } from "@/lib/prisma";

type ReportUser = {
  id: string;
  name: string;
  username: string;
};

export async function getAttendanceReport(fromDate: Date, toDate: Date) {
  const fromDateKey = getDateKey(fromDate);
  const toDateKey = getDateKey(toDate);
  const policies = await getAttendanceDatePoliciesByDateRange(prisma, fromDateKey, toDateKey);
  const reportDays = policies.filter((policy) => policy.isWorkday === true);

  const [attendances, users] = await Promise.all([
    prisma.mealAttendance.findMany({
      where: {
        date: {
          gte: fromDate,
          lte: toDate,
        },
        user: { role: { not: UserRole.REPORTER } },
      },
      include: {
        user: true,
      },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { not: UserRole.REPORTER } },
      select: { id: true, name: true, username: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const workDateKeys = new Set(reportDays.map((policy) => policy.dateKey));
  const presentMap = new Map<string, AttendanceStatus>();

  for (const attendance of attendances) {
    const dateKey = getDateKey(attendance.date);

    if (!workDateKeys.has(dateKey) || attendance.status !== AttendanceStatus.PRESENT) {
      continue;
    }

    presentMap.set(`${dateKey}:${attendance.userId}:${attendance.mealType}`, AttendanceStatus.PRESENT);
  }

  const dailySummary = reportDays.map((policy) => {
    const date = new Date(`${policy.dateKey}T00:00:00.000Z`);
    const dateKey = policy.dateKey;
    const persianDateLabel = policy.jalaliDateKey
      ? `${policy.dayNameFa ?? ""} ${policy.jalaliDateKey}`.trim()
      : formatPersianWeekdayDate(date);
    let breakfastCount = 0;
    let lunchCount = 0;

    for (const user of users) {
      if (presentMap.get(`${dateKey}:${user.id}:${MealType.BREAKFAST}`) === AttendanceStatus.PRESENT) {
        breakfastCount += 1;
      }

      if (presentMap.get(`${dateKey}:${user.id}:${MealType.LUNCH}`) === AttendanceStatus.PRESENT) {
        lunchCount += 1;
      }
    }

    return {
      dateKey,
      persianDateLabel,
      isOfficialHoliday: policy.isOfficialHoliday === true,
      isWeeklyOffDay: policy.isWeeklyOffDay === true,
      holidayTitle: policy.holidayTitle,
      eventTitles: policy.calendarDay?.events.map((event) => event.title) ?? [],
      eventCount: policy.eventCount,
      breakfastCount,
      lunchCount,
    };
  });

  const userRows = reportDays.flatMap((policy) => {
    const date = new Date(`${policy.dateKey}T00:00:00.000Z`);
    const dateKey = policy.dateKey;
    const persianDateLabel = policy.jalaliDateKey
      ? `${policy.dayNameFa ?? ""} ${policy.jalaliDateKey}`.trim()
      : formatPersianWeekdayDate(date);

    return users.map((user: ReportUser) => ({
      dateKey,
      persianDateLabel,
      isOfficialHoliday: policy.isOfficialHoliday === true,
      isWeeklyOffDay: policy.isWeeklyOffDay === true,
      holidayTitle: policy.holidayTitle,
      eventTitles: policy.calendarDay?.events.map((event) => event.title) ?? [],
      eventCount: policy.eventCount,
      userName: user.name,
      username: user.username,
      breakfastStatus:
        presentMap.get(`${dateKey}:${user.id}:${MealType.BREAKFAST}`) ?? AttendanceStatus.ABSENT,
      lunchStatus:
        presentMap.get(`${dateKey}:${user.id}:${MealType.LUNCH}`) ?? AttendanceStatus.ABSENT,
    }));
  });

  const calendarExcludedDays = policies
    .filter((policy) => policy.isWorkday !== true)
    .map((policy) => ({
      dateKey: policy.dateKey,
      jalaliDateKey: policy.jalaliDateKey,
      dayNameFa: policy.dayNameFa,
      isOfficialHoliday: policy.isOfficialHoliday === true,
      isWeeklyOffDay: policy.isWeeklyOffDay === true,
      holidayTitle: policy.holidayTitle,
      eventTitles: policy.calendarDay?.events.map((event) => event.title) ?? [],
      eventCount: policy.eventCount,
      reasons: policy.reasons,
    }));

  return {
    dailySummary,
    userRows,
    calendarExcludedDays,
  };
}
