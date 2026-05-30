import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import {
  applyForcedWorkdayOverrideAction,
  applyManualHolidayOverrideAction,
  clearCalendarOverrideAction,
} from "@/actions/calendar-overrides";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCalendarDayOverrideStatus } from "@/lib/calendar/calendar-override-service";
import { getCalendarDayByDateKey } from "@/lib/calendar/calendar-service";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type CalendarOverridesSearchParams = Promise<{
  date?: string;
  error?: string;
  success?: string;
}>;

type CalendarOverrideFeedback = {
  tone: "error" | "success";
  message: string;
};

const booleanLabel = (value: boolean) => (value ? "بله" : "خیر");

function getFeedback(
  error: string | undefined,
  success: string | undefined,
): CalendarOverrideFeedback | null {
  if (error === "invalid-input") {
    return {
      tone: "error",
      message:
        "ورودی نامعتبر است. تاریخ باید YYYY-MM-DD باشد و عنوان نباید خالی باشد.",
    };
  }

  if (success === "manual-holiday") {
    return { tone: "success", message: "تعطیلی دستی اعمال شد." };
  }

  if (success === "forced-workday") {
    return { tone: "success", message: "روز کاری اجباری اعمال شد." };
  }

  if (success === "cleared") {
    return { tone: "success", message: "Override پاک شد." };
  }

  return null;
}

export default async function CalendarOverridesPage({
  searchParams,
}: {
  searchParams: CalendarOverridesSearchParams;
}) {
  await requireAdmin();
  noStore();

  const params = await searchParams;
  const selectedDateKey =
    typeof params.date === "string" && DATE_KEY_PATTERN.test(params.date)
      ? params.date
      : "";
  const [calendarDay, overrideStatus] = selectedDateKey
    ? await Promise.all([
        getCalendarDayByDateKey(prisma, selectedDateKey),
        getCalendarDayOverrideStatus(prisma, selectedDateKey),
      ])
    : [null, null];
  const feedback = getFeedback(params.error, params.success);

  return (
    <main
      dir="rtl"
      className="dashboard-aurora-shell min-h-screen p-6 text-right text-zinc-50 md:p-8"
    >
      <div className="dashboard-aurora dashboard-aurora-one" />
      <div className="dashboard-aurora dashboard-aurora-two" />
      <div className="dashboard-aurora dashboard-aurora-three" />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6">
        <header className="dashboard-glass-card flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-300">
                در این صفحه می‌توانید برای موارد خاص شرکت، یک تاریخ را تعطیل
                دستی یا روز کاری اجباری کنید.
              </p>
              <h1 className="mt-1 text-3xl font-bold">
                مدیریت Override تقویم
              </h1>
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

        <section className="dashboard-muted-panel border border-amber-300/30 bg-amber-500/10 text-sm text-amber-100">
          این تغییرات روی CalendarDay.isWorkday اثر می‌گذارند و بنابراین ثبت
          حضور، DatePicker، گزارش‌ها و نمایش ماهانه را تحت تأثیر قرار می‌دهند.
        </section>

        <section className="dashboard-glass-card space-y-4">
          <form
            action="/settings/calendar-overrides"
            method="GET"
            className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end"
          >
            <label className="flex flex-col gap-2 text-sm text-zinc-200">
              dateKey میلادی
              <input
                name="date"
                placeholder="YYYY-MM-DD"
                defaultValue={selectedDateKey}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-left text-zinc-50 outline-none transition focus:border-emerald-300/60"
                dir="ltr"
              />
            </label>
            <button type="submit" className="dashboard-action-button">
              بررسی تاریخ
            </button>
          </form>

          {feedback ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                feedback.tone === "error"
                  ? "border-rose-300/30 bg-rose-500/10 text-rose-100"
                  : "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
              }`}
            >
              {feedback.message}
            </div>
          ) : null}
        </section>

        {!selectedDateKey ? (
          <section className="dashboard-muted-panel text-sm text-zinc-300">
            برای شروع، یک dateKey میلادی مثل 2026-03-25 وارد کنید.
          </section>
        ) : null}

        {selectedDateKey && !calendarDay ? (
          <section className="dashboard-glass-card text-sm text-zinc-200">
            برای این تاریخ، CalendarDay در سامانه وجود ندارد.
          </section>
        ) : null}

        {calendarDay ? (
          <section className="dashboard-glass-card space-y-6">
            <div>
              <h2 className="text-xl font-semibold">جزئیات تاریخ</h2>
              <p className="mt-2 text-sm text-zinc-300">
                Override فعلی: {overrideStatus?.overrideType ?? "بدون override"}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div className="dashboard-muted-panel">
                <p className="text-xs text-zinc-400">dateKey</p>
                <p className="mt-1 font-semibold" dir="ltr">
                  {calendarDay.dateKey}
                </p>
              </div>
              <div className="dashboard-muted-panel">
                <p className="text-xs text-zinc-400">jalaliDateKey</p>
                <p className="mt-1 font-semibold" dir="ltr">
                  {calendarDay.jalaliDateKey}
                </p>
              </div>
              <div className="dashboard-muted-panel">
                <p className="text-xs text-zinc-400">dayNameFa</p>
                <p className="mt-1 font-semibold">{calendarDay.dayNameFa}</p>
              </div>
              <div className="dashboard-muted-panel">
                <p className="text-xs text-zinc-400">isWorkday</p>
                <p className="mt-1 font-semibold">
                  {booleanLabel(calendarDay.isWorkday)}
                </p>
              </div>
              <div className="dashboard-muted-panel">
                <p className="text-xs text-zinc-400">isWeeklyOffDay</p>
                <p className="mt-1 font-semibold">
                  {booleanLabel(calendarDay.isWeeklyOffDay)}
                </p>
              </div>
              <div className="dashboard-muted-panel">
                <p className="text-xs text-zinc-400">isOfficialHoliday</p>
                <p className="mt-1 font-semibold">
                  {booleanLabel(calendarDay.isOfficialHoliday)}
                </p>
              </div>
              <div className="dashboard-muted-panel">
                <p className="text-xs text-zinc-400">isManualHoliday</p>
                <p className="mt-1 font-semibold">
                  {booleanLabel(calendarDay.isManualHoliday)}
                </p>
              </div>
              <div className="dashboard-muted-panel">
                <p className="text-xs text-zinc-400">isForcedWorkday</p>
                <p className="mt-1 font-semibold">
                  {booleanLabel(calendarDay.isForcedWorkday)}
                </p>
              </div>
              <div className="dashboard-muted-panel">
                <p className="text-xs text-zinc-400">holidayTitle</p>
                <p className="mt-1 font-semibold">
                  {calendarDay.holidayTitle ?? "—"}
                </p>
              </div>
            </div>

            <div className="dashboard-muted-panel space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">مناسبت‌ها</h3>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-zinc-200">
                  تعداد: {calendarDay.events.length}
                </span>
              </div>
              {calendarDay.events.length > 0 ? (
                <ul className="flex flex-wrap gap-2 text-sm text-zinc-200">
                  {calendarDay.events.map((event) => (
                    <li
                      key={`${event.displayOrder}-${event.title}`}
                      className="rounded-full border border-white/10 bg-white/10 px-3 py-1"
                    >
                      {event.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-400">مناسبتی ثبت نشده است.</p>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <form
                action={applyManualHolidayOverrideAction}
                className="dashboard-muted-panel space-y-3"
              >
                <input type="hidden" name="dateKey" value={selectedDateKey} />
                <h3 className="font-semibold">تعطیلی دستی</h3>
                <input
                  name="title"
                  defaultValue="تعطیلی دستی شرکت"
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-zinc-50 outline-none transition focus:border-emerald-300/60"
                />
                <textarea
                  name="description"
                  className="min-h-28 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-zinc-50 outline-none transition focus:border-emerald-300/60"
                />
                <button type="submit" className="dashboard-action-button w-full">
                  اعمال تعطیلی دستی
                </button>
              </form>

              <form
                action={applyForcedWorkdayOverrideAction}
                className="dashboard-muted-panel space-y-3"
              >
                <input type="hidden" name="dateKey" value={selectedDateKey} />
                <h3 className="font-semibold">روز کاری اجباری</h3>
                <input
                  name="title"
                  defaultValue="روز کاری اجباری شرکت"
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-zinc-50 outline-none transition focus:border-emerald-300/60"
                />
                <textarea
                  name="description"
                  className="min-h-28 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-zinc-50 outline-none transition focus:border-emerald-300/60"
                />
                <button type="submit" className="dashboard-action-button w-full">
                  اعمال روز کاری اجباری
                </button>
              </form>

              <form
                action={clearCalendarOverrideAction}
                className="dashboard-muted-panel flex flex-col gap-3"
              >
                <input type="hidden" name="dateKey" value={selectedDateKey} />
                <h3 className="font-semibold">پاک کردن Override</h3>
                <p className="text-sm text-zinc-300">
                  این عملیات Override موجود این تاریخ را حذف می‌کند و وضعیت کاری
                  را بر اساس تعطیلی رسمی و تعطیلی هفتگی بازمی‌گرداند.
                </p>
                <button type="submit" className="dashboard-action-button mt-auto">
                  پاک کردن Override
                </button>
              </form>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
