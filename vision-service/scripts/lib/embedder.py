"""Voyage embedding client — D-E1 (voyage-3, batches ≤128, retry 1s/4s/16s).

Mirror of apps/web/lib/vision/modal-client.ts: thin SDK wrapper, env-guarded,
custom error class, typed args/result.

EMBEDDING_MODEL constant MUST match apps/web/lib/rag/embed.ts (06-09).
RESEARCH Pitfall 4: model mismatch puts queries and documents in incompatible
embedding spaces — recall drops to near-random.

Phase: 06-rag-ingestao | Plan: 06-05 | Decisions: D-E1, D-N4, RESEARCH §input_type
"""
from __future__ import annotations

import os
import time
from typing import Sequence

from .budget import BudgetExceeded, VoyageBudgetGuard

# PINNED — must match apps/web/lib/rag/embed.ts (RESEARCH Pitfall 4)
EMBEDDING_MODEL = "voyage-3"
BATCH_SIZE = 128                    # D-E1
RETRY_DELAYS = (1.0, 4.0, 16.0)    # D-E1: NOT exponential — degraded fallback


class VoyageEmbedError(Exception):
    """Mirror of ModalTriggerError. Raised on persistent batch failure or env-missing."""


def embed_batch(
    texts: Sequence[str],
    *,
    input_type: str = "document",  # RESEARCH §input_type — DO NOT skip ('document' for ingestion)
    guard: VoyageBudgetGuard | None = None,
    book: str = "",
    total_chunks: int = 0,
) -> list[list[float]]:
    """Embed a batch of texts via Voyage; track cost via `guard`.

    Args:
        texts:        list of text strings; len ≤ BATCH_SIZE.
        input_type:   "document" for ingestion (default), "query" for retrieval-side reuse.
        guard:        VoyageBudgetGuard instance — receives token count after success.
                      Raises BudgetExceeded if hardcap crossed (propagated to caller).
        book:         metadata for D-G2 logging.
        total_chunks: metadata for D-G2 logging.

    Returns:
        list of 1024-dim embedding vectors, parallel to `texts`.

    Raises:
        VoyageEmbedError: on env-missing, oversized batch, or persistent API failure.
        BudgetExceeded:   from guard.add() — caller may catch to abort cleanly.
    """
    if len(texts) > BATCH_SIZE:
        raise VoyageEmbedError(f"batch size {len(texts)} exceeds D-E1 limit {BATCH_SIZE}")

    api_key = os.environ.get("VOYAGE_API_KEY")
    if not api_key:
        raise VoyageEmbedError("VOYAGE_API_KEY is not set")

    import voyageai  # lazy import (Pitfall 10 analog: not bundled into Modal image)
    vo = voyageai.Client(api_key=api_key)

    last_exc: Exception | None = None
    for delay in (0.0, *RETRY_DELAYS):
        if delay:
            time.sleep(delay)
        try:
            result = vo.embed(
                texts=list(texts),
                model=EMBEDDING_MODEL,
                input_type=input_type,
                truncation=True,
            )
            if guard is not None:
                guard.add(
                    tokens=result.total_tokens,
                    book=book,
                    total_chunks=total_chunks,
                )
            return result.embeddings
        except BudgetExceeded:
            raise  # never retry on budget hit
        except Exception as e:  # narrow if voyageai exposes typed exceptions
            last_exc = e
    raise VoyageEmbedError(
        f"voyage embed failed after {len(RETRY_DELAYS)} retries: {last_exc}"
    )
