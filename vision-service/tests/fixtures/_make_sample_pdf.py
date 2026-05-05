"""Regenerate vision-service/tests/fixtures/sample_book.pdf from sample_book.txt.

Run from vision-service/ after `pip install PyMuPDF`:
    python -m tests.fixtures._make_sample_pdf

Phase: 06-rag-ingestao | Plan: 06-04
"""
from __future__ import annotations

from pathlib import Path

import pymupdf

HERE = Path(__file__).parent
TXT_PATH = HERE / "sample_book.txt"
PDF_PATH = HERE / "sample_book.pdf"


def main() -> None:
    """Build a deterministic >=3-page PDF from sample_book.txt.

    Splitting strategy: split on both CAPÍTULO and the numbered-section markers
    (1.1, 1.2, ...) so the synthetic PDF has at least 3 pages — required by
    `test_pymupdf_extracts_plain_text_from_fixture_pdf` (06-04 GREEN gate).
    """
    import re

    txt = TXT_PATH.read_text(encoding="utf-8")
    # Split keeping markers as prefixes; positive lookahead so split keeps the marker.
    pattern = re.compile(r"(?=^CAPÍTULO\s)|(?=^\d+\.\d+\s)", re.MULTILINE)
    raw_parts = [p.strip() for p in pattern.split(txt) if p and p.strip()]
    parts = raw_parts if raw_parts else [txt]
    doc = pymupdf.open()
    try:
        for part in parts:
            page = doc.new_page(width=595, height=842)  # A4
            # Insert as a textbox so long content wraps within page bounds.
            rect = pymupdf.Rect(50, 50, 545, 800)
            page.insert_textbox(rect, part, fontsize=11, fontname="helv")
        doc.save(str(PDF_PATH))
    finally:
        doc.close()
    print(f"Wrote {PDF_PATH} ({PDF_PATH.stat().st_size} bytes, {len(parts)} pages)")


if __name__ == "__main__":
    main()
