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
        # Founder-verified 2026-05-05 against Anthropic console pricing.
        # Prior constant ($0.25) reflected Haiku 3 pricing — 3.2× too low.
        assert ContextualBudgetGuard.PRICE_INPUT_PER_1M == 0.80

    def test_price_cache_read_per_1m_is_10pct_of_input(self):
        # Anthropic standard: cache reads cost 10% of input price ($0.80 × 0.10 = $0.08)
        assert ContextualBudgetGuard.PRICE_CACHE_READ_PER_1M == 0.08

    def test_price_cache_write_5min_per_1m(self):
        # Anthropic standard: 5-min cache writes cost 1.25× input ($0.80 × 1.25 = $1.00)
        assert ContextualBudgetGuard.PRICE_CACHE_WRITE_5MIN_PER_1M == 1.00

    def test_price_cache_write_1h_per_1m(self):
        # Anthropic standard: 1-hour cache writes cost 2× the 5-min rate ($1.00 × 2 = $2.00)
        # Assumption pending dashboard verification on long-TTL writes.
        assert ContextualBudgetGuard.PRICE_CACHE_WRITE_1H_PER_1M == 2.00

    def test_price_output_per_1m_is_haiku45_output(self):
        # Founder-verified 2026-05-05: Haiku 4.5 output is $4.00/1M (5× input)
        assert ContextualBudgetGuard.PRICE_OUTPUT_PER_1M == 4.00

    def test_initial_state_zero(self):
        g = ContextualBudgetGuard()
        assert g.input_tokens == 0
        assert g.cached_tokens == 0
        assert g.output_tokens == 0
        assert g.cost_usd == 0.0

    def test_cost_calculation_uses_three_token_types(self):
        g = ContextualBudgetGuard()
        g.add(input_tokens=1_000, cached_tokens=2_000, output_tokens=500)
        expected = (1_000 * 0.80 + 2_000 * 0.08 + 500 * 4.00) / 1_000_000
        assert abs(g.cost_usd - expected) < 1e-9

    def test_aborts_when_total_exceeds_15usd(self):
        g = ContextualBudgetGuard()
        # 4M output tokens × $4.00/M = $16 → over $15
        with pytest.raises(BudgetExceeded, match="CONTEXTUAL HARD CAP REACHED"):
            g.add(input_tokens=0, cached_tokens=0, output_tokens=4_000_000)

    def test_cache_creation_tokens_tracked_at_correct_prices(self):
        # 06-08 fix: cost accounting must include cache_creation buckets.
        # Bug surfaced when ContextualBudgetGuard.cost_usd watched only ~$1-2
        # while Anthropic dashboard charged $15+ for cache_creation_input_tokens
        # we never tracked.
        g = ContextualBudgetGuard()
        g.add(
            input_tokens=1_000,
            cached_tokens=2_000,
            output_tokens=500,
            cache_creation_5min_tokens=10_000,
            cache_creation_1h_tokens=20_000,
        )
        expected = (
            1_000 * 0.80      # input
            + 10_000 * 1.00   # 5-min cache write
            + 20_000 * 2.00   # 1-hour cache write
            + 2_000 * 0.08    # cache read
            + 500 * 4.00      # output
        ) / 1_000_000
        assert abs(g.cost_usd - expected) < 1e-9

    def test_cache_hit_rate_diagnostic(self):
        # cache_hit_rate exposes the % of calls that hit cache (cached_tokens > 0).
        # Used by the end-of-run summary to flag when caching isn't engaging.
        g = ContextualBudgetGuard()
        # 3 cache hits, 2 misses
        for _ in range(3):
            g.add(input_tokens=100, cached_tokens=5_000, output_tokens=50)
        for _ in range(2):
            g.add(
                input_tokens=100, cached_tokens=0, output_tokens=50,
                cache_creation_1h_tokens=5_000,
            )
        assert g.calls == 5
        assert g.cache_hit_calls == 3
        assert abs(g.cache_hit_rate - 0.6) < 1e-9

    def test_cache_hit_rate_zero_calls(self):
        g = ContextualBudgetGuard()
        assert g.cache_hit_rate == 0.0  # no division by zero
