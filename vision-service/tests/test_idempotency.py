"""Tests for vision-service/scripts/lib/chunker.content_hash — D-E2 (RAG-02).

Flipped GREEN by 06-04-PLAN.

Covers:
  - Same text produces same hash (deterministic SHA256)
  - Different text produces different hash
  - text.strip() canonicalization: leading/trailing whitespace stripped
  - NO unicode normalization (NFC vs NFD must hash differently — RESEARCH Pitfall 1)
  - Inner whitespace preserved (text.strip() only trims outer)
"""
from __future__ import annotations

import unicodedata

from scripts.lib.chunker import content_hash


class TestContentHashIdempotency:
    def test_same_text_produces_same_hash(self):
        assert content_hash("foo") == content_hash("foo")

    def test_different_text_produces_different_hash(self):
        assert content_hash("foo") != content_hash("bar")

    def test_strip_normalizes_leading_trailing_whitespace_only(self):
        # text.strip() is part of the canonicalization
        assert content_hash("foo") == content_hash("  foo  ")
        assert content_hash("foo") == content_hash("\nfoo\n\t")

    def test_no_unicode_normalization(self):
        # RESEARCH Pitfall 1: bytes go straight to SHA256. NFC ≠ NFD bytes,
        # so hashes must differ even though the human-visible text is "café".
        nfc = unicodedata.normalize("NFC", "café")
        nfd = unicodedata.normalize("NFD", "café")
        assert nfc.encode("utf-8") != nfd.encode("utf-8")
        assert content_hash(nfc) != content_hash(nfd)

    def test_inner_whitespace_preserved(self):
        # text.strip() only trims outer whitespace, inner is preserved
        assert content_hash("a b") != content_hash("a  b")
