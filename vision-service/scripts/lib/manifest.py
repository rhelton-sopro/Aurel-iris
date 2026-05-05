"""Pydantic model + lru_cached loader for books_manifest.json (D-M1).

KnowledgeChunkMetadata shape MUST mirror apps/web/lib/rag/types.ts (Pitfall 9 —
single source of truth in two places). Cross-reference comment maintained in both.

Phase: 06-rag-ingestao | Plan: 06-06 | Decisions: D-M1, D-T5, D-C4, D-T6 (extra='forbid')
"""
from __future__ import annotations

import functools
import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DATA_DIR = Path(__file__).parent.parent / "data"
MANIFEST_PATH = DATA_DIR / "books_manifest.json"


class BookEntry(BaseModel):
    filename: str
    autor: str
    escola: Literal[
        "Jensen",
        "Rayid",
        "Italiana",
        "Alemã",
        "Brasileira",
        "Espanhola",
        "Andrews-britânica",
    ]
    idioma: Literal["pt", "en", "it", "es", "de"]
    ano: int = Field(ge=1900, le=2100)
    alta_prioridade: bool = False
    extrator: Literal["pymupdf", "pdfplumber", "python-docx", "docx2txt", "skip"]
    skip: bool = False
    ocr_required: bool = False
    notas: str = ""

    # D-T6 strictness — mirrors schemas.py extra='forbid' pattern
    model_config = ConfigDict(extra="forbid")


class BooksManifest(BaseModel):
    catalog_name: str = "books_manifest"
    version: str = "0.1.0"
    books: dict[str, BookEntry]  # key = canonical source_book name
    model_config = ConfigDict(extra="forbid")


@functools.lru_cache(maxsize=None)
def load_manifest() -> BooksManifest:
    """Load and validate books_manifest.json. Cached for the process lifetime."""
    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(f"Manifest not found: {MANIFEST_PATH}")
    raw = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    return BooksManifest.model_validate(raw)
