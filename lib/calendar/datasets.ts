import { createHash } from "node:crypto";
import { z } from "zod";
import {
  CalendarEventType,
  CalendarDateSystem,
  CalendarEventSourceSection,
  Prisma,
  PrismaClient,
  UserRole,
} from "@/app/generated/prisma/client";
import { buildBaseJalaliYearDays } from "./calendar-date";
import { isBaseWeeklyOffDay, resolveCalendarWorkday } from "./calendar-workday";
import {
  attendanceTransaction,
  attendanceAudit,
  reconcileAttendanceTx,
} from "../attendance/reconciliation";
import { getAttendanceReservationWindow } from "../attendance/month";
export const MANUAL_CALENDAR_SOURCE = "manual-official-calendar-fallback";
export const DATASET_SCHEMA = z.object({
  year: z.number().int().min(1200).max(1700),
  sourceName: z.string().min(1).max(150),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  parserVersion: z.string().min(1),
  parserVerified: z.boolean(),
  mode: z.enum(["OFFICIAL", "MANUAL"]),
  events: z
    .array(
      z.object({
        eventKey: z.string().min(1),
        jalaliDateKey: z.string(),
        title: z.string().trim().min(1).max(1000),
        type: z.enum(CalendarEventType),
        calendarType: z.enum(CalendarDateSystem),
        isHoliday: z.boolean(),
        displayOrder: z.number().int().min(0),
        sourcePage: z.number().int().nullable(),
        sourceSection: z.enum(CalendarEventSourceSection),
      }),
    )
    .min(1)
    .max(2000),
});
export type AnnualDataset = z.infer<typeof DATASET_SCHEMA>;
export function validateAnnualDataset(raw: unknown) {
  const data = DATASET_SCHEMA.parse(raw),
    days = buildBaseJalaliYearDays(data.year),
    keys = new Set(days.map((d) => d.jalaliDateKey)),
    events = new Set<string>();
  for (const e of data.events) {
    if (!keys.has(e.jalaliDateKey) || events.has(e.eventKey))
      throw new Error("INVALID_OR_DUPLICATE_CALENDAR_EVENT");
    events.add(e.eventKey);
  }
  if (
    data.mode === "OFFICIAL" &&
    new Set(data.events.map((e) => e.jalaliDateKey.slice(5, 7))).size !== 12
  )
    throw new Error("MISSING_CALENDAR_MONTH");
  if (
    data.mode === "MANUAL" &&
    (data.sourceName !== MANUAL_CALENDAR_SOURCE ||
      data.events.some((e) => !e.isHoliday || e.sourceSection !== "MANUAL"))
  )
    throw new Error("INVALID_MANUAL_SOURCE");
  return data;
}
export function normalizeDigits(s: string) {
  return s.replace(/[۰-۹٠-٩]/g, (c) =>
    String(
      "۰۱۲۳۴۵۶۷۸۹".includes(c)
        ? "۰۱۲۳۴۵۶۷۸۹".indexOf(c)
        : "٠١٢٣٤٥٦٧٨٩".indexOf(c),
    ),
  );
}
function csvLine(line: string) {
  const cells: string[] = [];
  let cell = "",
    quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("UNCLOSED_CSV_QUOTE");
  cells.push(cell.trim());
  return cells;
}
export function parseEmergencyCalendar(
  year: number,
  text: string,
  selectedDates: string[] = [],
) {
  const valid = new Set(
    buildBaseJalaliYearDays(year).map((d) => d.jalaliDateKey),
  );
  const entries = new Map<string, string>(),
    errors: string[] = [],
    duplicates: string[] = [];
  const lines = [
    ...selectedDates.map((d) => `${d} | تعطیل رسمی`),
    ...text.split(/\r?\n/).filter((s) => s.trim()),
  ];
  for (const [i, raw] of lines.entries()) {
    const line = normalizeDigits(raw.trim());
    if (line.startsWith("jalali_date,")) continue;
    try {
      const cells = line.includes("|")
        ? line.split("|").map((s) => s.trim())
        : csvLine(line);
      const date = cells[0].replaceAll("/", "-");
      if (!valid.has(date)) throw new Error("تاریخ جلالی نامعتبر");
      const title = cells[1]?.trim();
      if (!title || title.length > 1000)
        throw new Error("عنوان معتبر لازم است");
      if (cells[2] && !["true", "1"].includes(cells[2].toLowerCase()))
        throw new Error("این فرم فقط تعطیلات رسمی را می‌پذیرد");
      if (entries.has(date)) {
        duplicates.push(date);
        if (entries.get(date) !== title)
          errors.push(`عنوان تکراری متفاوت: ${date}`);
      } else entries.set(date, title);
    } catch (e) {
      errors.push(
        `ردیف ${i + 1}: ${e instanceof Error ? e.message : "خطای ورودی"}`,
      );
    }
  }
  const events = [...entries]
    .sort()
    .map(([date, title], i) => ({
      eventKey: `manual:${date}`,
      jalaliDateKey: date,
      title,
      type: CalendarEventType.OFFICIAL,
      calendarType: CalendarDateSystem.JALALI,
      isHoliday: true,
      displayOrder: i,
      sourcePage: null,
      sourceSection: CalendarEventSourceSection.MANUAL,
    }));
  const sourceHash = createHash("sha256")
    .update(JSON.stringify(events))
    .digest("hex");
  return {
    errors,
    duplicates,
    dataset: {
      year,
      sourceName: MANUAL_CALENDAR_SOURCE,
      sourceHash,
      parserVersion: "manual-v1",
      parserVerified: true,
      mode: "MANUAL" as const,
      events,
    },
  };
}
export async function calendarReviewFingerprint(
  db: PrismaClient | Prisma.TransactionClient,
  year: number,
) {
  const days = await db.calendarDay.findMany({
    where: { jalaliYear: year },
    orderBy: { date: "asc" },
    select: {
      dateKey: true,
      isWeeklyOffDay: true,
      isOfficialHoliday: true,
      isManualHoliday: true,
      isForcedWorkday: true,
      isWorkday: true,
    },
  });
  const events = await db.calendarEvent.findMany({
    where: { calendarDay: { jalaliYear: year } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      eventKey: true,
      calendarDayId: true,
      sourceName: true,
      title: true,
      isHoliday: true,
      isOfficial: true,
    },
  });
  return createHash("sha256")
    .update(JSON.stringify({ days, events }))
    .digest("hex");
}
export async function stageAnnualDataset(
  db: PrismaClient,
  raw: unknown,
  sourceUrl?: string,
) {
  const data = validateAnnualDataset(raw);
  const current = await db.calendarEvent.findMany({
    where: {
      calendarDay: { jalaliYear: data.year },
      OR: [
        { sourceName: data.sourceName },
        { sourceName: MANUAL_CALENDAR_SOURCE },
        { sourceName: `tehran-university-official-calendar-${data.year}` },
      ],
    },
    include: {
      calendarDay: {
        select: { jalaliDateKey: true, isWorkday: true, isForcedWorkday: true },
      },
    },
  });
  const prior = new Map<string, string[]>();
  for (const e of current.filter((e) => e.isHoliday)) {
    const k = e.calendarDay.jalaliDateKey;
    prior.set(k, [...(prior.get(k) ?? []), e.title]);
  }
  const incoming = new Map<string, string[]>();
  for (const e of data.events.filter((e) => e.isHoliday))
    incoming.set(e.jalaliDateKey, [
      ...(incoming.get(e.jalaliDateKey) ?? []),
      e.title,
    ]);
  const added = [...incoming.keys()].filter((k) => !prior.has(k)),
    removed = [...prior.keys()].filter((k) => !incoming.has(k)),
    matching = [...incoming.keys()].filter((k) => prior.has(k));
  const titleChanges = matching
    .filter((k) => prior.get(k)!.join("، ") !== incoming.get(k)!.join("، "))
    .map((date) => ({
      date,
      before: prior.get(date),
      after: incoming.get(date),
    }));
  const workdayImpact = await db.calendarDay.findMany({
    where: {
      jalaliYear: data.year,
      jalaliDateKey: { in: added },
      isWorkday: true,
      isForcedWorkday: false,
    },
    select: { jalaliDateKey: true },
  });
  const reviewFingerprint = await calendarReviewFingerprint(db, data.year);
  const diff = {
    reviewFingerprint,
    added,
    removed,
    matching,
    titleChanges,
    workdayImpact: workdayImpact.map((d) => d.jalaliDateKey),
    currentEventCount: current.length,
    incomingEventCount: data.events.length,
  };
  return db.calendarDataset.upsert({
    where: {
      year_sourceName_sourceHash: {
        year: data.year,
        sourceName: data.sourceName,
        sourceHash: data.sourceHash,
      },
    },
    create: {
      year: data.year,
      sourceName: data.sourceName,
      sourceHash: data.sourceHash,
      parserVersion: data.parserVersion,
      payload: data as unknown as Prisma.InputJsonValue,
      diff,
      sourceUrl,
    },
    update: { diff },
  });
}
export async function applyAnnualDataset(
  db: PrismaClient,
  id: string,
  actor: { id: string; username: string; name: string; role: UserRole } | null,
  replaceFallback = false,
) {
  if (actor && actor.role !== UserRole.ADMIN) throw new Error("ADMIN_REQUIRED");
  return attendanceTransaction(db, async (tx) => {
    const staged = await tx.calendarDataset.findUniqueOrThrow({
        where: { id },
      }),
      data = validateAnnualDataset(staged.payload);
    if (staged.status === "VERIFIED") return;
    if (!data.parserVerified) throw new Error("PARSER_NOT_VERIFIED");
    const fingerprint = (staged.diff as { reviewFingerprint?: string } | null)
      ?.reviewFingerprint;
    if (fingerprint !== (await calendarReviewFingerprint(tx, data.year)))
      throw new Error("STALE_CALENDAR_PREVIEW");
    const fallback = await tx.calendarEvent.count({
      where: {
        sourceName: MANUAL_CALENDAR_SOURCE,
        calendarDay: { jalaliYear: data.year },
      },
    });
    const today = await tx.calendarDay.findUnique({
      where: { dateKey: getAttendanceReservationWindow().todayDateKey },
    });
    const existing = await tx.calendarEvent.count({
      where: {
        sourceName: data.sourceName,
        calendarDay: { jalaliYear: data.year },
      },
    });
    if (
      !actor &&
      (fallback || (existing && data.year <= (today?.jalaliYear ?? data.year)))
    )
      throw new Error("ADMIN_SOURCE_REVIEW_REQUIRED");
    if (fallback && data.mode === "OFFICIAL" && !replaceFallback)
      throw new Error("FALLBACK_PROMOTION_CONFIRMATION_REQUIRED");
    const version =
      (data.mode === "MANUAL"
        ? `manual-${data.year}-`
        : `official-${data.year}-`) + data.sourceHash.slice(0, 12);
    const batch = await tx.calendarImportBatch.create({
      data: {
        year: data.year,
        sourceName: data.sourceName,
        sourceUrl: staged.sourceUrl,
        sourceVersion: version,
        status: "IMPORTED",
        importedAt: new Date(),
        createdById: actor?.id,
        notes: `dataset:${id}; parser:${data.parserVersion}`,
      },
    });
    const base = buildBaseJalaliYearDays(data.year),
      existingDays = await tx.calendarDay.findMany({
        where: { jalaliYear: data.year },
      }),
      dates = new Set(existingDays.map((d) => d.dateKey));
    await tx.calendarDay.createMany({
      data: base
        .filter((d) => !dates.has(d.dateKey))
        .map((d) => ({
          ...d,
          isWeeklyOffDay: isBaseWeeklyOffDay(d.dayOfWeek),
          isWorkday: !isBaseWeeklyOffDay(d.dayOfWeek),
          sourceName: "internal-base-jalali-calendar",
        })),
      skipDuplicates: true,
    });
    const owned = [
      data.sourceName,
      ...(replaceFallback && data.mode === "OFFICIAL"
        ? [MANUAL_CALENDAR_SOURCE]
        : []),
    ];
    await tx.calendarEvent.deleteMany({
      where: {
        sourceName: { in: owned },
        calendarDay: { jalaliYear: data.year },
      },
    });
    const days = await tx.calendarDay.findMany({
        where: { jalaliYear: data.year },
      }),
      byKey = new Map(days.map((d) => [d.jalaliDateKey, d]));
    if (days.length !== base.length) throw new Error("INCOMPLETE_BASE_YEAR");
    await tx.calendarEvent.createMany({
      data: data.events.map(({ jalaliDateKey, ...e }) => ({
        ...e,
        eventKey: `${data.sourceName}:${data.year}:${e.eventKey}`,
        calendarDayId: byKey.get(jalaliDateKey)!.id,
        isOfficial: true,
        sourceName: data.sourceName,
        sourceVersion: version,
        importBatchId: batch.id,
      })),
    });
    const holidays = await tx.calendarEvent.findMany({
      where: {
        calendarDay: { jalaliYear: data.year },
        isOfficial: true,
        isHoliday: true,
      },
      select: { calendarDayId: true, title: true },
    });
    const titles = new Map<string, string[]>();
    for (const e of holidays)
      titles.set(e.calendarDayId, [
        ...(titles.get(e.calendarDayId) ?? []),
        e.title,
      ]);
    for (const d of days) {
      const isOfficialHoliday = titles.has(d.id);
      await tx.calendarDay.update({
        where: { id: d.id },
        data: {
          isOfficialHoliday,
          holidayTitle: titles.get(d.id)?.join("، ") ?? null,
          isWorkday: resolveCalendarWorkday({ ...d, isOfficialHoliday }),
          sourceName: data.sourceName,
          sourceVersion: version,
          importBatchId: batch.id,
          verifiedAt: new Date(),
        },
      });
    }
    const count = await tx.calendarEvent.count({
      where: { importBatchId: batch.id },
    });
    if (count !== data.events.length)
      throw new Error("POST_IMPORT_COUNT_MISMATCH");
    await tx.calendarImportBatch.update({
      where: { id: batch.id },
      data: { status: "VERIFIED", verifiedAt: new Date() },
    });
    await tx.calendarDataset.update({
      where: { id },
      data: {
        status: "VERIFIED",
        approvedById: actor?.id,
        verifiedAt: new Date(),
        importBatchId: batch.id,
      },
    });
    const window = getAttendanceReservationWindow();
    await reconcileAttendanceTx(tx, {
      from: window.todayDateKey,
      to: window.maxDateKey,
    });
    await attendanceAudit(tx, "CALENDAR_DATASET_APPLIED", actor, {
      datasetId: id,
      year: data.year,
      sourceName: data.sourceName,
      eventCount: count,
      replaceFallback,
    });
  });
}
