import { updateMyMonthlyAttendanceAction } from "@/actions/my-attendance";
import { MonthDayCard } from "@/components/attendance/month-day-card";
import { MonthlyAttendanceActions } from "@/components/attendance/monthly-attendance-actions";
import { getUserCurrentMonthAttendanceData } from "@/lib/dashboard/get-user-month-data";

type MonthlyAttendanceBoardProps = {
  userId: string;
};

export async function MonthlyAttendanceBoard({
  userId,
}: MonthlyAttendanceBoardProps) {
  const days = await getUserCurrentMonthAttendanceData(userId);

  return (
    <section className="dashboard-glass-card p-6">
      <form action={updateMyMonthlyAttendanceAction} className="space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">نمای ماهانه</p>

            <h2 className="text-2xl font-bold">
              برنامه حضور ماه جاری من
            </h2>

            {/* <p className="text-sm leading-6 text-muted-foreground">
              روزهای کاری ماه جاری نمایش داده می‌شوند؛ پنجشنبه و جمعه از این نما حذف شده‌اند.
            </p> */}
          </div>

            
          <div className="dashboard-muted-panel sticky top-4 z-20 flex flex-col gap-3 p-3 backdrop-blur-xl xl:items-end">
            <MonthlyAttendanceActions />

          </div>
          <button
              type="submit"
              className="dashboard-primary-button xl:w-auto"
            >
              ذخیره کل ماه
            </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-5">
          {days.map((day) => (
            <MonthDayCard key={day.dateKey} day={day} />
          ))}
        </div>
      </form>
    </section>
  );
}