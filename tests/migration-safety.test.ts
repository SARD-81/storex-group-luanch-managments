import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
test(
  "migrations preserve legacy rows, edited decisions and timestamps on a populated schema",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const url = process.env.TEST_DATABASE_URL!;
    if (process.env.TEST_PGLITE !== "true")
      assert.match(
        new URL(url).pathname,
        /_test$/,
        "destructive tests require an isolated database name ending _test",
      );
    assert.equal(url, process.env.DATABASE_URL);
    assert.match(new URL(url).hostname, /^(localhost|127\.0\.0\.1)$/);
    const db = new Client({ connectionString: url }),
      schema = "migration_test_" + randomBytes(8).toString("hex");
    await db.connect();
    try {
      await db.query(`CREATE SCHEMA "${schema}"`);
      await db.query(`SET search_path TO "${schema}"`);
      const root = path.join(process.cwd(), "prisma/migrations"),
        dirs = (await readdir(root))
          .filter((d) => d !== "migration_lock.toml")
          .sort();
      for (const d of dirs) {
        if (d === "20261006060000_attendance_provenance") {
          await db.query(
            `INSERT INTO "User" ("id","username","name","updatedAt") VALUES ('fixture','migration-fixture','test','2025-01-01')`,
          );
          await db.query(
            `INSERT INTO "WeeklyMealPreference" ("id","userId","dayOfWeek","mealType","isEnabled","updatedAt") VALUES ('weekly','fixture',0,'LUNCH',true,'2025-01-01')`,
          );
          for (const [id, generated, edited] of [
            ["legacy", true, false],
            ["edited", true, true],
            ["manual", false, false],
          ] as const)
            await db.query(
              `INSERT INTO "MealAttendance" ("id","userId","date","mealType","status","generatedFromWeeklyPlan","manuallyEdited","createdAt","updatedAt") VALUES ($1,'fixture',$2,'LUNCH','ABSENT',$3,$4,'2025-01-01','2025-01-02')`,
              [
                id,
                {
                  legacy: "2025-02-01",
                  edited: "2025-02-02",
                  manual: "2025-02-03",
                }[id],
                generated,
                edited,
              ],
            );
        }
        await db.query(
          await readFile(path.join(root, d, "migration.sql"), "utf8"),
        );
      }
      const rows = (
        await db.query(
          `SELECT "id","source"::text,"createdAt"::text AS "createdAt","updatedAt"::text AS "updatedAt" FROM "MealAttendance" ORDER BY "id"`,
        )
      ).rows;
      assert.deepEqual(
        rows.map((r) => [r.id, r.source]),
        [
          ["edited", "USER_MANUAL"],
          ["legacy", "LEGACY_WEEKLY_PLAN"],
          ["manual", "USER_MANUAL"],
        ],
      );
      for (const r of rows) {
        assert.equal(r.createdAt.slice(0, 10), "2025-01-01");
        assert.equal(r.updatedAt.slice(0, 10), "2025-01-02");
      }
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int AS n FROM "WeeklyMealPreference"`,
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (await db.query(`SELECT count(*)::int AS n FROM "AttendanceDecision"`))
          .rows[0].n,
        3,
      );
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int AS n FROM "User" WHERE "autoBreakfast" OR "autoLunch"`,
          )
        ).rows[0].n,
        0,
      );
    } finally {
      await db.query("SET search_path TO public");
      await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await db.end();
    }
  },
);
