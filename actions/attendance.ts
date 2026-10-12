"use server";
import { AttendanceStatus, MealType } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { setAdminAttendance } from "@/lib/attendance/reconciliation";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
export async function setAdminAttendanceAction(form: FormData) {
  const admin = await requireAdmin();
  const dateKey = String(form.get("date")), mealType = String(form.get("mealType")), status = String(form.get("status"));
  if (!["BREAKFAST", "LUNCH"].includes(mealType) || !["PRESENT", "ABSENT", "CLEAR"].includes(status)) throw new Error("INVALID_INPUT");
  await setAdminAttendance(prisma, admin, { userId: String(form.get("userId")), dateKey, mealType: mealType as MealType, status: status === "CLEAR" ? null : status as AttendanceStatus });
  for (const p of ["/", "/settings/attendance", "/reports", "/reporter/next-day"]) revalidatePath(p);
  redirect(`/settings/attendance?date=${encodeURIComponent(dateKey)}&saved=1`);
}
/** Retired bookmark/action compatibility: no recurring attendance generation. */
export async function generateNextWeekAttendanceAction() { await requireAdmin();redirect("/settings/attendance"); }
