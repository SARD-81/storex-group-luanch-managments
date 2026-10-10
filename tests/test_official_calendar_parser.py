"""Synthetic layout/adversarial tests; the official source is never vendored."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from official_calendar import official_pdf as p


def encode(value):
    import re

    return re.sub(r"\d+", lambda m: m.group()[::-1], value)[::-1]


class Table:
    def __init__(self, rows):
        self.rows = rows

    def extract(self):
        return self.rows


class Page:
    def __init__(self, text="", tables=None):
        self.text = text
        self.tables = tables or []

    def get_text(self):
        return self.text

    def find_tables(self):
        print("third-party library diagnostic must not contaminate stdout")
        return type("Tables", (), {"tables": [Table(t) for t in self.tables]})()


class Doc:
    is_encrypted = False

    def __init__(self, year):
        self.pages = [Page(encode(f"تقویم رسمی سال {year}")), Page()]
        cursor = p.new_year(year)
        hi = 0
        names = (
            "محرم",
            "صفر",
            "ربي الول",
            "ربي الثانی",
            "جماديالولی",
            "جماديالثانيه",
            "رجب",
            "شعبان",
            "رمضان",
            "شوال",
            "ذيالقعده",
            "ذيالحجه",
        )
        for month, length in enumerate(p.expected_lengths(year), 1):
            rows = [list(map(encode, ["مناسبت", "میلادی", "هجری قمری", "روز هفته"]))]
            for day in range(1, length + 1):
                weekday = (
                    "دوشنبه",
                    "سه‌شنبه",
                    "چهارشنبه",
                    "پنجشنبه",
                    "جمعه",
                    "شنبه",
                    "یکشنبه",
                )[cursor.weekday()]
                label = f"{weekday} {day} {p.MONTHS[month-1] if day==1 else chr(34)}"
                rows.append(
                    [
                        encode("روز آزمون" if day == 1 else ""),
                        encode(
                            f"{cursor.day} {p.GREGORIAN[cursor.month-1]} {cursor.year}"
                        ),
                        encode(
                            f"{hi%30+1} {names[(9+hi//30)%12]} {1447+(9+hi//30)//12}"
                        ),
                        encode(label),
                    ]
                )
                cursor += p.dt.timedelta(days=1)
                hi += 1
            self.pages.append(Page(tables=[rows]))
        self.pages.extend(
            Page(tables=[[[encode("مناسبت آزمایشی"), encode(f"2 {p.MONTHS[0]}")]]])
            for _ in range(3)
        )

    def __len__(self):
        return len(self.pages)

    def __getitem__(self, index):
        return self.pages[index]


class ParserTest(unittest.TestCase):
    def bad(self, doc, code, year=1405):
        with self.assertRaisesRegex(p.ParseError, code):
            p.extract_structure(doc, year)

    def test_complete_nonleap_daily_mapping(self):
        days, rows = p.extract_structure(Doc(1405), 1405)
        self.assertEqual(len(days), 365)
        self.assertEqual(len({d["jalaliDateKey"] for d in days}), 365)
        self.assertEqual(days[0]["dateKey"], "2026-03-21")
        self.assertEqual(days[-1]["dateKey"], "2027-03-20")
        self.assertEqual(sum(d["dayOfWeek"] in (5, 6) for d in days), 104)

    def test_leap_month_length(self):
        self.assertEqual(p.expected_lengths(1403)[-1], 30)
        self.assertEqual(len(p.extract_structure(Doc(1403), 1403)[0]), 366)

    def test_hijri_sequence_contradiction(self):
        d = Doc(1405)
        d.pages[2].tables[0][2][2] = encode("4 شوال 1447")
        self.bad(d, "HIJRI_DAY_SEQUENCE_INVALID")

    def test_hijri_month_contradiction(self):
        d = Doc(1405)
        d.pages[2].tables[0][2][2] = encode("2 محرم 1447")
        self.bad(d, "HIJRI_MONTH_SEQUENCE_INVALID")

    def test_hijri_year_contradiction(self):
        d = Doc(1405)
        d.pages[2].tables[0][2][2] = encode("2 شوال 1448")
        self.bad(d, "HIJRI_YEAR_SEQUENCE_INVALID")

    def test_wrong_year(self):
        self.bad(Doc(1405), "PDF_YEAR_MISMATCH", 1406)

    def test_missing_month(self):
        d = Doc(1405)
        d.pages[6].tables = []
        self.bad(d, "MONTH_TABLE_COUNT_INVALID")

    def test_missing_day(self):
        d = Doc(1405)
        d.pages[3].tables[0].pop(10)
        self.bad(d, "MONTH_LENGTH_INVALID")

    def test_duplicate_day(self):
        d = Doc(1405)
        d.pages[2].tables[0][5][3] = d.pages[2].tables[0][4][3]
        self.bad(d, "DAY_LABEL_INVALID")

    def test_wrong_month_label(self):
        d = Doc(1405)
        d.pages[2].tables[0][1][3] = encode("شنبه 1 اردیبهشت")
        self.bad(d, "MONTH_LABEL_INVALID")

    def test_weekday_contradiction(self):
        d = Doc(1405)
        d.pages[2].tables[0][1][3] = encode("یکشنبه 1 فروردین")
        self.bad(d, "WEEKDAY_MISMATCH")

    def test_gregorian_date_contradiction(self):
        d = Doc(1405)
        d.pages[2].tables[0][1][1] = encode("22 مارس 2026")
        self.bad(d, "GREGORIAN_DAY_MISMATCH")

    def test_gregorian_year_contradiction(self):
        d = Doc(1405)
        d.pages[2].tables[0][1][1] = encode("21 مارس 2027")
        self.bad(d, "GREGORIAN_REFERENCE_MISMATCH")

    def test_hijri_reference_malformed(self):
        d = Doc(1405)
        d.pages[2].tables[0][1][2] = encode("31 شوال")
        self.bad(d, "HIJRI_REFERENCE_INVALID")

    def test_nonleap_extra_day(self):
        d = Doc(1405)
        d.pages[13].tables[0].append(d.pages[13].tables[0][-1])
        self.bad(d, "MONTH_LENGTH_INVALID")

    def test_leap_missing_day(self):
        d = Doc(1403)
        d.pages[13].tables[0].pop()
        self.bad(d, "MONTH_LENGTH_INVALID", 1403)

    def test_unsupported_columns(self):
        d = Doc(1405)
        d.pages[2].tables[0][0].pop()
        self.bad(d, "MONTH_COLUMNS_INVALID")

    def test_blank_image_only(self):
        d = Doc(1405)
        d.pages[0].text = ""
        self.bad(d, "PDF_YEAR_MISMATCH")

    def test_blank_daily_label(self):
        d = Doc(1405)
        d.pages[2].tables[0][3][3] = ""
        self.bad(d, "DAY_LABEL_INVALID")

    def test_missing_appendix(self):
        d = Doc(1405)
        d.pages[15].tables = []
        self.bad(d, "APPENDIX_TABLE_MISSING")

    def test_invalid_appendix_date(self):
        d = Doc(1405)
        d.pages[14].tables[0][0][1] = encode("32 فروردین")
        self.bad(d, "APPENDIX_DATE_INVALID")

    def test_contradictory_appendix_holiday(self):
        d = Doc(1405)
        d.pages[14].tables[0][0][0] = encode("مناسبت آزمایشی (تعطیل)")
        self.bad(d, "CONTRADICTORY_APPENDIX_HOLIDAY")

    def test_digits_and_character_variants(self):
        self.assertEqual(p.normalize("عنوان كیفی ۱۲٣"), p.normalize("عنوان کیفی 123"))

    def test_conjunction_within_title_preserved_and_unknown_fails_review(self):
        catalog = [
            {
                "title": "روز آزمون و پژوهش",
                "type": "CULTURAL",
                "calendarType": "JALALI",
            },
            {"title": "روز آموزش", "type": "CULTURAL", "calendarType": "JALALI"},
        ]
        row = {
            "jalaliDateKey": "1406-01-01",
            "sourcePage": 3,
            "sourceSection": "MAIN_MONTH_TABLE",
            "sourceText": "روز آزمون و پژوهش و روز آموزش",
            "isOfficialHoliday": False,
        }
        events, unresolved = p.normalize_entries([row], catalog)
        self.assertEqual(
            [e["title"] for e in events], ["روز آزمون و پژوهش", "روز آموزش"]
        )
        self.assertFalse(unresolved)
        self.assertEqual(events[0]["evidence"]["relevantText"], "روز آزمون و پژوهش")
        self.assertTrue(
            p.normalize_entries(
                [{**row, "sourceText": row["sourceText"] + " و رویداد ناشناخته"}],
                catalog,
            )[1]
        )

    def test_repeated_extraction_deterministic(self):
        self.assertEqual(
            p.extract_structure(Doc(1406), 1406), p.extract_structure(Doc(1406), 1406)
        )

    def test_corrupt_transfer_html_truncated_and_size_limits(self):
        import tempfile

        samples = [
            (b"<html>Transferring</html>", "INVALID_PDF_BYTES"),
            (b"%PDF-" + b"0" * 10000, "TRUNCATED_PDF"),
            (b"%PDF-" + b"0" * 10000 + b"%%EOF", "PDF_EXTRACTION_FAILED"),
            (b"%PDF-" + b"0" * (20 * 1024 * 1024) + b"%%EOF", "INVALID_PDF_BYTES"),
        ]
        for data, code in samples:
            with tempfile.NamedTemporaryFile() as f:
                f.write(data)
                f.flush()
                import subprocess, json

                run = subprocess.run(
                    [
                        sys.executable,
                        str(
                            Path(__file__).resolve().parents[1]
                            / "scripts/parse-official-calendar.py"
                        ),
                        f.name,
                        "1405",
                    ],
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                self.assertNotEqual(run.returncode, 0)
                self.assertEqual(
                    json.loads(run.stdout), {"error": code, "parserVerified": False}
                )
                self.assertNotIn(f.name, run.stdout + run.stderr)


if __name__ == "__main__":
    unittest.main()
