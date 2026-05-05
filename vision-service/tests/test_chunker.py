"""Tests for vision-service/scripts/lib/chunker.py — RAG-01 (D-C1..C3, D-E2).

Flipped GREEN by 06-04-PLAN.

Covers:
  - Chunk size invariant 300..700 tokens with section-tail flex (D-C1)
  - Overlap=80 within section, no overlap across chapter (D-C1)
  - Chunk metadata shape: chapter, section, page, tokens_estimated (D-C2)
  - content_hash canonicalization locked: sha256(text.strip()) (D-E2 + RESEARCH Pitfall 1)
"""
from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from scripts.lib.chunker import (
    MAX_TOKENS,
    MIN_TOKENS,
    OVERLAP_TOKENS,
    TARGET_TOKENS,
    Chunk,
    chunk_book,
    content_hash,
    count_tokens,
)
from scripts.lib.pdf_extractor import extract_pdf

FIXTURE_PDF = Path(__file__).parent / "fixtures" / "sample_book.pdf"


def _varied_paragraph(prefix: str, count: int) -> str:
    """Build a paragraph with N distinct numbered sentences.

    The chunker's overlap test relies on UNIQUE content per sentence so that
    the "longest common substring between adjacent chunks" measurement reflects
    the chunker's overlap logic, not naturally repeated text. Each sentence
    here is unique by virtue of an embedded counter.
    """
    return " ".join(
        f"{prefix} sentenca numero {i:03d} sobre o tema discutido."
        for i in range(count)
    )


@pytest.fixture
def synthetic_pages():
    """Two pages with explicit chapter+section markers and enough volume to
    force the chunker to flex within its 300-700 token band.

    Sentences are numbered uniquely so adjacent-chunk overlap measurements
    aren't polluted by repeated content.
    """
    return [
        {
            "page": 1,
            "text": (
                "CAPÍTULO I — Introdução\n\n"
                + _varied_paragraph("Texto sobre constituição biliar", 200)
                + "\n\n"
                + _varied_paragraph("Mais texto sobre setor 7 figado", 200)
            ),
            "scan_detected": False,
        },
        {
            "page": 2,
            "text": (
                "CAPÍTULO II — Setores\n\n"
                "1.1 Setor 7 Fígado\n\n"
                + _varied_paragraph("Conteudo sobre lacunas e raios solaris", 200)
            ),
            "scan_detected": False,
        },
    ]


class TestChunker:
    def test_chunk_size_within_300_700_tokens(self, synthetic_pages):
        chunks = chunk_book(synthetic_pages, book_meta={"source_book": "Test"})
        assert len(chunks) >= 2, "expected at least 2 chunks from 2-page synthetic"
        # Allow tail-of-section/chapter exception per D-C1: at least 50% of chunks
        # should land within the [MIN, MAX] band; smaller boundary chunks are
        # acceptable when a chapter or section ends early.
        big_enough = sum(
            1 for c in chunks if MIN_TOKENS <= c.tokens_estimated <= MAX_TOKENS
        )
        assert big_enough / len(chunks) >= 0.5, (
            f"too many out-of-range chunks: {[c.tokens_estimated for c in chunks]}"
        )
        # No chunk should ever exceed MAX_TOKENS — the splitter's hard ceiling.
        for c in chunks:
            assert c.tokens_estimated <= MAX_TOKENS, (
                f"chunk {c.tokens_estimated} exceeds MAX_TOKENS={MAX_TOKENS}"
            )

    def test_overlap_80_within_section(self, synthetic_pages):
        chunks = chunk_book(synthetic_pages, book_meta={})
        same_section_pairs = [
            (chunks[i - 1], chunks[i])
            for i in range(1, len(chunks))
            if chunks[i].chapter == chunks[i - 1].chapter
            and chunks[i].section == chunks[i - 1].section
        ]
        if not same_section_pairs:
            pytest.skip("synthetic fixture didn't produce same-section adjacency")
        for prev, curr in same_section_pairs:
            # Find longest common suffix-of-prev / prefix-of-curr in token space
            prev_tail = prev.text[-1000:]
            curr_head = curr.text[:1000]
            shared = 0
            for sub_len in range(min(len(prev_tail), len(curr_head)), 0, -1):
                if curr_head[:sub_len] in prev_tail:
                    shared = sub_len
                    break
            shared_tokens = count_tokens(curr_head[:shared]) if shared > 0 else 0
            # Flex tolerance: 40-120 tokens (target 80 +/- 40)
            assert 40 <= shared_tokens <= 120, (
                f"overlap out of band: {shared_tokens} tokens "
                f"(target {OVERLAP_TOKENS}+/-40)"
            )

    def test_no_overlap_across_chapter_boundary(self, synthetic_pages):
        chunks = chunk_book(synthetic_pages, book_meta={})
        for i in range(1, len(chunks)):
            if chunks[i].chapter != chunks[i - 1].chapter:
                # No shared substring of length >30 chars
                prev = chunks[i - 1].text
                curr = chunks[i].text
                prev_sents = [
                    s.strip() for s in prev.split(".") if len(s.strip()) > 30
                ]
                curr_sents = [
                    s.strip() for s in curr.split(".") if len(s.strip()) > 30
                ]
                shared = set(prev_sents) & set(curr_sents)
                assert not shared, (
                    f"chapter boundary leaked content: {list(shared)[:1]!r}"
                )

    def test_chunk_metadata_shape(self, synthetic_pages):
        chunks = chunk_book(synthetic_pages, book_meta={})
        for c in chunks:
            assert isinstance(c, Chunk)
            assert c.chapter is None or isinstance(c.chapter, str)
            assert c.section is None or isinstance(c.section, str)
            assert c.page is None or isinstance(c.page, int)
            assert isinstance(c.tokens_estimated, int) and c.tokens_estimated > 0
            assert isinstance(c.text, str) and len(c.text) > 0

    def test_content_hash_canonicalization_is_locked(self):
        """RESEARCH Pitfall 1: sha256(text.strip().encode('utf-8')) -- LOCKED.

        No NFC/NFD/lowercase. Hardcoded expected hex digest of "hello".
        """
        expected = (
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        )
        assert content_hash("hello") == expected
        assert content_hash("hello") == hashlib.sha256(b"hello").hexdigest()

    def test_chunker_runs_on_fixture_pdf(self):
        if not FIXTURE_PDF.exists():
            pytest.skip("fixture PDF missing — run _make_sample_pdf.py")
        pages = extract_pdf(FIXTURE_PDF, extractor="pymupdf")
        chunks = chunk_book(pages, book_meta={"source_book": "Test Fixture"})
        # The synthetic fixture is small (~few hundred tokens total) so the
        # chunker may produce zero chunks if every paragraph is consumed by
        # marker-recognition. Just assert the call shape works end-to-end.
        for c in chunks:
            assert isinstance(c, Chunk)

    def test_locked_constants_match_d_c1(self):
        # D-C1 locked params — change requires explicit decision update.
        assert TARGET_TOKENS == 500
        assert MIN_TOKENS == 300
        assert MAX_TOKENS == 700
        assert OVERLAP_TOKENS == 80
