# Verification and remaining merge gates

Status on 2026-10-06: draft PR #76; **not approved for production or merge**.

PR: https://github.com/SARD-81/storex-group-luanch-managments/pull/76

## Changes and failure recovery

Report filters now retain independent Jalali draft values across navigation, clone
mutable picker values, apply explicitly, synchronize with applied URL changes, and
use a normal download link for Excel. The browser test selects six distinct dates
and checks pending completion, URL/export agreement, Back/Forward and reload.
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
`9df9e23412632c5f48aebee6791294882d8eca22` passed:
https://github.com/SARD-81/storex-group-luanch-managments/actions/runs/37502383302

| Check | Recorded result |
| --- | --- |
| Prisma validation, generation, migrations, TypeScript, production build | PASS |
| Native database tests, including separate-session worker locking | 15 passed; no skips |
| Browser report navigation | Six repeated changes; Back/Forward/reload passed |
| SSR, login, role restrictions and UI/Excel ranges | PASS; 1/7/31/90/180/365 days |
| Existing calendar smoke scripts | All six passed |
| A5 print/server PDFs | Four scenarios; portrait approximately 420 × 595 pt |
| Empty and normal reports | One page each; no unexpected blank pages |
| Sixty long Persian employee names | Seven pages; text bounds passed; rendered sample inspected |
| 100-person, 365-day web range fixture | 244 workdays; approximately 1.1 s in that CI run |

The follow-up local suite has 18 tests: 17 passed, none failed, one deliberately
skipped native session-lock test under disposable PGlite. It includes database
fault injection after successful Bale and Talk sends, probe file deletion failure,
and manual title preservation. PGlite is not evidence for native advisory locks.
The PR's Quality gate must also pass on the final head; consult its checks for the
native results of these additional tests. CI retains PDF/screenshots/JSON evidence
in `verification-output` for 14 days. Timings describe fixtures, not a production SLA.

## Open gates

1. The official PDF extractor still emits `parserVerified=false`, no normalized
   events, and stops automatic import at `PARSER_GOLDEN_VALIDATION_REQUIRED`.
   The existing static 1405 fixture reproduces 365 days / 424 events / 26 official
   holiday dates / 244 workdays / 104 weekly offdays, but this does **not** certify
   extraction from the actual PDF. Generic layouts, partial/wrong-year PDFs and
   a complete leap-year PDF must be normalized and tested before certification.
2. Live Nextcloud/Bale/Talk staging verification has not been performed. Test
   doubles cover disabled sharing, private recipients, anonymous hash validation,
   retries and expiry, but do not prove the site's deployed policies or credentials.
3. DNS addresses are checked before fetch, but the transport does not pin that
   resolution to its connection. Close the DNS rebinding gap and verify the
   transport before clearing the security merge gate.
4. Browser coverage is not yet the full existing-feature matrix: profile/avatar,
   password changes, password resets, user activation and all guest/manual CRUD
   paths still require regression verification.
5. A production company-logo asset has not been provided. The current placeholder
   is not final branding approval.
6. Exact physical public-link revocation during worker/network outage cannot be
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
