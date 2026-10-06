"""Extract official PDF evidence without inventing unverified event mappings.

The university layout must be calibrated against the 424-event golden fixture
before this extractor may emit authoritative normalized events. Unsupported
layouts deliberately remain review-required and never reach import.
"""
import json
import sys
import fitz

PARSER_VERSION = "ut-text-extractor-v1-unverified"

def main():
    pdf_path, expected_year = sys.argv[1], int(sys.argv[2])
    doc = fitz.open(pdf_path)
    if not 12 <= len(doc) <= 30:
        raise ValueError("UNSUPPORTED_PDF_PAGE_COUNT")
    pages = []
    for page in doc:
        text = page.get_text("text", sort=True)
        tables = [table.extract() for table in page.find_tables().tables]
        pages.append({"page": page.number + 1, "text": text, "tables": tables})
    if str(expected_year) not in "\n".join(p["text"] for p in pages):
        raise ValueError("PDF_YEAR_MISMATCH")
    print(json.dumps({"year": expected_year, "parserVersion": PARSER_VERSION,
                      "parserVerified": False, "events": [], "pages": pages,
                      "reviewReason": "GOLDEN_LAYOUT_CALIBRATION_REQUIRED"}, ensure_ascii=False))

if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Never include source text, paths, credentials, or parser stack traces.
        print(json.dumps({"error": "PDF_EXTRACTION_FAILED"}))
        sys.exit(1)
