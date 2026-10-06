-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'RETRYING', 'BLOCKED', 'MANUAL_ACTION_REQUIRED', 'SKIPPED');

-- CreateTable
CREATE TABLE "AutomationConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "reporterEnabled" BOOLEAN NOT NULL DEFAULT false,
    "calendarEnabled" BOOLEAN NOT NULL DEFAULT false,
    "nextcloudBaseUrl" TEXT NOT NULL DEFAULT '',
    "reportsDirectory" TEXT NOT NULL DEFAULT '/StoreX-Automation/Reports',
    "calendarDirectory" TEXT NOT NULL DEFAULT '/StoreX-Automation/Calendar',
    "reportRecipient" TEXT NOT NULL DEFAULT '',
    "technicalConversation" TEXT NOT NULL DEFAULT '',
    "reminder1" TEXT NOT NULL DEFAULT '09:20',
    "reminder2" TEXT NOT NULL DEFAULT '09:25',
    "deliveryTime" TEXT NOT NULL DEFAULT '09:30',
    "retry1" TEXT NOT NULL DEFAULT '09:40',
    "retry2" TEXT NOT NULL DEFAULT '09:50',
    "finalRetry" TEXT NOT NULL DEFAULT '10:00',
    "calendarSourceOverride" TEXT NOT NULL DEFAULT '',
    "publicSharingState" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "capabilityCheckedAt" TIMESTAMP(3),
    "health" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationJobRun" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "executionKey" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "status" "AutomationStatus" NOT NULL DEFAULT 'PENDING',
    "stage" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationArtifact" (
    "id" TEXT NOT NULL,
    "artifactKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "spoolPath" TEXT NOT NULL,
    "nextcloudPath" TEXT,
    "uploadState" TEXT NOT NULL DEFAULT 'PENDING',
    "retainUntil" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportDelivery" (
    "id" TEXT NOT NULL,
    "reportDateKey" TEXT NOT NULL,
    "artifactId" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'PENDING',
    "status" "AutomationStatus" NOT NULL DEFAULT 'PENDING',
    "shareId" TEXT,
    "publicUrl" TEXT,
    "shareCreatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "baleMessageId" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "cleanupError" TEXT,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationAlert" (
    "id" TEXT NOT NULL,
    "alertKey" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AutomationStatus" NOT NULL DEFAULT 'PENDING',
    "remoteMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "AutomationAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarDataset" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceHash" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STAGED',
    "payload" JSONB NOT NULL,
    "diff" JSONB,
    "importBatchId" TEXT,
    "approvedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationShareLease" (
    "id" TEXT NOT NULL,
    "leaseKey" TEXT NOT NULL,
    "nextcloudPath" TEXT NOT NULL,
    "shareId" TEXT,
    "publicUrl" TEXT,
    "shareCreatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "cleanupError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationShareLease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutomationJobRun_executionKey_key" ON "AutomationJobRun"("executionKey");

-- CreateIndex
CREATE INDEX "AutomationJobRun_status_nextRetryAt_idx" ON "AutomationJobRun"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "AutomationJobRun_jobType_target_idx" ON "AutomationJobRun"("jobType", "target");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationArtifact_artifactKey_key" ON "AutomationArtifact"("artifactKey");

-- CreateIndex
CREATE INDEX "AutomationArtifact_uploadState_idx" ON "AutomationArtifact"("uploadState");

-- CreateIndex
CREATE UNIQUE INDEX "ReportDelivery_reportDateKey_key" ON "ReportDelivery"("reportDateKey");

-- CreateIndex
CREATE INDEX "ReportDelivery_expiresAt_revokedAt_idx" ON "ReportDelivery"("expiresAt", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationAlert_alertKey_key" ON "AutomationAlert"("alertKey");

-- CreateIndex
CREATE INDEX "CalendarDataset_year_status_idx" ON "CalendarDataset"("year", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarDataset_year_sourceName_sourceHash_key" ON "CalendarDataset"("year", "sourceName", "sourceHash");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationShareLease_leaseKey_key" ON "AutomationShareLease"("leaseKey");

-- CreateIndex
CREATE INDEX "AutomationShareLease_expiresAt_revokedAt_idx" ON "AutomationShareLease"("expiresAt", "revokedAt");

-- AddForeignKey
ALTER TABLE "ReportDelivery" ADD CONSTRAINT "ReportDelivery_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "AutomationArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

