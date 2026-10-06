import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import {
  getAutomationConfig,
  credentialStatus,
} from "../lib/automation/config";
import { cleanError, ensureJob, runJob } from "../lib/automation/jobs";
import { synchronizeCalendar } from "../lib/automation/calendar";
import { withWorkerLock } from "../lib/automation/worker";
import { reconcileAttendance } from "../lib/attendance/reconciliation";
import { getNextDayMealReport } from "../lib/reporter/next-day-report";
async function main() {
  const args = process.argv.slice(2),
    command = args[0] ?? "--status";
  if (args.some((a, i) => i > 0 && !/^--year=\d{4}$/.test(a)))
    throw new Error("INVALID_COMMAND");
  if (command === "--status") {
    const c = await prisma.automationConfig.findUnique({
      where: { id: "singleton" },
    });
    console.log(
      JSON.stringify(
        {
          reporterEnabled: c?.reporterEnabled ?? false,
          calendarEnabled: c?.calendarEnabled ?? false,
          publicSharingState: c?.publicSharingState ?? "UNKNOWN",
          capabilityCheckedAt: c?.capabilityCheckedAt,
          health: c?.health,
          credentials: credentialStatus(),
        },
        null,
        2,
      ),
    );
    return;
  }
  if (command === "--dry-run=reporter") {
    const report = await getNextDayMealReport();
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          dateKey: report.reportDateKey,
          jalaliDateKey: report.policy.jalaliDateKey,
          isWorkday: report.policy.isWorkday,
          totals: report.totals,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (!["--reconcile", "--dry-run=calendar"].includes(command))
    throw new Error("INVALID_COMMAND");
  const year = Number(args.find((a) => a.startsWith("--year="))?.slice(7));
  if (
    command === "--dry-run=calendar" &&
    (!Number.isInteger(year) || year < 1200 || year > 1700)
  )
    throw new Error("INVALID_YEAR");
  await withWorkerLock(async () => {
    const type =
        command === "--reconcile" ? "ATTENDANCE_RECONCILE" : "CALENDAR_DRY_RUN",
      job = await ensureJob(
        prisma,
        type,
        `cli:${type}:${randomUUID()}`,
        type === "CALENDAR_DRY_RUN" ? String(year) : "future-attendance",
        { requestedBy: "CLI" },
      );
    const config = await getAutomationConfig(prisma);
    const ok = await runJob(prisma, job, async (stage) => {
      if (type === "ATTENDANCE_RECONCILE") {
        await stage("RECONCILING");
        await reconcileAttendance(prisma);
      } else await synchronizeCalendar(prisma, config, year, stage, true);
    });
    console.log(
      JSON.stringify({
        jobId: job.id,
        result: ok ? "SUCCESS" : "CHECK_JOB_HISTORY",
      }),
    );
    if (!ok) process.exitCode = 1;
  });
}
main()
  .catch((error) => {
    console.error(JSON.stringify(cleanError(error)));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
