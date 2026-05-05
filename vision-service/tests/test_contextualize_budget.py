"""Tests for vision-service/scripts/lib/budget.ContextualBudgetGuard — D-N1.

Plan: 06-05 (Wave 1).
"""
from __future__ import annotations

import pytest

from scripts.lib.budget import BudgetExceeded, ContextualBudgetGuard


class TestContextualBudgetGuard:
    def test_hardcap_constant_is_15_usd(self):
        assert ContextualBudgetGuard.HARDCAP_USD == 15.0

    def test_price_input_per_1m_is_haiku45_input(self):
        assert ContextualBudgetGuard.PRICE_INPUT_PER_1M == 0.25

    def test_price_cache_read_per_1m_is_10pct_of_input(self):
        assert ContextualBudgetGuard.PRICE_CACHE_READ_PER_1M == 0.025

    def test_price_output_per_1m_is_haiku45_output(self):
        assert ContextualBudgetGuard.PRICE_OUTPUT_PER_1M == 1.25

    def test_initial_state_zero(self):
        g = ContextualBudgetGuard()
        assert g.input_tokens == 0
        assert g.cached_tokens == 0
        assert g.output_tokens == 0
        assert g.cost_usd == 0.0

    def test_cost_calculation_uses_three_token_types(self):
        g = ContextualBudgetGuard()
        g.add(input_tokens=1_000, cached_tokens=2_000, output_tokens=500)
        expected = (1_000 * 0.25 + 2_000 * 0.025 + 500 * 1.25) / 1_000_000
        assert abs(g.cost_usd - expected) < 1e-9

    def test_aborts_when_total_exceeds_15usd(self):
        g = ContextualBudgetGuard()
        # 100M output tokens × $1.25/M = $125 → way over $15
        with pytest.raises(BudgetExceeded, match="CONTEXTUAL HARD CAP REACHED"):
            g.add(input_tokens=0, cached_tokens=0, output_tokens=100_000_000)
