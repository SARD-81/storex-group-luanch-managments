"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AuditAction,
  AuditStatus,
  AuditTargetType,
} from "@/app/generated/prisma/client";
import { requireUser } from "@/lib/auth/session";
import { getAuditActorFromUser, writeAuditLog } from "@/lib/audit/audit-log";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { prisma } from "@/lib/prisma";

function getTrimmedString(formData: FormData, key: string) {
  return formData.get(key)?.toString().trim() ?? "";
}

function isValidNamePart(value: string) {
  return value.length >= 2 && value.length <= 64;
}

export async function updateMyProfileAction(formData: FormData) {
  const currentUser = await requireUser();
  const auditContext = await getAuditRequestContext();
  const firstName = getTrimmedString(formData, "firstName");
  const lastName = getTrimmedString(formData, "lastName");

  if (!isValidNamePart(firstName) || !isValidNamePart(lastName)) {
    redirect("/profile?error=invalid-name");
  }

  const displayName = `${firstName} ${lastName}`;

  const updatedUser = await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      firstName,
      lastName,
      name: displayName,
    },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      firstName: true,
      lastName: true,
    },
  });

  await writeAuditLog(prisma, {
    ...getAuditActorFromUser(updatedUser),
    action: AuditAction.PROFILE_UPDATED,
    targetType: AuditTargetType.PROFILE,
    targetId: updatedUser.id,
    targetLabel: updatedUser.username,
    status: AuditStatus.SUCCESS,
    before: {
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      name: currentUser.name,
    },
    after: {
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      name: updatedUser.name,
    },
    ...auditContext,
  });

  revalidatePath("/");
  revalidatePath("/profile");
  redirect("/profile?saved=profile");
}

export async function updateMyPasswordAction(formData: FormData) {
  const currentUser = await requireUser();
  const auditContext = await getAuditRequestContext();
  const newPassword = formData.get("newPassword")?.toString() ?? "";

  if (newPassword.length < 8) {
    redirect("/profile?error=invalid-password");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: currentUser.id },
    data: { passwordHash },
  });

  await writeAuditLog(prisma, {
    ...getAuditActorFromUser(currentUser),
    action: AuditAction.MY_PASSWORD_CHANGED,
    targetType: AuditTargetType.PROFILE,
    targetId: currentUser.id,
    targetLabel: currentUser.username,
    status: AuditStatus.SUCCESS,
    metadata: {
      passwordChanged: true,
    },
    ...auditContext,
  });

  revalidatePath("/profile");
  redirect("/profile?saved=password");
}

export async function updateMyAvatarAction(formData: FormData) {
  const currentUser = await requireUser();
  const auditContext = await getAuditRequestContext();
  const avatar = formData.get("avatar");

  if (!(avatar instanceof File) || avatar.size === 0) {
    redirect("/profile?error=avatar-required");
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(avatar.type)) {
    redirect("/profile?error=avatar-type");
  }

  if (avatar.size > 512 * 1024) {
    redirect("/profile?error=avatar-size");
  }

  const avatarImage = Buffer.from(await avatar.arrayBuffer());

  await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      avatarImage,
      avatarMimeType: avatar.type,
      avatarUpdatedAt: new Date(),
    },
  });

  await writeAuditLog(prisma, {
    ...getAuditActorFromUser(currentUser),
    action: AuditAction.AVATAR_UPDATED,
    targetType: AuditTargetType.AVATAR,
    targetId: currentUser.id,
    targetLabel: currentUser.username,
    status: AuditStatus.SUCCESS,
    before: {
      avatarMimeType: currentUser.avatarMimeType,
      avatarUpdatedAt: currentUser.avatarUpdatedAt,
    },
    after: {
      avatarMimeType: avatar.type,
      avatarSize: avatar.size,
    },
    ...auditContext,
  });

  revalidatePath("/");
  revalidatePath("/profile");
  redirect("/profile?saved=avatar");
}

export async function deleteMyAvatarAction() {
  const currentUser = await requireUser();
  const auditContext = await getAuditRequestContext();

  await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      avatarImage: null,
      avatarMimeType: null,
      avatarUpdatedAt: null,
    },
  });

  await writeAuditLog(prisma, {
    ...getAuditActorFromUser(currentUser),
    action: AuditAction.AVATAR_DELETED,
    targetType: AuditTargetType.AVATAR,
    targetId: currentUser.id,
    targetLabel: currentUser.username,
    status: AuditStatus.SUCCESS,
    before: {
      avatarMimeType: currentUser.avatarMimeType,
      avatarUpdatedAt: currentUser.avatarUpdatedAt,
    },
    after: {
      avatarMimeType: null,
      avatarUpdatedAt: null,
    },
    ...auditContext,
  });

  revalidatePath("/");
  revalidatePath("/profile");
  redirect("/profile?saved=avatar-deleted");
}
