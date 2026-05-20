"use server";

import { revalidatePath } from "next/cache";
import { generateNextWeekAttendance } from "@/lib/attendance/generate-next-week";

export async function generateNextWeekAttendanceAction() {
  await generateNextWeekAttendance();

  revalidatePath("/");
}