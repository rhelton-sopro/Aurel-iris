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

from .budget import BudgetExceeded, ContextualBudgetGuard

PROMPT_TEMPLATE = (
    "<document>{document}</document>\n"
    "Here is the chunk we want to situate within the whole document\n"
    "<chunk>{chunk}</chunk>\n"
    "Please give a short succinct context to situate this chunk within the overall "
    "document for the purposes of improving search retrieval of the chunk. Answer "
    "only with the succinct context and nothing else."
)


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

    import anthropic  # lazy
    client = anthropic.Anthropic(api_key=api_key)
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
                "text": f"<document>{chapter_text}</document>",
                "cache_control": {"type": "ephemeral"},
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
    # Anthropic SDK returns usage with input_tokens, cache_read_input_tokens (when caching), output_tokens.
    # Defensive getattr — if SDK rev exposes a different attribute, guard charges 0 cached tokens
    # (overestimates cost as full price → triggers budget guards earlier, conservative behavior).
    usage = response.usage
    guard.add(
        input_tokens=getattr(usage, "input_tokens", 0),
        cached_tokens=getattr(usage, "cache_read_input_tokens", 0) or 0,
        output_tokens=getattr(usage, "output_tokens", 0),
    )
    # response.content is a list of content blocks; the first is text in canonical Anthropic responses.
    return response.content[0].text.strip()
