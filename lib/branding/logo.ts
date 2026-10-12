import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, open, rm, chmod } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { PrismaClient } from "@/app/generated/prisma/client";
import type { AuditActor } from "@/lib/audit/audit-log";
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export class BrandingError extends Error {}
function fail(code: string): never {
  throw new BrandingError(code);
}
export function requireBrandingAdmin(actor: AuditActor | null) {
  if (actor?.role !== "ADMIN") fail("ADMIN_REQUIRED");
  return actor;
}
export function brandingRoot() {
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.BRANDING_STORAGE_DIR &&
    !process.env.AUTOMATION_SPOOL_DIR
  )
    fail("BRANDING_STORAGE_NOT_CONFIGURED");
  const root =
    process.env.BRANDING_STORAGE_DIR ??
    (process.env.AUTOMATION_SPOOL_DIR
      ? path.join(process.env.AUTOMATION_SPOOL_DIR, "branding")
      : ".automation-spool/branding");
  if (process.env.NODE_ENV === "production" && !path.isAbsolute(root))
    fail("BRANDING_STORAGE_NOT_CONFIGURED");
  return path.resolve(root);
}
function assetPath(hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash)) fail("INVALID_ASSET_REFERENCE");
  return path.join(brandingRoot(), `${hash}.png`);
}
function signature(bytes: Buffer) {
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpeg";
  if (
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    return "webp";
  return fail("INVALID_IMAGE_FORMAT");
}
export async function normalizeLogo(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_LOGO_BYTES) fail("IMAGE_SIZE_LIMIT");
  const format = signature(bytes);
  try {
    const image = sharp(bytes, {
      limitInputPixels: 16000000,
      failOn: "warning",
    }).timeout({ seconds: 10 });
    const meta = await image.metadata();
    if (
      meta.format !== format ||
      !meta.width ||
      !meta.height ||
      meta.width < 16 ||
      meta.height < 16 ||
      meta.width > 6000 ||
      meta.height > 6000 ||
      (meta.pages ?? 1) !== 1
    )
      fail("IMAGE_DIMENSIONS_INVALID");
    const { data, info } = await image
      .rotate()
      .resize({
        width: 2048,
        height: 2048,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 9 })
      .toBuffer({ resolveWithObject: true });
    if (data.length > MAX_LOGO_BYTES) fail("IMAGE_SIZE_LIMIT");
    return {
      bytes: data,
      width: info.width,
      height: info.height,
      hash: createHash("sha256").update(data).digest("hex"),
    };
  } catch (e) {
    if (e instanceof BrandingError) throw e;
    fail("IMAGE_DECODE_FAILED");
  }
}
export async function stageLogo(
  db: PrismaClient,
  actor: AuditActor,
  bytes: Buffer,
) {
  requireBrandingAdmin(actor);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(641707)`;
    const attempts = await tx.brandingAudit.count({
      where: {
        actorUserId: actor.id,
        action: "UPLOAD_ATTEMPT",
        occurredAt: { gte: new Date(Date.now() - 60000) },
      },
    });
    if (attempts >= 10) fail("UPLOAD_RATE_LIMIT");
    await tx.brandingAudit.create({
      data: {
        actorUserId: actor.id,
        actorUsername: actor.username,
        actorName: actor.name,
        action: "UPLOAD_ATTEMPT",
        revision: 0,
      },
    });
  });
  const normalized = await normalizeLogo(bytes),
    root = brandingRoot(),
    destination = assetPath(normalized.hash);
  const temporary = path.join(root, `${normalized.hash}.${randomUUID()}.tmp`);
  try {
    await mkdir(root, { recursive: true, mode: 0o700 });
    await chmod(root, 0o700);
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(normalized.bytes);
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, destination);
    await db.brandingAsset.upsert({
      where: { hash: normalized.hash },
      create: {
        hash: normalized.hash,
        width: normalized.width,
        height: normalized.height,
        byteSize: normalized.bytes.length,
      },
      update: {},
    });
    return {
      hash: normalized.hash,
      width: normalized.width,
      height: normalized.height,
    };
  } catch {
    fail("BRANDING_STORAGE_UNAVAILABLE");
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}
export async function readBrandingAsset(
  db: Pick<PrismaClient, "brandingAsset">,
  hash: string,
) {
  assetPath(hash); // Reject untrusted references before querying or reading.
  const asset = await db.brandingAsset.findUnique({ where: { hash } });
  if (!asset) fail("ASSET_NOT_FOUND");
  try {
    const bytes = await readFile(assetPath(hash));
    if (
      bytes.length !== asset.byteSize ||
      createHash("sha256").update(bytes).digest("hex") !== hash
    )
      fail("ASSET_CHECKSUM_MISMATCH");
    return { bytes, hash, width: asset.width, height: asset.height };
  } catch (e) {
    if (e instanceof BrandingError) throw e;
    fail("BRANDING_STORAGE_UNAVAILABLE");
  }
}
export async function readDefaultLogo() {
  try {
    const bytes = await readFile(
      path.join(process.cwd(), "public/company-logo.png"),
    );
    return await normalizeLogo(bytes);
  } catch {
    return null;
  }
}
export async function getCurrentLogo(db: PrismaClient) {
  const config = await db.brandingConfig.findUnique({
    where: { id: "singleton" },
  });
  if (config?.activeHash) {
    try {
      return {
        ...(await readBrandingAsset(db, config.activeHash)),
        revision: config.revision,
        fallback: false,
      };
    } catch {
      const fallback = await readDefaultLogo();
      return fallback
        ? { ...fallback, revision: config.revision, fallback: true }
        : null;
    }
  }
  const logo = await readDefaultLogo();
  return logo
    ? { ...logo, revision: config?.revision ?? 0, fallback: false }
    : null;
}
export async function changeLogo(
  db: PrismaClient,
  actor: AuditActor,
  expectedRevision: number,
  target: { hash: string } | "PREVIOUS" | "DEFAULT",
) {
  requireBrandingAdmin(actor);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    fail("INVALID_REVISION");
  return db.$transaction(
    async (tx) => {
      // Serializes initialization, reference swaps, rollback, and audit together.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(641707)`;
      const config = await tx.brandingConfig.upsert({
        where: { id: "singleton" },
        create: { id: "singleton" },
        update: {},
      });
      if (config.revision !== expectedRevision) fail("STALE_BRANDING_PREVIEW");
      const hash =
        target === "DEFAULT"
          ? null
          : target === "PREVIOUS"
            ? config.previousHash
            : target.hash;
      if (target === "PREVIOUS" && config.revision === 0)
        fail("PREVIOUS_LOGO_UNAVAILABLE");
      // File bytes must exist and match BEFORE moving the active reference.
      if (hash) await readBrandingAsset(tx, hash);
      const next = await tx.brandingConfig.update({
        where: { id: config.id },
        data: {
          activeHash: hash,
          previousHash: config.activeHash,
          revision: { increment: 1 },
        },
      });
      await tx.brandingAudit.create({
        data: {
          actorUserId: actor.id,
          actorUsername: actor.username,
          actorName: actor.name,
          action:
            target === "DEFAULT"
              ? "RESTORE_DEFAULT"
              : target === "PREVIOUS"
                ? "RESTORE_PREVIOUS"
                : "APPLY_LOGO",
          fromHash: config.activeHash,
          toHash: hash,
          revision: next.revision,
        },
      });
      return next;
    },
    { timeout: 15000 },
  );
}
