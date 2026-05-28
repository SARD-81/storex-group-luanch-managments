import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import {
  canSelectAttendanceDateByJalaliDateKey,
  getAttendanceDatePoliciesByDateRange,
  getAttendanceDatePolicyByJalaliDateKey,
  getAttendanceSelectableDateRange,
} from "../lib/attendance/calendar-attendance-policy";

const FIXED_NOW = new Date("2026-03-21T08:30:00.000Z");

const POLICY_EXPECTATIONS = new Map<string, { selectable: boolean; reason?: "NON_WORKDAY" }>([
  ["1405-01-01", { selectable: false, reason: "NON_WORKDAY" }],
  ["1405-01-05", { selectable: true }],
  ["1405-01-06", { selectable: false, reason: "NON_WORKDAY" }],
  ["1405-12-29", { selectable: false }],
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

    const range = getAttendanceSelectableDateRange(FIXED_NOW);
    console.log("Selectable attendance range:");
    console.log(`  today=${range.todayDateKey} | max=${range.maxDateKey}`);

    for (const [jalaliDateKey, expected] of POLICY_EXPECTATIONS) {
      const policy = await getAttendanceDatePolicyByJalaliDateKey(prisma, jalaliDateKey, FIXED_NOW);
      const reasons = policy.reasons.join(",");

      console.log(
        `${jalaliDateKey} | dateKey=${policy.dateKey} | selectable=${policy.isSelectable} | workday=${policy.isWorkday} | officialHoliday=${policy.isOfficialHoliday} | weeklyOff=${policy.isWeeklyOffDay} | reasons=${reasons} | holidayTitle=${policy.holidayTitle ?? "null"} | events=${policy.eventCount}`,
      );

      if (policy.isSelectable !== expected.selectable) {
        throw new Error(
          `Expected policy for ${jalaliDateKey} selectable=${expected.selectable}, received ${policy.isSelectable}.`,
        );
      }

      if (expected.reason && !policy.reasons.includes(expected.reason)) {
        throw new Error(`Expected policy for ${jalaliDateKey} to include reason ${expected.reason}.`);
      }
    }

    for (const [jalaliDateKey, expected] of POLICY_EXPECTATIONS) {
      const canSelect = await canSelectAttendanceDateByJalaliDateKey(prisma, jalaliDateKey, FIXED_NOW);

      if (canSelect !== expected.selectable) {
        throw new Error(
          `Expected canSelectAttendanceDateByJalaliDateKey(${jalaliDateKey}) to be ${expected.selectable}, received ${canSelect}.`,
        );
      }
    }

    const firstWeekPolicies = await getAttendanceDatePoliciesByDateRange(
      prisma,
      "2026-03-21",
      "2026-03-27",
      FIXED_NOW,
    );

    if (firstWeekPolicies.length !== 7) {
      throw new Error(`Expected 7 policies for first week of Farvardin 1405, received ${firstWeekPolicies.length}.`);
    }

    const selectablePolicies = firstWeekPolicies.filter((policy) => policy.isSelectable);
    if (selectablePolicies.length !== 1) {
      throw new Error(
        `Expected exactly 1 selectable policy for first week of Farvardin 1405, received ${selectablePolicies.length}.`,
      );
    }

    console.log("First week of Farvardin 1405 policy count: 7");
    console.log("Selectable policies in first week: 1");
    console.log("Calendar attendance policy check passed.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
