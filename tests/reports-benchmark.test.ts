import { test, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { getAttendanceReport } from "../lib/reports/get-attendance-report";
import { prisma } from "../lib/prisma";
after(() => prisma.$disconnect());
test(
  "100-person reports cover 1/7/31/90/180/365 days with bounded queries",
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
    assert.match(new URL(url).hostname, /^(localhost|127\.0\.0\.1)$/);
    const db = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url }),
        log: [{ level: "query", emit: "event" }],
      }),
      prefix = "report-benchmark-";
    let queries = 0;
    db.$on("query", () => {
      queries++;
    });
    try {
      await db.user.createMany({
        data: Array.from({ length: 100 }, (_, i) => ({
          id: prefix + i,
          username: prefix + i,
          name: "نام پرسنل آزمون " + i,
        })),
      });
      const rows = [];
      for (let d = 0; d < 365; d++)
        for (let u = 0; u < 100; u++)
          for (const mealType of ["BREAKFAST", "LUNCH"] as const)
            rows.push({
              userId: prefix + u,
              date: new Date(Date.UTC(2026, 2, 21) + d * 86400000),
              mealType,
              status: "PRESENT" as const,
            });
      for (let i = 0; i < rows.length; i += 2000)
        await db.mealAttendance.createMany({ data: rows.slice(i, i + 2000) });
      for (const days of [1, 7, 31, 90, 180, 365]) {
        queries = 0;
        const start = performance.now(),
          report = await getAttendanceReport(
            new Date("2026-03-21"),
            new Date(Date.UTC(2026, 2, 21) + (days - 1) * 86400000),
            db,
          ),
          ms = Math.round(performance.now() - start);
        assert.equal(
          report.dailySummary.length + report.calendarExcludedDays.length,
          days,
        );
        assert.equal(
          report.userRows.filter((r) => r.username.startsWith(prefix)).length,
          report.dailySummary.length * 100,
        );
        assert.ok(
          report.dailySummary.every(
            (d) => d.breakfastCount === 100 && d.lunchCount === 100,
          ),
        );
        assert.ok(
          queries <= 8,
          `range must not cause per-day/user queries: ${queries}`,
        );
        assert.ok(ms < 10000, `range timed out: ${ms}ms`);
        console.log(
          JSON.stringify({
            benchmark: "attendance-report",
            users: 100,
            days,
            queries,
            ms,
            rows: report.userRows.length,
            rssMiB: Math.round(process.memoryUsage().rss / 1048576),
          }),
        );
      }
    } finally {
      await db.user.deleteMany({ where: { username: { startsWith: prefix } } });
      await db.$disconnect();
    }
  },
);
