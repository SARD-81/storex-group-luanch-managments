import { createHash } from "node:crypto";
import certificates from "@/scripts/official_calendar/certificates.json";
import { buildBaseJalaliYearDays } from "./calendar-date";
export const OFFICIAL_PARSER_VERSION = "ut-evidence-parser-v2";
export type ParsedDailyRecord = {
  jalaliDateKey: string;
  dateKey: string;
  dayOfWeek: number;
  isOfficialHoliday: boolean;
};
export type ParsedEvent = {
  eventKey: string;
  jalaliDateKey: string;
  title: string;
  type: string;
  calendarType: string;
  isHoliday: boolean;
  displayOrder: number;
  sourcePage: number | null;
  sourceSection: string;
};
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function validateParsedDailyRecords(
  year: number,
  records: ParsedDailyRecord[],
  events: ParsedEvent[],
) {
  const base = buildBaseJalaliYearDays(year);
  if (records.length !== base.length)
    throw new Error("PARSER_DAILY_YEAR_INCOMPLETE");
  const holidays = new Set(
    events.filter((e) => e.isHoliday).map((e) => e.jalaliDateKey),
  );
  for (const [index, day] of base.entries()) {
    const actual = records[index];
    if (
      actual.jalaliDateKey !== day.jalaliDateKey ||
      actual.dateKey !== day.dateKey ||
      actual.dayOfWeek !== day.dayOfWeek ||
      actual.isOfficialHoliday !== holidays.has(day.jalaliDateKey)
    )
      throw new Error("PARSER_DAILY_MAPPING_MISMATCH");
  }
}
export function verifyParserCertificate(data: {
  year: number;
  sourceHash: string;
  parserVersion: string;
  dailyRecords?: ParsedDailyRecord[];
  events: ParsedEvent[];
}) {
  if (data.parserVersion !== OFFICIAL_PARSER_VERSION || !data.dailyRecords)
    throw new Error("PARSER_CERTIFICATE_REQUIRED");
  validateParsedDailyRecords(data.year, data.dailyRecords, data.events);
  const certificate = (
    certificates as Record<
      string,
      {
        year: number;
        parserVersion: string;
        semanticHash: string;
        eventCount: number;
      }
    >
  )[data.sourceHash];
  const events = data.events.map(
    ({
      eventKey,
      jalaliDateKey,
      title,
      type,
      calendarType,
      isHoliday,
      displayOrder,
      sourcePage,
      sourceSection,
    }) => ({
      eventKey,
      jalaliDateKey,
      title,
      type,
      calendarType,
      isHoliday,
      displayOrder,
      sourcePage,
      sourceSection,
    }),
  );
  const hash = createHash("sha256")
    .update(
      stableJson(
        events.toSorted((a, b) =>
          a.eventKey < b.eventKey ? -1 : a.eventKey > b.eventKey ? 1 : 0,
        ),
      ),
    )
    .digest("hex");
  if (
    !certificate ||
    certificate.year !== data.year ||
    certificate.parserVersion !== data.parserVersion ||
    certificate.semanticHash !== hash ||
    certificate.eventCount !== events.length
  )
    throw new Error("PARSER_CERTIFICATE_MISMATCH");
}
