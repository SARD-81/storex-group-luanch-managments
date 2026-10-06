"use server";
import { AttendanceStatus, MealType, UserRole } from "@/app/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { setUserAttendance } from "@/lib/attendance/reconciliation";
import { parseDateKey } from "@/lib/date/date-key";
import { prisma } from "@/lib/prisma";

async function save(formData: FormData, monthly: boolean) {
  const user = await requireUser();
  if (user.role === UserRole.REPORTER) redirect("/reporter/next-day");
  const dates = monthly
    ? formData.has("targetDate") ? [String(formData.get("targetDate"))] : [...new Set(formData.getAll("date").map(String))]
    : [String(formData.get("date"))];
  if (!dates.length || dates.length > 62 || dates.some(d => !parseDateKey(d))) redirect("/?error=invalid-date");
  const changes = dates.flatMap(dateKey => [MealType.BREAKFAST, MealType.LUNCH].map(mealType => ({
    dateKey, mealType, status: formData.get(monthly ? `meal:${dateKey}:${mealType}` : `meal:${mealType}`) === "on" ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT,
  })));
  let blocked = 0;
  try { blocked = (await setUserAttendance(prisma, user, changes)).blocked; }
  catch (error) {
    if (error instanceof Error && ["INVALID_DATE_OR_DEADLINE", "INELIGIBLE_USER"].includes(error.message)) redirect("/?error=deadline");
    throw error;
  }
  revalidatePath("/");revalidatePath("/settings/attendance");revalidatePath("/reports");revalidatePath("/reporter/next-day");
  redirect(`/?date=${dates[0]}&saved=1${blocked ? "&error=admin-override" : ""}`);
}
export async function updateMyAttendanceAction(formData: FormData) { return save(formData, false); }
export async function updateMyMonthlyAttendanceAction(formData: FormData) { return save(formData, true); }
