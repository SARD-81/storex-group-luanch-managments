"""Evidence-first University of Tehran text-table parser.

Unsupported semantics remain review-required. No year/date lookup supplies events.
The public catalog contains previously curated titles, not source PDF/extraction.
Full source spans are returned only to the protected worker spool.
"""

from __future__ import annotations
import contextlib
import datetime as dt
import hashlib
import io
import json
import re
from pathlib import Path
import fitz

VERSION = "ut-evidence-parser-v2"
MONTHS = (
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند",
)
GREGORIAN = (
    "ژانویه",
    "فوریه",
    "مارس",
    "آوریل",
    "مه",
    "ژوئن",
    "ژوئیه",
    "اوت",
    "سپتامبر",
    "اکتبر",
    "نوامبر",
    "دسامبر",
)
DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
CHARS = str.maketrans("يىكۀة", "ییکهه")
# Reviewed defects in this font's text encoding. These are glyph/ligature repairs,
# not substitutions for absent source occasions. Unknown residue blocks approval.
REPAIRS = {
    "اسالم": "اسلام",
    "انقالب": "انقلاب",
    "والدت": "ولادت",
    "اوالدت": "ولادت",
    "اولدت": "ولادت",
    "الهل": "الله",
    "لهال": "الله",
    "للها": "الله",
    "لله ا": "الله",
    "اعالم": "اعلام",
    "اطالع": "اطلاع",
    "ااطلعات": "اطلاعات",
    "میال": "میلا",
    "سالح": "سلاح",
    "هالل": "هلال",
    "عالمه": "علامه",
    "گالب": "گلاب",
    "العالج": "العلاج",
    "الئمه": "الائمه",
    "نهجالابلغه": "نهجالبلاغه",
    "اناقلب": "انقلاب",
    "ا اسلمی": "اسلامی",
    "صونای": "صنایع",
    "دسوتی": "دستی",
    "مبنوی": "مبنی",
    "بور": "بر",
    "تأسویس": "تأسیس",
    "سوازمان": "سازمان",
    "علیوه": "علیه",
    "السوالم": "السلام",
    "هوو": "هو",
    "پواریس": "پاریس",
    "وو روز": "و روز",
    "رحمهه": "رحمه",
    "سالم": "سلام",
    "جام شهر": "جامع شهر",
    "مالصدرا": "ملاصدرا",
    "والیت": "ولایت",
    "مداف حرم": "مدافع حرم",
    "صنای کوچک": "صنایع کوچک",
    "رییسعلی": "رئیسعلی",
    "فالحی": "فلاحی",
    "کالهدوز": "کلاهدوز",
    "القصی": "الاقصی",
    "منافقوان": "منافقان",
    "کاپیتوالسیون": "کاپیتولاسیون",
    "النه": "لانه",
    "معلوالن": "معلولان",
    "بالیای": "بلایای",
    "اخالق": "اخلاق",
    "اخالص": "اخلاص",
    "کربال": "کربلا",
    "ابالغ": "ابلاغ",
    "مالهادی": "ملاهادی",
    "خاتمالنبیا": "خاتمالانبیاء",
    "رحمهلاله": "رحمهالله",
    "امالک": "املاک",
    "موتورسیلکت": "موتورسیکلت",
    "ابزارآالت": "ابزارآلات",
    "قاچاق کال": "قاچاق کالا",
    "شکالت": "شکلات",
    "طال": "طلا",
}


class ParseError(ValueError):
    pass


def require(ok, code):
    if not ok:
        raise ParseError(code)


def rtl_cell(raw):
    value = " ".join(line[::-1] for line in (raw or "").splitlines()).translate(DIGITS)
    value = re.sub(r"\d+", lambda m: m.group()[::-1], value)
    return re.sub(r"\s+", " ", value).strip()


def month_of(label):
    label = label.translate(CHARS)
    return next((i for i, m in enumerate(MONTHS, 1) if m in label), None)


def new_year(year):
    # Borkowski's Jalali break-year calculation; application also independently
    # validates all parsed daily mappings using its own installed calendar library.
    require(1200 <= year <= 1701, "YEAR_OUT_OF_RANGE")
    breaks = (
        -61,
        9,
        38,
        199,
        426,
        686,
        756,
        818,
        1111,
        1181,
        1210,
        1635,
        2060,
        2097,
        2192,
        2262,
        2324,
        2394,
        2456,
        3178,
    )
    gy = year + 621
    leap_j = -14
    jp = breaks[0]
    for jm in breaks[1:]:
        jump = jm - jp
        if year < jm:
            break
        leap_j += (jump // 33) * 8 + (jump % 33) // 4
        jp = jm
    n = year - jp
    leap_j += (n // 33) * 8 + ((n % 33) + 3) // 4
    if jump % 33 == 4 and jump - n == 4:
        leap_j += 1
    leap_g = gy // 4 - ((gy // 100 + 1) * 3) // 4 - 150
    return dt.date(gy, 3, 20 + leap_j - leap_g)


def expected_lengths(year):
    return [31] * 6 + [30] * 5 + [(new_year(year + 1) - new_year(year)).days - 336]


def mapped_normalize(text):
    chars = [
        (c.translate(DIGITS).translate(CHARS), i, i + 1)
        for i, c in enumerate(text)
        if c not in "\u200c\u200d"
    ]

    def replace(pattern, replacement, regex=False):
        nonlocal chars
        value = "".join(c[0] for c in chars)
        matches = list(re.finditer(pattern if regex else re.escape(pattern), value))
        for m in reversed(matches):
            start, end = chars[m.start()][1], chars[m.end() - 1][2]
            chars[m.start() : m.end()] = [(c, start, end) for c in replacement]

    for a, b in REPAIRS.items():
        (
            replace(re.escape(a) + r"(?![\w])", b, True)
            if a == "قاچاق کال"
            else replace(a, b)
        )
    # Explicit parenthetical closure/holiday labels are recorded separately.
    replace(r"\(تعطیل\)", "", True)
    replace("هـ", "ه")
    value = "".join(c[0] for c in chars)
    for m in reversed(list(re.finditer(r"هو\s*\.?\s*([شق])", value))):
        start, end = chars[m.start()][1], chars[m.end() - 1][2]
        chars[m.start() : m.end()] = [(c, start, end) for c in "ه" + m.group(1)]
    compact = [c for c in chars if c[0].isalnum()]
    value = "".join(c[0] for c in compact)
    for m in reversed(list(re.finditer("رحمهاللهعلیه", value))):
        del compact[m.start() : m.end()]
    value = "".join(c[0] for c in compact)
    for m in reversed(list(re.finditer(r"و(?=\d{4}ه[شق])", value))):
        del compact[m.start() : m.end()]
    return "".join(c[0] for c in compact), [(c[1], c[2]) for c in compact]


def normalize(text):
    return mapped_normalize(text)[0]


def extract_structure(doc, year):
    lengths = expected_lengths(year)
    days = []
    entries = []
    cursor = new_year(year)
    previous_hijri = None
    hijri_aliases = (
        "محرم",
        "صفر",
        "ربيالول",
        "ربيالثانی",
        "جماديالولی",
        "جماديالثانيه",
        "رجب",
        "شعبان",
        "رمضان",
        "شوال",
        "ذيالقعده",
        "ذيالحجه",
    )
    require(not doc.is_encrypted and 17 <= len(doc) <= 30, "UNSUPPORTED_PDF_LAYOUT")
    cover = rtl_cell(doc[0].get_text()).translate(CHARS)
    require(
        re.search(rf"(?<!\d){year}(?!\d)", cover)
        and ("تقویم" in cover or "میوقت" in cover),
        "PDF_YEAR_MISMATCH",
    )
    for month in range(1, 13):
        with contextlib.redirect_stdout(io.StringIO()):
            tables = doc[month + 1].find_tables().tables
        require(len(tables) == 1, "MONTH_TABLE_COUNT_INVALID")
        rows = tables[0].extract()
        require(rows and len(rows[0]) == 4, "MONTH_COLUMNS_INVALID")
        require(len(rows) - 1 == lengths[month - 1], "MONTH_LENGTH_INVALID")
        for day, raw in enumerate(rows[1:], 1):
            require(len(raw) == 4, "MONTH_ROW_INVALID")
            title, greg, hijri, label = map(rtl_cell, raw)
            greg = greg.translate(CHARS)
            label = label.translate(CHARS)
            nums = re.findall(r"\d+", label)
            require(nums and int(nums[0]) == day, "DAY_LABEL_INVALID")
            require(day != 1 or month_of(label) == month, "MONTH_LABEL_INVALID")
            weekday = re.sub(r"[\s\u200c]", "", re.sub(r'\d+|["«»]', "", label))
            for name in MONTHS:
                weekday = weekday.replace(name, "")
            wanted = (
                "دوشنبه",
                "سهشنبه",
                "چهارشنبه",
                "پنجشنبه",
                "جمعه",
                "شنبه",
                "یکشنبه",
            )[cursor.weekday()]
            require(weekday == wanted, "WEEKDAY_MISMATCH")
            gn = [int(n) for n in re.findall(r"\d+", greg)]
            require(gn and gn[0] == cursor.day, "GREGORIAN_DAY_MISMATCH")
            actual_month = next(
                (i for i, m in enumerate(GREGORIAN, 1) if m in greg), None
            )
            require(
                (actual_month is None or actual_month == cursor.month)
                and (len(gn) < 2 or gn[1] == cursor.year),
                "GREGORIAN_REFERENCE_MISMATCH",
            )
            # A missing month/year transition cannot be accepted as ditto text.
            require(
                (len(days) > 0 and cursor.day != 1) or actual_month is not None,
                "GREGORIAN_MONTH_REFERENCE_MISSING",
            )
            hn = [int(n) for n in re.findall(r"\d+", hijri)]
            require(hn and 1 <= hn[0] <= 30, "HIJRI_REFERENCE_INVALID")
            hijri_label = re.sub(r'[\s\u200c"«»\d]', "", hijri)
            hijri_month = next(
                (i for i, name in enumerate(hijri_aliases, 1) if hijri_label == name),
                None,
            )
            if previous_hijri is None:
                require(
                    hijri_month is not None and len(hn) == 2,
                    "HIJRI_INITIAL_REFERENCE_MISSING",
                )
                hijri_year = hn[1]
            else:
                pd, pm, py = previous_hijri
                transition = hn[0] == 1 and pd in (29, 30)
                wanted_month = pm % 12 + 1 if transition else pm
                wanted_year = py + (1 if transition and pm == 12 else 0)
                require(transition or hn[0] == pd + 1, "HIJRI_DAY_SEQUENCE_INVALID")
                require(
                    (hijri_month is None and not transition)
                    or hijri_month == wanted_month,
                    "HIJRI_MONTH_SEQUENCE_INVALID",
                )
                require(
                    len(hn) < 2 or hn[1] == wanted_year, "HIJRI_YEAR_SEQUENCE_INVALID"
                )
                require(
                    not (transition and pm == 12) or len(hn) == 2,
                    "HIJRI_YEAR_REFERENCE_MISSING",
                )
                hijri_month, hijri_year = wanted_month, wanted_year
            previous_hijri = (hn[0], hijri_month, hijri_year)
            key = f"{year}-{month:02d}-{day:02d}"
            require(len(title) <= 5000, "SOURCE_ROW_SIZE_LIMIT")
            row = {
                "jalaliDateKey": key,
                "dateKey": cursor.isoformat(),
                "dayOfWeek": (cursor.weekday() + 2) % 7,
                "sourcePage": month + 2,
                "sourceSection": "MAIN_MONTH_TABLE",
                "sourceRow": day,
                "sourceText": title,
                "gregorianReference": greg,
                "hijriReference": hijri,
                "isOfficialHoliday": bool(re.search(r"تعط[یي]ل", title)),
            }
            days.append(row)
            if title:
                entries.append(row)
            cursor += dt.timedelta(days=1)
    for idx in range(14, len(doc)):
        with contextlib.redirect_stdout(io.StringIO()):
            tables = doc[idx].find_tables().tables
        require(bool(tables), "APPENDIX_TABLE_MISSING")
        for ti, table in enumerate(tables):
            for ri, raw in enumerate(table.extract(), 1):
                require(len(raw) == 2, "APPENDIX_COLUMNS_INVALID")
                title, label = map(rtl_cell, raw)
                month = month_of(label)
                num = re.search(r"(?<!\d)(\d{1,2})(?!\d)", label)
                day = (
                    int(num.group(1))
                    if num
                    else 1 if re.search(r"(?:یكم|یکم|اول|نخست)", label) else 0
                )
                require(len(title) <= 5000, "SOURCE_ROW_SIZE_LIMIT")
                require(
                    title and month and 1 <= day <= lengths[month - 1],
                    "APPENDIX_DATE_INVALID",
                )
                key = f"{year}-{month:02d}-{day:02d}"
                require(
                    not re.search(r"تعط[یي]ل", title), "CONTRADICTORY_APPENDIX_HOLIDAY"
                )
                entries.append(
                    {
                        "jalaliDateKey": key,
                        "sourcePage": idx + 1,
                        "sourceSection": "APPENDIX_TABLE",
                        "sourceTable": ti,
                        "sourceRow": ri,
                        "sourceText": title,
                        "dateLabel": label,
                        "isOfficialHoliday": False,
                    }
                )
    require(
        cursor == new_year(year + 1)
        and len({d["jalaliDateKey"] for d in days}) == sum(lengths),
        "INCOMPLETE_YEAR",
    )
    require(len(entries) <= 2000, "SOURCE_ENTRY_LIMIT")
    return days, entries


def normalize_entries(entries, catalog):
    events = []
    unresolved = []
    order = {}
    candidates = [(normalize(c["title"]), c) for c in catalog]
    for row in entries:
        text = row["sourceText"]
        value, spans = mapped_normalize(text)
        found = []
        for needle, c in candidates:
            if not needle:
                continue
            start = 0
            while (start := value.find(needle, start)) >= 0:
                found.append((start, start + len(needle), c))
                start += len(needle)
        # Longer reviewed titles win over a nested shorter title; never split every و.
        accepted = []
        for a, b, c in sorted(found, key=lambda x: (-(x[1] - x[0]), x[0])):
            if not any(a < end and b > start for start, end, _ in accepted):
                accepted.append((a, b, c))
        accepted.sort(key=lambda x: x[0])
        covered = set()
        for a, b, _ in accepted:
            covered.update(range(a, b))
        residue = "".join(ch for i, ch in enumerate(value) if i not in covered)
        if residue.strip("و") or not accepted:
            unresolved.append(
                {
                    **row,
                    "reason": "UNRECOGNIZED_SEMANTIC_SPAN",
                    "unmatchedNormalizedText": residue,
                }
            )
        for pos, (a, b, c) in enumerate(accepted):
            left = spans[a][0]
            right = spans[b - 1][1]
            # Include only the trailing marker of this occasion, before the next title.
            limit = (
                spans[accepted[pos + 1][0]][0] if pos + 1 < len(accepted) else len(text)
            )
            suffix = text[right:limit]
            marker = re.search(r"\(تعط[یي]ل\)", suffix)
            holiday = (
                bool(marker)
                or text[left:right].translate(CHARS).startswith("تعطیل به مناسبت")
                or bool(c.get("holidayGroup") and row["isOfficialHoliday"])
            )
            if marker:
                right += marker.end()
            key = row["jalaliDateKey"]
            order[key] = order.get(key, 0) + 1
            identity = hashlib.sha256(
                (c["title"] + "|" + row["sourceSection"]).encode()
            ).hexdigest()[:20]
            events.append(
                {
                    "eventKey": key + ":" + identity,
                    "jalaliDateKey": key,
                    "title": c["title"],
                    "type": c["type"],
                    "calendarType": c["calendarType"],
                    "isHoliday": holiday,
                    "displayOrder": order[key],
                    "sourcePage": row["sourcePage"],
                    "sourceSection": row["sourceSection"],
                    "evidence": {
                        **row,
                        "sourceSpan": [left, right],
                        "relevantText": text[left:right],
                        "splittingRationale": "Reviewed complete title boundary; internal conjunctions preserved.",
                        "classificationRationale": c.get(
                            "rationale",
                            "Previously curated taxonomy; explicit date-reference context reviewed.",
                        ),
                    },
                }
            )
        if row["isOfficialHoliday"] != any(
            e["isHoliday"]
            for e in events
            if e["jalaliDateKey"] == row["jalaliDateKey"]
            and e["sourcePage"] == row["sourcePage"]
        ):
            unresolved.append({**row, "reason": "HOLIDAY_MARKER_UNRESOLVED"})
    require(
        len({e["eventKey"] for e in events}) == len(events), "DUPLICATE_EVENT_IDENTITY"
    )
    return events, unresolved


def parse_pdf(path, year):
    require(1200 <= year <= 1700, "YEAR_OUT_OF_RANGE")
    require(Path(path).stat().st_size <= 20 * 1024 * 1024, "INVALID_PDF_BYTES")
    data = Path(path).read_bytes()
    require(
        10000 <= len(data) <= 20 * 1024 * 1024 and data.startswith(b"%PDF-"),
        "INVALID_PDF_BYTES",
    )
    require(b"%%EOF" in data[-2048:], "TRUNCATED_PDF")
    with fitz.open(stream=data, filetype="pdf") as doc:
        page_count = len(doc)
        days, entries = extract_structure(doc, year)
    root = Path(__file__).parent
    catalog = json.loads((root / "event-catalog.json").read_text())
    events, unresolved = normalize_entries(entries, catalog)
    sha = hashlib.sha256(data).hexdigest()
    holidays = sorted({d["jalaliDateKey"] for d in days if d["isOfficialHoliday"]})
    semantic_hash = hashlib.sha256(
        json.dumps(
            sorted(
                [{k: v for k, v in e.items() if k != "evidence"} for e in events],
                key=lambda e: e["eventKey"],
            ),
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
    ).hexdigest()
    certificates = json.loads((root / "certificates.json").read_text())
    certificate = certificates.get(sha)
    verified = bool(
        certificate
        and certificate["year"] == year
        and certificate["parserVersion"] == VERSION
        and certificate["semanticHash"] == semantic_hash
        and certificate["dayCount"] == len(days)
        and certificate["holidayDates"] == holidays
        and not unresolved
    )
    return {
        "year": year,
        "parserVersion": VERSION,
        "parserVerified": verified,
        "sourceHash": sha,
        "reviewReason": None if verified else "SOURCE_SEMANTIC_REVIEW_REQUIRED",
        "dailyRecords": days,
        "events": events,
        "unresolved": unresolved,
        "evidenceSummary": {
            "pageCount": page_count,
            "dayCount": len(days),
            "sourceEntryCount": len(entries),
            "eventCount": len(events),
            "holidayDates": holidays,
            "semanticHash": semantic_hash,
        },
    }
