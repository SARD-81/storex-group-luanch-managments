import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  normalizeLogo,
  stageLogo,
  changeLogo,
  readBrandingAsset,
  getCurrentLogo,
  MAX_LOGO_BYTES,
} from "../lib/branding/logo";
const actor = {
  id: "branding-test-admin",
  username: "branding-test-admin",
  name: "آزمون مدیر",
  role: "ADMIN" as const,
};
async function image(
  width = 400,
  height = 100,
  format: "png" | "jpeg" | "webp" = "png",
) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 20, g: 90, b: 180, alpha: 0.4 },
    },
  })
    [format]()
    .toBuffer();
}
test("logo decoder accepts actual PNG/JPEG/WebP, preserves transparent pixels and normalizes to bounded PNG", async () => {
  for (const format of ["png", "jpeg", "webp"] as const) {
    const result = await normalizeLogo(await image(400, 100, format));
    assert.equal(result.width, 400);
    assert.equal(result.height, 100);
    assert.equal((await sharp(result.bytes).metadata()).format, "png");
  }
  const large = await normalizeLogo(await image(4000, 1000));
  assert.equal(large.width, 2048);
  assert.equal(large.height, 512);
  const transparent = await normalizeLogo(await image());
  assert.equal((await sharp(transparent.bytes).metadata()).hasAlpha, true);
});
test("invalid signatures, SVG, malformed raster, huge input/dimensions and tiny images are rejected", async () => {
  for (const [bytes, error] of [
    [
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      ),
      /INVALID_IMAGE_FORMAT/,
    ],
    [Buffer.from("plain text"), /INVALID_IMAGE_FORMAT/],
    [Buffer.alloc(MAX_LOGO_BYTES + 1), /IMAGE_SIZE_LIMIT/],
    [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), /IMAGE_DECODE_FAILED/],
    [await image(8, 8), /IMAGE_DIMENSIONS_INVALID/],
    [await image(6001, 16), /IMAGE_DIMENSIONS_INVALID/],
  ] as const)
    await assert.rejects(() => normalizeLogo(bytes), error);
});
test(
  "durable logo preview is separate from application, CAS permits one concurrent admin, rollback and storage failure preserve state",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const url = process.env.TEST_DATABASE_URL!;
    assert.equal(url, process.env.DATABASE_URL);
    assert.match(new URL(url).hostname, /^(localhost|127\.0\.0\.1)$/);
    if (process.env.TEST_PGLITE !== "true")
      assert.match(new URL(url).pathname, /_test$/);
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    const root = await mkdtemp(path.join(tmpdir(), "branding-test-"));
    const prior = process.env.BRANDING_STORAGE_DIR;
    process.env.BRANDING_STORAGE_DIR = root;
    try {
      await db.brandingConfig.deleteMany();
      await db.brandingAudit.deleteMany();
      await db.brandingAsset.deleteMany();
      await assert.rejects(
        () => stageLogo(db, { ...actor, role: "USER" }, Buffer.alloc(0)),
        /ADMIN_REQUIRED/,
      );
      const a = await stageLogo(db, actor, await image()),
        b = await stageLogo(db, actor, await image(120, 120));
      assert.equal(await db.brandingConfig.count(), 0);
      assert.equal(
        (await stat(path.join(root, a.hash + ".png"))).mode & 0o777,
        0o600,
      );
      await changeLogo(db, actor, 0, { hash: a.hash });
      assert.equal((await getCurrentLogo(db))!.hash, a.hash);
      await assert.rejects(
        () => changeLogo(db, { ...actor, role: "REPORTER" }, 1, "DEFAULT"),
        /ADMIN_REQUIRED/,
      );
      const race = await Promise.allSettled([
        changeLogo(db, actor, 1, { hash: b.hash }),
        changeLogo(db, actor, 1, "DEFAULT"),
      ]);
      assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(race.filter((r) => r.status === "rejected").length, 1);
      await changeLogo(db, actor, 2, "PREVIOUS");
      assert.equal((await getCurrentLogo(db))!.hash, a.hash);
      await assert.rejects(
        () => readBrandingAsset(db, "../../etc/passwd"),
        /INVALID_ASSET_REFERENCE/,
      );
      await writeFile(path.join(root, b.hash + ".png"), Buffer.from("corrupt"));
      await assert.rejects(
        () => changeLogo(db, actor, 3, { hash: b.hash }),
        /ASSET_CHECKSUM_MISMATCH/,
      );
      assert.equal((await getCurrentLogo(db))!.hash, a.hash);
      await changeLogo(db, actor, 3, "DEFAULT");
      assert.equal(
        (
          await db.brandingConfig.findUniqueOrThrow({
            where: { id: "singleton" },
          })
        ).activeHash,
        null,
      );
      assert.equal(
        await db.brandingAudit.count({
          where: { action: { not: "UPLOAD_ATTEMPT" } },
        }),
        4,
      );
      for (let i = 0; i < 8; i++) await stageLogo(db, actor, await image());
      await assert.rejects(
        () => stageLogo(db, actor, Buffer.alloc(0)),
        /UPLOAD_RATE_LIMIT/,
      );
      process.env.BRANDING_STORAGE_DIR = path.join(
        root,
        b.hash + ".png",
        "unwritable",
      );
      await db.brandingAudit.deleteMany({
        where: { action: "UPLOAD_ATTEMPT" },
      });
      await assert.rejects(
        async () => stageLogo(db, actor, await image()),
        /BRANDING_STORAGE_UNAVAILABLE/,
      );
    } finally {
      process.env.BRANDING_STORAGE_DIR = prior;
      if (prior === undefined) delete process.env.BRANDING_STORAGE_DIR;
      await db.brandingConfig.deleteMany();
      await db.brandingAudit.deleteMany();
      await db.brandingAsset.deleteMany();
      await db.$disconnect();
      await rm(root, { recursive: true, force: true });
    }
  },
);
