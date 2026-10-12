/** Explicit staging probes; never imported by CI or a live scheduler. */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { getAutomationConfig } from "../lib/automation/config";
import { NextcloudClient } from "../lib/automation/integrations";
import { cleanError, ensureJob, runJob } from "../lib/automation/jobs";
import { verifiedCapabilityProbe } from "../lib/automation/capability-probe";
async function main() {
  const mode = process.argv[2] ?? "--check";
  if (
    !["--check", "--probe-share", "--talk-once"].includes(mode) ||
    process.argv.length > 3
  )
    throw new Error("INVALID_TEST_ARGUMENT");
  if (process.env.STOREX_ENVIRONMENT !== "staging")
    throw new Error("CONTROLLED_STAGING_REQUIRED");
  const config = await getAutomationConfig(prisma),
    cloud = new NextcloudClient(config);
  await cloud.health();
  const identity = (await cloud.ocs("/ocs/v2.php/cloud/user")) as {
    id?: unknown;
  };
  if (String(identity.id) !== process.env.NEXTCLOUD_USERNAME)
    throw new Error("NEXTCLOUD_SERVICE_IDENTITY_MISMATCH");
  const publicSharing = await cloud.capability();
  let technicalGroup = false;
  if (config.technicalConversation) {
    const room = (await cloud.ocs(
      `/ocs/v2.php/apps/spreed/api/v4/room/${encodeURIComponent(config.technicalConversation)}`,
    )) as { type?: number };
    technicalGroup = [2, 3].includes(Number(room.type));
    if (!technicalGroup) throw new Error("TALK_ROOM_NOT_GROUP");
  }
  console.log(
    JSON.stringify({
      stage: "READINESS",
      serviceIdentityVerified: true,
      publicSharing,
      technicalGroup,
      mode,
    }),
  );
  if (mode === "--check") return;
  const job = await ensureJob(
    prisma,
    "STAGING_PROBE",
    `staging:${mode}:${randomUUID()}`,
    "controlled-staging",
    { requestedBy: "CLI" },
  );
  const ok = await runJob(prisma, job, async (stage) => {
    if (mode === "--probe-share") {
      if (!publicSharing) throw new Error("PUBLIC_SHARING_DISABLED");
      await stage("PROBE_PUBLIC_PDF");
      await verifiedCapabilityProbe(prisma, config, cloud, new Date());
    } else {
      if (!technicalGroup) throw new Error("TALK_GROUP_REQUIRED");
      await stage("TALK_TEST");
      const messageId = await cloud.talk(
        "آزمون فنی StoreX Automation Alerts؛ لطفاً دریافت پیام را تأیید کنید.",
        job.executionKey,
      );
      await prisma.automationJobRun.update({
        where: { id: job.id },
        data: { stage: "TALK_TEST_SENT", metadata: { messageId } },
      });
    }
  });
  console.log(
    JSON.stringify({
      stage: "STAGING_PROBE",
      jobId: job.id,
      success: ok,
      recipientConfirmationRequired: mode === "--talk-once",
    }),
  );
  if (!ok) process.exitCode = 1;
}
main()
  .catch((error) => {
    const code =
      error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message)
        ? error.message
        : cleanError(error).code;
    console.error(JSON.stringify({ success: false, code }));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
