import "dotenv/config";
import { getAttendanceReport } from "../lib/reports/get-attendance-report";
import { parseDateKey } from "../lib/date/date-key";
import { prisma } from "../lib/prisma";

type AttendanceReport = Awaited<ReturnType<typeof getAttendanceReport>>;
type CalendarExcludedDay = AttendanceReport["calendarExcludedDays"][number];

function requireDate(dateKey: string): Date {
  const date = parseDateKey(dateKey);

  if (!date) {
    throw new Error(`Expected fixed test date ${dateKey} to parse.`);
  }

  return date;
}

function assertCondition(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function findExcludedDay(report: AttendanceReport, jalaliDateKey: string): CalendarExcludedDay {
  const excludedDay = report.calendarExcludedDays.find((day) => day.jalaliDateKey === jalaliDateKey);

  if (!excludedDay) {
    throw new Error(`Expected report calendarExcludedDays to include ${jalaliDateKey}.`);
  }

  return excludedDay;
}

async function checkFarvardinReportCalendarFiltering(): Promise<void> {
  const report = await getAttendanceReport(requireDate("2026-03-21"), requireDate("2026-03-27"));

  assertCondition(
    report.dailySummary.length === 1,
    `Expected Farvardin report dailySummary.length to be 1, received ${report.dailySummary.length}.`,
  );

  assertCondition(
    report.userRows.length === 0 || report.userRows.length % report.dailySummary.length === 0,
    `Expected Farvardin userRows.length (${report.userRows.length}) to be a multiple of dailySummary.length (${report.dailySummary.length}).`,
  );

  assertCondition(
    report.dailySummary.some((day) => day.dateKey === "2026-03-25"),
    "Expected Farvardin report dailySummary to include 2026-03-25.",
  );

  assertCondition(
    report.dailySummary.every((day) => day.dateKey === "2026-03-25"),
    `Expected Farvardin report dailySummary to include only 2026-03-25, received ${JSON.stringify(
      report.dailySummary.map((day) => day.dateKey),
    )}.`,
  );

  assertCondition(
    report.calendarExcludedDays.length === 6,
    `Expected Farvardin report calendarExcludedDays.length to be 6, received ${report.calendarExcludedDays.length}.`,
  );

  const farvardinFirstDay = findExcludedDay(report, "1405-01-01");
  assertCondition(farvardinFirstDay.isOfficialHoliday === true, "Expected 1405-01-01 to be an official holiday.");

  const farvardinSixthDay = findExcludedDay(report, "1405-01-06");
  assertCondition(farvardinSixthDay.isWeeklyOffDay === true, "Expected 1405-01-06 to be a weekly off-day.");

  const farvardinSeventhDay = findExcludedDay(report, "1405-01-07");
  assertCondition(farvardinSeventhDay.isWeeklyOffDay === true, "Expected 1405-01-07 to be a weekly off-day.");

  console.log("Farvardin report calendar filtering verified.");
}

async function checkKhordadOfficialHolidayReportFiltering(): Promise<void> {
  const report = await getAttendanceReport(requireDate("2026-06-01"), requireDate("2026-06-07"));

  const khordadFourteenth = findExcludedDay(report, "1405-03-14");
  assertCondition(khordadFourteenth.isOfficialHoliday === true, "Expected 1405-03-14 to be an official holiday.");
  assertCondition(
    khordadFourteenth.holidayTitle?.includes("عید سعید غدیر خم") === true,
    `Expected 1405-03-14 holidayTitle to include عید سعید غدیر خم, received ${khordadFourteenth.holidayTitle ?? "null"}.`,
  );

  const khordadFifteenth = findExcludedDay(report, "1405-03-15");
  assertCondition(khordadFifteenth.isOfficialHoliday === true, "Expected 1405-03-15 to be an official holiday.");

  assertCondition(
    !report.dailySummary.some((day) => day.dateKey === "2026-06-04"),
    "Expected Khordad report dailySummary not to include 2026-06-04.",
  );
  assertCondition(
    !report.dailySummary.some((day) => day.dateKey === "2026-06-05"),
    "Expected Khordad report dailySummary not to include 2026-06-05.",
  );

  console.log("Khordad official holiday report filtering verified.");
}

async function checkEsfandOfficialHolidayReportFiltering(): Promise<void> {
  const report = await getAttendanceReport(requireDate("2027-03-10"), requireDate("2027-03-20"));

  const esfandNineteenth = findExcludedDay(report, "1405-12-19");
  assertCondition(esfandNineteenth.isOfficialHoliday === true, "Expected 1405-12-19 to be an official holiday.");

  const esfandTwentieth = findExcludedDay(report, "1405-12-20");
  assertCondition(esfandTwentieth.isOfficialHoliday === true, "Expected 1405-12-20 to be an official holiday.");

  const esfandTwentyNinth = findExcludedDay(report, "1405-12-29");
  assertCondition(esfandTwentyNinth.isOfficialHoliday === true, "Expected 1405-12-29 to be an official holiday.");

  assertCondition(
    !report.dailySummary.some((day) => day.dateKey === "2027-03-10"),
    "Expected Esfand report dailySummary not to include 2027-03-10.",
  );
  assertCondition(
    !report.dailySummary.some((day) => day.dateKey === "2027-03-11"),
    "Expected Esfand report dailySummary not to include 2027-03-11.",
  );
  assertCondition(
    !report.dailySummary.some((day) => day.dateKey === "2027-03-20"),
    "Expected Esfand report dailySummary not to include 2027-03-20.",
  );

  console.log("Esfand official holiday report filtering verified.");
}

async function main(): Promise<void> {
  await checkFarvardinReportCalendarFiltering();
  await checkKhordadOfficialHolidayReportFiltering();
  await checkEsfandOfficialHolidayReportFiltering();

  console.log("Calendar reports check passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
