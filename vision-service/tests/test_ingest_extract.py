"""Tests for RAG-01 PDF + DOCX extraction (PyMuPDF primary + pdfplumber fallback + python-docx).

Wave 0 scaffolding (06-01-PLAN). Each test currently SKIPS with the
implementation plan number that will turn it GREEN.

Covers:
  - PdfExtractor: PyMuPDF text extraction, scan-detection, pdfplumber fallback dispatch (D-C4)
  - DocxExtractor: docx2txt extraction (D-C4 — manifest extrator='python-docx')
"""
from __future__ import annotations
import pytest


class TestPdfExtractor:
    @pytest.mark.skip(reason="Wave 0 — flip in 06-04-PLAN")
    def test_pymupdf_extracts_plain_text_from_fixture_pdf(self):
        # Import inside test so collection works before pdf_extractor.py exists
        from scripts.lib.pdf_extractor import extract_pdf  # noqa: F401
        from pathlib import Path
        fixture = Path(__file__).parent / "fixtures" / "sample_book.pdf"
        pages = extract_pdf(fixture, extractor="pymupdf")
        assert len(pages) >= 3
        for page in pages:
            assert "page" in page
            assert "text" in page
            assert "scan_detected" in page

    @pytest.mark.skip(reason="Wave 0 — flip in 06-04-PLAN")
    def test_scan_detection_flags_image_only_page(self):
        # RESEARCH lines 314–333: scan_detected=True when text empty + image >95% area
        from scripts.lib.pdf_extractor import extract_pdf  # noqa: F401
        from pathlib import Path
        fixture = Path(__file__).parent / "fixtures" / "sample_book_scan.pdf"
        pages = extract_pdf(fixture, extractor="pymupdf")
        assert any(p["scan_detected"] for p in pages)

    @pytest.mark.skip(reason="Wave 0 — flip in 06-04-PLAN")
    def test_pdfplumber_fallback_invoked_when_extractor_pdfplumber(self):
        from scripts.lib.pdf_extractor import extract_pdf  # noqa: F401
        from pathlib import Path
        fixture = Path(__file__).parent / "fixtures" / "sample_book.pdf"
        pages = extract_pdf(fixture, extractor="pdfplumber")
        # pdfplumber dispatch path is taken — assertion asserts function dispatches
        # based on extractor arg (real assertion lands in 06-04)
        assert len(pages) >= 1


class TestDocxExtractor:
    @pytest.mark.skip(reason="Wave 0 — flip in 06-04-PLAN")
    def test_docx2txt_extracts_text(self):
        from scripts.lib.pdf_extractor import extract_docx  # noqa: F401
        from pathlib import Path
        fixture = Path(__file__).parent / "fixtures" / "sample_book.docx"
        result = extract_docx(fixture)
        # DOCX returns single page-less blob: {page=None, text=str, scan_detected=False}
        assert result["text"]
        assert result["page"] is None
        assert result["scan_detected"] is False
