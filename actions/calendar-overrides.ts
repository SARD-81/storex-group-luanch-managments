"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearCalendarDayOverride,
  forceCalendarDayHoliday,
  forceCalendarDayWorkday,
} from "@/lib/calendar/calendar-override-service";
import { requireAdmin } from "@/lib/auth/session";
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
  await requireAdmin();

  const dateKey = getStringValue(formData, "dateKey");
  const title = getStringValue(formData, "title").trim();
  const descriptionValue = getStringValue(formData, "description").trim();
  const description = descriptionValue || null;

  if (!DATE_KEY_PATTERN.test(dateKey) || !title) {
    redirect(getInvalidInputRedirect(dateKey));
  }

  await forceCalendarDayHoliday(prisma, dateKey, { title, description });
  revalidateCalendarOverrideConsumers();
  redirect(`${CALENDAR_OVERRIDES_PATH}?date=${dateKey}&success=manual-holiday`);
}

export async function applyForcedWorkdayOverrideAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const dateKey = getStringValue(formData, "dateKey");
  const title = getStringValue(formData, "title").trim();
  const descriptionValue = getStringValue(formData, "description").trim();
  const description = descriptionValue || null;

  if (!DATE_KEY_PATTERN.test(dateKey) || !title) {
    redirect(getInvalidInputRedirect(dateKey));
  }

  await forceCalendarDayWorkday(prisma, dateKey, { title, description });
  revalidateCalendarOverrideConsumers();
  redirect(`${CALENDAR_OVERRIDES_PATH}?date=${dateKey}&success=forced-workday`);
}

export async function clearCalendarOverrideAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const dateKey = getStringValue(formData, "dateKey");

  if (!DATE_KEY_PATTERN.test(dateKey)) {
    redirect(`${CALENDAR_OVERRIDES_PATH}?error=invalid-input`);
  }

  await clearCalendarDayOverride(prisma, dateKey);
  revalidateCalendarOverrideConsumers();
  redirect(`${CALENDAR_OVERRIDES_PATH}?date=${dateKey}&success=cleared`);
}
