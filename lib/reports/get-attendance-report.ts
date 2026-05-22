import { AttendanceStatus, MealType } from "@/app/generated/prisma/client";
import { getDateKey } from "@/lib/date/date-key";
import { formatPersianWeekdayDate } from "@/lib/date/persian-format";
import { prisma } from "@/lib/prisma";

function getAppDayOfWeek(date: Date) {
  return (date.getUTCDay() + 1) % 7;
}

function isWorkDay(date: Date) {
  const appDay = getAppDayOfWeek(date);
  return appDay >= 0 && appDay <= 4;
}

function buildWorkDays(fromDate: Date, toDate: Date) {
  const dates: Date[] = [];

  for (let cursor = new Date(fromDate); cursor <= toDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const currentDate = new Date(cursor);

    if (isWorkDay(currentDate)) {
      dates.push(currentDate);
    }
  }

  return dates;
}

export async function getAttendanceReport(fromDate: Date, toDate: Date) {
  const workDays = buildWorkDays(fromDate, toDate);

  const [attendances, users] = await Promise.all([
    prisma.mealAttendance.findMany({
      where: {
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        user: true,
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, username: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const workDateKeys = new Set(workDays.map(getDateKey));
  const presentMap = new Map<string, AttendanceStatus>();

  for (const attendance of attendances) {
    const dateKey = getDateKey(attendance.date);

    if (!workDateKeys.has(dateKey) || attendance.status !== AttendanceStatus.PRESENT) {
      continue;
    }

    presentMap.set(`${dateKey}:${attendance.userId}:${attendance.mealType}`, AttendanceStatus.PRESENT);
  }

  const dailySummary = workDays.map((date) => {
    const dateKey = getDateKey(date);
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
      persianDateLabel: formatPersianWeekdayDate(date),
      breakfastCount,
      lunchCount,
    };
  });

  const userRows = workDays.flatMap((date) => {
    const dateKey = getDateKey(date);
    const persianDateLabel = formatPersianWeekdayDate(date);

    return users.map((user) => ({
      dateKey,
      persianDateLabel,
      userName: user.name,
      username: user.username,
      breakfastStatus:
        presentMap.get(`${dateKey}:${user.id}:${MealType.BREAKFAST}`) ?? AttendanceStatus.ABSENT,
      lunchStatus:
        presentMap.get(`${dateKey}:${user.id}:${MealType.LUNCH}`) ?? AttendanceStatus.ABSENT,
    }));
  });

  return {
    dailySummary,
    userRows,
  };
}
