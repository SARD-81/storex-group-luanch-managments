import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AttendanceStatus,
  MealType,
  UserRole,
} from "@/app/generated/prisma/client";
import { logoutAction } from "@/actions/auth";
import { AttendanceDatePicker } from "@/components/attendance/attendance-date-picker";
import { MonthlyAttendanceBoard } from "@/components/attendance/monthly-attendance-board";
import { TehranClock } from "@/components/attendance/tehran-clock";
import { isReporterRole, ROLE_LABELS } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { MEAL_LABELS, MEAL_TYPES } from "@/lib/attendance/meals";
import { formatPersianWeekdayDate } from "@/lib/date/persian-format";
import { formatUserAdminWeeklyPlan } from "@/lib/attendance/admin-weekly-summary";
import {
  getAdminDashboardData,
  getUserDashboardData,
  resolveSelectedDate,
} from "@/lib/dashboard/get-dashboard-data";
import { ThemeToggle } from "@/components/theme-toggle";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { UserAvatar } from "@/components/user/user-avatar";

type SearchParams = Promise<{ date?: string; error?: string; saved?: string }>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const currentUser = await requireUser();

  if (isReporterRole(currentUser.role)) {
    redirect("/reporter/next-day");
  }

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
    weeklyPlanAttendances,
    adminPlanWeekStart,
  } = dashboardData;
  const { adminPlanWindowLabel, adminCalendarPlanDays } =
    "adminPlanWindowLabel" in dashboardData
      ? dashboardData
      : { adminPlanWindowLabel: "", adminCalendarPlanDays: undefined };
  const selectedDateLabel = formatPersianWeekdayDate(selectedDate);

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

  return (
    <main
      dir="rtl"
      className="dashboard-aurora-shell min-h-screen p-6 text-right text-foreground md:p-8"
    >
      <div className="dashboard-aurora dashboard-aurora-one" />
      <div className="dashboard-aurora dashboard-aurora-two" />
      <div className="dashboard-aurora dashboard-aurora-three" />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-8">
        <header className="dashboard-glass-card flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="mb-2 text-sm text-muted-foreground">
                مدیریت حضور وعده‌های غذایی تیم
              </p>
              <h1 className="text-3xl font-bold">داشبورد وعده‌های غذایی</h1>
              {/* <p className="mt-2 text-xs text-muted-foreground">وضعیت ثبت حضور روزانه شما در یک نمای سازمانی.</p> */}
            </div>
            <div className="dashboard-muted-panel flex items-center gap-3 text-sm">
              <UserAvatar
                user={{
                  id: currentUser.id,
                  name: currentUser.name,
                  avatarUpdatedAt: currentUser.avatarUpdatedAt,
                }}
                size="md"
              />
              <div className="space-y-1">
                <p>
                  کاربر جاری:{" "}
                  <span className="font-semibold">{currentUser.name}</span>
                </p>
                <p>نقش: {ROLE_LABELS[currentUser.role]}</p>
                <a
                  href="/profile"
                  className="text-xs font-semibold text-sky-600 transition hover:text-sky-500 dark:text-sky-300 dark:hover:text-sky-200"
                >
                  ویرایش حساب
                </a>
              </div>
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

          <div className="dashboard-muted-panel space-y-2 text-xs text-muted-foreground">
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
                          className="rounded-full border border-border/60 bg-muted/50 px-2 py-1"
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
                    <p className="mt-2 text-sm text-muted-foreground">
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
                            className="rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-xs text-foreground"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
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
                  <Link
                    href="/settings/calendar-overrides"
                    className="dashboard-action-button"
                  >
                    مدیریت Override تقویم
                  </Link>
                  <Link
                    href="/settings/audit-logs"
                    className="dashboard-action-button"
                  >
                    لاگ ممیزی
                  </Link>
                  <Link href="/reports" className="dashboard-action-button">
                    گزارش‌ها
                  </Link>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full text-right text-sm">
                  <thead className="border-b border-border/60 bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="p-4">نام</th>
                      <th className="p-4">نام کاربری</th>
                      <th className="p-4">نقش</th>
                      <th className="p-4">{adminPlanWindowLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-border/60">
                        <td className="p-4">{user.name}</td>
                        <td className="p-4">{user.username}</td>
                        <td className="p-4">{ROLE_LABELS[user.role]}</td>
                        <td className="p-4">
                          {formatUserAdminWeeklyPlan({
                            weeklyAttendances:
                              weeklyPlanAttendancesByUserId.get(user.id) ?? [],
                            weeklyPreferences: user.weeklyPreferences,
                            weekStart: adminPlanWeekStart,
                            calendarPlanDays: adminCalendarPlanDays,
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
          <MonthlyAttendanceBoard userId={currentUser.id} />
        )}
      </div>
    </main>
  );
}
