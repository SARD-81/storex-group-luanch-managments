import json, pathlib, sys
import fitz
root = pathlib.Path(sys.argv[1])
results = []
for filename in sorted(root.glob('*.pdf')):
    doc = fitz.open(filename)
    assert 1 <= len(doc) <= 20, 'Unexpected pagination'
    for page in doc:
        assert abs(page.rect.width - 419.53) < 2 and abs(page.rect.height - 595.28) < 2, 'PDF is not A5 portrait'
        text = page.get_text()
        assert len(text.strip()) > 10, 'Blank PDF page'
        for span in [s for b in page.get_text('dict')['blocks'] if 'lines' in b for l in b['lines'] for s in l['spans']]:
            x0, y0, x1, y1 = span['bbox']
            assert -1 <= x0 <= x1 <= page.rect.width+1 and -1 <= y0 <= y1 <= page.rect.height+1, 'Text outside page'
    pix = doc[0].get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
    pix.save(str(filename.with_suffix('.png')))
    results.append({'file':filename.name, 'pages':len(doc), 'width':doc[0].rect.width,'height':doc[0].rect.height})
assert len(results) >= 4, 'Missing expected manual/server scenarios'
print(json.dumps(results))
