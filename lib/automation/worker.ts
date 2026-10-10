import { Client } from "pg";
import type {
  AutomationConfig,
  AutomationJobRun,
  Prisma,
  PrismaClient,
} from "@/app/generated/prisma/client";
import { reconcileAttendance } from "@/lib/attendance/reconciliation";
import { getJalaliPartsFromUtcDate } from "@/lib/calendar/calendar-date";
import { scheduleCalendarImports } from "./calendar-scheduling";
import { getAutomationConfig, credentialStatus } from "./config";
import { AutomationError } from "./http";
import { BaleClient, NextcloudClient } from "./integrations";
import {
  checkPublicCapability,
  cleanError,
  ensureJob,
  flushAlerts,
  queueAlert,
  runJob,
  uploadArtifact,
} from "./jobs";
import {
  deliverReport,
  revokeExpiredShares,
  sendGuestReminder,
} from "./reporter";
import { generateReportPdf } from "@/lib/reporter/generate-pdf";
import { synchronizeCalendar } from "./calendar";
import { nextReportRetry, reporterSlots, tehranClock } from "./schedule";
const WORKER_LOCK = 641706;
export async function withWorkerLock<T>(work: () => Promise<T>) {
  const connection = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });
  await connection.connect();
  let acquired = false;
  try {
    acquired = (
      await connection.query("SELECT pg_try_advisory_lock($1) AS locked", [
        WORKER_LOCK,
      ])
    ).rows[0].locked;
    if (!acquired) return { skipped: true };
    return await work();
  } finally {
    if (acquired)
      await connection.query("SELECT pg_advisory_unlock($1)", [WORKER_LOCK]);
    await connection.end();
  }
}
function isRequested(job: AutomationJobRun) {
  return !!(job.metadata as { requestedBy?: string } | null)?.requestedBy;
}
export type WorkerDependencies = {
  cloud?: NextcloudClient;
  bale?: BaleClient;
  pdf?: typeof generateReportPdf;
  calendar?: typeof synchronizeCalendar;
};
async function executeJob(
  db: PrismaClient,
  config: AutomationConfig,
  job: AutomationJobRun,
  now: Date,
  deps: WorkerDependencies = {},
) {
  const clock = tehranClock(now);
  const reporter = job.jobType.startsWith("REPORT_");
  const retry = reporter
    ? nextReportRetry(config, now)
    : new Date(
        now.getTime() +
          (job.jobType === "SHARE_CLEANUP" ||
          job.jobType === "ATTENDANCE_RECONCILE"
            ? 60000
            : job.jobType === "ARTIFACT_SYNC"
              ? 300000
              : 86400000),
      );
  const succeeded = await runJob(
    db,
    job,
    async (stage) => {
      if (job.jobType === "ATTENDANCE_RECONCILE") {
        await stage("RECONCILING");
        await reconcileAttendance(db, { now });
        return;
      }
      if (job.jobType === "BALE_HEALTH") {
        await stage("GET_ME");
        await (deps.bale ?? new BaleClient()).health();
        return;
      }
      if (
        job.jobType === "CALENDAR_IMPORT" ||
        job.jobType === "CALENDAR_DRY_RUN"
      ) {
        await (deps.calendar ?? synchronizeCalendar)(
          db,
          config,
          Number(job.target),
          stage,
          job.jobType === "CALENDAR_DRY_RUN",
        );
        return;
      }
      const cloud = deps.cloud ?? new NextcloudClient(config);
      switch (job.jobType) {
        case "NEXTCLOUD_HEALTH":
          await stage("WEBDAV");
          await cloud.health();
          await stage("PUBLIC_CAPABILITY");
          {
            const state = await checkPublicCapability(db, config, cloud, now);
            if (state !== "AVAILABLE")
              throw new AutomationError(
                state === "DISABLED" ? "PUBLIC_SHARING_DISABLED" : state,
              );
          }
          break;
        case "PUBLIC_CAPABILITY":
          {
            const state = await checkPublicCapability(db, config, cloud, now);
            if (state !== "AVAILABLE")
              throw new AutomationError(
                state === "DISABLED" ? "PUBLIC_SHARING_DISABLED" : state,
              );
          }
          break;
        case "TALK_TEST":
          if (job.stage === "TALK_TEST_SENT") break;
          if (job.stage === "TALK_TEST")
            throw new AutomationError("AMBIGUOUS_DELIVERY", null, true);
          await stage("TALK_TEST");
          {
            const messageId = await cloud.talk(
              "آزمون اتصال فنی اتوماسیون StoreX",
              job.executionKey,
            );
            await db.automationJobRun.update({
              where: { id: job.id },
              data: { stage: "TALK_TEST_SENT", metadata: { messageId } },
            });
          }
          break;
        case "SHARE_CLEANUP":
          await stage("REVOKING_EXPIRED");
          await revokeExpiredShares(db, cloud, now);
          break;
        case "ARTIFACT_SYNC":
          await stage("UPLOADING");
          await uploadArtifact(db, job.target, cloud);
          break;
        case "REPORT_DELIVERY":
          if (job.target <= clock.dateKey)
            throw new AutomationError("REPORT_TARGET_NO_LONGER_FUTURE");
          await deliverReport(
            db,
            config,
            job.target,
            stage,
            now,
            cloud,
            deps.bale,
            deps.pdf,
          );
          break;
        case "REPORT_REMINDER_1":
        case "REPORT_REMINDER_2":
          if (job.target <= clock.dateKey)
            throw new AutomationError("REPORT_TARGET_NO_LONGER_FUTURE");
          await sendGuestReminder(
            db,
            config,
            job.target,
            job.id,
            stage,
            now,
            deps.bale,
          );
          break;
        default:
          throw new AutomationError("UNSUPPORTED_JOB_TYPE");
      }
    },
    now,
    retry ?? undefined,
  );
  const updated = await db.automationJobRun.findUniqueOrThrow({
    where: { id: job.id },
  });
  if (succeeded) {
    if (job.attempt > 0 && job.jobType.startsWith("CALENDAR"))
      await queueAlert(
        db,
        "CALENDAR",
        job.target,
        `calendar-recovered:${job.id}`,
        `RECOVERED: تقویم ${job.target}؛ مرحله ${updated.stage} موفق شد.`,
      );
    return;
  }
  if (
    updated.status === "MANUAL_ACTION_REQUIRED" ||
    updated.status === "RETRYING" ||
    updated.status === "BLOCKED"
  ) {
    if (job.jobType === "REPORT_DELIVERY") {
      await queueAlert(
        db,
        "REPORTER",
        job.target,
        `reporter-first:${job.target}`,
        `خطای تحویل گزارش ${job.target}: ${updated.errorCode}؛ مرحله ${updated.stage}؛ اجرا ${job.id}`,
      );
      if (!retry) {
        await db.automationJobRun.update({
          where: { id: job.id },
          data: {
            status:
              updated.status === "MANUAL_ACTION_REQUIRED"
                ? updated.status
                : "FAILED",
            nextRetryAt: null,
          },
        });
        await queueAlert(
          db,
          "REPORTER",
          job.target,
          `reporter-final:${job.target}`,
          `نیاز به اقدام مسئول: تحویل گزارش ${job.target} پس از آخرین نوبت انجام نشد؛ ${updated.errorCode}؛ اجرا ${job.id}`,
        );
      }
      await db.reportDelivery.updateMany({
        where: { reportDateKey: job.target, status: { not: "SUCCESS" } },
        data: {
          status:
            !retry && updated.status !== "MANUAL_ACTION_REQUIRED"
              ? "FAILED"
              : updated.status,
          stage: updated.stage === "DELIVERING" ? "DELIVERING" : updated.stage,
          nextRetryAt:
            updated.status === "MANUAL_ACTION_REQUIRED" ? null : retry,
        },
      });
    } else if (job.jobType.startsWith("CALENDAR")) {
      await queueAlert(
        db,
        "CALENDAR",
        job.target,
        `calendar-failure:${job.target}:${clock.dateKey}`,
        `خطای تقویم سال ${job.target}: ${updated.errorCode}؛ مرحله ${updated.stage}؛ اجرا ${job.id}؛ تلاش ${updated.attempt}؛ نوبت بعد ${updated.nextRetryAt?.toISOString() ?? "بررسی دستی"}`,
      );
    }
  }
}
async function recurringJob(
  db: PrismaClient,
  type: string,
  key: string,
  target: string,
  now: Date,
) {
  let job = await ensureJob(db, type, key, target);
  if (
    job.status === "SUCCESS" &&
    job.finishedAt &&
    Math.floor(job.finishedAt.getTime() / 60000) <
      Math.floor(now.getTime() / 60000)
  )
    job = await db.automationJobRun.update({
      where: { id: job.id },
      data: { status: "PENDING" },
    });
  return job;
}
export async function workerTick(
  db: PrismaClient,
  now = new Date(),
  deps: WorkerDependencies = {},
) {
  let config = await getAutomationConfig(db);
  const clock = tehranClock(now),
    jalali = getJalaliPartsFromUtcDate(new Date(clock.dateKey + "T00:00:00Z"));
  const attendance = await recurringJob(
    db,
    "ATTENDANCE_RECONCILE",
    `attendance-reconcile:${clock.dateKey}`,
    clock.dateKey,
    now,
  );
  await executeJob(db, config, attendance, now, deps);
  const credentials = credentialStatus();
  if (credentials.nextcloud && config.nextcloudBaseUrl) {
    await ensureJob(
      db,
      "PUBLIC_CAPABILITY",
      `public-capability:${clock.dateKey}`,
      clock.dateKey,
    );
    await recurringJob(
      db,
      "SHARE_CLEANUP",
      `share-cleanup:${clock.dateKey}`,
      clock.dateKey,
      now,
    );
    const pending = await db.automationArtifact.findMany({
      where: { uploadState: "PENDING", nextcloudPath: { not: null } },
      select: { id: true },
      take: 20,
    });
    for (const a of pending)
      await ensureJob(db, "ARTIFACT_SYNC", `artifact-sync:${a.id}`, a.id);
  }
  if (config.calendarEnabled) await scheduleCalendarImports(db, jalali, now);
  const today = await db.calendarDay.findUnique({
    where: { dateKey: clock.dateKey },
    select: { isWorkday: true },
  });
  if (config.reporterEnabled && today?.isWorkday) {
    const next = await db.calendarDay.findFirst({
      where: { dateKey: { gt: clock.dateKey }, isWorkday: true },
      orderBy: { date: "asc" },
      select: { dateKey: true, jalaliDateKey: true },
    });
    if (next) {
      const delivered = await db.reportDelivery.findUnique({
        where: { reportDateKey: next.dateKey },
        select: { status: true },
      });
      if (delivered?.status !== "SUCCESS") {
        const slots = reporterSlots(config, now),
          metadata = { scheduleDateKey: clock.dateKey };
        if (slots.reminder1)
          await ensureJob(
            db,
            "REPORT_REMINDER_1",
            `report-reminder-1:${next.jalaliDateKey}`,
            next.dateKey,
            metadata,
          );
        if (slots.reminder2)
          await ensureJob(
            db,
            "REPORT_REMINDER_2",
            `report-reminder-2:${next.jalaliDateKey}`,
            next.dateKey,
            metadata,
          );
        if (slots.delivery)
          await ensureJob(
            db,
            "REPORT_DELIVERY",
            `report-send:${next.jalaliDateKey}`,
            next.dateKey,
            metadata,
          );
      }
    } else
      await queueAlert(
        db,
        "REPORTER",
        clock.dateKey,
        `calendar-missing-future:${clock.dateKey}`,
        "تقویم روز کاری آینده ندارد؛ گزارش نیاز به بررسی دستی دارد.",
      );
  }
  const jobs = await db.automationJobRun.findMany({
    where: {
      status: { in: ["PENDING", "RUNNING", "RETRYING", "BLOCKED"] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  // Capability/expiry maintenance always continues even when new deliveries are paused.
  jobs.sort(
    (a, b) =>
      Number(b.jobType === "SHARE_CLEANUP") -
      Number(a.jobType === "SHARE_CLEANUP"),
  );
  for (const job of jobs) {
    if (job.jobType.startsWith("REPORT_") && !isRequested(job)) {
      if (!config.reporterEnabled) continue;
      const scheduleDate = (job.metadata as { scheduleDateKey?: string } | null)
        ?.scheduleDateKey;
      if (scheduleDate !== clock.dateKey || !today?.isWorkday) {
        await db.automationJobRun.update({
          where: { id: job.id },
          data: {
            status: "SKIPPED",
            errorCode: "STALE_SCHEDULE",
            finishedAt: now,
            nextRetryAt: null,
          },
        });
        continue;
      }
      if (
        job.jobType.startsWith("REPORT_REMINDER") &&
        clock.time >= config.deliveryTime
      ) {
        await db.automationJobRun.update({
          where: { id: job.id },
          data: {
            status: "SKIPPED",
            errorCode: "REMINDER_WINDOW_CLOSED",
            finishedAt: now,
          },
        });
        continue;
      }
    }
    if (
      job.jobType === "CALENDAR_IMPORT" &&
      !config.calendarEnabled &&
      !isRequested(job)
    )
      continue;
    await executeJob(db, config, job, now, deps);
    config = await getAutomationConfig(db);
  }
  if (
    credentials.nextcloud &&
    config.technicalConversation &&
    config.nextcloudBaseUrl
  ) {
    try {
      await flushAlerts(db, deps.cloud ?? new NextcloudClient(config));
    } catch (e) {
      console.error(
        JSON.stringify({ jobType: "TALK_ALERT_FLUSH", ...cleanError(e) }),
      );
    }
  }
  const health = {
    ...(config.health &&
    typeof config.health === "object" &&
    !Array.isArray(config.health)
      ? config.health
      : {}),
    workerLastTick: now.toISOString(),
    credentialsConfigured: credentials,
  };
  await db.automationConfig.update({
    where: { id: config.id },
    data: { health: health as Prisma.InputJsonValue },
  });
  return { date: clock.dateKey, time: clock.time };
}
