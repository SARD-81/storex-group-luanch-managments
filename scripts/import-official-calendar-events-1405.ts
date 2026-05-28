import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  CalendarDateSystem,
  CalendarEventSourceSection,
  CalendarEventType,
  CalendarImportStatus,
  PrismaClient,
} from "../app/generated/prisma/client";
import {
  OFFICIAL_1405_EVENTS,
  OFFICIAL_1405_EXPECTED_TOTAL_EVENTS,
} from "../data/calendar/iran/official-1405";
import type { OfficialCalendarEvent1405 } from "../data/calendar/iran/official-1405";
import { resolveCalendarWorkday } from "../lib/calendar/calendar-workday";

const TARGET_JALALI_YEAR = 1405;
const EXPECTED_CALENDAR_DAY_ROWS = 365;
const DEFAULT_SOURCE_NAME = "tehran-university-official-calendar-1405";
const DEFAULT_SOURCE_VERSION = "official-1405-v1";
const DEFAULT_SOURCE_URL = "https://calendar.ut.ac.ir/fa/home";
const OFFICIAL_EVENT_DESCRIPTION =
  "Official 1405 calendar event from Tehran University official calendar PDF.";
const IMPORT_BATCH_NOTES =
  "Official 1405 calendar events imported from Tehran University official calendar PDF. Includes holidays and non-holiday events.";
const OLD_FIXED_HOLIDAY_SOURCE_NAME = "internal-fixed-jalali-official-holidays";
const OLD_FIXED_HOLIDAY_SOURCE_VERSION = "fixed-jalali-v1";

type CliOptions = {
  year: number;
  isDryRun: boolean;
  sourceName: string;
  sourceVersion: string;
  sourceUrl: string;
};

type CalendarDayForOfficialImport = {
  id: string;
  jalaliDateKey: string;
  isWeeklyOffDay: boolean;
  isManualHoliday: boolean;
  isForcedWorkday: boolean;
};

function parseArgValue(prefix: string): string | undefined {
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg?.slice(prefix.length);
}

function parseCliOptions(): CliOptions {
  const yearRaw = parseArgValue("--year=");

  if (!yearRaw) {
    console.error("Missing required argument: --year=1405");
    process.exit(1);
  }

  if (!/^\d+$/.test(yearRaw)) {
    console.error("Invalid --year value. Year must be exactly 1405.");
    process.exit(1);
  }

  const year = Number(yearRaw);

  if (year !== TARGET_JALALI_YEAR) {
    console.error("Invalid --year value. Year must be exactly 1405.");
    process.exit(1);
  }

  return {
    year,
    isDryRun: process.argv.includes("--dry-run"),
    sourceName: parseArgValue("--source-name=") ?? DEFAULT_SOURCE_NAME,
    sourceVersion: parseArgValue("--source-version=") ?? DEFAULT_SOURCE_VERSION,
    sourceUrl: parseArgValue("--source-url=") ?? DEFAULT_SOURCE_URL,
  };
}

function toCalendarEventType(
  value: OfficialCalendarEvent1405["type"],
): CalendarEventType {
  if (Object.prototype.hasOwnProperty.call(CalendarEventType, value)) {
    return CalendarEventType[value as keyof typeof CalendarEventType];
  }

  throw new Error(`Unknown calendar event type: ${value}`);
}

function toCalendarDateSystem(
  value: OfficialCalendarEvent1405["calendarType"],
): CalendarDateSystem {
  if (Object.prototype.hasOwnProperty.call(CalendarDateSystem, value)) {
    return CalendarDateSystem[value as keyof typeof CalendarDateSystem];
  }

  throw new Error(`Unknown calendar date system: ${value}`);
}

function toCalendarEventSourceSection(
  value: OfficialCalendarEvent1405["sourceSection"],
): CalendarEventSourceSection {
  if (Object.prototype.hasOwnProperty.call(CalendarEventSourceSection, value)) {
    return CalendarEventSourceSection[
      value as keyof typeof CalendarEventSourceSection
    ];
  }

  throw new Error(`Unknown calendar event source section: ${value}`);
}

function validateOfficialEvents(): string[] {
  const errors: string[] = [];
  const eventKeys = new Set<string>();

  if (OFFICIAL_1405_EVENTS.length !== OFFICIAL_1405_EXPECTED_TOTAL_EVENTS) {
    errors.push(
      `Expected ${OFFICIAL_1405_EXPECTED_TOTAL_EVENTS} official events, received ${OFFICIAL_1405_EVENTS.length}.`,
    );
  }

  for (const [index, event] of OFFICIAL_1405_EVENTS.entries()) {
    const context = `Event index ${index}`;

    if (!event.eventKey?.trim()) {
      errors.push(`${context}: eventKey must be non-empty.`);
    } else if (eventKeys.has(event.eventKey)) {
      errors.push(`${context}: duplicate eventKey '${event.eventKey}'.`);
    } else {
      eventKeys.add(event.eventKey);
    }

    if (!event.jalaliDateKey.startsWith(`${TARGET_JALALI_YEAR}-`)) {
      errors.push(
        `${context}: jalaliDateKey '${event.jalaliDateKey}' must start with '${TARGET_JALALI_YEAR}-'.`,
      );
    }
  }

  return errors;
}

function assertOfficialEventsAreValid() {
  const errors = validateOfficialEvents();

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    console.error("Official 1405 calendar event import validation failed.");
    process.exit(1);
  }
}

function getJalaliMonth(jalaliDateKey: string): number {
  return Number(jalaliDateKey.slice(5, 7));
}

function countEventsByMonth(
  events: OfficialCalendarEvent1405[],
): Map<number, number> {
  const counts = new Map<number, number>();

  for (const event of events) {
    const month = getJalaliMonth(event.jalaliDateKey);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }

  return counts;
}

function printMonthCounts(title: string, counts: Map<number, number>) {
  console.log(`${title}:`);
  for (let month = 1; month <= 12; month += 1) {
    console.log(
      `  ${String(month).padStart(2, "0")}: ${counts.get(month) ?? 0}`,
    );
  }
}

function printDryRun(options: CliOptions) {
  const holidayEvents = OFFICIAL_1405_EVENTS.filter((event) => event.isHoliday);
  const uniqueEventDates = new Set(
    OFFICIAL_1405_EVENTS.map((event) => event.jalaliDateKey),
  );
  const uniqueOfficialHolidayDates = new Set(
    holidayEvents.map((event) => event.jalaliDateKey),
  );

  console.log(`Target Jalali year: ${options.year}`);
  console.log(`Source name: ${options.sourceName}`);
  console.log(`Source version: ${options.sourceVersion}`);
  console.log(`Total official events: ${OFFICIAL_1405_EVENTS.length}`);
  console.log(`Holiday event count: ${holidayEvents.length}`);
  console.log(`Unique event date count: ${uniqueEventDates.size}`);
  console.log(
    `Unique official holiday date count: ${uniqueOfficialHolidayDates.size}`,
  );
  printMonthCounts(
    "Event counts by month",
    countEventsByMonth(OFFICIAL_1405_EVENTS),
  );
  printMonthCounts(
    "Holiday event counts by month",
    countEventsByMonth(holidayEvents),
  );
}

function groupHolidayEventsByJalaliDateKey(): Map<
  string,
  OfficialCalendarEvent1405[]
> {
  const holidayEventsByDate = new Map<string, OfficialCalendarEvent1405[]>();

  for (const event of OFFICIAL_1405_EVENTS) {
    if (!event.isHoliday) continue;

    const existingEvents = holidayEventsByDate.get(event.jalaliDateKey) ?? [];
    existingEvents.push(event);
    holidayEventsByDate.set(event.jalaliDateKey, existingEvents);
  }

  for (const events of holidayEventsByDate.values()) {
    events.sort((first, second) => first.displayOrder - second.displayOrder);
  }

  return holidayEventsByDate;
}

async function runImport(prisma: PrismaClient, options: CliOptions) {
  return prisma.$transaction(async (tx) => {
    const calendarDays = await tx.calendarDay.findMany({
      where: {
        jalaliYear: TARGET_JALALI_YEAR,
      },
      select: {
        id: true,
        jalaliDateKey: true,
        isWeeklyOffDay: true,
        isManualHoliday: true,
        isForcedWorkday: true,
      },
    });

    if (calendarDays.length !== EXPECTED_CALENDAR_DAY_ROWS) {
      throw new Error(
        `Expected 365 CalendarDay rows for Jalali year 1405, found ${calendarDays.length}.`,
      );
    }

    const dayByJalaliDateKey = new Map(
      calendarDays.map((day) => [day.jalaliDateKey, day]),
    );
    const missingJalaliDateKeys = Array.from(
      new Set(
        OFFICIAL_1405_EVENTS.map((event) => event.jalaliDateKey).filter(
          (jalaliDateKey) => !dayByJalaliDateKey.has(jalaliDateKey),
        ),
      ),
    ).sort();

    if (missingJalaliDateKeys.length > 0) {
      throw new Error(
        `Missing CalendarDay rows for jalaliDateKeys: ${missingJalaliDateKeys.join(", ")}`,
      );
    }

    const batch = await tx.calendarImportBatch.create({
      data: {
        year: TARGET_JALALI_YEAR,
        yearSystem: CalendarDateSystem.JALALI,
        sourceName: options.sourceName,
        sourceUrl: options.sourceUrl,
        sourceVersion: options.sourceVersion,
        status: CalendarImportStatus.IMPORTED,
        importedAt: new Date(),
        notes: IMPORT_BATCH_NOTES,
      },
    });

    const deleteResult = await tx.calendarEvent.deleteMany({
      where: {
        sourceName: OLD_FIXED_HOLIDAY_SOURCE_NAME,
        sourceVersion: OLD_FIXED_HOLIDAY_SOURCE_VERSION,
        calendarDay: {
          jalaliYear: TARGET_JALALI_YEAR,
        },
      },
    });

    let createdCalendarEventRows = 0;
    let updatedCalendarEventRows = 0;

    for (const event of OFFICIAL_1405_EVENTS) {
      const calendarDay = dayByJalaliDateKey.get(event.jalaliDateKey)!;
      const eventData = {
        calendarDayId: calendarDay.id,
        title: event.title,
        displayOrder: event.displayOrder,
        type: toCalendarEventType(event.type),
        calendarType: toCalendarDateSystem(event.calendarType),
        isHoliday: event.isHoliday,
        isOfficial: true,
        referenceDate: event.referenceDate ?? null,
        description: OFFICIAL_EVENT_DESCRIPTION,
        sourceName: options.sourceName,
        sourceVersion: options.sourceVersion,
        sourcePage: event.sourcePage,
        sourceSection: toCalendarEventSourceSection(event.sourceSection),
        importBatchId: batch.id,
      };

      const existingEvent = await tx.calendarEvent.findUnique({
        where: {
          eventKey: event.eventKey,
        },
        select: {
          id: true,
        },
      });

      await tx.calendarEvent.upsert({
        where: {
          eventKey: event.eventKey,
        },
        create: {
          eventKey: event.eventKey,
          ...eventData,
        },
        update: eventData,
      });

      if (existingEvent) {
        updatedCalendarEventRows += 1;
      } else {
        createdCalendarEventRows += 1;
      }
    }

    const holidayEventsByDate = groupHolidayEventsByJalaliDateKey();
    let updatedCalendarDayRows = 0;

    for (const calendarDay of calendarDays) {
      const officialHolidayTitles =
        holidayEventsByDate
          .get(calendarDay.jalaliDateKey)
          ?.map((event) => event.title) ?? [];
      const nextIsOfficialHoliday = officialHolidayTitles.length > 0;
      const nextHolidayTitle = nextIsOfficialHoliday
        ? officialHolidayTitles.join("، ")
        : null;
      const nextIsWorkday = resolveCalendarWorkday({
        isWeeklyOffDay: calendarDay.isWeeklyOffDay,
        isOfficialHoliday: nextIsOfficialHoliday,
        isManualHoliday: calendarDay.isManualHoliday,
        isForcedWorkday: calendarDay.isForcedWorkday,
      });

      await tx.calendarDay.update({
        where: { id: calendarDay.id },
        data: {
          isOfficialHoliday: nextIsOfficialHoliday,
          holidayTitle: nextHolidayTitle,
          isWorkday: nextIsWorkday,
          sourceName: options.sourceName,
          sourceVersion: options.sourceVersion,
        },
      });
      updatedCalendarDayRows += 1;
    }

    return {
      deletedOldFixedHolidayEvents: deleteResult.count,
      createdCalendarEventRows,
      updatedCalendarEventRows,
      updatedCalendarDayRows,
      officialHolidayDateCount: holidayEventsByDate.size,
      holidayEventCount: OFFICIAL_1405_EVENTS.filter((event) => event.isHoliday)
        .length,
      importBatchId: batch.id,
    };
  });
}

async function main() {
  const options = parseCliOptions();
  assertOfficialEventsAreValid();

  if (options.isDryRun) {
    printDryRun(options);
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
    const result = await runImport(prisma, options);

    console.log("Imported official 1405 calendar events.");
    console.log(`Total official events: ${OFFICIAL_1405_EVENTS.length}`);
    console.log(`Holiday events: ${result.holidayEventCount}`);
    console.log(`Official holiday dates: ${result.officialHolidayDateCount}`);
    console.log(
      `Deleted old fixed-holiday events: ${result.deletedOldFixedHolidayEvents}`,
    );
    console.log(
      `Created CalendarEvent rows: ${result.createdCalendarEventRows}`,
    );
    console.log(
      `Updated CalendarEvent rows: ${result.updatedCalendarEventRows}`,
    );
    console.log(`Updated CalendarDay rows: ${result.updatedCalendarDayRows}`);
    console.log(`Import batch id: ${result.importBatchId}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
