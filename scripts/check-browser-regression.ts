import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright";
import { getNextDayMealReport } from "../lib/reporter/next-day-report";
import { generateReportPdf } from "../lib/reporter/generate-pdf";
export async function checkBrowser(base: string, cookie: string) {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.addCookies([
      {
        name: "meal_dashboard_session",
        value: cookie.split("=")[1],
        url: base,
      },
    ]);
    const page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/reports?from=2026-03-21&to=2027-03-20");
    for (let i = 0; i < 6; i++) {
      const prior = page.url();
      await page
        .locator("label")
        .filter({ hasText: "تا تاریخ" })
        .locator("button")
        .click();
      await page
        .locator(".rmdp-day:not(.rmdp-disabled):not(.rmdp-day-hidden) > span")
        .nth(i + 5)
        .click();
      assert.equal(
        page.url(),
        prior,
        "draft changes must not navigate before Apply",
      );
      await page.getByRole("button", { name: "اعمال فیلتر" }).click();
      await page.waitForURL((url) => url.toString() !== prior, {
        timeout: 15000,
      });
      await page
        .getByRole("button", { name: "اعمال فیلتر" })
        .waitFor({ state: "visible" });
      assert.equal(
        await page.getByRole("button", { name: "اعمال فیلتر" }).isEnabled(),
        true,
      );
    }
    await page.screenshot({
      path: "verification-output/reports-desktop.png",
      fullPage: true,
    });
    for (const route of [
      "/settings/attendance",
      "/settings/automations",
      "/settings/automations/reporter",
      "/settings/automations/calendar?year=1406",
      "/profile",
      "/reporter/next-day",
    ]) {
      await page.goto(base + route);
      assert.ok((await page.locator("body").innerText()).trim().length > 50);
      assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
    }
    await page.screenshot({
      path: "verification-output/reporter-screen.png",
      fullPage: true,
    });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: "verification-output/manual-print.pdf",
      preferCSSPageSize: true,
    });
    await page.emulateMedia({ media: "screen" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/reports?from=2026-03-21&to=2027-03-20");
    await page
      .locator("label")
      .filter({ hasText: "تا تاریخ" })
      .locator("button")
      .click();
    await page.locator(".rmdp-calendar").waitFor({ state: "visible" });
    const box = await page.locator(".rmdp-calendar").boundingBox();
    assert.ok(
      box && box.x >= -1 && box.x + box.width <= 391,
      "mobile picker must fit the viewport",
    );
    await page.screenshot({
      path: "verification-output/reports-mobile-picker.png",
      fullPage: true,
    });
    await page
      .locator(".rmdp-day:not(.rmdp-disabled):not(.rmdp-day-hidden) > span")
      .nth(15)
      .click();
    await page.getByRole("button", { name: "اعمال فیلتر" }).click();
    assert.deepEqual(errors, [], "browser must have no runtime errors");
    const report = await getNextDayMealReport();
    for (const [label, count, guests] of [
      ["normal", report.peopleRows.length, 2],
      ["long-names", 60, 20],
      ["empty", 0, 0],
    ] as const) {
      const people = Array.from({ length: count }, (_, i) => ({
        userId: `test-${i}`,
        username: `test-${i}`,
        name:
          label === "long-names"
            ? "نام و نام خانوادگی بسیار طولانی برای بررسی شکست سطر و ادامهٔ خوانایی جدول " +
              i
            : "کارمند نمونه " + i,
        breakfastPresent: true,
        lunchPresent: i % 2 === 0,
      }));
      const data = {
        ...report,
        peopleRows: people,
        guestCounts: { breakfast: guests, lunch: guests },
        totals: {
          ...report.totals,
          breakfastEmployees: count,
          lunchEmployees: Math.ceil(count / 2),
          breakfastGuests: guests,
          lunchGuests: guests,
          breakfastAll: count + guests,
          lunchAll: Math.ceil(count / 2) + guests,
        },
      };
      await writeFile(
        `verification-output/server-${label}.pdf`,
        await generateReportPdf(data),
      );
    }
    const inspect = await promisify(execFile)(
      process.env.CALENDAR_PYTHON ?? "python3",
      ["scripts/inspect-report-pdfs.py", "verification-output"],
      { timeout: 30000, maxBuffer: 1024 * 1024 },
    );
    await writeFile("verification-output/pdf-inspection.json", inspect.stdout);
    console.log(
      JSON.stringify({
        browserRegression: "PASS",
        repeatedDateChanges: 6,
        pdfInspection: JSON.parse(inspect.stdout),
      }),
    );
  } finally {
    await browser.close();
  }
}
