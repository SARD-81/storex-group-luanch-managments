import type {
  AutomationConfig,
  AutomationJobRun,
  Prisma,
  PrismaClient,
  AutomationArtifact,
} from "@/app/generated/prisma/client";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  realpath,
  stat,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { AutomationError } from "./http";
import { NextcloudClient } from "./integrations";
import { verifiedCapabilityProbe } from "./capability-probe";
export function cleanError(error: unknown) {
  return error instanceof AutomationError
    ? {
        code: error.code,
        httpStatus: error.httpStatus,
        uncertain: error.uncertain,
      }
    : { code: "INTERNAL_STAGE_FAILURE", httpStatus: null, uncertain: false };
}
export function ensureJob(
  db: PrismaClient,
  jobType: string,
  executionKey: string,
  target: string,
  metadata?: Prisma.InputJsonValue,
) {
  return db.automationJobRun.upsert({
    where: { executionKey },
    create: { jobType, executionKey, target, metadata },
    update: {},
  });
}
export async function runJob(
  db: PrismaClient,
  job: AutomationJobRun,
  work: (stage: (name: string) => Promise<void>) => Promise<void>,
  now = new Date(),
  retryAt?: Date,
) {
  if (
    ["SUCCESS", "SKIPPED", "MANUAL_ACTION_REQUIRED"].includes(job.status) ||
    (job.nextRetryAt && job.nextRetryAt > now)
  )
    return false;
  const claimed = await db.automationJobRun.updateMany({
    where: {
      id: job.id,
      status: { in: ["PENDING", "FAILED", "RETRYING", "BLOCKED", "RUNNING"] },
    },
    data: {
      status: "RUNNING",
      attempt: { increment: 1 },
      startedAt: now,
      finishedAt: null,
    },
  });
  if (!claimed.count) return false;
  const stage = async (name: string) => {
    await db.automationJobRun.update({
      where: { id: job.id },
      data: { stage: name },
    });
  };
  try {
    await work(stage);
    await db.automationJobRun.update({
      where: { id: job.id },
      data: {
        status: "SUCCESS",
        stage: "COMPLETE",
        finishedAt: now,
        nextRetryAt: null,
        errorCode: null,
        errorMessage: null,
      },
    });
    return true;
  } catch (error) {
    const safe = cleanError(error);
    const manual = safe.uncertain || safe.code === "AMBIGUOUS_DELIVERY";
    await db.automationJobRun.update({
      where: { id: job.id },
      data: {
        status: manual
          ? "MANUAL_ACTION_REQUIRED"
          : safe.code === "PUBLIC_SHARING_DISABLED"
            ? "BLOCKED"
            : "RETRYING",
        finishedAt: now,
        nextRetryAt: manual
          ? null
          : new Date(
              Math.max(
                (retryAt ?? new Date(now.getTime() + 86400000)).getTime(),
                now.getTime() +
                  (error instanceof AutomationError
                    ? (error.retryAfterSeconds ?? 0)
                    : 0) *
                    1000,
              ),
            ),
        errorCode: safe.code,
        errorMessage: safe.httpStatus
          ? `${safe.code} (HTTP ${safe.httpStatus})`
          : safe.code,
      },
    });
    console.error(
      JSON.stringify({
        jobId: job.id,
        executionKey: job.executionKey,
        target: job.target,
        attempt: job.attempt + 1,
        ...safe,
      }),
    );
    return false;
  }
}
export async function queueAlert(
  db: PrismaClient,
  jobType: string,
  target: string,
  alertKey: string,
  message: string,
) {
  await db.automationAlert.upsert({
    where: { alertKey },
    create: { jobType, target, alertKey, message },
    update: {},
  });
}
export async function flushAlerts(
  db: PrismaClient,
  cloud: NextcloudClient,
  now = new Date(),
  activatedAt = cloud.config.talkActivatedAt ?? new Date(0),
) {
  if (!cloud.config.talkEnabled) return;
  // Preserve old alerts internally; activation never releases an unbounded backlog.
  const cutoff = new Date(
    Math.max(activatedAt.getTime(), now.getTime() - 86400000),
  );
  await db.automationAlert.updateMany({
    where: {
      status: { in: ["PENDING", "RETRYING"] },
      createdAt: { lt: cutoff },
    },
    data: {
      status: "SKIPPED",
      errorCode: "TALK_BACKLOG_RETAINED_INTERNAL",
      nextRetryAt: null,
    },
  });
  await db.automationAlert.updateMany({
    where: { status: "RUNNING" },
    data: {
      status: "MANUAL_ACTION_REQUIRED",
      errorCode: "TALK_RECEIPT_UNCERTAIN",
      nextRetryAt: null,
    },
  });
  const alerts = await db.automationAlert.findMany({
    where: {
      status: { in: ["PENDING", "RETRYING"] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: 3,
  });
  for (const a of alerts) {
    const claimed = await db.automationAlert.updateMany({
      where: { id: a.id, status: { in: ["PENDING", "RETRYING"] } },
      data: { status: "RUNNING", attempt: { increment: 1 } },
    });
    if (!claimed.count) continue;
    let id: string;
    try {
      id = await cloud.talk(
        a.message,
        createHash("sha256").update(a.alertKey).digest("hex"),
      );
    } catch (e) {
      await db.automationAlert.update({
        where: { id: a.id },
        data: {
          status:
            !(e instanceof AutomationError) || e.uncertain
              ? "MANUAL_ACTION_REQUIRED"
              : a.attempt >= 9
                ? "MANUAL_ACTION_REQUIRED"
                : "RETRYING",
          errorCode: cleanError(e).code,
          nextRetryAt:
            !(e instanceof AutomationError) || e.uncertain || a.attempt >= 9
              ? null
              : new Date(
                  now.getTime() +
                    Math.max(
                      e.retryAfterSeconds ?? 0,
                      Math.min(60 * 2 ** a.attempt, 3600),
                    ) *
                      1000,
                ),
        },
      });
      continue;
    }
    // A failed receipt write leaves RUNNING intent; the next dispatcher holds it.
    await db.automationAlert.update({
      where: { id: a.id },
      data: {
        status: "SUCCESS",
        remoteMessageId: id,
        sentAt: now,
        nextRetryAt: null,
        errorCode: null,
      },
    });
  }
}
export async function storeArtifact(
  db: Pick<PrismaClient, "automationArtifact">,
  input: {
    artifactKey: string;
    type: string;
    target: string;
    extension: string;
    bytes: Buffer;
    nextcloudPath: string | null;
  },
) {
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.AUTOMATION_SPOOL_DIR ||
      !path.isAbsolute(process.env.AUTOMATION_SPOOL_DIR))
  )
    throw new AutomationError("DURABLE_SPOOL_NOT_CONFIGURED");
  const root = path.resolve(
    /* turbopackIgnore: true */ process.env.AUTOMATION_SPOOL_DIR ??
      ".automation-spool",
  );
  await mkdir(root, { recursive: true, mode: 0o700 });
  const spoolPath = path.join(
    /* turbopackIgnore: true */ root,
    `${sha256}.${input.extension}`,
  );
  const temporary = spoolPath + ".tmp";
  await writeFile(temporary, input.bytes, { mode: 0o600 });
  await rename(temporary, spoolPath);
  return db.automationArtifact.upsert({
    where: { artifactKey: input.artifactKey },
    create: {
      artifactKey: input.artifactKey,
      type: input.type,
      target: input.target,
      sha256,
      spoolPath,
      nextcloudPath: input.nextcloudPath,
      retainUntil: new Date(Date.now() + 365 * 86400000),
    },
    update: {},
  });
}
export async function readPrivateArtifact(
  artifact: Pick<AutomationArtifact, "spoolPath" | "sha256">,
) {
  const root = await realpath(
    path.resolve(process.env.AUTOMATION_SPOOL_DIR ?? ".automation-spool"),
  );
  const file = await realpath(artifact.spoolPath);
  if (!file.startsWith(root + path.sep))
    throw new AutomationError("ARTIFACT_PATH_INVALID");
  const info = await stat(file);
  if (!info.isFile() || info.size > 50_000_000)
    throw new AutomationError("BALE_PDF_TOO_LARGE");
  const bytes = await readFile(file);
  if (createHash("sha256").update(bytes).digest("hex") !== artifact.sha256)
    throw new AutomationError("ARTIFACT_CHECKSUM_MISMATCH");
  return bytes;
}
export async function uploadArtifact(
  db: PrismaClient,
  id: string,
  cloud: NextcloudClient,
) {
  const artifact = await db.automationArtifact.findUniqueOrThrow({
    where: { id },
  });
  if (artifact.uploadState === "UPLOADED") return artifact;
  const bytes = await readFile(artifact.spoolPath);
  if (createHash("sha256").update(bytes).digest("hex") !== artifact.sha256)
    throw new AutomationError("ARTIFACT_CHECKSUM_MISMATCH");
  if (!artifact.nextcloudPath)
    throw new AutomationError("ARTIFACT_DESTINATION_MISSING");
  await cloud.upload(
    artifact.nextcloudPath,
    bytes,
    artifact.type.endsWith("PDF") ? "application/pdf" : "application/json",
  );
  return db.automationArtifact.update({
    where: { id },
    data: { uploadState: "UPLOADED" },
  });
}
export async function checkPublicCapability(
  db: PrismaClient,
  config: AutomationConfig,
  cloud: NextcloudClient,
  now = new Date(),
) {
  let state = "UNAVAILABLE";
  try {
    await cloud.health();
    if (await cloud.capability()) {
      await verifiedCapabilityProbe(db, config, cloud, now);
      state = "AVAILABLE";
    } else state = "DISABLED";
  } catch (e) {
    state = cleanError(e).code;
  }
  await db.automationConfig.update({
    where: { id: config.id },
    data: { publicSharingState: state, capabilityCheckedAt: now },
  });
  if (
    state !== config.publicSharingState &&
    config.publicSharingState !== "UNKNOWN"
  )
    await queueAlert(
      db,
      "CAPABILITY",
      state,
      `capability:${now.toISOString()}:${state}`,
      `قابلیت لینک عمومی Nextcloud: ${config.publicSharingState} → ${state}`,
    );
  return state;
}
