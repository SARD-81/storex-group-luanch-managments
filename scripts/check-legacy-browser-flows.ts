import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import type { BrowserContext, Page } from "playwright";
import { prisma } from "../lib/prisma";
import { getNextDayMealReport } from "../lib/reporter/next-day-report";
import { generateReportPdf } from "../lib/reporter/generate-pdf";
async function submit(page: Page, label: string, url: RegExp) {
  await Promise.all([
    page.waitForURL(url, { waitUntil: "domcontentloaded" }),
    page.getByRole("button", { name: label, exact: true }).click(),
  ]);
}
async function login(
  page: Page,
  base: string,
  username: string,
  password: string,
) {
  await page.goto(base + "/login");
  await page.locator('[name="username"]:visible').fill(username);
  await page.locator('[name="password"]:visible').fill(password);
  await Promise.all([
    page.waitForURL((u) => u.pathname !== "/login", {
      waitUntil: "domcontentloaded",
    }),
    page.getByRole("button", { name: /^ورود/ }).filter({ visible: true }).click(),
  ]);
}
export async function checkLegacyBrowserFlows(
  context: BrowserContext,
  base: string,
) {
  const page = await context.newPage(),
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const username = "web-regression-created",
    password = "browser-test-password-only";
  await page.goto(base + "/settings/users");
  const create = page
    .locator("form")
    .filter({ has: page.locator('[name="username"]') });
  await create.locator('[name="username"]').fill(username);
  await create.locator('[name="name"]').fill("کاربر آزمون مرورگر");
  await create.locator('[name="password"]').fill(password);
  await create.locator('[name="role"]').selectOption("USER");
  await submit(page, "ایجاد کاربر", /saved=created/);
  let row = page.getByRole("row").filter({ hasText: "@" + username });
  await row.locator('[name="autoBreakfast"]').check();
  await row.locator('[name="autoLunch"]').uncheck();
  await row
    .getByRole("button", { name: "ذخیره رزرو خودکار", exact: true })
    .click();
  await page.waitForURL(/saved=auto/);
  const user = await prisma.user.findUniqueOrThrow({ where: { username } });
  assert.equal(user.autoBreakfast, true);
  assert.equal(user.autoLunch, false);
  await page.goto(base + "/settings/users");
  row = page.getByRole("row").filter({ hasText: "@" + username });
  await row.getByRole("button", { name: "غیرفعال‌سازی", exact: true }).click();
  await page.waitForURL(/saved=status/);
  assert.equal(
    (await prisma.user.findUniqueOrThrow({ where: { username } })).isActive,
    false,
  );
  await page.goto(base + "/settings/users");
  row = page.getByRole("row").filter({ hasText: "@" + username });
  await row.getByRole("button", { name: "فعال‌سازی", exact: true }).click();
  await page.waitForURL(/saved=status/);
  const session = await context.browser()!.newContext();
  const own = await session.newPage();
  await login(own, base, username, password);
  // Choose an actual editable current-month workday through the attendance UI.
  const meal = own.locator('input[data-monthly-meal="LUNCH"]:enabled').first();
  await meal.waitFor();
  const dateKey = (await meal.getAttribute("name"))!.split(":")[1];
  const card = meal.locator("xpath=ancestor::article");
  await meal.check();
  await card
    .getByRole("button", { name: "ذخیره همین روز", exact: true })
    .click();
  await own.waitForURL(/saved=1/);
  const attendanceWhere = {
    userId_date_mealType: {
      userId: user.id,
      date: new Date(dateKey + "T00:00:00Z"),
      mealType: "LUNCH" as const,
    },
  };
  assert.equal(
    (await prisma.mealAttendance.findUniqueOrThrow({ where: attendanceWhere }))
      .source,
    "USER_MANUAL",
  );
  await page.goto(base + "/settings/attendance?date=" + dateKey);
  const lunchForm = () =>
    page
      .locator("form")
      .filter({ has: page.locator(`[name="userId"][value="${user.id}"]`) })
      .filter({ has: page.locator('[name="mealType"][value="LUNCH"]') });
  await lunchForm().getByRole("button", { name: "غایب", exact: true }).click();
  await page.waitForURL(/saved=1/);
  assert.equal(
    (await prisma.mealAttendance.findUniqueOrThrow({ where: attendanceWhere }))
      .source,
    "ADMIN_OVERRIDE",
  );
  await own.goto(base + "/");
  assert.equal(
    await own.locator(`[name="meal:${dateKey}:LUNCH"]`).isDisabled(),
    true,
  );
  await page.goto(base + "/settings/attendance?date=" + dateKey);
  await lunchForm()
    .getByRole("button", { name: "لغو تصمیم مدیر", exact: true })
    .click();
  await page.waitForURL(/saved=1/);
  assert.equal(
    (await prisma.mealAttendance.findUniqueOrThrow({ where: attendanceWhere }))
      .status,
    "PRESENT",
  );
  assert.equal(
    (await prisma.mealAttendance.findUniqueOrThrow({ where: attendanceWhere }))
      .source,
    "USER_MANUAL",
  );
  await page.goto(base + "/settings/calendar-overrides?date=" + dateKey);
  await submit(page, "اعمال تعطیلی دستی", /success=manual-holiday/);
  assert.equal(
    (await prisma.calendarDay.findUniqueOrThrow({ where: { dateKey } }))
      .isWorkday,
    false,
  );
  await page.goto(base + "/settings/calendar-overrides?date=" + dateKey);
  await submit(page, "اعمال روز کاری اجباری", /success=forced-workday/);
  assert.equal(
    (await prisma.calendarDay.findUniqueOrThrow({ where: { dateKey } }))
      .isWorkday,
    true,
  );
  await page.goto(base + "/settings/calendar-overrides?date=" + dateKey);
  await submit(page, "پاک کردن تغییر دستی", /success=cleared/);
  await own.goto(base + "/profile");
  await own.locator('[name="firstName"]').fill("نام آزمون");
  await own.locator('[name="lastName"]').fill("خانوادگی آزمون");
  await submit(own, "ذخیره اطلاعات", /saved=profile/);
  assert.equal(
    (await prisma.user.findUniqueOrThrow({ where: { username } })).name,
    "نام آزمون خانوادگی آزمون",
  );
  const avatar = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 4,
      background: { r: 50, g: 90, b: 180, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
  await own.locator('[name="avatar"]').setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: avatar,
  });
  await submit(own, "ذخیره تصویر", /saved=avatar/);
  assert.equal(
    (await own.request.get(base + `/api/users/avatar/${user.id}`)).status(),
    200,
  );
  const before = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
  });
  await own.locator('[name="avatar"]').setInputFiles({
    name: "fake.png",
    mimeType: "image/png",
    buffer: Buffer.from("<svg><script>alert(1)</script></svg>"),
  });
  await submit(own, "ذخیره تصویر", /error=avatar-type/);
  assert.deepEqual(
    (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
      .avatarImage,
    before.avatarImage,
  );
  await submit(own, "حذف تصویر پروفایل", /saved=avatar-deleted/);
  assert.equal(
    (await own.request.get(base + `/api/users/avatar/${user.id}`)).status(),
    404,
  );
  await own.locator('[name="newPassword"]').fill("changed-browser-password");
  await submit(own, "تغییر رمز عبور", /saved=password/);
  await own.goto(base + "/");
  await submit(own, "خروج از حساب", /\/login$/);
  await login(own, base, username, "changed-browser-password");
  await page.goto(base + "/settings/users");
  row = page.getByRole("row").filter({ hasText: "@" + username });
  const reset = row
    .locator("form")
    .filter({ has: page.locator('[name="password"]') });
  await reset.locator('[name="password"]').fill(password);
  await reset.getByRole("button", { name: "ثبت", exact: true }).click();
  await page.waitForURL(/saved=password/);
  await own.goto(base + "/profile");
  await own.waitForURL(/\/login$/);
  await login(own, base, username, password);
  await own.goto(base + "/settings/branding");
  await own.waitForURL((u) => u.pathname === "/");
  assert.equal(
    (
      await own.request.get(
        base + `/settings/branding/preview/${"a".repeat(64)}`,
      )
    ).status(),
    403,
  );
  await session.close();
  // Reporter guest create/update/delete and exports remain usable with automation paused.
  const reporter = await context.browser()!.newContext();
  const rp = await reporter.newPage();
  await login(rp, base, "web-regression-reporter", "web-test-password-only");
  await rp.waitForURL(/\/reporter\/next-day$/);
  for (const [b, l] of [
    [2, 3],
    [4, 1],
    [0, 0],
  ]) {
    await rp.locator('[name="breakfastGuestCount"]').fill(String(b));
    await rp.locator('[name="lunchGuestCount"]').fill(String(l));
    await rp
      .getByRole("button", { name: "ذخیره تعداد مهمان‌ها", exact: true })
      .click();
    await rp.waitForURL(/saved=guest-counts/);
    assert.equal((await getNextDayMealReport()).guestCounts.breakfast, b);
    await rp.goto(base + "/reporter/next-day");
  }
  assert.equal(
    (await rp.request.get(base + "/reporter/next-day/export")).status(),
    200,
  );
  await rp.goto(base + "/reports");
  await rp.waitForURL(/\/reporter\/next-day$/);
  await reporter.close();
  // Settings pause/resume and queued health checks have no network execution in CI.
  await page.goto(base + "/settings/automations/reporter");
  await page
    .locator('[name="nextcloudBaseUrl"]')
    .fill("https://cloud.example.test");
  await page.locator('[name="reportRecipient"]').fill("123456");
  await page.locator('[name="technicalConversation"]').fill("testgroup");
  await page.locator('[name="reporterEnabled"]').check();
  await submit(page, "ذخیرهٔ تنظیمات", /saved=config/);
  assert.equal(
    (
      await prisma.automationConfig.findUniqueOrThrow({
        where: { id: "singleton" },
      })
    ).reporterEnabled,
    true,
  );
  await page.goto(base + "/settings/automations/reporter");
  await page.locator('[name="reporterEnabled"]').uncheck();
  await submit(page, "ذخیرهٔ تنظیمات", /saved=config/);
  assert.equal(
    (
      await prisma.automationConfig.findUniqueOrThrow({
        where: { id: "singleton" },
      })
    ).reporterEnabled,
    false,
  );
  await page.goto(base + "/settings/automations");
  await submit(page, "آزمون بله", /saved=queued/);
  assert.ok(
    await prisma.automationJobRun.count({
      where: { jobType: "BALE_HEALTH", status: "PENDING" },
    }),
  );
  // Twelve-month emergency multi-select, Persian input, CSV, preview and explicit apply.
  await page.goto(base + "/settings/automations/calendar?year=1406");
  for (let m = 1; m <= 12; m++)
    await page
      .locator(
        `[name="selectedDates"][value="1406-${String(m).padStart(2, "0")}-02"]`,
      )
      .check();
  await page.locator('[name="holidayText"]').fill("۱۴۰۶/۰۱/۰۳ | آزمون تعطیلی");
  await page.locator('[name="csv"]').setInputFiles({
    name: "holidays.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "jalali_date,title,is_official_holiday\n1406-02-03,تعطیلی CSV,true",
    ),
  });
  await submit(page, "ساخت پیش‌نمایش و اختلاف‌ها", /preview=/);
  const previewId = new URL(page.url()).searchParams.get("preview")!,
    dataset = await prisma.calendarDataset.findUniqueOrThrow({
      where: { id: previewId },
    });
  assert.equal((dataset.payload as { events: unknown[] }).events.length, 14);
  assert.equal(dataset.status, "STAGED");
  assert.equal(
    await prisma.calendarEvent.count({
      where: {
        sourceName: "manual-official-calendar-fallback",
        calendarDay: { jalaliYear: 1406 },
      },
    }),
    0,
  );
  await page.locator('[name="confirmed"]').check();
  await submit(page, "اعمال مجموعهٔ تأییدشده", /saved=applied/);
  assert.equal(
    (
      await prisma.calendarDataset.findUniqueOrThrow({
        where: { id: previewId },
      })
    ).status,
    "VERIFIED",
  );
  await page.screenshot({
    path: "verification-output/emergency-calendar-applied.png",
    fullPage: true,
  });
  // Three actual image formats/aspect ratios: preview cannot alter the current logo.
  const report = await getNextDayMealReport();
  const initial =
    (await prisma.brandingConfig.findUnique({ where: { id: "singleton" } }))
      ?.activeHash ?? null;
  let priorHash = initial;
  for (const [label, width, height, format] of [
    ["wide-transparent", 640, 120, "png"],
    ["square", 256, 256, "jpeg"],
    ["webp", 180, 320, "webp"],
  ] as const) {
    await page.goto(base + "/settings/branding");
    const bytes = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: {
          r: 30,
          g: 140,
          b: 100,
          alpha: format === "png" ? 0.4 : 1,
        },
      },
    })
      [format]()
      .toBuffer();
    await page.locator('[name="logo"]').setInputFiles({
      name: `logo.${format}`,
      mimeType: `image/${format}`,
      buffer: bytes,
    });
    await submit(page, "بررسی و پیش‌نمایش", /preview=/);
    assert.equal(
      (await prisma.brandingConfig.findUnique({ where: { id: "singleton" } }))
        ?.activeHash ?? null,
      priorHash,
    );
    const hash = new URL(page.url()).searchParams.get("preview")!;
    assert.equal(
      (
        await page.request.get(base + `/settings/branding/preview/${hash}`)
      ).status(),
      200,
    );
    await page.screenshot({
      path: `verification-output/logo-preview-${label}.png`,
      fullPage: true,
    });
    await submit(page, "تأیید و اعمال سراسری", /saved=logo/);
    priorHash = hash;
    assert.equal(
      (await page.request.get(base + "/api/branding/logo")).headers()[
        "cache-control"
      ],
      "no-store",
    );
    for (const route of [
      "/",
      "/login",
      "/profile",
      "/settings/users",
      "/settings/attendance",
      "/settings/calendar-overrides",
      "/settings/audit-logs",
      "/settings/automations",
      "/reports",
      "/reporter/next-day",
    ]) {
      await page.goto(base + route);
      await page.getByRole("img", { name: "نشان شرکت", exact: true }).waitFor();
      await page.waitForFunction(() => {
        const img = document.querySelector<HTMLImageElement>(
          'img[alt="نشان شرکت"]',
        );
        return img?.complete && img.naturalWidth > 0;
      });
    }
    await page.locator(".meal-report img").waitFor();
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: `verification-output/manual-logo-${label}.pdf`,
      preferCSSPageSize: true,
    });
    await page.emulateMedia({ media: "screen" });
    await writeFile(
      `verification-output/server-logo-${label}.pdf`,
      await generateReportPdf(report),
    );
    const excel = await page.request.get(base + "/reporter/next-day/export");
    assert.equal(excel.status(), 200);
    assert.ok((await excel.body()).length > 1000);
  }
  await page.goto(base + "/settings/branding");
  await submit(page, "بازگردانی نسخهٔ قبلی", /saved=logo/);
  assert.notEqual(
    (
      await prisma.brandingConfig.findUniqueOrThrow({
        where: { id: "singleton" },
      })
    ).activeHash,
    priorHash,
  );
  await page.goto(base + "/settings/branding");
  await submit(page, "بازگردانی نسخهٔ اولیه", /saved=logo/);
  assert.equal(
    (
      await prisma.brandingConfig.findUniqueOrThrow({
        where: { id: "singleton" },
      })
    ).activeHash,
    null,
  );
  await writeFile(
    "verification-output/server-logo-restored.pdf",
    await generateReportPdf(report),
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "verification-output/legacy-browser-flows.json",
    JSON.stringify({
      createUser: true,
      activation: true,
      manualAttendance: true,
      adminOverrideAndClear: true,
      calendarOverrides: true,
      automationPauseResumeAndQueue: true,
      automaticMealsIndependent: true,
      profile: true,
      avatarDecodeAndDelete: true,
      passwordChangeAndReset: true,
      resetRevokesSessions: true,
      roles: true,
      guestsCrud: true,
      emergencyTwelveMonthsCsvAndApproval: true,
      logoFormats: 3,
      logoPreviewBeforeApply: true,
      logoAllSurfaces: true,
      logoRollback: true,
    }),
  );
  await page.close();
}
