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
