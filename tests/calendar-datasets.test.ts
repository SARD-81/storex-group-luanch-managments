import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, UserRole } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { buildBaseJalaliYearDays } from "../lib/calendar/calendar-date";
import {
  applyAnnualDataset,
  parseEmergencyCalendar,
  stageAnnualDataset,
  validateAnnualDataset,
  MANUAL_CALENDAR_SOURCE,
} from "../lib/calendar/datasets";
import { forceCalendarDayHoliday } from "../lib/calendar/calendar-override-service";

test("emergency parser accepts Persian/Arabic digits and quoted CSV, validates year boundaries and duplicate titles", () => {
  const good = parseEmergencyCalendar(
    1405,
    'jalali_date,title,is_official_holiday\n۱۴۰۵/۰۱/۰۱,نوروز,true\n١٤٠٥-٠١-٠٢,"عنوان، نمونه",1\n1405-01-01 | نوروز',
  );
  assert.deepEqual(good.errors, []);
  assert.equal(good.dataset.events.length, 2);
  assert.deepEqual(good.duplicates, ["1405-01-01"]);
  assert.equal(
    parseEmergencyCalendar(1405, "1405-12-30 | invalid").errors.length,
    1,
  );
  assert.equal(
    parseEmergencyCalendar(1405, "1406-01-01 | wrong year").errors.length,
    1,
  );
  assert.equal(
    parseEmergencyCalendar(1403, "1403-12-30 | leap day").errors.length,
    0,
  );
  assert.equal(buildBaseJalaliYearDays(1403).length, 366);
  assert.equal(
    parseEmergencyCalendar(1405, "1405-01-01 | A\n1405-01-01 | B").errors
      .length,
    1,
  );
  assert.equal(
    parseEmergencyCalendar(1405, "1405-01-01,title,false").errors.length,
    1,
  );
  const partial = { ...good.dataset, mode: "OFFICIAL", sourceName: "official" };
  assert.throws(() => validateAnnualDataset(partial), /MISSING_CALENDAR_MONTH/);
  assert.throws(
    () =>
      validateAnnualDataset({
        ...good.dataset,
        events: [good.dataset.events[0], good.dataset.events[0]],
      }),
    /DUPLICATE_CALENDAR_EVENT/,
  );
});
test(
  "staged manual year is atomic, source-scoped, idempotent, and preserves overrides/unrelated holidays",
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
    assert.match(new URL(url).hostname, /^(127\.0\.0\.1|localhost)$/);
    const db = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url }),
      }),
      year = 1410,
      admin = await db.user.create({
        data: {
          username: "calendar-dataset-test-admin",
          name: "test",
          role: UserRole.ADMIN,
        },
      });
    try {
      const initial = parseEmergencyCalendar(
          year,
          "1410-01-01 | holiday one\n1410-01-02 | holiday two",
        ),
        staged = await stageAnnualDataset(db, initial.dataset);
      await applyAnnualDataset(db, staged.id, admin);
      const day = await db.calendarDay.findUniqueOrThrow({
        where: { jalaliDateKey: "1410-01-02" },
      });
      const total = await db.calendarDay.count({ where: { jalaliYear: year } });
      assert.equal(total, buildBaseJalaliYearDays(year).length);
      assert.equal(
        await db.calendarEvent.count({
          where: {
            sourceName: MANUAL_CALENDAR_SOURCE,
            calendarDay: { jalaliYear: year },
          },
        }),
        2,
      );
      const once = await db.calendarDay.findMany({
        where: { jalaliYear: year },
        orderBy: { date: "asc" },
      });
      await applyAnnualDataset(db, staged.id, admin);
      assert.deepEqual(
        await db.calendarDay.findMany({
          where: { jalaliYear: year },
          orderBy: { date: "asc" },
        }),
        once,
      );
      await db.calendarEvent.create({
        data: {
          calendarDayId: day.id,
          eventKey: "unrelated-dataset-test",
          title: "unrelated holiday",
          type: "ORGANIZATIONAL",
          calendarType: "JALALI",
          isHoliday: true,
          isOfficial: true,
          sourceName: "unrelated-source",
        },
      });
      await forceCalendarDayHoliday(db, day.dateKey, {
        title: "manual override retained",
        createdById: admin.id,
      });
      const replacement = await stageAnnualDataset(
        db,
        parseEmergencyCalendar(year, "1410-01-03 | replacement").dataset,
      );
      await applyAnnualDataset(db, replacement.id, admin);
      const after = await db.calendarDay.findUniqueOrThrow({
        where: { id: day.id },
        include: { override: true, events: true },
      });
      assert.equal(after.isManualHoliday, true);
      assert.equal(after.isOfficialHoliday, true);
      assert.equal(after.isWorkday, false);
      assert.equal(after.override?.title, "manual override retained");
      assert.ok(after.events.some((e) => e.sourceName === "unrelated-source"));
      assert.equal(
        after.events.some((e) => e.sourceName === MANUAL_CALENDAR_SOURCE),
        false,
      );
      assert.equal(
        await db.calendarEvent.count({
          where: {
            sourceName: MANUAL_CALENDAR_SOURCE,
            calendarDay: { jalaliYear: year },
          },
        }),
        1,
      );
      const stale = await stageAnnualDataset(
        db,
        parseEmergencyCalendar(year, "1410-01-04 | new holiday").dataset,
      );
      await db.calendarDay.update({
        where: { id: day.id },
        data: { isForcedWorkday: true },
      });
      const before = await db.calendarEvent.findMany({
        where: { calendarDay: { jalaliYear: year } },
        orderBy: { id: "asc" },
      });
      await assert.rejects(
        () => applyAnnualDataset(db, stale.id, admin),
        /STALE_CALENDAR_PREVIEW/,
      );
      assert.deepEqual(
        await db.calendarEvent.findMany({
          where: { calendarDay: { jalaliYear: year } },
          orderBy: { id: "asc" },
        }),
        before,
      );
      const unverified = await stageAnnualDataset(db, {
        ...parseEmergencyCalendar(year, "1410-01-05 | unverified").dataset,
        parserVerified: false,
      });
      await assert.rejects(
        () => applyAnnualDataset(db, unverified.id, admin),
        /PARSER_NOT_VERIFIED/,
      );
      await assert.rejects(
        () =>
          applyAnnualDataset(db, stale.id, { ...admin, role: UserRole.USER }),
        /ADMIN_REQUIRED/,
      );
    } finally {
      await db.calendarDataset.deleteMany({ where: { year } });
      await db.calendarDay.deleteMany({ where: { jalaliYear: year } });
      await db.calendarImportBatch.deleteMany({ where: { year } });
      await db.user.delete({ where: { id: admin.id } });
      await db.$disconnect();
    }
  },
);
