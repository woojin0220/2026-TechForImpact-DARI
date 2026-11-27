"""Rebuild original form pages (optional tools: pypdfium2 and Pillow).

Run from any directory: python scripts/render-original-form.py
The bundled source PDF remains unchanged. No user answers are rendered here.
"""
import hashlib
import json
from pathlib import Path

import pypdfium2

source = Path(__file__).resolve().parents[1] / 'public/forms/refugee-application-2024.pdf'
output = source.with_suffix('')
output.mkdir(exist_ok=True)
pages = []
with pypdfium2.PdfDocument(str(source)) as document:
    for index in range(len(document)):
        page = document[index]
        image = page.render(scale=1600 / page.get_width()).to_pil()
        filename = f'page-{index + 1:02d}.webp'
        image.save(output / filename, 'WEBP', quality=88, method=6)
        pages.append({'file': filename, 'width': image.width, 'height': image.height})
        page.close()
(output / 'pages.json').write_text(json.dumps(pages), encoding='utf-8')
(output / 'source.json').write_text(json.dumps({
    'source': source.name,
    'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'pages': len(pages),
    'width': 1600,
}), encoding='utf-8')
