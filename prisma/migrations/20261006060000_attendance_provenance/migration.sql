CREATE TYPE "AttendanceSource" AS ENUM ('USER_MANUAL', 'ADMIN_OVERRIDE', 'AUTO_RESERVATION', 'LEGACY_WEEKLY_PLAN');
ALTER TYPE "AuditAction" ADD VALUE 'ATTENDANCE_OVERRIDE_APPLIED';
ALTER TYPE "AuditAction" ADD VALUE 'ATTENDANCE_OVERRIDE_CLEARED';
ALTER TYPE "AuditAction" ADD VALUE 'ATTENDANCE_OVERRIDE_BLOCKED';
ALTER TYPE "AuditAction" ADD VALUE 'AUTO_RESERVATION_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'ATTENDANCE_RECONCILED';
ALTER TYPE "AuditAction" ADD VALUE 'AUTOMATION_CONFIG_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'AUTOMATION_RUN_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'CALENDAR_DATASET_APPLIED';
ALTER TABLE "User" ADD COLUMN "autoBreakfast" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "autoLunch" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "autoBreakfastFrom" DATE,
  ADD COLUMN "autoLunchFrom" DATE;
ALTER TABLE "MealAttendance" ADD COLUMN "source" "AttendanceSource" NOT NULL DEFAULT 'USER_MANUAL';
-- Ambiguous rows are manual. Only unedited generated rows are legacy.
UPDATE "MealAttendance" SET "source" = 'LEGACY_WEEKLY_PLAN'
 WHERE "generatedFromWeeklyPlan" AND NOT "manuallyEdited";
CREATE TABLE "AttendanceDecision" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "date" DATE NOT NULL,
  "mealType" "MealType" NOT NULL,
  "source" "AttendanceSource" NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceDecision_no_auto" CHECK ("source" <> 'AUTO_RESERVATION')
);
CREATE UNIQUE INDEX "AttendanceDecision_userId_date_mealType_source_key" ON "AttendanceDecision"("userId", "date", "mealType", "source");
CREATE INDEX "AttendanceDecision_date_userId_idx" ON "AttendanceDecision"("date", "userId");
INSERT INTO "AttendanceDecision" ("id", "userId", "date", "mealType", "source", "status", "createdAt", "updatedAt")
 SELECT 'migrated-' || "id", "userId", "date", "mealType", "source", "status", "createdAt", "updatedAt"
 FROM "MealAttendance";
