import { requireAdmin } from "@/lib/auth/session";
import { redirect } from "next/navigation";
export default async function LegacyWeeklyPlanPage() { await requireAdmin();redirect("/settings/attendance"); }
