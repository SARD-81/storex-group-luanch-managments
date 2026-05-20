export const TEHRAN_TIME_ZONE = "Asia/Tehran";
export const TEHRAN_UTC_OFFSET_MINUTES = 210;

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


export function formatPersianTime(date: Date) {
  return new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TEHRAN_TIME_ZONE,
  }).format(date);
}

export function getTehranDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-gregory", {
    timeZone: TEHRAN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

export function createTehranDateTimeInstant(
  dateKey: string,
  hour: number,
  minute = 0,
) {
  const [year, month, day] = dateKey.split("-").map(Number);

  return new Date(
    Date.UTC(year, month - 1, day, hour, minute) -
      TEHRAN_UTC_OFFSET_MINUTES * 60 * 1000,
  );
}