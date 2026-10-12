## Current policy (2026-10-12): no automatic deletion of Bale PDF messages

The owner removed the 24-hour retention requirement. New direct Bale PDF reports and opt-in synthetic test documents remain in the private chat without an application-enforced expiry. The worker does not invoke Bale deleteMessage, including for previously queued deletion records. Existing deletion metadata is retained as historical evidence, never interpreted as a new deletion requirement. The previous deletion instructions below are obsolete and preserved only for migration history. Do not enable manual retry/deletion on the basis of those instructions. Nextcloud legacy share cleanup is independent and remains supported. Successful deliveries remain idempotent. To live-test, pause Reporter, configure the authorized recipient private chat, run `node --import tsx scripts/check-bale-document-live.ts --check` and then, with recipient consent, `node --import tsx scripts/check-bale-document-live.ts --send-document-once`; confirm the PDF arrives and verify it remains available after 24 hours. No deletion is expected.

# Attendance, Reporter and Calendar operations

Status: **draft / not approved for production deployment**. Read `verification-report.md` before merging or deploying this branch.

Current contract (2026-10-12): new reports are private PDF bytes sent directly
with Bale sendDocument. Nextcloud Files/Public Sharing and Talk are not Reporter
prerequisites. Manual Print/Excel/guest operations remain available. Historical
Nextcloud shares still need their original credentials for cleanup. Talk defaults
to disabled and has an independent configuration page.

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

Generate the unchanged A5 PDF, store a protected SHA-256-addressed artifact,
validate PDF signature/MIME/size (conservative 50,000,000-byte cap), verify the
existing @storex_lunch_notify_bot and private destination, and upload multipart
bytes via sendDocument. No new report share/public URL is generated. Generation
and snapshot commit together; retries reuse the same private bytes. The delivery
persists chat/message identity, API sent time (or successful receipt time), and
24-hour deletion due time. Deletion does not change successful delivery status.
An uncertain send or lost DB acknowledgement stays held for human review; never
blindly resend. The admin must supply actual message ID and timezone-bearing send
time when confirming receipt, or explicit evidence that no send occurred.

The same locked minute worker processes Bale deletion before ordinary jobs, even
while Reporter/Talk is disabled, on holidays and after restart. deleteMessage must
return literal true before DELETED/receipt is committed. Uncertain deletion is
safe to retry for the same stored IDs; not-found/forbidden are not false success.
Retries use 1/2/5/15/30-minute backoff (30-minute ceiling) and honor retry_after.
Overdue, failure, six-hours-before-deadline, expired-window and recovery alerts
persist internally. The API permits deletion only when message age is less than
48 hours: at that deadline the worker records WINDOW_EXPIRED and human action.
For missing API date the deadline starts conservatively from the pre-send intent,
while due time uses the response receipt. Worker/network outages can delay
physical deletion. Deleting the chat message cannot erase downloaded copies,
forwarded files or screenshots. DeletedAt denotes the confirming worker tick.

Legacy public-share and probe cleanup remains separate; it requires the original
Nextcloud credentials and does not operate on new Bale documents. Public capability
probes are now explicit operator jobs, not the new delivery prerequisite.

Technical Talk alerts target only a private group (type=2), a service-account
participant and writable chat permission. Talk is optional; errors do not undo
independent report/delete/calendar jobs. Activation keeps pre-activation or older
than 24-hour backlog internal (SKIPPED with a reason); at most three fresh alerts
are dispatched per tick, with exponential retry up to one hour and ten attempts.
Ambiguous sends/lost receipt writes require manual review. See the independent
[Persian setup guide](nextcloud-talk-technical-alerts-setup-fa.md).

## Admin configuration

Routes: `/settings/automations`, `/settings/automations/reporter`, `/settings/automations/calendar`, `/settings/automations/talk`. Only active ADMIN accounts may view or submit actions. Configure Reporter with its verified private Bale recipient, timings and pause flag. Configure optional Nextcloud/Talk separately; calendar source/archives remain separate settings. Connections, run now, dry-run and retry controls enqueue durable worker jobs. The web request performs no outbound delivery. Reporter delivery/deletion/retry status is visible on `/reporter/next-day`.

Secrets are ENV-only; admin screens display only configured/not-configured flags. Allowlisted URLs must use HTTPS and port 443 without credentials. Credential-bearing redirects are refused. Unapproved hosts, loopback/private metadata addresses and oversized responses are blocked. Every connection is pinned to its checked DNS address while preserving hostname/SNI and TLS certificate verification; each allowed redirect is checked again. An explicitly allowlisted private Nextcloud host is the only private-address exception. Errors persist fixed codes, never remote response bodies, Authorization headers, passwords or token-bearing Bale URLs.

## Automatic official calendar acceptance for future years

The owner's current policy: import future PDFs automatically when independently
and exhaustively validated; escalate suspicious cases for human review.
The supplied official-source PDF for 1405 is accepted by the owner with the
documented lack of independent online byte-for-byte provenance. The immutable
1405 reviewed SHA-256 certificate is not relaxed.

Unseen 1406+ sources can be automatically accepted without a preinstalled
certificate only after all these checks:
- Download via verified HTTPS from `calendar.ut.ac.ir`; private/operator PDFs
  and alternate approved hosts are intentionally review-only.
- PyMuPDF extracts a complete supported 12-month structure, every daily
  Gregorian/Jalali/weekday/Hijri reference, and every known occasion text.
  Unknown fragments, unclassified holidays or changed page layout fail closed.
- Node validates all daily mappings independently, including holiday flags,
  and every month must contain at least one represented occasion.
- The worker signs only normalized and complete data using an ENV-only HMAC.
  The database stage/apply gates verify the signature on every read.

Set `CALENDAR_ATTESTATION_KEY` to a truly random **64-character hex** string
from `openssl rand -hex 32`; provide the same key in the protected environment
for every web and worker instance. No default key or logged secret. Store and
back it up securely. Key rotation/loss makes old auto-attested staged datasets
unverifiable until safely re-attested using the original trusted PDF; do not
rotate casually. Missing or invalid key stops only the new automatic path.

Conservative handling is deliberate: unrecognized *new* occasion titles are
considered suspicious, not ignored or confidently inferred. A new source that
fails may be inspected using the protected PDF/parser evidence and company
emergency tools, while no unsafe import is performed. Future published PDF
layouts are not guaranteed. An active-year revised official calendar or an
existing emergency import still requires explicit admin diff approval, exactly
as before. Final direct-delivery acceptance needs the authorized **different** Bale recipient
and real sendDocument/deleteMessage evidence. Optional Talk live tests remain
pending until the organization provides its environment. The workstation test
account does not establish either gate.

## Calendar and emergency mode

Starting 1 Esfand, check the next Jalali year daily. Discover the year PDF href from `https://calendar.ut.ac.ir/`; do not hardcode Liferay document UUIDs. Download is size-bounded and checks PDF magic, then hashes, extracts with PyMuPDF, validates/stages and imports in one transaction with post-count verification. Failed extraction/validation never modifies the active year. Original PDF and extraction/diff JSON are retained in the protected spool and synchronized privately when Nextcloud recovers.

The supplied 1405 source is now certified by `ut-evidence-parser-v2`: 365 days,
459 events, 26 official holiday dates, 244 final workdays and 104 weekly off-days.
The former 424-event fixture omitted 35 occupational entries and had two title
transcription differences. See `calendar-1405-pdf-audit.md`. Certification checks
the exact PDF hash and extracted semantics; a new edition/year requires reviewed
source certification **unless** the conservative new-year automatic
attestation described above passes. Forged parser flags still fail. Unsupported
sources retain the active calendar and report `PARSER_SOURCE_REVIEW_REQUIRED`.

Every enabled calendar tick also schedules/resumes a missing/unverified current
Jalali year, independently of next-year Esfand checks. A missed Esfand window or
Nowruz restart does not defer recovery for another year. Emergency holidays and
organization overrides remain until an approved source diff is applied. Ordinary
occasions need not be entered in emergency mode.

Emergency UI offers all 12 months, Persian/Arabic/English digits, slash/hyphen dates, multiline `1406-01-01 | نوروز`, and CSV:

```csv
jalali_date,title,is_official_holiday
1406-01-01,نوروز,true
1406-01-02,نوروز,true
```

Rows are validated with row errors, identical duplicates deduplicated and conflicting titles rejected. Preview includes holidays added/removed/matching, title changes and workday impact. Apply requires explicit diff approval; a fingerprint rejects stale previews. Source `manual-official-calendar-fallback` is independent of normal overrides. Applying replaces only its own events for that year, preserves unrelated sources/overrides, recomputes final flags, post-verifies and reconciles future attendance. A later official dataset must show its diff and explicitly approve removal of the fallback. Existing active-year official source changes require admin approval.

## Required environment

- DATABASE_URL: production PostgreSQL connection.
- Optional NEXTCLOUD_USERNAME / NEXTCLOUD_APP_PASSWORD: only for Talk, calendar private archive or historical-share cleanup; not new Reporter delivery.
- BALE_BOT_TOKEN: official bot token.
- Optional AUTOMATION_ALLOWED_NEXTCLOUD_HOSTS: required only when enabling a Nextcloud integration.
- AUTOMATION_SPOOL_DIR: durable protected spool directory, writable by worker and readable by admin artifact route if web/worker are separate.
- BRANDING_STORAGE_DIR: absolute protected durable logo directory shared by web and worker; default is the branding subdirectory of AUTOMATION_SPOOL_DIR.
- STOREX_APP_ORIGIN: canonical HTTPS application origin for authenticated reminder links.
- STOREX_ENVIRONMENT: set staging only on the controlled staging host for opt-in live probes.
- PLAYWRIGHT_BROWSERS_PATH: installed Chromium location; alternatively use an explicit executable path.

Optional: AUTOMATION_ALLOWED_PRIVATE_HOSTS, CALENDAR_APPROVED_SOURCE_HOSTS, CALENDAR_PYTHON (default python3), PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, REPORT_PDF_FONT_PATH. Set NODE_ENV=production and TZ=Asia/Tehran. Existing AUTH_COOKIE_SECURE should be true behind production HTTPS. TEST_DATABASE_URL and TEST_PGLITE are test-only and must never be installed in production. The sample is `deploy/automation.env.example`.

## DevOps handoff

For direct Reporter, provide PostgreSQL, durable protected spool, Chromium/fonts,
worker timer, HTTPS egress to tapi.bale.ai and canonical authenticated app origin.
NTP and an external health monitor are mandatory. Nextcloud Public Sharing is not
required. For optional Talk use the dedicated Persian guide. Retain old Nextcloud
access until every historical share/probe has been cleaned up. Calendar private
archives sync when optional Nextcloud credentials are available.

Use the existing `@storex_lunch_notify_bot` (https://ble.ir/storex_lunch_notify_bot); do not recreate it. Store its token only in the root-managed environment file. The one approved recipient sends `/start` once; configure the verified private chat ID and run readiness checks. The sender checks getChat type=private before every message.

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

Keep `reporterEnabled=false` while testing so no daily report is accidentally sent. Do not add this opt-in live test to GitHub CI or the minute worker. Use the synthetic PDF probe below, then separately verify a controlled real Reporter schedule. Public Sharing status does not gate direct delivery.

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

The calendar dry-run never promotes/imports its staged dataset. On controlled
staging verify 09:20/09:25 reminders with updated guests, 09:30 direct PDF bytes,
immutable snapshot, receipt, retry and first-tick deletion at/after 24 hours.
Do not add live scripts to CI. After explicit permission from the configured real
recipient (different from the old test account), keep Reporter paused and run:

```bash
node --import tsx scripts/check-bale-document-live.ts --check
node --import tsx scripts/check-bale-document-live.ts --send-document-once
# Later the existing minute worker deletes the synthetic probe too.
npm run automation:admin -- --deletions
npm run automation:admin -- --health-check
```

Confirm visible PDF receipt and later visible removal in the intended chat;
record sanitized probe ID, message ID, times, hash, API result and operator
confirmation. Failed/ambiguous probe intent blocks blind reruns; resolve it from
actual chat evidence. Immediate operator deletion is not a 24-hour scheduler test.
Verify ordinary roles cannot access the new Talk/admin routes and manual Reporter,
Print/Excel/guests remain usable without any Nextcloud environment.

## Migrations and rollback

Migrations: 20261006060000_attendance_provenance;
20261006070000_automation_control_plane; 20261010090000_global_branding;
20261012070000_bale_document_delivery. All are additive; old weekly/history and
legacy share IDs/URLs/times remain intact. New kind/deletion enums are separate.
Existing reports default to LEGACY_NEXTCLOUD/NOT_APPLICABLE; new rows explicitly
use BALE_DOCUMENT. No destructive down migration is supplied.

Back up PostgreSQL and spool/branding together; protect credentials separately.
Test a restore on an isolated database and compare hashes/receipt IDs. Restoring a
snapshot can resurrect old pending intents: pause new sends, compare actual chat
and legacy shares against external receipts before resuming. Never reuse a stale
snapshot to blindly send a report again.

For rollback, disable new Reporter/Calendar delivery first, **retain this release's
worker and migrations** until every direct-message deletion and old-share cleanup
is complete. Roll back only the web release. Point the existing service to the
retained worker release (not the rolled-back directory), add --cleanup-only to
ExecStart through a reviewed systemd override, daemon-reload and restart its timer.
The cleanup-only path sends no new report/reminder and still processes stored Bale
identities independently of Talk. Keep bot/DB/spool and old Nextcloud credentials
available. Do not stop cleanup for 48 hours or install the old worker over it.
After all pending cleanup is reconciled, retire the retained worker deliberately.
Do not drop AttendanceDecision or reset weekly/manual flags; keep old recurring
writers disabled. Plan explicit reconciliation for writes after a backup.

External monitoring must run --health-check at least every minute and alert when
the last tick is older than five minutes or deletions are overdue. A stopped worker
cannot send its own Talk alert while stopped: the dashboard shows stale activity,
and an internal gap alert is queued on recovery. Use an independent monitor/on-call
channel so disabled Talk or a dead host cannot hide the problem. Escalate before
six hours remain to the API deadline; WINDOW_EXPIRED requires human action, never
fake DELETED. A not-found response remains a manual review even after a lost prior
acknowledgement. Retain the successful delivery status after deletion.

## Upstream references

- Official Nextcloud share API: https://docs.nextcloud.com/server/latest/developer_manual/client_apis/OCS/ocs-share-api.html
- Official Talk chat/conversation API: https://nextcloud-talk.readthedocs.io/en/latest/chat/ and https://nextcloud-talk.readthedocs.io/en/latest/conversation/
- Official Bale API: https://docs.bale.ai/
- Official Calendar source: https://calendar.ut.ac.ir/


## Global branding storage and rollback

`/settings/branding` is ADMIN-only. Upload preview does not change the active logo.
PNG/JPEG/WebP signatures and decoded pixels are checked (2 MiB input/output,
16–6000 pixels per axis, 16 million input pixels, one frame). Images are stripped
and normalized to bounded PNG, retaining transparency. SVG is refused. Attempts
are rate limited; stale concurrent approval fails instead of overwriting another
admin. Content-addressed PNG files are mode 0600 in a mode-0700 directory; active
references, revision and audit history swap atomically under a transaction lock.

The originally displayed fallback is accepted by the owner. If the installation
has `public/company-logo.png`, it remains the original fallback; otherwise the
existing company-title placeholder remains. Do not invent a company logo.
Previous/default rollback is available. Missing/corrupt active bytes fall back
and the branding page reports storage trouble. Web and worker must share both
database and durable directory. Back up/restore PNG files together with
BrandingAsset/BrandingConfig/BrandingAudit; check hashes before re-enabling.
Keep revision references intact. Historical delivered PDFs are not regenerated.

The asset is used in login/dashboard/admin/profile/Reporter surfaces, manual A5
print, server PDF and Reporter Excel. Print forces a light paper color scheme
when the UI is dark. Export images retain the actual aspect ratio. Never point
BRANDING_STORAGE_DIR at the build directory or a public path. The supplied
systemd worker permits `/var/lib/storex/automation`; if branding or spool is
elsewhere, adjust `ReadWritePaths` explicitly for that directory.

## Controlled optional Nextcloud and Talk acceptance

Use [nextcloud-talk-technical-alerts-setup-fa.md](nextcloud-talk-technical-alerts-setup-fa.md)
for the private group, service account, ENV setup, health checks and opt-in test
receipt. Prefer check-talk-live.ts, which does not require WebDAV/Public Sharing.
check-nextcloud-live.ts --probe-share remains only an explicitly approved legacy
capability/cleanup diagnostic; it is not required for new report delivery.
Optional Talk receipt is pending until company setup/permission is supplied.
No production enablement, deployment or PR merge is authorized by this runbook.
