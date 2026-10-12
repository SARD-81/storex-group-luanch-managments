import { test, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { BaleClient } from "../lib/automation/integrations";
import { processBaleDeletions } from "../lib/automation/bale-deletion";
import {
  resolveAmbiguousReport,
  resolveAmbiguousAlert,
} from "../lib/automation/delivery-review";
import { AutomationError } from "../lib/automation/http";
import { workerTick, workerCleanupTick } from "../lib/automation/worker";
import { deliverReport, revokeExpiredShares } from "../lib/automation/reporter";
import { NextcloudClient } from "../lib/automation/integrations";
import {
  flushAlerts,
  queueAlert,
  ensureJob,
  runJob,
} from "../lib/automation/jobs";
import { prisma } from "../lib/prisma";
after(() => prisma.$disconnect());
const sentAt = new Date("2026-10-06T06:00:00Z"),
  due = new Date(sentAt.getTime() + 86400000),
  deadline = new Date(sentAt.getTime() + 172800000);
const dbTest = { skip: !process.env.TEST_DATABASE_URL };
async function fixture(
  work: (
    db: PrismaClient,
    bale: BaleClient,
    calls: { chat_id: string; message_id: number }[],
  ) => Promise<void>,
  answer: () => Response | Promise<Response> = () =>
    Response.json({ ok: true, result: true }),
) {
  const url = process.env.TEST_DATABASE_URL!;
  assert.equal(url, process.env.DATABASE_URL);
  assert.match(new URL(url).hostname, /^(127\.0\.0\.1|localhost)$/);
  assert.match(new URL(url).pathname, /_test$/);
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  process.env.BALE_BOT_TOKEN = "test-only-token";
  delete process.env.NEXTCLOUD_USERNAME;
  delete process.env.NEXTCLOUD_APP_PASSWORD;
  const calls: { chat_id: string; message_id: number }[] = [];
  const bale = new BaleClient(
    async (url, init) => {
      if (url.endsWith("/getMe"))
        return Response.json({
          ok: true,
          result: { is_bot: true, username: "storex_lunch_notify_bot" },
        });
      assert.ok(
        url.endsWith("/deleteMessage"),
        "cleanup must never send a new message",
      );
      calls.push(JSON.parse(String(init?.body)));
      return answer();
    },
    () => due,
  );
  const clear = async () => {
    await db.reportDelivery.deleteMany();
    await db.automationJobRun.deleteMany();
    await db.automationAlert.deleteMany();
    await db.automationConfig.deleteMany();
  };
  await clear();
  await db.automationConfig.create({
    data: {
      id: "singleton",
      reporterEnabled: false,
      talkEnabled: false,
      reportRecipient: "654321",
    },
  });
  try {
    await work(db, bale, calls);
  } finally {
    await clear();
    await db.$disconnect();
  }
}
function seed(db: PrismaClient, overrides: object = {}) {
  return db.reportDelivery.create({
    data: {
      reportDateKey: "2026-10-10",
      deliveryKind: "BALE_DOCUMENT",
      status: "SUCCESS",
      stage: "DELIVERED",
      baleChatId: "123456",
      baleMessageId: "42",
      sentAt,
      sendAttemptedAt: sentAt,
      deleteDueAt: due,
      deleteBeforeAt: deadline,
      deletionStatus: "SCHEDULED",
      ...overrides,
    },
  });
}
test(
  "cleanup does nothing before exactly 24 hours; exact due uses the stored destination rather than edited config",
  dbTest,
  () =>
    fixture(async (db, bale, calls) => {
      const d = await seed(db);
      await processBaleDeletions(db, new Date(due.getTime() - 1), bale);
      assert.equal(calls.length, 0);
      await processBaleDeletions(db, due, bale);
      await processBaleDeletions(db, due, bale);
      assert.deepEqual(calls, [{ chat_id: "123456", message_id: 42 }]);
      const final = await db.reportDelivery.findUniqueOrThrow({
        where: { id: d.id },
      });
      assert.equal(final.deletionStatus, "DELETED");
      assert.equal(final.deletedAt!.toISOString(), due.toISOString());
      assert.equal(final.status, "SUCCESS");
      assert.deepEqual(final.deletionReceipt, {
        method: "deleteMessage",
        ok: true,
        result: true,
        confirmedAt: due.toISOString(),
      });
      const c = await db.automationConfig.findUniqueOrThrow({
        where: { id: "singleton" },
      });
      await deliverReport(
        db,
        c,
        d.reportDateKey,
        async () => {},
        due,
        undefined,
        bale,
        async () => {
          throw Error("deleted report must not regenerate");
        },
      );
      assert.equal(calls.length, 1);
      assert.equal(
        (
          await db.automationJobRun.findFirstOrThrow({
            where: { jobType: "BALE_MESSAGE_DELETE" },
          })
        ).status,
        "SUCCESS",
      );
    }),
);
test(
  "normal worker never deletes legacy queued Bale messages after retention policy cancellation",
  dbTest,
  () =>
    fixture(async (db, bale, calls) => {
      const d = await seed(db, {
        sentAt: new Date("2026-10-08T06:00:00Z"),
        deleteDueAt: new Date("2026-10-09T06:00:00Z"),
        deleteBeforeAt: new Date("2026-10-10T06:00:00Z"),
      });
      await workerTick(db, new Date("2026-10-09T06:01:00Z"), { bale });
      assert.equal(calls.length, 0);
      const final = await db.reportDelivery.findUniqueOrThrow({ where: { id: d.id } });
      assert.equal(final.deletionStatus, "SCHEDULED");
      assert.equal(final.deletedAt, null);
    }),
);
test(
  "temporary delete failure resumes after retry/restart without creating a new message",
  dbTest,
  () => {
    let attempts = 0;
    return fixture(
      async (db, bale, calls) => {
        const d = await seed(db);
        await processBaleDeletions(db, due, bale);
        let final = await db.reportDelivery.findUniqueOrThrow({
          where: { id: d.id },
        });
        assert.equal(final.deletionStatus, "RETRYING");
        assert.equal(final.deletedAt, null);
        await processBaleDeletions(db, new Date(due.getTime() + 59999), bale);
        assert.equal(calls.length, 1);
        await processBaleDeletions(db, new Date(due.getTime() + 60000), bale);
        final = await db.reportDelivery.findUniqueOrThrow({
          where: { id: d.id },
        });
        assert.equal(final.deletionStatus, "DELETED");
        assert.equal(final.deletionAttempts, 2);
        assert.equal(calls.length, 2);
      },
      () =>
        Response.json(
          ++attempts === 1
            ? { ok: false, error_code: 503 }
            : { ok: true, result: true },
        ),
    );
  },
);
for (const [name, answer, status, code] of [
  [
    "not found",
    () =>
      Response.json({
        ok: false,
        error_code: 400,
        description: "message to delete not found",
      }),
    "MANUAL_ACTION_REQUIRED",
    "BALE_MESSAGE_NOT_FOUND",
  ],
  [
    "forbidden",
    () => Response.json({ ok: false, error_code: 403 }),
    "MANUAL_ACTION_REQUIRED",
    "BALE_FORBIDDEN",
  ],
  [
    "timeout",
    () => {
      throw new AutomationError("REMOTE_UNAVAILABLE", null, true);
    },
    "UNCERTAIN",
    "REMOTE_UNAVAILABLE",
  ],
  [
    "unconfirmed result",
    () => Response.json({ ok: true, result: false }),
    "UNCERTAIN",
    "BALE_DELETE_UNCONFIRMED",
  ],
  [
    "rate limit",
    () =>
      Response.json({
        ok: false,
        error_code: 429,
        parameters: { retry_after: 1200 },
      }),
    "RETRYING",
    "BALE_RATE_LIMITED",
  ],
] as const)
  test(`delete ${name} cannot produce a false confirmed status`, dbTest, () =>
    fixture(async (db, bale) => {
      const d = await seed(db);
      await processBaleDeletions(db, due, bale);
      const final = await db.reportDelivery.findUniqueOrThrow({
        where: { id: d.id },
      });
      assert.equal(final.deletionStatus, status);
      assert.equal(final.deletionErrorCode, code);
      assert.equal(final.deletedAt, null);
      assert.equal(final.deletionReceipt, null);
      if (name === "rate limit")
        assert.equal(
          final.deletionNextRetryAt!.getTime() - due.getTime(),
          1200000,
        );
    }, answer),
  );
test(
  "lost successful deletion DB receipt remains uncertain and retries only the same message",
  dbTest,
  () =>
    fixture(async (db, bale, calls) => {
      const d = await seed(db);
      const fail = db.$extends({
        query: {
          reportDelivery: {
            update({ args, query }) {
              if (args.data.deletionStatus === "DELETED")
                throw new Error("database receipt lost");
              return query(args);
            },
          },
        },
      }) as unknown as PrismaClient;
      await processBaleDeletions(fail, due, bale);
      assert.equal(
        (await db.reportDelivery.findUniqueOrThrow({ where: { id: d.id } }))
          .deletionStatus,
        "UNCERTAIN",
      );
      await processBaleDeletions(db, new Date(due.getTime() + 60000), bale);
      assert.equal(calls.length, 2);
      assert.deepEqual(calls[0], calls[1]);
    }),
);
test(
  "six-hour escalation survives disabled Talk; at exactly 48 hours API is not attempted",
  dbTest,
  () =>
    fixture(async (db, bale, calls) => {
      const d = await seed(db, { deletionStatus: "MANUAL_ACTION_REQUIRED" });
      await processBaleDeletions(
        db,
        new Date(deadline.getTime() - 6 * 3600000),
        bale,
      );
      assert.equal(calls.length, 0);
      assert.ok(
        (await db.automationAlert.findMany()).some((a) =>
          a.alertKey.startsWith("bale-delete-critical:"),
        ),
      );
      await processBaleDeletions(db, deadline, bale);
      assert.equal(calls.length, 0);
      assert.equal(
        (await db.reportDelivery.findUniqueOrThrow({ where: { id: d.id } }))
          .deletionStatus,
        "WINDOW_EXPIRED",
      );
      assert.equal(
        (
          await db.automationJobRun.findFirstOrThrow({
            where: { jobType: "BALE_MESSAGE_DELETE" },
          })
        ).status,
        "FAILED",
      );
    }),
);
test(
  "ambiguous document resolution requires actual receipt/time and schedules cleanup without permitting another delivery",
  dbTest,
  () =>
    fixture(async (db) => {
      const d = await seed(db, {
        status: "MANUAL_ACTION_REQUIRED",
        stage: "DELIVERING",
        baleMessageId: null,
        sentAt: null,
        deleteDueAt: null,
        deleteBeforeAt: null,
        deletionStatus: "NOT_APPLICABLE",
      });
      await assert.rejects(
        () =>
          db.$transaction((tx) =>
            resolveAmbiguousReport(
              tx,
              d.id,
              { resolution: "DELIVERED", receipt: "42", sentAt: "" },
              due,
            ),
          ),
        /INVALID_RESOLUTION/,
      );
      await db.$transaction((tx) =>
        resolveAmbiguousReport(
          tx,
          d.id,
          {
            resolution: "DELIVERED",
            receipt: "42",
            sentAt: sentAt.toISOString(),
          },
          due,
        ),
      );
      const final = await db.reportDelivery.findUniqueOrThrow({
        where: { id: d.id },
      });
      assert.equal(final.status, "SUCCESS");
      assert.equal(final.deletionStatus, "SCHEDULED");
      assert.equal(final.deleteDueAt!.toISOString(), due.toISOString());
    }),
);
test(
  "historical Nextcloud report share cleanup stays independent of Bale deletion",
  dbTest,
  () =>
    fixture(async (db, bale, calls) => {
      process.env.NEXTCLOUD_USERNAME = "service";
      process.env.NEXTCLOUD_APP_PASSWORD = "test-only";
      const c = await db.automationConfig.findUniqueOrThrow({
        where: { id: "singleton" },
      });
      const d = await db.reportDelivery.create({
        data: {
          reportDateKey: "2026-10-05",
          status: "SUCCESS",
          shareId: "legacy42",
          publicUrl: "https://cloud.example.test/s/old",
          expiresAt: due,
        },
      });
      let revoked = 0;
      const cloud = new NextcloudClient(
        { ...c, nextcloudBaseUrl: "https://cloud.example.test" },
        async (url) => {
          assert.ok(url.includes("/shares/legacy42"));
          revoked++;
          return Response.json({
            ocs: { meta: { statuscode: 100 }, data: [] },
          });
        },
      );
      await processBaleDeletions(db, due, bale);
      await revokeExpiredShares(db, cloud, due);
      assert.equal(calls.length, 0);
      assert.equal(revoked, 1);
      const final = await db.reportDelivery.findUniqueOrThrow({
        where: { id: d.id },
      });
      assert.equal(final.deliveryKind, "LEGACY_NEXTCLOUD");
      assert.ok(final.revokedAt);
      assert.equal(final.deletionStatus, "NOT_APPLICABLE");
    }),
);
test(
  "Talk disabled preserves alerts internally; activation suppresses stale backlog and bounds dispatch",
  dbTest,
  () =>
    fixture(async (db) => {
      process.env.NEXTCLOUD_USERNAME = "service";
      process.env.NEXTCLOUD_APP_PASSWORD = "test-only";
      const c = await db.automationConfig.findUniqueOrThrow({
        where: { id: "singleton" },
      });
      let posted = 0;
      const fetch = async (url: string) =>
        url.includes("/room/")
          ? Response.json({
              ocs: {
                meta: { statuscode: 100 },
                data: {
                  type: 2,
                  participantType: 3,
                  readOnly: 0,
                  permissions: 128,
                },
              },
            })
          : (posted++,
            Response.json({
              ocs: { meta: { statuscode: 100 }, data: { id: posted } },
            }));
      const old = new Date(Date.now() - 600000),
        fresh = new Date();
      for (let i = 0; i < 7; i++)
        await db.automationAlert.create({
          data: {
            jobType: "TEST",
            target: "fixture",
            alertKey: `test:${i}`,
            message: "technical fixture",
            createdAt: i === 0 ? old : fresh,
          },
        });
      await flushAlerts(
        db,
        new NextcloudClient(
          {
            ...c,
            nextcloudBaseUrl: "https://cloud.example.test",
            technicalConversation: "groupabc",
          },
          fetch,
        ),
        fresh,
      );
      assert.equal(posted, 0);
      const enabled = {
        ...c,
        talkEnabled: true,
        talkActivatedAt: new Date(fresh.getTime() - 1000),
        nextcloudBaseUrl: "https://cloud.example.test",
        technicalConversation: "groupabc",
      };
      await flushAlerts(db, new NextcloudClient(enabled, fetch), fresh);
      assert.equal(posted, 3);
      assert.equal(
        (
          await db.automationAlert.findUniqueOrThrow({
            where: { alertKey: "test:0" },
          })
        ).status,
        "SKIPPED",
      );
      assert.equal(
        await db.automationAlert.count({ where: { status: "SUCCESS" } }),
        3,
      );
    }),
);

test(
  "cleanup-only rollback mode deletes pending messages without executing queued delivery",
  dbTest,
  () =>
    fixture(async (db, bale, calls) => {
      await seed(db);
      const j = await ensureJob(
        db,
        "REPORT_DELIVERY",
        "queued-report",
        "2026-10-10",
        { requestedBy: "CLI" },
      );
      await workerCleanupTick(db, due, { bale });
      assert.equal(calls.length, 1);
      assert.equal(
        (await db.automationJobRun.findUniqueOrThrow({ where: { id: j.id } }))
          .status,
        "PENDING",
      );
    }),
);
test("server rate limit cannot be retried before its retry_after", dbTest, () =>
  fixture(async (db) => {
    const j = await ensureJob(db, "REPORT_DELIVERY", "rate-test", "2026-10-10");
    await runJob(
      db,
      j,
      async () => {
        throw new AutomationError("BALE_RATE_LIMITED", 429, false, 1200);
      },
      sentAt,
      new Date(sentAt.getTime() + 600000),
    );
    const final = await db.automationJobRun.findUniqueOrThrow({
      where: { id: j.id },
    });
    assert.equal(final.nextRetryAt!.getTime() - sentAt.getTime(), 1200000);
  }),
);
test(
  "recovery-alert DB failure cannot turn a confirmed deletion back into uncertainty",
  dbTest,
  () =>
    fixture(async (db, bale) => {
      const d = await seed(db, { deletionAttempts: 1 });
      const fail = db.$extends({
        query: {
          automationAlert: {
            upsert() {
              throw new Error("alert storage failure");
            },
          },
        },
      }) as unknown as PrismaClient;
      await assert.rejects(
        () => processBaleDeletions(fail, due, bale),
        /alert storage failure/,
      );
      assert.equal(
        (await db.reportDelivery.findUniqueOrThrow({ where: { id: d.id } }))
          .deletionStatus,
        "DELETED",
      );
    }),
);

test(
  "held Talk receipt requires reviewed resolution and does not silently resend",
  dbTest,
  () =>
    fixture(async (db) => {
      const a = await db.automationAlert.create({
        data: {
          alertKey: "manual-talk",
          jobType: "TEST",
          target: "fixture",
          message: "synthetic",
          status: "MANUAL_ACTION_REQUIRED",
        },
      });
      await assert.rejects(
        () =>
          db.$transaction((tx) =>
            resolveAmbiguousAlert(tx, a.id, {
              resolution: "DELIVERED",
              receipt: "",
            }),
          ),
        /INVALID_RESOLUTION/,
      );
      await db.$transaction((tx) =>
        resolveAmbiguousAlert(tx, a.id, {
          resolution: "DELIVERED",
          receipt: "42",
        }),
      );
      assert.equal(
        (await db.automationAlert.findUniqueOrThrow({ where: { id: a.id } }))
          .status,
        "SUCCESS",
      );
    }),
);
