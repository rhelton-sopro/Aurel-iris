"""Tests for D-N1 Contextual Retrieval (RAG-02 Ninja Pass).

Wave 0 scaffolding (06-01-PLAN). Each test currently SKIPS with the
implementation plan number that will turn it GREEN.

Covers:
  - situate_chunk returns string from Anthropic Haiku 4.5 response
  - Chapter passed in cached system block (cache_control={'type': 'ephemeral'})
  - Default model 'claude-haiku-4-5' (D-N1 + PATTERNS line 317)
  - Budget guard receives correct token counts (input/cached/output)
  - PROMPT_TEMPLATE matches Anthropic canonical (RESEARCH lines 723–730)
"""
from __future__ import annotations
import pytest


class TestContextualizer:
    @pytest.mark.skip(reason="Wave 0 — flip in 06-06-PLAN")
    def test_situate_chunk_returns_string_when_anthropic_succeeds(self, monkeypatch):
        from scripts.lib.contextualizer import situate_chunk  # noqa: F401
        from unittest.mock import MagicMock
        mock_anthropic = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="Trecho do CAPÍTULO I sobre constituição biliar")]
        mock_response.usage.input_tokens = 50
        mock_response.usage.cache_read_input_tokens = 1000
        mock_response.usage.output_tokens = 25
        mock_anthropic.messages.create.return_value = mock_response
        result = situate_chunk(client=mock_anthropic, chapter_text="...", chunk_text="...")
        assert isinstance(result, str)
        assert result.startswith("Trecho")

    @pytest.mark.skip(reason="Wave 0 — flip in 06-06-PLAN")
    def test_situate_chunk_passes_chapter_in_cached_system_block(self, monkeypatch):
        # D-N1 + PATTERNS lines 326–334: cache_control={'type': 'ephemeral'} on chapter block
        from scripts.lib.contextualizer import situate_chunk  # noqa: F401
        from unittest.mock import MagicMock
        mock_anthropic = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="contexto")]
        mock_response.usage.input_tokens = 10
        mock_response.usage.cache_read_input_tokens = 0
        mock_response.usage.output_tokens = 5
        mock_anthropic.messages.create.return_value = mock_response
        situate_chunk(client=mock_anthropic, chapter_text="capítulo inteiro", chunk_text="trecho")
        kwargs = mock_anthropic.messages.create.call_args.kwargs
        # System block must contain cached chapter content
        system = kwargs.get("system", [])
        assert any(
            isinstance(block, dict) and block.get("cache_control") == {"type": "ephemeral"}
            for block in system
        )

    @pytest.mark.skip(reason="Wave 0 — flip in 06-06-PLAN")
    def test_situate_chunk_uses_haiku_4_5_by_default(self, monkeypatch):
        # D-N1 + PATTERNS line 317
        from scripts.lib.contextualizer import situate_chunk  # noqa: F401
        from unittest.mock import MagicMock
        mock_anthropic = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="x")]
        mock_response.usage.input_tokens = 1
        mock_response.usage.cache_read_input_tokens = 0
        mock_response.usage.output_tokens = 1
        mock_anthropic.messages.create.return_value = mock_response
        situate_chunk(client=mock_anthropic, chapter_text="c", chunk_text="t")
        kwargs = mock_anthropic.messages.create.call_args.kwargs
        assert kwargs["model"] == "claude-haiku-4-5"

    @pytest.mark.skip(reason="Wave 0 — flip in 06-06-PLAN")
    def test_situate_chunk_calls_guard_add_with_token_counts(self, monkeypatch):
        # ContextualBudgetGuard receives input/cached/output from response.usage
        from scripts.lib.contextualizer import situate_chunk  # noqa: F401
        from unittest.mock import MagicMock
        mock_anthropic = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="ctx")]
        mock_response.usage.input_tokens = 50
        mock_response.usage.cache_read_input_tokens = 1500
        mock_response.usage.output_tokens = 30
        mock_anthropic.messages.create.return_value = mock_response
        mock_guard = MagicMock()
        situate_chunk(
            client=mock_anthropic, chapter_text="c", chunk_text="t", guard=mock_guard,
        )
        mock_guard.add.assert_called_once()
        kwargs = mock_guard.add.call_args.kwargs
        assert kwargs["input_tokens"] == 50
        assert kwargs["cached_tokens"] == 1500
        assert kwargs["output_tokens"] == 30

    @pytest.mark.skip(reason="Wave 0 — flip in 06-06-PLAN")
    def test_prompt_template_matches_anthropic_canonical(self):
        # RESEARCH lines 723–730 verbatim — <chunk>{chunk}</chunk> required
        from scripts.lib.contextualizer import PROMPT_TEMPLATE  # noqa: F401
        assert "<chunk>{chunk}</chunk>" in PROMPT_TEMPLATE
