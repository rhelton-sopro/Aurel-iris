"""Tests for vision-service/scripts/lib/embedder.py — RAG-02 (D-E1).

Plan: 06-05 (Wave 1).
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from scripts.lib.budget import BudgetExceeded, VoyageBudgetGuard
from scripts.lib.embedder import (
    BATCH_SIZE,
    EMBEDDING_MODEL,
    RETRY_DELAYS,
    VoyageEmbedError,
    embed_batch,
)


class TestEmbedderConstants:
    def test_embedding_model_constant_is_voyage_3(self):
        # RESEARCH Pitfall 4 — must match apps/web/lib/rag/embed.ts (06-09)
        assert EMBEDDING_MODEL == "voyage-3"

    def test_batch_size_constant_is_128(self):
        assert BATCH_SIZE == 128

    def test_retry_delays_are_1_4_16_seconds(self):
        # D-E1 verbatim
        assert RETRY_DELAYS == (1.0, 4.0, 16.0)


class TestEmbedBatch:
    def test_raises_voyage_embed_error_when_api_key_missing(self, monkeypatch):
        monkeypatch.delenv("VOYAGE_API_KEY", raising=False)
        with pytest.raises(VoyageEmbedError, match="VOYAGE_API_KEY is not set"):
            embed_batch(["text"])

    def test_raises_when_batch_oversized(self, monkeypatch):
        monkeypatch.setenv("VOYAGE_API_KEY", "test-key")
        texts = ["x"] * 200
        with pytest.raises(VoyageEmbedError, match="batch size 200 exceeds"):
            embed_batch(texts)

    def test_input_type_document_passed_to_voyage(self, monkeypatch):
        monkeypatch.setenv("VOYAGE_API_KEY", "test-key")
        fake_response = MagicMock()
        fake_response.embeddings = [[0.0] * 1024]
        fake_response.total_tokens = 100
        fake_client = MagicMock()
        fake_client.embed.return_value = fake_response
        with patch("voyageai.Client", return_value=fake_client):
            embed_batch(["sample"], input_type="document")
        kwargs = fake_client.embed.call_args.kwargs
        assert kwargs["input_type"] == "document"
        assert kwargs["model"] == "voyage-3"
        assert kwargs["truncation"] is True

    def test_returns_1024_dim_embeddings(self, monkeypatch):
        monkeypatch.setenv("VOYAGE_API_KEY", "test-key")
        fake_response = MagicMock()
        fake_response.embeddings = [[0.0] * 1024 for _ in range(3)]
        fake_response.total_tokens = 300
        fake_client = MagicMock()
        fake_client.embed.return_value = fake_response
        with patch("voyageai.Client", return_value=fake_client):
            result = embed_batch(["a", "b", "c"])
        assert len(result) == 3
        assert all(len(v) == 1024 for v in result)

    def test_calls_guard_add_with_total_tokens(self, monkeypatch):
        monkeypatch.setenv("VOYAGE_API_KEY", "test-key")
        fake_response = MagicMock()
        fake_response.embeddings = [[0.0] * 1024]
        fake_response.total_tokens = 250
        fake_client = MagicMock()
        fake_client.embed.return_value = fake_response
        guard = MagicMock(spec=VoyageBudgetGuard)
        with patch("voyageai.Client", return_value=fake_client):
            embed_batch(["sample"], guard=guard, book="Test Book", total_chunks=10)
        guard.add.assert_called_once_with(tokens=250, book="Test Book", total_chunks=10)

    def test_retries_then_raises_after_3_attempts(self, monkeypatch):
        monkeypatch.setenv("VOYAGE_API_KEY", "test-key")
        # Patch sleep to avoid actually waiting 21 seconds
        monkeypatch.setattr("scripts.lib.embedder.time.sleep", lambda *_: None)
        fake_client = MagicMock()
        fake_client.embed.side_effect = RuntimeError("API down")
        with patch("voyageai.Client", return_value=fake_client):
            with pytest.raises(VoyageEmbedError, match="failed after 3 retries"):
                embed_batch(["sample"])
        # 1 initial + 3 retries = 4 calls
        assert fake_client.embed.call_count == 4

    def test_budget_exceeded_propagates_immediately(self, monkeypatch):
        monkeypatch.setenv("VOYAGE_API_KEY", "test-key")
        fake_response = MagicMock()
        fake_response.embeddings = [[0.0] * 1024]
        fake_response.total_tokens = 100
        fake_client = MagicMock()
        fake_client.embed.return_value = fake_response
        guard = MagicMock(spec=VoyageBudgetGuard)
        guard.add.side_effect = BudgetExceeded("hardcap")
        with patch("voyageai.Client", return_value=fake_client):
            with pytest.raises(BudgetExceeded, match="hardcap"):
                embed_batch(["sample"], guard=guard)
        # Must NOT retry on budget hit — guard.add called once
        assert guard.add.call_count == 1
        assert fake_client.embed.call_count == 1
