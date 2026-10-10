# Verification and remaining merge gates

Status on 2026-10-06: draft PR #76; **not approved for production or merge**.

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

## Open gates

1. The official PDF extractor still emits `parserVerified=false`, no normalized
   events, and stops automatic import at `PARSER_GOLDEN_VALIDATION_REQUIRED`.
   The existing static 1405 fixture reproduces 365 days / 424 events / 26 official
   holiday dates / 244 workdays / 104 weekly offdays, but this does **not** certify
   extraction from the actual PDF. Generic layouts, partial/wrong-year PDFs and
   a complete leap-year PDF must be normalized and tested before certification.
   The currently retrieved 1405 files are one-page transfer notices, not the
   twelve-month university calendar; they cannot serve as a golden PDF fixture.
2. The operator's live workstation Bale private send-and-receive test succeeded,
   including recipient-side confirmation (see above). Staging execution through
   the StoreX `BaleClient` and live Nextcloud/Talk integrations remain open.
   Test doubles cover
   disabled sharing, private recipients, anonymous hash validation, retries and expiry,
   but do not prove the deployed service policies or credentials.
3. Browser coverage is not yet the full existing-feature matrix: profile/avatar,
   password changes, password resets, user activation and all guest/manual CRUD
   paths still require regression verification.
4. A production company-logo asset has not been provided. The current placeholder
   is not final branding approval.
5. Exact physical public-link revocation during worker/network outage cannot be
   guaranteed. The worker revokes at the first tick at/after the exact stored
   expiry and records failures. Verify the operational timer and monitoring on
   staging and assess this limitation against the required 24-hour policy.

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
