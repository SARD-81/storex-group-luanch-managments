#!/usr/bin/env python3
"""Structure/provenance audit of the University of Tehran official Jalali PDF.

This does not split composite source rows into independent calendar events.
It must NEVER be used to approve an official import on its own.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

import fitz

MONTHS = ("فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
          "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند")
DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def rtl_cell(raw: str | None) -> str:
    # The PDF encodes each cell line in visual RTL order. Reverse lines,
    # preserving their top-to-bottom order; do NOT reverse multiline blocks.
    s = " ".join(line[::-1] for line in (raw or "").splitlines()).translate(DIGITS)
    s = re.sub(r"\d+", lambda match: match.group()[::-1], s)
    return re.sub(r"\s+", " ", s).strip()


def month_of(value: str) -> int | None:
    normalized = value.replace("ي", "ی").replace("ك", "ک")
    for i, month in enumerate(MONTHS, 1):
        if month in normalized:
            return i
    if "تير" in value:
        return 4
    if "دي" in value:
        return 10
    return None


def extract_evidence(path: Path, year: int) -> dict:
    pdf = path.read_bytes()
    if not 10000 <= len(pdf) <= 20 * 1024 * 1024 or not pdf.startswith(b"%PDF-"):
        raise ValueError("PDF_BYTES_INVALID")
    with fitz.open(stream=pdf, filetype="pdf") as doc:
        if doc.is_encrypted or not 17 <= len(doc) <= 30:
            raise ValueError("PDF_LAYOUT_UNSUPPORTED")
        cover = rtl_cell(doc[0].get_text())
        if str(year) not in cover or not any(
            token in cover for token in ("میوقت", "ميوقت", "تقویم", "تقويم")
        ):
            raise ValueError("PDF_YEAR_OR_TITLE_MISMATCH")

        days = []
        lengths = []
        holidays = []
        for month in range(1, 13):
            tables = doc[month + 1].find_tables().tables
            if len(tables) != 1:
                raise ValueError("MONTH_TABLE_COUNT_INVALID")
            data = tables[0].extract()
            if not data or len(data[0]) != 4:
                raise ValueError("MONTH_COLUMNS_INVALID")
            n = len(data) - 1
            if n != (31 if month <= 6 else 30 if month <= 11 else n):
                raise ValueError("MONTH_LENGTH_INVALID")
            if month == 12 and n not in (29, 30):
                raise ValueError("ESFAND_LENGTH_INVALID")
            lengths.append(n)
            for day, row in enumerate(data[1:], 1):
                if len(row) != 4:
                    raise ValueError("MONTH_ROW_INVALID")
                date_label = rtl_cell(row[3])
                match = re.search(r"(?<!\d)(\d{1,2})(?!\d)", date_label)
                if not match or int(match.group(1)) != day:
                    raise ValueError("DATE_LABEL_INVALID")
                if day == 1 and month_of(date_label) != month:
                    raise ValueError("MONTH_LABEL_INVALID")
                date_key = f"{year}-{month:02d}-{day:02d}"
                title = rtl_cell(row[0])
                holiday = bool(re.search(r"تعط[يی]ل", title))
                days.append({"date": date_key, "page": month + 2,
                             "sourceText": title, "isOfficialHoliday": holiday})
                if holiday:
                    holidays.append(date_key)

        appendix = []
        for page_idx in range(14, len(doc)):
            for table_idx, table in enumerate(doc[page_idx].find_tables().tables):
                rows = table.extract()
                if not rows or len(rows[0]) != 2:
                    raise ValueError("APPENDIX_COLUMNS_INVALID")
                for row_idx, row in enumerate(rows, 1):
                    title, date_label = map(rtl_cell, row)
                    month = month_of(date_label)
                    day_match = re.search(r"(?<!\d)(\d{1,2})(?!\d)", date_label)
                    day = int(day_match.group(1)) if day_match else (
                        1 if re.search(r"(?:یكم|یکم|اول|نخست)", date_label) else 0
                    )
                    if not title or not month or day < 1 or day > lengths[month - 1]:
                        raise ValueError("APPENDIX_DATE_OR_TITLE_INVALID")
                    appendix.append({"date": f"{year}-{month:02d}-{day:02d}",
                                     "page": page_idx + 1, "table": table_idx,
                                     "row": row_idx, "sourceText": title,
                                     "dateLabel": date_label})

        if sum(lengths) not in (365, 366) or len(days) != sum(lengths):
            raise ValueError("YEAR_INCOMPLETE")
        if year == 1405 and (
            len(days) != 365 or len(holidays) != 26 or len(appendix) != 128
        ):
            raise ValueError("YEAR_1405_GOLDEN_STRUCTURE_MISMATCH")
        main_nonempty = sum(bool(row["sourceText"]) for row in days)
        return {"year": year, "sourceSha256": hashlib.sha256(pdf).hexdigest(),
                "pageCount": len(doc), "monthTableCount": 12,
                "monthDayCounts": lengths, "calendarDayCount": len(days),
                "mainNonemptyRows": main_nonempty,
                "appendixRowCount": len(appendix),
                "rawSourceEntryCount": main_nonempty + len(appendix),
                "officialHolidayDateCount": len(holidays),
                "officialHolidayDates": holidays,
                "eventNormalizationCertified": False,
                "reviewReason": "424_EVENT_SEMANTIC_NORMALIZATION_NOT_YET_CERTIFIED",
                "mainRows": days, "appendixRows": appendix}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf")
    parser.add_argument("year", type=int)
    parser.add_argument("--out", help="write full date/page/source-text JSON")
    args = parser.parse_args()
    try:
        result = extract_evidence(Path(args.pdf), args.year)
        if args.out:
            Path(args.out).write_text(
                json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        print(json.dumps(
            {key: value for key, value in result.items()
             if key not in ("mainRows", "appendixRows")},
            ensure_ascii=False, indent=2,
        ))
    except Exception:
        # Do not accidentally log untrusted content or local paths in workers.
        print(json.dumps({"error": "PDF_SOURCE_AUDIT_FAILED"}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
