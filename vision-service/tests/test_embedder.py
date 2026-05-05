"""Tests for RAG-02 Voyage embedder (D-E1: voyage-3, batch=128, retry 1/4/16s, dim=1024).

Wave 0 scaffolding (06-01-PLAN). Each test currently SKIPS with the
implementation plan number that will turn it GREEN.

Covers:
  - EMBEDDING_MODEL constant locked to 'voyage-3' (D-E1 + RESEARCH Pitfall 4)
  - BATCH_SIZE constant = 128 (D-E1)
  - input_type='document' passed to Voyage SDK (RESEARCH §input_type — DO NOT skip)
  - Returns 1024-dim embeddings (matches knowledge_chunks.embedding column)
  - Retry delays are 1s/4s/16s (D-E1)
  - Raises VoyageEmbedError when API key missing
"""
from __future__ import annotations
import pytest


class TestEmbedder:
    @pytest.mark.skip(reason="Wave 0 — flip in 06-05-PLAN")
    def test_embedding_model_constant_is_voyage_3(self):
        from scripts.lib import embedder  # noqa: F401
        assert embedder.EMBEDDING_MODEL == "voyage-3"

    @pytest.mark.skip(reason="Wave 0 — flip in 06-05-PLAN")
    def test_batch_size_constant_is_128(self):
        from scripts.lib import embedder  # noqa: F401
        assert embedder.BATCH_SIZE == 128

    @pytest.mark.skip(reason="Wave 0 — flip in 06-05-PLAN")
    def test_input_type_document_passed_to_voyage(self, monkeypatch):
        # RESEARCH §input_type — DO NOT skip; ingestion path uses input_type='document'
        from scripts.lib import embedder  # noqa: F401
        from unittest.mock import MagicMock
        mock_client = MagicMock()
        mock_client.embed.return_value.embeddings = [[0.0] * 1024] * 2
        monkeypatch.setattr(embedder, "_get_client", lambda: mock_client)
        embedder.embed_batch(["doc 1", "doc 2"])
        kwargs = mock_client.embed.call_args.kwargs
        assert kwargs["input_type"] == "document"

    @pytest.mark.skip(reason="Wave 0 — flip in 06-05-PLAN")
    def test_returns_1024_dim_embeddings(self, monkeypatch):
        from scripts.lib import embedder  # noqa: F401
        from unittest.mock import MagicMock
        mock_client = MagicMock()
        mock_client.embed.return_value.embeddings = [[0.0] * 1024] * 128
        monkeypatch.setattr(embedder, "_get_client", lambda: mock_client)
        vectors = embedder.embed_batch(["text"] * 128)
        assert len(vectors) == 128
        for vec in vectors:
            assert len(vec) == 1024

    @pytest.mark.skip(reason="Wave 0 — flip in 06-05-PLAN")
    def test_retry_delays_are_1_4_16_seconds(self):
        from scripts.lib import embedder  # noqa: F401
        assert embedder.RETRY_DELAYS == (1.0, 4.0, 16.0)

    @pytest.mark.skip(reason="Wave 0 — flip in 06-05-PLAN")
    def test_raises_voyage_embed_error_when_api_key_missing(self, monkeypatch):
        from scripts.lib import embedder  # noqa: F401
        monkeypatch.delenv("VOYAGE_API_KEY", raising=False)
        with pytest.raises(embedder.VoyageEmbedError):
            embedder.embed_batch(["text"])
