import { getUserCurrentMonthAttendanceData } from "@/lib/dashboard/get-user-month-data";
import { updateMyMonthlyAttendanceAction } from "@/actions/my-attendance";
import { MonthDayCard } from "@/components/attendance/month-day-card";
import { MonthlyAttendanceActions } from "@/components/attendance/monthly-attendance-actions";

type MonthlyAttendanceBoardProps = {
  userId: string;
};

export async function MonthlyAttendanceBoard({ userId }: MonthlyAttendanceBoardProps) {
  const days = await getUserCurrentMonthAttendanceData(userId);

  return (
    <section className="dashboard-glass-card">
      <form action={updateMyMonthlyAttendanceAction} className="space-y-4">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">برنامه حضور ماه جاری من</h2>
            <p className="text-sm text-zinc-300">روزهای کاری ماه جاری نمایش داده می‌شوند؛ پنجشنبه و جمعه از این نما حذف شده‌اند.</p>
          </div>
          <MonthlyAttendanceActions />
        </div>
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-5">
          {days.map((day) => (
            <MonthDayCard key={day.dateKey} day={day} />
          ))}
        </div>
        <button type="submit" className="dashboard-primary-button">ذخیره کل ماه</button>
      </form>
    </section>
  );
}
