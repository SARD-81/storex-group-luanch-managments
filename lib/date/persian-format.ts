import { TEHRAN_TIME_ZONE } from "@/lib/date/tehran-time";

export function formatPersianDate(date: Date) {
  return new Intl.DateTimeFormat("fa-IR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TEHRAN_TIME_ZONE,
  }).format(date);
}

export function formatPersianWeekdayDate(date: Date) {
  return new Intl.DateTimeFormat("fa-IR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TEHRAN_TIME_ZONE,
  }).format(date);
}
