ALTER TYPE "UserRole" ADD VALUE 'REPORTER';
ALTER TYPE "AuditAction" ADD VALUE 'GUEST_MEAL_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'GUEST_MEAL_DELETED';
ALTER TYPE "AuditTargetType" ADD VALUE 'GUEST_MEAL_ORDER';

CREATE TABLE "GuestMealOrder" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "mealType" "MealType" NOT NULL,
  "title" TEXT NOT NULL,
  "guestName" TEXT,
  "organization" TEXT,
  "count" INTEGER NOT NULL DEFAULT 1,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuestMealOrder_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GuestMealOrder"
  ADD CONSTRAINT "GuestMealOrder_count_positive" CHECK ("count" > 0);

CREATE INDEX "GuestMealOrder_date_mealType_idx" ON "GuestMealOrder"("date", "mealType");
CREATE INDEX "GuestMealOrder_createdById_idx" ON "GuestMealOrder"("createdById");

ALTER TABLE "GuestMealOrder"
  ADD CONSTRAINT "GuestMealOrder_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
