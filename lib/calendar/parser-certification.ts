import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import certificates from "@/scripts/official_calendar/certificates.json";
import { buildBaseJalaliYearDays } from "./calendar-date";
export const OFFICIAL_PARSER_VERSION = "ut-evidence-parser-v2";
export const AUTOMATED_PARSER_VERSION = "ut-evidence-parser-v2-auto-attested-v1";
const AUTO_ATTESTATION_CONTEXT = "storex/calendar/auto-attested/v1\\0";
const AUTO_KEY_NAME = "CALENDAR_ATTESTATION_KEY";
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
/**
 * Server-only attestation for exhaustively parsed trusted PDF bytes.
 * Admin JSON cannot assert parserVerified simply by setting a boolean.
 */
export function signAutomaticDataset<T extends { attestation?: string }>(data: T): string {
  const secret = process.env[AUTO_KEY_NAME];
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret))
    throw new Error("CALENDAR_ATTESTATION_KEY_NOT_CONFIGURED");
  const { attestation: _discard, ...unsigned } = data;
  return createHmac("sha256", Buffer.from(secret, "hex"))
    .update(AUTO_ATTESTATION_CONTEXT)
    .update(stableJson(unsigned))
    .digest("hex");
}
export function verifyAutomaticAttestation(
  data: { year: number; mode: string; parserVersion: string; parserVerified: boolean; attestation?: string; sourceName: string; sourceHash: string; dailyRecords?: ParsedDailyRecord[]; events: ParsedEvent[] },
) {
  if (
    data.year < 1406 ||
    data.mode !== "OFFICIAL" ||
    data.parserVersion !== AUTOMATED_PARSER_VERSION ||
    !data.parserVerified ||
    data.sourceName !== `tehran-university-official-calendar-${data.year}` ||
    !data.dailyRecords ||
    !/^[a-f0-9]{64}$/.test(data.attestation ?? "")
  )
    throw new Error("AUTOMATED_CALENDAR_ATTESTATION_INVALID");
  validateParsedDailyRecords(data.year, data.dailyRecords, data.events);
  const expected = Buffer.from(signAutomaticDataset(data), "hex");
  const actual = Buffer.from(data.attestation!, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("AUTOMATED_CALENDAR_ATTESTATION_INVALID");
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
