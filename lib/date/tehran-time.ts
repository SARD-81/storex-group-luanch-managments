export const TEHRAN_TIME_ZONE = "Asia/Tehran";

export function getServerNow() {
  return new Date();
}

export function formatPersianDateTime(date: Date) {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "full",
    timeStyle: "medium",
    timeZone: TEHRAN_TIME_ZONE,
  }).format(date);
}