"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  automationConfigSchema,
  getAutomationConfig,
} from "@/lib/automation/config";
import { ensureJob } from "@/lib/automation/jobs";
import {
  attendanceAudit,
  attendanceTransaction,
} from "@/lib/attendance/reconciliation";
import {
  applyAnnualDataset,
  parseEmergencyCalendar,
  stageAnnualDataset,
} from "@/lib/calendar/datasets";
import { getTehranDateKey } from "@/lib/date/tehran-time";
const ROOT = "/settings/automations";
const allowedJobs = new Set([
  "REPORT_DELIVERY",
  "CALENDAR_IMPORT",
  "CALENDAR_DRY_RUN",
  "NEXTCLOUD_HEALTH",
  "BALE_HEALTH",
  "TALK_TEST",
  "PUBLIC_CAPABILITY",
  "ATTENDANCE_RECONCILE",
]);
function string(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}
function refresh() {
  for (const p of [
    ROOT,
    `${ROOT}/reporter`,
    `${ROOT}/calendar`,
    "/reporter/next-day",
    "/settings/attendance",
    "/reports",
    "/",
  ])
    revalidatePath(p);
}
export async function updateAutomationConfigAction(form: FormData) {
  const actor = await requireAdmin(),
    current = await getAutomationConfig(prisma),
    raw = { ...current };
  for (const key of [
    "nextcloudBaseUrl",
    "reportsDirectory",
    "calendarDirectory",
    "reportRecipient",
    "technicalConversation",
    "calendarSourceOverride",
    "reminder1",
    "reminder2",
    "deliveryTime",
    "retry1",
    "retry2",
    "finalRetry",
  ] as const)
    if (form.has(key)) raw[key] = string(form, key);
  const scope = string(form, "scope");
  if (scope === "reporter" || scope === "all")
    raw.reporterEnabled = form.has("reporterEnabled");
  if (scope === "calendar" || scope === "all")
    raw.calendarEnabled = form.has("calendarEnabled");
  const result = automationConfigSchema.safeParse(raw);
  if (!result.success) redirect(`${ROOT}?error=invalid-config`);
  const data = result.data;
  if (
    data.reporterEnabled &&
    (!data.nextcloudBaseUrl ||
      !data.reportRecipient ||
      !data.technicalConversation)
  )
    redirect(`${ROOT}?error=incomplete-config`);
  await attendanceTransaction(prisma, async (tx) => {
    await tx.automationConfig.update({
      where: { id: current.id },
      data: {
        ...data,
        ...(data.nextcloudBaseUrl !== current.nextcloudBaseUrl
          ? { publicSharingState: "UNKNOWN", capabilityCheckedAt: null }
          : {}),
      },
    });
    await attendanceAudit(tx, "AUTOMATION_CONFIG_CHANGED", actor, {
      reporterEnabled: data.reporterEnabled,
      calendarEnabled: data.calendarEnabled,
      fields: Object.keys(data),
    });
  });
  refresh();
  redirect(`${ROOT}?saved=config`);
}
export async function queueAutomationJobAction(form: FormData) {
  const actor = await requireAdmin(),
    jobType = string(form, "jobType");
  if (!allowedJobs.has(jobType)) redirect(`${ROOT}?error=invalid-job`);
  let target = getTehranDateKey();
  if (jobType.startsWith("CALENDAR")) {
    const year = Number(string(form, "year"));
    if (!Number.isInteger(year) || year < 1200 || year > 1700)
      redirect(`${ROOT}/calendar?error=invalid-year`);
    target = String(year);
  }
  if (jobType === "REPORT_DELIVERY") {
    const day = await prisma.calendarDay.findFirst({
      where: { dateKey: { gt: target }, isWorkday: true },
      orderBy: { date: "asc" },
    });
    if (!day) redirect(`${ROOT}/reporter?error=missing-calendar`);
    const sent = await prisma.reportDelivery.findUnique({
      where: { reportDateKey: day.dateKey },
    });
    if (sent?.status === "SUCCESS" || sent?.stage === "DELIVERING")
      redirect(`${ROOT}/reporter?error=delivery-review`);
    target = day.dateKey;
    // Same report identity; an admin run resumes rather than forks a second send.
    const job = await ensureJob(
      prisma,
      jobType,
      `report-send:${day.jalaliDateKey}`,
      target,
    );
    if (job.status === "RUNNING")
      redirect(`${ROOT}/reporter?error=already-running`);
    await prisma.automationJobRun.update({
      where: { id: job.id },
      data: {
        status: "PENDING",
        nextRetryAt: null,
        metadata: { requestedBy: actor.id },
      },
    });
  } else
    await ensureJob(
      prisma,
      jobType,
      `admin:${jobType}:${target}:${randomUUID()}`,
      target,
      { requestedBy: actor.id },
    );
  await attendanceTransaction(prisma, (tx) =>
    attendanceAudit(tx, "AUTOMATION_RUN_REQUESTED", actor, { jobType, target }),
  );
  refresh();
  redirect(`${ROOT}?saved=queued`);
}
export async function retryAutomationJobAction(form: FormData) {
  const actor = await requireAdmin(),
    id = string(form, "jobId"),
    job = await prisma.automationJobRun.findUnique({ where: { id } });
  if (!job || ["SUCCESS", "RUNNING"].includes(job.status))
    redirect(`${ROOT}?error=invalid-retry`);
  if (job.status === "MANUAL_ACTION_REQUIRED")
    redirect(`${ROOT}/reporter?error=delivery-review`);
  await attendanceTransaction(prisma, async (tx) => {
    await tx.automationJobRun.update({
      where: { id },
      data: {
        status: "PENDING",
        nextRetryAt: null,
        metadata: { requestedBy: actor.id },
      },
    });
    await attendanceAudit(tx, "AUTOMATION_RUN_REQUESTED", actor, {
      jobId: id,
      operation: "retry",
      jobType: job.jobType,
      target: job.target,
    });
  });
  refresh();
  redirect(`${ROOT}?saved=queued`);
}
export async function resolveReportDeliveryAction(form: FormData) {
  const actor = await requireAdmin(),
    id = string(form, "deliveryId"),
    resolution = string(form, "resolution"),
    receipt = string(form, "receipt"),
    note = string(form, "note");
  if (
    !["DELIVERED", "NOT_SENT"].includes(resolution) ||
    note.length < 10 ||
    note.length > 500 ||
    (resolution === "DELIVERED" && !/^\d{1,30}$/.test(receipt))
  )
    redirect(`${ROOT}/reporter?error=invalid-resolution`);
  await attendanceTransaction(prisma, async (tx) => {
    const delivery = await tx.reportDelivery.findUniqueOrThrow({
      where: { id },
    });
    if (delivery.stage !== "DELIVERING" || delivery.status === "SUCCESS")
      throw new Error("DELIVERY_NOT_AMBIGUOUS");
    await tx.reportDelivery.update({
      where: { id },
      data:
        resolution === "DELIVERED"
          ? {
              status: "SUCCESS",
              stage: "DELIVERED",
              sentAt: new Date(),
              baleMessageId: receipt,
              nextRetryAt: null,
            }
          : { status: "RETRYING", stage: "PUBLIC_READY" },
    });
    const jobs = await tx.automationJobRun.findMany({
      where: { jobType: "REPORT_DELIVERY", target: delivery.reportDateKey },
    });
    for (const job of jobs)
      await tx.automationJobRun.update({
        where: { id: job.id },
        data: {
          status: resolution === "DELIVERED" ? "SUCCESS" : "PENDING",
          stage: resolution === "DELIVERED" ? "COMPLETE" : "PUBLIC_READY",
          nextRetryAt: null,
          metadata: {
            requestedBy: actor.id,
            resolution,
            receipt: receipt || null,
            note,
          },
        },
      });
    await attendanceAudit(tx, "AUTOMATION_RUN_REQUESTED", actor, {
      deliveryId: id,
      operation: "resolve-ambiguous-delivery",
      resolution,
      receipt: receipt || null,
      note,
    });
  });
  refresh();
  redirect(`${ROOT}/reporter?saved=resolved`);
}
export async function previewEmergencyCalendarAction(
  _previous: { errors: string[] },
  form: FormData,
): Promise<{ errors: string[] }> {
  const actor = await requireAdmin(),
    year = Number(string(form, "year"));
  if (!Number.isInteger(year) || year < 1200 || year > 1700)
    return { errors: ["سال جلالی معتبر نیست."] };
  let text = string(form, "holidayText");
  const csv = form.get("csv");
  if (csv instanceof File && csv.size) {
    if (csv.size > 1024 * 1024)
      return { errors: ["حجم CSV باید حداکثر یک مگابایت باشد."] };
    text += "\n" + (await csv.text());
  }
  if (text.length > 1024 * 1024)
    return { errors: ["حجم ورودی بیش از حد مجاز است."] };
  const selected = form
    .getAll("selectedDates")
    .filter((v): v is string => typeof v === "string");
  const preview = parseEmergencyCalendar(year, text, selected);
  if (preview.errors.length || !preview.dataset.events.length) {
    await attendanceTransaction(prisma, (tx) =>
      attendanceAudit(tx, "AUTOMATION_RUN_REQUESTED", actor, {
        operation: "calendar-preview-rejected",
        year,
        errorCount: preview.errors.length,
      }),
    );
    return {
      errors: preview.errors.length
        ? preview.errors
        : ["حداقل یک تعطیلی را وارد یا انتخاب کنید."],
    };
  }
  const staged = await stageAnnualDataset(prisma, preview.dataset);
  await prisma.calendarDataset.update({
    where: { id: staged.id },
    data: {
      diff: { ...(staged.diff as object), duplicates: preview.duplicates },
    },
  });
  await attendanceTransaction(prisma, (tx) =>
    attendanceAudit(tx, "AUTOMATION_RUN_REQUESTED", actor, {
      operation: "calendar-preview",
      datasetId: staged.id,
      year,
      duplicates: preview.duplicates,
    }),
  );
  refresh();
  redirect(`${ROOT}/calendar?year=${year}&preview=${staged.id}`);
}
export async function applyCalendarDatasetAction(form: FormData) {
  const actor = await requireAdmin(),
    id = string(form, "datasetId"),
    dataset = await prisma.calendarDataset.findUnique({ where: { id } });
  if (!dataset || !form.has("confirmDiff"))
    redirect(`${ROOT}/calendar?error=confirmation-required`);
  let failed = false;
  try {
    await applyAnnualDataset(prisma, id, actor, form.has("replaceFallback"));
  } catch {
    failed = true;
  }
  if (failed)
    redirect(
      `${ROOT}/calendar?year=${dataset.year}&preview=${id}&error=apply-rejected`,
    );
  refresh();
  redirect(`${ROOT}/calendar?year=${dataset.year}&saved=applied`);
}
