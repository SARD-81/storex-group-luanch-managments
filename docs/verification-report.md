# Verification and remaining merge gates

Status updated 2026-10-10: draft PR #76; **not approved for production or merge**.

Current requirement matrix and Persian acceptance report: [acceptance-report-fa.md](acceptance-report-fa.md).
The calendar/logo/full-browser additions supersede the historical 2026-10-06 checkpoint below.

PR: https://github.com/SARD-81/storex-group-luanch-managments/pull/76

## Changes and failure recovery

Report filters now retain independent Jalali draft values across navigation, clone
mutable picker values, apply explicitly, synchronize with applied URL changes, and
use a normal download link for Excel. The browser test selects six distinct dates
and checks pending completion, URL/export agreement, Back/Forward and reload.
Repeated date query parameters are rejected consistently by the page and Excel,
with both boundaries covered in the web regression checks.
The earlier native CI failed in browser navigation. The combined component and
test fixes passed; the original main-branch failure has not been independently
reproduced, so this does not establish one exclusive root cause.

Calendar imports share the attendance transaction lock and reconcile current and
already-generated future automatic coverage. They retain manual override titles;
official flag recomputation includes holidays from unrelated official sources.

Report artifact identity and its frozen snapshot commit together. Bale business
delivery, guest reminders and Talk alerts separate sending from receipt storage.
A lost acknowledgement write retains the persisted send intent and requires
manual resolution instead of automatic resend. Unknown transport failures are
also treated conservatively. The probe cleanup intent survives successful public
revocation followed by a failed private-file deletion, including across dates.

## Recorded evidence

The complete native PostgreSQL 17 run for commit
`3c258a9344cb282e78920da3eb718e5e7ca6c61d` passed:
https://github.com/SARD-81/storex-group-luanch-managments/actions/runs/37505451428

| Check | Recorded result |
| --- | --- |
| Prisma validation, generation, migrations, TypeScript, production build | PASS |
| Native database tests, including separate-session worker locking and real TLS pinning | 20 passed; no skips |
| Browser report navigation | Six repeated changes; Back/Forward/reload passed |
| SSR, login, role restrictions and UI/Excel ranges | PASS; 1/7/31/90/180/365 days |
| Existing calendar smoke scripts | All six passed |
| A5 print/server PDFs | Four scenarios; portrait approximately 420 × 595 pt |
| Empty and normal reports | One page each; no unexpected blank pages |
| Sixty long Persian employee names | Seven pages; text bounds passed; rendered sample inspected |
| 100-person, 365-day web range fixture | 244 workdays; approximately 1.5 s in that CI run |

The subsequent transport-hardening local suite has 20 tests: 19 passed, none failed, one deliberately
skipped native session-lock test under disposable PGlite. It includes database
fault injection after successful Bale and Talk sends, probe file deletion failure,
and manual title preservation. New transport tests use a real local TLS socket
with an unresolvable hostname: the pinned address connects, SNI is preserved,
trusted certificates work, and untrusted/wrong-host certificates are rejected.
Mixed public/private and empty DNS answers are rejected before connecting.
Requests now use a bounded response and a per-request pinned dispatcher, including
each allowed redirect. PGlite is not evidence for native advisory locks.
The PR's Quality gate must also pass on the final head; consult its checks for the
native results of these additional tests. CI retains PDF/screenshots/JSON evidence
in `verification-output` for 14 days. Timings describe fixtures, not a production SLA.

## Live Bale Bot API evidence (2026-10-10; operator workstation)

The project operator performed a real HTTPS Bot API smoke test from their
Linux workstation, using the newly created StoreX notification bot. The operator
reported the following observed outputs (credentials and chat ID omitted here):

- `getMe` -> `ok=true`; the bot authenticated successfully.
- `getWebhookInfo` -> no active webhook (polling was used only for onboarding).
- `getUpdates` -> `ok=true`, two updates from the same private chat.
- `getChat` -> `ok=true`, `type=private`, chat ID matched the requested destination.
- After explicit `SEND` confirmation: `sendMessage` -> `ok=true`, `message_id=3`.

Following a second check, the project operator **explicitly confirmed the test
message was visible in the intended private Bale conversation**. Therefore,
the direct-workstation live Bot API **send-and-receive** acceptance is PASS
(`sendMessage ok=true`, `message_id=3`, recipient-side visual confirmation).
This does **not yet prove** the StoreX TypeScript `BaleClient` running on staging,
scheduled reminder delivery, Nextcloud PDF-link delivery, or production networking.
Run `scripts/check-bale-live.ts` with the staging ENV, verify its message visibly
arrives, and capture sanitized staging evidence before closing that separate gate.
Keep bot tokens and chat IDs out of this report.

Decision: standard Bale Bot API only; the recipient may send `/start` once.
No Safir, personal-account automation, or new Bale sender identity is required.

## Current implementation and acceptance work (2026-10-10)

- Real supplied 1405 PDF parsed by `ut-evidence-parser-v2`: 365 daily mappings,
  459 events, 26 holiday dates, zero unresolved entries. The source checksum and
  semantic certificate match; all corrected fixture fields match the extraction.
  Historical 424 reconciliation identified 35 omitted occupations and two title
  transcription corrections; unchanged metadata matches. See the updated
  [source audit](calendar-1405-pdf-audit.md).
- Supplied-file acquisition/staging/approval/import proof passed locally on
  disposable PGlite, including historical attendance and repeat-import safety.
  Native CI separately verifies review/promotion, migration and multi-session
  locks. Do not confuse the local WASM run with native lock evidence.
- Current-year recovery is independent of Esfand next-year discovery, including
  missed windows, Nowruz role rollover, backoff preservation and emergency data.
- Admin branding supports persistent previews, revision-protected activation,
  previous/default rollback, audit, decoded raster validation and storage fallback.
  UI, manual print, server PDF and Reporter Excel share the active asset.
- Existing-feature browser coverage now exercises user creation/activation,
  login/logout, profile/avatar/change/reset, guest create/update/delete, ordinary
  attendance, admin override/clear, company calendar override, emergency twelve
  months/CSV/apply, automation pause/resume/queue, and branding on all surfaces.
  The corrected suite passed the recorded native CI run below.
- PDF acceptance now distinguishes actual header logos from background tiles,
  verifies embedded Type3 glyph streams plus ToUnicode instead of requiring only
  TTF streams, and allows at most one CSS pixel of placement quantization.
  Long-name content is checked around lam-alef ToUnicode extraction differences;
  rendered glyphs remain subject to visual review. Print explicitly uses light
  paper color scheme; PDF corner pixels and DOM checks prevent dark margins.
  Reporter Excel retains the actual logo ratio, checked in the exported workbook.
- Reconciliation/review-image CLI tools now execute under this project's CommonJS
  TypeScript mode; previously top-level await prevented the documented commands.
- Local domain run: 28 total, 27 passed, zero failed, one native-lock skip.
  Python: 26 passed. Current local lockfile audit: zero vulnerabilities.
  CI stores main/current audit snapshots; the recovered 2026-10-10 main snapshot
  has 34 findings (2 critical), not an immutable historical count.

## Recorded engineering acceptance (2026-10-10)

[Quality gate run 38038462350](https://github.com/SARD-81/storex-group-luanch-managments/actions/runs/38038462350)
is **PASS** on implementation commit `f14f543e7486df212b8ffde1f3c2c85881d1a38e`:

- PostgreSQL 17: 28 domain/security/migration/lock tests passed, zero failures and
  zero skips. Python parser: 26 passed. Prisma validation/generation/migrations,
  TypeScript and production build passed.
- Existing-feature browser suite, six repeated date changes and navigation,
  desktop/mobile filters, UI/Excel ranges of 1/7/31/90/180/365 days, global branding
  with three image fixtures and rollback, 11 PDF scenarios, and all six existing
  calendar service checks passed.
- Manual-print/server-PDF images were visually reviewed: readable Persian and
  wrapped names, repeated table headings on the last long-name page, totals,
  signature, light margins and undistorted logos. Branding previews and desktop
  report were reviewed. The full-height mobile screenshot was inspected at its
  original width: the RTL date picker stays within the 390px viewport.
- CI lockfile snapshots: current zero findings; same-run main 34 findings,
  including 2 critical. These are advisory-database snapshots, not permanent counts.
- `verification-output` artifact ID `11665166481`, retained for 14 days. Downloaded
  archive SHA-256 matches GitHub's digest:
  `64745728c1aef9b8d5539c5e08e940b1ba36b0ce83afb9c984f4b811343c31f3`.
  It contains only isolated synthetic acceptance fixtures, not the supplied source
  PDF or real service credentials. Its long mobile screenshot should be viewed at
  original size rather than shrunk to the image-log thumbnail's 1050px height.

Prior runs `38036552817` and `38037853789` exposed PDF-inspection and cached-hidden
logo-selector errors, respectively; both were fixed and rerun. Their failed states
are not acceptance. The final documentation commit must also have a green Quality
gate; the PR body and Checks contain the exact final head/run without requiring a
self-referential commit hash in this file.

## Open gates

1. **Live staging integrations:** workstation Bale send-and-receive is confirmed
   by the owner, but actual StoreX BaleClient, Nextcloud anonymous PDF/share cleanup
   and Talk group delivery remain unperformed. No credentials/staging access are
   supplied to this runtime. Use the opt-in live scripts and runbook; no live sends
   belong in CI.
2. **Source download provenance and future certification:** the supplied file is
   certified; the live university site still returns a transfer page, preventing
   independent download/hash comparison here. Different years/editions fail closed
   until reviewed certification, even if their structure parses successfully.
3. **Operational staging:** prepare the service account, StoreX Automation Alerts
   group, durable shared spool/branding, credentials, worker timer, backup/restore
   and monitoring, then verify controlled reminders, delivery and outage recovery.
   The owner has accepted first-tick revocation at/after exact stored 24-hour expiry
   with outage delays; a custom gateway is not a remaining requirement.

The original displayed company fallback is explicitly accepted by the owner;
missing approval for a new logo is not a blocker. The tracked repository has no
company-logo.png, so the existing title placeholder remains until an administrator
uploads one or the deployment supplies its original file. Do not invent branding.

## Review and operations

No destructive schema drop is introduced. WeeklyMealPreference and historical
attendance are retained; populated-schema migration tests protect their statuses
and timestamps. Attendance precedence, explicit user cancellation, admin locks,
future-only automatic reconciliation and Reporter exclusion have deterministic
coverage. Manual Reporter and Excel remain accessible when sharing is disabled.
No auth subsystem rewrite or unrelated design replacement is included. SQL query
logging is disabled to avoid recording integration metadata. Remote failure bodies
and secrets are not stored as job errors.

Use [automation-runbook.md](automation-runbook.md) for environment configuration,
DevOps handoff, dry-run, migration, rollback and manual fallback. Keep automations
disabled and the PR unmerged until every open correctness/security/verification
gate is closed.

## Subsequent owner decisions and implementation (2026-10-10, PR #76)

The owner authorized automatic admission of future official year PDFs only if
strict independent validation succeeds; suspicious semantics/layout changes must
stay blocked for review. The supplied 1405 PDF is accepted despite lack of
live online byte-for-byte provenance comparison. Organizational Nextcloud
acceptance will wait for the production organization environment, and the
actual Bale recipient is **not** the earlier tested private chat.

A new auto-attestation path for unseen 1406+ trusted University HTTPS sources
was introduced in the same draft PR, with fail-closed semantic parsing,
independent date/holiday checks, ENV-only HMAC verification of persisted data,
and explicit regression tests. The old 1405 pinned certificate remains intact.
This new commit requires fresh CI; **do not treat previous CI as verification
for the changed commit**. Real future University PDF variations and all
external integration/operational tests remain outstanding. Keep PR Draft and
unmerged until evidence and explicit owner approval are obtained.
