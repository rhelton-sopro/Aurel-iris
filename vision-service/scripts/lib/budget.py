"""D-G1 hardcap + D-G2 logging + D-N1 dedicated Contextual hardcap.

VoyageBudgetGuard (D-G1, D-G2):
  - $5.00 hardcap on voyage-3 embedding cost during one-shot ingestion.
  - Logs every 10 chunks with format:
      [ingest] chunk N/total | tokens X | est_cost $Y | book "name"
  - Alerts at $1, $2, $3, $4 thresholds before reaching hardcap.
  - Raises BudgetExceeded when running cost crosses $5.

ContextualBudgetGuard (D-N1):
  - $15.00 dedicated hardcap for Contextual Retrieval (Haiku 4.5 + prompt cache).
  - Tracks 3 token types: input ($0.25/1M), cached read ($0.025/1M, 90% discount),
    output ($1.25/1M).
  - Raises BudgetExceeded when running cost crosses $15.

Phase: 06-rag-ingestao | Plan: 06-05
"""
from __future__ import annotations


class BudgetExceeded(Exception):
    """Raised when running cost crosses a configured hardcap. Caller may catch
    to gracefully abort the ingestion script."""


class VoyageBudgetGuard:
    """RESEARCH lines 622–669 verbatim. D-G1 = $5 hardcap, $1/2/3/4 alerts,
    D-G2 = log every 10 chunks."""

    PRICE_PER_1M_TOKENS = 0.06  # voyage-3 (D-E1)
    HARDCAP_USD = 5.00

    def __init__(self) -> None:
        self.total_tokens = 0
        self.chunks_indexed = 0
        self.next_alert_usd = 1.0  # alert at $1, $2, $3, $4

    @property
    def cost_usd(self) -> float:
        return self.total_tokens * self.PRICE_PER_1M_TOKENS / 1_000_000

    def add(self, tokens: int, book: str = "", total_chunks: int = 0) -> None:
        self.total_tokens += tokens
        self.chunks_indexed += 1
        # D-G2: log a cada 10 chunks
        if self.chunks_indexed % 10 == 0:
            print(
                f'[ingest] chunk {self.chunks_indexed}/{total_chunks} | '
                f'tokens {self.total_tokens:,} | '
                f'est_cost ${self.cost_usd:.4f} | '
                f'book "{book}"'
            )
        # alertas em $1/$2/$3/$4
        while self.cost_usd >= self.next_alert_usd and self.next_alert_usd <= 4:
            print(f'[ingest] ALERT: cost crossed ${self.next_alert_usd:.0f}')
            self.next_alert_usd += 1
        # D-G1: hardcap
        if self.cost_usd > self.HARDCAP_USD:
            raise BudgetExceeded(
                f'HARD CAP REACHED — ${self.HARDCAP_USD:.2f} spent '
                f'(${self.cost_usd:.4f} estimated). '
                f'Indexed {self.chunks_indexed} chunks. '
                f'Re-run idempotently: chunks already indexed will be skipped via content_hash. '
                f'Increase hardcap by editing INGEST_HARDCAP_USD in vision-service/scripts/ingest_knowledge.py.'
            )


class ContextualBudgetGuard:
    """D-N1 dedicated hardcap = US$15 (3× estimate of $3-9 with Haiku 4.5 + caching).

    Anthropic 2026 pricing for Haiku 4.5 (verify before deploy):
      input ~$0.25/1M, cache reads ~$0.025/1M (10% of input), output ~$1.25/1M.
    """

    HARDCAP_USD = 15.00
    PRICE_INPUT_PER_1M = 0.25
    PRICE_CACHE_READ_PER_1M = 0.025
    PRICE_OUTPUT_PER_1M = 1.25

    def __init__(self) -> None:
        self.input_tokens = 0
        self.cached_tokens = 0
        self.output_tokens = 0

    @property
    def cost_usd(self) -> float:
        return (
            self.input_tokens * self.PRICE_INPUT_PER_1M / 1_000_000
            + self.cached_tokens * self.PRICE_CACHE_READ_PER_1M / 1_000_000
            + self.output_tokens * self.PRICE_OUTPUT_PER_1M / 1_000_000
        )

    def add(self, *, input_tokens: int, cached_tokens: int, output_tokens: int) -> None:
        self.input_tokens += input_tokens
        self.cached_tokens += cached_tokens
        self.output_tokens += output_tokens
        if self.cost_usd > self.HARDCAP_USD:
            raise BudgetExceeded(
                f'CONTEXTUAL HARD CAP REACHED — ${self.HARDCAP_USD:.2f} spent '
                f'(${self.cost_usd:.4f} estimated; input={self.input_tokens}, '
                f'cached={self.cached_tokens}, output={self.output_tokens}).'
            )
