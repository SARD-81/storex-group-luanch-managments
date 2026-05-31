-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'USER_CREATED', 'USER_STATUS_CHANGED', 'USER_PASSWORD_RESET', 'PROFILE_UPDATED', 'MY_PASSWORD_CHANGED', 'AVATAR_UPDATED', 'AVATAR_DELETED', 'ATTENDANCE_UPDATED', 'MONTHLY_ATTENDANCE_UPDATED', 'WEEKLY_ATTENDANCE_GENERATED', 'WEEKLY_PREFERENCES_UPDATED', 'CALENDAR_OVERRIDE_FORCE_HOLIDAY', 'CALENDAR_OVERRIDE_FORCE_WORKDAY', 'CALENDAR_OVERRIDE_CLEARED', 'REPORT_EXPORTED');

-- CreateEnum
CREATE TYPE "AuditTargetType" AS ENUM ('AUTH', 'SESSION', 'USER', 'PROFILE', 'AVATAR', 'MEAL_ATTENDANCE', 'WEEKLY_MEAL_PREFERENCE', 'CALENDAR_OVERRIDE', 'CALENDAR_DAY', 'REPORT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "actorUsername" TEXT,
    "actorName" TEXT,
    "actorRole" "UserRole",
    "action" "AuditAction" NOT NULL,
    "targetType" "AuditTargetType" NOT NULL,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "status" "AuditStatus" NOT NULL DEFAULT 'SUCCESS',
    "requestMethod" TEXT,
    "requestPath" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_occurredAt_idx" ON "AuditLog"("occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_status_idx" ON "AuditLog"("status");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
