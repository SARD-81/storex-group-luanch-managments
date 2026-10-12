# راه‌اندازی اعلان‌های فنی StoreX در Nextcloud Talk

قرارداد نسخهٔ ۲۰۲۶/۱۰/۱۲، PR شمارهٔ ۷۶؛ راه‌اندازی واقعی شرکت هنوز **Pending** است.
این راهنما برای مسئول شبکه/DevOps است. Talk کانال اختیاری خطاهای فنی است؛
ارسال PDF و حذف پیام در بله بدون Nextcloud Files، Public Sharing یا Talk کار می‌کنند.
هیچ حساب، نشانی یا رمز واقعی در مثال‌ها تعیین نشده است. بات جدید لازم نیست؛
برنامه با OCS API و Service Account به گروه پیام می‌دهد.

## ۱. پیش‌نیاز و کنترل نسخه

نسخهٔ نصب‌شدهٔ Nextcloud و Talk و سیاست پشتیبانی سازمان را ابتدا ثبت کنید؛
تطبیق صرفاً با شمارهٔ نسخه برای پذیرش کافی نیست. قرارداد برنامه به Conversation
API v4 (`/ocs/v2.php/apps/spreed/api/v4`) و Chat API v1 نیاز دارد. v4 از Nextcloud
22 معرفی شده است؛ این عدد توصیهٔ نصب نسخهٔ قدیمی و بدون پشتیبانی نیست. نسخهٔ
پشتیبانی‌شده و سازگار Talk را از کاتالوگ همان نصب انتخاب کنید. در پاسخ گروه،
نوع، نقش حساب، `readOnly` و در صورت وجود `permissions` باید قابل بررسی باشند.
نبود اطلاعات کافی مجوز، به‌جای حدس، خطای پذیرش ایجاد می‌کند.

StoreX Server باید HTTPS پورت 443 سرویس را با DNS صحیح و TLS معتبر ببیند.
ساعت هر دو سرور باید همگام باشد. نام میزبان باید در allowlist برنامه قرار گیرد؛
اگر به IP خصوصی سازمان حل می‌شود، فقط همان hostname را در allowlist خصوصی
ثبت کنید. اجازهٔ عمومی به همهٔ IPهای خصوصی یا `-k` برای دورزدن TLS ندهید.
Reverse Proxy باید Basic Authentication، هدر `OCS-APIRequest`، GET و POST روی
OCS را عبور دهد؛ صفحهٔ ورود/HTML جای پاسخ JSON نیست. WAF و محدودیت نرخ را با
ترافیک کم worker سازگار کنید. هیچ دسترسی ورودی از اینترنت به StoreX برای این
کانال لازم نیست؛ ارتباط از StoreX به Nextcloud برقرار می‌شود.

حداقل دسترسی حساب: ورود به Nextcloud، مشاهدهٔ گروه خصوصی موردنظر و ارسال متن
در همان گروه. برای Talk تنها، admin بودن، مدیریت کاربران، WebDAV، ساخت share
عمومی یا دسترسی به فایل‌های کارکنان لازم نیست. بایگانی تقویم و پاک‌سازی shareهای
قدیمی نیازهای جداگانه‌اند؛ به‌دلیل آن‌ها همهٔ مجوزها را به حساب فنی اضافه نکنید.

## ۲. آماده‌سازی Nextcloud با رابط مدیر

1. با حساب مدیر وارد مدیریت Apps شوید. نصب و فعال‌بودن Talk را بررسی کنید؛
   نام و نسخهٔ افزونه و نسخهٔ هسته را ثبت کنید. با یک کاربر فنی، صفحهٔ Talk را
   باز کنید و ایجاد/بازکردن گفتگو را بررسی کنید. نام دقیق منو ممکن است با نسخه
   و زبان نصب فرق کند. اگر سیاست سازمان Talk را محدود کرده، دسترسی حساب سرویس
   را صریحاً به همان افزونه بدهید.
2. در صفحهٔ Users یک حساب اختصاصی با شناسهٔ مصوب سازمان بسازید یا تخصیص دهید.
   آن را عضو گروه admin یا Group Admin نکنید. مالکیت و مسئول rotation حساب را
   مشخص کنید؛ غیرفعال‌شدن خودکار حساب سرویس در LDAP/SSO را با سیاست سازمان
   هماهنگ کنید. از حساب شخصی توسعه‌دهنده استفاده نکنید.
3. وارد حساب سرویس شوید. در Personal Settings → Security، برای اتصال StoreX
   یک device/app password با نام قابل تشخیص ایجاد کنید. رمز را در زمان ایجاد
   به محل نگهداری امن منتقل کنید؛ در گفتگو، Jira، گزارش عمومی یا screenshot
   نگذارید. برای 2FA از App Password استفاده کنید، نه رمز اصلی ورود.
4. با یکی از مسئولان مجاز فنی در Talk یک گفتگوی **گروهی خصوصی** با نام
   `StoreX Automation Alerts` ایجاد کنید. آن را عمومی یا دارای لینک مهمان نکنید.
   پاسخ API باید `type=2` باشد؛ گروه عمومی `type=3` پذیرفته نمی‌شود.
5. مسئولان فنی و جانشین پاسخ‌گو را عضو کنید. اعضای غیرمرتبط و حساب گیرندهٔ گزارش
   غذا لازم نیست عضو باشند. سطح اعلان اعضا را با مسئولیت on-call هماهنگ کنید.
6. حساب سرویس را به همین گفتگو اضافه کنید. نقش عادیِ عضو کافی است؛ اجازهٔ ارسال
   متن لازم است. حالت read-only/lobby یا مجوز سفارشی نباید ارسال آن را ببندد.
   برنامه نقش participantType برابر 1/2/3 و readOnly برابر صفر را می‌پذیرد؛
   در پاسخ دارای permissions، بیت 128 باید وجود داشته باشد.
7. گفتگو را با حساب سرویس باز کنید. Conversation Token را از لینک گفتگو یا
   پاسخ فهرست گفتگوهای حساب سرویس استخراج کنید؛ این مقدار شناسهٔ عددی room،
   نام گروه، user ID یا App Password نیست. لینک را به شخص ناشناس ندهید. پاسخ
   `/room/{token}` باید همان گروه و عضویت حساب سرویس را نشان دهد.
8. پس از اجازهٔ گروه، یک پیام آزمون با حساب سرویس ارسال و مشاهدهٔ آن را از عضو
   دیگری تأیید کنید. سپس آزمون خود برنامه را طبق بخش پذیرش اجرا کنید؛ ارسال
   دستی در UI به‌تنهایی اتصال برنامه را اثبات نمی‌کند.
9. اعضا، read-only، محدودیت مهمان، TLS، وضعیت حساب و اجازهٔ POST را ثبت کنید.
   برنامه پیام شامل PDF، نام کارکنان، لینک عمومی گزارش یا Credential به این
   گروه نمی‌فرستد؛ فقط کد خطا، مرحله، هدف تقویم/گزارش و شناسهٔ اجرای فنی می‌رود.

دستور `occ` حدسی ارائه نشده است. برای هر نصب، از مستندات همان نسخه و مسیر
اجرای معتبر سازمان استفاده کنید؛ روش رابط وب وابستگی به مسیر PHP/کانتینر ندارد.

## ۳. تنظیم StoreX

در فایل محیط حفاظت‌شدهٔ worker، نه دیتابیس یا فرم وب، تنظیم کنید:

| متغیر | محتوا / مسئول |
| --- | --- |
| `NEXTCLOUD_USERNAME` | Login ID حساب سرویس اختصاصی |
| `NEXTCLOUD_APP_PASSWORD` | Secret؛ فقط Secret Store یا ENV حفاظت‌شده |
| `AUTOMATION_ALLOWED_NEXTCLOUD_HOSTS` | hostname دقیق سرویس بدون scheme/path |
| `AUTOMATION_ALLOWED_PRIVATE_HOSTS` | اختیاری؛ همان hostname فقط اگر DNS خصوصی است |
| `DATABASE_URL` | دیتابیس مصوب همان محیط؛ Secret |
| `STOREX_ENVIRONMENT` | برای probeهای کنترل‌شده فقط `staging` |

فایل نمونه `deploy/automation.env.example` است. نمونهٔ systemd از
`/etc/storex/automation.env` با مالک root و گروه سرویس و مجوز 0640 می‌خواند؛
web لازم نیست App Password را دریافت کند. هیچ Secretی در دستور یا لاگ چاپ نکنید.
بعد از تغییر ENV، worker بعدی محیط جدید می‌گیرد؛ سرویس دائمی وب در صورت تغییر
تنظیمات مخصوص آن طبق رویهٔ سازمان restart شود. با این راهنما Production فعال نکنید.

با ADMIN فعال وارد `/settings/automations/talk` شوید. HTTPS Base URL و Conversation
Token را ذخیره کنید. ابتدا گزینهٔ فعال‌بودن کانال را خاموش نگه دارید. «بررسی اتصال
و مجوز بدون ارسال» فقط Job ثبت می‌کند؛ worker آزمون را انجام می‌دهد. تاریخچه و
خطا را ببینید. وضعیت‌های Not Configured، Disabled، Ready و Error مستقل از Reporter
هستند. Ready پس از بررسی مجوز اثبات می‌شود؛ دریافت واقعی پیام آزمون شاهد جداگانه است.

پس از پذیرش پیام آزمون، کانال را فعال کنید. زمان فعال‌سازی ثبت می‌شود. هشدارهای
قبل از این زمان یا قدیمی‌تر از ۲۴ ساعت با دلیل SKIPPED در پنل می‌مانند؛ یک‌باره
به گروه سرازیر نمی‌شوند. حداکثر سه هشدار تازه در هر tick ارسال می‌شود. هشدارهای
مبهم خودکار دوباره ارسال نمی‌شوند. نمونهٔ وضعیت‌های قدیمی را قبل از فعال‌سازی
بازبینی کنید و اگر هنوز حادثهٔ جاری وجود دارد، آن را در فرآیند incident شرکت
پیگیری کنید؛ پیام‌های قدیمی را با تغییر مستقیم SQL دوباره در صف نریزید.

## ۴. آزمون API و پذیرش کنترل‌شده

ENV مصوب staging را از مکان حفاظت‌شده بارگیری کنید؛ `set -x` خاموش باشد.
نمونهٔ زیر رمز را در آرگومان curl یا history نمی‌گذارد. خروجی فقط کد HTTP است؛
برای تشخیص OCS داخل HTTP 200، آزمون برنامه مرجع است. Base URL و توکن گروه در
متغیرهای غیرمحرمانهٔ `NEXTCLOUD_BASE_URL` و `TALK_CONVERSATION_TOKEN` تنظیم شده‌اند:

```bash
python3 - <<'PY' | curl --config -
import os, json, urllib.parse
base = os.environ['NEXTCLOUD_BASE_URL'].rstrip('/')
token = urllib.parse.quote(os.environ['TALK_CONVERSATION_TOKEN'], safe='')
options = {
  'url': base + '/ocs/v2.php/apps/spreed/api/v4/room/' + token + '?format=json',
  'user': os.environ['NEXTCLOUD_USERNAME'] + ':' + os.environ['NEXTCLOUD_APP_PASSWORD'],
  'header': 'OCS-APIRequest: true',
  'output': '/dev/null', 'write-out': '%{http_code}\\n',
  'connect-timeout': '10', 'max-time': '20',
}
for key, value in options.items():
    print(key + ' = ' + json.dumps(value))
PY
```

این curl را به مقصد ازپیش‌بررسی‌شده اجرا کنید؛ برنامه خودش DNS pinning و
allowlist را اعمال می‌کند. نمونه TLS را خاموش نمی‌کند و redirect را دنبال نمی‌کند.

```bash
cd /opt/storex/current
# احراز هویت حساب سرویس و گروه، بدون پیام و بدون وابستگی Files/Public Sharing
node --import tsx scripts/check-talk-live.ts --check
# فقط بعد از رضایت گروه؛ یک پیام مصنوعی و رسید در Job
node --import tsx scripts/check-talk-live.ts --send-once
```

گزینهٔ UI «ارسال یک پیام آزمون مجاز است» نیز نیازمند تأیید صریح ادمین است.
ارسال از worker انجام می‌شود. کد آزمون، شناسهٔ Job و رسید را نگه دارید و از یک
عضو دیگر تأیید مشاهده بگیرید. برای پذیرش ثبت کنید: محیط/نسخه، زمان، HTTP/OCS
sanitized، نتیجهٔ health، شناسهٔ پیام، تأیید عضو و نبود دادهٔ حساس در متن.
رمز، Authorization، پاسخ کامل room یا فهرست اعضا را در artifact عمومی نگذارید.

در staging با اجازهٔ DevOps یک اختلال کنترل‌شده در دسترسی حساب/شبکه ایجاد کنید؛
خطای ثابت و صف داخلی باید باقی بمانند، ارسال/حذف بله نباید متوقف شود. پس از
رفع اختلال، retry و رسید را بررسی کنید. Retry عادی exponential با سقف یک ساعت
و حداکثر ده تلاش است؛ نتیجهٔ نامشخص یا گم‌شدن نوشتن رسید، بررسی دستی می‌خواهد.
Test Job مبهم را کورکورانه تکرار نکنید؛ ابتدا متن marker را در گروه بررسی کنید.
اجرای موفق Mock/CI جایگزین این پذیرش Live نیست.

## ۵. عیب‌یابی

| علامت | بررسی و اقدام |
| --- | --- |
| 401 / Invalid App Password | صحت Login ID، App Password و Basic Auth؛ رمز اصلی/SSO را جایگزین نکنید؛ رمز اختصاصی را امن rotate کنید |
| Service Account Disabled | وضعیت Users و LDAP/SSO؛ با مسئول هویت فعال کنید، حساب جدید ناشناخته نسازید |
| 403 / Missing Permission | عضویت حساب، readOnly، permissions و سیاست WAF؛ admin شدن حساب راه‌حل حداقلی نیست |
| 404 / Invalid Conversation | Conversation Token و Base URL/subpath؛ عضویت حساب سرویس و حذف/جابجایی گروه را بررسی کنید |
| 429 | rate limit سرور/Proxy؛ فاصله retry را رعایت کنید، کلیک تکراری/Test Job جدید نزنید |
| Timeout / Unreachable Host | DNS، routing، firewall و HTTPS از خود StoreX Server؛ ارسال POST ممکن است مبهم باشد |
| TLS Failure | زنجیره CA، hostname و انقضا؛ `-k` یا خاموش‌کردن verify ممنوع |
| Private Address Blocked | hostname دقیق شبکهٔ داخلی را فقط در allowlist خصوصی مصوب بگذارید |
| OCS Error | meta.statuscode داخل JSON را بررسی کنید؛ HTTP 200 به‌تنهایی موفقیت نیست؛ پاسخ را عمومی منتشر نکنید |
| HTML / Invalid Response | مسیر OCS، هدر و Proxy login wall؛ ممکن است نتیجهٔ ارسال نامشخص باشد |
| TALK_ROOM_NOT_GROUP | گروه خصوصی type=2 لازم است؛ one-to-one و public پذیرفته نیستند |
| TALK_SEND_PERMISSION_MISSING | نقش عضو، readOnly=0 و بیت ارسال 128؛ نسخه/قابلیت پاسخ را هم بررسی کنید |
| Ambiguous Delivery / lost receipt | گروه و marker را با مسئول مجاز بازبینی کنید؛ رسید واقعی را در incident نگه دارید؛ ارسال مجدد خودکار ممنوع |
| صف بدون ارسال | Talk فعال است؟ ENV worker برقرار است؟ زمان فعال‌سازی و SKIPPED backlog، retry بعدی و سلامت timer را ببینید |

## ۶. امنیت، پایش و نگهداری

Secret Rotation: رمز جدید اختصاصی بسازید، فایل محیط را امن جایگزین کنید، health
بدون ارسال و سپس یک آزمون مجاز انجام دهید؛ بعد رمز قدیمی را revoke کنید.
در حادثهٔ افشا، کانال Talk را از پنل خاموش و App Password را از Security باطل
کنید. Reporter و حذف بله مستقل باقی می‌مانند؛ بات بله را صرفاً به‌خاطر مشکل Talk
غیرفعال نکنید. اگر خود توکن بله مشکل دارد، محدودیت ۴۸ ساعت حذف را فوراً به on-call
اعلام کنید و credential جدید همان بات را طبق فرآیند سازمان تأمین کنید.

Backup دیتابیس تنظیمات/صف/رسیدها و Secret Store را جداگانه و رمزنگاری‌شده بگیرید.
بازیابی روی staging با ارسال خاموش آزمایش شود؛ snapshot قدیمی می‌تواند intent
ارسال را زنده کند. رسیدهای واقعی گروه را قبل از تکرار بررسی کنید. در restart
صف RUNNING نامطمئن به MANUAL_ACTION_REQUIRED می‌رود. وضعیت گم‌شده را SUCCESS
نسازید. تاریخچهٔ داخلی را به‌دلیل خاموش‌بودن کانال حذف نکنید.

مانیتور مستقل سازمان باید heartbeat worker، خطاهای جدید، backlog و حذف‌های
عقب‌افتادهٔ بله را بررسی کند. `npm run automation:admin -- --health-check` با
heartbeat بیش از پنج دقیقه یا حذف عقب‌افتاده exit غیرصفر می‌دهد. worker خاموش
نمی‌تواند در همان زمان هشدار Talk بفرستد؛ از مانیتور/on-call مستقل استفاده کنید.
پس از restart هشدار وقفه در دیتابیس ثبت می‌شود. اعضای گروه و دسترسی حساب را
دوره‌ای و بعد از خروج نیروها بازبینی کنید؛ logها فقط کد و شناسهٔ فنی داشته باشند.

## ۷. چک‌لیست تحویل مسئول شبکه به توسعه‌دهنده

- [ ] نسخه‌های هسته/Talk، مالک سرویس و پشتیبانی سازمان ثبت شد.
- [ ] Base URL، hostname و خصوصی/عمومی بودن DNS بدون Secret تحویل شد.
- [ ] TLS و دسترسی StoreX Server تأیید شد؛ allowlist دقیق ثبت شد.
- [ ] Login ID حساب اختصاصی و مسئول rotation مشخص شد.
- [ ] App Password فقط در Secret Store/ENV حفاظت‌شده تحویل شد؛ در این checklist نیست.
- [ ] گروه خصوصی `StoreX Automation Alerts`، Conversation Token و مالک آن مشخص شد.
- [ ] اعضای پاسخ‌گو و جانشین، نقش حساب و مجوز ارسال بررسی شدند.
- [ ] آزمون بدون ارسال StoreX موفق شد و شناسهٔ Job/زمان ثبت شد.
- [ ] پیام آزمون با رضایت گروه دریافت شد؛ رسید و تأیید عضو ثبت شد.
- [ ] Retry/حادثهٔ نامشخص، مانیتور مستقل و غیرفعال‌سازی اضطراری تمرین شد.
- [ ] سیاست نگهداری لاگ، backup و بازبینی اعضا مصوب است.
- [ ] فعال‌سازی Production هنوز نیازمند اجازهٔ مالک پروژه است.

## منابع رسمی

- [Nextcloud؛ حساب‌ها و مجوزها](https://docs.nextcloud.com/server/latest/admin_manual/configuration_user/user_configuration.html)
- [Nextcloud؛ App Password و revoke](https://docs.nextcloud.com/server/latest/user_manual/en/session_management.html)
- [Talk؛ نصب و سازگاری](https://nextcloud-talk.readthedocs.io/en/latest/quick-install/)
- [Talk؛ Conversation API v4](https://nextcloud-talk.readthedocs.io/en/latest/conversation/)
- [Talk؛ ارسال Chat و رسید](https://nextcloud-talk.readthedocs.io/en/latest/chat/)
- [Talk؛ نوع گروه، read-only و بیت‌های مجوز](https://nextcloud-talk.readthedocs.io/en/latest/constants/)
