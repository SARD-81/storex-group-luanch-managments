"use server";
import { requireAdmin } from "@/lib/auth/session";
import { redirect } from "next/navigation";
export async function updateWeeklyPreferencesAction(_formData: FormData) { await requireAdmin();redirect("/settings/attendance"); }
