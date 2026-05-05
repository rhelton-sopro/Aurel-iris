---
phase: 06-rag-ingestao
plan: "07"
subsystem: rag-migration-and-persister
status: complete
completed_date: "2026-05-05"
duration_minutes: 35
tasks_completed: 3
tasks_total: 3
files_created: 2
files_modified: 2
tags: [rag, sql, migration, persister, supabase, blocking, wave-2, founder-gate]
requirements_completed: [RAG-02]

dependency_graph:
  requires:
    - phase: 06-rag-ingestao/06-01
      provides: "test_persist.py scaffolding (4 stubs flipped GREEN by this plan + 4 new tests beyond Wave-0)"
    - phase: 06-rag-ingestao/06-04
      provides: "content_hash canonicalization (sha256(text.strip().encode('utf-8'))) consumed by persister.upsert_chunks via on_conflict='content_hash'"
    - phase: 06-rag-ingestao/06-05
      provides: "VoyageBudgetGuard pattern (env-guarded helper) — same `eyJ` JWT prefix shape check pattern emerges in get_client()"
    - phase: 06-rag-ingestao/06-06
      provides: "lazy-import-inside-function pattern continued — `from supabase import create_client` happens inside get_client() so test collection succeeds without supabase-py installed"
    - phase: "Fase 1 — supabase/migrations/0001_initial_schema.sql"
      provides: "knowledge_chunks table + pgvector extension + HNSW index that match_knowledge_chunks RPC traverses"
  provides:
    - supabase/migrations/0005_knowledge_chunks_content_hash_and_source_type.sql (D-E2 idempotência + D-F1 forward-compat + D-P1 RPC)
    - vision-service/scripts/lib/persister.py (get_client + upsert_chunks + purge_book + PersisterError)
    - apps/web/types/database.ts (regenerated post-migration — match_knowledge_chunks Args/Returns + content_hash + source_type)
  affects:
    - 06-08-PLAN (ingest_knowledge.py CLI: chains chunker → contextualizer → embedder → persister.upsert_chunks; persister.purge_book is the re-ingest entry point for a single book)
    - 06-09-PLAN (apps/web/lib/rag/embed.ts: voyage-3 pinned counterpart — types.ts now exposes match_knowledge_chunks Args.query_embedding: string for end-to-end type safety)
    - 06-11-PLAN (apps/web/lib/rag/search.ts: supabase.rpc('match_knowledge_chunks', ...) call site — Args/Returns shapes locked in types.ts)

tech_stack:
  added: []  # supabase-py already pinned in 06-03 (requirements.txt)
  patterns:
    - "idempotent-DDL-with-DO-blocks: ADD CONSTRAINT IF NOT EXISTS is not supported in all Postgres versions, so the migration uses `do $$ begin if not exists (...) then alter table ... add constraint ...; end if; end $$;` blocks for both UNIQUE on content_hash and CHECK on source_type. Pattern mirrored from 0004_storage_bucket_iris_captures.sql. Re-running the migration is safe (no errors)."
    - "create-or-replace-for-RPC: match_knowledge_chunks is created via `create or replace function` so re-applying the migration cleanly replaces the function body (e.g. if a future tweak changes hnsw.ef_search or the score formula). `language sql stable` (not `volatile`) preserves pgvector index usage — `volatile` would force a sequential scan."
    - "set-local-hnsw.ef_search-inside-RPC: SET LOCAL is scoped to the current transaction, so 100 (vs. default 40) only applies during the RPC call — no global config drift, no impact on other queries. Boost recall on small corpus (~5k chunks) per RESEARCH lines 416–428. After 50k+ chunks accumulate (Fase 10), reduce back to 40 in a future migration."
    - "lazy-import-inside-function (continued from 06-04, 06-05, 06-06): `from supabase import create_client` happens inside get_client() body, NOT at module top — test collection in test_persist.py succeeds via `from scripts.lib.persister import ...` without supabase-py side-effects. Mocks at `patch('supabase.create_client', ...)` work because the import resolves at call time."
    - "eyJ-prefix-shape-check: service-role JWTs always start with `eyJ` (base64-encoded `{\"`). The defensive check `if not key.startswith(\"eyJ\")` catches obvious env misconfiguration (anon key pasted instead, env var truncated, placeholder string) BEFORE the supabase client tries to auth and emits a confusing 401. RESEARCH Pitfall 14 — never log the key, but its prefix is safe to validate."
    - "ignore_duplicates=True-with-on_conflict: supabase-py's upsert with `on_conflict='content_hash', ignore_duplicates=True` translates to `INSERT ... ON CONFLICT (content_hash) DO NOTHING` server-side. Re-ingestion never burns Voyage budget on already-embedded text — D-E2 idempotency. The UNIQUE constraint added in 0005 is what enables this; without it, on_conflict would fail server-side."
    - "stub-API-superseded-by-spec (third occurrence): Wave 0 (06-01) test_persist.py used `from scripts.lib.persist import ...` (singular module name `persist`) and threaded a `client=` parameter into upsert_chunks/purge_book. PLAN 06-07 establishes the authoritative module name `persister` and constructs the client internally from env vars. Tests rewritten via `patch('supabase.create_client', return_value=fake_client)`. Pattern emerges as GENERAL across Wave 1/Wave 2 plans (06-05, 06-06, 06-07)."
    - "founder-gate-for-destructive-DDL: `supabase db push --linked` is a checkpoint:human-action because (a) supabase CLI auth lives in founder's local credentials, (b) DDL against the linked production-grade DB is destructive and needs human eyes. Idempotent design (`if not exists` + `do $$`) makes re-runs safe in case partial application happens, but the gate is non-negotiable. Pattern reused from Fase 1 plan 01-04 and Fase 2 plan 02-01."

key_files:
  created:
    - supabase/migrations/0005_knowledge_chunks_content_hash_and_source_type.sql
    - vision-service/scripts/lib/persister.py
  modified:
    - apps/web/types/database.ts                (regenerated post-push: +content_hash + source_type + match_knowledge_chunks RPC)
    - vision-service/tests/test_persist.py      (4 skips → 8 passes; +4 net new tests beyond Wave-0)

key_decisions:
  - "match_knowledge_chunks RPC bundled into migration 0005 (not deferred to a later migration). Open Question 7 in 06-RESEARCH defaulted to merging the RPC with the schema change because (a) Wave 3 retrieval modules (06-09 embed.ts, 06-11 search.ts) need types.ts to expose the RPC signature for type safety, (b) splitting into two migrations would force two rounds of `supabase db push --linked` (two founder gates) and two rounds of `pnpm gen:types`. Single-migration approach minimizes founder friction."
  - "source_type CHECK constraint accepts only ('biblioteca', 'clinical_data') — Fase 10 forward-compat. The Sistema de Aprendizagem Clínica (Fase 10) will write rows with source_type='clinical_data' representing learned heuristics from therapist edits. Including the second value in the CHECK now (vs. relaxing later) means Fase 10 doesn't need its own migration to widen the constraint. D-F1 verbatim."
  - "service-role JWT shape check (`startswith('eyJ')`) is defensive over typed exceptions. The supabase-py client emits a generic `AuthApiError` if the key is wrong, but only AFTER the first request — that's a confusing 401 trace. Pre-flight prefix check fails loud during get_client() with a clear PersisterError message. Anon keys ALSO start with eyJ, so this doesn't distinguish role — it only catches obvious env misconfiguration (placeholder string, truncated env var, wrong format paste). RESEARCH Pitfall 14 explicitly recommends prefix validation."
  - "ignore_duplicates=True chosen over response.data length deduplication. supabase-py provides two equivalent ways to express ON CONFLICT DO NOTHING: (a) `ignore_duplicates=True` kwarg on .upsert(), (b) post-process response.data to count only newly-inserted rows. Option (a) translates directly to PostgREST's `Prefer: resolution=ignore-duplicates` header which generates the canonical `ON CONFLICT (content_hash) DO NOTHING` server-side. Option (b) would require a more complex round-trip. Option (a) wins on simplicity and round-trip count."
  - "purge_book uses delete().eq() not raw SQL. supabase-py's chained query builder (.delete().eq('source_book', X).execute()) generates the same SQL as `DELETE FROM knowledge_chunks WHERE source_book = $1` but inherits RLS bypass from the service-role client (no need for a separate RPC). D-I2 — re-ingestion of a single book is `purge_book('X') → upsert_chunks(rows_for_X)` rather than a destructive truncate-and-reload."
  - "stub-API-superseded-by-spec applied a third time (06-05, 06-06, 06-07). Wave 0 test_persist.py (06-01) anticipated module name `persist` (singular) and a `client=` parameter. PLAN 06-07 spec wins: module is `persister`, client is constructed internally from env vars. The pattern is now GENERAL — Wave 0 stubs are placeholder contracts subordinate to PLAN authoritative interfaces when the PLAN specifies rewrite directives. No downstream consumer exists for the old API (06-08 ingest CLI is the first consumer; it will use the new API)."

metrics:
  duration_minutes: 35
  commits: 4  # 1e5a52d migration + 8f5b15a persister + f147cee test flip + 1a19cab types regen
  pytest_passes_added: 8  # was 213, now 221
  pytest_skips_removed: 0  # 8 → 4 because Wave-0 had 4 test_persist stubs (others stayed skipped — 06-08+ owes flips)
  test_persist_passes: 8  # 3 TestGetClient + 3 TestUpsertChunks (returns_zero+on_conflict+returns_count) + 1 TestPurgeBook + 1 succeeds_with_valid_env

threat_register_status:
  - "T-RAG-02 (D-E2 dedup bypass via canonicalization drift): MITIGATED — content_hash UNIQUE constraint added in migration; persister.upsert_chunks uses on_conflict='content_hash' targeting the constraint. Drift detection lives in 06-04's test_idempotency.py (sha256('hello') hex digest hardcoded)."
  - "T-RAG-03 (service-role key leakage): MITIGATED — get_client() reads SUPABASE_SERVICE_ROLE_KEY but never logs it; PersisterError messages reference the env var NAME only. Defensive shape check uses startswith() (no key content in exception)."
  - "T-RAG-05 (RPC abuse via unbounded match_count): NOT MITIGATED HERE — match_knowledge_chunks accepts unbounded match_count int. Abuse vector is server-side resource exhaustion (LIMIT N where N is huge). Mitigation owed to 06-11 (apps/web/lib/rag/search.ts): clamp match_count to a hardcoded ceiling (e.g. 50) before calling supabase.rpc. Documented as a Wave 3 prerequisite in 06-11-PLAN."
---

# Phase 6 Plan 07: Wave 2 — Migration 0005 + Persister Summary

**One-liner:** Migration 0005 (idempotent DDL adding `content_hash` UNIQUE + `source_type` CHECK + 2 btree indexes + `match_knowledge_chunks` RPC with `SET LOCAL hnsw.ef_search = 100`) applied to linked Supabase via founder gate; `apps/web/types/database.ts` regenerated and now exposes the RPC Args/Returns shape; `persister.py` wires `upsert_chunks(rows, on_conflict='content_hash', ignore_duplicates=True)` + `purge_book(source_book)` with service-role client guarded by env presence + `eyJ` prefix shape check; 4 Wave-0 stubs flipped GREEN, 4 new tests beyond Wave-0 added → 8 total tests in test_persist.py. **Wave 2 ✅ CLOSED.**

## Performance

- **Duration:** ~35 min (across 4 atomic commits + 1 founder gate)
- **Started:** 2026-05-05 (after 06-06 Wave 1 closure at 3e620e6)
- **Completed:** 2026-05-05
- **Tasks:** 3 (Task 1 migration SQL + Task 2 founder-gate `supabase db push --linked` + Task 3 persister.py + test_persist.py flip)
- **Files created:** 2 (migration 0005 + persister.py)
- **Files modified:** 2 (types/database.ts regenerated + test_persist.py rewrite)
- **Commits:** 4 atomic
  - `1e5a52d feat(06-07): add migration 0005 — content_hash UNIQUE + source_type CHECK + match_knowledge_chunks RPC`
  - `8f5b15a feat(06-07): add persister.py — supabase upsert_chunks + purge_book (D-E2 ON CONFLICT)`
  - `f147cee test(06-07): flip Wave 0 stubs GREEN — test_persist (env-guard + upsert/purge chain semantics)`
  - `1a19cab feat(06-07): regenerate database types post-migration 0005`
- **pytest delta:** 213 passed / 8 skipped → 221 passed / 4 skipped (+8 passes / -4 skips)

## Tasks Executed

### Task 1: Author migration 0005 SQL file

**Files:**
- `supabase/migrations/0005_knowledge_chunks_content_hash_and_source_type.sql` (NEW, 95 lines)

**Behavior locked:**
- `alter table knowledge_chunks add column if not exists content_hash text` (nullable — backfill is N/A, this is a fresh column for forward inserts)
- `alter table knowledge_chunks add column if not exists source_type text not null default 'biblioteca'` (existing rows backfill to 'biblioteca' automatically via DEFAULT)
- `do $$ begin if not exists (select 1 from pg_constraint where conname = 'knowledge_chunks_content_hash_key') then alter table knowledge_chunks add constraint knowledge_chunks_content_hash_key unique (content_hash); end if; end $$;` (idempotent)
- `do $$ begin if not exists (...) then alter table knowledge_chunks add constraint knowledge_chunks_source_type_check check (source_type in ('biblioteca', 'clinical_data')); end if; end $$;` (idempotent + Fase 10 forward-compat)
- `create index if not exists knowledge_chunks_source_type_idx on knowledge_chunks (source_type);` + `create index if not exists knowledge_chunks_source_book_idx on knowledge_chunks (source_book);`
- `create or replace function match_knowledge_chunks(query_embedding vector(1024), match_count int default 5, match_threshold float default 0.0) returns table (id, content, source_book, source_chapter, source_page, metadata, source_type, score) language sql stable` with `set local hnsw.ef_search = 100;` and `1 - (embedding <=> query_embedding) as score` (cosine similarity)
- `grant execute on function match_knowledge_chunks(vector(1024), int, float) to authenticated;`

**Commit:** `1e5a52d feat(06-07): add migration 0005 — content_hash UNIQUE + source_type CHECK + match_knowledge_chunks RPC`

### Task 2: Founder applies migration 0005 to linked Supabase

**Founder action:**
- Ran `supabase db push --linked` against the linked Supabase project (sa-east-1).
- Migration applied cleanly (idempotent design: re-runs safe).
- Ran `pnpm --filter web gen:types` (regenerated `apps/web/types/database.ts`).
- Confirmed verbatim: "applied — types regenerated. Diff confirms `+ content_hash: string | null` and `+ source_type: string`. Both fields present in knowledge_chunks Row, Insert, and Update types."

**Verification (orchestrator-side, before Commit 4):**
- `git status` showed ONLY `apps/web/types/database.ts` modified (uncommitted) — no other side-effects from `pnpm gen:types`.
- `git diff apps/web/types/database.ts | grep -c "content_hash"` → 3 (Row + Insert + Update — exactly as expected for column-level addition).
- `git diff apps/web/types/database.ts | grep -c "source_type"` → 4 (Row + Insert + Update + match_knowledge_chunks Functions Returns shape).
- New `Functions.match_knowledge_chunks` block exposes `Args: { query_embedding: string; match_count?: number; match_threshold?: number }` and `Returns: { id, content, source_book, source_chapter, source_page, metadata, source_type, score }[]` — Wave 3 retrieval (06-09 embed.ts, 06-11 search.ts) now type-checks against the canonical RPC signature.

**Commit:** `1a19cab feat(06-07): regenerate database types post-migration 0005`

### Task 3: persister.py + flip test_persist.py to GREEN

**Files:**
- `vision-service/scripts/lib/persister.py` (NEW, 94 lines)
- `vision-service/tests/test_persist.py` (full rewrite, 8 tests GREEN — Wave 0 stubs were 4 + 4 new beyond)

**Behavior verified:**
- `PersisterError` exception class exported
- `get_client()` reads `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL` fallback) + `SUPABASE_SERVICE_ROLE_KEY` from env; raises `PersisterError("SUPABASE_URL ...")` if URL missing; raises `PersisterError("SUPABASE_SERVICE_ROLE_KEY ...")` if key missing; raises `PersisterError("...malformed (no eyJ prefix)")` if key doesn't start with `eyJ`; returns the supabase client constructed via `create_client(url, key)` if all env present and well-shaped
- `upsert_chunks([])` returns 0 without calling supabase (early exit)
- `upsert_chunks(rows)` calls `client.table('knowledge_chunks').upsert(rows, on_conflict='content_hash', ignore_duplicates=True).execute()` and returns `len(response.data or [])`
- `upsert_chunks` correctly returns the count of rows actually inserted (test_returns_count_of_inserted: 7 rows submitted, 5 returned by mock — verifies "only newly-inserted rows are counted, duplicates skipped via ON CONFLICT DO NOTHING are excluded")
- `purge_book('Test Book Name')` calls `client.table('knowledge_chunks').delete().eq('source_book', 'Test Book Name').execute()` and returns `len(response.data or [])`
- supabase-py is `lazy-import`ed inside `get_client()` (not at module top) — `from scripts.lib.persister import ...` succeeds without supabase-py installed (mocks at `patch('supabase.create_client', ...)` work)

**Commits:**
- `8f5b15a feat(06-07): add persister.py — supabase upsert_chunks + purge_book (D-E2 ON CONFLICT)`
- `f147cee test(06-07): flip Wave 0 stubs GREEN — test_persist (env-guard + upsert/purge chain semantics)`

## Verification Gates

| Gate                                                     | Command                                                                            | Result               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------- |
| Migration SQL invariants (literal substring presence)    | `python -c "...assert all literals..."`                                            | OK                   |
| `vector(1024)` count in migration                        | `grep -c "vector(1024)" 0005_*.sql`                                                | 2 (function arg + grant signature) |
| `set local hnsw.ef_search = 100` in migration            | `grep "set local hnsw.ef_search = 100" 0005_*.sql`                                 | 1 occurrence in RPC body |
| Migration applied to linked Supabase                     | founder ran `supabase db push --linked`                                            | applied — types regenerated |
| `content_hash` count in regenerated types diff           | `git diff apps/web/types/database.ts \| grep -c "content_hash"`                    | 3 (Row + Insert + Update) |
| `source_type` count in regenerated types diff            | `git diff apps/web/types/database.ts \| grep -c "source_type"`                     | 4 (Row + Insert + Update + Functions Returns) |
| `match_knowledge_chunks` RPC exposed in types            | `grep "match_knowledge_chunks" apps/web/types/database.ts`                         | 1 Functions block (Args + Returns) |
| `tsc --noEmit` clean for `lib/rag/`                      | `pnpm exec tsc --noEmit 2>&1 \| grep "lib/rag\|types/database"`                    | empty (no errors)    |
| `tsc --noEmit` for `lib/vision/modal-client.test.ts`     | `pnpm exec tsc --noEmit 2>&1 \| tail -3`                                           | 3 pre-existing Phase 5 errors (out of scope per PLAN gate 4) |
| `Pitfall 14` cross-ref count in persister.py             | `grep -c "Pitfall 14" persister.py`                                                | 1 (defensive shape check comment) |
| `on_conflict` count in persister.py                      | `grep -c "on_conflict" persister.py`                                               | 1 (kwarg in upsert call) |
| `ignore_duplicates` count in persister.py                | `grep -c "ignore_duplicates" persister.py`                                         | 1 (kwarg in upsert call) |
| No Wave-0 skips remain in test_persist.py                | `grep -c "pytest.mark.skip" test_persist.py`                                       | 0                    |
| Task 3 tests                                             | `pytest tests/test_persist.py -v`                                                  | 8 passed             |
| Full pytest baseline (regression check)                  | `pytest -q`                                                                        | 221 passed / 4 skipped (was 213 / 8) |
| LGPD audit                                               | `python -m scripts.audit_vocabulary`                                               | exit 0               |

## Wave 2 Module Checklist (per PLAN output requirement)

| Module                                                       | Path                                                                         | Status     | Plan      |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- | ---------- | --------- |
| Migration 0005 (content_hash + source_type + RPC)            | supabase/migrations/0005_knowledge_chunks_content_hash_and_source_type.sql   | ✅ Applied  | **06-07** |
| Regenerated TypeScript types                                 | apps/web/types/database.ts                                                   | ✅ Committed| **06-07** |
| persister.py (get_client + upsert_chunks + purge_book)       | vision-service/scripts/lib/persister.py                                      | ✅ Complete | **06-07** |

**Wave 2 ✅ COMPLETE — 3/3 deliverables.** Wave 3 (06-08 founder-gate ingestion run + 06-09/10/11 autonomous TS retrieval) unblocked.

## Decisions Made

1. **Migration 0005 bundles the RPC with the schema change.** Open Question 7 in 06-RESEARCH defaulted to merging `match_knowledge_chunks` into the same migration as `content_hash` + `source_type` because Wave 3 retrieval modules need both schema additions AND the RPC signature exposed in types.ts in a single `supabase db push` round. Splitting into two migrations would force two founder gates and two `pnpm gen:types` rounds. Single-migration approach minimizes founder friction without losing rollback granularity (the migration is idempotent + every step is independently re-runnable).

2. **`source_type` CHECK constraint accepts only `('biblioteca', 'clinical_data')` — Fase 10 forward-compat.** D-F1 verbatim from 06-CONTEXT. The Sistema de Aprendizagem Clínica (Fase 10) will write rows with `source_type='clinical_data'` representing learned heuristics from therapist edits. Including the second value in the CHECK now (vs. relaxing later via another migration) means Fase 10 doesn't need its own DDL migration to widen the constraint. Default `'biblioteca'` keeps Fase 6/7 inserts unchanged.

3. **Service-role JWT shape check (`startswith('eyJ')`) over typed exceptions.** RESEARCH Pitfall 14 explicitly recommends prefix validation. The supabase-py client emits a generic `AuthApiError` if the key is wrong, but only AFTER the first request — that's a confusing 401 trace. Pre-flight prefix check fails loud during `get_client()` with a clear PersisterError message naming the env var. Anon keys also start with `eyJ`, so this doesn't distinguish role — it only catches obvious env misconfiguration (placeholder string, truncated env var, wrong format paste). Pattern reusable for any service-role-guarded helper.

4. **`ignore_duplicates=True` chosen over response.data length deduplication.** supabase-py provides two equivalent ways to express ON CONFLICT DO NOTHING: (a) `ignore_duplicates=True` kwarg on .upsert(), (b) post-process response.data to count only newly-inserted rows. Option (a) translates directly to PostgREST's `Prefer: resolution=ignore-duplicates` header → server-side `ON CONFLICT (content_hash) DO NOTHING`. Option (a) wins on simplicity, type clarity, and round-trip count (one query vs. one query + post-process).

5. **`purge_book` uses `delete().eq()` not raw SQL or RPC.** supabase-py's chained query builder generates the same SQL as `DELETE FROM knowledge_chunks WHERE source_book = $1` but inherits RLS bypass from the service-role client (no need for a separate purge RPC). D-I2 — re-ingestion of a single book is `purge_book('X') → upsert_chunks(rows_for_X)` rather than a destructive `truncate-and-reload-everything`.

6. **`match_knowledge_chunks` returns `score float` (cosine similarity 0-1), not `distance`.** RESEARCH lines 432–469 verbatim: `1 - (embedding <=> query_embedding) as score` where `<=>` is pgvector's cosine DISTANCE operator (0 = identical, 2 = opposite). Subtracting from 1 yields cosine SIMILARITY (1 = identical, -1 = opposite). Rationale: 06-11 search.ts ranks results by `score DESC` — having score directly in the return saves a column transform on the TS side. The `where 1 - (...) >= match_threshold` filter uses the same formula consistently.

7. **`set local hnsw.ef_search = 100` inside the RPC body, not via session-level config.** SET LOCAL is scoped to the current transaction, so 100 (vs. default 40) only applies during the RPC call — no global config drift, no impact on other queries. Boost recall on small corpus (~5k chunks; current acervo D-S1 estimates ~3k chunks). After 50k+ chunks accumulate (Fase 10 + multi-year ingestion), reduce back to 40 in a future migration as latency starts to dominate.

8. **Stub-API-superseded-by-spec applied a third time.** Wave 0 (06-01) test_persist.py anticipated module name `persist` (singular) and a `client=` parameter threaded through. PLAN 06-07 spec wins: module is `persister`, client is constructed internally from env vars. Pattern is now GENERAL across Wave 1/Wave 2 plans (06-05 budget+embedder, 06-06 contextualizer+manifest, 06-07 persister). Wave 0 stubs are placeholder contracts subordinate to PLAN authoritative interfaces when the PLAN specifies rewrite directives.

## Cross-tree Pinning — IMPORTANT for downstream plans

**Pin 1: `match_knowledge_chunks` RPC signature is now the source of truth.** `apps/web/types/database.ts` exposes `Database['public']['Functions']['match_knowledge_chunks']` with `Args: { query_embedding: string; match_count?: number; match_threshold?: number }` and `Returns: { id: string; content: string; source_book: string; source_chapter: string; source_page: number; metadata: Json; source_type: string; score: number }[]`. 06-11 search.ts MUST call `supabase.rpc('match_knowledge_chunks', ...)` with these exact arg names — TypeScript will fail-loud on drift.

**Pin 2: `content_hash` is the dedup key on both sides.** Python ingestion (06-04 chunker.py + 06-07 persister.py) computes `sha256(text.strip().encode('utf-8'))` and writes via `on_conflict='content_hash'`. Any future ingestion path (06-08 CLI, Fase 10 clinical_data writer) MUST use the same canonicalization — drift breaks the UNIQUE constraint silently (one row per canonicalization variant). Test_idempotency.py (06-04) locks the canonicalization with a hardcoded sha256("hello") digest regression.

**Pin 3: `source_type` enum is the join key for retrieval weighting.** D-R4 weights (clinical_data 1.5×) in 06-10 score-weights.ts will key on `source_type === 'clinical_data'`. The CHECK constraint enforces only the two values that score-weights.ts knows about — adding a third value later requires updating BOTH the migration AND score-weights.ts in lockstep.

## Deviations from Plan

**Zero Rule 1 / Rule 2 / Rule 3 / Rule 4 deviations.** Plan executed verbatim including:
- Migration SQL body taken verbatim from PLAN `<interfaces>` Step 1 (idempotent DO blocks + create or replace function + grant execute)
- persister.py taken verbatim from PLAN `<interfaces>` Step "persister.py — full file"
- test_persist.py taken verbatim from PLAN action Step 2 (8 tests across 3 test classes)
- Founder gate `supabase db push --linked` ran cleanly without rollback (idempotent design held; no partial-application recovery needed)
- types.ts regeneration was a side-effect of `pnpm --filter web gen:types` — no manual edits applied to the generated file

The only Rule-2-shape consideration was the threat register T-RAG-05 (RPC abuse via unbounded match_count) — but that mitigation is OUT OF SCOPE for this plan (lives in 06-11 search.ts). Documented in `<threat_register_status>` frontmatter as NOT MITIGATED HERE with explicit pointer to 06-11.

## Authentication Gates

**One auth gate encountered (Task 2 founder action):**
- **Gate:** `supabase db push --linked` requires founder's local supabase CLI authenticated against the project. Claude cannot run this autonomously because (a) supabase CLI auth lives in founder's keychain, (b) destructive DDL against linked DB needs human eyes.
- **What automation was attempted:** Authored idempotent migration SQL with DO blocks + `if not exists` guards so re-runs are safe; documented exact command sequence (db push, schema verification queries, RPC smoke test, `pnpm gen:types`).
- **Manual step founder took:** Ran `supabase db push --linked` from repo root (Step 1), confirmed schema in Supabase Dashboard SQL Editor (Steps 2-3), ran `pnpm --filter web gen:types` (Step 4), confirmed new columns in regenerated types (Step 5).
- **Outcome:** "applied — types regenerated. Diff confirms `+ content_hash: string | null` and `+ source_type: string`. Both fields present in knowledge_chunks Row, Insert, and Update types."
- **Resume signal:** founder typed `applied` → continuation agent (this writer) committed the regenerated types.ts (Commit 4 `1a19cab`) and wrote this SUMMARY.

This is the second founder gate in Phase 6 (first was 06-02 vocabularies founder edits, third was 06-03 books_manifest founder validation). 06-08 will be the FOURTH (full ingestion run with $20 combined budget cap).

## Self-Check

Files created and committed:
- `supabase/migrations/0005_knowledge_chunks_content_hash_and_source_type.sql` — verified at commit `1e5a52d`
- `vision-service/scripts/lib/persister.py` — verified at commit `8f5b15a`
- `apps/web/types/database.ts` — verified modified at commit `1a19cab` (regenerated post-migration)
- `vision-service/tests/test_persist.py` — verified rewritten at commit `f147cee`

Tests added/flipped (8 total live in this plan's 1 test file):
- `test_persist.py`: 8 (was 4 skipped → 8 passed; +4 net new tests beyond Wave-0)

Commits made:
- `1e5a52d` feat(06-07): migration 0005
- `8f5b15a` feat(06-07): persister.py
- `f147cee` test(06-07): flip Wave 0 stubs GREEN
- `1a19cab` feat(06-07): regenerate database types

## Self-Check: PASSED
