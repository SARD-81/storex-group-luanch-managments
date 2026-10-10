# Golden source audit — uploaded official calendar 1405

Date: 2026-10-10
Scope: inspect the user-supplied 17-page PDF **without importing it**.

The operator supplied a full `Calendar-1405.pdf` file from the purported
University of Tehran / Geophysics Institute official calendar. The document's
first page declares `نسخه نهایی` and year 1405. File authenticity beyond
that title and the user's supplied provenance has **not** been independently
verified against a live university download.

SHA-256 (exact uploaded file):
`8e32b520d5da058414b9378d62a01117273336a4c074591f4e84d59ab32a963c`

Source-layout audit results, executed with PyMuPDF on the supplied bytes:

| Evidence | Observed |
| --- | ---: |
| Pages | 17 |
| Monthly tables (pages 3–14) | 12 |
| Daily rows | 365 |
| Month lengths | 31,31,31,31,31,31,30,30,30,30,30,29 |
| Main-month rows with occasion text | 189 |
| Appendix rows (pages 15–17) | 128 |
| Combined *source* entries | 317 |
| Unique official holiday dates marked تعطیل | 26 |
| Existing manually normalized 1405 fixture | 424 events |

**317 source entries != 424 normalized events.** Several main-table cells
contain multiple independent occasions. Splitting on `و` is unsafe, since
the conjunction also appears inside names and descriptions. In particular,
this result does NOT certify each of the existing 424 normalized fixture
entries or their classifications. The official importer's existing
`parserVerified=false` fail-closed gate MUST remain in force until semantic
normalization, date-by-date content comparison and golden-layout certification
are complete. No production DB import was performed.

The following 26 official holiday dates were read from the uploaded PDF:

`1405-01-01, 1405-01-02, 1405-01-03, 1405-01-04, 1405-01-12,
1405-01-13, 1405-01-25, 1405-03-06, 1405-03-14, 1405-03-15,
1405-04-03, 1405-04-04, 1405-05-13, 1405-05-21, 1405-05-22,
1405-05-30, 1405-06-08, 1405-08-22, 1405-10-02, 1405-10-16,
1405-11-04, 1405-11-22, 1405-12-09, 1405-12-19, 1405-12-20,
1405-12-29`.

## How to reproduce on the real PDF

```bash
python3 -m pip install -r scripts/requirements-calendar.txt
python3 scripts/audit-official-calendar-pdf.py \
  /secure/location/Calendar-1405.pdf 1405 \
  --out /secure/location/calendar-1405-source-evidence.json
```

This audit makes no network requests and writes no database rows. The resulting
JSON contains all 365 dated main rows and 128 dated appendix rows with their
original source page number. Keep uploaded PDF and raw audit outputs in
access-controlled storage, not publicly served paths.

## Remaining certification work

1. Compare all 424 individually normalized fixture entries with dated PDF
   source rows (including multi-event cells, appendix items, and holiday flags).
   Make ambiguity explicit in a reviewed diff. Do not silently guess missing events.
2. Implement verified normalized extraction for future years, with strict
   malformed, wrong-year, missing-month, and leap-year rejection.
3. Only set `parserVerified=true` after complete independent checks pass.
4. Test staging import, Admin review for changes to an active year,
   preservation of organizational overrides, and attendance reconciliation.
5. Document canonical source retrieval and/or approved admin PDF upload; the
   existing calendar site was previously returning transfer pages.

Source file itself is **not committed to the repository**; only this audit
and the reproducible audit utility are committed.
