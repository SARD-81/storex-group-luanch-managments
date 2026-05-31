import { AttendanceStatus } from "@/app/generated/prisma/client";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { formatPersianDateTime } from "@/lib/date/tehran-time";

type MonthDayCardProps = {
  day: {
    dateKey: string;
    dayNameFa: string;
    persianDateLabel: string;
    canEdit: boolean;
    isSelectable: boolean;
    deadline: Date;
    isToday: boolean;
    breakfastStatus: AttendanceStatus;
    lunchStatus: AttendanceStatus;
    isWorkDay: boolean;
    jalaliDateKey: string | null;
    isWeeklyOffDay: boolean;
    isOfficialHoliday: boolean;
    isManualHoliday: boolean;
    isForcedWorkday: boolean;
    holidayTitle: string | null;
    eventTitles: string[];
    eventCount: number;
    nonSelectableReasons: string[];
  };
};

function getStatusLabel(status: AttendanceStatus) {
  return status === AttendanceStatus.PRESENT ? "حاضر" : "غایب";
}

function EventAccordion({ titles }: { titles: string[] }) {
  if (titles.length === 0) {
    return null;
  }

  return (
    <details className="rounded-xl border border-border/60 bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer text-[11px] font-semibold text-foreground">
        رویدادها - {titles.length} مورد
      </summary>
      <ul className="mt-2 space-y-1">
        {titles.map((title, index) => (
          <li key={`${title}-${index}`}>• {title}</li>
        ))}
      </ul>
    </details>
  );
}

function DayIndicators({ day }: { day: MonthDayCardProps["day"] }) {
  if (!day.isOfficialHoliday && !day.isWeeklyOffDay && !day.isForcedWorkday) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5 text-[11px]">
      {day.isOfficialHoliday ? (
        <span className="rounded-full border border-rose-300/40 bg-rose-500/10 px-2 py-0.5 text-rose-600 dark:text-rose-200">
          تعطیل رسمی
        </span>
      ) : null}
      {day.isWeeklyOffDay ? (
        <span className="rounded-full border border-amber-300/40 bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-200">
          تعطیلی هفتگی
        </span>
      ) : null}
      {day.isForcedWorkday ? (
        <span className="rounded-full border border-sky-300/40 bg-sky-500/10 px-2 py-0.5 text-sky-700 dark:text-sky-200">
          روز کاری اجباری
        </span>
      ) : null}
    </div>
  );
}

function MealStatusLine({
  label,
  status,
}: {
  label: string;
  status: AttendanceStatus;
}) {
  return (
    <p className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
      <span>{label}</span>
      <span className="font-semibold">{getStatusLabel(status)}</span>
    </p>
  );
}

export function MonthDayCard({ day }: MonthDayCardProps) {
  return (
    <article className="dashboard-soft-card flex h-full flex-col">
      <div className="mb-3 flex min-h-12 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{day.dayNameFa}</p>
          <h3 className="truncate text-sm font-semibold text-foreground">
            {day.persianDateLabel}
          </h3>
        </div>
        {day.isToday ? (
          <span className="shrink-0 rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
            امروز
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <DayIndicators day={day} />

        {!day.isWorkDay ? (
          <div className="flex flex-1 flex-col gap-3 text-sm text-muted-foreground">
            <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
              <p className="font-semibold text-foreground">تعطیل</p>
              <p className="mt-1 text-xs leading-5">
                {day.holidayTitle ??
                  (day.isWeeklyOffDay
                    ? "تعطیلی هفتگی"
                    : "شرکت در این روز تعطیل است.")}
              </p>
            </div>
            <EventAccordion titles={day.eventTitles} />
          </div>
        ) : day.canEdit ? (
          <div className="flex flex-1 flex-col gap-3">
            <input type="hidden" name="date" value={day.dateKey} />
            <EventAccordion titles={day.eventTitles} />
            <div className="space-y-2">
              <label className="dashboard-muted-panel flex items-center justify-between text-sm">
                <span>صبحانه</span>
                <input
                  className="dashboard-checkbox"
                  type="checkbox"
                  name={`meal:${day.dateKey}:BREAKFAST`}
                  data-monthly-meal="BREAKFAST"
                  defaultChecked={
                    day.breakfastStatus === AttendanceStatus.PRESENT
                  }
                />
              </label>
              <label className="dashboard-muted-panel flex items-center justify-between text-sm">
                <span>ناهار</span>
                <input
                  className="dashboard-checkbox"
                  type="checkbox"
                  name={`meal:${day.dateKey}:LUNCH`}
                  data-monthly-meal="LUNCH"
                  defaultChecked={day.lunchStatus === AttendanceStatus.PRESENT}
                />
              </label>
            </div>
            <div className="mt-auto space-y-2 pt-1">
              <PendingSubmitButton
                name="targetDate"
                value={day.dateKey}
                pendingText="در حال ذخیره..."
                className="dashboard-primary-button w-full"
              >
                ذخیره همین روز
              </PendingSubmitButton>
              <p className="text-xs text-muted-foreground">
                مهلت: {formatPersianDateTime(day.deadline)}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-3 text-sm text-muted-foreground">
            <div className="space-y-2">
              <MealStatusLine label="صبحانه" status={day.breakfastStatus} />
              <MealStatusLine label="ناهار" status={day.lunchStatus} />
            </div>
            <EventAccordion titles={day.eventTitles} />
            <div className="mt-auto space-y-1 pt-1">
              <p className="text-amber-600 dark:text-amber-300">مهلت گذشته</p>
              <p className="text-xs">
                مهلت: {formatPersianDateTime(day.deadline)}
              </p>
              {!day.isSelectable ? (
                <p className="text-xs">
                  این تاریخ برای ثبت حضور قابل انتخاب نیست.
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
