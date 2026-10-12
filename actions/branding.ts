"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  BrandingError,
  MAX_LOGO_BYTES,
  stageLogo,
  changeLogo,
} from "@/lib/branding/logo";
const ROOT = "/settings/branding";
function value(form: FormData, key: string) {
  const result = form.get(key);
  return typeof result === "string" ? result : "";
}
function errorCode(e: unknown) {
  return e instanceof BrandingError
    ? e.message
    : "BRANDING_STORAGE_UNAVAILABLE";
}
export async function previewLogoAction(form: FormData) {
  const actor = await requireAdmin();
  let hash = "",
    revision = 0,
    error = "";
  try {
    const file = form.get("logo");
    if (!(file instanceof File) || !file.size || file.size > MAX_LOGO_BYTES)
      throw new BrandingError("IMAGE_SIZE_LIMIT");
    const staged = await stageLogo(
      prisma,
      actor,
      Buffer.from(await file.arrayBuffer()),
    );
    hash = staged.hash;
    revision =
      (await prisma.brandingConfig.findUnique({ where: { id: "singleton" } }))
        ?.revision ?? 0;
  } catch (e) {
    error = errorCode(e);
  }
  if (error) redirect(`${ROOT}?error=${error}`);
  redirect(`${ROOT}?preview=${hash}&revision=${revision}`);
}
export async function applyLogoAction(form: FormData) {
  const actor = await requireAdmin();
  let error = "";
  try {
    const revision = value(form, "revision");
    if (!/^\d+$/.test(revision) || value(form, "confirm") !== "yes")
      throw new BrandingError("CONFIRMATION_REQUIRED");
    const target = value(form, "target");
    await changeLogo(
      prisma,
      actor,
      Number(revision),
      target === "DEFAULT" || target === "PREVIOUS" ? target : { hash: target },
    );
  } catch (e) {
    error = errorCode(e);
  }
  if (error) redirect(`${ROOT}?error=${error}`);
  revalidatePath("/", "layout");
  redirect(`${ROOT}?saved=logo`);
}
