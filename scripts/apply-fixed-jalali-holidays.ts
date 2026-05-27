import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  CalendarDateSystem,
  CalendarEventType,
  PrismaClient,
} from "../app/generated/prisma/client";
import { FIXED_JALALI_OFFICIAL_HOLIDAYS } from "../data/calendar/iran/fixed-jalali-official-holidays";
import { resolveCalendarWorkday } from "../lib/calendar/calendar-workday";

function parseArgValue(prefix: string): string | undefined {
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg?.slice(prefix.length);
}

function parseYearArg(): number {
  const yearRaw = parseArgValue("--year=");

  if (!yearRaw) {
    console.error("Missing required argument: --year=YYYY");
    process.exit(1);
  }

  if (!/^-?\d+$/.test(yearRaw)) {
    console.error("Invalid --year value. Year must be an integer.");
    process.exit(1);
  }

  const year = Number(yearRaw);

  if (!Number.isInteger(year) || year < 1200 || year > 1700) {
    console.error("Invalid --year value. Year must be between 1200 and 1700.");
    process.exit(1);
  }

  return year;
}

function toJalaliDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function main() {
  const year = parseYearArg();
  const isDryRun = process.argv.includes("--dry-run");
  const sourceName = parseArgValue("--source-name=") ?? "internal-fixed-jalali-official-holidays";
  const sourceVersion = parseArgValue("--source-version=") ?? "fixed-jalali-v1";

  const targets = FIXED_JALALI_OFFICIAL_HOLIDAYS.map((holiday) => ({
    ...holiday,
    jalaliDateKey: toJalaliDateKey(year, holiday.month, holiday.day),
  }));

  if (isDryRun) {
    console.log(`Target Jalali year: ${year}`);
    console.log(`Fixed official holiday count: ${targets.length}`);
    for (const target of targets) {
      console.log(`${target.jalaliDateKey} | ${target.title}`);
    }
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });

  const prisma = new PrismaClient({ adapter });

  try {
    const dateKeys = targets.map((target) => target.jalaliDateKey);

    const result = await prisma.$transaction(async (tx) => {
      const calendarDays = await tx.calendarDay.findMany({
        where: {
          jalaliDateKey: {
            in: dateKeys,
          },
        },
        select: {
          id: true,
          jalaliDateKey: true,
          isWeeklyOffDay: true,
          isManualHoliday: true,
          isForcedWorkday: true,
        },
      });

      const dayByJalaliDateKey = new Map(calendarDays.map((day) => [day.jalaliDateKey, day]));
      const missingDateKeys = dateKeys.filter((key) => !dayByJalaliDateKey.has(key));

      if (missingDateKeys.length > 0) {
        throw new Error(`Missing CalendarDay rows for jalaliDateKeys: ${missingDateKeys.join(", ")}`);
      }

      let updatedCalendarDayRows = 0;
      let createdCalendarEventRows = 0;
      let updatedCalendarEventRows = 0;

      for (const target of targets) {
        const calendarDay = dayByJalaliDateKey.get(target.jalaliDateKey)!;

        const isWorkday = resolveCalendarWorkday({
          isWeeklyOffDay: calendarDay.isWeeklyOffDay,
          isOfficialHoliday: true,
          isManualHoliday: calendarDay.isManualHoliday,
          isForcedWorkday: calendarDay.isForcedWorkday,
        });

        await tx.calendarDay.update({
          where: { id: calendarDay.id },
          data: {
            isOfficialHoliday: true,
            holidayTitle: target.title,
            sourceName,
            sourceVersion,
            isWorkday,
          },
        });
        updatedCalendarDayRows += 1;

        const existingEvent = await tx.calendarEvent.findFirst({
          where: {
            calendarDayId: calendarDay.id,
            title: target.title,
            calendarType: CalendarDateSystem.JALALI,
            isHoliday: true,
            isOfficial: true,
          },
          select: {
            id: true,
          },
        });

        if (existingEvent) {
          await tx.calendarEvent.update({
            where: { id: existingEvent.id },
            data: {
              type: CalendarEventType.NATIONAL,
              sourceName,
              sourceVersion,
              description: "Fixed official Jalali holiday.",
            },
          });
          updatedCalendarEventRows += 1;
        } else {
          await tx.calendarEvent.create({
            data: {
              calendarDayId: calendarDay.id,
              title: target.title,
              type: CalendarEventType.NATIONAL,
              calendarType: CalendarDateSystem.JALALI,
              isHoliday: true,
              isOfficial: true,
              referenceDate: target.jalaliDateKey,
              description: "Fixed official Jalali holiday.",
              sourceName,
              sourceVersion,
            },
          });
          createdCalendarEventRows += 1;
        }
      }

      return {
        updatedCalendarDayRows,
        createdCalendarEventRows,
        updatedCalendarEventRows,
      };
    });

    console.log(`Applied fixed Jalali official holidays for year: ${year}`);
    console.log(`Target holidays: ${targets.length}`);
    console.log(`Updated CalendarDay rows: ${result.updatedCalendarDayRows}`);
    console.log(`Created CalendarEvent rows: ${result.createdCalendarEventRows}`);
    console.log(`Updated CalendarEvent rows: ${result.updatedCalendarEventRows}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
