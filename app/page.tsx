import Link from "next/link";
import { AttendanceStatus, MealType, UserRole } from "@/app/generated/prisma/client";
import { generateNextWeekAttendanceAction } from "@/actions/attendance";
import { logoutAction } from "@/actions/auth";
import { updateMyAttendanceAction } from "@/actions/my-attendance";
import { AttendanceDatePicker } from "@/components/attendance/attendance-date-picker";
import { TehranClock } from "@/components/attendance/tehran-clock";
import { requireUser } from "@/lib/auth/session";
import { MEAL_LABELS, MEAL_TYPES } from "@/lib/attendance/meals";
import { formatPersianDateTime } from "@/lib/date/tehran-time";
import {
  getAdminDashboardData,
  getUserDashboardData,
  resolveSelectedDate,
} from "@/lib/dashboard/get-dashboard-data";

const roleLabels = {
  [UserRole.ADMIN]: "مدیر",
  [UserRole.USER]: "کاربر",
};

type SearchParams = Promise<{ date?: string; error?: string; saved?: string }>;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const currentUser = await requireUser();
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const { selectedDate } = resolveSelectedDate(params.date);

  const dashboardData = isAdmin
    ? await getAdminDashboardData(selectedDate)
    : await getUserDashboardData(currentUser.id, selectedDate);

  const { users, attendances, selectedDateKey, canEditSelectedDate, deadline } = dashboardData;

  const mealPresentNames = MEAL_TYPES.reduce(
    (acc, mealType) => {
      acc[mealType] = attendances
        .filter((a) => a.mealType === mealType && a.status === AttendanceStatus.PRESENT)
        .map((a) => a.user.name);
      return acc;
    },
    {
      [MealType.BREAKFAST]: [] as string[],
      [MealType.LUNCH]: [] as string[],
    },
  );

  const myPresentMeals = new Set(
    attendances.filter((a) => a.status === AttendanceStatus.PRESENT).map((a) => a.mealType),
  );

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-950 p-8 text-right text-zinc-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 text-sm text-zinc-400">مدیریت حضور وعده‌های غذایی تیم</p>
              <h1 className="text-3xl font-bold">داشبورد وعده‌های غذایی</h1>
            </div>
            <div className="text-sm text-zinc-300">
              <p>کاربر جاری: <span className="font-semibold">{currentUser.name}</span></p>
              <p>نقش: {roleLabels[currentUser.role]}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <AttendanceDatePicker selectedDateKey={selectedDateKey} />
              <TehranClock />
            </div>

            <form action={logoutAction}>
              <button type="submit" className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-100 transition hover:bg-zinc-800">
                خروج از حساب
              </button>
            </form>
          </div>

          {params.error === "deadline" ? <p className="text-sm text-red-400">مهلت ثبت یا تغییر حضور برای این تاریخ گذشته است.</p> : null}
          {params.error === "invalid-date" ? <p className="text-sm text-red-400">تاریخ انتخاب‌شده معتبر نیست.</p> : null}
          {params.saved === "1" ? <p className="text-sm text-emerald-400">وضعیت حضور شما ذخیره شد.</p> : null}
        </header>

        {isAdmin ? (
          <>
            <section className="grid gap-4 md:grid-cols-2">
              {MEAL_TYPES.map((mealType) => {
                const names = mealPresentNames[mealType];
                return (
                  <article key={mealType} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                    <h2 className="text-lg font-semibold">{MEAL_LABELS[mealType]}</h2>
                    <p className="mt-2 text-sm text-zinc-400">تاریخ انتخاب‌شده: {selectedDateKey}</p>
                    <p className="mt-3 text-2xl font-bold">{names.length} نفر</p>
                    {names.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {names.map((name) => (
                          <span key={`${mealType}-${name}`} className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-200">{name}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-zinc-500">هنوز کسی ثبت نشده است.</p>
                    )}
                  </article>
                );
              })}
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">اعضای تیم</h2>
                <div className="flex flex-wrap gap-3">
                  <form action={generateNextWeekAttendanceAction}>
                    <button type="submit" className="rounded-xl bg-zinc-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200">ساخت حضور هفته کاری آینده</button>
                  </form>
                  <Link href="/settings/weekly-plan" className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800">تنظیم برنامه هفتگی</Link>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-zinc-800">
                <table className="w-full text-right text-sm">
                  <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-400"><tr><th className="p-4">نام</th><th className="p-4">نام کاربری</th><th className="p-4">نقش</th><th className="p-4">برنامه‌های هفتگی فعال</th></tr></thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-zinc-800"><td className="p-4">{user.name}</td><td className="p-4">{user.username}</td><td className="p-4">{roleLabels[user.role]}</td><td className="p-4">{user.weeklyPreferences.length}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 text-xl font-semibold">حضور من در تاریخ انتخاب‌شده</h2>
            <form action={updateMyAttendanceAction} className="space-y-4">
              <input type="hidden" name="date" value={selectedDateKey} />

              {MEAL_TYPES.map((mealType) => (
                <label key={mealType} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name={`meal:${mealType}`}
                    defaultChecked={myPresentMeals.has(mealType)}
                    disabled={!canEditSelectedDate}
                  />
                  <span>{MEAL_LABELS[mealType]}</span>
                </label>
              ))}

              {!canEditSelectedDate ? (
                <p className="text-sm text-amber-300">مهلت تغییر این تاریخ گذشته است.</p>
              ) : null}

              {canEditSelectedDate ? (
                <button type="submit" className="rounded-xl bg-zinc-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200">ذخیره وضعیت حضور</button>
              ) : null}

              <p className="text-xs text-zinc-500">مهلت این تاریخ: {formatPersianDateTime(deadline)}</p>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
