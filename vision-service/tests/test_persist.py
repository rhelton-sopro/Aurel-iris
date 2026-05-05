"""Tests for vision-service/scripts/lib/persister.py — D-E2, D-I2, D-P1.

Wave-0 stubs (06-01) used `from scripts.lib.persist import ...` and threaded
a `client=` parameter into upsert_chunks/purge_book. The PLAN's authoritative
API (06-07) renames the module to `persister` and constructs the client
internally from SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars; tests mock
the client at constructor level via `patch("supabase.create_client", ...)`.

This is the third occurrence of the "Wave-0-stub-API-superseded-by-spec"
pattern (after 06-05 budget/embedder and 06-06 contextualizer/manifest).
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from scripts.lib.persister import PersisterError, get_client, purge_book, upsert_chunks


VALID_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.signature"


class TestGetClient:
    def test_raises_when_url_missing(self, monkeypatch):
        monkeypatch.delenv("SUPABASE_URL", raising=False)
        monkeypatch.delenv("NEXT_PUBLIC_SUPABASE_URL", raising=False)
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", VALID_KEY)
        with pytest.raises(PersisterError, match="SUPABASE_URL"):
            get_client()

    def test_raises_when_service_role_key_missing(self, monkeypatch):
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
        with pytest.raises(PersisterError, match="SUPABASE_SERVICE_ROLE_KEY"):
            get_client()

    def test_raises_when_key_malformed(self, monkeypatch):
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "not-a-jwt-token")
        with pytest.raises(PersisterError, match="malformed"):
            get_client()

    def test_succeeds_with_valid_env(self, monkeypatch):
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", VALID_KEY)
        fake_client = MagicMock()
        with patch("supabase.create_client", return_value=fake_client) as mock_create:
            client = get_client()
        assert client is fake_client
        mock_create.assert_called_once_with("https://test.supabase.co", VALID_KEY)


class TestUpsertChunks:
    def test_returns_zero_for_empty_rows(self, monkeypatch):
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", VALID_KEY)
        # No mock needed — should return early without calling supabase
        assert upsert_chunks([]) == 0

    def test_calls_supabase_with_on_conflict_content_hash(self, monkeypatch):
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", VALID_KEY)
        fake_response = MagicMock()
        fake_response.data = [{"id": "1"}, {"id": "2"}]
        fake_client = MagicMock()
        fake_table = MagicMock()
        fake_upsert = MagicMock()
        fake_upsert.execute.return_value = fake_response
        fake_table.upsert.return_value = fake_upsert
        fake_client.table.return_value = fake_table
        with patch("supabase.create_client", return_value=fake_client):
            count = upsert_chunks(
                [
                    {"content": "a", "content_hash": "h1"},
                    {"content": "b", "content_hash": "h2"},
                ]
            )
        assert count == 2
        fake_client.table.assert_called_once_with("knowledge_chunks")
        fake_table.upsert.assert_called_once()
        kwargs = fake_table.upsert.call_args.kwargs
        assert kwargs["on_conflict"] == "content_hash"
        assert kwargs["ignore_duplicates"] is True

    def test_returns_count_of_inserted(self, monkeypatch):
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", VALID_KEY)
        fake_response = MagicMock()
        fake_response.data = [{"id": str(i)} for i in range(5)]
        fake_client = MagicMock()
        fake_client.table.return_value.upsert.return_value.execute.return_value = (
            fake_response
        )
        with patch("supabase.create_client", return_value=fake_client):
            count = upsert_chunks([{"content_hash": f"h{i}"} for i in range(7)])
        # Only 5 actually inserted (2 already existed and were skipped via ON CONFLICT)
        assert count == 5


class TestPurgeBook:
    def test_calls_delete_eq_source_book(self, monkeypatch):
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", VALID_KEY)
        fake_response = MagicMock()
        fake_response.data = [{"id": "1"}, {"id": "2"}, {"id": "3"}]
        fake_client = MagicMock()
        fake_table = MagicMock()
        fake_eq = MagicMock()
        fake_eq.execute.return_value = fake_response
        fake_table.delete.return_value.eq.return_value = fake_eq
        fake_client.table.return_value = fake_table
        with patch("supabase.create_client", return_value=fake_client):
            count = purge_book("Test Book Name")
        assert count == 3
        fake_client.table.assert_called_once_with("knowledge_chunks")
        fake_table.delete.return_value.eq.assert_called_once_with(
            "source_book", "Test Book Name"
        )
