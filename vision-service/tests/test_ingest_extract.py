"""Tests for vision-service/scripts/lib/pdf_extractor.py — RAG-01 (D-C4).

Flipped GREEN by 06-04-PLAN.

Covers:
  - PdfExtractor: PyMuPDF text extraction, scan-detection, pdfplumber fallback dispatch (D-C4)
  - DocxExtractor: docx2txt extraction (RESEARCH line 351, lighter than python-docx)
"""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from scripts.lib.pdf_extractor import extract_docx, extract_pdf, is_scanned_page

FIXTURE_PDF = Path(__file__).parent / "fixtures" / "sample_book.pdf"


class TestPdfExtractor:
    def test_pymupdf_extracts_plain_text_from_fixture_pdf(self):
        pages = extract_pdf(FIXTURE_PDF, extractor="pymupdf")
        assert len(pages) >= 3, f"expected >=3 pages, got {len(pages)}"
        for page in pages:
            assert "page" in page
            assert "text" in page
            assert "scan_detected" in page
        full_text = "\n".join(p["text"] for p in pages)
        assert "CAPÍTULO" in full_text, (
            f"first-page text missing CAPÍTULO marker: {pages[0]['text'][:200]!r}"
        )

    def test_scan_detection_flags_image_only_page(self):
        # Build a fake page: empty text + one big image covering >95% of area
        fake_page = MagicMock()
        fake_page.get_text.return_value = ""
        fake_page.rect.width = 100
        fake_page.rect.height = 100
        fake_page.get_images.return_value = [(0, 0, 0, 0, 0, 0)]  # single image tuple
        fake_rect = MagicMock()
        fake_rect.width = 99
        fake_rect.height = 99
        fake_page.get_image_rects.return_value = [fake_rect]
        assert is_scanned_page(fake_page) is True

    def test_scan_detection_returns_false_when_text_present(self):
        fake_page = MagicMock()
        fake_page.get_text.return_value = "real text content with words"
        assert is_scanned_page(fake_page) is False

    def test_scan_detection_flags_blank_page_with_no_images(self):
        # Empty page (no text, no images) is treated as scan/blank per RESEARCH heuristic.
        fake_page = MagicMock()
        fake_page.get_text.return_value = ""
        fake_page.get_images.return_value = []
        assert is_scanned_page(fake_page) is True

    def test_scan_detection_flags_high_unicode_replacement_ratio(self):
        # >30% replacement chars (chr(0xfffd)) signals broken extraction.
        fake_page = MagicMock()
        fake_page.get_text.return_value = "ab���"
        assert is_scanned_page(fake_page) is True

    def test_pdfplumber_fallback_invoked_when_extractor_pdfplumber(self):
        with patch(
            "scripts.lib.pdf_extractor._extract_pdf_pdfplumber"
        ) as mock_pp:
            mock_pp.return_value = [
                {"page": 1, "text": "ok", "scan_detected": False}
            ]
            pages = extract_pdf(FIXTURE_PDF, extractor="pdfplumber")
            mock_pp.assert_called_once_with(FIXTURE_PDF)
            assert pages == [{"page": 1, "text": "ok", "scan_detected": False}]

    def test_unknown_extractor_raises_value_error(self):
        with pytest.raises(ValueError, match="Unknown extractor"):
            extract_pdf(FIXTURE_PDF, extractor="bogus")


class TestDocxExtractor:
    def test_docx2txt_extracts_text(self):
        # Use the acervo DOCX (read-only) — D:/Projetos/Iridologista/livros/
        acervo_docx = Path(
            "D:/Projetos/Iridologista/livros/727258853-endocrinology-and-iridology.docx"
        )
        if not acervo_docx.exists():
            pytest.skip(f"acervo DOCX not found at {acervo_docx}")
        result = extract_docx(acervo_docx)
        assert isinstance(result, list) and len(result) == 1
        entry = result[0]
        assert entry["page"] is None
        assert entry["scan_detected"] is False
        assert isinstance(entry["text"], str) and len(entry["text"]) > 100
