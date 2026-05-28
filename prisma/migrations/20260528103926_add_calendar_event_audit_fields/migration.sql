/*
  Warnings:

  - A unique constraint covering the columns `[eventKey]` on the table `CalendarEvent` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CalendarEventSourceSection" AS ENUM ('MAIN_MONTH_TABLE', 'APPENDIX_TABLE', 'ASTRONOMICAL_NOTES', 'MANUAL');

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "eventKey" TEXT,
ADD COLUMN     "sourcePage" INTEGER,
ADD COLUMN     "sourceSection" "CalendarEventSourceSection";

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_eventKey_key" ON "CalendarEvent"("eventKey");

-- CreateIndex
CREATE INDEX "CalendarEvent_calendarDayId_displayOrder_idx" ON "CalendarEvent"("calendarDayId", "displayOrder");

-- CreateIndex
CREATE INDEX "CalendarEvent_sourcePage_idx" ON "CalendarEvent"("sourcePage");

-- CreateIndex
CREATE INDEX "CalendarEvent_sourceSection_idx" ON "CalendarEvent"("sourceSection");
