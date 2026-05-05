"""Tests for D-M1 books_manifest.json schema + file-existence (RAG-01).

Wave 0 scaffolding (06-01-PLAN). Each test currently SKIPS with the
implementation plan number that will turn it GREEN.

Covers:
  - Manifest loads 18 entries (acervo D-S1)
  - Each filename exists in D:\\Projetos\\Iridologista\\livros\\
  - Pydantic Literal enforcement: extrator ∈ {pymupdf, pdfplumber, python-docx, skip} (D-C4)
  - Pydantic Literal enforcement: escola ∈ 7 schools (D-T5)
  - StrictModel(extra='forbid') rejects unknown keys (D-T6)
"""
from __future__ import annotations
import pytest


class TestBooksManifest:
    @pytest.mark.skip(reason="Wave 0 — flip in 06-03-PLAN")
    def test_loads_18_entries(self):
        # Manifest finalized by founder in 06-03 with all 18 acervo entries (D-S1)
        from scripts.lib.books_manifest import load_manifest  # noqa: F401
        manifest = load_manifest()
        assert len(manifest.books) == 18

    @pytest.mark.skip(reason="Wave 0 — flip in 06-03-PLAN (founder fills filenames)")
    def test_each_filename_exists_in_acervo(self):
        from scripts.lib.books_manifest import load_manifest  # noqa: F401
        from pathlib import Path
        acervo = Path(r"D:\Projetos\Iridologista\livros")
        manifest = load_manifest()
        for entry in manifest.books:
            full = acervo / entry.filename
            assert full.exists(), f"Missing file in acervo: {full}"

    @pytest.mark.skip(reason="Wave 0 — flip in 06-03-PLAN")
    def test_extrator_enum_constrained(self):
        # Pydantic Literal accepts only pymupdf|pdfplumber|python-docx|skip (D-C4 + D-M1)
        from scripts.lib.books_manifest import BookEntry  # noqa: F401
        from pydantic import ValidationError
        # Valid values pass
        for valid in ("pymupdf", "pdfplumber", "python-docx", "skip"):
            BookEntry(
                filename="x.pdf", autor="X", escola="Jensen", idioma="pt",
                ano=2000, alta_prioridade=False, extrator=valid, skip=False,
                ocr_required=False, notas="",
            )
        # Invalid value rejected
        with pytest.raises(ValidationError):
            BookEntry(
                filename="x.pdf", autor="X", escola="Jensen", idioma="pt",
                ano=2000, alta_prioridade=False, extrator="tesseract", skip=False,
                ocr_required=False, notas="",
            )

    @pytest.mark.skip(reason="Wave 0 — flip in 06-03-PLAN")
    def test_escola_enum_constrained(self):
        # Pydantic Literal accepts only the 7 schools from D-T5
        from scripts.lib.books_manifest import BookEntry  # noqa: F401
        from pydantic import ValidationError
        valid_schools = (
            "Jensen", "Rayid", "Italiana", "Alemã",
            "Brasileira", "Espanhola", "Andrews-britânica",
        )
        for school in valid_schools:
            BookEntry(
                filename="x.pdf", autor="X", escola=school, idioma="pt",
                ano=2000, alta_prioridade=False, extrator="pymupdf", skip=False,
                ocr_required=False, notas="",
            )
        with pytest.raises(ValidationError):
            BookEntry(
                filename="x.pdf", autor="X", escola="Inventada", idioma="pt",
                ano=2000, alta_prioridade=False, extrator="pymupdf", skip=False,
                ocr_required=False, notas="",
            )

    @pytest.mark.skip(reason="Wave 0 — flip in 06-03-PLAN")
    def test_strict_extra_forbid_rejects_unknown_keys(self):
        # D-T6 strictness — mirror error_summary pattern
        from scripts.lib.books_manifest import BookEntry  # noqa: F401
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            BookEntry(
                filename="x.pdf", autor="X", escola="Jensen", idioma="pt",
                ano=2000, alta_prioridade=False, extrator="pymupdf", skip=False,
                ocr_required=False, notas="",
                unknown_key="boom",  # unexpected
            )
