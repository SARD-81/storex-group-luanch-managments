import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PrismaClient,
  AttendanceStatus as Status,
  MealType as Meal,
  UserRole as Role,
} from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  configureAutomaticMeals,
  reconcileAttendance,
  setAdminAttendance,
  setUserAttendance,
} from "../lib/attendance/reconciliation";
import { resolveReportDateRange } from "../lib/reports/report-date-range";

test("report range never clamps and rejects invalid/reversed/oversized requests", () => {
  for (const days of [1, 7, 31, 90, 180, 365, 366]) {
    const to = new Date(Date.UTC(2026, 2, 21) + 86400000 * (days - 1))
      .toISOString()
      .slice(0, 10);
    const range = resolveReportDateRange({ from: "2026-03-21", to });
    assert.equal(range.error, null);
    assert.equal(range.toDateKey, to);
  }
  for (const range of [
    { from: "2026-02-30" },
    { from: "bad" },
    { to: "bad" },
    { from: ["2026-10-10", "2026-10-11"] },
    { to: ["2026-10-10", "2026-10-10"] },
    { from: "2026-10-10", to: "2026-10-01" },
    { from: "2026-01-01", to: "2027-01-02" },
  ])
    assert.ok(resolveReportDateRange(range).error);
});

test(
  "database attendance precedence, calendar safety, no history rewrite, and idempotency",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const url = process.env.TEST_DATABASE_URL!;
    if (process.env.TEST_PGLITE !== "true")
      assert.match(
        new URL(url).pathname,
        /_test$/,
        "destructive tests require an isolated database name ending _test",
      );
    assert.match(new URL(url).hostname, /^(localhost|127\.0\.0\.1)$/);
    assert.equal(
      process.env.DATABASE_URL,
      url,
      "tests require an explicitly isolated test DB",
    );
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    const now = new Date("2026-10-06T06:00:00Z"),
      dateKey = "2026-10-10",
      date = new Date(dateKey + "T00:00:00Z");
    const prefix = "attendance-test-";
    const admin = await db.user.create({
      data: { username: prefix + "admin", name: "test", role: Role.ADMIN },
    });
    const user = await db.user.create({
      data: { username: prefix + "user", name: "test", role: Role.USER },
    });
    const reporter = await db.user.create({
      data: {
        username: prefix + "reporter",
        name: "test",
        role: Role.REPORTER,
      },
    });
    const read = () =>
      db.mealAttendance.findMany({
        where: { userId: user.id, date },
        orderBy: { mealType: "asc" },
      });
    const run = () => reconcileAttendance(db, { userId: user.id, now });
    try {
      await configureAutomaticMeals(db, admin, user.id, false, false, now);
      assert.equal((await read()).length, 0);
      await configureAutomaticMeals(db, admin, user.id, true, false, now);
      assert.equal((await read()).length, 1);
      assert.equal((await read())[0].mealType, Meal.BREAKFAST);
      await configureAutomaticMeals(db, admin, user.id, false, true, now);
      assert.equal((await read()).length, 1);
      assert.equal((await read())[0].mealType, Meal.LUNCH);
      await configureAutomaticMeals(db, admin, user.id, true, true, now);
      assert.equal((await read()).length, 2);
      const today = await db.mealAttendance.findMany({
        where: { userId: user.id, date: new Date("2026-10-06T00:00:00Z") },
      });
      assert.equal(today.length, 2);
      assert.equal(
        await db.mealAttendance.count({
          where: {
            userId: user.id,
            date: { lt: new Date("2026-10-06T00:00:00Z") },
          },
        }),
        0,
      );
      const before = await db.mealAttendance.findMany({
        where: { userId: user.id },
        orderBy: { id: "asc" },
      });
      const result = await run();
      assert.equal(result.created + result.updated + result.deleted, 0);
      assert.deepEqual(
        await db.mealAttendance.findMany({
          where: { userId: user.id },
          orderBy: { id: "asc" },
        }),
        before,
      );
      await setUserAttendance(
        db,
        user,
        [{ dateKey, mealType: Meal.LUNCH, status: Status.ABSENT }],
        now,
      );
      await run();
      assert.equal(
        (await read()).find((r) => r.mealType === Meal.LUNCH)?.source,
        "USER_MANUAL",
      );
      assert.equal(
        (await read()).find((r) => r.mealType === Meal.LUNCH)?.status,
        Status.ABSENT,
      );
      for (const status of [Status.PRESENT, Status.ABSENT]) {
        await setAdminAttendance(
          db,
          admin,
          { userId: user.id, dateKey, mealType: Meal.LUNCH, status },
          now,
        );
        const result = await setUserAttendance(
          db,
          user,
          [
            {
              dateKey,
              mealType: Meal.LUNCH,
              status:
                status === Status.PRESENT ? Status.ABSENT : Status.PRESENT,
            },
          ],
          now,
        );
        assert.equal(result.blocked, 1);
        assert.equal(
          (await read()).find((r) => r.mealType === Meal.LUNCH)?.status,
          status,
        );
      }
      await setAdminAttendance(
        db,
        admin,
        { userId: user.id, dateKey, mealType: Meal.LUNCH, status: null },
        now,
      );
      assert.equal(
        (await read()).find((r) => r.mealType === Meal.LUNCH)?.status,
        Status.ABSENT,
      );
      assert.equal(
        (await read()).find((r) => r.mealType === Meal.LUNCH)?.source,
        "USER_MANUAL",
      );
      await db.calendarDay.update({
        where: { dateKey },
        data: { isManualHoliday: true, isWorkday: false },
      });
      await run();
      assert.equal((await read()).length, 1);
      assert.equal((await read())[0].source, "USER_MANUAL");
      await db.calendarDay.update({
        where: { dateKey },
        data: {
          isManualHoliday: false,
          isForcedWorkday: true,
          isWorkday: true,
        },
      });
      await run();
      assert.equal((await read()).length, 2);
      await db.user.update({
        where: { id: user.id },
        data: { isActive: false },
      });
      await run();
      assert.equal((await read()).length, 1);
      await db.user.update({
        where: { id: user.id },
        data: { isActive: true },
      });
      await run();
      assert.equal((await read()).length, 2);
      await configureAutomaticMeals(db, admin, user.id, false, false, now);
      assert.equal((await read()).length, 1);
      await assert.rejects(
        () => configureAutomaticMeals(db, admin, reporter.id, true, true, now),
        /REPORTER_EXCLUDED/,
      );
      const offdays = await db.calendarDay.findMany({
        where: {
          date: { gte: new Date("2026-10-06"), lte: new Date("2026-10-22") },
          isWorkday: false,
        },
      });
      assert.equal(
        await db.mealAttendance.count({
          where: {
            userId: user.id,
            source: "AUTO_RESERVATION",
            date: { in: offdays.map((d) => d.date) },
          },
        }),
        0,
      );
      await assert.rejects(
        () =>
          setAdminAttendance(
            db,
            user,
            {
              userId: user.id,
              dateKey,
              mealType: Meal.LUNCH,
              status: Status.PRESENT,
            },
            now,
          ),
        /ADMIN_REQUIRED/,
      );
    } finally {
      await db.calendarDay.update({
        where: { dateKey },
        data: {
          isManualHoliday: false,
          isForcedWorkday: false,
          isWorkday: true,
        },
      });
      await db.user.deleteMany({ where: { username: { startsWith: prefix } } });
      await db.$disconnect();
    }
  },
);
