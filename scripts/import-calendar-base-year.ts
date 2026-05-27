import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  CalendarDateSystem,
  CalendarImportStatus,
  PrismaClient,
} from "../app/generated/prisma/client";
import { buildBaseJalaliYearDays } from "../lib/calendar/calendar-date";
import { isBaseWeeklyOffDay, resolveCalendarWorkday } from "../lib/calendar/calendar-workday";

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

  if (!/^\d+$/.test(yearRaw)) {
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

async function main() {
  const targetYear = parseYearArg();
  const isDryRun = process.argv.includes("--dry-run");
  const sourceName = parseArgValue("--source-name=") ?? "internal-base-jalali-calendar";
  const sourceVersion = parseArgValue("--source-version=") ?? "base-v1";

  const generatedRows = buildBaseJalaliYearDays(targetYear);

  let baseWorkdays = 0;
  let weeklyOffDays = 0;

  for (const row of generatedRows) {
    const isWeeklyOffDay = isBaseWeeklyOffDay(row.dayOfWeek);
    const isWorkday = resolveCalendarWorkday({
      isWeeklyOffDay,
      isOfficialHoliday: false,
      isManualHoliday: false,
      isForcedWorkday: false,
    });

    if (isWeeklyOffDay) weeklyOffDays += 1;
    if (isWorkday) baseWorkdays += 1;
  }

  const firstRow = generatedRows[0];
  const lastRow = generatedRows[generatedRows.length - 1];

  if (isDryRun) {
    console.log(`Target Jalali year: ${targetYear}`);
    console.log(`Row count: ${generatedRows.length}`);
    console.log(`First row: ${firstRow.dateKey} | ${firstRow.jalaliDateKey}`);
    console.log(`Last row: ${lastRow.dateKey} | ${lastRow.jalaliDateKey}`);
    console.log(`Base workdays: ${baseWorkdays}`);
    console.log(`Weekly off-days: ${weeklyOffDays}`);
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
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.calendarImportBatch.create({
        data: {
          year: targetYear,
          yearSystem: CalendarDateSystem.JALALI,
          sourceName,
          sourceVersion,
          status: CalendarImportStatus.IMPORTED,
          importedAt: new Date(),
          notes:
            "Base Jalali calendar import. Official holidays and events are not included in this phase.",
        },
      });

      const dateKeys = generatedRows.map((row) => row.dateKey);

      const existingRows = await tx.calendarDay.findMany({
        where: {
          dateKey: {
            in: dateKeys,
          },
        },
        select: {
          dateKey: true,
          isOfficialHoliday: true,
          isManualHoliday: true,
          isForcedWorkday: true,
        },
      });

      const existingByDateKey = new Map(existingRows.map((row) => [row.dateKey, row]));

      for (const row of generatedRows) {
        const existing = existingByDateKey.get(row.dateKey);
        const isWeeklyOffDay = isBaseWeeklyOffDay(row.dayOfWeek);
        const isOfficialHoliday = existing?.isOfficialHoliday ?? false;
        const isManualHoliday = existing?.isManualHoliday ?? false;
        const isForcedWorkday = existing?.isForcedWorkday ?? false;
        const isWorkday = resolveCalendarWorkday({
          isWeeklyOffDay,
          isOfficialHoliday,
          isManualHoliday,
          isForcedWorkday,
        });

        await tx.calendarDay.upsert({
          where: { dateKey: row.dateKey },
          create: {
            date: row.date,
            dateKey: row.dateKey,
            gregorianYear: row.gregorianYear,
            gregorianMonth: row.gregorianMonth,
            gregorianDay: row.gregorianDay,
            jalaliYear: row.jalaliYear,
            jalaliMonth: row.jalaliMonth,
            jalaliDay: row.jalaliDay,
            jalaliDateKey: row.jalaliDateKey,
            dayOfWeek: row.dayOfWeek,
            dayNameFa: row.dayNameFa,
            isWeeklyOffDay,
            isOfficialHoliday,
            isManualHoliday,
            isForcedWorkday,
            isWorkday,
            sourceName,
            sourceVersion,
            importBatchId: batch.id,
          },
          update: {
            date: row.date,
            gregorianYear: row.gregorianYear,
            gregorianMonth: row.gregorianMonth,
            gregorianDay: row.gregorianDay,
            jalaliYear: row.jalaliYear,
            jalaliMonth: row.jalaliMonth,
            jalaliDay: row.jalaliDay,
            jalaliDateKey: row.jalaliDateKey,
            dayOfWeek: row.dayOfWeek,
            dayNameFa: row.dayNameFa,
            isWeeklyOffDay,
            isWorkday,
            sourceName,
            sourceVersion,
            importBatchId: batch.id,
          },
        });
      }

      return {
        batchId: batch.id,
      };
    });

    console.log(`Imported base Jalali calendar year: ${targetYear}`);
    console.log(`Total generated days: ${generatedRows.length}`);
    console.log(`Created or updated days: ${generatedRows.length}`);
    console.log(`Base workdays: ${baseWorkdays}`);
    console.log(`Weekly off-days: ${weeklyOffDays}`);
    console.log(`Import batch id: ${result.batchId}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
