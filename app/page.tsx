import Link from "next/link";
import { UserRole, MealType } from "@/app/generated/prisma/client";
import { logoutAction } from "@/actions/auth";
import { generateNextWeekAttendanceAction } from "@/actions/attendance";
import { requireUser } from "@/lib/auth/session";
import {
  getNextWorkWeekRange,
  getWorkWeekDays,
  toDateKey,
} from "@/lib/attendance/week";
import {
  getAdminDashboardData,
  getUserDashboardData,
} from "@/lib/dashboard/get-dashboard-data";

const mealLabels = {
  [MealType.BREAKFAST]: "صبحانه",
  [MealType.LUNCH]: "ناهار",
};

const roleLabels = {
  [UserRole.ADMIN]: "مدیر",
  [UserRole.USER]: "کاربر",
};

const mealTypes = [MealType.BREAKFAST, MealType.LUNCH] as const;

type AttendanceBucket = Record<MealType, string[]>;

function createEmptyBucket(): AttendanceBucket {
  return {
    [MealType.BREAKFAST]: [],
    [MealType.LUNCH]: [],
  };
}

export default async function Home() {
  const currentUser = await requireUser();
  const isAdmin = currentUser.role === UserRole.ADMIN;

  const { weekStart, weekEndExclusive } = getNextWorkWeekRange();
  const weekDays = getWorkWeekDays(weekStart);

const dashboardData = isAdmin
  ? await getAdminDashboardData()
  : await getUserDashboardData(currentUser.id);

const { users, attendances } = dashboardData;

  const attendanceByDate = new Map<string, AttendanceBucket>();

  for (const day of weekDays) {
    attendanceByDate.set(day.dateKey, createEmptyBucket());
  }

  for (const attendance of attendances) {
    const dateKey = toDateKey(attendance.date);
    const bucket = attendanceByDate.get(dateKey) ?? createEmptyBucket();

    if (attendance.status === "PRESENT") {
      bucket[attendance.mealType].push(attendance.user.name);
    }

    attendanceByDate.set(dateKey, bucket);
  }

  const totalWeeklyPreferences = users.reduce(
    (total, user) => total + user.weeklyPreferences.length,
    0,
  );

  const totalGeneratedAttendances = attendances.length;

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-zinc-950 p-8 text-right text-zinc-50"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 text-sm text-zinc-400">
                مدیریت حضور وعده‌های غذایی تیم
              </p>

              <h1 className="text-3xl font-bold">داشبورد وعده‌های غذایی</h1>

              <p className="mt-2 text-sm text-zinc-400">
                هفته کاری آینده: {toDateKey(weekStart)} تا{" "}
                {toDateKey(new Date(weekEndExclusive.getTime() - 1))}
              </p>
            </div>

            <div className="text-sm text-zinc-300">
              <p>
                کاربر جاری: <span className="font-semibold">{currentUser.name}</span>
              </p>
              <p>نقش: {roleLabels[currentUser.role]}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              {isAdmin ? (
                <form action={generateNextWeekAttendanceAction}>
                  <button
                    type="submit"
                    className="rounded-xl bg-zinc-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
                  >
                    ساخت حضور هفته کاری آینده
                  </button>
                </form>
              ) : null}

              {isAdmin ? (
                <Link
                  href="/settings/weekly-plan"
                  className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800"
                >
                  تنظیم برنامه هفتگی
                </Link>
              ) : null}
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-100 transition hover:bg-zinc-800"
              >
                خروج از حساب
              </button>
            </form>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">
  {isAdmin ? "اعضای فعال" : "حساب کاربری"}
</p>
<p className="mt-3 text-3xl font-bold">
  {isAdmin ? users.length : "من"}
</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">
  {isAdmin ? "برنامه‌های هفتگی فعال" : "برنامه‌های هفتگی من"}
</p>
<p className="mt-3 text-3xl font-bold">{totalWeeklyPreferences}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">
  {isAdmin ? "حضورهای ساخته‌شده" : "حضورهای من"}
</p>
<p className="mt-3 text-3xl font-bold">{totalGeneratedAttendances}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-semibold">حضور هفته کاری آینده</h2>

            <p className="text-sm text-zinc-400">
              فقط روزهای شنبه تا چهارشنبه نمایش داده می‌شوند.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {weekDays.map((day) => {
              const bucket =
                attendanceByDate.get(day.dateKey) ?? createEmptyBucket();

              return (
                <article
                  key={day.dateKey}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                >
                  <div className="mb-4">
                    <h3 className="font-semibold">{day.label}</h3>
                    <p className="text-sm text-zinc-500">{day.dateKey}</p>
                  </div>

                  <div className="space-y-4">
                    {mealTypes.map((mealType) => {
                      const names = bucket[mealType];

                      return (
                        <div key={mealType}>
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-medium">
                              {mealLabels[mealType]}
                            </p>

                            <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                              {names.length} نفر
                            </span>
                          </div>

                          {names.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {names.map((name) => (
                                <span
                                  key={name}
                                  className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-200"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-500">
                              هنوز کسی ثبت نشده است.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {isAdmin ? (
  <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
    <h2 className="mb-5 text-xl font-semibold">اعضای تیم</h2>

    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <table className="w-full text-right text-sm">
        <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-400">
          <tr>
            <th className="p-4">نام</th>
            <th className="p-4">نام کاربری</th>
            <th className="p-4">نقش</th>
            <th className="p-4">برنامه‌های هفتگی فعال</th>
          </tr>
        </thead>

        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-zinc-800">
              <td className="p-4">{user.name}</td>
              <td className="p-4">{user.username}</td>
              <td className="p-4">{roleLabels[user.role]}</td>
              <td className="p-4">{user.weeklyPreferences.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
) : (
  <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
    <h2 className="mb-3 text-xl font-semibold">اطلاعات حساب من</h2>
    <div className="grid gap-3 text-sm text-zinc-300 md:grid-cols-3">
      <p>نام: {currentUser.name}</p>
      <p>نام کاربری: {currentUser.username}</p>
      <p>نقش: {roleLabels[currentUser.role]}</p>
    </div>
  </section>
)}
  <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
    <h2 className="mb-3 text-xl font-semibold">اطلاعات حساب من</h2>
    <div className="grid gap-3 text-sm text-zinc-300 md:grid-cols-3">
      <p>نام: {currentUser.name}</p>
      <p>نام کاربری: {currentUser.username}</p>
      <p>نقش: {roleLabels[currentUser.role]}</p>
    </div>
  </section>
)
      </div>
    </main>
  );
}
