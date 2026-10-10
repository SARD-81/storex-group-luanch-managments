import { readFile, stat } from "node:fs/promises";
import { OFFICIAL_PARSER_VERSION } from "@/lib/calendar/parser-certification";
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
export const CALENDAR_PARSER_VERSION = OFFICIAL_PARSER_VERSION;
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
  approvedLocal?: { bytes: Buffer; sourceUrl: string },
) {
  await stage("DISCOVER");
  const url =
    approvedLocal?.sourceUrl ??
    (await discoverCalendarPdf(year, config.calendarSourceOverride));
  await stage(approvedLocal ? "APPROVED_LOCAL_SOURCE" : "DOWNLOAD");
  let bytes: Buffer;
  if (approvedLocal) bytes = approvedLocal.bytes;
  else {
    const response = await safeFetch(url, {}, approvedHosts());
    if (!response.ok)
      throw new AutomationError("CALENDAR_DOWNLOAD_FAILED", response.status);
    bytes = await boundedBytes(response);
  }
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
  if (
    prior?.status === "VERIFIED" &&
    prior.parserVersion === CALENDAR_PARSER_VERSION
  )
    return;
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
        {
          timeout: 60000,
          maxBuffer: 10 * 1024 * 1024,
          env: {
            PATH: process.env.PATH,
            LANG: "C.UTF-8",
            TZ: "Asia/Tehran",
            NODE_ENV: "production",
          },
        },
      )
    ).stdout;
  } catch (error) {
    let code = "PDF_EXTRACTION_FAILED";
    try {
      const result = JSON.parse(
        String((error as { stdout?: string }).stdout ?? ""),
      );
      if (
        typeof result.error === "string" &&
        /^[A-Z][A-Z0-9_]{1,80}$/.test(result.error)
      )
        code = result.error;
    } catch {}
    await stage(`SOURCE_INVALID:${code}`);
    throw new AutomationError(code);
  }
  await storeArtifact(db, {
    artifactKey: `parser-json:${year}:${hash}:${CALENDAR_PARSER_VERSION}:${createHash("sha256").update(output).digest("hex")}`,
    type: "PARSER_JSON",
    target: String(year),
    extension: "json",
    bytes: Buffer.from(output),
    nextcloudPath: `${config.calendarDirectory}/${year}/${hash}/${CALENDAR_PARSER_VERSION}/${createHash("sha256").update(output).digest("hex")}/parsed.json`,
  });
  const parsed = JSON.parse(output);
  // No golden certification => no fabricated calendar or partial import.
  if (parsed.parserVerified !== true) {
    await stage("SOURCE_SEMANTIC_REVIEW_REQUIRED");
    throw new AutomationError("PARSER_SOURCE_REVIEW_REQUIRED");
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
    artifactKey: `diff:${year}:${hash}:${CALENDAR_PARSER_VERSION}:${createHash("sha256").update(JSON.stringify(dataset.diff)).digest("hex")}`,
    type: "CALENDAR_DIFF",
    target: String(year),
    extension: "json",
    bytes: Buffer.from(JSON.stringify(dataset.diff, null, 2)),
    nextcloudPath: `${config.calendarDirectory}/${year}/${hash}/${CALENDAR_PARSER_VERSION}/${createHash("sha256").update(JSON.stringify(dataset.diff)).digest("hex")}/diff.json`,
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

/** Operator-approved local PDF always stages; it never promotes or sends. */
export async function stageApprovedLocalCalendar(
  db: PrismaClient,
  config: AutomationConfig,
  year: number,
  pdfPath: string,
  expectedSha256: string,
  stage: (s: string) => Promise<void>,
) {
  if (!/^[a-f0-9]{64}$/.test(expectedSha256))
    throw new AutomationError("INVALID_SOURCE_CHECKSUM");
  const info = await stat(pdfPath);
  if (!info.isFile() || info.size > 20 * 1024 * 1024)
    throw new AutomationError("INVALID_OFFICIAL_PDF");
  const bytes = await readFile(pdfPath);
  if (createHash("sha256").update(bytes).digest("hex") !== expectedSha256)
    throw new AutomationError("SOURCE_CHECKSUM_MISMATCH");
  return synchronizeCalendar(db, config, year, stage, true, {
    bytes,
    sourceUrl: `urn:storex:approved-local:${expectedSha256}`,
  });
}
