"""Persist chunks to knowledge_chunks (D-E2 idempotent + D-I2 purge).

Service-role bypasses RLS; never log the key (RESEARCH Pitfall 14).

Phase: 06-rag-ingestao | Plan: 06-07 | Decisions: D-E2, D-I2, D-P1
"""
from __future__ import annotations

import os
from typing import Any, Sequence


class PersisterError(Exception):
    """Raised on env-missing, malformed key, or supabase response errors."""


def get_client():
    """Service-role Supabase client. RLS bypass for INSERT/DELETE.

    Reads SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL fallback) +
    SUPABASE_SERVICE_ROLE_KEY from environment. Defensive shape check on the
    JWT prefix per RESEARCH Pitfall 14 — service-role JWTs start with "eyJ".

    Raises:
        PersisterError: env vars missing or service-role key malformed.

    Returns:
        supabase.Client instance authenticated with the service role.
    """
    from supabase import create_client  # lazy

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url:
        raise PersisterError("SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL is not set")
    if not key:
        raise PersisterError("SUPABASE_SERVICE_ROLE_KEY is not set")
    if not key.startswith("eyJ"):
        # RESEARCH Pitfall 14 defensive shape check — service-role JWTs start with "eyJ"
        raise PersisterError("SUPABASE_SERVICE_ROLE_KEY appears malformed (no eyJ prefix)")
    return create_client(url, key)


def upsert_chunks(rows: Sequence[dict[str, Any]]) -> int:
    """Idempotent upsert via ON CONFLICT (content_hash) DO NOTHING — D-E2.

    Targets the UNIQUE constraint knowledge_chunks_content_hash_key from
    migration 0005. Re-running ingestion never duplicates chunks nor burns
    Voyage budget on already-embedded text.

    Args:
        rows: each dict has keys
              {content, content_hash, embedding, source_book, source_chapter,
               source_page, source_type, metadata}.

    Returns:
        Number of rows actually inserted (response.data length).
    """
    if not rows:
        return 0
    client = get_client()
    response = (
        client.table("knowledge_chunks")
        .upsert(
            list(rows),
            on_conflict="content_hash",
            ignore_duplicates=True,
        )
        .execute()
    )
    return len(response.data or [])


def purge_book(source_book: str) -> int:
    """Drop & recreate by source_book — D-I2.

    Used when a book is re-chunked under a new criterion. Caller is expected
    to follow this with a fresh upsert_chunks() pass.

    Args:
        source_book: exact value of knowledge_chunks.source_book to purge.

    Returns:
        Number of rows deleted (response.data length).
    """
    client = get_client()
    response = (
        client.table("knowledge_chunks")
        .delete()
        .eq("source_book", source_book)
        .execute()
    )
    return len(response.data or [])
