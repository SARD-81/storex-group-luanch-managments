import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { checkBrowser } from "./check-browser-regression";
import { prisma } from "../lib/prisma";
const base = "http://127.0.0.1:3100",
  prefix = "web-regression-";
async function assertRedirect(response:Response,target:string) {
  if([303,307,308].includes(response.status)){assert.equal(response.headers.get("location"),target);return;}
  const body=await response.text();assert.equal(response.status,200);assert.ok(body.includes('http-equiv="refresh"')&&body.includes(`url=${target}"`),`expected streamed redirect to ${target}`);
}
async function main() {
  assert.equal(process.env.TEST_DATABASE_URL, process.env.DATABASE_URL);
  assert.match(
    new URL(process.env.DATABASE_URL!).hostname,
    /^(localhost|127\.0\.0\.1)$/,
  );
  if(process.env.TEST_PGLITE!=="true") assert.match(new URL(process.env.TEST_DATABASE_URL!).pathname,/_test$/);
  const cookies = new Map<string, string>();
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3100",
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_ENV: "production",
        AUTH_COOKIE_SECURE: "false",
      },
    },
  );
  let logs = "";
  server.stdout.on("data", (d) => {
    logs = (logs + d.toString()).slice(-10000);
  });
  server.stderr.on("data", (d) => {
    logs = (logs + d.toString()).slice(-10000);
  });
  try {
    for (const role of ["ADMIN", "USER", "REPORTER"] as const) {
      const user = await prisma.user.create({
          data: {
            username: prefix + role.toLowerCase(),
            name: "آزمون وب " + role,
            role,
            passwordHash: await bcrypt.hash("web-test-password-only", 4),
          },
        }),
        token = randomBytes(24).toString("hex");
      await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      cookies.set(role, `meal_dashboard_session=${token}`);
    }
    const deadline = Date.now() + 30000;
    while (true) {
      try {
        if ((await fetch(base + "/login")).ok) break;
      } catch {}
      if (Date.now() > deadline) throw new Error("TEST_SERVER_START_TIMEOUT");
      await new Promise((r) => setTimeout(r, 200));
    }
    const request = (url: string, role = "ADMIN") =>
      fetch(base + url, {
        headers: { Cookie: cookies.get(role) ?? "" },
        redirect: "manual",
      });
    const login = await fetch(base + "/login"),
      loginHtml = await login.text(),
      action = loginHtml.match(/name="(\$ACTION_ID_[^"]+)"/);
    assert.ok(action, "progressive-enhancement login action must exist");
    const form = new FormData();
    form.set(action[1], "");
    form.set("username", prefix + "admin");
    form.set("password", "web-test-password-only");
    const loggedIn = await fetch(base + "/login", {
      method: "POST",
      body: form,
      headers: { Origin: base },
      redirect: "manual",
    });
    assert.equal(loggedIn.status, 303);
    assert.ok(
      loggedIn.headers.get("set-cookie")?.includes("meal_dashboard_session="),
    );
    for (const route of [
      "/",
      "/profile",
      "/settings/users",
      "/settings/attendance",
      "/settings/calendar-overrides",
      "/settings/audit-logs",
      "/settings/automations",
      "/settings/automations/reporter",
      "/settings/automations/calendar?year=1406",
      "/reporter/next-day",
    ]) {
      const response = await request(route),
        body = await response.text();
      assert.equal(response.status, 200, `${route} must render`);
      assert.ok(body.length > 500);
      assert.equal(body.includes("data-nextjs-dialog"), false);
    }
    for (const role of ["USER", "REPORTER"]) {
      for (const route of [
        "/reports",
        "/settings/users",
        "/settings/attendance",
        "/settings/automations",
        "/settings/automations/calendar",
      ]) {
        const r = await request(route, role);
        if(![303,307].includes(r.status)){const body=await r.text();console.log(JSON.stringify({redirectCheck:{role,route,status:r.status,meta:body.match(/<meta[^>]*http-equiv="refresh"[^>]*>/)?.[0]}}));assert.ok(r.status===200&&/http-equiv="refresh"[^>]*content="[01];url=\/"/.test(body),`${role} ${route} expected redirect`);}
        if(r.status!==200) assert.equal(r.headers.get("location"), "/");
      }
    }
    const legacy = await request("/settings/weekly-plan");
    await assertRedirect(legacy,"/settings/attendance");
    const anonymous = await request("/reports", "ANONYMOUS");
    await assertRedirect(anonymous,"/login");
    const rows = [];
    for (const days of [1, 7, 31, 90, 180, 365]) {
      const from = "2026-03-21",
        to = new Date(Date.parse(from) + (days - 1) * 86400000)
          .toISOString()
          .slice(0, 10),
        query = `?from=${from}&to=${to}`,
        start = performance.now(),
        r = await request("/reports" + query),
        body = await r.text();
      assert.equal(r.status, 200);
      assert.ok(body.includes(`from=${from}`) && body.includes(`to=${to}`));
      assert.ok(
        body.length < 2000000,
        "paginated annual HTML must stay bounded",
      );
      const exported = await request("/reports/export" + query);
      assert.equal(exported.status, 200);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(
        Buffer.from(await exported.arrayBuffer()) as unknown as Parameters<
          typeof workbook.xlsx.load
        >[0],
      );
      const workdays = await prisma.calendarDay.count({
        where: { dateKey: { gte: from, lte: to }, isWorkday: true },
      });
      assert.equal(
        workbook.getWorksheet("خلاصه روزانه")!.rowCount,
        5 + workdays,
      );
      rows.push({
        days,
        ms: Math.round(performance.now() - start),
        htmlBytes: Buffer.byteLength(body),
        workdays,
      });
    }
    for (const query of [
      "?from=2026-02-30",
      "?from=2026-10-10&to=2026-10-01",
      "?from=2026-01-01&to=2027-01-02",
    ]) {
      assert.equal((await request("/reports/export" + query)).status, 400);
    }
    assert.equal(
      (await request("/reporter/next-day/export", "REPORTER")).status,
      200,
    );
    assert.equal((await request("/profile", "USER")).status, 200);
    await mkdir("verification-output", { recursive: true });
    await writeFile(
      "verification-output/web-regression.json",
      JSON.stringify(
        { checks: "SSR/auth/roles/exports", ranges: rows },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ webRegression: "PASS", ranges: rows }));
    if (process.env.RUN_BROWSER_TESTS === "true")
      await checkBrowser(base, cookies.get("ADMIN")!);
  } finally {
    server.kill("SIGTERM");
    await prisma.user.deleteMany({
      where: { username: { startsWith: prefix } },
    });
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "WEB_REGRESSION_FAILED",
  );
  process.exitCode = 1;
});
