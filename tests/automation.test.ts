import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  PrismaClient,
  type AutomationConfig,
} from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AutomationError,
  isPrivateAddress,
  safeFetch,
} from "../lib/automation/http";
import { NextcloudClient, BaleClient } from "../lib/automation/integrations";
import {
  automationConfigSchema,
  getAutomationConfig,
} from "../lib/automation/config";
import {
  ensureJob,
  runJob,
  queueAlert,
  flushAlerts,
  checkPublicCapability,
} from "../lib/automation/jobs";
import {
  probePdf,
  verifiedCapabilityProbe,
  PROBE_CLEANUP_PENDING,
} from "../lib/automation/capability-probe";
import { deliverReport, revokeExpiredShares } from "../lib/automation/reporter";
import {
  nextReportRetry,
  reporterSlots,
  tehranClock,
} from "../lib/automation/schedule";
import { workerTick, withWorkerLock } from "../lib/automation/worker";
import { prisma } from "../lib/prisma";
after(() => prisma.$disconnect());
import { verifyPdf } from "../lib/automation/calendar";
const now = new Date("2026-10-06T06:00:00Z"); // 09:30 Tehran, Tuesday.
const ocs = (data: unknown) =>
  Response.json({ ocs: { meta: { statuscode: 100 }, data } });
function config(): AutomationConfig {
  return {
    id: "test-automation",
    reporterEnabled: true,
    calendarEnabled: false,
    nextcloudBaseUrl: "https://cloud.example.test",
    reportsDirectory: "/Reports",
    calendarDirectory: "/Calendar",
    reportRecipient: "123456",
    technicalConversation: "groupabc",
    reminder1: "09:20",
    reminder2: "09:25",
    deliveryTime: "09:30",
    retry1: "09:40",
    retry2: "09:50",
    finalRetry: "10:00",
    calendarSourceOverride: "",
    publicSharingState: "UNKNOWN",
    capabilityCheckedAt: null,
    health: null,
    updatedAt: now,
  };
}
class CloudFake {
  clock = now;
  enabled = true;
  auth = false;
  group = true;
  failShareResponse = false;
  failRevoke = false;
  failDelete = false;
  files = new Map<string, Buffer>();
  shares = new Map<
    string,
    {
      id: string;
      url: string;
      path: string;
      share_type: number;
      permissions: number;
      stime: number;
    }
  >();
  writes: string[] = [];
  created = 0;
  revoked: string[] = [];
  talkMessages: string[] = [];
  fetch = async (input: string, init: RequestInit = {}) => {
    const u = new URL(input),
      p = u.pathname,
      method = init.method ?? "GET",
      headers = new Headers(init.headers);
    if (p.includes("/s/")) {
      assert.equal(
        headers.has("Authorization"),
        false,
        "public download must be anonymous",
      );
      const s = [...this.shares.values()].find((s) =>
        u.toString().startsWith(s.url),
      );
      return s
        ? new Response(new Uint8Array(this.files.get(s.path)!))
        : new Response(null, { status: 404 });
    }
    if (this.auth) return new Response(null, { status: 401 });
    assert.ok(headers.get("Authorization")?.startsWith("Basic "));
    if (method === "MKCOL") return new Response(null, { status: 405 });
    if (p.includes("/remote.php/dav/files/")) {
      const file = decodeURIComponent(
        p.split("/remote.php/dav/files/service")[1] ?? "/",
      );
      if (method === "PUT") {
        this.files.set(file, Buffer.from(init.body as Uint8Array));
        this.writes.push(file);
      }
      if (method === "DELETE") {
        if (this.failDelete) return new Response(null, { status: 503 });
        this.files.delete(file);
      }
      return new Response(null, { status: 204 });
    }
    if (p.endsWith("/cloud/capabilities"))
      return ocs({
        capabilities: { files_sharing: { public: { enabled: this.enabled } } },
      });
    if (p.includes("/spreed/api/v4/room/"))
      return ocs({ type: this.group ? 2 : 1 });
    if (p.includes("/spreed/api/v1/chat/")) {
      this.talkMessages.push(JSON.parse(String(init.body)).message);
      return ocs({ id: this.talkMessages.length });
    }
    if (p.includes("/files_sharing/api/v1/shares")) {
      if (method === "GET")
        return ocs(
          [...this.shares.values()].filter(
            (s) => s.path === u.searchParams.get("path"),
          ),
        );
      if (method === "POST") {
        const body = init.body as URLSearchParams;
        assert.equal(body.get("permissions"), "1");
        assert.equal(body.get("shareType"), "3");
        assert.equal(body.get("publicUpload"), "false");
        this.created++;
        const id = String(this.created),
          s = {
            id,
            url: `https://cloud.example.test/s/token${id}`,
            path: body.get("path")!,
            share_type: 3,
            permissions: 1,
            stime: this.clock.getTime() / 1000,
          };
        this.shares.set(id, s);
        if (this.failShareResponse) {
          this.failShareResponse = false;
          throw new AutomationError("REMOTE_UNAVAILABLE", null, true);
        }
        return ocs(s);
      }
      if (method === "DELETE") {
        const id = p.split("/").at(-1)!;
        if (this.failRevoke) return new Response(null, { status: 503 });
        this.shares.delete(id);
        this.revoked.push(id);
        return ocs([]);
      }
    }
    throw new Error(`Unhandled mock endpoint ${method} ${p}`);
  };
}
class BaleFake {
  messages: string[] = [];
  failures = 0;
  ambiguous = false;
  fetch = async (input: string, init: RequestInit = {}) => {
    assert.ok(input.startsWith("https://tapi.bale.ai/bot"));
    if (input.endsWith("/getMe"))
      return Response.json({ ok: true, result: { id: 1 } });
    if (input.endsWith("/getChat"))
      return Response.json({
        ok: true,
        result: { id: 123456, type: "private" },
      });
    const p = JSON.parse(String(init.body));
    assert.equal(p.chat_id, "123456");
    if (this.failures-- > 0)
      return Response.json({
        ok: false,
        error_code: 503,
        description: "do-not-log-sensitive-error",
      });
    this.messages.push(p.text);
    if (this.ambiguous)
      throw new AutomationError("REMOTE_UNAVAILABLE", null, true);
    return Response.json({
      ok: true,
      result: { message_id: this.messages.length },
    });
  };
}
async function fixture(
  work: (
    db: PrismaClient,
    c: AutomationConfig,
    cloud: NextcloudClient,
    remote: CloudFake,
    bale: BaleClient,
    bot: BaleFake,
  ) => Promise<void>,
) {
  const url = process.env.TEST_DATABASE_URL!;
  if (process.env.TEST_PGLITE !== "true")
    assert.match(
      new URL(url).pathname,
      /_test$/,
      "destructive tests require an isolated database name ending _test",
    );
  assert.equal(url, process.env.DATABASE_URL);
  assert.match(new URL(url).hostname, /^(localhost|127\.0\.0\.1)$/);
  process.env.NEXTCLOUD_USERNAME = "service";
  process.env.NEXTCLOUD_APP_PASSWORD = "test-only-password";
  process.env.BALE_BOT_TOKEN = "test-only-token";
  const spool = await mkdtemp(path.join(tmpdir(), "automation-test-"));
  process.env.AUTOMATION_SPOOL_DIR = spool;
  const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    }),
    c = config(),
    remote = new CloudFake(),
    bot = new BaleFake(),
    cloud = new NextcloudClient(c, remote.fetch),
    bale = new BaleClient(bot.fetch);
  await db.reportDelivery.deleteMany();
  await db.automationArtifact.deleteMany();
  await db.automationShareLease.deleteMany();
  await db.automationJobRun.deleteMany();
  await db.automationAlert.deleteMany();
  await db.automationConfig.deleteMany();
  await db.automationConfig.create({ data: { ...c, health: undefined } });
  try {
    await work(db, c, cloud, remote, bale, bot);
  } finally {
    await db.reportDelivery.deleteMany();
    await db.automationArtifact.deleteMany();
    await db.automationShareLease.deleteMany();
    await db.automationJobRun.deleteMany();
    await db.automationAlert.deleteMany();
    await db.automationConfig.deleteMany();
    await db.guestMealOrder.deleteMany({ where: { title: "automation-test" } });
    await db.$disconnect();
    await rm(spool, { recursive: true, force: true });
  }
}
const dbTest = { skip: !process.env.TEST_DATABASE_URL };
test(
  "revoked capability probe resumes private-file cleanup without creating another share",
  dbTest,
  () =>
    fixture(async (db, c, cloud, remote) => {
      remote.failDelete = true;
      await assert.rejects(
        () => verifiedCapabilityProbe(db, c, cloud, now),
        /WEBDAV_DELETE_FAILED/,
      );
      const lease = await db.automationShareLease.findFirstOrThrow();
      assert.ok(lease.revokedAt);
      assert.equal(lease.cleanupError, PROBE_CLEANUP_PENDING);
      assert.equal(remote.shares.size, 0);
      assert.ok(remote.files.has(lease.nextcloudPath));
      remote.failDelete = false;
      await revokeExpiredShares(db, cloud, new Date(now.getTime() + 60000));
      assert.equal(remote.files.has(lease.nextcloudPath), false);
      assert.equal(
        (
          await db.automationShareLease.findUniqueOrThrow({
            where: { id: lease.id },
          })
        ).cleanupError,
        null,
      );
      await verifiedCapabilityProbe(db, c, cloud, now);
      assert.equal(remote.created, 1);
      assert.equal(remote.files.size, 0);
    }),
);
test(
  "a lost receipt database write preserves send intent and prevents duplicate Bale delivery",
  dbTest,
  () =>
    fixture(async (db, c, cloud, remote, bale, bot) => {
      const failReceipt = db.$extends({
        query: {
          reportDelivery: {
            update({ args, query }) {
              if (args.data.stage === "DELIVERED")
                throw new Error("simulated receipt storage failure");
              return query(args);
            },
          },
        },
      }) as unknown as PrismaClient;
      await assert.rejects(
        () =>
          deliverReport(
            failReceipt,
            c,
            "2026-10-10",
            async () => {},
            now,
            cloud,
            bale,
            async () => probePdf(),
          ),
        /simulated receipt storage failure/,
      );
      assert.equal(bot.messages.length, 1);
      assert.equal(
        (
          await db.reportDelivery.findUniqueOrThrow({
            where: { reportDateKey: "2026-10-10" },
          })
        ).stage,
        "DELIVERING",
      );
      await assert.rejects(
        () =>
          deliverReport(
            db,
            c,
            "2026-10-10",
            async () => {},
            now,
            cloud,
            bale,
            async () => probePdf(),
          ),
        /AMBIGUOUS_DELIVERY/,
      );
      assert.equal(bot.messages.length, 1);
    }),
);
test(
  "a lost Talk receipt write is held on the next dispatcher instead of resent",
  dbTest,
  () =>
    fixture(async (db, c, cloud, remote) => {
      await queueAlert(
        db,
        "TEST",
        "fixture",
        "lost-talk-receipt",
        "technical fixture",
      );
      const failReceipt = db.$extends({
        query: {
          automationAlert: {
            update({ args, query }) {
              if (args.data.status === "SUCCESS")
                throw new Error("simulated Talk receipt storage failure");
              return query(args);
            },
          },
        },
      }) as unknown as PrismaClient;
      await assert.rejects(
        () => flushAlerts(failReceipt, cloud),
        /simulated Talk receipt storage failure/,
      );
      await flushAlerts(db, cloud);
      assert.equal(remote.talkMessages.length, 1);
      assert.equal(
        (
          await db.automationAlert.findUniqueOrThrow({
            where: { alertKey: "lost-talk-receipt" },
          })
        ).status,
        "MANUAL_ACTION_REQUIRED",
      );
    }),
);
test("Tehran slots and retry instants are explicit, including UTC date rollover", () => {
  assert.deepEqual(tehranClock(new Date("2026-10-05T20:31:00Z")), {
    dateKey: "2026-10-06",
    time: "00:01",
  });
  const c = config();
  assert.deepEqual(reporterSlots(c, new Date("2026-10-06T05:50:00Z")), {
    reminder1: true,
    reminder2: false,
    delivery: false,
  });
  assert.equal(
    reporterSlots(c, new Date("2026-10-06T05:55:00Z")).reminder2,
    true,
  );
  assert.equal(reporterSlots(c, now).delivery, true);
  for (const [time, expected] of [
    ["06:00", "06:10"],
    ["06:10", "06:20"],
    ["06:20", "06:30"],
  ])
    assert.equal(
      nextReportRetry(c, new Date(`2026-10-06T${time}:00Z`))?.toISOString(),
      `2026-10-06T${expected}:00.000Z`,
    );
  assert.equal(nextReportRetry(c, new Date("2026-10-06T06:30:00Z")), null);
});
test("configuration, network and PDF guards fail closed", async () => {
  const c = config();
  process.env.AUTOMATION_ALLOWED_NEXTCLOUD_HOSTS = "cloud.example.test";
  assert.ok(automationConfigSchema.safeParse(c).success);
  for (const bad of [
    { retry1: "09:20" },
    { nextcloudBaseUrl: "http://cloud.example.test" },
    { nextcloudBaseUrl: "https://user:password@cloud.example.test" },
    { nextcloudBaseUrl: "https://cloud.example.test/?token=private" },
    { reportsDirectory: "/Reports/../secret" },
    { reportRecipient: "-123" },
  ])
    assert.equal(
      automationConfigSchema.safeParse({ ...c, ...bad }).success,
      false,
    );
  for (const a of [
    "127.0.0.1",
    "169.254.169.254",
    "10.1.1.1",
    "172.16.0.1",
    "192.168.1.1",
    "::1",
    "fd12::1",
    "fe90::1",
    "::ffff:127.0.0.1",
  ])
    assert.ok(isPrivateAddress(a));
  assert.equal(isPrivateAddress("8.8.8.8"), false);
  await assert.rejects(
    () => safeFetch("http://cloud.example.test", {}, ["cloud.example.test"]),
    /UNTRUSTED_URL/,
  );
  await assert.rejects(
    () => safeFetch("https://127.0.0.1", {}, ["127.0.0.1"]),
    /PRIVATE_ADDRESS_BLOCKED/,
  );
  assert.throws(
    () => verifyPdf(Buffer.from("<html>challenge</html>")),
    /INVALID_OFFICIAL_PDF/,
  );
  assert.throws(() => verifyPdf(Buffer.from("%PDF-")), /INVALID_OFFICIAL_PDF/);
});
test(
  "report resumes existing PDF/upload/share after safe Bale failure, then exact expiry revokes only share",
  dbTest,
  () =>
    fixture(async (db, c, cloud, remote, bale, bot) => {
      let generated = 0;
      bot.failures = 1;
      const pdf = async () => {
        generated++;
        return probePdf();
      };
      await assert.rejects(
        () =>
          deliverReport(
            db,
            c,
            "2026-10-10",
            async () => {},
            now,
            cloud,
            bale,
            pdf,
          ),
        /BALE_REJECTED/,
      );
      const first = await db.reportDelivery.findUniqueOrThrow({
        where: { reportDateKey: "2026-10-10" },
      });
      assert.equal(first.stage, "PUBLIC_READY");
      assert.equal(
        first.expiresAt!.getTime() - first.shareCreatedAt!.getTime(),
        86400000,
      );
      const writes = remote.writes.filter(
          (p) => !p.includes(".capability"),
        ).length,
        shares = remote.created;
      await deliverReport(
        db,
        c,
        "2026-10-10",
        async () => {},
        new Date(now.getTime() + 600000),
        cloud,
        bale,
        pdf,
      );
      await deliverReport(
        db,
        c,
        "2026-10-10",
        async () => {},
        now,
        cloud,
        bale,
        pdf,
      );
      assert.equal(generated, 1);
      assert.equal(
        remote.writes.filter((p) => !p.includes(".capability")).length,
        writes,
      );
      assert.equal(remote.created, shares);
      assert.equal(bot.messages.length, 1);
      await revokeExpiredShares(
        db,
        cloud,
        new Date(first.expiresAt!.getTime() - 1),
      );
      assert.ok(remote.shares.has(first.shareId!));
      remote.failRevoke = true;
      await assert.rejects(
        () => revokeExpiredShares(db, cloud, first.expiresAt!),
        /NEXTCLOUD_HTTP_ERROR/,
      );
      assert.equal(
        (await db.reportDelivery.findUniqueOrThrow({ where: { id: first.id } }))
          .revokedAt,
        null,
      );
      remote.failRevoke = false;
      await revokeExpiredShares(db, cloud, first.expiresAt!);
      await revokeExpiredShares(db, cloud, first.expiresAt!);
      assert.equal(
        remote.revoked.filter((id) => id === first.shareId).length,
        1,
      );
      assert.ok(
        [...remote.files.keys()].some((p) => p.includes("next-workday")),
      );
    }),
);
test(
  "ambiguous Bale send is held for manual resolution and is never resent automatically",
  dbTest,
  () =>
    fixture(async (db, c, cloud, remote, bale, bot) => {
      bot.ambiguous = true;
      await assert.rejects(
        () =>
          deliverReport(
            db,
            c,
            "2026-10-10",
            async () => {},
            now,
            cloud,
            bale,
            async () => probePdf(),
          ),
        /REMOTE_UNAVAILABLE/,
      );
      assert.equal(
        (
          await db.reportDelivery.findUniqueOrThrow({
            where: { reportDateKey: "2026-10-10" },
          })
        ).status,
        "MANUAL_ACTION_REQUIRED",
      );
      bot.ambiguous = false;
      await assert.rejects(
        () =>
          deliverReport(
            db,
            c,
            "2026-10-10",
            async () => {},
            now,
            cloud,
            bale,
            async () => probePdf(),
          ),
        /AMBIGUOUS_DELIVERY/,
      );
      assert.equal(bot.messages.length, 1);
    }),
);
test(
  "lost share-create response is adopted on retry without another public share",
  dbTest,
  () =>
    fixture(async (db, c, cloud, remote) => {
      await cloud.upload("/Reports/example.pdf", probePdf(), "application/pdf");
      remote.failShareResponse = true;
      await assert.rejects(
        () => cloud.getOrCreateShare("/Reports/example.pdf", now),
        (e) =>
          e instanceof AutomationError &&
          e.code === "SHARE_CREATE_UNCERTAIN" &&
          !e.uncertain,
      );
      const share = await cloud.getOrCreateShare("/Reports/example.pdf", now);
      assert.equal(remote.created, 1);
      await cloud.verifyPublic(
        share.url,
        createHash("sha256").update(probePdf()).digest("hex"),
      );
    }),
);
test(
  "public disabled/auth failures remain distinct; disabled mode does not generate a report",
  dbTest,
  () =>
    fixture(async (db, c, cloud, remote, bale) => {
      remote.enabled = false;
      assert.equal(await checkPublicCapability(db, c, cloud, now), "DISABLED");
      let generated = false;
      await assert.rejects(
        () =>
          deliverReport(
            db,
            c,
            "2026-10-10",
            async () => {},
            now,
            cloud,
            bale,
            async () => {
              generated = true;
              return probePdf();
            },
          ),
        /PUBLIC_SHARING_DISABLED/,
      );
      assert.equal(generated, false);
      remote.auth = true;
      assert.equal(
        await checkPublicCapability(db, c, cloud, now),
        "NEXTCLOUD_AUTH_FAILED",
      );
    }),
);
test(
  "job identities survive retries; raw remote errors are not persisted; alerts are deduplicated and group-only",
  dbTest,
  () =>
    fixture(async (db, c, cloud, remote) => {
      const job = await ensureJob(db, "TEST", "test-identity", "1405");
      assert.equal(
        (await ensureJob(db, "TEST", "test-identity", "1405")).id,
        job.id,
      );
      await runJob(
        db,
        job,
        async (stage) => {
          await stage("UPLOAD");
          throw new Error("password secret private-url");
        },
        now,
        new Date(now.getTime() + 60000),
      );
      const failed = await db.automationJobRun.findUniqueOrThrow({
        where: { id: job.id },
      });
      assert.equal(failed.errorCode, "INTERNAL_STAGE_FAILURE");
      assert.equal(failed.errorMessage?.includes("secret"), false);
      assert.equal(await runJob(db, failed, async () => {}, now), false);
      await runJob(db, failed, async () => {}, new Date(now.getTime() + 60000));
      assert.equal(
        (await db.automationJobRun.findUniqueOrThrow({ where: { id: job.id } }))
          .attempt,
        2,
      );
      await queueAlert(db, "TEST", "1405", "unique-alert", "test");
      await queueAlert(db, "TEST", "1405", "unique-alert", "duplicate");
      await flushAlerts(db, cloud);
      await flushAlerts(db, cloud);
      assert.equal(remote.talkMessages.length, 1);
      remote.group = false;
      await assert.rejects(
        () => cloud.talk("test", "key"),
        /TALK_ROOM_NOT_GROUP/,
      );
    }),
);
test(
  "worker uses latest guest values at each slot, sends once, and weekend ticks do not duplicate the future report",
  dbTest,
  () =>
    fixture(async (db, c, cloud, remote, bale, bot) => {
      await db.automationConfig.create({
        data: { ...c, id: "singleton", health: undefined },
      });
      let generated = 0;
      const deps = {
        cloud,
        bale,
        pdf: async (
          report: import("../lib/reporter/next-day-report").NextDayMealReport,
        ) => {
          generated++;
          assert.equal(report.guestCounts.breakfast, 3);
          return probePdf();
        },
      };
      // Tuesday's next workday is Wednesday; use persisted policy rather than hardcoded weekday logic.
      const future = await db.calendarDay.findFirstOrThrow({
        where: { dateKey: { gt: "2026-10-06" }, isWorkday: true },
        orderBy: { date: "asc" },
      });
      await db.guestMealOrder.create({
        data: {
          date: future.date,
          mealType: "BREAKFAST",
          title: "automation-test",
          count: 1,
        },
      });
      remote.clock = new Date("2026-10-06T05:50:00Z");
      await workerTick(db, remote.clock, deps);
      assert.ok(bot.messages[0].includes("صبحانه: 1"));
      await db.guestMealOrder.updateMany({
        where: { title: "automation-test" },
        data: { count: 2 },
      });
      remote.clock = new Date("2026-10-06T05:55:00Z");
      await workerTick(db, remote.clock, deps);
      assert.ok(bot.messages[1].includes("صبحانه: 2"));
      await db.guestMealOrder.updateMany({
        where: { title: "automation-test" },
        data: { count: 3 },
      });
      remote.clock = now;
      await workerTick(db, now, deps);
      await workerTick(db, new Date("2026-10-06T06:01:00Z"), deps);
      assert.equal(generated, 1);
      assert.equal(bot.messages.length, 3);
      assert.equal(
        (
          await db.reportDelivery.findUniqueOrThrow({
            where: { reportDateKey: future.dateKey },
          })
        ).status,
        "SUCCESS",
      );
      // Friday is nonworkday in the imported fixture. A tick must not schedule a new report.
      await workerTick(db, new Date("2026-10-09T06:00:00Z"), deps);
      assert.equal(bot.messages.length, 3);
    }),
);

test(
  "separate PostgreSQL connections enforce a single worker",
  {
    skip: !process.env.TEST_DATABASE_URL || process.env.TEST_PGLITE === "true",
  },
  async () => {
    assert.equal(
      (
        (await withWorkerLock(() =>
          withWorkerLock(async () => "unexpected"),
        )) as { skipped: boolean }
      ).skipped,
      true,
    );
  },
);
