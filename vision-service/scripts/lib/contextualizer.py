"""D-N1 Contextual Retrieval — generates situating sentences via Claude Haiku 4.5.

Pattern: lazy-import `anthropic`; cache the chapter document via the SDK's
`cache_control={"type": "ephemeral"}` block (5min cache, ~90% off after first hit).
Anthropic's exact prompt template per RESEARCH lines 723-730.

D-T1 RELAXED here only — vocabulary tagging stays in Claude Code session;
Contextual Retrieval is the explicit exception requiring programmatic API calls.

Phase: 06-rag-ingestao | Plan: 06-06 | Decisions: D-N1
"""
from __future__ import annotations

import os
import sys

from .budget import BudgetExceeded, ContextualBudgetGuard

PROMPT_TEMPLATE = (
    "<document>{document}</document>\n"
    "Here is the chunk we want to situate within the whole document\n"
    "<chunk>{chunk}</chunk>\n"
    "Please give a short succinct context to situate this chunk within the overall "
    "document for the purposes of improving search retrieval of the chunk. Answer "
    "only with the succinct context and nothing else."
)

# Anthropic Haiku 4.5 has a 200K-token total prompt window. The chapter context
# is the bulk of the prompt; leave ~25K headroom for the chunk being situated,
# the instruction template, output budget, and tokenizer drift between
# tiktoken cl100k_base (used here) and Anthropic's tokenizer.
MAX_CONTEXT_TOKENS = 175_000

# Anthropic Tier 1 rate limit: 50K input tokens per minute, and
# cache_creation_input_tokens DO count against that bucket. A first-call
# sending a 50K-token chapter would consume the entire per-minute window in
# one shot → 429. The orchestrator (ingest_knowledge.py) checks per-book and
# skips contextual when max chapter context exceeds this threshold; chunks
# still embed via Voyage but without the D-N1 prefix. Lift this threshold
# (or remove the check) once the account moves to a higher tier.
MAX_CONTEXT_TOKENS_TIER1_TPM = 40_000

# Cache the truncation-warning per book_id (or per book filename) so the log
# shows the warning once per book instead of once per chunk (407× spam).
_TRUNCATION_WARNED_KEYS: set[int] = set()


def _truncate_to_tokens(text: str, max_tokens: int) -> tuple[str, int]:
    """Truncate `text` to at most `max_tokens` (cl100k_base). Returns (text, original_token_count).
    If text is within budget, returns it unchanged."""
    import tiktoken  # lazy
    enc = tiktoken.get_encoding("cl100k_base")
    tokens = enc.encode(text)
    if len(tokens) <= max_tokens:
        return text, len(tokens)
    return enc.decode(tokens[:max_tokens]), len(tokens)


def situate_chunk(
    chunk_text: str,
    chapter_text: str,
    *,
    guard: ContextualBudgetGuard,
    model: str = "claude-haiku-4-5",
) -> str:
    """Generate a 1-2-sentence situating context. Caches the chapter (prompt cache).

    Args:
        chunk_text:    the chunk being situated
        chapter_text:  the surrounding chapter (becomes the cached system block)
        guard:         ContextualBudgetGuard receiving token counts (raises BudgetExceeded if hardcap crossed)
        model:         default 'claude-haiku-4-5' (D-N1)

    Returns:
        1-2-sentence string to be prepended to chunk_text before embedding.

    Raises:
        BudgetExceeded:        from guard.add() when hardcap crossed (propagated, not caught)
        RuntimeError:          when ANTHROPIC_API_KEY is not set
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")

    # Safety cap: Anthropic 200K total-prompt limit. When chapter detection
    # fails (e.g. non-pt regex on a Spanish/Italian book), the entire book
    # text gets aggregated under chapter=None and overflows the window.
    # Truncate to first MAX_CONTEXT_TOKENS — preserves intro + early chapters
    # which carry the highest density of foundational concepts.
    truncated_text, original_tokens = _truncate_to_tokens(chapter_text, MAX_CONTEXT_TOKENS)
    if original_tokens > MAX_CONTEXT_TOKENS:
        key = id(chapter_text)
        if key not in _TRUNCATION_WARNED_KEYS:
            _TRUNCATION_WARNED_KEYS.add(key)
            print(
                f"[contextualizer] WARNING: chapter context {original_tokens} tokens "
                f"exceeds {MAX_CONTEXT_TOKENS} cap — truncated to first {MAX_CONTEXT_TOKENS} "
                f"tokens (likely missed chapter detection in non-pt source)",
                file=sys.stderr,
            )

    import anthropic  # lazy
    client = anthropic.Anthropic(api_key=api_key)
    # 1-hour TTL cache (vs default 5-min ephemeral). Under Tier 1 50K TPM
    # throttling, processing all chunks in a 30K-token chapter can exceed 5 min,
    # causing mid-chapter cache expiry and forced re-creation. 1h TTL pays
    # 2× cache-write price ONCE per chapter and survives the throttle window.
    # Net cost is dramatically lower than repeated 5-min cache_creation calls.
    response = client.messages.create(
        model=model,
        max_tokens=200,
        system=[
            {
                "type": "text",
                "text": "You are a helpful assistant that contextualizes document chunks for retrieval.",
            },
            {
                "type": "text",
                "text": f"<document>{truncated_text}</document>",
                "cache_control": {"type": "ephemeral", "ttl": "1h"},
            },
        ],
        messages=[
            {
                "role": "user",
                "content": PROMPT_TEMPLATE.format(
                    document="(see system)",
                    chunk=chunk_text,
                ),
            }
        ],
    )
    # Extract usage breakdown. Anthropic 2025-26 SDK exposes 4 token buckets:
    #   - input_tokens:                regular non-cached input (chunk + instruction in user msg)
    #   - cache_creation_input_tokens: tokens written to cache this call (paid 1.25× or 2.5×)
    #   - cache_read_input_tokens:     tokens read from cache (paid 0.1×)
    #   - output_tokens:               generated response
    # Prior to this fix, cache_creation_input_tokens was untracked → guard
    # hardcap watched the wrong number while real cost ran 10× higher.
    usage = response.usage
    input_tokens = getattr(usage, "input_tokens", 0)
    output_tokens = getattr(usage, "output_tokens", 0)
    cache_read_tokens = getattr(usage, "cache_read_input_tokens", 0) or 0
    cache_creation_total = getattr(usage, "cache_creation_input_tokens", 0) or 0
    # The SDK also exposes a structured usage.cache_creation with .ephemeral_5m_input_tokens
    # and .ephemeral_1h_input_tokens (when present). When unavailable, default the
    # whole creation to the active TTL (this call always uses 1h cache_control).
    cc_struct = getattr(usage, "cache_creation", None)
    if cc_struct is not None:
        cache_creation_5min = getattr(cc_struct, "ephemeral_5m_input_tokens", 0) or 0
        cache_creation_1h = getattr(cc_struct, "ephemeral_1h_input_tokens", 0) or 0
    else:
        # Older SDK: lump under 1h since that's what we set
        cache_creation_5min = 0
        cache_creation_1h = cache_creation_total

    guard.add(
        input_tokens=input_tokens,
        cached_tokens=cache_read_tokens,
        output_tokens=output_tokens,
        cache_creation_5min_tokens=cache_creation_5min,
        cache_creation_1h_tokens=cache_creation_1h,
    )

    # Per-call diagnostic logging (env-gated to avoid log spam in production runs).
    # Set RAG_INGEST_DEBUG_CACHE=1 to verify cache hit/miss pattern during smoke tests.
    if os.environ.get("RAG_INGEST_DEBUG_CACHE") == "1":
        verdict = "HIT" if cache_read_tokens > 0 else ("CREATE" if cache_creation_total > 0 else "MISS")
        print(
            f"[contextualizer] {verdict} | input={input_tokens} "
            f"cache_creation={cache_creation_total} (5m={cache_creation_5min}/1h={cache_creation_1h}) "
            f"cache_read={cache_read_tokens} output={output_tokens}",
            file=sys.stderr,
        )

    # response.content is a list of content blocks; the first is text in canonical Anthropic responses.
    return response.content[0].text.strip()
