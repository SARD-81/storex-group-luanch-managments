import { CalendarOverrideType } from "../../app/generated/prisma/client";
import type { PrismaClient } from "../../app/generated/prisma/client";
import { resolveCalendarWorkday } from "./calendar-workday";

export type CalendarOverrideReason = {
  title: string;
  description?: string | null;
  createdById?: string | null;
};

export type CalendarOverrideResult = {
  calendarDayId: string;
  dateKey: string;
  jalaliDateKey: string;
  overrideType: "FORCE_HOLIDAY" | "FORCE_WORKDAY" | null;
  isManualHoliday: boolean;
  isForcedWorkday: boolean;
  isWorkday: boolean;
  holidayTitle: string | null;
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const calendarDayOverrideSelect = {
  id: true,
  date: true,
  dateKey: true,
  jalaliDateKey: true,
  isWeeklyOffDay: true,
  isOfficialHoliday: true,
  isManualHoliday: true,
  isForcedWorkday: true,
  isWorkday: true,
  holidayTitle: true,
  description: true,
  override: {
    select: {
      type: true,
    },
  },
};

type SelectedCalendarDayOverride = {
  id: string;
  date: Date;
  dateKey: string;
  jalaliDateKey: string;
  isWeeklyOffDay: boolean;
  isOfficialHoliday: boolean;
  isManualHoliday: boolean;
  isForcedWorkday: boolean;
  isWorkday: boolean;
  holidayTitle: string | null;
  description: string | null;
  override: {
    type: CalendarOverrideType;
  } | null;
};

export async function forceCalendarDayHoliday(
  prisma: PrismaClient,
  dateKey: string,
  reason: CalendarOverrideReason,
): Promise<CalendarOverrideResult> {
  assertDateKey(dateKey);
  const normalizedReason = normalizeReason(reason);
  const calendarDay = await prisma.calendarDay.findUnique({
    where: { dateKey },
    select: calendarDayOverrideSelect,
  });

  if (!calendarDay) {
    throw new Error(`CalendarDay was not found for dateKey ${dateKey}.`);
  }

  return prisma.$transaction(async (tx) => {
    await tx.calendarOverride.upsert({
      where: { calendarDayId: calendarDay.id },
      create: {
        calendarDayId: calendarDay.id,
        date: calendarDay.date,
        dateKey: calendarDay.dateKey,
        type: CalendarOverrideType.FORCE_HOLIDAY,
        title: normalizedReason.title,
        description: normalizedReason.description,
        createdById: normalizedReason.createdById,
      },
      update: {
        date: calendarDay.date,
        dateKey: calendarDay.dateKey,
        type: CalendarOverrideType.FORCE_HOLIDAY,
        title: normalizedReason.title,
        description: normalizedReason.description,
        createdById: normalizedReason.createdById,
      },
    });

    const isWorkday = resolveCalendarWorkday({
      isWeeklyOffDay: calendarDay.isWeeklyOffDay,
      isOfficialHoliday: calendarDay.isOfficialHoliday,
      isManualHoliday: true,
      isForcedWorkday: false,
    });

    const updatedDay = await tx.calendarDay.update({
      where: { id: calendarDay.id },
      data: {
        isManualHoliday: true,
        isForcedWorkday: false,
        isWorkday,
        description: appendUniqueDescriptionNote(
          calendarDay.description,
          `[Manual holiday override] ${normalizedReason.title}`,
        ),
        verifiedAt: new Date(),
      },
      select: calendarDayOverrideSelect,
    });

    return mapCalendarDayOverrideResult(updatedDay);
  });
}

export async function forceCalendarDayWorkday(
  prisma: PrismaClient,
  dateKey: string,
  reason: CalendarOverrideReason,
): Promise<CalendarOverrideResult> {
  assertDateKey(dateKey);
  const normalizedReason = normalizeReason(reason);
  const calendarDay = await prisma.calendarDay.findUnique({
    where: { dateKey },
    select: calendarDayOverrideSelect,
  });

  if (!calendarDay) {
    throw new Error(`CalendarDay was not found for dateKey ${dateKey}.`);
  }

  return prisma.$transaction(async (tx) => {
    await tx.calendarOverride.upsert({
      where: { calendarDayId: calendarDay.id },
      create: {
        calendarDayId: calendarDay.id,
        date: calendarDay.date,
        dateKey: calendarDay.dateKey,
        type: CalendarOverrideType.FORCE_WORKDAY,
        title: normalizedReason.title,
        description: normalizedReason.description,
        createdById: normalizedReason.createdById,
      },
      update: {
        date: calendarDay.date,
        dateKey: calendarDay.dateKey,
        type: CalendarOverrideType.FORCE_WORKDAY,
        title: normalizedReason.title,
        description: normalizedReason.description,
        createdById: normalizedReason.createdById,
      },
    });

    const isWorkday = resolveCalendarWorkday({
      isWeeklyOffDay: calendarDay.isWeeklyOffDay,
      isOfficialHoliday: calendarDay.isOfficialHoliday,
      isManualHoliday: false,
      isForcedWorkday: true,
    });

    const updatedDay = await tx.calendarDay.update({
      where: { id: calendarDay.id },
      data: {
        isManualHoliday: false,
        isForcedWorkday: true,
        isWorkday,
        description: appendUniqueDescriptionNote(
          calendarDay.description,
          `[Forced workday override] ${normalizedReason.title}`,
        ),
        verifiedAt: new Date(),
      },
      select: calendarDayOverrideSelect,
    });

    return mapCalendarDayOverrideResult(updatedDay);
  });
}

export async function clearCalendarDayOverride(
  prisma: PrismaClient,
  dateKey: string,
): Promise<CalendarOverrideResult> {
  assertDateKey(dateKey);
  const calendarDay = await prisma.calendarDay.findUnique({
    where: { dateKey },
    select: calendarDayOverrideSelect,
  });

  if (!calendarDay) {
    throw new Error(`CalendarDay was not found for dateKey ${dateKey}.`);
  }

  return prisma.$transaction(async (tx) => {
    await tx.calendarOverride.deleteMany({
      where: { calendarDayId: calendarDay.id },
    });

    const isWorkday = resolveCalendarWorkday({
      isWeeklyOffDay: calendarDay.isWeeklyOffDay,
      isOfficialHoliday: calendarDay.isOfficialHoliday,
      isManualHoliday: false,
      isForcedWorkday: false,
    });

    const updatedDay = await tx.calendarDay.update({
      where: { id: calendarDay.id },
      data: {
        isManualHoliday: false,
        isForcedWorkday: false,
        isWorkday,
        description: appendUniqueDescriptionNote(calendarDay.description, "[Calendar override cleared]"),
        verifiedAt: new Date(),
      },
      select: calendarDayOverrideSelect,
    });

    return {
      ...mapCalendarDayOverrideResult(updatedDay),
      overrideType: null,
    };
  });
}

export async function getCalendarDayOverrideStatus(
  prisma: PrismaClient,
  dateKey: string,
): Promise<CalendarOverrideResult | null> {
  assertDateKey(dateKey);

  const calendarDay = await prisma.calendarDay.findUnique({
    where: { dateKey },
    select: calendarDayOverrideSelect,
  });

  return calendarDay ? mapCalendarDayOverrideResult(calendarDay) : null;
}

function assertDateKey(value: string): void {
  if (!DATE_KEY_PATTERN.test(value)) {
    throw new Error("dateKey must be in YYYY-MM-DD format.");
  }
}

function normalizeReason(reason: CalendarOverrideReason): Required<CalendarOverrideReason> {
  const title = reason.title.trim();

  if (!title) {
    throw new Error("Calendar override title is required.");
  }

  return {
    title,
    description: reason.description ?? null,
    createdById: reason.createdById ?? null,
  };
}

function appendUniqueDescriptionNote(existing: string | null, note: string): string {
  if (!existing) {
    return note;
  }

  const existingNotes = existing.split("\n");
  if (existingNotes.includes(note)) {
    return existing;
  }

  return `${existing}\n${note}`;
}

function mapCalendarDayOverrideResult(day: SelectedCalendarDayOverride): CalendarOverrideResult {
  return {
    calendarDayId: day.id,
    dateKey: day.dateKey,
    jalaliDateKey: day.jalaliDateKey,
    overrideType: day.override?.type ?? null,
    isManualHoliday: day.isManualHoliday,
    isForcedWorkday: day.isForcedWorkday,
    isWorkday: day.isWorkday,
    holidayTitle: day.holidayTitle,
  };
}
