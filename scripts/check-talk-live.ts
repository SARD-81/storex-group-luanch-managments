/** Explicit controlled staging only. No Files/Public Sharing dependency. */
import "dotenv/config";
import { randomUUID, createHash } from "node:crypto";
import { prisma } from "../lib/prisma";
import { getAutomationConfig } from "../lib/automation/config";
import { NextcloudClient } from "../lib/automation/integrations";
import { cleanError, ensureJob, runJob } from "../lib/automation/jobs";
import { withWorkerLock } from "../lib/automation/worker";
async function main() {
  const mode = process.argv[2] ?? "--check";
  if (!["--check", "--send-once"].includes(mode) || process.argv.length > 3)
    throw Error("INVALID_TEST_ARGUMENT");
  if (process.env.STOREX_ENVIRONMENT !== "staging")
    throw Error("CONTROLLED_STAGING_REQUIRED");
  const c = await getAutomationConfig(prisma),
    cloud = new NextcloudClient(c);
  const identity = await cloud.ocs("/ocs/v2.php/cloud/user");
  if (String(identity.id) !== process.env.NEXTCLOUD_USERNAME)
    throw Error("NEXTCLOUD_SERVICE_IDENTITY_MISMATCH");
  await cloud.talkHealth();
  console.log(
    JSON.stringify({ stage: "TALK_PRIVATE_GROUP_READY", success: true, mode }),
  );
  if (mode === "--check") return;
  await withWorkerLock(async () => {
    const marker = randomUUID().slice(0, 8),
      job = await ensureJob(
        prisma,
        "TALK_TEST",
        `staging-talk:${randomUUID()}`,
        "controlled-staging",
        { requestedBy: "CLI" },
      );
    const success = await runJob(prisma, job, async (stage) => {
      await stage("TALK_TEST");
      const messageId = await cloud.talk(
        `آزمون فنی StoreX Automation Alerts؛ کد ${marker}؛ لطفاً دریافت را تأیید کنید.`,
        createHash("sha256").update(job.executionKey).digest("hex"),
      );
      await prisma.automationJobRun.update({
        where: { id: job.id },
        data: { stage: "TALK_TEST_SENT", metadata: { messageId, marker } },
      });
    });
    console.log(
      JSON.stringify({
        jobId: job.id,
        success,
        marker,
        recipientConfirmationRequired: true,
      }),
    );
    if (!success) process.exitCode = 1;
  });
}
main()
  .catch((e) => {
    console.error(
      JSON.stringify({
        success: false,
        code:
          e instanceof Error && /^[A-Z_]+$/.test(e.message)
            ? e.message
            : cleanError(e).code,
      }),
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
