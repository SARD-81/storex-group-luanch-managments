import { getUserCurrentMonthAttendanceData } from "@/lib/dashboard/get-user-month-data";
import { MonthDayCard } from "@/components/attendance/month-day-card";

type MonthlyAttendanceBoardProps = {
  userId: string;
};

export async function MonthlyAttendanceBoard({ userId }: MonthlyAttendanceBoardProps) {
  const days = await getUserCurrentMonthAttendanceData(userId);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="mb-4 text-xl font-semibold">برنامه حضور ماه جاری من</h2>
      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-5">
        {days.map((day) => (
          <MonthDayCard key={day.dateKey} day={day} />
        ))}
      </div>
    </section>
  );
}
