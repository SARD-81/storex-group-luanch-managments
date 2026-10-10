# Reviewed source certificate — supplied calendar 1405

Updated: 2026-10-10. Original PDF and raw extraction/reconciliation outputs remain
outside Git and public application paths. No production import was performed.

## Source and limits

The owner supplied the 17-page final calendar declaring University of Tehran /
Geophysics Institute provenance. Exact SHA-256:

`8e32b520d5da058414b9378d62a01117273336a4c074591f4e84d59ab32a963c`

The checksum was recomputed on the supplied bytes. A fresh attempt to open the
university site on 2026-10-10 still returned a transfer/interstitial page.
Byte-for-byte authenticity against a live university download is therefore
**unverified**. This is separate from the reviewed supplied-file parser certificate.

## Structural and semantic results

| Evidence | Result |
| --- | ---: |
| Pages / complete month tables | 17 / 12 |
| Unique daily records | 365 |
| Month lengths | 31,31,31,31,31,31,30,30,30,30,30,29 |
| Main composite occasion rows / appendix rows | 189 / 128 |
| Combined source entries | 317 |
| Extracted, normalized events | 459 |
| Unique official holiday dates / holiday events | 26 / 31 |
| Company weekly off-days / final workdays | 104 / 244 |
| Unresolved rows / corrected-fixture discrepancies | 0 / 0 |

Each extracted event carries its dated source span, source page and section,
classification, calendar system, stable key and splitting rationale. Conjunctions
inside titles are preserved; catalog-aware matching splits independent occasions.
Unknown residual text blocks certification instead of being dropped.

The historical 424-event fixture at `75941c0` omitted **35 occupational occasions
from page 17**. Two titles also differed from their printed source:

| Date | Baseline | Source-corrected wording |
| --- | --- | --- |
| 1405-03-27 | `... در ۱۳۵۸ هـ ش` | `... ۱۳۵۸ هـ ش` |
| 1405-09-09 | `(هشت سال قبل از هجرت)` | `(هشتم قبل از هجرت)` |

The latter preserves the printed wording even if it appears unusual; it is not
silently editorialized. Exact protected comparison reports 37 unmatched parsed
titles and two unmatched baseline titles: 35 omissions plus the two replacements.
All unchanged matched events have zero metadata differences. The corrected
459-event fixture and real-PDF extraction match on date, title, classification,
calendar system, holiday flag, source page/section and display order.

## Certification and future sources

Parser version: `ut-evidence-parser-v2`. Reviewed source certificate:
`scripts/official_calendar/certificates.json`; semantic hash:
`b0c91b9e21b3b09dbd752751af45ce34395a229e2fcb17aa479ac6daa3430d17`.

The Python parser actually reads PDF tables. The TypeScript boundary independently
checks all daily Jalali/Gregorian/weekday relationships, holiday consistency and
the reviewed semantic certificate. A forged `parserVerified` flag is insufficient.
Only this reviewed source edition is certified. A different hash/year/layout,
unknown event or changed semantic content requires source review and a new
reviewed certificate; administrator dataset approval cannot bypass certification.
Leap/non-leap structures and adverse cases are tested with synthetic documents;
no second real official leap-year PDF has been supplied, so no claim is made that
one has been independently certified.

## Reproduce without production data

```bash
python3 -m pip install -r scripts/requirements-calendar.txt
python3 scripts/audit-official-calendar-pdf.py /secure/Calendar-1405.pdf 1405 \
  --out /secure/calendar-source-evidence.json
python3 scripts/parse-official-calendar.py /secure/Calendar-1405.pdf 1405 \
  > /secure/calendar-parsed.json
# Use an archived copy of data/calendar/iran/official-1405 from 75941c0:
node --import tsx scripts/reconcile-calendar-1405.ts \
  --parsed-json=/secure/calendar-parsed.json \
  --baseline-module=/secure/baseline/data/calendar/iran/official-1405/index.ts \
  --out=/secure/calendar-reconciliation.json
```

On an isolated localhost database ending `_test`, with DATABASE_URL and
TEST_DATABASE_URL pointing to the same database:

```bash
node --import tsx scripts/check-calendar-pdf-pipeline.ts \
  --pdf=/secure/Calendar-1405.pdf \
  --sha256=8e32b520d5da058414b9378d62a01117273336a4c074591f4e84d59ab32a963c
```

The real supplied-PDF pipeline passed locally with PGlite: staging did not mutate
the active calendar; admin import produced 365 days / 459 events / 26 holidays /
104 weekly off-days / 244 workdays; historical manual attendance was unchanged;
repeat import was idempotent; changed-source and wrong-year input were rejected.
This local run is not evidence for native PostgreSQL advisory locking. Separate
native CI integration tests check import review, fallback promotion, override
preservation, migrations and multi-session worker locks.
