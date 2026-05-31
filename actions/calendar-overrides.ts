"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AuditAction,
  AuditStatus,
  AuditTargetType,
} from "@/app/generated/prisma/client";
import {
  clearCalendarDayOverride,
  forceCalendarDayHoliday,
  forceCalendarDayWorkday,
} from "@/lib/calendar/calendar-override-service";
import { requireAdmin } from "@/lib/auth/session";
import { getAuditActorFromUser, writeAuditLog } from "@/lib/audit/audit-log";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { prisma } from "@/lib/prisma";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CALENDAR_OVERRIDES_PATH = "/settings/calendar-overrides";

function getStringValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getInvalidInputRedirect(dateKey: string): string {
  return `${CALENDAR_OVERRIDES_PATH}?date=${encodeURIComponent(dateKey)}&error=invalid-input`;
}

function revalidateCalendarOverrideConsumers(): void {
  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath(CALENDAR_OVERRIDES_PATH);
}

export async function applyManualHolidayOverrideAction(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
  const auditContext = await getAuditRequestContext();

  const dateKey = getStringValue(formData, "dateKey");
  const title = getStringValue(formData, "title").trim();
  const descriptionValue = getStringValue(formData, "description").trim();
  const description = descriptionValue || null;

  if (!DATE_KEY_PATTERN.test(dateKey) || !title) {
    redirect(getInvalidInputRedirect(dateKey));
  }

  const result = await forceCalendarDayHoliday(prisma, dateKey, {
    title,
    description,
    createdById: admin.id,
  });

  await writeAuditLog(prisma, {
    ...getAuditActorFromUser(admin),
    action: AuditAction.CALENDAR_OVERRIDE_FORCE_HOLIDAY,
    targetType: AuditTargetType.CALENDAR_OVERRIDE,
    targetId: result.calendarDayId,
    targetLabel: result.dateKey,
    status: AuditStatus.SUCCESS,
    metadata: {
      dateKey: result.dateKey,
      jalaliDateKey: result.jalaliDateKey,
      overrideType: result.overrideType,
      isManualHoliday: result.isManualHoliday,
      isForcedWorkday: result.isForcedWorkday,
      isWorkday: result.isWorkday,
      holidayTitle: result.holidayTitle,
      inputTitle: title,
      inputDescription: description,
    },
    ...auditContext,
  });

  revalidateCalendarOverrideConsumers();
  redirect(`${CALENDAR_OVERRIDES_PATH}?date=${dateKey}&success=manual-holiday`);
}

export async function applyForcedWorkdayOverrideAction(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
  const auditContext = await getAuditRequestContext();

  const dateKey = getStringValue(formData, "dateKey");
  const title = getStringValue(formData, "title").trim();
  const descriptionValue = getStringValue(formData, "description").trim();
  const description = descriptionValue || null;

  if (!DATE_KEY_PATTERN.test(dateKey) || !title) {
    redirect(getInvalidInputRedirect(dateKey));
  }

  const result = await forceCalendarDayWorkday(prisma, dateKey, {
    title,
    description,
    createdById: admin.id,
  });

  await writeAuditLog(prisma, {
    ...getAuditActorFromUser(admin),
    action: AuditAction.CALENDAR_OVERRIDE_FORCE_WORKDAY,
    targetType: AuditTargetType.CALENDAR_OVERRIDE,
    targetId: result.calendarDayId,
    targetLabel: result.dateKey,
    status: AuditStatus.SUCCESS,
    metadata: {
      dateKey: result.dateKey,
      jalaliDateKey: result.jalaliDateKey,
      overrideType: result.overrideType,
      isManualHoliday: result.isManualHoliday,
      isForcedWorkday: result.isForcedWorkday,
      isWorkday: result.isWorkday,
      holidayTitle: result.holidayTitle,
      inputTitle: title,
      inputDescription: description,
    },
    ...auditContext,
  });

  revalidateCalendarOverrideConsumers();
  redirect(`${CALENDAR_OVERRIDES_PATH}?date=${dateKey}&success=forced-workday`);
}

export async function clearCalendarOverrideAction(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
  const auditContext = await getAuditRequestContext();

  const dateKey = getStringValue(formData, "dateKey");

  if (!DATE_KEY_PATTERN.test(dateKey)) {
    redirect(`${CALENDAR_OVERRIDES_PATH}?error=invalid-input`);
  }

  const result = await clearCalendarDayOverride(prisma, dateKey);

  await writeAuditLog(prisma, {
    ...getAuditActorFromUser(admin),
    action: AuditAction.CALENDAR_OVERRIDE_CLEARED,
    targetType: AuditTargetType.CALENDAR_OVERRIDE,
    targetId: result.calendarDayId,
    targetLabel: result.dateKey,
    status: AuditStatus.SUCCESS,
    metadata: {
      dateKey: result.dateKey,
      jalaliDateKey: result.jalaliDateKey,
      overrideType: result.overrideType,
      isManualHoliday: result.isManualHoliday,
      isForcedWorkday: result.isForcedWorkday,
      isWorkday: result.isWorkday,
      holidayTitle: result.holidayTitle,
    },
    ...auditContext,
  });

  revalidateCalendarOverrideConsumers();
  redirect(`${CALENDAR_OVERRIDES_PATH}?date=${dateKey}&success=cleared`);
}
