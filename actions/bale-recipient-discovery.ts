"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { BaleClient } from "@/lib/automation/integrations";
import { discoverLatestBaleSender, pendingBaleCandidate } from "@/lib/automation/bale-recipient-discovery";
import { AutomationError } from "@/lib/automation/http";
import { getAutomationConfig } from "@/lib/automation/config";
import { withWorkerLock } from "@/lib/automation/worker";
import { attendanceAudit, attendanceTransaction } from "@/lib/attendance/reconciliation";

const PAGE = "/settings/automations/reporter";
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function errorCode(e: unknown): string {
  return e instanceof AutomationError ? e.code : "BALE_DISCOVERY_FAILED";
}
function fail(code: string): never {
  redirect(`${PAGE}?discoveryError=${encodeURIComponent(code)}`);
}

/** Progressive-enhancement Server Action: works without client-side hydration. */
export async function discoverBaleRecipientFormAction(_form: FormData) {
  const actor = await requireAdmin();
  const config = await getAutomationConfig(prisma);
  if (config.reporterEnabled) fail("BALE_PAUSE_REPORTER_FIRST");

  let candidate;
  try {
    candidate = await discoverLatestBaleSender();
  } catch (e) {
    fail(errorCode(e));
  }

  await prisma.automationConfig.update({
    where: { id: config.id },
    data: {
      health: {
        ...object(config.health),
        baleRecipientCandidate: {
          ...candidate,
          actorId: actor.id,
          discoveredAt: Date.now(),
        },
      } as Prisma.InputJsonValue,
    },
  });
  revalidatePath(PAGE);
  redirect(`${PAGE}?discovery=ready`);
}

/** The suggestion cannot redirect reports until an authorized admin confirms it. */
export async function confirmBaleRecipientFormAction(form: FormData) {
  const actor = await requireAdmin();
  if (form.get("confirmRecipient") !== "yes")
    fail("BALE_RECIPIENT_CONFIRM_REQUIRED");

  let rejected = "";
  try {
    const result = await withWorkerLock(async () => {
      const current = await getAutomationConfig(prisma);
      if (current.reporterEnabled)
        throw new AutomationError("BALE_PAUSE_REPORTER_FIRST");
      const candidate = pendingBaleCandidate(current.health, actor.id);
      if (!candidate)
        throw new AutomationError("BALE_RECIPIENT_EXPIRED_RECHECK");
      const pending = await prisma.automationJobRun.count({
        where: {
          jobType: { startsWith: "REPORT_" },
          status: { in: ["PENDING", "RUNNING", "RETRYING"] },
        },
      });
      const ambiguous = await prisma.reportDelivery.count({
        where: { stage: "DELIVERING", status: { not: "SUCCESS" } },
      });
      if (pending || ambiguous)
        throw new AutomationError("BALE_UNRESOLVED_REPORTS");

      const bale = new BaleClient();
      const latest = await discoverLatestBaleSender(bale);
      if (latest.chatId !== candidate.chatId || latest.updateId !== candidate.updateId)
        throw new AutomationError("BALE_RECIPIENT_CHANGED_RECHECK");
      await bale.privateChat(candidate.chatId);

      const health = { ...object(current.health) };
      delete health.baleRecipientCandidate;
      if (current.reportRecipient !== candidate.chatId)
        health.bale = { state: "UNKNOWN" };

      await attendanceTransaction(prisma, async (tx) => {
        const updated = await tx.automationConfig.updateMany({
          where: {
            id: current.id,
            updatedAt: current.updatedAt,
            reportRecipient: current.reportRecipient,
            reporterEnabled: false,
          },
          data: {
            reportRecipient: candidate.chatId,
            health: health as Prisma.InputJsonValue,
          },
        });
        if (updated.count !== 1)
          throw new AutomationError("BALE_RECIPIENT_CONCURRENT_CHANGE");
        await attendanceAudit(tx, "AUTOMATION_CONFIG_CHANGED", actor, {
          operation: "confirm-recent-bale-private-sender",
          oldRecipient: current.reportRecipient || null,
          newRecipient: candidate.chatId,
          updateId: candidate.updateId,
        });
      });
    });
    if (result && "skipped" in result) rejected = "BALE_WORKER_BUSY";
  } catch (e) {
    rejected = errorCode(e);
  }
  if (rejected) fail(rejected);
  revalidatePath(PAGE);
  revalidatePath("/reporter/next-day");
  redirect(`${PAGE}?discovery=confirmed`);
}
