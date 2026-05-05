"""Tests for D-E2 persister (RAG-02, ON CONFLICT idempotent insert + purge).

Wave 0 scaffolding (06-01-PLAN). Each test currently SKIPS with the
implementation plan number that will turn it GREEN.

Covers:
  - get_client raises when SUPABASE_SERVICE_ROLE_KEY missing
  - get_client raises when key malformed (RESEARCH Pitfall 14 — non-eyJ-prefixed)
  - upsert calls supabase with on_conflict='content_hash' + ignore_duplicates=True
  - purge_book calls .delete().eq('source_book', X).execute() (D-I2)
"""
from __future__ import annotations
import pytest


class TestPersister:
    @pytest.mark.skip(reason="Wave 0 — flip in 06-07-PLAN")
    def test_get_client_raises_when_service_role_key_missing(self, monkeypatch):
        from scripts.lib.persist import get_client  # noqa: F401
        monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
        with pytest.raises(RuntimeError):
            get_client()

    @pytest.mark.skip(reason="Wave 0 — flip in 06-07-PLAN")
    def test_get_client_raises_when_key_malformed(self, monkeypatch):
        # RESEARCH Pitfall 14: service-role key must start with 'eyJ'
        from scripts.lib.persist import get_client  # noqa: F401
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "not-a-jwt")
        monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
        with pytest.raises(RuntimeError):
            get_client()

    @pytest.mark.skip(reason="Wave 0 — flip in 06-07-PLAN")
    def test_upsert_calls_supabase_with_on_conflict_content_hash(self, monkeypatch):
        # D-E2: idempotent insert via ON CONFLICT (content_hash) DO NOTHING
        from scripts.lib.persist import upsert_chunks  # noqa: F401
        from unittest.mock import MagicMock
        mock_client = MagicMock()
        rows = [{"content_hash": "abc", "text": "x", "source_book": "Y"}]
        upsert_chunks(mock_client, rows)
        mock_client.from_.assert_called_with("knowledge_chunks")
        upsert_call = mock_client.from_.return_value.upsert
        upsert_call.assert_called_once()
        args, kwargs = upsert_call.call_args
        assert kwargs.get("on_conflict") == "content_hash"
        assert kwargs.get("ignore_duplicates") is True

    @pytest.mark.skip(reason="Wave 0 — flip in 06-07-PLAN")
    def test_purge_book_calls_delete_eq_source_book(self, monkeypatch):
        # D-I2: drop & recreate by source_book
        from scripts.lib.persist import purge_book  # noqa: F401
        from unittest.mock import MagicMock
        mock_client = MagicMock()
        purge_book(mock_client, "Bernard Jensen Iridology")
        mock_client.from_.assert_called_with("knowledge_chunks")
        delete_chain = mock_client.from_.return_value.delete.return_value
        delete_chain.eq.assert_called_with("source_book", "Bernard Jensen Iridology")
