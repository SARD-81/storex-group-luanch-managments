# 🍽️ سامانه مدیریت وعده‌های غذایی

یک سامانه تحت وب برای مدیریت، زمان‌بندی و ثبت حضور پرسنل در وعده‌های غذایی سازمان، شامل امکاناتی مانند ثبت حضور روزانه، مدیریت برنامه هفتگی، کنترل دسترسی کاربران، پنل مدیریت، گزارش‌گیری و خروجی Excel.

این پروژه با رویکرد Full-Stack توسعه داده شده و برای استفاده در شبکه داخلی سازمان‌ها، شرکت‌ها و محیط‌های Intranet مناسب است.

---

## ✨ ویژگی‌های اصلی

- **مدیریت حضور در وعده‌های غذایی**
  - ثبت وضعیت حضور یا عدم حضور کاربران برای وعده‌های مشخص
  - جلوگیری از ثبت رکوردهای تکراری
  - مدیریت وضعیت‌ها در بازه‌های روزانه و ماهانه

- **پنل کاربری**
  - مشاهده برنامه ماهانه
  - ثبت یا تغییر وضعیت حضور
  - نمایش وضعیت روزهای قابل ثبت، بسته‌شده یا گذشته

- **پنل مدیریت**
  - مدیریت کاربران
  - مشاهده وضعیت حضور پرسنل
  - مدیریت برنامه‌های هفتگی
  - دریافت گزارش خروجی

- **گزارش‌گیری**
  - تولید گزارش ماهانه
  - خروجی Excel برای استفاده مدیریتی یا مالی
  - نمایش آمار حضور کاربران

- **احراز هویت**
  - سیستم ورود سفارشی
  - مدیریت نشست کاربران
  - تفکیک نقش کاربر عادی و مدیر

- **رابط کاربری فارسی و راست‌چین**
  - طراحی مناسب زبان فارسی
  - پشتیبانی از تقویم و نمایش تاریخ شمسی
  - ظاهر مدرن با پشتیبانی از حالت روشن و تاریک

---

## 🛠️ تکنولوژی‌های استفاده‌شده

### Frontend / Full-Stack

- Next.js
- React
- App Router
- Server Actions
- Tailwind CSS
- Shadcn/UI

### Backend / Database

- PostgreSQL
- Prisma ORM
- Custom Authentication
- Server-side Authorization

### Deployment

- Linux Server
- Nginx Reverse Proxy
- PM2 Process Manager

---

## 📂 ساختار کلی پروژه

```text
project-root/
├── actions/
│   └── Server Actions مربوط به ثبت، ویرایش و مدیریت داده‌ها
│
├── app/
│   ├── صفحات اصلی پروژه
│   ├── مسیرهای پنل کاربری
│   ├── مسیرهای پنل مدیریت
│   └── API Routes در صورت نیاز
│
├── components/
│   └── کامپوننت‌های رابط کاربری، کارت‌ها، فرم‌ها و جداول
│
├── lib/
│   ├── منطق‌های مشترک پروژه
│   ├── مدیریت نشست‌ها
│   ├── توابع تاریخ و زمان
│   └── قوانین بیزینسی
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── public/
│   └── فایل‌های عمومی پروژه
│
├── package.json
└── README.md
```

---

## 💻 راه‌اندازی در محیط توسعه

### پیش‌نیازها

قبل از اجرای پروژه، موارد زیر باید روی سیستم نصب باشند:

- Node.js نسخه 20 یا بالاتر
- PostgreSQL نسخه 14 یا بالاتر
- npm یا pnpm
- Git

---

### ۱. دریافت پروژه

```bash
git clone https://github.com/example-org/meal-management-system.git
cd meal-management-system
```

---

### ۲. نصب وابستگی‌ها

```bash
npm install
```

یا در صورت استفاده از pnpm:

```bash
pnpm install
```

---

### ۳. تنظیم متغیرهای محیطی

در ریشه پروژه یک فایل با نام `.env` ایجاد کنید:

```env
DATABASE_URL="postgresql://example_user:example_password@localhost:5432/example_meal_db"
NODE_ENV="development"
```

نمونه مقادیر فرضی:

```env
DATABASE_URL="postgresql://meal_user:secure_password_123@localhost:5432/meal_dashboard"
NODE_ENV="development"
```

---

### ۴. اجرای Migration دیتابیس

```bash
npx prisma migrate dev
```

---

### ۵. تولید Prisma Client

```bash
npx prisma generate
```

---

### ۶. اجرای Seed اولیه

```bash
npm run db:seed
```

> اطلاعات کاربری اولیه مدیر، در فایل Seed پروژه قابل تنظیم است.  
> پیشنهاد می‌شود قبل از استفاده واقعی، نام کاربری و رمز عبور پیش‌فرض تغییر داده شود.

---

### ۷. اجرای پروژه در محیط توسعه

```bash
npm run dev
```

پس از اجرا، پروژه از طریق آدرس زیر در دسترس خواهد بود:

```text
http://localhost:3000
```

---

## 🚀 راه‌اندازی در محیط Production

این بخش یک نمونه عمومی و فرضی از استقرار پروژه روی سرور لینوکسی است. مقادیر مربوط به IP، مسیر پروژه، نام کاربر و دیتابیس باید متناسب با سرور واقعی تغییر داده شوند.

---

### ۱. آماده‌سازی سرور

پکیج‌های موردنیاز را نصب کنید:

```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-contrib
```

نصب Node.js باید مطابق نسخه مورد نیاز پروژه انجام شود. به عنوان نمونه:

```bash
node -v
npm -v
```

---

### ۲. دریافت پروژه روی سرور

```bash
cd /home/example-user/apps
git clone https://github.com/example-org/meal-management-system.git
cd meal-management-system
```

---

### ۳. نصب وابستگی‌ها

```bash
npm install
```

---

### ۴. تنظیم فایل محیطی Production

یک فایل `.env` در ریشه پروژه ایجاد کنید:

```bash
nano .env
```

محتوای نمونه:

```env
DATABASE_URL="postgresql://meal_prod_user:change_this_password@localhost:5432/meal_prod_db"
NODE_ENV="production"
```

---

### ۵. اجرای Migration در Production

```bash
npx prisma migrate deploy
```

---

### ۶. تولید Prisma Client

```bash
npx prisma generate
```

---

### ۷. اجرای Seed اولیه در صورت نیاز

در صورتی که پروژه برای اولین بار نصب می‌شود و نیاز به ایجاد کاربران اولیه یا داده پایه دارد:

```bash
npm run db:seed
```

> توجه: اجرای Seed در محیط Production باید با دقت انجام شود.  
> بهتر است Seed طوری نوشته شود که داده‌های واقعی را حذف یا بازنویسی نکند.

---

### ۸. Build پروژه

```bash
npm run build
```

---

### ۹. اجرای پروژه با PM2

ابتدا PM2 را نصب کنید:

```bash
sudo npm install -g pm2
```

سپس پروژه را اجرا کنید:

```bash
pm2 start npm --name "meal-management" -- start
```

ذخیره وضعیت PM2:

```bash
pm2 save
```

فعال‌سازی اجرای خودکار بعد از ری‌استارت سرور:

```bash
pm2 startup
```

پس از اجرای دستور بالا، PM2 یک دستور خروجی می‌دهد که باید همان را اجرا کنید.

---

## 🌐 تنظیم Nginx به عنوان Reverse Proxy

یک فایل کانفیگ جدید برای پروژه ایجاد کنید:

```bash
sudo nano /etc/nginx/sites-available/meal-management
```

نمونه کانفیگ فرضی:

```nginx
server {
    listen 80;
    server_name example.local;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

فعال‌سازی کانفیگ:

```bash
sudo ln -s /etc/nginx/sites-available/meal-management /etc/nginx/sites-enabled/
```

تست تنظیمات Nginx:

```bash
sudo nginx -t
```

ری‌استارت Nginx:

```bash
sudo systemctl restart nginx
```

اکنون پروژه از طریق آدرس تنظیم‌شده در `server_name` در دسترس خواهد بود.

---
## 🔐 نکات امنیتی

برای استفاده عملیاتی از پروژه، رعایت موارد زیر پیشنهاد می‌شود:

- تغییر رمزهای پیش‌فرض پس از نصب
- استفاده از رمزهای قوی برای کاربران مدیر
- محدود کردن دسترسی دیتابیس فقط به سرور برنامه
- فعال‌سازی HTTPS در محیط‌های غیرمحلی
- تنظیم صحیح Cookieها در Production
- جلوگیری از اجرای Seed روی دیتابیس دارای داده واقعی
- تهیه Backup منظم از دیتابیس
- محدودسازی دسترسی SSH به سرور
- بررسی لاگ‌های سیستم و برنامه

---

## 🧪 اسکریپت‌های رایج پروژه

نمونه اسکریپت‌های قابل استفاده در پروژه:

```bash
npm run dev
```

اجرای پروژه در محیط توسعه.

```bash
npm run build
```

ساخت نسخه Production.

```bash
npm run start
```

اجرای نسخه Build شده.

```bash
npm run db:seed
```

اجرای Seed اولیه دیتابیس.

```bash
npx prisma studio
```

باز کردن Prisma Studio برای مشاهده و مدیریت داده‌ها.

```bash
npx prisma migrate dev
```

ایجاد و اجرای Migration در محیط توسعه.

```bash
npx prisma migrate deploy
```

اجرای Migrationها در محیط Production.

---

## 🧩 مدل‌های اصلی سیستم

مدل‌های اصلی پروژه معمولاً شامل موارد زیر هستند:

- `User`
  - اطلاعات کاربران
  - نقش کاربر
  - وضعیت فعال یا غیرفعال بودن

- `Session`
  - مدیریت نشست‌های ورود
  - نگهداری توکن‌های امن نشست

- `MealAttendance`
  - وضعیت حضور کاربران در وعده‌های غذایی
  - تاریخ حضور
  - نوع وعده
  - وضعیت ثبت‌شده

- `WeeklySchedule`
  - برنامه هفتگی وعده‌ها
  - تعیین روزهای فعال یا غیرفعال

> نام دقیق مدل‌ها ممکن است با توجه به پیاده‌سازی پروژه متفاوت باشد.

---

## 🗓️ منطق ثبت وعده‌ها

سیستم می‌تواند بر اساس قوانین داخلی سازمان، امکان ثبت یا تغییر وضعیت حضور را محدود کند.

نمونه قوانین قابل پیاده‌سازی:

- ثبت حضور فقط تا قبل از مهلت مشخص‌شده
- عدم امکان تغییر وضعیت برای روزهای گذشته
- محدودیت ثبت برای روزهای تعطیل
- تفکیک وعده‌های مختلف مانند صبحانه و ناهار
- ثبت خودکار یا نیمه‌خودکار بر اساس برنامه هفتگی

---

## 📊 گزارش‌گیری

بخش گزارش‌گیری برای استخراج داده‌های مدیریتی طراحی شده است.

امکانات پیشنهادی:

- گزارش حضور ماهانه
- گزارش بر اساس کاربر
- گزارش بر اساس وعده
- خروجی Excel
- محاسبه تعداد حضور، عدم حضور و مجموع وعده‌ها

---

## 🛠️ عیب‌یابی رایج

### مشکل اتصال به دیتابیس

ابتدا مقدار `DATABASE_URL` را بررسی کنید:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/database_name"
```

سپس مطمئن شوید PostgreSQL در حال اجرا است:

```bash
sudo systemctl status postgresql
```

---

### مشکل اجرا نشدن Prisma

دستور زیر را اجرا کنید:

```bash
npx prisma generate
```

در صورت وجود Migrationهای اجرا نشده:

```bash
npx prisma migrate deploy
```

---

### مشکل اجرا نشدن پروژه در Production

ابتدا وضعیت PM2 را بررسی کنید:

```bash
pm2 status
```

مشاهده لاگ‌ها:

```bash
pm2 logs meal-management
```

بررسی وضعیت Nginx:

```bash
sudo systemctl status nginx
```

تست کانفیگ Nginx:

```bash
sudo nginx -t
```

---

### مشکل دسترسی از مرورگر

موارد زیر را بررسی کنید:

- درست بودن آدرس `server_name` در Nginx
- باز بودن پورت 80 یا 443
- اجرا بودن برنامه روی پورت 3000
- تنظیم بودن Reverse Proxy
- نبود خطا در لاگ‌های PM2 و Nginx

---

## ✅ چک‌لیست قبل از استفاده عملیاتی

قبل از استفاده رسمی از پروژه، موارد زیر بررسی شود:

- [ ] تنظیم صحیح فایل `.env`
- [ ] اتصال موفق به PostgreSQL
- [ ] اجرای کامل Migrationها
- [ ] ایجاد کاربر مدیر اولیه
- [ ] تغییر رمزهای پیش‌فرض
- [ ] اجرای موفق Build
- [ ] اجرای پروژه با PM2
- [ ] تنظیم صحیح Nginx
- [ ] تست ورود کاربران
- [ ] تست پنل مدیریت
- [ ] تست ثبت حضور
- [ ] تست گزارش Excel
- [ ] تهیه Backup اولیه از دیتابیس

---

## 📌 نکات توسعه آینده

موارد زیر می‌توانند در نسخه‌های بعدی پروژه توسعه داده شوند:

- افزودن تست‌های واحد و یکپارچه
- افزودن Audit Log برای عملیات حساس
- افزودن Rate Limit برای فرم ورود
- افزودن امکان Reset Password امن
- افزودن مدیریت تعطیلات رسمی
- افزودن داشبورد آماری پیشرفته
- افزودن خروجی PDF
- افزودن اعلان یا Reminder
- افزودن قابلیت Import کاربران از Excel
- افزودن سطح دسترسی‌های متنوع‌تر
