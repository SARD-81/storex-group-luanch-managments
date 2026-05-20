import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { WORK_DAYS } from "@/lib/attendance/week";
import { MEAL_LABELS, MEAL_TYPES } from "@/lib/attendance/meals";
import { updateWeeklyPreferencesAction } from "@/actions/weekly-preferences";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function WeeklyPlanPage() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
    },
    include: {
      weeklyPreferences: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-zinc-950 p-8 text-right text-zinc-50"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h1 className="text-2xl font-bold">تنظیم برنامه هفتگی</h1>

          <p className="mt-2 text-sm text-zinc-400">
            فقط روزهای کاری شنبه تا چهارشنبه قابل تنظیم هستند.
          </p>

          <Link
            href="/"
            className="mt-4 inline-block rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-100 transition hover:bg-zinc-800"
          >
            بازگشت به داشبورد
          </Link>
        </header>

        <form
          action={updateWeeklyPreferencesAction}
          className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-right text-sm">
              <thead className="border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="p-3">نام</th>
                  <th className="p-3">نام کاربری</th>

                  {WORK_DAYS.flatMap((day) =>
                    MEAL_TYPES.map((mealType) => (
                      <th
                        key={`${day.dayOfWeek}-${mealType}`}
                        className="p-3"
                      >
                        {day.label} - {MEAL_LABELS[mealType]}
                      </th>
                    )),
                  )}
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-zinc-800">
                    <td className="p-3">{user.name}</td>
                    <td className="p-3">{user.username}</td>

                    {WORK_DAYS.flatMap((day) =>
                      MEAL_TYPES.map((mealType) => {
                        const isChecked = user.weeklyPreferences.some(
                          (preference) =>
                            preference.dayOfWeek === day.dayOfWeek &&
                            preference.mealType === mealType &&
                            preference.isEnabled,
                        );

                        return (
                          <td
                            key={`${user.id}-${day.dayOfWeek}-${mealType}`}
                            className="p-3"
                          >
                            <input
                              type="checkbox"
                              name={`preference:${user.id}:${day.dayOfWeek}:${mealType}`}
                              defaultChecked={isChecked}
                              className="h-4 w-4"
                            />
                          </td>
                        );
                      }),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="submit"
            className="mt-6 rounded-xl bg-zinc-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
          >
            ذخیره برنامه هفتگی
          </button>
        </form>
      </div>
    </main>
  );
}