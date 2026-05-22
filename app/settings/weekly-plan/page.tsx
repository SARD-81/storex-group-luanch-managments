import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { updateWeeklyPreferencesAction } from "@/actions/weekly-preferences";
import { ThemeToggle } from "@/components/theme-toggle";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { WeeklyPlanActions } from "@/components/weekly-plan/weekly-plan-actions";
import { requireAdmin } from "@/lib/auth/session";
import { MEAL_LABELS, MEAL_TYPES } from "@/lib/attendance/meals";
import { getAdminPlanWeekRange, getAdminPlanWindowLabel } from "@/lib/attendance/admin-weekly-summary";
import { WORK_DAYS } from "@/lib/attendance/week";
import { formatPersianDate, formatPersianWeekdayDate } from "@/lib/date/persian-format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type WeeklyPlanPageProps = {
  searchParams: Promise<{ saved?: string }>
};

export default async function WeeklyPlanPage({ searchParams }: WeeklyPlanPageProps) {
  await requireAdmin();
  noStore();

  const params = await searchParams;

  const users = await prisma.user.findMany({
    where: { isActive: true },
    include: { weeklyPreferences: true },
    orderBy: { createdAt: "asc" },
  });

  const { weekStart, weekEndExclusive } = getAdminPlanWeekRange();
  const planWindowLabel = getAdminPlanWindowLabel();

  return (
    <main dir="rtl" className="dashboard-aurora-shell min-h-screen p-6 text-right text-zinc-50 md:p-8">
      <div className="dashboard-aurora dashboard-aurora-one" />
      <div className="dashboard-aurora dashboard-aurora-two" />
      <div className="dashboard-aurora dashboard-aurora-three" />

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6">
        <header className="dashboard-glass-card flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-300">مدیریت برنامه هفتگی وعده‌های تیم</p>
              <h1 className="mt-1 text-3xl font-bold">تنظیم برنامه هفتگی</h1>
            </div>
            <ThemeToggle />
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/" className="dashboard-action-button inline-flex items-center gap-2">
              بازگشت به داشبورد
            </Link>
          </div>
        </header>

        <section className="dashboard-glass-card">
          <h2 className="text-lg font-semibold">{planWindowLabel}</h2>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <p className="dashboard-muted-panel">شروع بازه: {formatPersianWeekdayDate(weekStart)}</p>
            <p className="dashboard-muted-panel">پایان بازه (غیرشامل): {formatPersianDate(weekEndExclusive)}</p>
          </div>
        </section>

        {params.saved === "1" ? (
          <section className="dashboard-glass-card border border-emerald-400/40 bg-emerald-500/10 text-emerald-100">
            برنامه هفتگی با موفقیت ذخیره شد و اطلاعات از دیتابیس به‌روزرسانی شد.
          </section>
        ) : null}

        <section className="dashboard-glass-card">
          <h2 className="mb-3 text-lg font-semibold">اقدامات سریع</h2>
          <WeeklyPlanActions />
        </section>

        <form action={updateWeeklyPreferencesAction} className="dashboard-glass-card">
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-right text-sm">
              <thead>
                <tr className="bg-white/5 text-zinc-200">
                  <th rowSpan={2} className="sticky right-0 z-30 min-w-[220px] border-b border-white/10 bg-white/10 p-3 text-right">کاربر</th>
                  {WORK_DAYS.map((day) => (
                    <th key={day.dayOfWeek} colSpan={MEAL_TYPES.length} className="border-b border-white/10 p-3 text-center">{day.label}</th>
                  ))}
                </tr>
                <tr className="bg-white/5 text-zinc-300">
                  {WORK_DAYS.flatMap((day) =>
                    MEAL_TYPES.map((mealType) => (
                      <th key={`${day.dayOfWeek}-${mealType}`} className="border-b border-white/10 p-3 text-center">
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
                      .map((preference) => `${preference.dayOfWeek}:${preference.mealType}`),
                  );

                  return (
                    <tr key={user.id} className="odd:bg-white/[0.03]">
                    <td className="sticky right-0 z-20 border-b border-white/10 bg-zinc-950/70 p-3 align-middle backdrop-blur-xl">
                      <p className="font-semibold text-zinc-100">{user.name}</p>
                      <p className="text-xs text-zinc-300">@{user.username}</p>
                    </td>
                    {WORK_DAYS.flatMap((day) =>
                      MEAL_TYPES.map((mealType) => {
                        const isChecked = enabledPreferenceKeys.has(`${day.dayOfWeek}:${mealType}`);

                        return (
                          <td key={`${user.id}-${day.dayOfWeek}-${mealType}`} className="border-b border-white/10 p-3 text-center">
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
