import type { AutomationConfig } from "@/app/generated/prisma/client";
import {
  createTehranDateTimeInstant,
  getTehranDateKey,
} from "@/lib/date/tehran-time";
export function tehranClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return {
    dateKey: getTehranDateKey(now),
    time: `${parts.find((p) => p.type === "hour")!.value}:${parts.find((p) => p.type === "minute")!.value}`,
  };
}
export function nextReportRetry(
  config: Pick<AutomationConfig, "retry1" | "retry2" | "finalRetry">,
  now: Date,
) {
  const clock = tehranClock(now),
    time = [config.retry1, config.retry2, config.finalRetry].find(
      (t) => t > clock.time,
    );
  if (!time) return null;
  const [hour, minute] = time.split(":").map(Number);
  return createTehranDateTimeInstant(clock.dateKey, hour, minute);
}
export function reporterSlots(
  config: Pick<AutomationConfig, "reminder1" | "reminder2" | "deliveryTime">,
  now: Date,
) {
  const { time } = tehranClock(now);
  return {
    reminder1: time >= config.reminder1 && time < config.deliveryTime,
    reminder2: time >= config.reminder2 && time < config.deliveryTime,
    delivery: time >= config.deliveryTime,
  };
}
