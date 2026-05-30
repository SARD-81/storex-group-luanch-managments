import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { getCalendarDayByDateKey } from "../lib/calendar/calendar-service";
import {
  clearCalendarDayOverride,
  forceCalendarDayHoliday,
  forceCalendarDayWorkday,
  getCalendarDayOverrideStatus,
  type CalendarOverrideResult,
} from "../lib/calendar/calendar-override-service";

const TEST_DATE_KEY = "2026-03-25";

function assertCondition(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertOverrideStatus(
  status: CalendarOverrideResult | null,
  expected: {
    overrideType: CalendarOverrideResult["overrideType"];
    isManualHoliday: boolean;
    isForcedWorkday: boolean;
    isWorkday: boolean;
  },
): void {
  if (!status) {
    throw new Error(`Calendar override status was not found for ${TEST_DATE_KEY}.`);
  }

  assertCondition(
    status.overrideType === expected.overrideType,
    `Expected overrideType=${expected.overrideType}, received ${status.overrideType}.`,
  );
  assertCondition(
    status.isManualHoliday === expected.isManualHoliday,
    `Expected isManualHoliday=${expected.isManualHoliday}, received ${status.isManualHoliday}.`,
  );
  assertCondition(
    status.isForcedWorkday === expected.isForcedWorkday,
    `Expected isForcedWorkday=${expected.isForcedWorkday}, received ${status.isForcedWorkday}.`,
  );
  assertCondition(
    status.isWorkday === expected.isWorkday,
    `Expected isWorkday=${expected.isWorkday}, received ${status.isWorkday}.`,
  );
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

    const day = await getCalendarDayByDateKey(prisma, TEST_DATE_KEY);
    if (!day) {
      throw new Error(`CalendarDay was not found for ${TEST_DATE_KEY}.`);
    }

    assertCondition(day.isWorkday === true, `Expected ${TEST_DATE_KEY} to start as a workday.`);
    assertCondition(day.isOfficialHoliday === false, `Expected ${TEST_DATE_KEY} to not be an official holiday.`);
    assertCondition(day.isWeeklyOffDay === false, `Expected ${TEST_DATE_KEY} to not be a weekly off day.`);

    await clearCalendarDayOverride(prisma, TEST_DATE_KEY);
    assertOverrideStatus(await getCalendarDayOverrideStatus(prisma, TEST_DATE_KEY), {
      overrideType: null,
      isManualHoliday: false,
      isForcedWorkday: false,
      isWorkday: true,
    });
    console.log("Initial override state verified.");

    await forceCalendarDayHoliday(prisma, TEST_DATE_KEY, {
      title: "تست تعطیلی دستی",
      description: "این override فقط برای smoke test ایجاد و سپس پاک می‌شود.",
    });
    assertOverrideStatus(await getCalendarDayOverrideStatus(prisma, TEST_DATE_KEY), {
      overrideType: "FORCE_HOLIDAY",
      isManualHoliday: true,
      isForcedWorkday: false,
      isWorkday: false,
    });
    console.log("Manual holiday override verified.");

    await forceCalendarDayWorkday(prisma, TEST_DATE_KEY, {
      title: "تست روز کاری اجباری",
      description: "این override فقط برای smoke test ایجاد و سپس پاک می‌شود.",
    });
    assertOverrideStatus(await getCalendarDayOverrideStatus(prisma, TEST_DATE_KEY), {
      overrideType: "FORCE_WORKDAY",
      isManualHoliday: false,
      isForcedWorkday: true,
      isWorkday: true,
    });
    console.log("Forced workday override verified.");

    await clearCalendarDayOverride(prisma, TEST_DATE_KEY);
    assertOverrideStatus(await getCalendarDayOverrideStatus(prisma, TEST_DATE_KEY), {
      overrideType: null,
      isManualHoliday: false,
      isForcedWorkday: false,
      isWorkday: true,
    });
    console.log("Override clear verified.");

    const restoredDay = await getCalendarDayByDateKey(prisma, TEST_DATE_KEY);
    if (!restoredDay) {
      throw new Error(`CalendarDay was not found for ${TEST_DATE_KEY} after clear.`);
    }

    assertCondition(restoredDay.isWorkday === true, `Expected restored ${TEST_DATE_KEY} to be a workday.`);
    assertCondition(
      restoredDay.isManualHoliday === false,
      `Expected restored ${TEST_DATE_KEY} to not be a manual holiday.`,
    );
    assertCondition(
      restoredDay.isForcedWorkday === false,
      `Expected restored ${TEST_DATE_KEY} to not be a forced workday.`,
    );
    console.log("CalendarDay restored state verified.");
    console.log("Calendar override check passed.");
  } finally {
    try {
      await clearCalendarDayOverride(prisma, TEST_DATE_KEY);
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
