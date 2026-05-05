"""Tests for D-E2 content_hash idempotency (RAG-02).

Wave 0 scaffolding (06-01-PLAN). Each test currently SKIPS with the
implementation plan number that will turn it GREEN.

Covers:
  - Same text produces same hash (deterministic SHA256)
  - Different text produces different hash
  - text.strip() canonicalization: leading/trailing whitespace stripped (per spec)
  - NO unicode normalization (NFC vs NFD must produce different hashes — RESEARCH Pitfall 1)
"""
from __future__ import annotations
import pytest


class TestContentHashIdempotency:
    @pytest.mark.skip(reason="Wave 0 — flip in 06-04-PLAN")
    def test_same_text_produces_same_hash(self):
        from scripts.lib.chunker import content_hash  # noqa: F401
        assert content_hash("foo") == content_hash("foo")

    @pytest.mark.skip(reason="Wave 0 — flip in 06-04-PLAN")
    def test_different_text_produces_different_hash(self):
        from scripts.lib.chunker import content_hash  # noqa: F401
        assert content_hash("foo") != content_hash("bar")

    @pytest.mark.skip(reason="Wave 0 — flip in 06-04-PLAN")
    def test_strip_normalizes_leading_trailing_whitespace_only(self):
        from scripts.lib.chunker import content_hash  # noqa: F401
        # text.strip() in spec → these must collapse to the same hash
        assert content_hash("foo") == content_hash("  foo  ")
        assert content_hash("foo") == content_hash("\nfoo\n\t")

    @pytest.mark.skip(reason="Wave 0 — flip in 06-04-PLAN")
    def test_no_unicode_normalization(self):
        # RESEARCH Pitfall 1: NO NFC/NFD normalization — bytes go straight to SHA256
        import unicodedata
        from scripts.lib.chunker import content_hash  # noqa: F401
        nfc = unicodedata.normalize("NFC", "café")
        nfd = unicodedata.normalize("NFD", "café")
        # Two different byte sequences → two different hashes
        assert nfc.encode("utf-8") != nfd.encode("utf-8")
        assert content_hash(nfc) != content_hash(nfd)
