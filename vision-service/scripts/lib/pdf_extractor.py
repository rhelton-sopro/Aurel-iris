"""PDF + DOCX extractors for the RAG ingestion pipeline (D-C4).

Lazy imports keep test_persist.py importable without installing PyMuPDF
(matches `import httpx  # lazy` pattern in vision-service/modal_app.py:94).

Phase: 06-rag-ingestao | Plan: 06-04 | Decisions: D-C4, RESEARCH lines 290-335
"""
from __future__ import annotations

from pathlib import Path
from typing import Any


def is_scanned_page(page: Any) -> bool:
    """Return True when page has no extractable text and is dominated by an image.

    RESEARCH lines 314-333 verbatim. Used to flag books needing OCR (D-S deferred).
    """
    text = page.get_text("text").strip()
    if text:
        # Some pages contain replacement chars from invalid Unicode -> treat as scan
        if text.count("�") / max(len(text), 1) > 0.3:
            return True
        return False
    images = page.get_images()
    if not images:
        return True  # blank page
    page_area = page.rect.width * page.rect.height
    for img in images:
        for r in page.get_image_rects(img[0]):
            if (r.width * r.height) / page_area > 0.95:
                return True
    return False


def extract_pdf(path: Path, extractor: str = "pymupdf") -> list[dict]:
    """Return list of {page, text, scan_detected} per page.

    Args:
        path:      .pdf file location.
        extractor: "pymupdf" (D-C4 primary) or "pdfplumber" (D-C4 fallback).

    Returns:
        list[dict] -- one entry per page, ordered by page number (1-indexed).
    """
    if extractor == "pymupdf":
        return _extract_pdf_pymupdf(path)
    if extractor == "pdfplumber":
        return _extract_pdf_pdfplumber(path)
    raise ValueError(f"Unknown extractor: {extractor!r}")


def _extract_pdf_pymupdf(path: Path) -> list[dict]:
    import pymupdf  # lazy: only available inside ingest env
    doc = pymupdf.open(str(path))
    pages: list[dict] = []
    try:
        for page_num, page in enumerate(doc):
            text = page.get_text("text")
            scan = is_scanned_page(page)
            pages.append({
                "page": page_num + 1,
                "text": text,
                "scan_detected": scan,
            })
    finally:
        doc.close()
    return pages


def _extract_pdf_pdfplumber(path: Path) -> list[dict]:
    import pdfplumber  # lazy: only available inside ingest env
    pages: list[dict] = []
    with pdfplumber.open(str(path)) as doc:
        for page_num, page in enumerate(doc.pages):
            text = page.extract_text() or ""
            # pdfplumber doesn't expose scan-detection cheaply; treat empty text
            # with at least one image as scan
            images = page.images or []
            scan = (not text.strip()) and bool(images)
            pages.append({
                "page": page_num + 1,
                "text": text,
                "scan_detected": scan,
            })
    return pages


def extract_docx(path: Path) -> list[dict]:
    """One synthetic 'page' with the whole text -- DOCX has no real page boundary."""
    import docx2txt  # lazy: only available inside ingest env
    text = docx2txt.process(str(path))
    return [{"page": None, "text": text, "scan_detected": False}]
