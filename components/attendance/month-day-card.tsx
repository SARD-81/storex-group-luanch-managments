import { AttendanceStatus } from "@/app/generated/prisma/client";
import { updateMyAttendanceAction } from "@/actions/my-attendance";
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
  };
};

function getStatusLabel(status: AttendanceStatus) {
  return status === AttendanceStatus.PRESENT ? "حاضر" : "غایب";
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

      {!day.isWorkDay ? (
        <div className="space-y-2 text-sm text-zinc-300">
          <p>تعطیل</p>
          <p className="text-xs">شرکت در این روز تعطیل است.</p>
        </div>
      ) : day.canEdit ? (
        <form action={updateMyAttendanceAction} className="space-y-3">
          <input type="hidden" name="date" value={day.dateKey} />
          <label className="dashboard-muted-panel flex items-center justify-between text-sm">
            <span>صبحانه</span>
            <input className="dashboard-checkbox" type="checkbox" name="meal:BREAKFAST" defaultChecked={day.breakfastStatus === AttendanceStatus.PRESENT} />
          </label>
          <label className="dashboard-muted-panel flex items-center justify-between text-sm">
            <span>ناهار</span>
            <input className="dashboard-checkbox" type="checkbox" name="meal:LUNCH" defaultChecked={day.lunchStatus === AttendanceStatus.PRESENT} />
          </label>
          <button type="submit" className="dashboard-primary-button w-full">ذخیره</button>
          <p className="text-xs text-zinc-400">مهلت: {formatPersianDateTime(day.deadline)}</p>
        </form>
      ) : (
        <div className="space-y-2 text-sm text-zinc-200">
          <p>صبحانه: {getStatusLabel(day.breakfastStatus)}</p>
          <p>ناهار: {getStatusLabel(day.lunchStatus)}</p>
          <p className="text-amber-300">مهلت گذشته</p>
          <p className="text-xs text-zinc-400">مهلت: {formatPersianDateTime(day.deadline)}</p>
          {!day.isSelectable ? <p className="text-xs text-zinc-400">این تاریخ خارج از بازه انتخاب است.</p> : null}
        </div>
      )}
    </article>
  );
}
