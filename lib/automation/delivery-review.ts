import type { PrismaClient, Prisma } from "@/app/generated/prisma/client";
import { AutomationError } from "./http";

/** Caller holds the same worker advisory lock; never performs a remote send. */
export async function resolveAmbiguousReport(
  db: Prisma.TransactionClient,
  id: string,
  input: { resolution: string; receipt: string; sentAt: string },
  now = new Date(),
) {
  const delivery = await db.reportDelivery.findUniqueOrThrow({ where: { id } });
  if (delivery.stage !== "DELIVERING" || delivery.status === "SUCCESS")
    throw new AutomationError("DELIVERY_NOT_AMBIGUOUS");
  if (!["DELIVERED", "NOT_SENT"].includes(input.resolution))
    throw new AutomationError("INVALID_RESOLUTION");
  let sentAt: Date | null = null;
  if (input.resolution === "DELIVERED") {
    sentAt = new Date(input.sentAt);
    if (
      !/^[1-9]\d{0,15}$/.test(input.receipt) ||
      !Number.isSafeInteger(Number(input.receipt)) ||
      !/Z$|[+-]\d\d:\d\d$/.test(input.sentAt) ||
      !Number.isFinite(sentAt.getTime()) ||
      sentAt > now ||
      (delivery.sendAttemptedAt &&
        sentAt.getTime() < delivery.sendAttemptedAt.getTime() - 60000) ||
      (delivery.deliveryKind === "BALE_DOCUMENT" && !delivery.baleChatId)
    )
      throw new AutomationError("INVALID_RESOLUTION");
  }
  await db.reportDelivery.update({
    where: { id },
    data:
      input.resolution === "DELIVERED"
        ? {
            status: "SUCCESS",
            stage: "DELIVERED",
            sentAt,
            baleMessageId: input.receipt,
            nextRetryAt: null,
            ...(delivery.deliveryKind === "BALE_DOCUMENT"
              ? {
                  sentTimeSource: "ADMIN_VERIFIED_RECEIPT",
                  deleteDueAt: new Date(sentAt!.getTime() + 86400000),
                  deleteBeforeAt: new Date(
                    Math.min(
                      sentAt!.getTime(),
                      delivery.sendAttemptedAt?.getTime() ?? sentAt!.getTime(),
                    ) + 172800000,
                  ),
                  deletionStatus: "SCHEDULED",
                  deletionNextRetryAt: null,
                }
              : {}),
          }
        : {
            status: "RETRYING",
            stage:
              delivery.deliveryKind === "BALE_DOCUMENT"
                ? "GENERATED"
                : "PUBLIC_READY",
          },
  });
  await db.automationJobRun.updateMany({
    where: { jobType: "REPORT_DELIVERY", target: delivery.reportDateKey },
    data: {
      status: input.resolution === "DELIVERED" ? "SUCCESS" : "PENDING",
      stage: input.resolution === "DELIVERED" ? "COMPLETE" : "GENERATED",
      nextRetryAt: null,
      metadata: { requestedBy: "ADMIN_REVIEW", resolution: input.resolution },
    },
  });
}

export async function resolveAmbiguousAlert(
  db: Prisma.TransactionClient,
  id: string,
  input: { resolution: string; receipt: string },
  now = new Date(),
) {
  const alert = await db.automationAlert.findUniqueOrThrow({ where: { id } });
  if (
    alert.status !== "MANUAL_ACTION_REQUIRED" ||
    !["DELIVERED", "NOT_SENT"].includes(input.resolution)
  )
    throw new AutomationError("INVALID_RESOLUTION");
  if (
    input.resolution === "DELIVERED" &&
    (!/^[1-9]\d{0,15}$/.test(input.receipt) ||
      !Number.isSafeInteger(Number(input.receipt)))
  )
    throw new AutomationError("INVALID_RESOLUTION");
  await db.automationAlert.update({
    where: { id },
    data:
      input.resolution === "DELIVERED"
        ? {
            status: "SUCCESS",
            remoteMessageId: input.receipt,
            sentAt: now,
            nextRetryAt: null,
            errorCode: null,
          }
        : { status: "PENDING", nextRetryAt: null, errorCode: null, attempt: 0 },
  });
}
