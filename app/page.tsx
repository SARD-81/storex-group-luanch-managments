import { MealType } from "@/app/generated/prisma/client";
import { generateNextWeekAttendanceAction } from "@/actions/attendance";
import {
  getNextWorkWeekRange,
  getWorkWeekDays,
  toDateKey,
} from "@/lib/attendance/week";
import { prisma } from "@/lib/prisma";

const mealLabels = {
  [MealType.BREAKFAST]: "صبحانه",
  [MealType.LUNCH]: "ناهار",
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
  const { weekStart, weekEndExclusive } = getNextWorkWeekRange();
  const weekDays = getWorkWeekDays(weekStart);

  const [users, attendances] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
      },
      include: {
        weeklyPreferences: {
          where: {
            isEnabled: true,
            dayOfWeek: {
              gte: 0,
              lte: 4,
            },
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.mealAttendance.findMany({
      where: {
        date: {
          gte: weekStart,
          lt: weekEndExclusive,
        },
      },
      include: {
        user: true,
      },
      orderBy: [
        {
          date: "asc",
        },
        {
          mealType: "asc",
        },
      ],
    }),
  ]);

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
        <header className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 md:flex-row md:items-center md:justify-between">
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

          <form action={generateNextWeekAttendanceAction}>
            <button
              type="submit"
              className="rounded-xl bg-zinc-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
            >
              ساخت حضور هفته کاری آینده
            </button>
          </form>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">اعضای فعال</p>
            <p className="mt-3 text-3xl font-bold">{users.length}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">برنامه‌های هفتگی فعال</p>
            <p className="mt-3 text-3xl font-bold">{totalWeeklyPreferences}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">حضورهای ساخته‌شده</p>
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

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-5 text-xl font-semibold">اعضای تیم</h2>

          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <table className="w-full text-right text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-400">
                <tr>
                  <th className="p-4">نام</th>
                  <th className="p-4">ایمیل</th>
                  <th className="p-4">برنامه‌های هفتگی فعال</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-zinc-800">
                    <td className="p-4">{user.name}</td>
                    <td className="p-4">{user.email}</td>
                    <td className="p-4">{user.weeklyPreferences.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}