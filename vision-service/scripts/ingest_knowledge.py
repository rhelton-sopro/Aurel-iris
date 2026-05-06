#!/usr/bin/env python3
"""Ingest the founder's iridology library into knowledge_chunks (Phase 6 D-S1).

Pipeline: extract -> chunk -> contextualize (D-N1) -> embed -> persist.
Idempotent via content_hash (D-E2). Aborts on cost hardcap (D-G1, D-N1).

Usage:
    python -m scripts.ingest_knowledge                          # full run
    python -m scripts.ingest_knowledge --book "<source_book>"   # single book
    python -m scripts.ingest_knowledge --purge --book "X"       # D-I2 re-ingest
    python -m scripts.ingest_knowledge --dry-run                # no API calls, print stats
    python -m scripts.ingest_knowledge --no-contextual          # skip D-N1 (cheap mode)
    python -m scripts.ingest_knowledge --limit-chunks 50        # smoke (first 50 chunks total)

`--no-contextual` toggle changes content_hash because contextual prefix is part of
the hashed text (D-N1 + RESEARCH Pitfall 1) -- DO NOT mix runs of contextual vs
non-contextual on the same corpus or content_hash drifts and idempotency silently
re-embeds everything. Pre-flight gate in main() refuses --no-contextual on a
corpus that already has contextual chunks (use --purge first).

Phase: 06-rag-ingestao | Plan: 06-08 | Decisions: D-S1, D-E2, D-G1, D-N1, D-I2
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Iterable

from scripts.lib.budget import (
    BudgetExceeded,
    ContextualBudgetGuard,
    VoyageBudgetGuard,
)
from scripts.lib.chunker import Chunk, chunk_book, content_hash, count_tokens
from scripts.lib.contextualizer import MAX_CONTEXT_TOKENS_TIER1_TPM, situate_chunk
from scripts.lib.embedder import BATCH_SIZE, embed_batch
from scripts.lib.manifest import BookEntry, load_manifest
from scripts.lib.pdf_extractor import extract_docx, extract_pdf
from scripts.lib.persister import get_client, purge_book, upsert_chunks

DEFAULT_ACERVO = Path("D:/Projetos/Iridologista/livros")
DB_BATCH_SIZE = 200  # rows per upsert call (RESEARCH Pitfall 5)


def extract_book(entry: BookEntry, acervo: Path) -> list[dict]:
    """Dispatch to the appropriate extractor based on entry.extrator."""
    path = acervo / entry.filename
    if entry.extrator == "pymupdf":
        return extract_pdf(path, "pymupdf")
    if entry.extrator == "pdfplumber":
        return extract_pdf(path, "pdfplumber")
    if entry.extrator in ("python-docx", "docx2txt"):
        return extract_docx(path)
    raise ValueError(f"Unknown extrator: {entry.extrator}")


def process_chunks_into_rows(
    chunks: list[Chunk],
    *,
    book_key: str,
    entry: BookEntry,
    contextual_guard: ContextualBudgetGuard | None,
    chapter_text_map: dict[str | None, str],
) -> Iterable[dict]:
    """Yield row dicts ready for embedding. Applies D-N1 prefix when guard supplied.

    chapter_text_map provides {chapter_name: full_chapter_text} for prompt caching.
    content_hash is computed on the FINAL chunk text (with contextual prefix when
    present) so re-runs are idempotent at the exact wording that was embedded.
    """
    for chunk in chunks:
        chunk_text = chunk.text
        contextual_sentence: str | None = None
        if contextual_guard is not None:
            chapter_full = chapter_text_map.get(chunk.chapter, chunk_text)
            contextual_sentence = situate_chunk(
                chunk_text, chapter_full, guard=contextual_guard,
            )
            # Prepend contextual sentence -- content_hash uses the FINAL text
            chunk_text = f"[Contexto: {contextual_sentence}]\n\n{chunk.text}"

        row = {
            "content": chunk_text,
            "content_hash": content_hash(chunk_text),
            "source_book": book_key,
            "source_chapter": chunk.chapter,
            "source_page": chunk.page,
            "source_type": "biblioteca",
            "metadata": {
                "autor": entry.autor,
                "escola": entry.escola,
                "idioma": entry.idioma,
                "ano": entry.ano,
                # tagger fills these in a separate Claude Code session (D-T1)
                "constituicao_referenciada": [],
                "setores_referenciados": [],
                "sinais_referenciados": [],
                "dimensoes": [],
                "tags_livres": [],
                **(
                    {"contextual_sentence": contextual_sentence}
                    if contextual_sentence
                    else {}
                ),
            },
            # embedding filled in by embed_batch downstream
        }
        yield row


def filter_already_indexed(rows: list[dict], client) -> list[dict]:
    """Pre-insert dedup: query DB for existing content_hashes; return only new rows.

    Saves embedding cost on re-runs (D-E2 idempotency hardening before the
    Voyage round-trip, complementing the ON CONFLICT DO NOTHING server-side
    guarantee in upsert_chunks).
    """
    if not rows:
        return []
    hashes = [r["content_hash"] for r in rows]
    response = (
        client.table("knowledge_chunks")
        .select("content_hash")
        .in_("content_hash", hashes)
        .execute()
    )
    existing = {row["content_hash"] for row in (response.data or [])}
    return [r for r in rows if r["content_hash"] not in existing]


def ingest_book(
    book_key: str,
    entry: BookEntry,
    *,
    acervo: Path,
    voyage_guard: VoyageBudgetGuard,
    contextual_guard: ContextualBudgetGuard | None,
    dry_run: bool,
    limit_chunks_remaining: int | None,
) -> tuple[int, int]:
    """Process one book end-to-end. Returns (chunks_extracted, chunks_indexed)."""
    print(f'[ingest] book "{book_key}" -- extracting via {entry.extrator}...')
    pages = extract_book(entry, acervo)
    chunks = chunk_book(pages, book_meta={"source_book": book_key})
    if limit_chunks_remaining is not None:
        chunks = chunks[:limit_chunks_remaining]
    print(f'[ingest] book "{book_key}" -- {len(chunks)} chunks extracted')

    # Build chapter_text_map for prompt caching (D-N1). Keys are chunk.chapter
    # values; missing/None chapters fall back to the chunk text itself in
    # process_chunks_into_rows.
    chapter_text_map: dict[str | None, str] = {}
    for chunk in chunks:
        chapter_text_map.setdefault(chunk.chapter, "")
        chapter_text_map[chunk.chapter] += chunk.text + "\n\n"

    # Per-book D-N1 viability check: Anthropic Tier 1 caps input at 50K TPM and
    # cache_creation_input_tokens count toward that bucket. A first-call with a
    # 175K-token chapter would consume 175K TPM in one call → 429. When the
    # largest aggregated chapter exceeds the safe threshold, skip contextual
    # for this entire book (chunks still get embedded by Voyage; just without
    # the contextual prefix). Future improvement: per-chapter skip, or
    # configurable threshold via env var when account is upgraded to higher tier.
    effective_contextual_guard = contextual_guard
    if contextual_guard is not None:
        max_chapter_tokens = max(
            (count_tokens(t) for t in chapter_text_map.values()),
            default=0,
        )
        if max_chapter_tokens > MAX_CONTEXT_TOKENS_TIER1_TPM:
            print(
                f'[contextualizer] SKIP contextual for "{book_key}" -- '
                f'chapter too large for Tier 1 rate limit '
                f'({max_chapter_tokens:,} tokens > {MAX_CONTEXT_TOKENS_TIER1_TPM:,} cap)',
                file=sys.stderr,
            )
            effective_contextual_guard = None

    rows = list(
        process_chunks_into_rows(
            chunks,
            book_key=book_key,
            entry=entry,
            contextual_guard=effective_contextual_guard,
            chapter_text_map=chapter_text_map,
        )
    )

    if dry_run:
        # Heuristic word->token factor (real cost flows through VoyageBudgetGuard
        # using actual total_tokens from Voyage on live runs).
        avg_tokens = sum(len(r["content"].split()) for r in rows) / max(len(rows), 1)
        est_tokens = int(avg_tokens * 1.3 * len(rows))
        est_cost = est_tokens * 0.06 / 1_000_000
        print(
            f'[ingest] DRY-RUN book "{book_key}": '
            f'{len(rows)} rows, ~{est_tokens:,} tokens, est ~${est_cost:.4f}'
        )
        return len(chunks), 0

    # Pre-insert dedup
    client = get_client()
    new_rows = filter_already_indexed(rows, client)
    skipped = len(rows) - len(new_rows)
    if skipped:
        print(
            f'[ingest] book "{book_key}" -- {skipped} chunks already indexed '
            f'(idempotency skip)'
        )

    inserted_total = 0
    for batch_start in range(0, len(new_rows), BATCH_SIZE):
        batch = new_rows[batch_start:batch_start + BATCH_SIZE]
        embeddings = embed_batch(
            [r["content"] for r in batch],
            input_type="document",
            guard=voyage_guard,
            book=book_key,
            total_chunks=len(new_rows),
        )
        for row, vec in zip(batch, embeddings):
            row["embedding"] = vec
        # DB upsert in 200-row chunks (RESEARCH Pitfall 5)
        for db_start in range(0, len(batch), DB_BATCH_SIZE):
            db_chunk = batch[db_start:db_start + DB_BATCH_SIZE]
            inserted_total += upsert_chunks(db_chunk)

    return len(chunks), inserted_total


def _check_mode_mismatch() -> bool:
    """Return True when corpus already contains contextual chunks.

    Used by the pre-flight gate when --no-contextual is requested without
    --purge or --dry-run. Mixing modes mid-corpus drifts content_hash because
    the contextual prefix is part of the hashed text (D-N1 + RESEARCH Pitfall 1).

    Wrapped in a function so the test-suite can monkeypatch get_client cleanly.
    """
    client = get_client()
    existing = (
        client.table("knowledge_chunks")
        .select("id", count="exact")
        .not_.is_("metadata->>'contextual_sentence'", "null")
        .limit(1)
        .execute()
    )
    return bool(existing.count and existing.count > 0)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="ingest_knowledge",
        description=(
            "Ingest the iridology library into knowledge_chunks "
            "(extract -> chunk -> contextualize -> embed -> upsert)."
        ),
    )
    parser.add_argument("--book", help="Limit to one source_book entry")
    parser.add_argument(
        "--purge",
        action="store_true",
        help="Delete existing chunks for the target book(s) before re-ingesting (D-I2)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Extract + chunk only; print estimates, no API calls or DB writes",
    )
    parser.add_argument(
        "--no-contextual",
        action="store_true",
        help=(
            "Skip D-N1 Contextual Retrieval (cheap mode). "
            "WARNING: changes content_hash; do not mix with contextual runs."
        ),
    )
    parser.add_argument(
        "--limit-chunks",
        type=int,
        default=None,
        help="Cap total chunks across all books (smoke-test mode)",
    )
    parser.add_argument(
        "--acervo",
        type=Path,
        default=DEFAULT_ACERVO,
        help=f"Path to the PDF/DOCX acervo (default: {DEFAULT_ACERVO})",
    )
    args = parser.parse_args(argv)

    # Pre-flight mode check (W2): refuse mixing contextual vs non-contextual
    # mid-corpus. Mixing modes drifts content_hash because the contextual prefix
    # changes the hash. Skipped when --purge (founder explicitly recreating)
    # or --dry-run (no DB writes anyway).
    if args.no_contextual and not args.purge and not args.dry_run:
        if _check_mode_mismatch():
            print(
                "[ingest] MODE MISMATCH -- corpus has contextual chunks; "
                "either run with contextual mode or --purge first",
                file=sys.stderr,
            )
            return 2

    manifest = load_manifest()
    voyage_guard = VoyageBudgetGuard()
    contextual_guard = None if args.no_contextual else ContextualBudgetGuard()

    # Filter books
    books_to_run: list[tuple[str, BookEntry]] = []
    for key, entry in manifest.books.items():
        if entry.skip:
            print(f'[ingest] skip "{key}" (manifest skip:true)')
            continue
        if args.book and key != args.book:
            continue
        books_to_run.append((key, entry))
    if not books_to_run:
        print(
            f"[ingest] no books to run (filter: {args.book})",
            file=sys.stderr,
        )
        return 1

    # Purge first if requested (D-I2)
    if args.purge:
        for key, _ in books_to_run:
            n = purge_book(key)
            print(f'[ingest] purged {n} rows for "{key}"')

    total_extracted = 0
    total_indexed = 0
    limit_remaining = args.limit_chunks
    try:
        for key, entry in books_to_run:
            extracted, indexed = ingest_book(
                key,
                entry,
                acervo=args.acervo,
                voyage_guard=voyage_guard,
                contextual_guard=contextual_guard,
                dry_run=args.dry_run,
                limit_chunks_remaining=limit_remaining,
            )
            total_extracted += extracted
            total_indexed += indexed
            if limit_remaining is not None:
                limit_remaining = max(0, limit_remaining - extracted)
                if limit_remaining == 0:
                    print(f"[ingest] limit_chunks reached -- stopping after {key}")
                    break
    except BudgetExceeded as e:
        print(f"[ingest] BUDGET ABORT: {e}", file=sys.stderr)
        print(
            f"[ingest] partial state: {total_indexed} indexed across processed "
            f"books -- re-run is idempotent",
            file=sys.stderr,
        )
        return 2  # reserved exit code for budget abort
    except Exception as e:
        print(f"[ingest] FATAL: {e}", file=sys.stderr)
        return 1

    summary = (
        f'[ingest] DONE -- {total_extracted} extracted, {total_indexed} indexed '
        f'across {len(books_to_run)} books, ${voyage_guard.cost_usd:.4f} voyage cost'
    )
    if contextual_guard is not None:
        summary += f', ${contextual_guard.cost_usd:.4f} contextual cost'
    print(summary)
    return 0


if __name__ == "__main__":
    sys.exit(main())
