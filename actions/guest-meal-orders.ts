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
import { getDateKey } from "@/lib/date/date-key";
import { prisma } from "@/lib/prisma";
import { getNextDayMealReport } from "@/lib/reporter/next-day-report";

function readOptionalText(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key)?.toString().trim() ?? "";

  return {
    value: value || null,
    isValid: value.length <= maxLength,
  };
}

export async function createGuestMealOrderAction(formData: FormData) {
  const currentUser = await requireReporterAccess();
  const auditContext = await getAuditRequestContext();
  const report = await getNextDayMealReport();

  const date = formData.get("date")?.toString();
  const mealType = formData.get("mealType")?.toString();
  const title = formData.get("title")?.toString().trim() ?? "";
  const guestName = readOptionalText(formData, "guestName", 120);
  const organization = readOptionalText(formData, "organization", 120);
  const note = readOptionalText(formData, "note", 500);
  const countText = formData.get("count")?.toString() ?? "";
  const count = Number(countText);

  if (date !== report.reportDateKey) {
    redirect("/reporter/next-day?error=invalid-date");
  }

  if (report.policy.isWorkday !== true) {
    redirect("/reporter/next-day?error=non-workday");
  }

  if (mealType !== MealType.BREAKFAST && mealType !== MealType.LUNCH) {
    redirect("/reporter/next-day?error=invalid-meal");
  }

  if (
    title.length === 0 ||
    title.length > 120 ||
    !guestName.isValid ||
    !organization.isValid ||
    !note.isValid ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 500
  ) {
    redirect("/reporter/next-day?error=invalid-guest");
  }

  const guestOrder = await prisma.guestMealOrder.create({
    data: {
      date: report.reportDate,
      mealType,
      title,
      guestName: guestName.value,
      organization: organization.value,
      count,
      note: note.value,
      createdById: currentUser.id,
    },
  });

  await writeAuditLog(prisma, {
    ...getAuditActorFromUser(currentUser),
    action: AuditAction.GUEST_MEAL_CREATED,
    targetType: AuditTargetType.GUEST_MEAL_ORDER,
    targetId: guestOrder.id,
    targetLabel: guestOrder.title,
    status: AuditStatus.SUCCESS,
    after: guestOrder,
    metadata: {
      reportDateKey: report.reportDateKey,
      mealType,
      count,
    },
    ...auditContext,
  });

  revalidatePath("/reporter/next-day");
  redirect("/reporter/next-day?saved=guest-created");
}

export async function deleteGuestMealOrderAction(formData: FormData) {
  const currentUser = await requireReporterAccess();
  const auditContext = await getAuditRequestContext();
  const report = await getNextDayMealReport();
  const guestOrderId = formData.get("guestOrderId")?.toString();

  if (!guestOrderId) {
    redirect("/reporter/next-day?error=guest-not-found");
  }

  const guestOrder = await prisma.guestMealOrder.findUnique({
    where: { id: guestOrderId },
  });

  if (!guestOrder) {
    redirect("/reporter/next-day?error=guest-not-found");
  }

  if (getDateKey(guestOrder.date) !== report.reportDateKey) {
    redirect("/reporter/next-day?error=invalid-date");
  }

  await prisma.guestMealOrder.delete({ where: { id: guestOrder.id } });

  await writeAuditLog(prisma, {
    ...getAuditActorFromUser(currentUser),
    action: AuditAction.GUEST_MEAL_DELETED,
    targetType: AuditTargetType.GUEST_MEAL_ORDER,
    targetId: guestOrder.id,
    targetLabel: guestOrder.title,
    status: AuditStatus.SUCCESS,
    before: guestOrder,
    metadata: {
      reportDateKey: report.reportDateKey,
      mealType: guestOrder.mealType,
      count: guestOrder.count,
    },
    ...auditContext,
  });

  revalidatePath("/reporter/next-day");
  redirect("/reporter/next-day?saved=guest-deleted");
}
