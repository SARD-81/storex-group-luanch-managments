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

function EventTitleList({ titles }: { titles: string[] }) {
  if (titles.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300">
      <p className="mb-1 text-[11px] text-zinc-400">رویدادها</p>
      <ul className="space-y-1">
        {titles.map((title) => (
          <li key={title}>• {title}</li>
        ))}
      </ul>
    </div>
  );
}

function DayIndicators({ day }: { day: MonthDayCardProps["day"] }) {
  if (!day.isOfficialHoliday && !day.isWeeklyOffDay && !day.isForcedWorkday) {
    return null;
  }

  return (
    <div className="mb-4 flex flex-wrap gap-1.5 text-[11px]">
      {day.isOfficialHoliday ? (
        <span className="rounded-full border border-rose-300/30 bg-rose-400/10 px-2 py-0.5 text-rose-200">تعطیل رسمی</span>
      ) : null}
      {day.isWeeklyOffDay ? (
        <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 text-amber-200">تعطیلی هفتگی</span>
      ) : null}
      {day.isForcedWorkday ? (
        <span className="rounded-full border border-sky-300/30 bg-sky-400/10 px-2 py-0.5 text-sky-200">روز کاری اجباری</span>
      ) : null}
    </div>
  );
}

export function MonthDayCard({ day }: MonthDayCardProps) {
  return (
    <article className="dashboard-soft-card">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-zinc-300">{day.dayNameFa}</p>
          <h3 className="text-sm font-semibold text-zinc-50">{day.persianDateLabel}</h3>
        </div>
        {day.isToday ? <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-300">امروز</span> : null}
      </div>

      <DayIndicators day={day} />

      {!day.isWorkDay ? (
        <div className="space-y-2 text-sm text-zinc-300">
          <p>تعطیل</p>
          <p className="text-xs">
            {day.holidayTitle ?? (day.isWeeklyOffDay ? "تعطیلی هفتگی" : "شرکت در این روز تعطیل است.")}
          </p>
          <EventTitleList titles={day.eventTitles} />
        </div>
      ) : day.canEdit ? (
        <div className="space-y-3">
          <input type="hidden" name="date" value={day.dateKey} />
          <EventTitleList titles={day.eventTitles} />
          <label className="dashboard-muted-panel flex items-center justify-between text-sm">
            <span>صبحانه</span>
            <input className="dashboard-checkbox" type="checkbox" name={`meal:${day.dateKey}:BREAKFAST`} data-monthly-meal="BREAKFAST" defaultChecked={day.breakfastStatus === AttendanceStatus.PRESENT} />
          </label>
          <label className="dashboard-muted-panel flex items-center justify-between text-sm">
            <span>ناهار</span>
            <input className="dashboard-checkbox" type="checkbox" name={`meal:${day.dateKey}:LUNCH`} data-monthly-meal="LUNCH" defaultChecked={day.lunchStatus === AttendanceStatus.PRESENT} />
          </label>
          <PendingSubmitButton
            name="targetDate"
            value={day.dateKey}
            pendingText="در حال ذخیره..."
            className="dashboard-primary-button w-full"
          >
            ذخیره همین روز
          </PendingSubmitButton>
          <p className="text-xs text-zinc-400">مهلت: {formatPersianDateTime(day.deadline)}</p>
        </div>
      ) : (
        <div className="space-y-2 text-sm text-zinc-200">
          <p>صبحانه: {getStatusLabel(day.breakfastStatus)}</p>
          <p>ناهار: {getStatusLabel(day.lunchStatus)}</p>
          <p className="text-amber-300">مهلت گذشته</p>
          <p className="text-xs text-zinc-400">مهلت: {formatPersianDateTime(day.deadline)}</p>
          <EventTitleList titles={day.eventTitles} />
          {!day.isSelectable ? <p className="text-xs text-zinc-400">این تاریخ برای ثبت حضور قابل انتخاب نیست.</p> : null}
        </div>
      )}
    </article>
  );
}
