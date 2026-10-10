import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { OFFICIAL_1405_EVENTS } from "../data/calendar/iran/official-1405";
import certificates from "../scripts/official_calendar/certificates.json";
import {
  verifyParserCertificate,
  OFFICIAL_PARSER_VERSION,
  AUTOMATED_PARSER_VERSION,
  signAutomaticDataset,
} from "../lib/calendar/parser-certification";
import { buildBaseJalaliYearDays } from "../lib/calendar/calendar-date";
import {
  isBaseWeeklyOffDay,
  resolveCalendarWorkday,
} from "../lib/calendar/calendar-workday";
import { validateAnnualDataset } from "../lib/calendar/datasets";
function golden() {
  const events = OFFICIAL_1405_EVENTS.map(
    ({ referenceDate: _referenceDate, ...e }) => ({
      ...e,
      eventKey: `${e.jalaliDateKey}:${createHash("sha256").update(`${e.title}|${e.sourceSection}`).digest("hex").slice(0, 20)}`,
    }),
  );
  const holidays = new Set(
    events.filter((e) => e.isHoliday).map((e) => e.jalaliDateKey),
  );
  return {
    year: 1405,
    sourceName: "tehran-university-official-calendar-1405",
    sourceHash: Object.keys(certificates)[0],
    parserVersion: OFFICIAL_PARSER_VERSION,
    parserVerified: true,
    mode: "OFFICIAL" as const,
    events,
    dailyRecords: buildBaseJalaliYearDays(1405).map((d) => ({
      dateKey: d.dateKey,
      jalaliDateKey: d.jalaliDateKey,
      dayOfWeek: d.dayOfWeek,
      isOfficialHoliday: holidays.has(d.jalaliDateKey),
    })),
  };
}
test("corrected 1405 golden catalog matches reviewed source certificate and company's calendar policy", () => {
  const data = golden();
  verifyParserCertificate(data);
  validateAnnualDataset(data);
  assert.equal(data.events.length, 459);
  assert.equal(data.dailyRecords.length, 365);
  assert.equal(
    new Set(data.events.filter((e) => e.isHoliday).map((e) => e.jalaliDateKey))
      .size,
    26,
  );
  assert.equal(
    data.dailyRecords.filter((d) => isBaseWeeklyOffDay(d.dayOfWeek)).length,
    104,
  );
  assert.equal(
    data.dailyRecords.filter((d) =>
      resolveCalendarWorkday({
        isWeeklyOffDay: isBaseWeeklyOffDay(d.dayOfWeek),
        isOfficialHoliday: d.isOfficialHoliday,
        isManualHoliday: false,
        isForcedWorkday: false,
      }),
    ).length,
    244,
  );
  assert.equal(
    data.events.filter(
      (e) => e.type === "ORGANIZATIONAL" && e.sourcePage === 17,
    ).length,
    35,
  );
});
test("certificate cannot bless changed title, holiday, date, source, taxonomy, duplicate or forged parser flag", () => {
  for (const mutate of [
    (d: ReturnType<typeof golden>) => {
      d.events[0].title += " altered";
    },
    (d: ReturnType<typeof golden>) => {
      d.events[0].type = "OTHER";
    },
    (d: ReturnType<typeof golden>) => {
      d.events[0].sourcePage = 16;
    },
    (d: ReturnType<typeof golden>) => {
      d.events[0].isHoliday = false;
    },
    (d: ReturnType<typeof golden>) => {
      d.dailyRecords[0].dateKey = "2026-03-22";
    },
    (d: ReturnType<typeof golden>) => {
      d.dailyRecords[0].dayOfWeek = 1;
    },
    (d: ReturnType<typeof golden>) => {
      d.events.push(d.events[0]);
    },
    (d: ReturnType<typeof golden>) => {
      d.sourceHash = "a".repeat(64);
    },
    (d: ReturnType<typeof golden>) => {
      d.parserVersion = "unreviewed";
    },
  ]) {
    const data = golden();
    mutate(data);
    assert.throws(() => validateAnnualDataset(data));
  }
});

test("unknown future-year source needs server attestation, exact semantic payload and daily mapping", () => {
  const old = process.env.CALENDAR_ATTESTATION_KEY;
  process.env.CALENDAR_ATTESTATION_KEY = "19".repeat(32);
  try {
    const year = 1406;
    const base = buildBaseJalaliYearDays(year);
    const events = Array.from({length: 12}, (_,i) => ({
      eventKey: `1406-${String(i+1).padStart(2,"0")}-01:test`,
      jalaliDateKey: `1406-${String(i+1).padStart(2,"0")}-01`,
      title: `رویداد آزمایشی ماه ${i+1}`,
      type: "CULTURAL" as const,
      calendarType: "JALALI" as const,
      isHoliday: i === 0,
      displayOrder: 1,
      sourcePage: i+3,
      sourceSection: "MAIN_MONTH_TABLE" as const,
    }));
    const unsigned = {
      year,
      sourceName: `tehran-university-official-calendar-${year}`,
      sourceHash: "3".repeat(64),
      parserVersion: AUTOMATED_PARSER_VERSION,
      parserVerified: true,
      mode: "OFFICIAL" as const,
      events,
      dailyRecords: base.map(day => ({
        dateKey: day.dateKey,
        jalaliDateKey: day.jalaliDateKey,
        dayOfWeek: day.dayOfWeek,
        isOfficialHoliday: day.jalaliDateKey === "1406-01-01",
      })),
    };
    assert.throws(() => validateAnnualDataset(unsigned), /attestation/i);
    const signed = {...unsigned, attestation: signAutomaticDataset(unsigned)};
    assert.deepEqual(validateAnnualDataset(signed).events, events);
    for (const changed of [
      {...signed, sourceHash:"4".repeat(64)},
      {...signed, events: events.map((e,i)=>i===0?{...e,title:"تغییر جعلی"}:e)},
      {...signed, events: events.map((e,i)=>i===0?{...e,isHoliday:false}:e)},
      {...signed, dailyRecords: signed.dailyRecords.map((d,i)=>i===0?{...d,dayOfWeek:(d.dayOfWeek+1)%7}:d)},
      {...signed, year:1405,sourceName:"tehran-university-official-calendar-1405"},
      {...signed, attestation:"f".repeat(64)},
    ]) assert.throws(() => validateAnnualDataset(changed));
    process.env.CALENDAR_ATTESTATION_KEY = "";
    assert.throws(() => validateAnnualDataset(signed), /KEY_NOT_CONFIGURED/);
  } finally {
    if (old === undefined) delete process.env.CALENDAR_ATTESTATION_KEY;
    else process.env.CALENDAR_ATTESTATION_KEY = old;
  }
});

// Native CI exercises the certified catalog through the real staging/apply transaction.
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  stageAnnualDataset,
  applyAnnualDataset,
  parseEmergencyCalendar,
  MANUAL_CALENDAR_SOURCE,
} from "../lib/calendar/datasets";
test(
  "certified source stages without active mutation, requires active-year review and imports idempotently with past attendance intact",
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
    const actor = await db.user.create({
      data: {
        username: "certified-calendar-test",
        name: "آزمون تقویم",
        role: "ADMIN",
      },
    });
    let id: string | undefined;
    try {
      const before = await db.calendarEvent.count({
        where: { calendarDay: { jalaliYear: 1405 } },
      });
      const staged = await stageAnnualDataset(db, golden());
      id = staged.id;
      assert.equal(
        await db.calendarEvent.count({
          where: { calendarDay: { jalaliYear: 1405 } },
        }),
        before,
      );
      await assert.rejects(
        applyAnnualDataset(db, id, null),
        /ADMIN_SOURCE_REVIEW_REQUIRED/,
      );
      await assert.rejects(
        applyAnnualDataset(db, id, { ...actor, role: "USER" }),
        /ADMIN_REQUIRED/,
      );
      const historical = await db.mealAttendance.create({
        data: {
          userId: actor.id,
          date: new Date("2026-04-01T00:00:00Z"),
          mealType: "LUNCH",
          status: "ABSENT",
          source: "USER_MANUAL",
          manuallyEdited: true,
        },
      });
      await applyAnnualDataset(db, id, actor);
      const batchCount = await db.calendarImportBatch.count({
        where: { year: 1405 },
      });
      await applyAnnualDataset(db, id, actor);
      assert.equal(
        await db.calendarImportBatch.count({ where: { year: 1405 } }),
        batchCount,
      );
      assert.deepEqual(
        await db.mealAttendance.findUnique({ where: { id: historical.id } }),
        historical,
      );
      const days = await db.calendarDay.findMany({
        where: { jalaliYear: 1405 },
      });
      assert.equal(days.length, 365);
      assert.equal(days.filter((d) => d.isOfficialHoliday).length, 26);
      assert.equal(days.filter((d) => d.isWeeklyOffDay).length, 104);
      assert.equal(days.filter((d) => d.isWorkday).length, 244);
      assert.equal(
        await db.calendarEvent.count({
          where: {
            sourceName: golden().sourceName,
            calendarDay: { jalaliYear: 1405 },
          },
        }),
        459,
      );

      // Reusing the exact previously certified source must still review emergency promotion.
      for (let round=0; round<2; round++) {
        const emergency=await stageAnnualDataset(db,parseEmergencyCalendar(1405,`1405-04-05 | تعطیلی اضطراری آزمون ${round}`).dataset);
        await applyAnnualDataset(db,emergency.id,actor);
        const review=await stageAnnualDataset(db,golden());
        assert.equal(review.status,"REVIEW_REQUIRED");
        await assert.rejects(applyAnnualDataset(db,review.id,null),/ADMIN_SOURCE_REVIEW_REQUIRED/);
        await assert.rejects(applyAnnualDataset(db,review.id,actor),/FALLBACK_PROMOTION_CONFIRMATION_REQUIRED/);
        await applyAnnualDataset(db,review.id,actor,true);
        assert.equal(await db.calendarEvent.count({where:{sourceName:MANUAL_CALENDAR_SOURCE,calendarDay:{jalaliYear:1405}}}),0);
        assert.equal(await db.calendarEvent.count({where:{sourceName:golden().sourceName,calendarDay:{jalaliYear:1405}}}),459);
        assert.deepEqual(await db.mealAttendance.findUnique({where:{id:historical.id}}),historical);
        await db.calendarDataset.delete({where:{id:emergency.id}});
      }
    } finally {
      if (id) await db.calendarDataset.delete({ where: { id } });
      await db.user.delete({ where: { id: actor.id } });
      await db.$disconnect();
    }
  },
);
