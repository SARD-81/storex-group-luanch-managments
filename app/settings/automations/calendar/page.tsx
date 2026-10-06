import Link from "next/link";
import { EmergencyCalendarForm } from "@/components/automations/emergency-calendar-form";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getAutomationConfig } from "@/lib/automation/config";
import {
  buildBaseJalaliYearDays,
  getJalaliPartsFromUtcDate,
} from "@/lib/calendar/calendar-date";
import {
  getTehranDateKey,
  formatPersianDateTime,
} from "@/lib/date/tehran-time";
import { AnnualDataset } from "@/lib/calendar/datasets";
import {
  AutomationNotice,
  AutomationShell,
  STATUS_LABELS,
} from "@/components/automations/admin-shell";
import { JobHistory } from "@/components/automations/job-history";
import {
  applyCalendarDatasetAction,
  queueAutomationJobAction,
  updateAutomationConfigAction,
} from "@/actions/automations";
export const dynamic = "force-dynamic";
const MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    saved?: string;
    year?: string;
    preview?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const current = getJalaliPartsFromUtcDate(
    new Date(getTehranDateKey() + "T00:00:00Z"),
  );
  const input = Number(params.year ?? current.year + 1),
    year =
      Number.isInteger(input) && input >= 1200 && input <= 1700
        ? input
        : current.year + 1;
  const [c, jobs, datasets, artifacts, preview] = await Promise.all([
    getAutomationConfig(prisma),
    prisma.automationJobRun.findMany({
      where: { jobType: { startsWith: "CALENDAR" } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.calendarDataset.findMany({
      where: { year },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.automationArtifact.findMany({
      where: { target: String(year), type: { not: "REPORT_PDF" } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    params.preview
      ? prisma.calendarDataset.findUnique({ where: { id: params.preview } })
      : null,
  ]);
  const validPreview = preview?.year === year ? preview : null,
    data = validPreview?.payload as AnnualDataset | undefined,
    days = buildBaseJalaliYearDays(year);
  return (
    <AutomationShell title="اتوماسیون تقویم و تعطیلات اضطراری">
      <AutomationNotice {...params} />
      <section className="dashboard-glass-card">
        <p>
          دریافت سال بعد از ۱ اسفند، روزانه و بر اساس تقویم تهران انجام می‌شود.
          تغییر منبع سال فعال یا جایگزینی تقویم اضطراری به تأیید مدیر نیاز دارد.
        </p>
        <p className="mt-2 text-amber-500">
          parser رسمی هنوز با PDF واقعی و دادهٔ مرجع ۱۴۰۵ تأیید نشده است؛ تا
          پایان این اعتبارسنجی، import خودکار متوقف می‌ماند.
        </p>
        <form action={updateAutomationConfigAction} className="mt-4 grid gap-3">
          <input type="hidden" name="scope" value="calendar" />
          <label>
            <input
              type="checkbox"
              name="calendarEnabled"
              defaultChecked={c.calendarEnabled}
            />{" "}
            فعال‌بودن دریافت خودکار تقویم
          </label>
          <label>
            نشانی منبع جایگزین تأییدشده (خالی = کشف از سایت رسمی)
            <input
              name="calendarSourceOverride"
              defaultValue={c.calendarSourceOverride}
              maxLength={1000}
              dir="ltr"
              className="dashboard-muted-panel mt-2 w-full"
            />
          </label>
          <button className="dashboard-primary-button">ذخیرهٔ تنظیمات</button>
        </form>
      </section>
      <section className="dashboard-glass-card">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label>
            سال جلالی
            <input
              type="number"
              name="year"
              min={1200}
              max={1700}
              defaultValue={year}
              className="dashboard-muted-panel mr-2 w-28"
            />
          </label>
          <button className="dashboard-action-button">نمایش سال</button>
        </form>
        <div className="mt-4 flex flex-wrap gap-3">
          {[
            ["CALENDAR_DRY_RUN", "پیش‌آزمون دریافت و اعتبارسنجی"],
            ["CALENDAR_IMPORT", "اجرای دریافت اکنون"],
          ].map(([type, label]) => (
            <form key={type} action={queueAutomationJobAction}>
              <input type="hidden" name="jobType" value={type} />
              <input type="hidden" name="year" value={year} />
              <button className="dashboard-action-button">{label}</button>
            </form>
          ))}
        </div>
      </section>
      {validPreview && data ? (
        <section className="dashboard-glass-card">
          <h2 className="text-lg font-bold">پیش‌نمایش تقویم {year}</h2>
          <p>
            {data.events.length} رویداد — منبع:{" "}
            <code>{validPreview.sourceName}</code> — وضعیت:{" "}
            {STATUS_LABELS[validPreview.status] ?? validPreview.status}
          </p>
          <details className="my-3" open>
            <summary>اختلاف‌ها و اثر بر روزهای کاری</summary>
            <pre
              dir="ltr"
              className="overflow-auto whitespace-pre-wrap rounded-xl border border-border p-3 text-xs"
            >
              {JSON.stringify(validPreview.diff, null, 2)}
            </pre>
          </details>
          <details>
            <summary>تاریخ‌ها و عنوان‌ها</summary>
            <ul>
              {data.events.map((e) => (
                <li key={e.eventKey}>
                  {e.jalaliDateKey} — {e.title}
                  {e.isHoliday ? " (تعطیل)" : ""}
                </li>
              ))}
            </ul>
          </details>
          {validPreview.status !== "VERIFIED" ? (
            <form
              action={applyCalendarDatasetAction}
              className="mt-4 space-y-3"
            >
              <input type="hidden" name="datasetId" value={validPreview.id} />
              <label className="block">
                <input type="checkbox" name="confirmDiff" required /> اختلاف‌ها
                را بررسی کردم و اعمال این مجموعه را تأیید می‌کنم.
              </label>
              {data.mode === "OFFICIAL" ? (
                <label className="block">
                  <input type="checkbox" name="replaceFallback" /> جایگزینی منبع
                  اضطراری همین سال با منبع رسمی را تأیید می‌کنم.
                </label>
              ) : null}
              <button className="dashboard-primary-button">
                اعمال مجموعهٔ تأییدشده
              </button>
            </form>
          ) : null}
        </section>
      ) : null}
      <section className="dashboard-glass-card">
        <h2 className="text-lg font-bold">ویرایش یک‌جای تعطیلات رسمی {year}</h2>
        <p className="my-3 text-sm">
          این مجموعه منبع مستقل «تقویم رسمی اضطراری» دارد. اعمال آن، overrideهای
          دستی و رویدادهای منابع دیگر را نگه می‌دارد. فقط همین مجموعهٔ اضطراری
          سال جایگزین می‌شود؛ ابتدا پیش‌نمایش و اختلاف‌ها را بررسی کنید.
        </p>
        <EmergencyCalendarForm>
          <input type="hidden" name="year" value={year} />
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
            {MONTHS.map((month, i) => (
              <fieldset key={month} className="dashboard-muted-panel">
                <legend className="px-2 font-semibold">{month}</legend>
                <div className="grid grid-cols-7 gap-1 text-center text-sm">
                  {days
                    .filter((d) => d.jalaliMonth === i + 1)
                    .map((d, index) => (
                      <label
                        key={d.dateKey}
                        title={`${d.jalaliDateKey} — ${d.dayNameFa}`}
                        style={
                          index === 0
                            ? { gridColumnStart: d.dayOfWeek + 1 }
                            : undefined
                        }
                        className="flex flex-col items-center rounded p-1 hover:bg-muted"
                      >
                        <span>{d.jalaliDay}</span>
                        <input
                          type="checkbox"
                          name="selectedDates"
                          value={d.jalaliDateKey}
                          aria-label={`${d.jalaliDateKey} ${d.dayNameFa}`}
                        />
                      </label>
                    ))}
                </div>
              </fieldset>
            ))}
          </div>
          <label className="block text-sm">
            ورودی چندخطی یا CSV — هر خط یک تاریخ و عنوان
            <textarea
              name="holidayText"
              rows={8}
              maxLength={1048576}
              placeholder={`${year}-01-01 | نوروز\n${year}/01/02 | نوروز\nیا CSV با سرستون jalali_date,title,is_official_holiday`}
              className="dashboard-muted-panel mt-2 w-full"
            />
          </label>
          <label className="block text-sm">
            فایل CSV (حداکثر ۱ مگابایت)
            <input
              type="file"
              name="csv"
              accept=".csv,text/csv"
              className="mr-3"
            />
          </label>
          <p className="text-sm">
            ارقام فارسی و انگلیسی پذیرفته می‌شود. ردیف‌های یکسان ادغام می‌شوند؛
            عنوان متفاوت برای یک تاریخ رد می‌شود. برای تاریخ انتخاب‌شده از جدول
            عنوان «تعطیل رسمی» ثبت می‌شود.
          </p>
        </EmergencyCalendarForm>
      </section>
      <section className="dashboard-glass-card">
        <h2 className="mb-3 text-lg font-bold">مجموعه‌ها و منابع سال {year}</h2>
        {datasets.map((d) => (
          <p key={d.id} className="border-t border-border py-3">
            <Link href={`?year=${year}&preview=${d.id}`} className="underline">
              {d.sourceName} — {STATUS_LABELS[d.status] ?? d.status}
            </Link>
            <br />
            <small>
              {formatPersianDateTime(d.createdAt)} — <code>{d.sourceHash}</code>
            </small>
          </p>
        ))}
      </section>
      <section className="dashboard-glass-card">
        <h2 className="mb-3 text-lg font-bold">فایل‌های تشخیصی و artifactها</h2>
        {artifacts.map((a) => (
          <p key={a.id} className="border-t border-border py-3">
            <Link
              href={`/settings/automations/artifacts/${a.id}`}
              className="underline"
            >
              {a.type} — {formatPersianDateTime(a.createdAt)}
            </Link>{" "}
            —{" "}
            {a.uploadState === "UPLOADED"
              ? "در Nextcloud ذخیره شده"
              : "در انتظار همگام‌سازی"}
            <br />
            <code>{a.sha256}</code>
          </p>
        ))}
      </section>
      <JobHistory jobs={jobs} />
    </AutomationShell>
  );
}
