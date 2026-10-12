"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { BaleClient } from "@/lib/automation/integrations";
import { discoverLatestBaleSender } from "@/lib/automation/bale-recipient-discovery";
import { AutomationError } from "@/lib/automation/http";
import { getAutomationConfig } from "@/lib/automation/config";
import { withWorkerLock } from "@/lib/automation/worker";
import { attendanceAudit, attendanceTransaction } from "@/lib/attendance/reconciliation";

function errorCode(e: unknown): string {
  return e instanceof AutomationError ? e.code : "BALE_DISCOVERY_FAILED";
}

/** Admin-only and read-only. Do not return message contents, token or user profile. */
export async function discoverBaleRecipientAction(): Promise<
  | { ok: true; chatId: string; updateId: number; messageDate: number }
  | { ok: false; code: string }
> {
  await requireAdmin();
  try {
    const candidate = await discoverLatestBaleSender();
    return { ok: true, ...candidate };
  } catch (e) {
    return { ok: false, code: errorCode(e) };
  }
}

/**
 * A read-only lookup is never authorization to redirect company PDFs.
 * Pause the reporter, explicitly confirm, re-check latest message and private
 * chat inside the worker lock, then atomically save and audit the new ID.
 */
export async function confirmBaleRecipientAction(
  candidateId: string,
  candidateUpdateId: number,
  confirmed: boolean,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const actor = await requireAdmin();
  if (
    !confirmed ||
    !/^[1-9]\d{0,15}$/.test(candidateId) ||
    !Number.isSafeInteger(Number(candidateId)) ||
    !Number.isSafeInteger(candidateUpdateId) ||
    candidateUpdateId < 0
  ) return { ok: false, code: "BALE_RECIPIENT_CONFIRM_REQUIRED" };
  try {
    const result = await withWorkerLock(async () => {
      const current = await getAutomationConfig(prisma);
      if (current.reporterEnabled)
        throw new AutomationError("BALE_PAUSE_REPORTER_FIRST");
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
      if (latest.chatId !== candidateId || latest.updateId !== candidateUpdateId)
        throw new AutomationError("BALE_RECIPIENT_CHANGED_RECHECK");
      await bale.privateChat(latest.chatId);
      if (current.reportRecipient === candidateId) return;
      await attendanceTransaction(prisma, async (tx) => {
        // Compare-and-set: reject configuration changed by another administrator.
        const updated = await tx.automationConfig.updateMany({
          where: {
            id: current.id,
            reportRecipient: current.reportRecipient,
            reporterEnabled: false,
          },
          data: {
            reportRecipient: candidateId,
            health: {
              ...(current.health && typeof current.health === "object" &&
              !Array.isArray(current.health) ? current.health : {}),
              bale: { state: "UNKNOWN" },
            } as Prisma.InputJsonValue,
          },
        });
        if (updated.count !== 1)
          throw new AutomationError("BALE_RECIPIENT_CONCURRENT_CHANGE");
        await attendanceAudit(tx, "AUTOMATION_CONFIG_CHANGED", actor, {
          operation: "confirm-recent-bale-private-sender",
          oldRecipient: current.reportRecipient || null,
          newRecipient: candidateId,
          updateId: candidateUpdateId,
        });
      });
    });
    if (result && "skipped" in result)
      return { ok: false, code: "BALE_WORKER_BUSY" };
    revalidatePath("/settings/automations/reporter");
    revalidatePath("/reporter/next-day");
    return { ok: true };
  } catch (e) {
    return { ok: false, code: errorCode(e) };
  }
}
