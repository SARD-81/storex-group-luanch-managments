"use server";

import { revalidatePath } from "next/cache";
import {
  AuditAction,
  AuditStatus,
  AuditTargetType,
} from "@/app/generated/prisma/client";
import { generateNextWeekAttendance } from "@/lib/attendance/generate-next-week";
import { requireAdmin } from "@/lib/auth/session";
import { getAuditActorFromUser, writeAuditLog } from "@/lib/audit/audit-log";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { prisma } from "@/lib/prisma";

export async function generateNextWeekAttendanceAction() {
  const admin = await requireAdmin();
  const auditContext = await getAuditRequestContext();
  const result = await generateNextWeekAttendance();

  await writeAuditLog(prisma, {
    ...getAuditActorFromUser(admin),
    action: AuditAction.WEEKLY_ATTENDANCE_GENERATED,
    targetType: AuditTargetType.MEAL_ATTENDANCE,
    targetId: null,
    targetLabel: "next-week-attendance",
    status: AuditStatus.SUCCESS,
    metadata: {
      attempted: result.attempted,
      created: result.created,
      weekStart: result.weekStart,
      weekEndExclusive: result.weekEndExclusive,
    },
    ...auditContext,
  });

  revalidatePath("/");
}