/** Opt-in actual-PDF pipeline proof. Guarded against production databases. */
import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { getAutomationConfig } from "../lib/automation/config";
import { stageApprovedLocalCalendar } from "../lib/automation/calendar";
import { applyAnnualDataset } from "../lib/calendar/datasets";
async function main() {
  const url = process.env.TEST_DATABASE_URL!;
  assert.equal(url, process.env.DATABASE_URL);
  assert.match(new URL(url).hostname, /^(localhost|127\.0\.0\.1)$/);
  if (process.env.TEST_PGLITE !== "true")
    assert.match(new URL(url).pathname, /_test$/);
  const file = process.argv.find((a) => a.startsWith("--pdf="))?.slice(6),
    sha = process.argv.find((a) => a.startsWith("--sha256="))?.slice(9);
  assert.ok(file && sha);
  const spool = await mkdtemp(path.join(tmpdir(), "calendar-proof-"));
  process.env.AUTOMATION_SPOOL_DIR = spool;
  const actor = await prisma.user.create({
    data: {
      username: `pdf-pipeline-${randomUUID()}`,
      name: "آزمون تقویم",
      role: "ADMIN",
    },
  });
  const config = await getAutomationConfig(prisma),
    stages: string[] = [];
  try {
    const before = await prisma.calendarEvent.count({
      where: { calendarDay: { jalaliYear: 1405 } },
    });
    await stageApprovedLocalCalendar(
      prisma,
      config,
      1405,
      file,
      sha,
      async (s) => {
        stages.push(s);
      },
    );
    assert.equal(
      await prisma.calendarEvent.count({
        where: { calendarDay: { jalaliYear: 1405 } },
      }),
      before,
      "staging must not mutate active calendar",
    );
    const staged = await prisma.calendarDataset.findUniqueOrThrow({
      where: {
        year_sourceName_sourceHash: {
          year: 1405,
          sourceName: "tehran-university-official-calendar-1405",
          sourceHash: sha,
        },
      },
    });
    const history = await prisma.mealAttendance.create({
      data: {
        userId: actor.id,
        date: new Date("2026-04-01T00:00:00Z"),
        mealType: "LUNCH",
        status: "ABSENT",
        source: "USER_MANUAL",
        manuallyEdited: true,
      },
    });
    await applyAnnualDataset(prisma, staged.id, actor);
    assert.deepEqual(
      await prisma.mealAttendance.findUnique({ where: { id: history.id } }),
      history,
      "past manual attendance must remain byte-for-byte unchanged",
    );
    const days = await prisma.calendarDay.findMany({
      where: { jalaliYear: 1405 },
    });
    assert.equal(days.length, 365);
    assert.equal(days.filter((d) => d.isOfficialHoliday).length, 26);
    assert.equal(days.filter((d) => d.isWeeklyOffDay).length, 104);
    assert.equal(days.filter((d) => d.isWorkday).length, 244);
    assert.equal(
      await prisma.calendarEvent.count({
        where: {
          sourceName: staged.sourceName,
          calendarDay: { jalaliYear: 1405 },
        },
      }),
      459,
    );
    const verified = await prisma.calendarDataset.findUniqueOrThrow({
      where: { id: staged.id },
    });
    assert.equal(verified.status, "VERIFIED");
    const batchCount = await prisma.calendarImportBatch.count({
      where: { year: 1405 },
    });
    await applyAnnualDataset(prisma, staged.id, actor);
    assert.equal(
      await prisma.calendarImportBatch.count({ where: { year: 1405 } }),
      batchCount,
    );
    const bytes = await readFile(file),
      unknown = Buffer.concat([
        bytes,
        Buffer.from("\n% unreviewed identical-text edition\n"),
      ]),
      unknownFile = path.join(spool, "unreviewed.pdf");
    await writeFile(unknownFile, unknown, { mode: 0o600 });
    await assert.rejects(
      () =>
        stageApprovedLocalCalendar(
          prisma,
          config,
          1405,
          unknownFile,
          createHash("sha256").update(unknown).digest("hex"),
          async () => {},
        ),
      /PARSER_SOURCE_REVIEW_REQUIRED/,
    );
    await assert.rejects(
      () =>
        stageApprovedLocalCalendar(
          prisma,
          config,
          1406,
          file,
          sha,
          async () => {},
        ),
      /PDF_YEAR_MISMATCH/,
    );
    assert.deepEqual(
      await prisma.calendarDay.findMany({ where: { jalaliYear: 1405 } }),
      days,
    );
    console.log(
      JSON.stringify({
        actualSourceSha256: sha,
        stagingDoesNotMutate: true,
        parserVerified: true,
        days: 365,
        events: 459,
        officialHolidays: 26,
        weeklyOffDays: 104,
        workdays: 244,
        pastManualAttendancePreserved: true,
        repeatedImportIdempotent: true,
        unknownSourceRejected: true,
        wrongYearRejected: true,
        stages,
        databaseEngine:
          process.env.TEST_PGLITE === "true" ? "PGLITE" : "POSTGRESQL",
      }),
    );
  } finally {
    await prisma.mealAttendance.deleteMany({ where: { userId: actor.id } });
    await prisma.user.delete({ where: { id: actor.id } });
    await rm(spool, { recursive: true, force: true });
  }
}
main()
  .catch(() => {
    console.error(
      JSON.stringify({ error: "ACTUAL_PDF_PIPELINE_PROOF_FAILED" }),
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
