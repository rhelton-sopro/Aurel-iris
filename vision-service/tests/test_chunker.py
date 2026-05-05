"""Tests for RAG-01 chunker (D-C1..C3 + D-E2 content_hash canonicalization).

Wave 0 scaffolding (06-01-PLAN). Each test currently SKIPS with the
implementation plan number that will turn it GREEN.

Covers:
  - Chunk size invariant 300..700 tokens (D-C1)
  - Overlap=80 within section, no overlap across chapter (D-C1)
  - Chunk metadata shape: chapter, section, page, tokens_estimated (D-C2)
  - content_hash canonicalization locked: sha256(text.strip().encode('utf-8')) (D-E2 + RESEARCH Pitfall 1)
"""
from __future__ import annotations
import pytest


class TestChunker:
    @pytest.mark.skip(reason="Wave 0 — flip in 06-04-PLAN")
    def test_chunk_size_within_300_700_tokens(self):
        from scripts.lib.chunker import chunk_book  # noqa: F401
        from pathlib import Path
        fixture = Path(__file__).parent / "fixtures" / "sample_book.txt"
        text = fixture.read_text(encoding="utf-8")
        chunks = chunk_book(text, source_book="sample_book")
        for chunk in chunks:
            assert 300 <= chunk["tokens_estimated"] <= 700, (
                f"Chunk size {chunk['tokens_estimated']} outside D-C1 range [300, 700]"
            )

    @pytest.mark.skip(reason="Wave 0 — flip in 06-04-PLAN")
    def test_overlap_80_within_section(self):
        # Adjacent chunks in same section share ~80 tokens (D-C1)
        from scripts.lib.chunker import chunk_book  # noqa: F401
        from pathlib import Path
        fixture = Path(__file__).parent / "fixtures" / "sample_book.txt"
        chunks = chunk_book(fixture.read_text(encoding="utf-8"), source_book="sample_book")
        # Find adjacent pair within same chapter+section
        for prev, curr in zip(chunks, chunks[1:]):
            if prev["chapter"] == curr["chapter"] and prev["section"] == curr["section"]:
                # Real assertion: tail of prev overlaps with head of curr by ~80 tokens
                # (implementation in 06-04 will compute the actual overlap)
                assert prev["text"][-50:] in curr["text"] or curr["text"][:50] in prev["text"]
                return

    @pytest.mark.skip(reason="Wave 0 — flip in 06-04-PLAN")
    def test_no_overlap_across_chapter_boundary(self):
        # NO shared text between chunks when chapter differs (D-C1)
        from scripts.lib.chunker import chunk_book  # noqa: F401
        from pathlib import Path
        fixture = Path(__file__).parent / "fixtures" / "sample_book.txt"
        chunks = chunk_book(fixture.read_text(encoding="utf-8"), source_book="sample_book")
        for prev, curr in zip(chunks, chunks[1:]):
            if prev["chapter"] != curr["chapter"]:
                # Tail of prev must not appear in head of curr
                assert prev["text"][-100:] not in curr["text"]

    @pytest.mark.skip(reason="Wave 0 — flip in 06-04-PLAN")
    def test_chunk_metadata_shape(self):
        # Each chunk has chapter, section, page, tokens_estimated keys (D-C2)
        from scripts.lib.chunker import chunk_book  # noqa: F401
        from pathlib import Path
        fixture = Path(__file__).parent / "fixtures" / "sample_book.txt"
        chunks = chunk_book(fixture.read_text(encoding="utf-8"), source_book="sample_book")
        required_keys = {"chapter", "section", "page", "tokens_estimated", "text"}
        for chunk in chunks:
            assert required_keys.issubset(chunk.keys()), (
                f"Chunk missing keys: {required_keys - set(chunk.keys())}"
            )

    @pytest.mark.skip(reason="Wave 0 — flip in 06-04-PLAN")
    def test_content_hash_canonicalization_is_locked(self):
        # sha256("hello") hex — RESEARCH Pitfall 1 + D-E2 canonicalization
        from scripts.lib.chunker import content_hash  # noqa: F401
        expected = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        assert content_hash("hello") == expected
