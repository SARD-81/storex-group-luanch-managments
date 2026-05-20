const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function getDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateKey(dateKey: string): Date | null {
  if (!DATE_KEY_REGEX.test(dateKey)) {
    return null;
  }

  const [yearText, monthText, dayText] = dateKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function getTodayDateKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
