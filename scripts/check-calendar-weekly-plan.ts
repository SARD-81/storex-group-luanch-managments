import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import {
  formatCalendarWeeklyPlanDayStatus,
  getCalendarWeeklyPlanWindow,
  getCalendarWeeklyPlanWorkDateKeys,
  type CalendarWeeklyPlanDay,
} from "../lib/attendance/calendar-weekly-plan";

const FARVARDIN_FIXED_NOW = new Date("2026-03-21T08:30:00.000Z");
const ESFAND_FIXED_NOW = new Date("2027-03-10T08:30:00.000Z");

function findDayByJalaliDateKey(days: CalendarWeeklyPlanDay[], jalaliDateKey: string): CalendarWeeklyPlanDay {
  const day = days.find((item) => item.jalaliDateKey === jalaliDateKey);

  if (!day) {
    throw new Error(`Expected weekly plan window to include ${jalaliDateKey}.`);
  }

  return day;
}

function assertWorkDateKeys(actual: string[], expected: string[]): void {
  if (actual.length !== expected.length || actual.some((dateKey, index) => dateKey !== expected[index])) {
    throw new Error(`Expected work date keys ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
  }
}

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

    const farvardinWindow = await getCalendarWeeklyPlanWindow(prisma, FARVARDIN_FIXED_NOW);

    if (farvardinWindow.days.length !== 5) {
      throw new Error(`Expected Farvardin window to include 5 days, received ${farvardinWindow.days.length}.`);
    }

    if (farvardinWindow.weekStartDateKey !== "2026-03-21") {
      throw new Error(`Expected Farvardin weekStartDateKey 2026-03-21, received ${farvardinWindow.weekStartDateKey}.`);
    }

    if (farvardinWindow.weekEndExclusiveDateKey !== "2026-03-26") {
      throw new Error(
        `Expected Farvardin weekEndExclusiveDateKey 2026-03-26, received ${farvardinWindow.weekEndExclusiveDateKey}.`,
      );
    }

    if (farvardinWindow.workdays.length !== 1) {
      throw new Error(`Expected Farvardin window to include 1 workday, received ${farvardinWindow.workdays.length}.`);
    }

    if (farvardinWindow.nonWorkdays.length !== 4) {
      throw new Error(
        `Expected Farvardin window to include 4 non-workdays, received ${farvardinWindow.nonWorkdays.length}.`,
      );
    }

    const farvardinFirstDay = findDayByJalaliDateKey(farvardinWindow.days, "1405-01-01");
    if (farvardinFirstDay.isWorkday !== false || farvardinFirstDay.isOfficialHoliday !== true) {
      throw new Error("Expected 1405-01-01 to be a non-workday official holiday.");
    }

    const farvardinFifthDay = findDayByJalaliDateKey(farvardinWindow.days, "1405-01-05");
    if (farvardinFifthDay.isWorkday !== true) {
      throw new Error("Expected 1405-01-05 to be a workday.");
    }

    console.log("Farvardin weekly plan window verified.");

    const farvardinWorkDateKeys = await getCalendarWeeklyPlanWorkDateKeys(prisma, FARVARDIN_FIXED_NOW);
    assertWorkDateKeys(farvardinWorkDateKeys, ["2026-03-25"]);
    console.log("Farvardin weekly plan work date keys verified.");

    const farvardinStatuses = farvardinWindow.days.map((day) => ({
      day,
      status: formatCalendarWeeklyPlanDayStatus(day),
    }));

    if (farvardinStatuses.some(({ status }) => status.trim().length === 0)) {
      throw new Error("Expected every Farvardin weekly plan status to be a non-empty string.");
    }

    const farvardinFirstDayStatus = formatCalendarWeeklyPlanDayStatus(farvardinFirstDay);
    if (!farvardinFirstDayStatus.includes("تعطیل رسمی")) {
      throw new Error(`Expected 1405-01-01 status to include تعطیل رسمی, received ${farvardinFirstDayStatus}.`);
    }

    const farvardinFifthDayStatus = formatCalendarWeeklyPlanDayStatus(farvardinFifthDay);
    if (farvardinFifthDayStatus !== "روز کاری") {
      throw new Error(`Expected 1405-01-05 status to be روز کاری, received ${farvardinFifthDayStatus}.`);
    }

    console.log("Farvardin weekly plan statuses verified.");

    const esfandWindow = await getCalendarWeeklyPlanWindow(prisma, ESFAND_FIXED_NOW);
    if (esfandWindow.days.length !== 5) {
      throw new Error(`Expected Esfand window to include 5 days, received ${esfandWindow.days.length}.`);
    }

    const esfandHoliday = findDayByJalaliDateKey(esfandWindow.days, "1405-12-19");
    if (esfandHoliday.isOfficialHoliday !== true) {
      throw new Error("Expected 1405-12-19 to be an official holiday.");
    }

    if (esfandHoliday.isWorkday !== false) {
      throw new Error("Expected 1405-12-19 to be a non-workday.");
    }

    const esfandHolidayStatus = formatCalendarWeeklyPlanDayStatus(esfandHoliday);
    if (!esfandHolidayStatus.includes("تعطیل رسمی")) {
      throw new Error(`Expected 1405-12-19 status to include تعطیل رسمی, received ${esfandHolidayStatus}.`);
    }

    console.log("Esfand weekly plan official holiday verified.");
    console.log("Calendar weekly plan check passed.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
