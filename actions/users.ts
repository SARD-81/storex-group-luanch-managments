"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserRole } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function createUserAction(formData: FormData) {
  await requireAdmin();

  const username = formData.get("username")?.toString().trim().toLowerCase();
  const name = formData.get("name")?.toString().trim();
  const password = formData.get("password")?.toString();
  const roleValue = formData.get("role")?.toString();
  const role = roleValue === UserRole.ADMIN ? UserRole.ADMIN : UserRole.USER;

  if (!username || !name || !password) {
    redirect("/settings/users?error=missing");
  }

  const existingUser = await prisma.user.findUnique({ where: { username } });

  if (existingUser) {
    redirect("/settings/users?error=duplicate-username");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      username,
      name,
      passwordHash,
      role,
      isActive: true,
    },
  });

  revalidatePath("/settings/users");
  redirect("/settings/users?saved=created");
}

export async function updateUserStatusAction(formData: FormData) {
  await requireAdmin();

  const userId = formData.get("userId")?.toString();
  const nextActive = formData.get("isActive")?.toString() === "true";

  if (!userId) {
    redirect("/settings/users?error=invalid-user");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true },
  });

  if (!targetUser) {
    redirect("/settings/users?error=user-not-found");
  }

  if (!nextActive && targetUser.role === UserRole.ADMIN && targetUser.isActive) {
    const activeAdminsCount = await prisma.user.count({
      where: { role: UserRole.ADMIN, isActive: true },
    });

    if (activeAdminsCount <= 1) {
      redirect("/settings/users?error=last-admin");
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: nextActive },
  });

  revalidatePath("/settings/users");
  redirect("/settings/users?saved=status");
}

export async function resetUserPasswordAction(formData: FormData) {
  await requireAdmin();

  const userId = formData.get("userId")?.toString();
  const password = formData.get("password")?.toString();

  if (!userId || !password) {
    redirect("/settings/users?error=missing");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  revalidatePath("/settings/users");
  redirect("/settings/users?saved=password");
}
