import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import type {
  AutomationConfig,
  PrismaClient,
} from "@/app/generated/prisma/client";
import {
  AnnualDataset,
  applyAnnualDataset,
  stageAnnualDataset,
} from "@/lib/calendar/datasets";
import { AutomationError, boundedBytes, safeFetch } from "./http";
import { queueAlert, storeArtifact } from "./jobs";
import { getJalaliPartsFromUtcDate } from "@/lib/calendar/calendar-date";
import { getTehranDateKey } from "@/lib/date/tehran-time";
const execute = promisify(execFile);
export const CALENDAR_PARSER_VERSION = "ut-text-extractor-v1-unverified";
const approvedHosts = () => [
  "calendar.ut.ac.ir",
  ...(process.env.CALENDAR_APPROVED_SOURCE_HOSTS ?? "")
    .split(",")
    .filter(Boolean),
];
export function verifyPdf(bytes: Buffer) {
  if (
    bytes.length < 10000 ||
    bytes.length > 20 * 1024 * 1024 ||
    bytes.subarray(0, 5).toString() !== "%PDF-"
  )
    throw new AutomationError("INVALID_OFFICIAL_PDF");
}
export async function discoverCalendarPdf(year: number, override = "") {
  if (override) {
    const url = new URL(override);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !approvedHosts().includes(url.hostname)
    )
      throw new AutomationError("UNTRUSTED_CALENDAR_SOURCE");
    return url.toString();
  }
  const response = await safeFetch("https://calendar.ut.ac.ir/", {}, [
    "calendar.ut.ac.ir",
  ]);
  if (!response.ok)
    throw new AutomationError("CALENDAR_DISCOVERY_FAILED", response.status);
  const html = (await boundedBytes(response, 2 * 1024 * 1024)).toString();
  const links = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) =>
    m[1].replaceAll("&amp;", "&"),
  );
  const candidate = links.find((l) => l.includes(`Calendar-${year}.pdf`));
  if (!candidate) throw new AutomationError("OFFICIAL_YEAR_NOT_PUBLISHED");
  const url = new URL(candidate, "https://calendar.ut.ac.ir/");
  if (url.hostname !== "calendar.ut.ac.ir" || url.protocol !== "https:")
    throw new AutomationError("UNTRUSTED_CALENDAR_SOURCE");
  return url.toString();
}
export async function synchronizeCalendar(
  db: PrismaClient,
  config: AutomationConfig,
  year: number,
  stage: (s: string) => Promise<void>,
  dryRun = false,
) {
  await stage("DISCOVER");
  const url = await discoverCalendarPdf(year, config.calendarSourceOverride);
  await stage("DOWNLOAD");
  const response = await safeFetch(url, {}, approvedHosts());
  if (!response.ok)
    throw new AutomationError("CALENDAR_DOWNLOAD_FAILED", response.status);
  const bytes = await boundedBytes(response);
  await stage("VERIFY_PDF");
  verifyPdf(bytes);
  await stage("HASH");
  const hash = createHash("sha256").update(bytes).digest("hex"),
    sourceName = `tehran-university-official-calendar-${year}`;
  const prior = await db.calendarDataset.findUnique({
    where: {
      year_sourceName_sourceHash: { year, sourceName, sourceHash: hash },
    },
  });
  if (prior?.status === "VERIFIED") return;
  const pdf = await storeArtifact(db, {
    artifactKey: `official-pdf:${year}:${hash}`,
    type: "CALENDAR_PDF",
    target: String(year),
    extension: "pdf",
    bytes,
    nextcloudPath: `${config.calendarDirectory}/${year}/${hash}/official.pdf`,
  });
  await stage("EXTRACT");
  let output: string;
  try {
    output = (
      await execute(
        process.env.CALENDAR_PYTHON ?? "python3",
        [
          path.join(process.cwd(), "scripts/parse-official-calendar.py"),
          pdf.spoolPath,
          String(year),
        ],
        { timeout: 60000, maxBuffer: 10 * 1024 * 1024 },
      )
    ).stdout;
  } catch {
    throw new AutomationError("PDF_EXTRACTION_FAILED");
  }
  await storeArtifact(db, {
    artifactKey: `parser-json:${year}:${hash}`,
    type: "PARSER_JSON",
    target: String(year),
    extension: "json",
    bytes: Buffer.from(output),
    nextcloudPath: `${config.calendarDirectory}/${year}/${hash}/parsed.json`,
  });
  const parsed = JSON.parse(output);
  // No golden certification => no fabricated calendar or partial import.
  if (parsed.parserVerified !== true) {
    await stage("GOLDEN_LAYOUT_CALIBRATION_REQUIRED");
    throw new AutomationError("PARSER_GOLDEN_VALIDATION_REQUIRED");
  }
  await stage("NORMALIZE_VALIDATE");
  const payload: AnnualDataset = {
    ...parsed,
    year,
    sourceName,
    sourceHash: hash,
    mode: "OFFICIAL",
  };
  const dataset = await stageAnnualDataset(db, payload, url);
  await storeArtifact(db, {
    artifactKey: `diff:${year}:${hash}`,
    type: "CALENDAR_DIFF",
    target: String(year),
    extension: "json",
    bytes: Buffer.from(JSON.stringify(dataset.diff, null, 2)),
    nextcloudPath: `${config.calendarDirectory}/${year}/${hash}/diff.json`,
  });
  if (dryRun) return;
  const start =
    payload.year <=
    getJalaliPartsFromUtcDate(new Date(getTehranDateKey() + "T00:00:00Z")).year;
  const fallback = await db.calendarDataset.count({
    where: {
      year,
      sourceName: "manual-official-calendar-fallback",
      status: "VERIFIED",
    },
  });
  const verified = await db.calendarEvent.count({
    where: { sourceName, calendarDay: { jalaliYear: year } },
  });
  if (fallback || (start && verified > 0)) {
    await stage("ADMIN_REVIEW_REQUIRED");
    await db.calendarDataset.update({
      where: { id: dataset.id },
      data: { status: "REVIEW_REQUIRED" },
    });
    await queueAlert(
      db,
      "CALENDAR",
      String(year),
      `calendar-review:${year}:${hash}`,
      `منبع رسمی تقویم ${year} آماده است؛ اختلاف با تقویم فعال/اضطراری نیاز به تأیید مدیر دارد.`,
    );
    return;
  }
  await stage("IMPORT_POST_VERIFY");
  await applyAnnualDataset(db, dataset.id, null);
  await queueAlert(
    db,
    "CALENDAR",
    String(year),
    `calendar-success:${year}:${hash}`,
    `SUCCESS: تقویم رسمی سال ${year} وارد و تأیید شد.`,
  );
}
