"""Tests for vision-service/scripts/lib/contextualizer.py — D-N1.

Wave 0 stubs (06-01) used a `client=` parameter. PLAN 06-06 establishes the
authoritative API: `situate_chunk(chunk_text, chapter_text, *, guard, model=...)`
where the anthropic client is constructed internally from `ANTHROPIC_API_KEY`.
Tests patch `anthropic.Anthropic` to inject the mock — pure unit tests, no real API.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from scripts.lib.budget import BudgetExceeded, ContextualBudgetGuard
from scripts.lib.contextualizer import PROMPT_TEMPLATE, situate_chunk


def make_fake_anthropic_response(
    *,
    text: str,
    in_tokens=100,
    cache_tokens=50,
    out_tokens=20,
    cache_creation_5m=0,
    cache_creation_1h=0,
):
    response = MagicMock()
    response.content = [MagicMock(text=text)]
    response.usage.input_tokens = in_tokens
    response.usage.cache_read_input_tokens = cache_tokens
    response.usage.output_tokens = out_tokens
    # cache_creation_input_tokens is the legacy lump field; the structured
    # usage.cache_creation breaks it down by TTL bucket.
    response.usage.cache_creation_input_tokens = cache_creation_5m + cache_creation_1h
    response.usage.cache_creation = MagicMock(
        ephemeral_5m_input_tokens=cache_creation_5m,
        ephemeral_1h_input_tokens=cache_creation_1h,
    )
    return response


class TestSituateChunk:
    def test_situate_chunk_returns_string(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        fake_client = MagicMock()
        fake_client.messages.create.return_value = make_fake_anthropic_response(text="  test context  ")
        with patch("anthropic.Anthropic", return_value=fake_client):
            guard = ContextualBudgetGuard()
            result = situate_chunk("chunk text", "chapter text", guard=guard)
        assert result == "test context"

    def test_situate_chunk_passes_chapter_in_cached_system_block(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        fake_client = MagicMock()
        fake_client.messages.create.return_value = make_fake_anthropic_response(text="ctx")
        with patch("anthropic.Anthropic", return_value=fake_client):
            guard = ContextualBudgetGuard()
            situate_chunk("the chunk", "FULL CHAPTER TEXT", guard=guard)
        kwargs = fake_client.messages.create.call_args.kwargs
        system_blocks = kwargs["system"]
        assert isinstance(system_blocks, list) and len(system_blocks) == 2
        cached_block = system_blocks[1]
        # 06-08 fix: switched from default 5-min ephemeral to 1h TTL because
        # Tier 1 50K TPM throttling stretches per-chapter processing past 5 min.
        assert cached_block["cache_control"] == {"type": "ephemeral", "ttl": "1h"}
        assert "FULL CHAPTER TEXT" in cached_block["text"]

    def test_situate_chunk_uses_haiku_4_5_by_default(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        fake_client = MagicMock()
        fake_client.messages.create.return_value = make_fake_anthropic_response(text="ctx")
        with patch("anthropic.Anthropic", return_value=fake_client):
            guard = ContextualBudgetGuard()
            situate_chunk("c", "ch", guard=guard)
        assert fake_client.messages.create.call_args.kwargs["model"] == "claude-haiku-4-5"

    def test_situate_chunk_honors_override_model(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        fake_client = MagicMock()
        fake_client.messages.create.return_value = make_fake_anthropic_response(text="ctx")
        with patch("anthropic.Anthropic", return_value=fake_client):
            guard = ContextualBudgetGuard()
            situate_chunk("c", "ch", guard=guard, model="claude-sonnet-4-6")
        assert fake_client.messages.create.call_args.kwargs["model"] == "claude-sonnet-4-6"

    def test_situate_chunk_calls_guard_add_with_token_counts(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        fake_client = MagicMock()
        fake_client.messages.create.return_value = make_fake_anthropic_response(
            text="ctx", in_tokens=200, cache_tokens=80, out_tokens=15,
            cache_creation_5m=0, cache_creation_1h=12000,
        )
        guard = MagicMock(spec=ContextualBudgetGuard)
        with patch("anthropic.Anthropic", return_value=fake_client):
            situate_chunk("c", "ch", guard=guard)
        # 06-08 fix: guard.add now receives 5 token buckets, including the
        # cache_creation breakdown by TTL. cache_creation_1h=12000 reflects the
        # 1h cache write the contextualizer requested via cache_control.
        guard.add.assert_called_once_with(
            input_tokens=200, cached_tokens=80, output_tokens=15,
            cache_creation_5min_tokens=0, cache_creation_1h_tokens=12000,
        )

    def test_prompt_template_matches_anthropic_canonical(self):
        # RESEARCH lines 723-730 verbatim
        assert "<chunk>{chunk}</chunk>" in PROMPT_TEMPLATE
        assert "Please give a short succinct context" in PROMPT_TEMPLATE
        assert "succinct context and nothing else" in PROMPT_TEMPLATE

    def test_raises_when_anthropic_api_key_missing(self, monkeypatch):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        guard = ContextualBudgetGuard()
        with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY is not set"):
            situate_chunk("c", "ch", guard=guard)

    def test_propagates_budget_exceeded(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        fake_client = MagicMock()
        fake_client.messages.create.return_value = make_fake_anthropic_response(text="ctx")
        guard = MagicMock(spec=ContextualBudgetGuard)
        guard.add.side_effect = BudgetExceeded("contextual hardcap")
        with patch("anthropic.Anthropic", return_value=fake_client):
            with pytest.raises(BudgetExceeded, match="contextual hardcap"):
                situate_chunk("c", "ch", guard=guard)

    def test_response_text_is_stripped(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        fake_client = MagicMock()
        fake_client.messages.create.return_value = make_fake_anthropic_response(text="\n  context here\n")
        with patch("anthropic.Anthropic", return_value=fake_client):
            guard = ContextualBudgetGuard()
            result = situate_chunk("c", "ch", guard=guard)
        assert result == "context here"

    def test_handles_none_cache_read_tokens_defensively(self, monkeypatch):
        # Defensive getattr fallback: when SDK returns None for cache_read_input_tokens,
        # guard.add must receive 0 (not None) to keep budget arithmetic intact.
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        fake_client = MagicMock()
        fake_response = MagicMock()
        fake_response.content = [MagicMock(text="ctx")]
        fake_response.usage.input_tokens = 50
        fake_response.usage.cache_read_input_tokens = None  # SDK quirk
        fake_response.usage.cache_creation_input_tokens = 0
        fake_response.usage.cache_creation = None
        fake_response.usage.output_tokens = 10
        fake_client.messages.create.return_value = fake_response
        guard = MagicMock(spec=ContextualBudgetGuard)
        with patch("anthropic.Anthropic", return_value=fake_client):
            situate_chunk("c", "ch", guard=guard)
        kwargs = guard.add.call_args.kwargs
        assert kwargs["cached_tokens"] == 0  # not None

    def test_truncates_chapter_context_when_over_anthropic_limit(self, monkeypatch, capsys):
        # Bug encountered during 06-08 full ingest: Spanish manual produced
        # 407 chunks all with chapter=None (regex didn't catch "CAPÍTULO"),
        # and the aggregated chapter_text overflowed Anthropic's 200K window
        # (209,605 tokens for that single book → API 400 error).
        # Fix: truncate chapter_text to MAX_CONTEXT_TOKENS before send.
        from scripts.lib.contextualizer import MAX_CONTEXT_TOKENS, _TRUNCATION_WARNED_KEYS
        _TRUNCATION_WARNED_KEYS.clear()  # reset between tests
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        fake_client = MagicMock()
        fake_client.messages.create.return_value = make_fake_anthropic_response(text="ctx")
        # Build a chapter_text that is well over the cap. cl100k_base is roughly
        # 4 chars/token for ASCII; 250K tokens ≈ 1M chars.
        oversized = "lorem ipsum dolor sit amet consectetur adipiscing elit " * 50_000
        with patch("anthropic.Anthropic", return_value=fake_client):
            guard = ContextualBudgetGuard()
            situate_chunk("the chunk", oversized, guard=guard)
        # The cached system block must contain the TRUNCATED text, not the original
        sent_text = fake_client.messages.create.call_args.kwargs["system"][1]["text"]
        # Body of the <document> tag — count tokens
        import tiktoken
        enc = tiktoken.get_encoding("cl100k_base")
        sent_tokens = len(enc.encode(sent_text))
        # sent_text wraps with <document>...</document>, so tolerance for the wrapper
        assert sent_tokens <= MAX_CONTEXT_TOKENS + 100, f"sent {sent_tokens} > cap {MAX_CONTEXT_TOKENS}"
        # Warning emitted to stderr
        captured = capsys.readouterr()
        assert "WARNING" in captured.err and "MAX_CONTEXT_TOKENS" not in captured.err  # human-readable msg

    def test_does_not_truncate_when_under_limit(self, monkeypatch, capsys):
        from scripts.lib.contextualizer import _TRUNCATION_WARNED_KEYS
        _TRUNCATION_WARNED_KEYS.clear()
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        fake_client = MagicMock()
        fake_client.messages.create.return_value = make_fake_anthropic_response(text="ctx")
        normal_chapter = "small chapter body " * 100  # well under cap
        with patch("anthropic.Anthropic", return_value=fake_client):
            situate_chunk("c", normal_chapter, guard=ContextualBudgetGuard())
        sent_text = fake_client.messages.create.call_args.kwargs["system"][1]["text"]
        assert normal_chapter in sent_text  # original text preserved verbatim
        captured = capsys.readouterr()
        assert "WARNING" not in captured.err  # no warning when under cap
