"""Tests for vision-service/scripts/lib/manifest.py — D-M1."""
from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from scripts.lib.manifest import (
    BookEntry,
    BooksManifest,
    MANIFEST_PATH,
    load_manifest,
)


ACERVO = Path(r"D:\Projetos\Iridologista\livros")


def _valid_book_entry_kwargs() -> dict:
    return {
        "filename": "test.pdf",
        "autor": "Bernard Jensen",
        "escola": "Jensen",
        "idioma": "en",
        "ano": 1980,
        "alta_prioridade": True,
        "extrator": "pymupdf",
        "skip": False,
        "ocr_required": False,
        "notas": "test entry",
    }


class TestBookEntrySchema:
    def test_valid_entry_constructs(self):
        entry = BookEntry(**_valid_book_entry_kwargs())
        assert entry.filename == "test.pdf"

    def test_extrator_enum_constrained(self):
        kwargs = _valid_book_entry_kwargs()
        kwargs["extrator"] = "bogus"
        with pytest.raises(ValidationError):
            BookEntry(**kwargs)

    def test_extrator_accepts_all_canonical_values(self):
        # D-C4 + D-M1: pymupdf | pdfplumber | python-docx | docx2txt | skip
        for valid in ("pymupdf", "pdfplumber", "python-docx", "docx2txt", "skip"):
            kwargs = _valid_book_entry_kwargs()
            kwargs["extrator"] = valid
            BookEntry(**kwargs)  # should not raise

    def test_escola_enum_constrained(self):
        kwargs = _valid_book_entry_kwargs()
        kwargs["escola"] = "MartianSchool"
        with pytest.raises(ValidationError):
            BookEntry(**kwargs)

    def test_escola_accepts_all_seven_canonical_schools(self):
        # D-T5 verbatim — must match vocabularies.json escola_origem
        for school in (
            "Jensen",
            "Rayid",
            "Italiana",
            "Alemã",
            "Brasileira",
            "Espanhola",
            "Andrews-britânica",
        ):
            kwargs = _valid_book_entry_kwargs()
            kwargs["escola"] = school
            BookEntry(**kwargs)  # should not raise

    def test_idioma_enum_constrained(self):
        kwargs = _valid_book_entry_kwargs()
        kwargs["idioma"] = "fr"
        with pytest.raises(ValidationError):
            BookEntry(**kwargs)

    def test_ano_must_be_within_range(self):
        kwargs = _valid_book_entry_kwargs()
        kwargs["ano"] = 1800
        with pytest.raises(ValidationError):
            BookEntry(**kwargs)
        kwargs["ano"] = 2200
        with pytest.raises(ValidationError):
            BookEntry(**kwargs)

    def test_strict_extra_forbid_rejects_unknown_keys(self):
        kwargs = _valid_book_entry_kwargs()
        kwargs["bogus_field"] = "x"
        with pytest.raises(ValidationError, match="extra"):
            BookEntry(**kwargs)


class TestBooksManifest:
    def test_loads_manifest_file(self):
        manifest = load_manifest()
        assert isinstance(manifest, BooksManifest)
        assert manifest.catalog_name == "books_manifest"

    def test_manifest_version_is_0_1_1(self):
        # 06-03 founder gate locked v0.1.1 (mirrors vocabularies.json bump)
        manifest = load_manifest()
        assert manifest.version == "0.1.1"

    def test_lru_cached_returns_same_instance(self):
        m1 = load_manifest()
        m2 = load_manifest()
        assert m1 is m2

    def test_book_count_is_18(self):
        # 06-03 founder gate locked 18 entries; if founder added/removed, update this assertion
        manifest = load_manifest()
        assert len(manifest.books) == 18, (
            f"expected 18 entries from 06-03 founder gate, got {len(manifest.books)} — "
            f"if founder added/removed, update both this test and 06-06-SUMMARY"
        )

    def test_each_filename_exists_in_acervo(self):
        manifest = load_manifest()
        if not ACERVO.exists():
            pytest.skip(f"acervo not present in this environment: {ACERVO}")
        missing = [
            entry.filename
            for entry in manifest.books.values()
            if not (ACERVO / entry.filename).exists()
        ]
        assert not missing, f"manifest references missing files: {missing}"

    def test_at_least_two_skip_entries(self):
        # 06-03 defaults: iridologia-mod-03 (1) duplicate + Bernard-Jensen.docx redundant
        manifest = load_manifest()
        skipped = [k for k, v in manifest.books.items() if v.skip]
        assert len(skipped) >= 2, f"expected ≥2 skip entries, got {skipped}"

    def test_at_least_three_alta_prioridade_entries(self):
        manifest = load_manifest()
        alta = [k for k, v in manifest.books.items() if v.alta_prioridade]
        assert len(alta) >= 3, f"expected ≥3 alta_prioridade entries, got {alta}"

    def test_manifest_path_constant_resolves(self):
        # Sanity: MANIFEST_PATH points to the real file used by load_manifest
        assert MANIFEST_PATH.exists()
        assert MANIFEST_PATH.name == "books_manifest.json"
