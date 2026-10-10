import { addDays } from "@/lib/attendance/week";
import { getDateKey, parseDateKey } from "@/lib/date/date-key";
import { getTehranDateKey } from "@/lib/date/tehran-time";

export const MAX_REPORT_RANGE_DAYS = 366;

type ReportSearchParams = {
  from?: string | string[];
  to?: string | string[];
};

export function resolveReportDateRange(searchParams?: ReportSearchParams) {
  const todayKey = getTehranDateKey();
  const todayDate = parseDateKey(todayKey) ?? new Date();

  const parsedFrom =
    typeof searchParams?.from === "string" && searchParams.from
      ? parseDateKey(searchParams.from)
      : null;
  const parsedTo =
    typeof searchParams?.to === "string" && searchParams.to
      ? parseDateKey(searchParams.to)
      : null;

  const fromDate = parsedFrom ?? todayDate;
  const toDate = parsedTo ?? addDays(fromDate, 7);
  const error =
    (searchParams?.from !== undefined && !parsedFrom) ||
    (searchParams?.to !== undefined && !parsedTo)
      ? "تاریخ واردشده معتبر نیست."
      : toDate < fromDate
        ? "تاریخ پایان باید برابر یا بعد از تاریخ شروع باشد."
        : (toDate.getTime() - fromDate.getTime()) / 86400000 + 1 >
            MAX_REPORT_RANGE_DAYS
          ? "حداکثر بازه گزارش ۳۶۶ روز است؛ بازه کوتاه‌تری انتخاب کنید."
          : null;

  return {
    fromDate,
    toDate,
    fromDateKey: getDateKey(fromDate),
    toDateKey: getDateKey(toDate),
    error,
  };
}
