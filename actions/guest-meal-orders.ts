"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AuditAction,
  AuditStatus,
  AuditTargetType,
  MealType,
} from "@/app/generated/prisma/client";
import { getAuditActorFromUser, writeAuditLog } from "@/lib/audit/audit-log";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { requireReporterAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getNextDayMealReport } from "@/lib/reporter/next-day-report";

function readGuestCount(formData: FormData, key: string) {
  const value = formData.get(key)?.toString().trim();

  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const count = Number(value);

  if (!Number.isInteger(count) || count < 0 || count > 500) {
    return null;
  }

  return count;
}

export async function updateGuestMealCountsAction(formData: FormData) {
  const currentUser = await requireReporterAccess();
  const auditContext = await getAuditRequestContext();
  const report = await getNextDayMealReport();

  const date = formData.get("date")?.toString();
  const breakfastGuestCount = readGuestCount(formData, "breakfastGuestCount");
  const lunchGuestCount = readGuestCount(formData, "lunchGuestCount");

  if (report.policy.isWorkday !== true) {
    redirect("/reporter/next-day?error=non-workday");
  }

  if (date !== report.reportDateKey) {
    redirect("/reporter/next-day?error=invalid-guest-count");
  }

  if (breakfastGuestCount === null || lunchGuestCount === null) {
    redirect("/reporter/next-day?error=invalid-guest-count");
  }

  await prisma.$transaction(async (tx) => {
    await tx.guestMealOrder.deleteMany({
      where: { date: report.reportDate },
    });

    if (breakfastGuestCount > 0) {
      await tx.guestMealOrder.create({
        data: {
          date: report.reportDate,
          mealType: MealType.BREAKFAST,
          title: "مهمان‌های صبحانه",
          count: breakfastGuestCount,
          createdById: currentUser.id,
        },
      });
    }

    if (lunchGuestCount > 0) {
      await tx.guestMealOrder.create({
        data: {
          date: report.reportDate,
          mealType: MealType.LUNCH,
          title: "مهمان‌های ناهار",
          count: lunchGuestCount,
          createdById: currentUser.id,
        },
      });
    }

    await writeAuditLog(tx, {
      ...getAuditActorFromUser(currentUser),
      action: AuditAction.GUEST_MEAL_CREATED,
      targetType: AuditTargetType.GUEST_MEAL_ORDER,
      targetId: null,
      targetLabel: "guest-meal-counts",
      status: AuditStatus.SUCCESS,
      metadata: {
        reportDateKey: report.reportDateKey,
        breakfastGuestCount,
        lunchGuestCount,
      },
      ...auditContext,
    });
  });

  revalidatePath("/reporter/next-day");
  redirect("/reporter/next-day?saved=guest-counts");
}
