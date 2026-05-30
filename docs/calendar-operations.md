# 📅 راهنمای عملیاتی تقویم رسمی ایران در سامانه

این مستند، راهنمای عملیاتی نگهداری و کنترل سیستم تقویم رسمی ایران در سامانه مدیریت وعده‌های غذایی است.

سیستم تقویم سامانه بر پایه یک **Calendar Database داخلی** طراحی شده است تا همه بخش‌های پروژه برای تشخیص روز کاری، تعطیلی رسمی، تعطیلی هفتگی، مناسبت‌های روز و قابل انتخاب بودن تاریخ‌ها از یک منبع حقیقت واحد استفاده کنند.

---

## ۱. هدف سیستم تقویم

هدف این سیستم این است که منطق تاریخ در سامانه از حالت پراکنده و weekday-only خارج شود و همه بخش‌ها به شکل یکپارچه از دیتابیس تقویم استفاده کنند.

Calendar DB در حال حاضر این نیازها را پوشش می‌دهد:

- تشخیص روز کاری نهایی هر تاریخ
- تشخیص تعطیلی رسمی
- تشخیص تعطیلی هفتگی
- ذخیره مناسبت‌های رسمی و غیرتعطیل هر روز
- نمایش مناسبت‌های روز در داشبورد
- جلوگیری از ثبت حضور/غذا در روزهای غیرکاری
- هماهنگی DatePicker با روزهای قابل انتخاب
- هماهنگی Monthly Board با تعطیلی‌ها و مناسبت‌ها
- هماهنگی Weekly Plan display با تعطیلی‌های رسمی
- هماهنگی Reports با روزهای کاری واقعی

---

## ۲. منبع حقیقت سیستم

در پروژه، منبع حقیقت تقویم این جدول‌ها هستند:

```text
CalendarDay
CalendarEvent
CalendarImportBatch
CalendarOverride
```

### CalendarDay

هر رکورد در `CalendarDay` نماینده یک روز تقویمی است.

فیلدهای مهم:

```text
dateKey
jalaliDateKey
jalaliYear
jalaliMonth
jalaliDay
dayOfWeek
dayNameFa
isWeeklyOffDay
isOfficialHoliday
isManualHoliday
isForcedWorkday
isWorkday
holidayTitle
sourceName
sourceVersion
```

قاعده اصلی:

```text
CalendarDay.isWorkday
```

باید منبع نهایی تشخیص روز کاری در کل سامانه باشد.

### CalendarEvent

هر رکورد در `CalendarEvent` نماینده یک مناسبت یا رویداد رسمی/غیررسمی برای یک روز است.

هر روز می‌تواند چند event داشته باشد.

فیلدهای مهم:

```text
eventKey
calendarDayId
title
displayOrder
type
calendarType
isHoliday
isOfficial
referenceDate
sourceName
sourceVersion
sourcePage
sourceSection
```

قاعده اصلی:

```text
CalendarEvent.isHoliday = true
```

یعنی آن event باعث تعطیلی رسمی می‌شود.

اما یک روز ممکن است چند event داشته باشد که بعضی تعطیل هستند و بعضی فقط مناسبت نمایشی هستند.

---

## ۳. وضعیت فعلی سال ۱۴۰۵

دیتاست رسمی سال ۱۴۰۵ از PDF رسمی مرکز تقویم مؤسسه ژئوفیزیک دانشگاه تهران استخراج، normalize، validate و import شده است.

وضعیت مورد انتظار:

```text
CalendarDay rows for jalaliYear 1405: 365
Official CalendarEvent rows: 424
Official holiday events: 31
Official holiday dates: 26
Final workdays: 244
Weekly off-days: 104
```

منبع رسمی import شده:

```text
sourceName = tehran-university-official-calendar-1405
sourceVersion = official-1405-v1
sourceUrl = https://calendar.ut.ac.ir/fa/home
```

---

## ۴. اسکریپت‌های تقویم

اسکریپت‌های مرتبط با تقویم در `package.json` تعریف شده‌اند.

### ساخت سال پایه

```bash
npm run calendar:import-base-year -- --year=1405
```

کاربرد:

- ساخت ۳۶۵ روز پایه برای سال جلالی
- محاسبه تاریخ میلادی متناظر
- تعیین تعطیلی هفتگی
- مقداردهی اولیه `isWorkday`

قبل از اجرای واقعی می‌توان dry-run گرفت:

```bash
npm run calendar:import-base-year -- --year=1405 --dry-run
```

### اعمال تعطیلات ثابت اولیه

```bash
npm run calendar:apply-fixed-holidays -- --year=1405
```

این مرحله قدیمی‌تر است و برای seed اولیه تعطیلات ثابت استفاده شده بود.

بعد از import رسمی کامل سال ۱۴۰۵، eventهای این منبع قدیمی باید حذف شده باشند:

```text
sourceName = internal-fixed-jalali-official-holidays
sourceVersion = fixed-jalali-v1
```

### اعتبارسنجی دیتاست رسمی ۱۴۰۵

```bash
npm run calendar:validate-official-1405
```

این دستور فقط دیتاست TypeScript را validate می‌کند و به دیتابیس وصل نمی‌شود.

انتظار:

```text
Official 1405 calendar event validation passed.
Total events: 424
```

### Import رسمی تقویم ۱۴۰۵

Dry-run:

```bash
npm run calendar:import-official-1405 -- --year=1405 --dry-run
```

اجرای واقعی:

```bash
npm run calendar:import-official-1405 -- --year=1405
```

این دستور:

- ۴۲۴ مناسبت رسمی را وارد `CalendarEvent` می‌کند
- eventهای قدیمی fixed-holidays را حذف می‌کند
- `CalendarDay.isOfficialHoliday` را به‌روزرسانی می‌کند
- `CalendarDay.holidayTitle` را می‌سازد
- `CalendarDay.isWorkday` را دوباره محاسبه می‌کند
- یک `CalendarImportBatch` ثبت می‌کند

این import باید idempotent باشد؛ یعنی اجرای دوباره آن نباید duplicate event بسازد.

---

## ۵. Smoke Testهای تقویم

بعد از هر تغییر مهم در سیستم تقویم، این تست‌ها باید اجرا شوند:

```bash
npm run calendar:validate-official-1405
npm run calendar:check-service
npm run calendar:check-attendance-policy
npm run calendar:check-dashboard-integration
npm run calendar:check-weekly-plan
npm run calendar:check-reports
```

### calendar:check-service

بررسی می‌کند که Calendar Service بتواند داده‌های واقعی `CalendarDay` و `CalendarEvent` را بخواند.

موارد مهم تست‌شده:

- امروز ایران
- چند تعطیلی رسمی حساس
- چند روز با چند مناسبت
- یک ماه کامل
- `isWorkday`

### calendar:check-attendance-policy

بررسی می‌کند که policy ثبت حضور/غذا براساس Calendar DB کار کند.

موارد مهم تست‌شده:

- روز تعطیل رسمی قابل انتخاب نیست
- روز کاری قابل انتخاب است
- تعطیلی هفتگی قابل انتخاب نیست
- خارج از بازه قابل انتخاب نیست

### calendar:check-dashboard-integration

بررسی می‌کند که Dashboard، DatePicker و Monthly Board از policy تقویمی درست استفاده کنند.

### calendar:check-weekly-plan

بررسی می‌کند که weekly plan window از Calendar DB روزهای کاری و غیرکاری را درست تشخیص دهد.

### calendar:check-reports

بررسی می‌کند که reportها فقط روزهای کاری واقعی Calendar DB را وارد گزارش کنند و تعطیلات رسمی/هفتگی را از شمارش حذف کنند.

---

## ۶. Regression کامل بعد از تغییرات تقویم

بعد از هر تغییر جدی در سیستم تقویم، این مجموعه دستورات باید اجرا شود:

```bash
git status
npm run prisma:validate
npx tsc --noEmit

npm run calendar:validate-official-1405
npm run calendar:check-service
npm run calendar:check-attendance-policy
npm run calendar:check-dashboard-integration
npm run calendar:check-weekly-plan
npm run calendar:check-reports

npm run build
```

انتظار نهایی:

```text
working tree clean
Prisma schema is valid
TypeScript has no errors
All calendar checks passed
Production build succeeded
```

---

## ۷. SQLهای کنترل سلامت دیتابیس

برای ورود به دیتابیس:

```bash
sudo -u postgres psql -d meal_dashboard
```

### تعداد روزهای سال ۱۴۰۵

```sql
SELECT COUNT(*)
FROM "CalendarDay"
WHERE "jalaliYear" = 1405;
```

انتظار:

```text
365
```

### تعداد eventهای رسمی ۱۴۰۵

```sql
SELECT COUNT(*)
FROM "CalendarEvent"
WHERE "sourceName" = 'tehran-university-official-calendar-1405'
  AND "sourceVersion" = 'official-1405-v1';
```

انتظار:

```text
424
```

### خلاصه روزهای کاری و تعطیل

```sql
SELECT
  COUNT(*) FILTER (WHERE "isWorkday" = true) AS workdays,
  COUNT(*) FILTER (WHERE "isOfficialHoliday" = true) AS official_holiday_dates,
  COUNT(*) FILTER (WHERE "isWeeklyOffDay" = true) AS weekly_off_days
FROM "CalendarDay"
WHERE "jalaliYear" = 1405;
```

انتظار:

```text
workdays = 244
official_holiday_dates = 26
weekly_off_days = 104
```

### بررسی eventهای قدیمی fixed holidays

```sql
SELECT COUNT(*)
FROM "CalendarEvent"
WHERE "sourceName" = 'internal-fixed-jalali-official-holidays'
  AND "sourceVersion" = 'fixed-jalali-v1';
```

انتظار بعد از import رسمی کامل:

```text
0
```

### بررسی چند روز حساس

```sql
SELECT
  "jalaliDateKey",
  "dateKey",
  "dayNameFa",
  "isWeeklyOffDay",
  "isOfficialHoliday",
  "isManualHoliday",
  "isForcedWorkday",
  "isWorkday",
  "holidayTitle"
FROM "CalendarDay"
WHERE "jalaliDateKey" IN (
  '1405-01-01',
  '1405-03-14',
  '1405-05-21',
  '1405-08-22',
  '1405-10-02',
  '1405-11-22',
  '1405-12-19',
  '1405-12-20',
  '1405-12-29'
)
ORDER BY "date";
```

---

## ۸. قوانین معماری مهم

### قانون ۱: منطق weekday-only ممنوع است

هیچ بخش جدیدی از پروژه نباید خودش با `Date.getDay()` یا `getUTCDay()` تصمیم بگیرد که یک روز کاری است یا نه.

اشتباه:

```ts
const isWorkday = day >= 0 && day <= 4;
```

درست:

```ts
CalendarDay.isWorkday
```

یا از طریق service/policyهای موجود.

### قانون ۲: روز کاری فقط از CalendarDay خوانده شود

برای تصمیم‌های business-critical مثل ثبت غذا، گزارش‌ها، DatePicker و Monthly Board باید از این لایه‌ها استفاده شود:

```text
lib/calendar/calendar-service.ts
lib/attendance/calendar-attendance-policy.ts
lib/attendance/calendar-weekly-plan.ts
```

### قانون ۳: مناسبت‌ها از CalendarEvent خوانده شوند

نمایش مناسبت‌های روز نباید hardcode شود.

منبع درست:

```text
CalendarEvent
```

### قانون ۴: import رسمی باید idempotent باشد

هیچ import رسمی نباید duplicate event بسازد.

کلید یکتا:

```text
CalendarEvent.eventKey
```

### قانون ۵: eventهای کاربر و overrideها نباید با import رسمی حذف شوند

هر delete باید محدود به source مشخص باشد.

برای حذف fixed-holidays قدیمی فقط این source مجاز است:

```text
sourceName = internal-fixed-jalali-official-holidays
sourceVersion = fixed-jalali-v1
```

### قانون ۶: checkboxهای WeeklyMealPreference نباید با تعطیلی رسمی disable شوند

چون `WeeklyMealPreference` بر اساس `dayOfWeek` ذخیره می‌شود، نه تاریخ مشخص.

پس حتی اگر روز نمایش‌داده‌شده در weekly plan یک تعطیلی رسمی باشد، checkboxها باید فعال بمانند و فقط status تقویمی در UI نمایش داده شود.

---

## ۹. روند اضافه کردن سال جدید

برای اضافه کردن یک سال جدید، مراحل باید به همین ترتیب انجام شوند.

فرض مثال: سال ۱۴۰۶.

### مرحله ۱: دریافت منبع رسمی

منبع ترجیحی:

```text
https://calendar.ut.ac.ir/fa/home
```

فایل PDF رسمی سال جدید باید از منبع رسمی دریافت و در فرایند توسعه بررسی شود.

### مرحله ۲: ساخت سال پایه

```bash
npm run calendar:import-base-year -- --year=1406 --dry-run
npm run calendar:import-base-year -- --year=1406
```

### مرحله ۳: ساخت دیتاست رسمی ماه‌به‌ماه

برای هر ماه باید فایل جداگانه ساخته شود:

```text
data/calendar/iran/official-1406/farvardin.ts
data/calendar/iran/official-1406/ordibehesht.ts
...
data/calendar/iran/official-1406/esfand.ts
```

هر event باید حداقل این اطلاعات را داشته باشد:

```text
eventKey
jalaliDateKey
title
type
calendarType
isHoliday
displayOrder
sourcePage
sourceSection
referenceDate when applicable
```

### مرحله ۴: ساخت index و validation

برای سال جدید باید index و validation مشابه سال ۱۴۰۵ ساخته شود.

نمونه سال ۱۴۰۵:

```text
data/calendar/iran/official-1405/index.ts
scripts/validate-official-calendar-events-1405.ts
```

### مرحله ۵: dry-run import

```bash
npm run calendar:import-official-1406 -- --year=1406 --dry-run
```

### مرحله ۶: import واقعی

```bash
npm run calendar:import-official-1406 -- --year=1406
```

### مرحله ۷: اجرای smoke testها

بعد از import سال جدید، smoke testهای مربوط به همان سال باید ساخته یا به‌روزرسانی شوند.

حداقل موارد ضروری:

- یک تعطیلی رسمی ابتدای سال
- یک تعطیلی مذهبی متغیر
- یک تعطیلی هفتگی
- یک روز کاری عادی
- یک روز با چند مناسبت

---

## ۱۰. Rollback امن import رسمی

Rollback باید با احتیاط انجام شود.

هدف rollback، حذف فقط eventهای import رسمی همان source/version است و نباید داده کاربران یا overrideها حذف شود.

### مرحله ۱: گرفتن backup

قبل از rollback در production، از دیتابیس backup بگیرید.

نمونه:

```bash
pg_dump -Fc meal_dashboard > meal_dashboard_before_calendar_rollback.dump
```

### مرحله ۲: حذف eventهای رسمی source/version مشخص

نمونه برای سال ۱۴۰۵:

```sql
DELETE FROM "CalendarEvent" e
USING "CalendarDay" d
WHERE e."calendarDayId" = d."id"
  AND d."jalaliYear" = 1405
  AND e."sourceName" = 'tehran-university-official-calendar-1405'
  AND e."sourceVersion" = 'official-1405-v1';
```

### مرحله ۳: بازگرداندن CalendarDay به وضعیت پایه

برای rollback کامل، باید `CalendarDay` دوباره از منبع معتبر بازسازی شود.

راه امن‌تر:

```bash
npm run calendar:import-base-year -- --year=1405
npm run calendar:import-official-1405 -- --year=1405
```

اگر هدف فقط re-import رسمی است، معمولاً کافی است import رسمی دوباره اجرا شود، چون import idempotent طراحی شده است.

### هشدار

در production از update دستی گسترده روی `CalendarDay` بدون backup استفاده نکنید.

---

## ۱۱. Overrideهای دستی شرکت

در دنیای واقعی ممکن است دولت یا شرکت یک روز را به‌صورت موردی تعطیل یا کاری اعلام کند.

برای این هدف، سیستم باید از مفهوم override استفاده کند:

```text
isManualHoliday
isForcedWorkday
CalendarOverride
```

قاعده مورد انتظار:

```text
isForcedWorkday
```

باید بتواند تعطیلی رسمی یا هفتگی را برای شرکت به روز کاری تبدیل کند.

```text
isManualHoliday
```

باید بتواند یک روز کاری عادی را برای شرکت تعطیل کند.

هر override باید audit-friendly باشد و مشخص کند:

```text
چه کسی تغییر داده
چه زمانی تغییر داده
علت تغییر چه بوده
```

تا زمانی که ابزار امن override ساخته نشده، تغییر دستی مستقیم در دیتابیس توصیه نمی‌شود.

---

## ۱۲. چک‌لیست قبل از deploy

قبل از deploy هر تغییری که به تقویم مربوط است:

```bash
git status
npm run prisma:validate
npx tsc --noEmit
npm run calendar:validate-official-1405
npm run calendar:check-service
npm run calendar:check-attendance-policy
npm run calendar:check-dashboard-integration
npm run calendar:check-weekly-plan
npm run calendar:check-reports
npm run build
```

SQLهای کنترل:

```sql
SELECT COUNT(*)
FROM "CalendarDay"
WHERE "jalaliYear" = 1405;

SELECT COUNT(*)
FROM "CalendarEvent"
WHERE "sourceName" = 'tehran-university-official-calendar-1405'
  AND "sourceVersion" = 'official-1405-v1';

SELECT
  COUNT(*) FILTER (WHERE "isWorkday" = true) AS workdays,
  COUNT(*) FILTER (WHERE "isOfficialHoliday" = true) AS official_holiday_dates,
  COUNT(*) FILTER (WHERE "isWeeklyOffDay" = true) AS weekly_off_days
FROM "CalendarDay"
WHERE "jalaliYear" = 1405;
```

انتظار برای ۱۴۰۵:

```text
CalendarDay = 365
CalendarEvent = 424
workdays = 244
official_holiday_dates = 26
weekly_off_days = 104
```

---

## ۱۳. فایل‌ها و لایه‌های مهم

### Dataset

```text
data/calendar/iran/official-1405/
```

### Import و validation

```text
scripts/validate-official-calendar-events-1405.ts
scripts/import-official-calendar-events-1405.ts
```

### Calendar Service

```text
lib/calendar/calendar-service.ts
```

### Attendance Policy

```text
lib/attendance/calendar-attendance-policy.ts
```

### Weekly Plan Calendar Layer

```text
lib/attendance/calendar-weekly-plan.ts
```

### Dashboard Integration

```text
lib/dashboard/get-dashboard-data.ts
lib/dashboard/get-user-month-data.ts
```

### Reports Integration

```text
lib/reports/get-attendance-report.ts
```

---

## ۱۴. وضعیت نهایی مورد انتظار

اگر همه چیز سالم باشد، این دستورات باید پاس شوند:

```bash
npm run calendar:validate-official-1405
npm run calendar:check-service
npm run calendar:check-attendance-policy
npm run calendar:check-dashboard-integration
npm run calendar:check-weekly-plan
npm run calendar:check-reports
npm run build
```

و خروجی دیتابیس برای سال ۱۴۰۵ باید این باشد:

```text
365 CalendarDay
424 official CalendarEvent
244 workdays
26 official holiday dates
104 weekly off-days
```

---

## ۱۵. نکته مهم نگهداری

سیستم تقویم نباید به چند منطق موازی تقسیم شود.

از این به بعد هر تغییر جدید که به تاریخ، تعطیلی، روز کاری، گزارش، ثبت حضور یا انتخاب تاریخ مربوط است باید اول بررسی کند که آیا باید از Calendar DB استفاده کند یا نه.

در اغلب موارد پاسخ باید این باشد:

```text
بله، باید از Calendar DB استفاده شود.
```
