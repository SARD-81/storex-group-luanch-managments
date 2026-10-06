import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import type { NextDayMealReport } from "./next-day-report";
import { reportDocumentHtml } from "./report-document";
export async function generateReportPdf(report: NextDayMealReport) {
  const logo = await readFile(
    path.join(process.cwd(), "public/company-logo.png"),
  )
    .then((b) => "data:image/png;base64," + b.toString("base64"))
    .catch(() => undefined);
  let fontCss = "";
  if (process.env.REPORT_PDF_FONT_PATH) {
    const font = await readFile(process.env.REPORT_PDF_FONT_PATH);
    fontCss = `@font-face{font-family:ReportPersian;src:url(data:font/ttf;base64,${font.toString("base64")})}.meal-report{font-family:ReportPersian,sans-serif}`;
  }
  const browser = await chromium.launch({
    headless: true,
    timeout: 30000,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  try {
    const page = await browser.newPage();
    await page.route("**/*", (route) => route.abort()); // No external content or authenticated sessions.
    await page.setContent(reportDocumentHtml(report, logo, fontCss), {
      waitUntil: "load",
      timeout: 30000,
    });
    await page.evaluate(() => document.fonts.ready);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return Buffer.from(
        await Promise.race([
          page.pdf({
            format: "A5",
            landscape: false,
            printBackground: false,
            preferCSSPageSize: true,
          }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("PDF_TIMEOUT")), 30000);
          }),
        ]),
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  } finally {
    await browser.close();
  }
}
