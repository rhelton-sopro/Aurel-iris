"""Tests for D-N1 dedicated Contextual Retrieval budget guard (RAG-02 Ninja Pass, hardcap US$ 15).

Wave 0 scaffolding (06-01-PLAN). Each test currently SKIPS with the
implementation plan number that will turn it GREEN.

Covers:
  - HARDCAP_USD constant = 15.0 (D-N1)
  - PRICE_INPUT_PER_1M = 0.25 (Haiku 4.5 input pricing)
  - PRICE_CACHE_READ_PER_1M = 0.025 (10% of input — Anthropic prompt caching)
  - PRICE_OUTPUT_PER_1M = 1.25 (Haiku 4.5 output pricing)
  - Aborts when total exceeds $15
  - Cost calculation uses 3 token types correctly
"""
from __future__ import annotations
import pytest


class TestContextualBudgetGuard:
    @pytest.mark.skip(reason="Wave 0 — flip in 06-05-PLAN")
    def test_hardcap_constant_is_15_usd(self):
        from scripts.lib.budget import ContextualBudgetGuard  # noqa: F401
        assert ContextualBudgetGuard.HARDCAP_USD == 15.0

    @pytest.mark.skip(reason="Wave 0 — flip in 06-05-PLAN")
    def test_price_input_per_1m_is_haiku45_input(self):
        from scripts.lib.budget import ContextualBudgetGuard  # noqa: F401
        assert ContextualBudgetGuard.PRICE_INPUT_PER_1M == 0.25

    @pytest.mark.skip(reason="Wave 0 — flip in 06-05-PLAN")
    def test_price_cache_read_per_1m_is_10pct_of_input(self):
        # Anthropic prompt caching: cache reads cost 10% of input tokens
        from scripts.lib.budget import ContextualBudgetGuard  # noqa: F401
        assert ContextualBudgetGuard.PRICE_CACHE_READ_PER_1M == 0.025

    @pytest.mark.skip(reason="Wave 0 — flip in 06-05-PLAN")
    def test_aborts_when_total_exceeds_15usd(self):
        from scripts.lib.budget import ContextualBudgetGuard, BudgetExceeded  # noqa: F401
        guard = ContextualBudgetGuard()
        # Pump enough output tokens to cross $15
        # 15M output tokens × $1.25/1M = $18.75 (over $15)
        with pytest.raises(BudgetExceeded):
            guard.add(input_tokens=0, cached_tokens=0, output_tokens=15_000_000)

    @pytest.mark.skip(reason="Wave 0 — flip in 06-05-PLAN")
    def test_cost_calculation_uses_three_token_types(self):
        # Verify the formula: (input*0.25 + cached*0.025 + output*1.25) / 1M
        from scripts.lib.budget import ContextualBudgetGuard  # noqa: F401
        guard = ContextualBudgetGuard()
        guard.add(input_tokens=1000, cached_tokens=2000, output_tokens=500)
        expected = (1000 * 0.25 + 2000 * 0.025 + 500 * 1.25) / 1_000_000
        assert abs(guard.total_cost_usd - expected) < 1e-9
