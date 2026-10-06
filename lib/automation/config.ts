import { z } from "zod";
import type { PrismaClient } from "@/app/generated/prisma/client";
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const directory = z
  .string()
  .min(1)
  .max(200)
  .refine(
    (s) =>
      s.startsWith("/") &&
      !s.split("/").some((p) => p === "." || p === "..") &&
      !/[\\\x00-\x1f?#]/.test(s),
  );
export const automationConfigSchema = z
  .object({
    reporterEnabled: z.boolean(),
    calendarEnabled: z.boolean(),
    nextcloudBaseUrl: z.string().max(500),
    reportsDirectory: directory,
    calendarDirectory: directory,
    reportRecipient: z.string().regex(/^\d*$/).max(30),
    technicalConversation: z
      .string()
      .regex(/^[a-zA-Z0-9]*$/)
      .max(100),
    calendarSourceOverride: z.string().max(1000),
    reminder1: time,
    reminder2: time,
    deliveryTime: time,
    retry1: time,
    retry2: time,
    finalRetry: time,
  })
  .superRefine((v, ctx) => {
    const times = [
      v.reminder1,
      v.reminder2,
      v.deliveryTime,
      v.retry1,
      v.retry2,
      v.finalRetry,
    ];
    if (times.some((t, i) => i > 0 && t <= times[i - 1]))
      ctx.addIssue({
        code: "custom",
        message: "زمان‌ها باید به‌ترتیب افزایشی باشند.",
      });
    for (const [key, value, hosts] of [
      [
        "nextcloudBaseUrl",
        v.nextcloudBaseUrl,
        process.env.AUTOMATION_ALLOWED_NEXTCLOUD_HOSTS,
      ],
      [
        "calendarSourceOverride",
        v.calendarSourceOverride,
        "calendar.ut.ac.ir," +
          (process.env.CALENDAR_APPROVED_SOURCE_HOSTS ?? ""),
      ],
    ] as const) {
      if (!value) continue;
      try {
        const url = new URL(value);
        if (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          url.hash ||
          (key === "nextcloudBaseUrl" && url.search) ||
          !hosts
            ?.split(",")
            .map((s) => s.trim())
            .includes(url.hostname) ||
          (url.port && url.port !== "443")
        )
          throw new Error();
      } catch {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message:
            "نشانی HTTPS باید در فهرست میزبان‌های مجاز تنظیم‌شده توسط مسئول سرور باشد.",
        });
      }
    }
  });
export function getAutomationConfig(db: PrismaClient) {
  return db.automationConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}
export function credentialStatus() {
  return {
    nextcloud: !!(
      process.env.NEXTCLOUD_USERNAME && process.env.NEXTCLOUD_APP_PASSWORD
    ),
    bale: !!process.env.BALE_BOT_TOKEN,
  };
}
