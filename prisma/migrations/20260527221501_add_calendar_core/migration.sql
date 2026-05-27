-- CreateEnum
CREATE TYPE "CalendarDateSystem" AS ENUM ('GREGORIAN', 'JALALI', 'HIJRI');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('NATIONAL', 'RELIGIOUS', 'INTERNATIONAL', 'CULTURAL', 'ORGANIZATIONAL', 'OFFICIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CalendarOverrideType" AS ENUM ('FORCE_HOLIDAY', 'FORCE_WORKDAY');

-- CreateEnum
CREATE TYPE "CalendarImportStatus" AS ENUM ('DRAFT', 'IMPORTED', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "CalendarImportBatch" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "yearSystem" "CalendarDateSystem" NOT NULL DEFAULT 'JALALI',
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceVersion" TEXT,
    "notes" TEXT,
    "status" "CalendarImportStatus" NOT NULL DEFAULT 'DRAFT',
    "importedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarDay" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dateKey" TEXT NOT NULL,
    "gregorianYear" INTEGER NOT NULL,
    "gregorianMonth" INTEGER NOT NULL,
    "gregorianDay" INTEGER NOT NULL,
    "jalaliYear" INTEGER NOT NULL,
    "jalaliMonth" INTEGER NOT NULL,
    "jalaliDay" INTEGER NOT NULL,
    "jalaliDateKey" TEXT NOT NULL,
    "hijriYear" INTEGER,
    "hijriMonth" INTEGER,
    "hijriDay" INTEGER,
    "hijriDateKey" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "dayNameFa" TEXT NOT NULL,
    "isWeeklyOffDay" BOOLEAN NOT NULL DEFAULT false,
    "isOfficialHoliday" BOOLEAN NOT NULL DEFAULT false,
    "isManualHoliday" BOOLEAN NOT NULL DEFAULT false,
    "isForcedWorkday" BOOLEAN NOT NULL DEFAULT false,
    "isWorkday" BOOLEAN NOT NULL DEFAULT true,
    "holidayTitle" TEXT,
    "description" TEXT,
    "sourceName" TEXT,
    "sourceVersion" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "calendarDayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CalendarEventType" NOT NULL,
    "calendarType" "CalendarDateSystem" NOT NULL,
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "isOfficial" BOOLEAN NOT NULL DEFAULT true,
    "referenceDate" TEXT,
    "description" TEXT,
    "sourceName" TEXT,
    "sourceVersion" TEXT,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarOverride" (
    "id" TEXT NOT NULL,
    "calendarDayId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dateKey" TEXT NOT NULL,
    "type" "CalendarOverrideType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarImportBatch_year_yearSystem_idx" ON "CalendarImportBatch"("year", "yearSystem");

-- CreateIndex
CREATE INDEX "CalendarImportBatch_status_idx" ON "CalendarImportBatch"("status");

-- CreateIndex
CREATE INDEX "CalendarImportBatch_createdById_idx" ON "CalendarImportBatch"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarDay_date_key" ON "CalendarDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarDay_dateKey_key" ON "CalendarDay"("dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarDay_jalaliDateKey_key" ON "CalendarDay"("jalaliDateKey");

-- CreateIndex
CREATE INDEX "CalendarDay_date_idx" ON "CalendarDay"("date");

-- CreateIndex
CREATE INDEX "CalendarDay_dateKey_idx" ON "CalendarDay"("dateKey");

-- CreateIndex
CREATE INDEX "CalendarDay_jalaliYear_jalaliMonth_idx" ON "CalendarDay"("jalaliYear", "jalaliMonth");

-- CreateIndex
CREATE INDEX "CalendarDay_jalaliDateKey_idx" ON "CalendarDay"("jalaliDateKey");

-- CreateIndex
CREATE INDEX "CalendarDay_dayOfWeek_idx" ON "CalendarDay"("dayOfWeek");

-- CreateIndex
CREATE INDEX "CalendarDay_isWorkday_idx" ON "CalendarDay"("isWorkday");

-- CreateIndex
CREATE INDEX "CalendarDay_isOfficialHoliday_idx" ON "CalendarDay"("isOfficialHoliday");

-- CreateIndex
CREATE INDEX "CalendarDay_isWeeklyOffDay_idx" ON "CalendarDay"("isWeeklyOffDay");

-- CreateIndex
CREATE INDEX "CalendarDay_date_isWorkday_idx" ON "CalendarDay"("date", "isWorkday");

-- CreateIndex
CREATE INDEX "CalendarEvent_calendarDayId_idx" ON "CalendarEvent"("calendarDayId");

-- CreateIndex
CREATE INDEX "CalendarEvent_type_idx" ON "CalendarEvent"("type");

-- CreateIndex
CREATE INDEX "CalendarEvent_calendarType_idx" ON "CalendarEvent"("calendarType");

-- CreateIndex
CREATE INDEX "CalendarEvent_isHoliday_idx" ON "CalendarEvent"("isHoliday");

-- CreateIndex
CREATE INDEX "CalendarEvent_isOfficial_idx" ON "CalendarEvent"("isOfficial");

-- CreateIndex
CREATE INDEX "CalendarEvent_importBatchId_idx" ON "CalendarEvent"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarOverride_calendarDayId_key" ON "CalendarOverride"("calendarDayId");

-- CreateIndex
CREATE INDEX "CalendarOverride_date_idx" ON "CalendarOverride"("date");

-- CreateIndex
CREATE INDEX "CalendarOverride_dateKey_idx" ON "CalendarOverride"("dateKey");

-- CreateIndex
CREATE INDEX "CalendarOverride_type_idx" ON "CalendarOverride"("type");

-- CreateIndex
CREATE INDEX "CalendarOverride_createdById_idx" ON "CalendarOverride"("createdById");

-- AddForeignKey
ALTER TABLE "CalendarImportBatch" ADD CONSTRAINT "CalendarImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarDay" ADD CONSTRAINT "CalendarDay_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "CalendarImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_calendarDayId_fkey" FOREIGN KEY ("calendarDayId") REFERENCES "CalendarDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "CalendarImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarOverride" ADD CONSTRAINT "CalendarOverride_calendarDayId_fkey" FOREIGN KEY ("calendarDayId") REFERENCES "CalendarDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarOverride" ADD CONSTRAINT "CalendarOverride_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
