"""Tests for D-G1 Voyage embedding budget guard (RAG-02, hardcap US$ 5).

Wave 0 scaffolding (06-01-PLAN). Each test currently SKIPS with the
implementation plan number that will turn it GREEN.

Covers:
  - HARDCAP_USD constant = 5.0 (D-G1)
  - PRICE_PER_1M_TOKENS = 0.06 (voyage-3 pricing locked)
  - Aborts (raises BudgetExceeded) when running total crosses hardcap
  - Logs progress every 10 chunks (D-G2)
"""
from __future__ import annotations
import pytest


class TestVoyageBudgetGuard:
    @pytest.mark.skip(reason="Wave 0 — flip in 06-05-PLAN")
    def test_hardcap_constant_is_5_usd(self):
        from scripts.lib.budget import VoyageBudgetGuard  # noqa: F401
        assert VoyageBudgetGuard.HARDCAP_USD == 5.0

    @pytest.mark.skip(reason="Wave 0 — flip in 06-05-PLAN")
    def test_price_per_1m_tokens_is_voyage3(self):
        from scripts.lib.budget import VoyageBudgetGuard  # noqa: F401
        assert VoyageBudgetGuard.PRICE_PER_1M_TOKENS == 0.06

    @pytest.mark.skip(reason="Wave 0 — flip in 06-05-PLAN")
    def test_aborts_when_running_total_exceeds_hardcap(self):
        from scripts.lib.budget import VoyageBudgetGuard, BudgetExceeded  # noqa: F401
        guard = VoyageBudgetGuard()
        # 100M tokens × $0.06/1M = $6 → over $5 hardcap
        with pytest.raises(BudgetExceeded):
            guard.add(tokens=100_000_000, source_book="X")

    @pytest.mark.skip(reason="Wave 0 — flip in 06-05-PLAN")
    def test_logs_progress_every_10_chunks(self, capsys):
        # D-G2: structured log line every 10 chunks
        from scripts.lib.budget import VoyageBudgetGuard  # noqa: F401
        guard = VoyageBudgetGuard()
        for i in range(20):
            guard.add(tokens=600, source_book="Test Book")
        captured = capsys.readouterr()
        log_lines = [ln for ln in captured.out.splitlines() if ln.startswith("[ingest] chunk ")]
        assert len(log_lines) >= 2
