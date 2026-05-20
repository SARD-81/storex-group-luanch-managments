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
  };
};

function getStatusLabel(status: AttendanceStatus) {
  return status === AttendanceStatus.PRESENT ? "حاضر" : "غایب";
}

export function MonthDayCard({ day }: MonthDayCardProps) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-4">
        <p className="text-sm text-zinc-400">{day.dayNameFa}</p>
        <h3 className="text-base font-semibold text-zinc-100">{day.persianDateLabel}</h3>
        {day.isToday ? <p className="mt-1 text-xs text-emerald-400">امروز</p> : null}
      </div>

      {day.canEdit ? (
        <form action={updateMyAttendanceAction} className="space-y-3">
          <input type="hidden" name="date" value={day.dateKey} />
          <label className="flex items-center justify-between text-sm text-zinc-200">
            <span>صبحانه</span>
            <input type="checkbox" name="meal:BREAKFAST" defaultChecked={day.breakfastStatus === AttendanceStatus.PRESENT} />
          </label>
          <label className="flex items-center justify-between text-sm text-zinc-200">
            <span>ناهار</span>
            <input type="checkbox" name="meal:LUNCH" defaultChecked={day.lunchStatus === AttendanceStatus.PRESENT} />
          </label>
          <button type="submit" className="w-full rounded-xl bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200">ذخیره</button>
          <p className="text-xs text-zinc-500">مهلت: {formatPersianDateTime(day.deadline)}</p>
        </form>
      ) : (
        <div className="space-y-2 text-sm text-zinc-300">
          <p>صبحانه: {getStatusLabel(day.breakfastStatus)}</p>
          <p>ناهار: {getStatusLabel(day.lunchStatus)}</p>
          <p className="text-amber-300">مهلت گذشته</p>
          <p className="text-xs text-zinc-500">مهلت: {formatPersianDateTime(day.deadline)}</p>
          {!day.isSelectable ? <p className="text-xs text-zinc-500">این تاریخ خارج از بازه انتخاب است.</p> : null}
        </div>
      )}
    </article>
  );
}
