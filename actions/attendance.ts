"use server";

import { revalidatePath } from "next/cache";
import { generateNextWeekAttendance } from "@/lib/attendance/generate-next-week";
import { requireAdmin } from "@/lib/auth/session";

export async function generateNextWeekAttendanceAction() {
  await requireAdmin();
  await generateNextWeekAttendance();

  revalidatePath("/");
}