import { updateMyMonthlyAttendanceAction } from "@/actions/my-attendance";
import { MonthlyAttendanceActions } from "@/components/attendance/monthly-attendance-actions";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { getUserCurrentMonthAttendanceData } from "@/lib/dashboard/get-user-month-data";

type MonthlyAttendanceBoardProps = {
  userId: string;
};

type MonthlyAttendanceDay = Awaited<
  ReturnType<typeof getUserCurrentMonthAttendanceData>
>[number];

type AttendanceWeekRow = Array<MonthlyAttendanceDay | null>;

const WEEK_DAYS = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
] as const;

const persianNumberFormatter = new Intl.NumberFormat("fa-IR", {
  useGrouping: false,
});

function groupDaysByWeek(days: MonthlyAttendanceDay[]): AttendanceWeekRow[] {
  const weeks: AttendanceWeekRow[] = [];
  let currentWeek: AttendanceWeekRow = Array.from({ length: 7 }, () => null);

  for (const day of days) {
    if (day.dayOfWeek === 0 && currentWeek.some(Boolean)) {
      weeks.push(currentWeek);
      currentWeek = Array.from({ length: 7 }, () => null);
    }

    currentWeek[day.dayOfWeek] = day;
  }

  if (currentWeek.some(Boolean)) {
    weeks.push(currentWeek);
  }

  return weeks;
}

function getCompactDateLabel(day: MonthlyAttendanceDay) {
  const parts = day.persianDateLabel.split(" ").filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1]}`;
  }

  return day.persianDateLabel;
}

function getMealStatusLabel(status: MonthlyAttendanceDay["breakfastStatus"]) {
  return status === "PRESENT" ? "حاضر" : "غایب";
}

function DayBadge({
  label,
  tone,
}: {
  label: string;
  tone: "today" | "official" | "weekly" | "forced";
}) {
  const toneClass = {
    today:
      "border-emerald-300/45 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    official:
      "border-rose-300/45 bg-rose-500/10 text-rose-600 dark:text-rose-200",
    weekly:
      "border-amber-300/45 bg-amber-500/10 text-amber-700 dark:text-amber-200",
    forced:
      "border-sky-300/45 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  }[tone];

  return (
    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${toneClass}`}>
      {label}
    </span>
  );
}

function EventSummary({ titles }: { titles: string[] }) {
  if (titles.length === 0) {
    return null;
  }

  return (
    <details className="rounded-lg border border-border/45 bg-muted/25 px-2 py-1 text-[10px] text-muted-foreground">
      <summary className="cursor-pointer truncate font-bold text-foreground">
        رویدادها: {persianNumberFormatter.format(titles.length)}
      </summary>
      <ul className="mt-1 max-h-9 space-y-0.5 overflow-hidden">
        {titles.slice(0, 3).map((title, index) => (
          <li key={`${title}-${index}`} className="truncate">
            • {title}
          </li>
        ))}
      </ul>
    </details>
  );
}

function MealLine({
  day,
  mealType,
  label,
  status,
}: {
  day: MonthlyAttendanceDay;
  mealType: "BREAKFAST" | "LUNCH";
  label: string;
  status: MonthlyAttendanceDay["breakfastStatus"];
}) {
  if (day.canEdit) {
    return (
      <label className="flex items-center justify-between gap-2 rounded-lg border border-border/45 bg-muted/30 px-2 py-1.5 text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <input
          className="dashboard-checkbox"
          type="checkbox"
          name={`meal:${day.dateKey}:${mealType}`}
          data-monthly-meal={mealType}
          defaultChecked={status === "PRESENT"}
        />
      </label>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 px-2 py-1.5 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground">{getMealStatusLabel(status)}</span>
    </div>
  );
}

function CalendarDayCell({ day }: { day: MonthlyAttendanceDay }) {
  const isInactive = !day.isWorkDay;

  return (
    <article
      className={`flex h-[172px] min-h-[172px] overflow-hidden rounded-2xl border p-3 shadow-sm transition ${
        day.isToday
          ? "border-emerald-300/50 bg-emerald-500/10"
          : isInactive
            ? "border-border/35 bg-muted/20"
            : "border-border/50 bg-background/40 hover:border-ring/45 hover:bg-background/55"
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-h-8 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] leading-4 text-muted-foreground">{day.dayNameFa}</p>
            <h3 className="truncate text-sm font-black leading-5 text-foreground" title={day.persianDateLabel}>
              {getCompactDateLabel(day)}
            </h3>
          </div>
          <div className="flex max-w-[72%] flex-wrap justify-end gap-1">
            {day.isToday ? <DayBadge label="امروز" tone="today" /> : null}
            {day.isOfficialHoliday ? <DayBadge label="رسمی" tone="official" /> : null}
            {day.isWeeklyOffDay ? <DayBadge label="هفتگی" tone="weekly" /> : null}
            {day.isForcedWorkday ? <DayBadge label="کاری" tone="forced" /> : null}
          </div>
        </div>

        {!day.isWorkDay ? (
          <>
            <div className="rounded-xl border border-border/40 bg-muted/25 px-2 py-2 text-center text-xs font-black text-foreground">
              تعطیل
            </div>
            <EventSummary titles={day.eventTitles} />
            <p className="mt-auto truncate text-[10px] leading-4 text-muted-foreground">
              {day.holidayTitle ?? "روز غیرکاری"}
            </p>
          </>
        ) : (
          <>
            {day.canEdit ? <input type="hidden" name="date" value={day.dateKey} /> : null}
            <div className="space-y-1.5">
              <MealLine
                day={day}
                mealType="BREAKFAST"
                label="صبحانه"
                status={day.breakfastStatus}
              />
              <MealLine
                day={day}
                mealType="LUNCH"
                label="ناهار"
                status={day.lunchStatus}
              />
            </div>
            <EventSummary titles={day.eventTitles} />
            {day.canEdit ? (
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <span className="truncate text-[10px] text-muted-foreground">
                  مهلت: ۱۲ ظهر قبل
                </span>
                <button
                  type="submit"
                  name="targetDate"
                  value={day.dateKey}
                  className="rounded-lg border border-border/50 bg-background/55 px-2 py-1 text-[10px] font-black transition hover:bg-muted"
                >
                  ذخیره
                </button>
              </div>
            ) : (
              <p className="mt-auto truncate text-[10px] font-bold text-amber-600 dark:text-amber-300">
                مهلت گذشته
              </p>
            )}
          </>
        )}
      </div>
    </article>
  );
}

export async function MonthlyAttendanceBoard({
  userId,
}: MonthlyAttendanceBoardProps) {
  const days = await getUserCurrentMonthAttendanceData(userId);
  const weeks = groupDaysByWeek(days);

  return (
    <section className="dashboard-glass-card p-5 md:p-6">
      <form action={updateMyMonthlyAttendanceAction} className="space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">تقویم رزرو</p>
            <h2 className="text-2xl font-bold">برنامه رزرو وعده‌های من</h2>
            <p className="text-xs leading-6 text-muted-foreground">
              هر خانه اندازه ثابت دارد و هر ردیف یک هفته کامل از شنبه تا جمعه است.
            </p>
          </div>

          <div className="dashboard-muted-panel sticky top-4 z-20 flex flex-col gap-3 p-3 backdrop-blur-xl xl:items-end">
            <MonthlyAttendanceActions />
            <PendingSubmitButton
              className="dashboard-primary-button w-full xl:w-auto"
              pendingText="در حال ذخیره..."
            >
              ذخیره تغییرات
            </PendingSubmitButton>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[2rem] border border-border/50 bg-muted/15 p-3 shadow-inner">
          <div className="min-w-[1064px] space-y-2 xl:min-w-0">
            <div className="grid grid-cols-7 gap-2 px-1 text-center text-[11px] font-bold text-muted-foreground">
              {WEEK_DAYS.map((dayLabel) => (
                <div
                  key={dayLabel}
                  className="rounded-xl border border-border/40 bg-background/35 py-2"
                >
                  {dayLabel}
                </div>
              ))}
            </div>

            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 items-stretch gap-2">
                {week.map((day, dayOfWeek) =>
                  day ? (
                    <CalendarDayCell key={day.dateKey} day={day} />
                  ) : (
                    <div
                      key={`empty-${weekIndex}-${dayOfWeek}`}
                      aria-hidden="true"
                      className="h-[172px] rounded-2xl border border-dashed border-border/25 bg-background/10"
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </form>
    </section>
  );
}
