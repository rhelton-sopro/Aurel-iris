"""Tests for vision-service/scripts/lib/budget.py — D-G1, D-G2.

Plan: 06-05 (Wave 1).
"""
from __future__ import annotations

import pytest

from scripts.lib.budget import BudgetExceeded, VoyageBudgetGuard


class TestVoyageBudgetGuard:
    def test_hardcap_constant_is_5_usd(self):
        assert VoyageBudgetGuard.HARDCAP_USD == 5.0

    def test_price_per_1m_tokens_is_voyage3(self):
        assert VoyageBudgetGuard.PRICE_PER_1M_TOKENS == 0.06

    def test_initial_state_zero(self):
        g = VoyageBudgetGuard()
        assert g.total_tokens == 0
        assert g.chunks_indexed == 0
        assert g.cost_usd == 0.0

    def test_add_increments_tokens_and_chunks(self):
        g = VoyageBudgetGuard()
        g.add(tokens=1_000, book="X", total_chunks=100)
        assert g.total_tokens == 1_000
        assert g.chunks_indexed == 1

    def test_aborts_when_running_total_exceeds_hardcap(self):
        g = VoyageBudgetGuard()
        # 100M tokens × $0.06/M = $6 (> $5 hardcap)
        with pytest.raises(BudgetExceeded, match="HARD CAP REACHED"):
            g.add(tokens=100_000_000, book="big book", total_chunks=1)

    def test_logs_progress_every_10_chunks(self, capsys):
        g = VoyageBudgetGuard()
        for _ in range(20):
            g.add(tokens=100, book="X", total_chunks=20)
        captured = capsys.readouterr().out
        progress_lines = [l for l in captured.splitlines() if l.startswith("[ingest] chunk ")]
        assert len(progress_lines) >= 2  # 10/20 and 20/20

    def test_alert_ladder_fires_at_each_dollar(self, capsys):
        g = VoyageBudgetGuard()
        # ~$4.50 in one shot — should fire alerts at $1, $2, $3, $4
        g.add(tokens=75_000_000, book="X", total_chunks=1)
        captured = capsys.readouterr().out
        alert_lines = [l for l in captured.splitlines() if "ALERT: cost crossed" in l]
        assert len(alert_lines) == 4, f"expected 4 alerts, got {len(alert_lines)}: {alert_lines}"
