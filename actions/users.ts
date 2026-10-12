"use server";

import bcrypt from "bcryptjs";
import {
  attendanceTransaction,
  reconcileAttendanceTx,
  configureAutomaticMeals,
} from "@/lib/attendance/reconciliation";
import { getAttendanceReservationWindow } from "@/lib/attendance/month";
import { getDateKey } from "@/lib/date/date-key";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AuditAction,
  AuditStatus,
  AuditTargetType,
  UserRole,
} from "@/app/generated/prisma/client";
import { USER_ROLE_OPTIONS } from "@/lib/auth/roles";
import { requireAdmin } from "@/lib/auth/session";
import { getAuditActorFromUser, writeAuditLog } from "@/lib/audit/audit-log";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { prisma } from "@/lib/prisma";

export async function createUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const auditContext = await getAuditRequestContext();

  const username = formData.get("username")?.toString().trim().toLowerCase();
  const name = formData.get("name")?.toString().trim();
  const password = formData.get("password")?.toString();
  const roleValue = formData.get("role")?.toString();
  const allowedRoleValues = USER_ROLE_OPTIONS.map((option) => option.value);
  const role = allowedRoleValues.includes(roleValue as UserRole)
    ? (roleValue as UserRole)
    : UserRole.USER;

  if (!username || !name || !password) {
    redirect("/settings/users?error=missing");
  }

  if (
    password.length < 8 ||
    password.length > 256 ||
    username.length > 64 ||
    name.length > 128
  )
    redirect("/settings/users?error=invalid-user-input");
  const existingUser = await prisma.user.findUnique({ where: { username } });

  if (existingUser) {
    redirect("/settings/users?error=duplicate-username");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const createdUser = await prisma.user.create({
    data: {
      username,
      name,
      passwordHash,
      role,
      isActive: true,
    },
  });

  await writeAuditLog(prisma, {
    ...getAuditActorFromUser(admin),
    action: AuditAction.USER_CREATED,
    targetType: AuditTargetType.USER,
    targetId: createdUser.id,
    targetLabel: createdUser.username,
    status: AuditStatus.SUCCESS,
    before: null,
    after: {
      id: createdUser.id,
      username: createdUser.username,
      name: createdUser.name,
      role: createdUser.role,
      isActive: createdUser.isActive,
    },
    metadata: {
      createdByAdminId: admin.id,
    },
    ...auditContext,
  });

  revalidatePath("/settings/users");
  redirect("/settings/users?saved=created");
}

export async function updateUserStatusAction(formData: FormData) {
  const admin = await requireAdmin();
  const auditContext = await getAuditRequestContext();

  const userId = formData.get("userId")?.toString();
  const nextActive = formData.get("isActive")?.toString() === "true";

  if (!userId) {
    redirect("/settings/users?error=invalid-user");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
    },
  });

  if (!targetUser) {
    redirect("/settings/users?error=user-not-found");
  }

  if (
    !nextActive &&
    targetUser.role === UserRole.ADMIN &&
    targetUser.isActive
  ) {
    const activeAdminsCount = await prisma.user.count({
      where: { role: UserRole.ADMIN, isActive: true },
    });

    if (activeAdminsCount <= 1) {
      redirect("/settings/users?error=last-admin");
    }
  }

  const updatedUser = await attendanceTransaction(prisma, async (tx) => {
    if (
      !nextActive &&
      targetUser.role === UserRole.ADMIN &&
      (await tx.user.count({
        where: { role: UserRole.ADMIN, isActive: true },
      })) <= 1
    )
      redirect("/settings/users?error=last-admin");
    const updated = await tx.user.update({
      where: { id: userId },
      data: { isActive: nextActive },
    });
    if (!nextActive) await tx.session.deleteMany({ where: { userId } });
    const window = getAttendanceReservationWindow();
    const last = await tx.mealAttendance.findFirst({
      where: { userId, source: "AUTO_RESERVATION" },
      orderBy: { date: "desc" },
    });
    await reconcileAttendanceTx(tx, {
      userId,
      from: window.todayDateKey,
      to:
        last && getDateKey(last.date) > window.maxDateKey
          ? getDateKey(last.date)
          : window.maxDateKey,
    });
    return updated;
  });

  await writeAuditLog(prisma, {
    ...getAuditActorFromUser(admin),
    action: AuditAction.USER_STATUS_CHANGED,
    targetType: AuditTargetType.USER,
    targetId: updatedUser.id,
    targetLabel: updatedUser.username,
    status: AuditStatus.SUCCESS,
    before: {
      isActive: targetUser.isActive,
    },
    after: {
      isActive: updatedUser.isActive,
    },
    metadata: {
      targetUserName: updatedUser.name,
    },
    ...auditContext,
  });

  revalidatePath("/settings/users");
  redirect("/settings/users?saved=status");
}

export async function resetUserPasswordAction(formData: FormData) {
  const admin = await requireAdmin();
  const auditContext = await getAuditRequestContext();

  const userId = formData.get("userId")?.toString();
  const password = formData.get("password")?.toString();

  if (!userId || !password) {
    redirect("/settings/users?error=missing");
  }

  if (password.length < 8 || password.length > 256)
    redirect("/settings/users?error=invalid-password");
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, name: true },
  });

  if (!targetUser) {
    redirect("/settings/users?error=user-not-found");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId } });
  });

  await writeAuditLog(prisma, {
    ...getAuditActorFromUser(admin),
    action: AuditAction.USER_PASSWORD_RESET,
    targetType: AuditTargetType.USER,
    targetId: targetUser.id,
    targetLabel: targetUser.username,
    status: AuditStatus.SUCCESS,
    metadata: {
      targetUserName: targetUser.name,
    },
    ...auditContext,
  });

  revalidatePath("/settings/users");
  redirect("/settings/users?saved=password");
}

export async function updateAutomaticMealsAction(formData: FormData) {
  const admin = await requireAdmin();
  await configureAutomaticMeals(
    prisma,
    admin,
    String(formData.get("userId")),
    formData.get("autoBreakfast") === "on",
    formData.get("autoLunch") === "on",
  );
  for (const p of [
    "/",
    "/settings/users",
    "/settings/attendance",
    "/reports",
    "/reporter/next-day",
  ])
    revalidatePath(p);
  redirect("/settings/users?saved=auto");
}
