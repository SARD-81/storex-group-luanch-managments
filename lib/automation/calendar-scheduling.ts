import type { PrismaClient } from "@/app/generated/prisma/client";
import { buildBaseJalaliYearDays } from "@/lib/calendar/calendar-date";
import { getTehranDateKey } from "@/lib/date/tehran-time";
import { OFFICIAL_PARSER_VERSION } from "@/lib/calendar/parser-certification";
import { ensureJob } from "./jobs";
/** Current-year catch-up is independent of the Esfand next-year check. */
export async function scheduleCalendarImports(
  db: PrismaClient,
  jalali: { year: number; month: number },
  now: Date,
) {
  const sourceName = `tehran-university-official-calendar-${jalali.year}`;
  const [verified, days] = await Promise.all([
    db.calendarDataset.count({
      where: {
        year: jalali.year,
        sourceName,
        status: "VERIFIED",
        parserVersion: OFFICIAL_PARSER_VERSION,
      },
    }),
    db.calendarDay.count({
      where: { jalaliYear: jalali.year, verifiedAt: { not: null } },
    }),
  ]);
  const years = new Set<number>();
  if (!verified || days !== buildBaseJalaliYearDays(jalali.year).length)
    years.add(jalali.year);
  if (jalali.month === 12) years.add(jalali.year + 1);
  for (const year of years) {
    const role = year === jalali.year ? "CURRENT_YEAR" : "NEXT_YEAR";
    const job = await ensureJob(
      db,
      "CALENDAR_IMPORT",
      `calendar-import:${year}`,
      String(year),
      { calendarRole: role },
    );
    const metadata = job.metadata as { calendarRole?: string } | null;
    const changedToCurrent =
      role === "CURRENT_YEAR" && metadata?.calendarRole !== role;
    if (
      changedToCurrent ||
      (job.status === "SUCCESS" &&
        job.finishedAt &&
        getTehranDateKey(job.finishedAt) < getTehranDateKey(now))
    ) {
      // Transition occurs once, so Nowruz can release an old next-year backoff
      // without repeatedly resetting the current-year retry deadline.
      if (job.status !== "MANUAL_ACTION_REQUIRED")
        await db.automationJobRun.update({
          where: { id: job.id },
          data: {
            status: "PENDING",
            nextRetryAt: null,
            metadata: { ...metadata, calendarRole: role },
          },
        });
    }
  }
}
