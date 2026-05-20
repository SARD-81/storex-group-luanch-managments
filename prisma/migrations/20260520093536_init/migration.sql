-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyMealPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "mealType" "MealType" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyMealPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealAttendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "generatedFromWeeklyPlan" BOOLEAN NOT NULL DEFAULT false,
    "manuallyEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "WeeklyMealPreference_dayOfWeek_mealType_idx" ON "WeeklyMealPreference"("dayOfWeek", "mealType");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyMealPreference_userId_dayOfWeek_mealType_key" ON "WeeklyMealPreference"("userId", "dayOfWeek", "mealType");

-- CreateIndex
CREATE INDEX "MealAttendance_date_mealType_idx" ON "MealAttendance"("date", "mealType");

-- CreateIndex
CREATE INDEX "MealAttendance_userId_date_idx" ON "MealAttendance"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MealAttendance_userId_date_mealType_key" ON "MealAttendance"("userId", "date", "mealType");

-- AddForeignKey
ALTER TABLE "WeeklyMealPreference" ADD CONSTRAINT "WeeklyMealPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealAttendance" ADD CONSTRAINT "MealAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
