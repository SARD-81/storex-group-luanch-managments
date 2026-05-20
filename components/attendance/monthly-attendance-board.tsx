import { getUserCurrentMonthAttendanceData } from "@/lib/dashboard/get-user-month-data";
import { MonthDayCard } from "@/components/attendance/month-day-card";

type MonthlyAttendanceBoardProps = {
  userId: string;
};

export async function MonthlyAttendanceBoard({ userId }: MonthlyAttendanceBoardProps) {
  const days = await getUserCurrentMonthAttendanceData(userId);

  return (
    <section className="dashboard-glass-card">
      <div className="mb-4 space-y-1">
        <h2 className="text-xl font-semibold">برنامه حضور ماه جاری من</h2>
        <p className="text-sm text-zinc-300">روزهای کاری ماه جاری نمایش داده می‌شوند؛ پنجشنبه و جمعه از این نما حذف شده‌اند.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-5">
        {days.map((day) => (
          <MonthDayCard key={day.dateKey} day={day} />
        ))}
      </div>
    </section>
  );
}
