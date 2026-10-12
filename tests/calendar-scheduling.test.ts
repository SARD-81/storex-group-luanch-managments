import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { scheduleCalendarImports } from "../lib/automation/calendar-scheduling";
import { OFFICIAL_PARSER_VERSION } from "../lib/calendar/parser-certification";
import { buildBaseJalaliYearDays } from "../lib/calendar/calendar-date";
test(
  "missed Esfand, Nowruz transition, restart, incomplete current year and emergency fallback trigger durable catch-up",
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
    const year = 1415,
      start = buildBaseJalaliYearDays(year)[0].date,
      now = new Date(start.getTime() + 6 * 3600000);
    try {
      await scheduleCalendarImports(db, { year, month: 1 }, now);
      const first = await db.automationJobRun.findUniqueOrThrow({
        where: { executionKey: `calendar-import:${year}` },
      });
      assert.equal(first.status, "PENDING");
      assert.equal(first.target, String(year));
      await scheduleCalendarImports(db, { year, month: 1 }, now);
      assert.equal(
        await db.automationJobRun.count({
          where: { executionKey: first.executionKey },
        }),
        1,
      );
      await db.automationJobRun.update({
        where: { id: first.id },
        data: {
          status: "RETRYING",
          nextRetryAt: new Date(now.getTime() + 86400000),
          metadata: { calendarRole: "NEXT_YEAR" },
        },
      });
      await scheduleCalendarImports(db, { year, month: 1 }, now);
      const released = await db.automationJobRun.findUniqueOrThrow({
        where: { id: first.id },
      });
      assert.equal(released.status, "PENDING");
      assert.equal(released.nextRetryAt, null);
      const deadline = new Date(now.getTime() + 86400000);
      await db.automationJobRun.update({
        where: { id: first.id },
        data: { status: "RETRYING", nextRetryAt: deadline },
      });
      await scheduleCalendarImports(db, { year, month: 1 }, now);
      assert.equal(
        (
          await db.automationJobRun.findUniqueOrThrow({
            where: { id: first.id },
          })
        ).nextRetryAt!.getTime(),
        deadline.getTime(),
      );
      await db.calendarDataset.create({
        data: {
          year,
          sourceName: "manual-official-calendar-fallback",
          sourceHash: "a".repeat(64),
          parserVersion: "manual-v1",
          status: "VERIFIED",
          payload: {},
          diff: {},
        },
      });
      await scheduleCalendarImports(db, { year, month: 2 }, now);
      assert.equal(
        await db.automationJobRun.count({
          where: { executionKey: first.executionKey },
        }),
        1,
      );
      await db.calendarDay.createMany({
        data: buildBaseJalaliYearDays(year).map((d) => ({
          ...d,
          verifiedAt: now,
        })),
      });
      await db.calendarDataset.create({
        data: {
          year,
          sourceName: `tehran-university-official-calendar-${year}`,
          sourceHash: "b".repeat(64),
          parserVersion: OFFICIAL_PARSER_VERSION,
          status: "VERIFIED",
          payload: {},
          diff: {},
        },
      });
      await db.automationJobRun.delete({ where: { id: first.id } });
      await scheduleCalendarImports(db, { year, month: 5 }, now);
      assert.equal(
        await db.automationJobRun.count({
          where: { executionKey: first.executionKey },
        }),
        0,
      );

      const emergencyDay=await db.calendarDay.findUniqueOrThrow({where:{dateKey:buildBaseJalaliYearDays(year)[0].dateKey}});
      await db.calendarEvent.create({data:{calendarDayId:emergencyDay.id,eventKey:"catch-up-emergency-test",title:"تعطیلی اضطراری",type:"OTHER",calendarType:"JALALI",isHoliday:true,isOfficial:true,sourceName:"manual-official-calendar-fallback"}});
      await scheduleCalendarImports(db,{year,month:5},now);
      assert.equal(await db.automationJobRun.count({where:{executionKey:first.executionKey}}),1,"Emergency events reopen current-year official review even after a prior certification");
      await db.calendarEvent.deleteMany({where:{eventKey:"catch-up-emergency-test"}});
      await db.automationJobRun.deleteMany({where:{executionKey:first.executionKey}});
      await db.calendarDay.delete({
        where: { dateKey: buildBaseJalaliYearDays(year)[0].dateKey },
      });
      await scheduleCalendarImports(db, { year, month: 6 }, now);
      assert.equal(
        await db.automationJobRun.count({
          where: { executionKey: first.executionKey },
        }),
        1,
      );
      await scheduleCalendarImports(db, { year, month: 12 }, now);
      assert.equal(
        await db.automationJobRun.count({
          where: { executionKey: `calendar-import:${year + 1}` },
        }),
        1,
      );
    } finally {
      await db.automationJobRun.deleteMany({
        where: {
          executionKey: {
            in: [`calendar-import:${year}`, `calendar-import:${year + 1}`],
          },
        },
      });
      await db.calendarDataset.deleteMany({ where: { year } });
      await db.calendarDay.deleteMany({ where: { jalaliYear: year } });
      await db.$disconnect();
    }
  },
);
