-- Additive only. Historical reports keep their share metadata and cleanup path.
CREATE TYPE "ReportDeliveryKind" AS ENUM ('LEGACY_NEXTCLOUD', 'BALE_DOCUMENT');
CREATE TYPE "BaleDeletionStatus" AS ENUM ('NOT_APPLICABLE', 'SCHEDULED', 'RETRYING', 'UNCERTAIN', 'DELETED', 'MANUAL_ACTION_REQUIRED', 'WINDOW_EXPIRED');
ALTER TABLE "AutomationConfig" ADD COLUMN "talkEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "talkActivatedAt" TIMESTAMP(3);
ALTER TABLE "ReportDelivery"
  ADD COLUMN "deliveryKind" "ReportDeliveryKind" NOT NULL DEFAULT 'LEGACY_NEXTCLOUD',
  ADD COLUMN "baleChatId" TEXT,
  ADD COLUMN "sendAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "sentTimeSource" TEXT,
  ADD COLUMN "deleteDueAt" TIMESTAMP(3),
  ADD COLUMN "deleteBeforeAt" TIMESTAMP(3),
  ADD COLUMN "deletionStatus" "BaleDeletionStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletionAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deletionNextRetryAt" TIMESTAMP(3),
  ADD COLUMN "deletionErrorCode" TEXT,
  ADD COLUMN "deletionReceipt" JSONB,
  ADD COLUMN "deletionOverdueAt" TIMESTAMP(3);
CREATE INDEX "ReportDelivery_deletionStatus_deleteDueAt_idx" ON "ReportDelivery"("deletionStatus", "deleteDueAt");
ALTER TABLE "AutomationAlert" ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextRetryAt" TIMESTAMP(3), ADD COLUMN "errorCode" TEXT;
CREATE INDEX "AutomationAlert_status_nextRetryAt_idx" ON "AutomationAlert"("status", "nextRetryAt");
