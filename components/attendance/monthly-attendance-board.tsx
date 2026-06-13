import { updateMyMonthlyAttendanceAction } from "@/actions/my-attendance";
import { MonthDayCard } from "@/components/attendance/month-day-card";
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
            <h2 className="text-2xl font-bold">برنامه حضور قابل رزرو من</h2>
            <p className="text-xs leading-6 text-muted-foreground">
              چیدمان ماهانه فشرده؛ هر ردیف یک هفته از شنبه تا جمعه است.
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

        <div className="overflow-x-auto rounded-[2rem] border border-border/50 bg-muted/15 p-3 shadow-inner [&_.dashboard-soft-card]:min-h-[172px] [&_.dashboard-soft-card]:p-3 [&_.dashboard-soft-card]:shadow-sm [&_.dashboard-soft-card_details]:rounded-lg [&_.dashboard-soft-card_details]:px-2 [&_.dashboard-soft-card_details]:py-1 [&_.dashboard-soft-card_details]:text-[10px] [&_.dashboard-soft-card_h3]:text-xs [&_.dashboard-soft-card_label]:py-1.5 [&_.dashboard-soft-card_label]:text-xs [&_.dashboard-soft-card_p]:leading-5">
          <div className="min-w-[960px] space-y-2 xl:min-w-0">
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
                    <MonthDayCard key={day.dateKey} day={day} />
                  ) : (
                    <div
                      key={`empty-${weekIndex}-${dayOfWeek}`}
                      aria-hidden="true"
                      className="min-h-[172px] rounded-2xl border border-dashed border-border/30 bg-background/15"
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
