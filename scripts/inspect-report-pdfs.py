"""Inspect actual generated A5 PDFs, embedding, repeated headers and all-page bounds."""
import json
import pathlib
import sys
import unicodedata
import re
import fitz

root = pathlib.Path(sys.argv[1])
results = []
def readable(text):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text).replace("\u200c", ""))
for filename in sorted(root.glob("*.pdf")):
    with fitz.open(filename) as doc:
        assert 1 <= len(doc) <= 20, f"Unexpected pagination: {filename.name}"
        all_text = readable(" ".join(page.get_text() for page in doc))
        for word in ("مهمان", "صبحانه", "ناهار", "امضا"):
            assert word in all_text, f"Missing report content {word}: {filename.name}"
        assert "جمع کل" in all_text, f"Missing totals: {filename.name}"
        images = 0
        logos = 0
        embedded_fonts = set()
        for index, page in enumerate(doc):
            assert abs(page.rect.width - 419.53) < 2 and abs(page.rect.height - 595.28) < 2, "PDF is not A5 portrait"
            text = readable(page.get_text())
            assert len(text.strip()) > 10, "Blank PDF page"
            # The table continuation repeats its header; a footer-only final page is permitted.
            if index == 0 or ("نام و نام خانوادگی مسئول" not in text):
                assert "صبحانه" in text and "ناهار" in text, f"Missing repeated table header on page {index+1}"
            for block in page.get_text("dict")["blocks"]:
                if "lines" not in block:
                    continue
                for line in block["lines"]:
                    for span in line["spans"]:
                        x0, y0, x1, y1 = span["bbox"]
                        assert -1 <= x0 <= x1 <= page.rect.width+1 and -1 <= y0 <= y1 <= page.rect.height+1, "Text outside page"
            for font in page.get_fonts(full=True):
                if font[0] and doc.extract_font(font[0])[3]:
                    embedded_fonts.add(font[3])
                elif font[0] and font[2] == "Type3":
                    # Chromium can embed variable-font glyph programs as Type3,
                    # which extract_font cannot return as a TTF byte stream.
                    kind, reference = doc.xref_get_key(font[0], "CharProcs")
                    unicode_kind, unicode_ref = doc.xref_get_key(font[0], "ToUnicode")
                    if kind in ("xref", "dict") and unicode_kind == "xref":
                        procedures = doc.xref_object(int(reference.split()[0])) if kind == "xref" else reference
                        glyphs = re.findall(r"(\d+) 0 R", procedures)
                        if any(doc.xref_stream(int(glyph)) for glyph in glyphs) and doc.xref_stream(int(unicode_ref.split()[0])):
                            embedded_fonts.add("Type3:" + font[4])
            for info in page.get_image_info():
                rect = fitz.Rect(info["bbox"])
                assert rect.x0 >= -1 and rect.y0 >= -1 and rect.x1 <= page.rect.width+1 and rect.y1 <= page.rect.height+1, "Image outside page"
                # Chromium may rasterize backgrounds and emit zero-width edge tiles.
                # Only the actual report-header logo belongs to the logo assertion.
                if index == 0 and info["width"] >= 16 and info["height"] >= 16 and rect.height <= 50 and rect.width <= 120:
                    ratio = info["width"] / info["height"]
                    # Skia rounds embedded image placement to CSS pixels (0.75 pt).
                    # A point-based tolerance avoids magnifying that rounding for wide logos.
                    assert abs(rect.height - rect.width/ratio) <= .8, f"Distorted logo aspect ratio: {filename.name}"
                    logos += 1
                images += 1
            page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5)).save(str(filename.with_suffix(""))+f"-page-{index+1:02d}.png")
        assert embedded_fonts, f"Persian font not embedded: {filename.name}"
        if "logo-" in filename.name and "restored" not in filename.name:
            assert logos == 1, f"Selected logo missing or duplicated in PDF: {filename.name}"
        if filename.name == "server-empty.pdf":
            assert len(doc) == 1, "Empty report should fit one page"
        if filename.name == "server-long-names.pdf":
            # Lam-alef extraction order varies with Chromium's ToUnicode mapping;
            # verify the surrounding long-name content and inspect rendered glyphs.
            assert len(doc) > 1 and "نام و نام خانوادگی بسیار" in all_text and "خوانایی" in all_text, "Missing large/long-name scenario"
        doc[0].get_pixmap(matrix=fitz.Matrix(1.5, 1.5)).save(str(filename.with_suffix(".png")))
        results.append({"file": filename.name, "pages": len(doc), "width": doc[0].rect.width, "height": doc[0].rect.height, "embeddedFonts": sorted(embedded_fonts), "images": images, "logos": logos, "allPagesRendered": True})
assert len(results) == 11, f"Missing expected print/server/logo scenarios: {len(results)}"
print(json.dumps(results, ensure_ascii=False))
