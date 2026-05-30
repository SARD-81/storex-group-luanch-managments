"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function getTrimmedString(formData: FormData, key: string) {
  return formData.get(key)?.toString().trim() ?? "";
}

function isValidNamePart(value: string) {
  return value.length >= 2 && value.length <= 64;
}

export async function updateMyProfileAction(formData: FormData) {
  const currentUser = await requireUser();
  const firstName = getTrimmedString(formData, "firstName");
  const lastName = getTrimmedString(formData, "lastName");

  if (!isValidNamePart(firstName) || !isValidNamePart(lastName)) {
    redirect("/profile?error=invalid-name");
  }

  const displayName = `${firstName} ${lastName}`;

  await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      firstName,
      lastName,
      name: displayName,
    },
  });

  revalidatePath("/");
  revalidatePath("/profile");
  redirect("/profile?saved=profile");
}

export async function updateMyPasswordAction(formData: FormData) {
  const currentUser = await requireUser();
  const newPassword = formData.get("newPassword")?.toString() ?? "";

  if (newPassword.length < 8) {
    redirect("/profile?error=invalid-password");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: currentUser.id },
    data: { passwordHash },
  });

  revalidatePath("/profile");
  redirect("/profile?saved=password");
}

export async function updateMyAvatarAction(formData: FormData) {
  const currentUser = await requireUser();
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

  revalidatePath("/");
  revalidatePath("/profile");
  redirect("/profile?saved=avatar");
}

export async function deleteMyAvatarAction() {
  const currentUser = await requireUser();

  await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      avatarImage: null,
      avatarMimeType: null,
      avatarUpdatedAt: null,
    },
  });

  revalidatePath("/");
  revalidatePath("/profile");
  redirect("/profile?saved=avatar-deleted");
}
