# Attendance, Reporter and Calendar operations

Status: **draft / not approved for production deployment**. Read `verification-report.md` before merging or deploying this branch.

Public Link Sharing is currently disabled in Nextcloud.
Until DevOps enables it, Reporter automation must remain in MANUAL MODE.
All existing manual Reporter operations remain available.
Once Public Link Sharing becomes available and passes capability verification,
the system should automatically begin public-link delivery without a new deployment.

## Attendance policy

CalendarDay.isWorkday is the final business decision; Thursday/Friday checks must never replace it. Admins use `/settings/attendance` for any existing Calendar date, search people, and set breakfast/lunch independently. Present/Absent requires a workday; Clear removes only that admin decision. Force a nonworkday through `/settings/calendar-overrides` first.

Priority: Admin override > User manual > eligible automatic reservation > preserved legacy attendance > no reservation. User meal inputs controlled by Admin are locked in the UI and checked again under the database transaction lock. Clearing Admin restores the remaining applicable decision. A user cancellation is an explicit USER_MANUAL ABSENT decision and survives every automatic reconciliation.

Automatic breakfast/lunch are independent options in `/settings/users`. Enabling begins on the same Tehran date. Active non-Reporter users receive automatic reservations on final calendar workdays in the reservation window. Reconciliation extends through any already-generated automatic coverage. Disable/deactivation removes future AUTO_RESERVATION projections and preserves explicit decisions and past rows. Calendar override changes reconcile future coverage inside the same transaction. Repeated reconciliation makes no unnecessary updates. WeeklyMealPreference and its old migrations remain; the weekly runtime is retired, and `/settings/weekly-plan` redirects to daily attendance. Existing weekly-generated attendance is marked LEGACY_WEEKLY_PLAN without changing its dates/statuses/timestamps.

## Report ranges and manual Reporter

Reports use draft Jalali pickers and an explicit Apply button. Invalid/reversed/ranges over 366 inclusive days are rejected. Details display 100 rows per page, with full-range summaries and Excel. UI and Excel share the range validator and Calendar workday query.

Reporter targets the first final workday strictly after today in Tehran. Guest edits, manual printing and Excel remain available regardless of automation/capability state. The printable document and server PDF share logical content and A5 portrait styles, including names, aggregate guest counts, manual rows and signature footer. Long tables paginate; no fixed-height clipping.

## Architecture and identities

`npm run automation:tick` is an independent CLI. A session-level PostgreSQL advisory lock (641706) prevents overlapping workers; attendance policy writers use transaction lock 641705. The systemd timer runs every minute and catches up after restart. Database jobs, artifacts, report-date deliveries, alert identities and probe leases persist across web/worker restarts.

Default Tehran schedule: 09:20 reminder 1, 09:25 reminder 2, 09:30 delivery, 09:40 retry, 09:50 retry, 10:00 final retry/escalation. Each reminder reads current persisted guests. Initial PDF generation reads the latest values again. Repeated ticks reuse `report-send:<Jalali date>` / reminder identities. A successful reportDateKey never sends automatically again. Nonworkday ticks do not schedule duplicate deliveries. Late reminder windows close; failed report execution resumes at the next scheduled retry. After the final attempt it requires admin action.

PDF generation, private upload, share creation/verification and Bale delivery persist independently. Private files are deterministic under year/month paths. Lost share-create responses are adopted by querying the same path. Safe Bale rejection retries the existing artifact/link. An ambiguous send/crash after the send boundary is held for manual review, since Bale provides no transaction tying a send to our DB. Inspect the recipient chat, then record either the actual message ID or explicit evidence that no send occurred in the admin page. This conservative policy prevents automatic duplicate messages; it does not claim an impossible exactly-once guarantee across two services.

Public capabilities are checked daily and before delivery. Authentication, permissions, disabled sharing and unavailable remote services stay distinct. A public-safe probe PDF is anonymously downloaded, checked, then its share revoked. Report links are read-only public shares, also verified anonymously against the PDF SHA-256. expiresAt = remote shareCreatedAt + exactly 86,400,000 ms. Nextcloud date-only expiry is a backup; minute-level durable cleanup revokes the share at the first tick at/after expiresAt, retries failures and retains private report PDFs. Network/worker outage can delay physical revocation; the overdue state remains visible and alerts are queued. Monitoring and an always-running timer are therefore mandatory.

Bale sends only to a verified private chat via the official HTTPS API. Technical alerts go to the configured multi-person Nextcloud Talk room through the service account, never to the report recipient. Alerts use durable identities: calendar at most daily per year; reporter first failure/final escalation/recovery; cleanup daily failures. Ambiguous Talk sends are held rather than blindly repeated.

## Admin configuration

Routes: `/settings/automations`, `/settings/automations/reporter`, `/settings/automations/calendar`. Only active ADMIN accounts may view or submit actions. Configure the HTTPS Nextcloud base URL, report/calendar directories, positive numeric Bale recipient chat ID, multi-person Talk conversation token, timings, enabled/pause flags, and optional approved calendar source override. Connections, run now, dry-run and retry controls enqueue durable worker jobs. The web request performs no outbound delivery. Reporter success/expiry/retry status is visible on `/reporter/next-day`.

Secrets are ENV-only; admin screens display only configured/not-configured flags. Allowlisted URLs must use HTTPS and port 443 without credentials. Credential-bearing redirects are refused. Unapproved hosts, loopback/private metadata addresses and oversized responses are blocked. Every connection is pinned to its checked DNS address while preserving hostname/SNI and TLS certificate verification; each allowed redirect is checked again. An explicitly allowlisted private Nextcloud host is the only private-address exception. Errors persist fixed codes, never remote response bodies, Authorization headers, passwords or token-bearing Bale URLs.

## Calendar and emergency mode

Starting 1 Esfand, check the next Jalali year daily. Discover the year PDF href from `https://calendar.ut.ac.ir/`; do not hardcode Liferay document UUIDs. Download is size-bounded and checks PDF magic, then hashes, extracts with PyMuPDF, validates/stages and imports in one transaction with post-count verification. Failed extraction/validation never modifies the active year. Original PDF and extraction/diff JSON are retained in the protected spool and synchronized privately when Nextcloud recovers.

**Current blocker:** the extractor is explicitly uncertified and returns parserVerified=false. Automatic official import deliberately stops at PARSER_GOLDEN_VALIDATION_REQUIRED. Full official event normalization and golden-layout calibration are not implemented/verified yet. Do not enable this as a production calendar importer or mark the mission complete. Required certification is the real official 1405 PDF -> 365 days, 424 events, 26 official holiday dates, 244 final workdays, 104 weekly offdays, plus malformed/partial/wrong-year and leap-year cases.

Emergency UI offers all 12 months, Persian/Arabic/English digits, slash/hyphen dates, multiline `1406-01-01 | نوروز`, and CSV:

```csv
jalali_date,title,is_official_holiday
1406-01-01,نوروز,true
1406-01-02,نوروز,true
```

Rows are validated with row errors, identical duplicates deduplicated and conflicting titles rejected. Preview includes holidays added/removed/matching, title changes and workday impact. Apply requires explicit diff approval; a fingerprint rejects stale previews. Source `manual-official-calendar-fallback` is independent of normal overrides. Applying replaces only its own events for that year, preserves unrelated sources/overrides, recomputes final flags, post-verifies and reconciles future attendance. A later official dataset must show its diff and explicitly approve removal of the fallback. Existing active-year official source changes require admin approval.

## Required environment

- DATABASE_URL: production PostgreSQL connection.
- NEXTCLOUD_USERNAME / NEXTCLOUD_APP_PASSWORD: dedicated automation service account and revocable app password.
- BALE_BOT_TOKEN: official bot token.
- AUTOMATION_ALLOWED_NEXTCLOUD_HOSTS: comma-separated trusted DNS hostnames.
- AUTOMATION_SPOOL_DIR: durable protected spool directory, writable by worker and readable by admin artifact route if web/worker are separate.
- PLAYWRIGHT_BROWSERS_PATH: installed Chromium location; alternatively use an explicit executable path.

Optional: AUTOMATION_ALLOWED_PRIVATE_HOSTS, CALENDAR_APPROVED_SOURCE_HOSTS, CALENDAR_PYTHON (default python3), PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, REPORT_PDF_FONT_PATH. Set NODE_ENV=production and TZ=Asia/Tehran. Existing AUTH_COOKIE_SECURE should be true behind production HTTPS. TEST_DATABASE_URL and TEST_PGLITE are test-only and must never be installed in production. The sample is `deploy/automation.env.example`.

## DevOps handoff

Create a dedicated Nextcloud account with access only to the two private directories and configured Talk group. Create/revoke its app password separately from personal accounts. Enable public link sharing with read-only anonymous downloads and permission to revoke shares; mandatory password policy blocks this workflow. Ensure the configured base URL and `/s/.../download` are reachable anonymously with valid TLS, no login wall, no credential-bearing redirects. Put multiple technical responders in the Talk group and add the service account. Verify service quota, outbound DNS/HTTPS to Nextcloud, tapi.bale.ai and calendar.ut.ac.ir, access to the protected spool and clock synchronization.

Create the Bale bot via the official BotFather, store its token only in the root-managed environment file, ask the single report recipient to start the bot, obtain their private chat ID and run getMe/connection tests from the admin page. The sender checks getChat type=private before every message.

## Bale private-recipient live acceptance (required before merge)

Use the **existing official Bot API**, not Safir or personal-account automation. The single responsible recipient must open the organization's Bale bot and send `/start` once. Obtain the **private conversation's numeric `chat.id`** from the approved Bale update/webhook mechanism and configure `reportRecipient` in `/settings/automations/reporter`. Do not confuse a phone number or a username with this chat ID. Verify the receiver knows and consents to one test message.

On a trusted staging host, using the existing protected automation environment (at least `DATABASE_URL` and `BALE_BOT_TOKEN`) and staging configuration, run:

```bash
# Readiness: official bot identity and private recipient, sends no messages.
node --import tsx scripts/check-bale-live.ts

# Sends exactly one distinguishable test message to the configured recipient.
node --import tsx scripts/check-bale-live.ts --send-once
```

The second command must be run **only with the recipient's approval**. Verify that its returned `messageId` is present and that the recipient actually sees the matching test marker in their Bale private chat. Record time, test marker, sanitized API status and recipient confirmation in the verification report; never include `BALE_BOT_TOKEN`, raw Authorization headers or token-bearing URLs. A successful `getMe` without an actual received message does **not** close the live-integration gate.

Keep `reporterEnabled=false` while testing so no daily report is accidentally sent. Do not add this opt-in live test to GitHub CI or the minute worker. Re-test a real Reporter delivery/link separately after Nextcloud Public Link Sharing is enabled; its disabled/manual fallback remains mandatory in the meantime.

## Staging installation (after every merge gate is closed)

Back up DB and spool first; test restore on staging. Keep automation disabled. This example assumes Node 24 and `/opt/storex/current` already contains the reviewed release, and account `storex` exists.

```bash
cd /opt/storex/current
npm ci --include=dev
npx prisma validate
npx prisma migrate deploy
npx prisma generate
python3 -m venv /opt/storex/calendar-venv
/opt/storex/calendar-venv/bin/pip install -r scripts/requirements-calendar.txt
sudo mkdir -p /opt/storex/shared/ms-playwright /var/lib/storex/automation /etc/storex
sudo chown -R storex:storex /opt/storex/shared/ms-playwright /var/lib/storex/automation
sudo chmod 0700 /var/lib/storex/automation
sudo env PLAYWRIGHT_BROWSERS_PATH=/opt/storex/shared/ms-playwright npx playwright install --with-deps chromium
sudo chown -R storex:storex /opt/storex/shared/ms-playwright
npm run build
sudo install -o root -g storex -m 0640 deploy/automation.env.example /etc/storex/automation.env
# Edit placeholders securely; set CALENDAR_PYTHON=/opt/storex/calendar-venv/bin/python.
sudoedit /etc/storex/automation.env
sudo install -m 0644 deploy/systemd/storex-automation.service /etc/systemd/system/
sudo install -m 0644 deploy/systemd/storex-automation.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now storex-automation.timer
sudo systemctl start storex-automation.service
sudo systemctl status storex-automation.timer storex-automation.service
sudo journalctl -u storex-automation.service -n 100 --no-pager
```

The service uses a read-only filesystem except spool and private /tmp, a dedicated user, no new privileges and umask 0077. Chromium must be outside the protected home directory. Ensure Node path in ExecStart matches the installation. The web service must receive the same DATABASE_URL, spool path and hostname allowlists; secrets need only be supplied to the independent worker. The worker publishes only boolean credential-configured flags in its health record.

## Dry-run, migration reconciliation and smoke checks

Run operator commands in a shell whose environment is loaded securely from the environment file; never paste credentials into a command or log. Do not run automated test suites on the production DB.

```bash
npm run automation:admin -- --status
npm run automation:admin -- --dry-run=reporter
npm run automation:admin -- --dry-run=calendar --year=1406
# One-time after provenance migration; future-only and audited:
npm run automation:admin -- --reconcile
```

The calendar dry-run stores diagnostic artifacts but never imports Calendar data. It currently fails closed at the uncertified parser. Use admin connection tests, inspect job history, verify a public-safe probe, then leave Reporter manual while sharing is disabled. On staging enable Reporter, set a controlled test recipient, verify both reminders/latest guests, one PDF/link/send, retry resumption and minute cleanup at expiry. Verify USERS cannot access admin routes/override actions and REPORTER keeps manual guest, Print and Excel controls. Compare 1/7/31/90/180/365-day UI/Excel ranges.

## Migrations and rollback

Migrations: 20261006060000_attendance_provenance; 20261006070000_automation_control_plane. Additive tables/columns/enums only; old weekly data retained. Provenance migration backfills preserved legacy/manual decisions using original statuses/timestamps. Pause Reporter/Calendar and stop the timer before rollback, but first manually revoke all outstanding public shares by recorded shareId if the cleanup service cannot run. Keep private PDFs and diagnostic artifacts. Restore the previous application release with new DB tables/columns intact; do not drop AttendanceDecision or reset weekly/manual flags. Old recurring writers must remain disabled during rollback to prevent overwriting new decisions. If restoring a DB snapshot, reconcile/revoke any shares created after that snapshot from Nextcloud before restarting. Take an explicit backup and plan data reconciliation for writes made after the backup; a destructive down migration is not supplied.

## Upstream references

- Official Nextcloud share API: https://docs.nextcloud.com/server/latest/developer_manual/client_apis/OCS/ocs-share-api.html
- Official Talk chat/conversation API: https://nextcloud-talk.readthedocs.io/en/latest/chat/ and https://nextcloud-talk.readthedocs.io/en/latest/conversation/
- Official Bale API: https://docs.bale.ai/
- Official Calendar source: https://calendar.ut.ac.ir/
