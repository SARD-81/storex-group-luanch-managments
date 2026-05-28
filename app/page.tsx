import Link from "next/link";
import {
  AttendanceStatus,
  MealType,
  UserRole,
} from "@/app/generated/prisma/client";
import { logoutAction } from "@/actions/auth";
import { updateMyAttendanceAction } from "@/actions/my-attendance";
import { AttendanceDatePicker } from "@/components/attendance/attendance-date-picker";
import { MonthlyAttendanceBoard } from "@/components/attendance/monthly-attendance-board";
import { TehranClock } from "@/components/attendance/tehran-clock";
import { requireUser } from "@/lib/auth/session";
import { MEAL_LABELS, MEAL_TYPES } from "@/lib/attendance/meals";
import { formatPersianWeekdayDate } from "@/lib/date/persian-format";
import { formatPersianDateTime } from "@/lib/date/tehran-time";
import {
  formatUserAdminWeeklyPlan,
  getAdminPlanWindowLabel,
} from "@/lib/attendance/admin-weekly-summary";
import {
  getAdminDashboardData,
  getUserDashboardData,
  resolveSelectedDate,
} from "@/lib/dashboard/get-dashboard-data";
import { ThemeToggle } from "@/components/theme-toggle";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";

const roleLabels = { [UserRole.ADMIN]: "مدیر", [UserRole.USER]: "کاربر" };
type SearchParams = Promise<{ date?: string; error?: string; saved?: string }>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const currentUser = await requireUser();
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const { selectedDate: requestedDate } = await resolveSelectedDate(
    params.date,
  );
  const dashboardData = isAdmin
    ? await getAdminDashboardData(requestedDate)
    : await getUserDashboardData(currentUser.id, requestedDate);
  const {
    users,
    attendances,
    selectedDate,
    selectedDateKey,
    selectedDatePolicy,
    datePickerPolicies,
    canEditSelectedDate,
    deadline,
    weeklyPlanAttendances,
    adminPlanWeekStart,
  } = dashboardData;
  const selectedDateLabel = formatPersianWeekdayDate(selectedDate);
  const adminPlanWindowLabel = getAdminPlanWindowLabel();

  const weeklyPlanAttendancesByUserId = weeklyPlanAttendances.reduce(
    (acc, attendance) => {
      const existing = acc.get(attendance.userId) ?? [];
      existing.push(attendance);
      acc.set(attendance.userId, existing);
      return acc;
    },
    new Map<string, typeof weeklyPlanAttendances>(),
  );

  const mealPresentNames = MEAL_TYPES.reduce(
    (acc, mealType) => {
      acc[mealType] = attendances
        .filter(
          (a) =>
            a.mealType === mealType && a.status === AttendanceStatus.PRESENT,
        )
        .map((a) => a.user.name);
      return acc;
    },
    { [MealType.BREAKFAST]: [] as string[], [MealType.LUNCH]: [] as string[] },
  );

  const myPresentMeals = new Set(
    attendances
      .filter((a) => a.status === AttendanceStatus.PRESENT)
      .map((a) => a.mealType),
  );

  return (
    <main
      dir="rtl"
      className="dashboard-aurora-shell min-h-screen p-6 text-right text-zinc-50 md:p-8"
    >
      <div className="dashboard-aurora dashboard-aurora-one" />
      <div className="dashboard-aurora dashboard-aurora-two" />
      <div className="dashboard-aurora dashboard-aurora-three" />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-8">
        <header className="dashboard-glass-card flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="mb-2 text-sm text-zinc-300">
                مدیریت حضور وعده‌های غذایی تیم
              </p>
              <h1 className="text-3xl font-bold">داشبورد وعده‌های غذایی</h1>
              {/* <p className="mt-2 text-xs text-zinc-300">وضعیت ثبت حضور روزانه شما در یک نمای سازمانی.</p> */}
            </div>
            <div className="dashboard-muted-panel text-sm">
              <p>
                کاربر جاری:{" "}
                <span className="font-semibold">{currentUser.name}</span>
              </p>
              <p>نقش: {roleLabels[currentUser.role]}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <AttendanceDatePicker
                selectedDateKey={selectedDateKey}
                datePickerPolicies={datePickerPolicies}
              />
              <TehranClock />
              <ThemeToggle />
            </div>
            <form action={logoutAction}>
              <PendingSubmitButton
                className="dashboard-action-button"
                pendingText="در حال خروج..."
              >
                خروج از حساب
              </PendingSubmitButton>
            </form>
          </div>

          <div className="dashboard-muted-panel space-y-2 text-xs text-zinc-200">
            {selectedDatePolicy.calendarDay ? (
              <>
                {selectedDatePolicy.holidayTitle ? (
                  <p>تعطیلی/مناسبت رسمی: {selectedDatePolicy.holidayTitle}</p>
                ) : null}
                {selectedDatePolicy.calendarDay.events.length > 0 ? (
                  <div className="space-y-1">
                    <p>مناسبت‌های این روز:</p>
                    <ul className="flex flex-wrap gap-2">
                      {selectedDatePolicy.calendarDay.events.map((event) => (
                        <li
                          key={`${event.displayOrder}-${event.title}`}
                          className="rounded-full border border-white/10 bg-white/10 px-2 py-1"
                        >
                          {event.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {selectedDatePolicy.isWeeklyOffDay ? <p>تعطیلی هفتگی</p> : null}
                {!selectedDatePolicy.isSelectable ? (
                  <p className="text-amber-300">
                    این تاریخ برای ثبت حضور قابل انتخاب نیست.
                  </p>
                ) : null}
              </>
            ) : (
              <p>اطلاعات تقویمی این تاریخ در سامانه موجود نیست.</p>
            )}
          </div>
        </header>

        {isAdmin ? (
          <>
            <section className="grid gap-4 md:grid-cols-2">
              {MEAL_TYPES.map((mealType) => {
                const names = mealPresentNames[mealType];
                return (
                  <article key={mealType} className="dashboard-glass-card">
                    <h2 className="text-lg font-semibold">
                      {MEAL_LABELS[mealType]}
                    </h2>
                    <p className="mt-2 text-sm text-zinc-300">
                      تاریخ انتخاب‌شده: {selectedDateLabel}
                    </p>
                    <p className="mt-3 text-2xl font-bold">
                      {names.length} نفر
                    </p>
                    {names.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {names.map((name) => (
                          <span
                            key={`${mealType}-${name}`}
                            className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-zinc-100"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-zinc-300">
                        هنوز کسی ثبت نشده است.
                      </p>
                    )}
                  </article>
                );
              })}
            </section>

            <section className="dashboard-glass-card">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">اعضای تیم</h2>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/settings/weekly-plan"
                    className="dashboard-action-button"
                  >
                    تنظیم برنامه هفتگی
                  </Link>
                  <Link
                    href="/settings/users"
                    className="dashboard-action-button"
                  >
                    مدیریت کاربران
                  </Link>
                  <Link href="/reports" className="dashboard-action-button">
                    گزارش‌ها
                  </Link>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-right text-sm">
                  <thead className="border-b border-white/10 bg-white/5 text-zinc-300">
                    <tr>
                      <th className="p-4">نام</th>
                      <th className="p-4">نام کاربری</th>
                      <th className="p-4">نقش</th>
                      <th className="p-4">{adminPlanWindowLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-white/10">
                        <td className="p-4">{user.name}</td>
                        <td className="p-4">{user.username}</td>
                        <td className="p-4">{roleLabels[user.role]}</td>
                        <td className="p-4">
                          {formatUserAdminWeeklyPlan({
                            weeklyAttendances:
                              weeklyPlanAttendancesByUserId.get(user.id) ?? [],
                            weeklyPreferences: user.weeklyPreferences,
                            weekStart: adminPlanWeekStart,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="dashboard-glass-card relative z-10">
              <h2 className="mb-4 text-xl font-semibold">
                حضور من در تاریخ انتخاب‌شده
              </h2>
              <form action={updateMyAttendanceAction} className="space-y-4">
                <input type="hidden" name="date" value={selectedDateKey} />
                {MEAL_TYPES.map((mealType) => (
                  <label
                    key={mealType}
                    className="dashboard-muted-panel flex items-center justify-between text-sm"
                  >
                    <span>{MEAL_LABELS[mealType]}</span>
                    <input
                      className="dashboard-checkbox"
                      type="checkbox"
                      name={`meal:${mealType}`}
                      defaultChecked={myPresentMeals.has(mealType)}
                      disabled={!canEditSelectedDate}
                    />
                  </label>
                ))}
                {!canEditSelectedDate ? (
                  <p className="text-sm text-amber-300">
                    مهلت تغییر این تاریخ گذشته است.
                  </p>
                ) : null}
                {canEditSelectedDate ? (
                  <PendingSubmitButton
                    className="dashboard-primary-button"
                    pendingText="در حال ذخیره..."
                  >
                    ذخیره وضعیت حضور
                  </PendingSubmitButton>
                ) : null}
                <p className="text-xs text-zinc-300">
                  مهلت این تاریخ: {formatPersianDateTime(deadline)}
                </p>
              </form>
            </section>
            <MonthlyAttendanceBoard userId={currentUser.id} />
          </>
        )}
      </div>
    </main>
  );
}
