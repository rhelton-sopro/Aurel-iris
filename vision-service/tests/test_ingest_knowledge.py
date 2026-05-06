"""Smoke tests for vision-service/scripts/ingest_knowledge.py -- RAG-01/02/03.

Tests the CLI argparse surface + early-exit paths + pre-flight gates with
heavy mocking. Real-API integration testing is the founder gate (Task 2 of
the PLAN) running against the live acervo + Voyage + Anthropic.

Phase: 06-rag-ingestao | Plan: 06-08 | Decisions: D-S1, D-G1, D-I2
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from scripts.ingest_knowledge import main


VALID_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.signature"


def _set_env(monkeypatch) -> None:
    monkeypatch.setenv("VOYAGE_API_KEY", "fake")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "fake")
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", VALID_KEY)


def _mock_manifest_obj(skip: bool = False, book_key: str = "Test"):
    from scripts.lib.manifest import BookEntry, BooksManifest
    return BooksManifest(
        catalog_name="books_manifest",
        version="0.1.0",
        books={
            book_key: BookEntry(
                filename="t.pdf",
                autor="A",
                escola="Jensen",
                idioma="en",
                ano=2000,
                alta_prioridade=False,
                extrator="pymupdf",
                skip=skip,
                ocr_required=False,
                notas="",
            )
        },
    )


class TestArgparse:
    def test_help_exits_zero(self, capsys):
        with pytest.raises(SystemExit) as excinfo:
            main(["--help"])
        assert excinfo.value.code == 0
        captured = capsys.readouterr()
        # All 6 user-visible flags advertised
        assert "--book" in captured.out
        assert "--purge" in captured.out
        assert "--dry-run" in captured.out
        assert "--no-contextual" in captured.out
        assert "--limit-chunks" in captured.out
        assert "--acervo" in captured.out

    def test_invalid_arg_exits_nonzero(self):
        with pytest.raises(SystemExit) as excinfo:
            main(["--bogus-flag"])
        assert excinfo.value.code != 0

    def test_dry_run_does_not_call_voyage(self, monkeypatch):
        _set_env(monkeypatch)
        with patch("scripts.ingest_knowledge.load_manifest") as mock_manifest, \
             patch("scripts.ingest_knowledge.extract_book") as mock_extract, \
             patch("scripts.ingest_knowledge.chunk_book") as mock_chunk, \
             patch("scripts.ingest_knowledge.embed_batch") as mock_embed, \
             patch("scripts.ingest_knowledge.upsert_chunks") as mock_upsert:
            mock_manifest.return_value = _mock_manifest_obj()
            mock_extract.return_value = [
                {"page": 1, "text": "hello world", "scan_detected": False}
            ]
            mock_chunk.return_value = []  # no chunks -> no embed call
            rc = main(["--dry-run", "--book", "Test", "--no-contextual"])
        assert rc == 0
        mock_embed.assert_not_called()
        mock_upsert.assert_not_called()

    def test_purge_calls_purge_book_then_ingests(self, monkeypatch):
        """--purge must call purge_book BEFORE extracting/embedding."""
        _set_env(monkeypatch)
        call_log: list[str] = []

        def _purge(key):
            call_log.append("purge")
            return 5

        def _extract(entry, acervo):
            call_log.append("extract")
            return [{"page": 1, "text": "hi", "scan_detected": False}]

        with patch("scripts.ingest_knowledge.load_manifest") as mock_manifest, \
             patch("scripts.ingest_knowledge.purge_book", side_effect=_purge), \
             patch("scripts.ingest_knowledge.extract_book", side_effect=_extract), \
             patch("scripts.ingest_knowledge.chunk_book", return_value=[]):
            mock_manifest.return_value = _mock_manifest_obj()
            rc = main(["--purge", "--book", "Test", "--dry-run", "--no-contextual"])
        assert rc == 0
        # purge must happen BEFORE extract
        assert call_log == ["purge", "extract"]

    def test_skip_entries_are_skipped(self, monkeypatch):
        """Manifest entries with skip=true must NOT be extracted."""
        _set_env(monkeypatch)
        with patch(
            "scripts.ingest_knowledge.load_manifest",
            return_value=_mock_manifest_obj(skip=True, book_key="ToSkip"),
        ), patch("scripts.ingest_knowledge.extract_book") as mock_extract:
            rc = main(["--dry-run", "--no-contextual"])
        # No books to process -> exit 1 (filter empty) per main() contract
        assert rc == 1
        mock_extract.assert_not_called()

    def test_budget_exceeded_returns_exit_code_2(self, monkeypatch):
        """BudgetExceeded raised by embed_batch must surface as exit code 2."""
        from scripts.lib.budget import BudgetExceeded
        _set_env(monkeypatch)
        # tokens_estimated unused by ingest path but Chunk dataclass requires it
        chunk_stub = type(
            "C",
            (),
            {
                "text": "x",
                "chapter": None,
                "section": None,
                "page": 1,
                "tokens_estimated": 10,
            },
        )()
        with patch(
            "scripts.ingest_knowledge._check_mode_mismatch",
            return_value=False,
        ), patch(
            "scripts.ingest_knowledge.load_manifest",
            return_value=_mock_manifest_obj(book_key="X"),
        ), patch(
            "scripts.ingest_knowledge.extract_book",
            return_value=[{"page": 1, "text": "x", "scan_detected": False}],
        ), patch(
            "scripts.ingest_knowledge.chunk_book",
            return_value=[chunk_stub],
        ), patch(
            "scripts.ingest_knowledge.get_client",
            return_value=MagicMock(),
        ), patch(
            "scripts.ingest_knowledge.filter_already_indexed",
            side_effect=lambda r, c: r,
        ), patch(
            "scripts.ingest_knowledge.embed_batch",
            side_effect=BudgetExceeded("hardcap"),
        ):
            rc = main(["--book", "X", "--no-contextual"])
        assert rc == 2

    def test_no_contextual_aborts_when_contextual_chunks_exist(
        self, monkeypatch, capsys
    ):
        """W2 pre-flight: --no-contextual on a corpus with contextual chunks must abort."""
        _set_env(monkeypatch)
        with patch(
            "scripts.ingest_knowledge._check_mode_mismatch",
            return_value=True,
        ):
            rc = main(["--no-contextual", "--book", "X"])
        assert rc == 2
        captured = capsys.readouterr()
        assert "MODE MISMATCH" in captured.err

    def test_no_contextual_with_purge_skips_mode_check(self, monkeypatch):
        """--purge bypasses the mode-mismatch gate (founder explicitly recreating)."""
        _set_env(monkeypatch)
        with patch(
            "scripts.ingest_knowledge._check_mode_mismatch",
            return_value=True,
        ) as mock_check, patch(
            "scripts.ingest_knowledge.load_manifest",
            return_value=_mock_manifest_obj(book_key="X"),
        ), patch("scripts.ingest_knowledge.purge_book", return_value=0), patch(
            "scripts.ingest_knowledge.extract_book",
            return_value=[{"page": 1, "text": "x", "scan_detected": False}],
        ), patch("scripts.ingest_knowledge.chunk_book", return_value=[]):
            rc = main(["--purge", "--no-contextual", "--book", "X", "--dry-run"])
        # When --purge is set, the gate must NOT be invoked
        mock_check.assert_not_called()
        assert rc == 0

    def test_skips_contextual_when_chapter_exceeds_tier1_tpm_threshold(self, monkeypatch, capsys):
        """Per-book D-N1 skip: when chapter context > MAX_CONTEXT_TOKENS_TIER1_TPM,
        ingest_book passes contextual_guard=None to process_chunks_into_rows so
        chunks embed without contextual prefix instead of 429-ing on Tier 1 50K TPM."""
        from scripts.ingest_knowledge import ingest_book
        from scripts.lib.budget import ContextualBudgetGuard, VoyageBudgetGuard
        from scripts.lib.contextualizer import MAX_CONTEXT_TOKENS_TIER1_TPM
        from scripts.lib.manifest import BookEntry

        # Build a fake "chapter" with > MAX_CONTEXT_TOKENS_TIER1_TPM tokens.
        # cl100k_base ~ 4 chars/token; 50K tokens ≈ 200K chars.
        # "lorem " is 1 token; 50K repeats > 40K cap.
        oversized_text = "lorem " * 50_000
        entry = BookEntry(
            filename="big.pdf", autor="A", escola="Jensen", idioma="es",
            ano=2010, alta_prioridade=False, extrator="pymupdf",
            skip=False, ocr_required=False, notas="",
        )
        # Stub out the actual extract/chunk/embed/upsert so ingest_book runs
        # only the chapter-tokens accounting + skip-decision branch.
        from scripts.lib.chunker import Chunk
        fake_chunks = [Chunk(text=oversized_text, chapter=None, section=None, page=1, tokens_estimated=50_000)]
        with patch("scripts.ingest_knowledge.extract_book", return_value=[]), \
             patch("scripts.ingest_knowledge.chunk_book", return_value=fake_chunks), \
             patch("scripts.ingest_knowledge.process_chunks_into_rows") as mock_process:
            mock_process.return_value = iter([])  # no rows so nothing to embed/persist
            ingest_book(
                "Spanish Manual",
                entry,
                acervo=None,  # extract_book is stubbed
                voyage_guard=VoyageBudgetGuard(),
                contextual_guard=ContextualBudgetGuard(),
                dry_run=True,
                limit_chunks_remaining=None,
            )

        # Caller passed real ContextualBudgetGuard; orchestrator must downgrade
        # to None for this book because chapter_text > threshold.
        kwargs = mock_process.call_args.kwargs
        assert kwargs["contextual_guard"] is None, (
            f"expected contextual_guard=None for oversized book, got {kwargs['contextual_guard']!r}"
        )
        captured = capsys.readouterr()
        assert "SKIP contextual" in captured.err
        assert "Spanish Manual" in captured.err
        # Threshold appears in log with thousands-separator comma formatting
        assert f"{MAX_CONTEXT_TOKENS_TIER1_TPM:,}" in captured.err

    def test_keeps_contextual_when_chapter_under_tier1_tpm_threshold(self, monkeypatch, capsys):
        """Inverse of the skip test: small chapters retain D-N1 (guard passed through)."""
        from scripts.ingest_knowledge import ingest_book
        from scripts.lib.budget import ContextualBudgetGuard, VoyageBudgetGuard
        from scripts.lib.manifest import BookEntry
        from scripts.lib.chunker import Chunk

        small_chunk = Chunk(text="small body " * 50, chapter="Chapter 1", section=None, page=1, tokens_estimated=100)
        entry = BookEntry(
            filename="small.pdf", autor="A", escola="Jensen", idioma="en",
            ano=2010, alta_prioridade=False, extrator="pymupdf",
            skip=False, ocr_required=False, notas="",
        )
        guard = ContextualBudgetGuard()
        with patch("scripts.ingest_knowledge.extract_book", return_value=[]), \
             patch("scripts.ingest_knowledge.chunk_book", return_value=[small_chunk]), \
             patch("scripts.ingest_knowledge.process_chunks_into_rows") as mock_process:
            mock_process.return_value = iter([])
            ingest_book(
                "Small Book", entry, acervo=None,
                voyage_guard=VoyageBudgetGuard(), contextual_guard=guard,
                dry_run=True, limit_chunks_remaining=None,
            )

        # Small book: original guard passed through unchanged.
        assert mock_process.call_args.kwargs["contextual_guard"] is guard
        captured = capsys.readouterr()
        assert "SKIP contextual" not in captured.err

    def test_filter_already_indexed_skips_existing_hashes(self, monkeypatch):
        """filter_already_indexed must drop rows whose content_hash already exists."""
        from scripts.ingest_knowledge import filter_already_indexed
        _set_env(monkeypatch)
        fake_response = MagicMock()
        fake_response.data = [{"content_hash": "h1"}, {"content_hash": "h3"}]
        fake_client = MagicMock()
        fake_client.table.return_value.select.return_value.in_.return_value.execute.return_value = (
            fake_response
        )
        rows = [
            {"content_hash": "h1", "content": "a"},
            {"content_hash": "h2", "content": "b"},
            {"content_hash": "h3", "content": "c"},
            {"content_hash": "h4", "content": "d"},
        ]
        new_rows = filter_already_indexed(rows, fake_client)
        assert [r["content_hash"] for r in new_rows] == ["h2", "h4"]

    def test_filter_already_indexed_batches_large_hash_lists(self, monkeypatch):
        """Large hash lists are batched to avoid PostgREST URL overflow.

        Bernard Jensen pdf produces 1008 chunks; a single .in_() call with
        all hashes would serialize to ~65KB URL and trigger 'URL component
        query too long' from PostgREST. Hashes must be split into batches
        of HASH_LOOKUP_BATCH_SIZE per .in_() call.
        """
        from scripts.ingest_knowledge import HASH_LOOKUP_BATCH_SIZE, filter_already_indexed
        _set_env(monkeypatch)
        # Build 250 fake hashes (forces ≥3 batches with the 100-cap)
        fake_response = MagicMock()
        fake_response.data = []  # nothing already indexed
        fake_client = MagicMock()
        fake_client.table.return_value.select.return_value.in_.return_value.execute.return_value = (
            fake_response
        )
        rows = [{"content_hash": f"h{i:03d}", "content": "x"} for i in range(250)]
        new_rows = filter_already_indexed(rows, fake_client)
        # All 250 returned (none in DB)
        assert len(new_rows) == 250
        # .in_() invoked once per batch
        in_call_count = fake_client.table.return_value.select.return_value.in_.call_count
        expected_batches = (250 + HASH_LOOKUP_BATCH_SIZE - 1) // HASH_LOOKUP_BATCH_SIZE
        assert in_call_count == expected_batches, (
            f"expected {expected_batches} .in_() calls for 250 hashes "
            f"with batch={HASH_LOOKUP_BATCH_SIZE}, got {in_call_count}"
        )
        # Each call's hash list must not exceed the batch cap
        for call in fake_client.table.return_value.select.return_value.in_.call_args_list:
            batch_arg = call.args[1]  # .in_("content_hash", batch_arg)
            assert len(batch_arg) <= HASH_LOOKUP_BATCH_SIZE
