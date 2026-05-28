import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import {
  getAttendanceDatePoliciesByDateRange,
  getAttendanceDatePolicyByJalaliDateKey,
} from "../lib/attendance/calendar-attendance-policy";
import { getCalendarDayByJalaliDateKey } from "../lib/calendar/calendar-service";

const FIXED_NOW = new Date("2026-03-21T08:30:00.000Z");

function assertCondition(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertTextIncludes(value: string | null, expectedText: string, label: string): void {
  assertCondition(value !== null, `${label} must not be null.`);
  assertCondition(value.includes(expectedText), `${label} must include "${expectedText}".`);
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

    const farvardinFirstPolicy = await getAttendanceDatePolicyByJalaliDateKey(prisma, "1405-01-01", FIXED_NOW);
    assertCondition(farvardinFirstPolicy.isSelectable === false, "Expected 1405-01-01 to be non-selectable.");
    assertCondition(farvardinFirstPolicy.isWorkday === false, "Expected 1405-01-01 to be a non-workday.");
    assertCondition(
      farvardinFirstPolicy.isOfficialHoliday === true,
      "Expected 1405-01-01 to be an official holiday.",
    );
    assertTextIncludes(farvardinFirstPolicy.holidayTitle, "عید سعید فطر", "1405-01-01 holidayTitle");
    assertCondition(farvardinFirstPolicy.eventCount === 2, "Expected 1405-01-01 to have 2 events.");
    console.log("1405-01-01 policy verified.");

    const farvardinFifthPolicy = await getAttendanceDatePolicyByJalaliDateKey(prisma, "1405-01-05", FIXED_NOW);
    assertCondition(farvardinFifthPolicy.isSelectable === true, "Expected 1405-01-05 to be selectable.");
    assertCondition(farvardinFifthPolicy.isWorkday === true, "Expected 1405-01-05 to be a workday.");
    assertCondition(
      farvardinFifthPolicy.isOfficialHoliday === false,
      "Expected 1405-01-05 not to be an official holiday.",
    );
    console.log("1405-01-05 policy verified.");

    const farvardinSixthPolicy = await getAttendanceDatePolicyByJalaliDateKey(prisma, "1405-01-06", FIXED_NOW);
    assertCondition(farvardinSixthPolicy.isSelectable === false, "Expected 1405-01-06 to be non-selectable.");
    assertCondition(farvardinSixthPolicy.isWeeklyOffDay === true, "Expected 1405-01-06 to be a weekly off day.");
    assertCondition(farvardinSixthPolicy.isWorkday === false, "Expected 1405-01-06 to be a non-workday.");
    console.log("1405-01-06 weekly off policy verified.");

    const khordadFourteenthDay = await getCalendarDayByJalaliDateKey(prisma, "1405-03-14");
    assertCondition(khordadFourteenthDay !== null, "Expected CalendarDay for 1405-03-14 to exist.");
    assertCondition(
      khordadFourteenthDay.isOfficialHoliday === true,
      "Expected 1405-03-14 to be an official holiday.",
    );
    assertCondition(khordadFourteenthDay.isWorkday === false, "Expected 1405-03-14 to be a non-workday.");
    assertCondition(khordadFourteenthDay.events.length === 3, "Expected 1405-03-14 to have 3 events.");
    assertTextIncludes(khordadFourteenthDay.holidayTitle, "عید سعید غدیر خم", "1405-03-14 holidayTitle");
    assertTextIncludes(khordadFourteenthDay.holidayTitle, "رحلت حضرت امام خمینی", "1405-03-14 holidayTitle");
    console.log("1405-03-14 calendar events verified.");

    const firstWeekPolicies = await getAttendanceDatePoliciesByDateRange(
      prisma,
      "2026-03-21",
      "2026-03-27",
      FIXED_NOW,
    );
    assertCondition(firstWeekPolicies.length === 7, "Expected first week Farvardin range to contain 7 policies.");

    const firstWeekSelectableCount = firstWeekPolicies.filter((policy) => policy.isSelectable).length;
    const firstWeekNotSelectableCount = firstWeekPolicies.filter((policy) => !policy.isSelectable).length;
    assertCondition(firstWeekSelectableCount === 1, "Expected first week Farvardin range to have 1 selectable policy.");
    assertCondition(
      firstWeekNotSelectableCount === 6,
      "Expected first week Farvardin range to have 6 non-selectable policies.",
    );

    const firstWeekPoliciesByJalaliDateKey = new Map(
      firstWeekPolicies.map((policy) => [policy.jalaliDateKey, policy]),
    );
    assertCondition(
      firstWeekPoliciesByJalaliDateKey.get("1405-01-01")?.isSelectable === false,
      "Expected 1405-01-01 to be included and non-selectable.",
    );
    assertCondition(
      firstWeekPoliciesByJalaliDateKey.get("1405-01-05")?.isSelectable === true,
      "Expected 1405-01-05 to be included and selectable.",
    );
    assertCondition(
      firstWeekPoliciesByJalaliDateKey.get("1405-01-06")?.isSelectable === false,
      "Expected 1405-01-06 to be included and non-selectable.",
    );
    assertCondition(
      firstWeekPoliciesByJalaliDateKey.get("1405-01-07")?.isSelectable === false,
      "Expected 1405-01-07 to be included and non-selectable.",
    );
    console.log("First week Farvardin policy range verified.");

    const esfandPolicies = await getAttendanceDatePoliciesByDateRange(
      prisma,
      "2027-03-10",
      "2027-03-20",
      FIXED_NOW,
    );
    const esfandPoliciesByJalaliDateKey = new Map(esfandPolicies.map((policy) => [policy.jalaliDateKey, policy]));

    for (const jalaliDateKey of ["1405-12-19", "1405-12-20", "1405-12-29"]) {
      const policy = esfandPoliciesByJalaliDateKey.get(jalaliDateKey);
      assertCondition(policy !== undefined, `Expected ${jalaliDateKey} to exist in Esfand policy range.`);
      assertCondition(policy.isOfficialHoliday === true, `Expected ${jalaliDateKey} to be an official holiday.`);
      assertCondition(policy.isSelectable === false, `Expected ${jalaliDateKey} to be non-selectable.`);
    }
    console.log("Esfand official holiday policy range verified.");

    console.log("Calendar dashboard integration check passed.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
