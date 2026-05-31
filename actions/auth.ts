"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import {
  AuditAction,
  AuditStatus,
  AuditTargetType,
} from "@/app/generated/prisma/client";
import {
  createSession,
  deleteCurrentSession,
  getCurrentUser,
} from "@/lib/auth/session";
import { getAuditActorFromUser, writeAuditLog } from "@/lib/audit/audit-log";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { prisma } from "@/lib/prisma";

export async function loginAction(formData: FormData) {
  const auditContext = await getAuditRequestContext();
  const username = formData.get("username")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();

  if (!username || !password) {
    await writeAuditLog(prisma, {
      action: AuditAction.LOGIN_FAILURE,
      targetType: AuditTargetType.AUTH,
      status: AuditStatus.FAILURE,
      targetLabel: username ?? null,
      metadata: {
        username: username ?? null,
        reason: "MISSING_CREDENTIALS",
      },
      ...auditContext,
    });

    redirect("/login?error=missing");
  }

  const user = await prisma.user.findUnique({
    where: {
      username,
    },
  });

  if (!user || !user.passwordHash || !user.isActive) {
    await writeAuditLog(prisma, {
      action: AuditAction.LOGIN_FAILURE,
      targetType: AuditTargetType.AUTH,
      status: AuditStatus.FAILURE,
      targetId: user?.id ?? null,
      targetLabel: username,
      metadata: {
        username,
        reason: "INVALID_CREDENTIALS_OR_INACTIVE_USER",
      },
      ...auditContext,
    });

    redirect("/login?error=invalid");
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);

  if (!validPassword) {
    await writeAuditLog(prisma, {
      action: AuditAction.LOGIN_FAILURE,
      targetType: AuditTargetType.AUTH,
      status: AuditStatus.FAILURE,
      targetId: user.id,
      targetLabel: username,
      metadata: {
        username,
        reason: "INVALID_CREDENTIALS_OR_INACTIVE_USER",
      },
      ...auditContext,
    });

    redirect("/login?error=invalid");
  }

  await createSession(user.id);

  await writeAuditLog(prisma, {
    ...getAuditActorFromUser(user),
    action: AuditAction.LOGIN_SUCCESS,
    targetType: AuditTargetType.AUTH,
    targetId: user.id,
    targetLabel: user.username,
    status: AuditStatus.SUCCESS,
    metadata: {
      username: user.username,
    },
    ...auditContext,
  });

  redirect("/");
}

export async function logoutAction() {
  const auditContext = await getAuditRequestContext();
  const currentUser = await getCurrentUser();

  if (currentUser) {
    await writeAuditLog(prisma, {
      ...getAuditActorFromUser(currentUser),
      action: AuditAction.LOGOUT,
      targetType: AuditTargetType.SESSION,
      targetId: currentUser.id,
      targetLabel: currentUser.username,
      status: AuditStatus.SUCCESS,
      metadata: {
        username: currentUser.username,
      },
      ...auditContext,
    });
  }

  await deleteCurrentSession();

  redirect("/login");
}
