import { addDays } from "@/lib/attendance/week";
import { getDateKey, getTodayDateKey, parseDateKey } from "@/lib/date/date-key";

const MAX_RANGE_DAYS = 31;

type ReportSearchParams = {
  from?: string;
  to?: string;
};

export function resolveReportDateRange(searchParams?: ReportSearchParams) {
  const todayKey = getTodayDateKey();
  const todayDate = parseDateKey(todayKey) ?? new Date();

  const parsedFrom = searchParams?.from ? parseDateKey(searchParams.from) : null;
  const parsedTo = searchParams?.to ? parseDateKey(searchParams.to) : null;

  const fromDate = parsedFrom ?? todayDate;
  let toDate = parsedTo ?? addDays(todayDate, 7);

  if (toDate < fromDate) {
    toDate = fromDate;
  }

  const maxToDate = addDays(fromDate, MAX_RANGE_DAYS - 1);

  if (toDate > maxToDate) {
    toDate = maxToDate;
  }

  return {
    fromDate,
    toDate,
    fromDateKey: getDateKey(fromDate),
    toDateKey: getDateKey(toDate),
  };
}
