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

const numberFormatter = new Intl.NumberFormat("fa-IR", { useGrouping: false });

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

function getStatusLabel(status: MonthlyAttendanceDay["breakfastStatus"]) {
  return status === "PRESENT" ? "حاضر" : "غایب";
}

function EventDetails({ titles }: { titles: string[] }) {
  if (titles.length === 0) {
    return null;
  }

  return (
    <details className="rounded-xl border border-border/60 bg-muted/45 px-3 py-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer font-bold text-foreground">
        رویدادها - {numberFormatter.format(titles.length)} مورد
      </summary>
      <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto pr-1 leading-5">
        {titles.map((title, index) => (
          <li key={`${title}-${index}`}>• {title}</li>
        ))}
      </ul>
    </details>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      {children}
    </span>
  );
}

function MealRow({
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
      <label className="dashboard-muted-panel flex items-center justify-between text-sm">
        <span>{label}</span>
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
    <div className="dashboard-muted-panel flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className="font-semibold text-foreground">{getStatusLabel(status)}</span>
    </div>
  );
}

function ReservationDayCard({ day }: { day: MonthlyAttendanceDay }) {
  return (
    <article className="dashboard-soft-card flex min-h-[260px] flex-col p-4">
      <div className="mb-3 flex min-h-12 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{day.dayNameFa}</p>
          <h3 className="truncate text-sm font-semibold text-foreground" title={day.persianDateLabel}>
            {day.persianDateLabel}
          </h3>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {day.isToday ? (
            <Badge className="border-emerald-300/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              امروز
            </Badge>
          ) : null}
          {day.isOfficialHoliday ? (
            <Badge className="border-rose-300/40 bg-rose-500/10 text-rose-600 dark:text-rose-200">
              تعطیل رسمی
            </Badge>
          ) : null}
          {day.isWeeklyOffDay ? (
            <Badge className="border-amber-300/40 bg-amber-500/10 text-amber-700 dark:text-amber-200">
              تعطیلی هفتگی
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        {!day.isWorkDay ? (
          <>
            <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">تعطیل</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5">
                {day.holidayTitle ?? "شرکت در این روز تعطیل است."}
              </p>
            </div>
            <EventDetails titles={day.eventTitles} />
          </>
        ) : (
          <>
            {day.canEdit ? <input type="hidden" name="date" value={day.dateKey} /> : null}
            <div className="space-y-2">
              <MealRow
                day={day}
                mealType="BREAKFAST"
                label="صبحانه"
                status={day.breakfastStatus}
              />
              <MealRow
                day={day}
                mealType="LUNCH"
                label="ناهار"
                status={day.lunchStatus}
              />
            </div>
            <EventDetails titles={day.eventTitles} />
            {day.canEdit ? (
              <div className="mt-auto space-y-2 pt-1">
                <PendingSubmitButton
                  name="targetDate"
                  value={day.dateKey}
                  pendingText="در حال ذخیره..."
                  className="dashboard-primary-button w-full"
                >
                  ذخیره همین روز
                </PendingSubmitButton>
                <p className="text-xs text-muted-foreground">مهلت: ۱۲ ظهر روز قبل</p>
              </div>
            ) : (
              <div className="mt-auto space-y-1 pt-1 text-xs">
                <p className="font-semibold text-amber-600 dark:text-amber-300">مهلت گذشته</p>
                <p className="text-muted-foreground">مهلت: ۱۲ ظهر روز قبل</p>
              </div>
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
              هر ردیف یک هفته کامل از شنبه تا جمعه است؛ رویدادها کامل باز می‌شوند و دکمه ذخیره هر روز واضح است.
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
          <div className="min-w-[1344px] space-y-3 2xl:min-w-0">
            <div className="grid grid-cols-7 gap-3 px-1 text-center text-xs font-bold text-muted-foreground">
              {WEEK_DAYS.map((dayLabel) => (
                <div
                  key={dayLabel}
                  className="rounded-2xl border border-border/40 bg-background/35 py-2.5"
                >
                  {dayLabel}
                </div>
              ))}
            </div>

            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 items-stretch gap-3">
                {week.map((day, dayOfWeek) =>
                  day ? (
                    <ReservationDayCard key={day.dateKey} day={day} />
                  ) : (
                    <div
                      key={`empty-${weekIndex}-${dayOfWeek}`}
                      aria-hidden="true"
                      className="min-h-[260px] rounded-2xl border border-dashed border-border/25 bg-background/10"
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
