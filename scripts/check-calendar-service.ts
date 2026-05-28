import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import {
  getCalendarDayByJalaliDateKey,
  getCalendarDaysByJalaliMonth,
  getTodayCalendarDay,
  isWorkdayByJalaliDateKey,
} from "../lib/calendar/calendar-service";

const SAMPLE_JALALI_DATE_KEYS = [
  "1405-01-01",
  "1405-03-14",
  "1405-05-21",
  "1405-08-22",
  "1405-10-02",
  "1405-11-22",
  "1405-12-19",
  "1405-12-20",
  "1405-12-29",
];

const WORKDAY_EXPECTATIONS = new Map<string, boolean>([
  ["1405-01-01", false],
  ["1405-01-05", true],
  ["1405-12-29", false],
]);

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });

  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$connect();

    const today = await getTodayCalendarDay(prisma);

    console.log("Today calendar day:");
    if (!today) {
      console.log("  Not found in CalendarDay.");
    } else {
      console.log(
        `  ${today.dateKey} | ${today.jalaliDateKey} | ${today.dayNameFa} | isWorkday=${today.isWorkday} | events=${today.events.length}`,
      );
    }

    for (const jalaliDateKey of SAMPLE_JALALI_DATE_KEYS) {
      const day = await getCalendarDayByJalaliDateKey(prisma, jalaliDateKey);

      if (!day) {
        throw new Error(`CalendarDay was not found for jalaliDateKey ${jalaliDateKey}.`);
      }

      console.log(
        `${day.jalaliDateKey} | ${day.dateKey} | ${day.dayNameFa} | isWorkday=${day.isWorkday} | isOfficialHoliday=${day.isOfficialHoliday} | holidayTitle=${day.holidayTitle ?? "null"} | events=${day.events.length}`,
      );

      for (const event of day.events) {
        console.log(
          `  ${event.displayOrder}. ${event.title} | holiday=${event.isHoliday} | type=${event.type} | calendar=${event.calendarType}`,
        );
      }
    }

    const farvardinDays = await getCalendarDaysByJalaliMonth(prisma, 1405, 1);
    if (farvardinDays.length !== 31) {
      throw new Error(`Expected 31 Farvardin 1405 days, received ${farvardinDays.length}.`);
    }
    console.log("Farvardin 1405 days: 31");

    for (const [jalaliDateKey, expected] of WORKDAY_EXPECTATIONS) {
      const actual = await isWorkdayByJalaliDateKey(prisma, jalaliDateKey);
      if (actual !== expected) {
        throw new Error(
          `Expected isWorkdayByJalaliDateKey(${jalaliDateKey}) to be ${expected}, received ${actual}.`,
        );
      }
    }

    console.log("Calendar service check passed.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
