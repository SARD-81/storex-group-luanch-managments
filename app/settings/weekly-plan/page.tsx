import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { AttendanceStatus } from "@/app/generated/prisma/client";
import { updateWeeklyPreferencesAction } from "@/actions/weekly-preferences";
import { ThemeToggle } from "@/components/theme-toggle";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { WeeklyPlanActions } from "@/components/weekly-plan/weekly-plan-actions";
import { requireAdmin } from "@/lib/auth/session";
import { MEAL_LABELS, MEAL_TYPES } from "@/lib/attendance/meals";
import { getAdminPlanWeekRange } from "@/lib/attendance/admin-weekly-summary";
import {
  formatCalendarWeeklyPlanDayStatus,
  getCalendarWeeklyPlanWindow,
} from "@/lib/attendance/calendar-weekly-plan";
import { addDays, WORK_DAYS } from "@/lib/attendance/week";
import { getDateKey } from "@/lib/date/date-key";
import {
  formatPersianDate,
  formatPersianWeekdayDate,
} from "@/lib/date/persian-format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type WeeklyPlanPageProps = {
  searchParams: Promise<{ saved?: string }>;
};

type WeeklyPlanDisplayDay = {
  dateKey: string;
  jalaliDateKey: string | null;
  dayNameFa: string | null;
  dayOfWeek: number;
  isOfficialHoliday: boolean | null;
  isWeeklyOffDay: boolean | null;
  statusLabel: string;
};

export default async function WeeklyPlanPage({
  searchParams,
}: WeeklyPlanPageProps) {
  await requireAdmin();
  noStore();

  await searchParams;
  const { weekStart, weekEndExclusive } = getAdminPlanWeekRange();

  const [users, weeklyAttendances, calendarWeeklyPlanWindow] =
    await Promise.all([
      prisma.user.findMany({
        where: { isActive: true },
        include: { weeklyPreferences: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.mealAttendance.findMany({
        where: {
          date: { gte: weekStart, lt: weekEndExclusive },
          status: AttendanceStatus.PRESENT,
        },
        select: {
          userId: true,
          date: true,
          mealType: true,
        },
      }),
      getCalendarWeeklyPlanWindow(prisma),
    ]);

  const calendarWeeklyPlanDays = calendarWeeklyPlanWindow.days
    .filter((day) => day.dayOfWeek !== null)
    .map((day) => ({
      dateKey: day.dateKey,
      jalaliDateKey: day.jalaliDateKey,
      dayNameFa: day.dayNameFa,
      dayOfWeek: day.dayOfWeek as number,
      isOfficialHoliday: day.isOfficialHoliday,
      isWeeklyOffDay: day.isWeeklyOffDay,
      statusLabel: formatCalendarWeeklyPlanDayStatus(day),
    }));
  const fallbackWeeklyPlanDays = WORK_DAYS.map((day) => {
    const date = addDays(weekStart, day.dayOfWeek);

    return {
      dateKey: getDateKey(date),
      jalaliDateKey: null,
      dayNameFa: day.label,
      dayOfWeek: day.dayOfWeek,
      isOfficialHoliday: false,
      isWeeklyOffDay: false,
      statusLabel: "روز کاری",
    };
  });
  const weeklyPlanDays: WeeklyPlanDisplayDay[] =
    calendarWeeklyPlanDays.length > 0
      ? calendarWeeklyPlanDays
      : fallbackWeeklyPlanDays;
  const weeklyAttendanceKeysByUserId = new Map<string, Set<string>>();

  for (const attendance of weeklyAttendances) {
    const attendanceKey = getDateKey(attendance.date);

    if (!weeklyAttendanceKeysByUserId.has(attendance.userId)) {
      weeklyAttendanceKeysByUserId.set(attendance.userId, new Set());
    }

    weeklyAttendanceKeysByUserId
      .get(attendance.userId)
      ?.add(`${attendanceKey}:${attendance.mealType}`);
  }

  const planWindowLabel = calendarWeeklyPlanWindow.label;

  return (
    <main
      dir="rtl"
      className="dashboard-aurora-shell min-h-screen p-6 text-right text-zinc-50 md:p-8"
    >
      <div className="dashboard-aurora dashboard-aurora-one" />
      <div className="dashboard-aurora dashboard-aurora-two" />
      <div className="dashboard-aurora dashboard-aurora-three" />

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6">
        <header className="dashboard-glass-card flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-300">
                مدیریت برنامه هفتگی وعده‌های تیم
              </p>
              <h1 className="mt-1 text-3xl font-bold">تنظیم برنامه هفتگی</h1>
            </div>
            <ThemeToggle />
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="dashboard-action-button inline-flex items-center gap-2"
            >
              بازگشت به داشبورد
            </Link>
          </div>
        </header>

        <section className="dashboard-glass-card">
          <h2 className="text-lg font-semibold">{planWindowLabel}</h2>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <p className="dashboard-muted-panel">
              شروع بازه: {formatPersianWeekdayDate(weekStart)}
            </p>
            <p className="dashboard-muted-panel">
              پایان بازه (غیرشامل): {formatPersianDate(weekEndExclusive)}
            </p>
          </div>
        </section>

        <section className="dashboard-glass-card">
          <h2 className="mb-3 text-lg font-semibold">اقدامات سریع</h2>
          <WeeklyPlanActions />
        </section>

        <form
          action={updateWeeklyPreferencesAction}
          className="dashboard-glass-card"
        >
          <p className="mb-3 text-sm text-zinc-300">
            اگر برای کاربری برنامه هفتگی ذخیره نشده باشد، وضعیت حضور ثبت‌شده در
            همین بازه به‌عنوان مقدار اولیه نمایش داده می‌شود.
          </p>
          <p className="mb-3 text-xs text-zinc-400">
            تعطیلی‌های رسمی این بازه از تقویم رسمی سامانه نمایش داده می‌شوند؛
            تنظیمات هفتگی همچنان بر اساس روز هفته ذخیره می‌شوند.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-right text-sm">
              <thead>
                <tr className="bg-white/5 text-zinc-200">
                  <th
                    rowSpan={2}
                    className="sticky right-0 z-30 min-w-[220px] border-b border-white/10 bg-white/10 p-3 text-right"
                  >
                    کاربر
                  </th>
                  {weeklyPlanDays.map((day) => {
                    const statusClassName = day.isOfficialHoliday
                      ? "text-rose-300"
                      : day.isWeeklyOffDay
                        ? "text-amber-300"
                        : "text-zinc-400";

                    return (
                      <th
                        key={day.dateKey}
                        colSpan={MEAL_TYPES.length}
                        className="border-b border-white/10 p-3 text-center"
                      >
                        <div className="space-y-1">
                          <p>{day.dayNameFa ?? `روز ${day.dayOfWeek}`}</p>
                          <p className="text-xs text-zinc-400">
                            {day.jalaliDateKey ?? day.dateKey}
                          </p>
                          <p className={`text-xs ${statusClassName}`}>
                            {day.statusLabel}
                          </p>
                        </div>
                      </th>
                    );
                  })}
                </tr>
                <tr className="bg-white/5 text-zinc-300">
                  {weeklyPlanDays.flatMap((day) =>
                    MEAL_TYPES.map((mealType) => (
                      <th
                        key={`${day.dayOfWeek}-${mealType}`}
                        className="border-b border-white/10 p-3 text-center"
                      >
                        {MEAL_LABELS[mealType]}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const enabledPreferenceKeys = new Set(
                    user.weeklyPreferences
                      .filter((preference) => preference.isEnabled)
                      .map(
                        (preference) =>
                          `${preference.dayOfWeek}:${preference.mealType}`,
                      ),
                  );
                  const attendancePreferenceKeys =
                    weeklyAttendanceKeysByUserId.get(user.id) ??
                    new Set<string>();
                  const hasSavedWeeklyPreferences =
                    user.weeklyPreferences.length > 0;

                  return (
                    <tr key={user.id} className="odd:bg-white/[0.03]">
                      <td className="sticky right-0 z-20 border-b border-white/10 bg-zinc-950/70 p-3 align-middle backdrop-blur-xl">
                        <p className="font-semibold text-zinc-100">
                          {user.name}
                        </p>
                        <p className="text-xs text-zinc-300">
                          @{user.username}
                        </p>
                      </td>
                      {weeklyPlanDays.flatMap((day) =>
                        MEAL_TYPES.map((mealType) => {
                          const preferenceKey = `${day.dayOfWeek}:${mealType}`;
                          const attendanceKey = `${day.dateKey}:${mealType}`;
                          const isChecked = hasSavedWeeklyPreferences
                            ? enabledPreferenceKeys.has(preferenceKey)
                            : attendancePreferenceKeys.has(attendanceKey);

                          return (
                            <td
                              key={`${user.id}-${day.dayOfWeek}-${mealType}`}
                              className="border-b border-white/10 p-3 text-center"
                            >
                              <input
                                type="checkbox"
                                name={`preference:${user.id}:${day.dayOfWeek}:${mealType}`}
                                defaultChecked={isChecked}
                                data-weekly-preference
                                data-weekly-meal={mealType}
                                data-weekly-day={day.dayOfWeek}
                                data-weekly-user={user.id}
                                className="dashboard-checkbox"
                              />
                            </td>
                          );
                        }),
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <PendingSubmitButton
              type="submit"
              pendingText="در حال ذخیره..."
              className="dashboard-primary-button"
            >
              ذخیره برنامه هفتگی
            </PendingSubmitButton>
          </div>
        </form>
      </div>
    </main>
  );
}
