---
phase: 06-rag-ingestao
plan: "11"
subsystem: rag-typescript-rerank-and-search-orchestrator
status: complete
completed_date: "2026-05-06"
duration_minutes: 30
tasks_completed: 2
tasks_total: 2
files_created: 2
files_modified: 2
tags: [rag, typescript, rerank, search, server-action, voyage-rerank-2.5, latency, wave-3, autonomous]
requirements_completed: [RAG-04]

dependency_graph:
  requires:
    - phase: 06-rag-ingestao/06-02
      provides: "apps/web/lib/rag/types.ts (KnowledgeChunkRow, KnowledgeChunkMetadata, ReportSection union 7-member); apps/web/lib/rag/section-queries.ts (SECTION_QUERY_TEMPLATES Record exhaustive)"
    - phase: 06-rag-ingestao/06-07
      provides: "supabase/migrations/0005 applied — match_knowledge_chunks RPC + apps/web/types/database.ts Functions['match_knowledge_chunks'] Args/Returns shape"
    - phase: 06-rag-ingestao/06-09
      provides: "apps/web/lib/rag/embed.ts — embedTexts({texts, inputType: 'query'}) wrapper around Voyage TS SDK; EMBEDDING_MODEL='voyage-3' PINNED"
    - phase: 06-rag-ingestao/06-10
      provides: "apps/web/lib/rag/build-queries.ts — buildFamilyA + buildFamilyB pure functions; IrisFeaturesForRag interface; apps/web/lib/rag/score-weights.ts — applyWeights(chunks, section, altaPrioridadeBooks)"
    - phase: 06-rag-ingestao/06-01
      provides: "Wave 0 stubs: rerank.test.ts (7 it.todo) + search.test.ts (9 it.todo)"
  provides:
    - "apps/web/lib/rag/rerank.ts — D-N2 voyage-rerank-2.5 wrapper with graceful fallback (NEVER throws); RERANK_MODEL env-overridable; rerankChunks({query, candidates, topK})"
    - "apps/web/lib/rag/search.ts — server action retrieveRelevantKnowledge({features, reportSections}) orchestrating the full RAG pipeline (D-R1..R5, D-N2)"
    - "apps/web/lib/rag/search.ts — exports ALTA_PRIORIDADE_BOOKS ReadonlySet<string> (7 books from books_manifest.json v0.1.1)"
    - "18 net new vitest passes (8 rerank + 10 search) — was 16 todos / 2 file-skips / 0 passes in those files; lib/rag/ overall now 5 passed (45) / 0 skipped"
  affects:
    - "Fase 7 (LLM analysis): retrieveRelevantKnowledge is the upstream contract — Fase 7 prompt builder calls this to get top-30 ranked KnowledgeChunkRow[] for the system prompt context window"
    - "06-08 (founder full-ingest run): unblocks the retrieval-side smoke test — once chunks land in the DB, retrieveRelevantKnowledge can be exercised end-to-end (Success Criterion 5: 'lacuna setor 7 → top-5 chunks fígado/lacuna')"

tech_stack:
  added: []  # voyageai SDK already pinned in 06-03/06-09; this plan adds only TS modules
  patterns:
    - "graceful-fallback-server-only-SDK-wrapper (rerank.ts): mirrors embed.ts (06-09) shape ('server-only' first line, lazy SDK construction inside try) but inverts the failure semantics — embed.ts throws VoyageEmbedError on missing key; rerank.ts logs warn + returns input slice. Three fallback paths: (1) missing API key, (2) empty candidates, (3) SDK throws or no usable items in response. ZERO `throw` statements in rerank.ts (verified by grep gate)."
    - "vi.hoisted-for-mock-fns-shared-with-factories (search.test.ts): vi.mock factories are themselves hoisted to the top of the file; declarative `const mockX = vi.fn()` lines below the import block run AFTER the factory body, causing 'Cannot access X before initialization'. Solution: wrap declarations in vi.hoisted() so the const bindings are lifted alongside the factory calls. Pattern documented inline in search.test.ts header comment."
    - "defensive-coercion-on-Fern-generated-optional-fields (rerank.ts): the voyageai SDK's RerankResponse.data, RerankResponseDataItem.index, and relevanceScore are all marked optional in the .d.mts (Fern code-gen quirk). rerank.ts skips items missing `index` (cannot map back to a candidate) and falls back to original score when relevanceScore is missing. Mirrors the same defensive pattern in embed.ts (06-09) for `embedding` and `totalTokens`."
    - "drift-detection-via-test-time-manifest-read (search.test.ts W3): the hardcoded ALTA_PRIORIDADE_BOOKS Set in search.ts is a snapshot of books_manifest.json v0.1.1 alta_prioridade=true keys. The drift detection test reads vision-service/scripts/data/books_manifest.json at test-time via fs.readFileSync + JSON.parse, computes the expected Set, and asserts equality. If the founder edits the manifest without bumping the TS constant, this test fails LOUDLY with a clear diff — exactly the W3 contract from the PLAN."
    - "Promise.all-on-parallel-pgvector-RPC (search.ts): D-R5 latency budget requires parallel embed (already covered by single embedTexts call with N texts) + parallel pgvector RPC (one call per embedding). Implemented via embeddings.map(emb => supabase.rpc(...)) followed by await Promise.all(rpcPromises). Mocked test 'runs RPC calls in parallel' verifies maxConcurrent > 1 by tracking concurrent in-flight calls."
    - "RPC-row-to-KnowledgeChunkRow-coercion (search.ts rpcRowToChunk): the Supabase RPC return shape (from types/database.ts Functions['match_knowledge_chunks'].Returns) types `metadata` as `Json` (the catch-all type from the generator); we coerce to KnowledgeChunkMetadata at the boundary (locked invariant — vision-service/scripts/lib/manifest.py BookEntry mirrors this shape — RESEARCH Pitfall 9). source_type narrows from `string` to `'biblioteca'|'clinical_data'` literal. score uses Number() for safety against pg_numeric returning string."
    - "auth-gate-mirrors-readings-ts-shape (search.ts): const { data: { user }, error: authErr } = await supabase.auth.getUser(); if (!user || authErr) throw new Error('Unauthenticated'). Identical destructure + check + throw pattern from app/actions/readings.ts:49 — Phase 4 baseline. Server-action defense-in-depth: even if middleware failed, the action itself rejects anonymous calls."
    - "telemetry-no-PII-only-counts-and-aggregate-scores (search.ts step 9): console.info({event: 'rag_retrieve', queries_count, chunks_returned, top_score, bottom_score}) — no user_id, client_id, reading_id, query strings, or chunk text. Test 'logs telemetry event with no PII' asserts these keys are absent from the log payload."

key_files:
  created:
    - "apps/web/lib/rag/rerank.ts (93 lines — RERANK_MODEL env-overridable + RerankArgs interface + rerankChunks with 3 graceful fallback paths)"
    - "apps/web/lib/rag/search.ts (159 lines — RetrieveArgs + ALTA_PRIORIDADE_BOOKS ReadonlySet + rpcRowToChunk coercer + retrieveRelevantKnowledge 9-step orchestrator)"
  modified:
    - "apps/web/lib/rag/rerank.test.ts (Wave 0 stubs flipped: 7 it.todo → 8 vitest assertions; +1 latency p95 test)"
    - "apps/web/lib/rag/search.test.ts (Wave 0 stubs flipped: 9 it.todo → 10 vitest assertions; +1 ALTA_PRIORIDADE drift detection test from PLAN's <interfaces>)"

key_decisions:
  - "rerank.ts emits THREE graceful fallback paths, not two. The PLAN's <interfaces> rerank.ts pattern emitted 2 fallbacks (missing key + try/catch). I added a third — when the SDK returns successfully but `result.data` is empty or every item has missing `index` (Fern optional fields), the reordered array is empty. Returning [] would cull the entire candidate pool and the orchestrator's downstream rerank-output-empty edge would surface as 'no chunks returned' for the user. Instead, log warn + fall back to candidates.slice(0, topK) (cosine sort). Rule 2 hardening (auto-add missing critical functionality)."
  - "rerank.ts respects topK on FALLBACK paths too (not just success path). The PLAN's pattern returned `args.candidates.slice(0, topK)` on missing-key fallback but the explicit topK=30 default is honored regardless of which path executes. Test 'respects topK default of 30 on fallback path' covers this — when SDK throws and candidates.length=100, result must be length 30 (default), not 100. Without this guarantee, callers would get inconsistent result-set sizes between rerank-success and rerank-fallback paths. Aligns with D-R3 cap=30 invariant."
  - "search.ts uses vi.hoisted() for test mock fns, not the top-level const pattern from PLAN. The PLAN's <interfaces> search.test.ts declared `const mockGetUser = vi.fn()` at module top and then referenced it in the vi.mock factory body. This is incompatible with vitest's hoisting rule — vi.mock factories are hoisted to the very top of the file, BEFORE the const declarations execute, causing 'Cannot access mockGetUser before initialization' at test runtime. Switched to `const { mockGetUser, mockRpc, mockEmbedTexts } = vi.hoisted(() => ({...}))` so the bindings hoist alongside the factory. Same fix would be needed in any vitest 2.x test file using `vi.mock(path, factory)` referencing local fns. (Rule 1 fix during Task 2 GREEN gate.)"
  - "ALTA_PRIORIDADE_BOOKS is a ReadonlySet<string> (compile-time immutable), not a Set<string>. The PLAN's <interfaces> declared the type as `ReadonlySet<string> = new Set([...])`. Kept the readonly contract for callers, but applyWeights expects mutable Set<string> (06-10) — bridged via `as Set<string>` cast at the single call site. ReadonlySet prevents downstream mutation; the cast is safe because applyWeights only reads via `.has()`."
  - "rpcRowToChunk coerces source_type to literal union, not pass-through. The RPC types source_type as `string` (Postgres CHECK constraint isn't reflected in the generated TS); a malformed DB row could violate the KnowledgeChunkRow narrow `'biblioteca'|'clinical_data'` invariant if we passed the string through. Defensive ternary: `row.source_type === 'clinical_data' ? 'clinical_data' : 'biblioteca'` — defaults to biblioteca for any unexpected value. Phase 1 + migration 0005 already enforces the CHECK at the DB layer; this is defense in depth at the TS boundary."
  - "search.ts manifest path resolution uses 4-up traversal (../../../../). The drift detection test resolves the manifest path relative to __dirname (apps/web/lib/rag/) — manifest is at vision-service/scripts/data/books_manifest.json. From the test file: lib/rag/ → lib/ → web/ → apps/ → <repo root>. Four `../` segments. Verified by running the test in isolation (passes) and confirming the resolved path matches the actual manifest location."
  - "Telemetry uses console.info, not a structured logger. RESEARCH §238 prescribes `console.info({event: 'rag_retrieve', ...})` — a future plan (Fase 9 polish) may swap in OpenTelemetry/Sentry. The current shape is JSON-serialization-safe for log aggregators (Vercel logs auto-pretty-print object literals). No PII keys (user_id, client_id, reading_id) are emitted; the test 'logs telemetry event with no PII' asserts negation explicitly."
  - "search.ts overfetches FINAL_CAP * 2 = 60 chunks from the reranker, then culls via applyWeights + sort. Without overfetch, the rerank-then-weight order can promote a chunk past the cap on the rerank score alone but lose it on a weight tiebreak. Overfetching gives the weights room to re-promote; the final cap=30 still holds. Mirrors the PLAN's verbatim pattern in <interfaces> step 6."

metrics:
  duration_minutes: 30
  commits: 4  # cdf61cc RED rerank + 623ce21 GREEN rerank + e103aa9 RED search + 2187bc9 GREEN search
  vitest_passes_added: 18  # 7+9 todos → 8+10 passes (each suite gained 1 extra test)
  vitest_skips_removed: 2  # rerank.test.ts and search.test.ts no longer file-skipped
  vitest_todos_removed: 16  # 7 rerank todos + 9 search todos
  rerank_test_count: 8  # was 7 (added 'latency under 1s p95 with 50 mocked chunks')
  search_test_count: 10  # was 9 (added 'ALTA_PRIORIDADE_BOOKS drift detection' from PLAN's <interfaces>)
  lib_rag_total_passes: 45  # rerank 8 + search 10 + embed 7 + build-queries 10 + score-weights 10
  lib_rag_total_files: 5  # all green, 0 skipped, 0 file-skips
  rerank_throw_count: 0  # graceful invariant verified by grep gate
  rerank_console_warn_count: 3  # missing-key + SDK-error + empty-response warnings
  search_use_server_count: 1  # 'use server' first non-comment line
  search_match_knowledge_chunks_grep: 2  # one in step 4 RPC call + one in comment
  search_promise_all_grep: 3  # rpcPromises + one in comment about "Promise.all" + Promise.all() invocation
  search_alta_prioridade_books_count: 7  # confirmed equals manifest v0.1.1 alta_prioridade=true entries

threat_register_status:
  - "T-RAG-04 (rerank API failure derails retrieval): MITIGATED. rerank.ts has 3 graceful fallback paths (missing key / SDK throw / empty response), 0 `throw` statements, 3 `console.warn` for observability. D-N2 contract honored: 'se rerank API falha, retorna top-30 cosine puro (não derruba retrieval)'."
  - "T-RAG-05 (anonymous access to retrieval): MITIGATED. search.ts auth gate (Supabase auth.getUser → throw 'Unauthenticated' if !user || authErr) — defense in depth even if middleware failed. Test 'throws when user is unauthenticated' verifies the gate."
  - "T-RAG-06 (PII leakage in telemetry): MITIGATED. console.info payload restricted to {event, queries_count, chunks_returned, top_score, bottom_score} — no user_id, client_id, reading_id, query strings, or chunk text. Test 'logs telemetry event with no PII' asserts negation (consoleSpy mock.calls[0][0] does NOT have user_id/client_id/reading_id keys)."
  - "T-RAG-07 (retrieval cap bypass via direct RPC consumer): NOT APPLICABLE. search.ts orchestrator enforces FINAL_CAP=30 + slice; the cap is server-side. Direct callers of supabase.rpc('match_knowledge_chunks', {match_count: N}) could theoretically request a larger N, but they would bypass the orchestrator entirely and hit the per-call match_count cap (TOP_K_PER_QUERY=10). Phase 7 consumer must call retrieveRelevantKnowledge, not the RPC directly — the contract."
  - "T-RAG-09 (ALTA_PRIORIDADE_BOOKS drift from manifest): MITIGATED. W3 drift detection test reads vision-service/scripts/data/books_manifest.json at test-time, computes alta_prioridade=true keys Set, asserts equality with hardcoded TS constant. Founder edits to the manifest must mirror in search.ts or this test fails loudly with a diff."
  - "T-RAG-10 (latency budget exhaustion): MITIGATED (early-warning). D-N4 prescribes p95 < 2s as early warning before D-R5 hard cap of 3s. Test 'latency p95 <= 2s with 8 mocked queries' measures actual orchestrator latency over 5 samples with mocked I/O — typical observed value < 50ms (well under 2s gate). Real-network latency budget unverified at this plan; covered by 06-12+13 (UAT spot-check) and Phase 7 acceptance."
---

# Phase 6 Plan 11: Wave 3 — rerank.ts + search.ts Orchestrator Summary

**One-liner:** Two retrieval-side TS modules that close the RAG pipeline — `rerank.ts` (D-N2 voyage-rerank-2.5 wrapper with three-path graceful fallback that NEVER throws — missing key / SDK error / empty response all log warn + return cosine-sorted slice) and `search.ts` (server action `retrieveRelevantKnowledge({features, reportSections})` orchestrating the full 9-step pipeline: auth gate → buildFamilyA+B → embedTexts parallel → match_knowledge_chunks RPC parallel via Promise.all → dedup-by-id keep-best-score → rerankChunks overfetch 60 → applyWeights compounding multipliers → sort desc + cap 30 → no-PII telemetry) — landed with 45/45 vitest passes for lib/rag/ (was 27 + 16 todos / 2 file-skips), tsc clean for both new files, ALTA_PRIORIDADE_BOOKS drift detection W3 test reading manifest at test-time, and zero deviations from autonomous spec other than three Rule 1/2 hardenings (rerank empty-response third fallback path, vi.hoisted() for mock fns, defensive Fern-optional coercion). **Wave 3 retrieval-side fully complete (06-09 + 06-10 + 06-11): 10/14 plans done; 06-08 founder full-ingest run remains.**

## Tasks completed

### Task 1: rerank.ts + flip rerank.test.ts to GREEN (TDD RED → GREEN)

**RED commit `cdf61cc`** — replaced 7 it.todo stubs with 8 real assertions (added `latency under 1s p95 with 50 mocked chunks` from the PLAN's behavior list). Tests fail at module-resolve time because `./rerank` does not yet exist.

**GREEN commit `623ce21`** — implemented `apps/web/lib/rag/rerank.ts` (93 lines):

- `import 'server-only'` first non-comment line — prevents VOYAGE_API_KEY browser-bundle leakage (mirror of embed.ts pattern from 06-09).
- `RERANK_MODEL = process.env.VOYAGE_RERANK_MODEL ?? 'voyage-rerank-2.5'` — env-overridable default, allows runtime swap to `voyage-rerank-2.5-lite` (RESEARCH §137 cost fallback) without code change.
- `rerankChunks({query, candidates, topK=30})` with three graceful fallback paths:
  1. Missing `VOYAGE_API_KEY` → `console.warn` + return `candidates.slice(0, topK)` (no SDK call).
  2. Empty `candidates` → return `[]` (no SDK call).
  3. SDK throws OR returns no usable items → `console.warn` + return `candidates.slice(0, topK)`.
- Defensive coercion on Fern-generated optional `RerankResponseDataItem.index` and `relevanceScore` (both optional in the .d.mts — code-gen artifact). Items missing `index` are skipped (cannot map back to a candidate); items missing `relevanceScore` keep the input score.
- ZERO `throw` statements (graceful invariant verified by grep gate).

8/8 vitest passes:

```
✓ rerank.ts (D-N2) (8 tests)
  ✓ reorders top-50 → top-30 via voyage-rerank-2.5
  ✓ falls back to cosine sort on API error (NEVER throws)
  ✓ falls back to cosine sort when VOYAGE_API_KEY missing
  ✓ returns empty array on empty candidates input
  ✓ respects topK default of 30 on fallback path
  ✓ RERANK_MODEL defaults to voyage-rerank-2.5 (env-overridable)
  ✓ replaces score with relevanceScore from rerank response
  ✓ latency under 1s p95 with 50 mocked chunks (mocked SDK with simulated delay)
```

### Task 2: search.ts + flip search.test.ts to GREEN (TDD RED → GREEN)

**RED commit `e103aa9`** — replaced 9 it.todo stubs with 10 real assertions (added `ALTA_PRIORIDADE_BOOKS stays in sync with books_manifest.json (W3 drift detection)` from the PLAN's `<interfaces>` block). Tests fail at module-resolve time because `./search` does not yet exist.

**GREEN commit `2187bc9`** — implemented `apps/web/lib/rag/search.ts` (159 lines) + applied vi.hoisted() fix to test file (Rule 1 fix discovered when GREEN gate failed with "Cannot access mockGetUser before initialization"):

- `'use server'` directive on first non-comment line — Next.js server-action constraint.
- `ALTA_PRIORIDADE_BOOKS: ReadonlySet<string>` — hardcoded Set of 7 book names from books_manifest.json v0.1.1 (alta_prioridade=true entries). Bernard Jensen Iridology Simplified, A Iridologia Em Defesa Da Vida, Bernard Jensen Iridology pdf, dictionary of iridology pdf, Iridologia Psicoemocional livro compa tivel bekup, What the Eye Reveals, Iridologia Del Profondo Birello Lucio Rito Daniele Lo 2007 Enea Edizioni 84f083031f5e812f466e932 1.
- `rpcRowToChunk(row)` coercer — handles the `metadata: Json` → `KnowledgeChunkMetadata` cast at the RPC boundary (locked invariant per types.ts line 7-12 mirror of vision-service manifest.py BookEntry); narrows `source_type: string` to literal union; coerces `score` via Number() for pg_numeric safety.
- `retrieveRelevantKnowledge({features, reportSections})` 9-step orchestrator:
  1. Supabase server client + auth gate — throws 'Unauthenticated' if no user.
  2. `buildFamilyA(features)` + `buildFamilyB(features, reportSections)` (06-10).
  3. `embedTexts({texts: allQueries, inputType: 'query'})` — single batched call.
  4. `embeddings.map(emb => supabase.rpc('match_knowledge_chunks', {...}))` + `await Promise.all(rpcPromises)` — D-R5 parallel pgvector retrieval, TOP_K_PER_QUERY=10 (D-N2 overfetch from 5).
  5. Dedup by id, keep highest-score row across overlapping queries.
  6. `rerankChunks({query: allQueries.join(' '), candidates, topK: 60})` — overfetch FINAL_CAP*2 so weights have room to re-promote.
  7. `applyWeights(candidates, primarySection, ALTA_PRIORIDADE_BOOKS as Set<string>)` — D-R4 multipliers compound.
  8. Sort score desc + slice(0, 30) — D-R3 cap.
  9. `console.info({event: 'rag_retrieve', queries_count, chunks_returned, top_score, bottom_score})` — no PII.

10/10 vitest passes:

```
✓ retrieveRelevantKnowledge (RAG-04, D-R1..R5, D-N2) (10 tests)
  ✓ throws when user is unauthenticated
  ✓ returns empty array when no queries built
  ✓ caps result at 30 chunks (D-R3)
  ✓ dedupes by id (keeps highest score)
  ✓ runs RPC calls in parallel (Promise.all)
  ✓ latency p95 <= 2s with 8 mocked queries (D-N4 early-warning)
  ✓ logs telemetry event with no PII
  ✓ orders chunks by score desc
  ✓ embeds with inputType="query" (RESEARCH §input_type for retrieval)
  ✓ ALTA_PRIORIDADE_BOOKS stays in sync with books_manifest.json (W3 drift detection)
```

## Verification gates

| Gate                                 | Command                                                            | Result                              |
| ------------------------------------ | ------------------------------------------------------------------ | ----------------------------------- |
| rerank test count                    | `pnpm test:run lib/rag/rerank.test.ts`                             | `8 passed` (≥7 required)            |
| search test count                    | `pnpm test:run lib/rag/search.test.ts`                             | `10 passed` (≥10 required)          |
| Combined gate (Wave 3 retrieval)     | `pnpm test:run lib/rag/`                                           | `5 passed (45) / 0 skipped`         |
| zero it.todo rerank                  | `grep -c "it.todo" lib/rag/rerank.test.ts`                         | `0`                                 |
| zero it.todo search                  | `grep -c "it.todo" lib/rag/search.test.ts`                         | `0`                                 |
| zero throws in rerank.ts (D-N2)      | `grep -c "throw " lib/rag/rerank.ts`                               | `0`                                 |
| console.warn count rerank.ts         | `grep -c "console.warn" lib/rag/rerank.ts`                         | `3` (≥2 required)                   |
| 'use server' first line              | `head -25 lib/rag/search.ts \| grep -c "'use server'"`             | `1`                                 |
| match_knowledge_chunks RPC call      | `grep -c "match_knowledge_chunks" lib/rag/search.ts`               | `2`                                 |
| Promise.all parallel embed/RPC       | `grep -c "Promise.all" lib/rag/search.ts`                          | `3`                                 |
| rerankChunks invocation              | `grep -c "rerankChunks" lib/rag/search.ts`                         | `2`                                 |
| applyWeights invocation              | `grep -c "applyWeights" lib/rag/search.ts`                         | `3`                                 |
| rag_retrieve telemetry event         | `grep -c "rag_retrieve" lib/rag/search.ts`                         | `1`                                 |
| ALTA_PRIORIDADE_BOOKS exported       | `grep -c "export const ALTA_PRIORIDADE_BOOKS" lib/rag/search.ts`   | `1`                                 |
| ALTA_PRIORIDADE_BOOKS = 7 entries    | manifest alta_prioridade=true count vs TS constant cardinality     | `7 === 7` ✓                         |
| W3 drift detection test green        | `pnpm test:run lib/rag/search.test.ts -t "ALTA_PRIORIDADE_BOOKS"`  | `1 passed / 9 skipped`              |
| tsc on rerank.ts + search.ts         | `pnpm exec tsc --noEmit \| grep "lib/rag/(search\|rerank)"`        | `(empty)`                           |
| LGPD literal-grep new files          | `grep -E "diagn[óo]stico\|tratamento\|cura" rerank.ts search.ts`   | `(empty)`                           |
| Wave 0 stubs in lib/rag remaining    | `grep -rc "it.todo\|describe.skip" lib/rag/`                       | `0` (all 12 files clean)            |

## Pre-existing tsc errors (out of scope, documented)

`pnpm exec tsc --noEmit` reports the same Phase 5 / Phase 3 dívida already documented in 06-09 + 06-10 SUMMARYs and STATE.md "Itens diferidos":

- **Phase 5 dívida** (~10 errors): `app/actions/readings.test.ts`, `app/api/vision/webhook/route.ts`, `components/readings/ReprocessButton.test.tsx`, `components/readings/StatusBadge.tsx`, `lib/vision/modal-client.test.ts`.
- **Phase 3 dívida** (2 errors): `lib/capture/quality-scoring.test.ts(47,54)` references `WEIGHTS.reflex` removed in UAT 03 VLM pivot.

The plan's gates explicitly scope verification to `lib/rag/rerank` and `lib/rag/search` and treat other tree errors as pre-existing dívida (mirror of 06-07 / 06-09 / 06-10 which faced the same).

## Pre-existing apps/web vitest failures (out of scope, documented)

`pnpm test:run` (full apps/web suite) reports 3 failures, all in `lib/capture/quality-scoring.test.ts` — Phase 3 pre-existing failures from the UAT 03 VLM pivot when `WEIGHTS.reflex` was removed but the tests were not updated. **NOT introduced by this plan** — verified that the same failures pre-exist on baseline `8cf9f72` (the commit before this plan's first commit). lib/rag/ is **100% green** (45/45 passes / 0 skipped / 0 fails).

Total apps/web result: **305 passed / 3 failed** (was 287 passed / 3 failed before this plan); **+18 passes / 0 new failures** — the +18 is precisely the rerank 8 + search 10 added here.

## Pre-existing audit:vocabulary hits (out of scope)

`pnpm audit:vocabulary` reports 8 hits — **NONE in `lib/rag/rerank.ts`, `lib/rag/rerank.test.ts`, `lib/rag/search.ts`, `lib/rag/search.test.ts`**. All hits are pre-existing technical comments in `app/(auth)/login|signup/page.tsx`, `app/api/capture/validate/route.ts`, `components/capture/CapturePreview.tsx` (Phase 3 dívida documented in STATE.md "Itens diferidos"). The audit currently scans `app/` and `components/` (not `lib/rag/`) — the directory-extension to include `lib/rag/` ships in 06-12.

## Test count delta

Baseline (HEAD `8cf9f72` — after 06-10):

```
2 file-skips + 16 todos + 3 files with 27 passes
- rerank.test.ts:        7 todos (file-skip)
- search.test.ts:        9 todos (file-skip)
- build-queries.test.ts: 10 passes
- score-weights.test.ts: 10 passes
- embed.test.ts:         7 passes
```

Post-06-11 (HEAD after final docs commit):

```
0 file-skips + 0 todos + 5 files with 45 passes
- rerank.test.ts:        8 passes (FLIPPED — was 7 todos; +1 latency test)
- search.test.ts:       10 passes (FLIPPED — was 9 todos; +1 W3 drift test)
- build-queries.test.ts: 10 passes (unchanged)
- score-weights.test.ts: 10 passes (unchanged)
- embed.test.ts:         7 passes (unchanged)
```

Net: **+18 passes / -16 todos / -2 file-skips** (each flipped suite gained 1 extra test beyond Wave-0 todo count: rerank +1 latency p95 test; search +1 ALTA_PRIORIDADE drift detection from PLAN's `<interfaces>`). lib/rag/ is now fully green — Wave 0 stubs are entirely flipped.

## Latency observed (mocked I/O p95)

D-N4 early-warning gate (`p95 < 2000ms`) was tested with 8 queries (constitution.primary + secondary + 2 sectors with findings + 2 active rings + 2 reportSections each producing template queries). Across 5 samples with mocked I/O (no network):

| Run | Time   |
| --- | ------ |
| min | ~2 ms  |
| max | ~10 ms |
| p95 | <50 ms |

Real-network latency budget (D-R5 ≤3s) unverified at this plan — covered by 06-12+13 UAT spot-check and Phase 7 acceptance.

## Voyage TS SDK API quirks documented

- `RerankRequest`: `query: string` + `documents: string[]` + `model: string` + optional `topK?: number` + `returnDocuments?: boolean` + `truncation?: boolean`. Matches PATTERNS.md line 1051.
- `RerankResponse`: `data?: RerankResponseDataItem[]` + `model?: string` + `usage?: RerankResponseUsage`. **All optional in Fern-generated .d.mts** — defensive coercion required.
- `RerankResponseDataItem`: `index?: number` + `relevanceScore?: number` + `document?: string`. **Both index and relevanceScore optional** — items missing index are skipped; items missing relevanceScore keep the input score.

The defensive coercion pattern matches the same convention in embed.ts (06-09) for `EmbedResponse.data` / `EmbedResponseDataItem.embedding` / `EmbedResponseUsage.totalTokens`.

## ALTA_PRIORIDADE_BOOKS source-of-truth confirmation

Hardcoded Set in search.ts equals manifest v0.1.1 alta_prioridade=true entries:

```python
$ python -c "import json; m=json.load(open('vision-service/scripts/data/books_manifest.json',encoding='utf-8'));
              [print(repr(k)) for k,v in m['books'].items() if v.get('alta_prioridade')]"
'Bernard Jensen Iridology Simplified'
'A Iridologia Em Defesa Da Vida'
'Bernard Jensen Iridology pdf'
'dictionary of iridology pdf'
'Iridologia Psicoemocional livro compa tivel bekup'
'What the Eye Reveals'
'Iridologia Del Profondo Birello Lucio Rito Daniele Lo 2007 Enea Edizioni 84f083031f5e812f466e932 1'
```

7 entries total. The W3 drift detection test reads this same file at test-time and compares against the TS Set — mismatch fails loudly.

## Deviations

### Rule 2 — auto-add missing critical functionality (rerank.ts third fallback path)

**Found during:** Task 1 (writing rerank.ts).
**Issue:** The PLAN's `<interfaces>` rerank.ts pattern emitted 2 fallback paths (missing key + try/catch). When the SDK returns successfully but `result.data` is empty or every item has missing `index` (Fern optional fields), the reordered array would be empty — returning `[]` would cull the entire candidate pool and the orchestrator's downstream rerank-output would surface as "no chunks returned" for the user despite having a valid pre-rerank candidate set.
**Fix:** Added a third fallback path inside the try block — if `reordered.length === 0` after processing the SDK response, log warn + return `args.candidates.slice(0, topK)` (cosine sort). Critical for correctness — the orchestrator must always return chunks when candidates were available pre-rerank.
**Files modified:** `apps/web/lib/rag/rerank.ts`.
**Commit:** `623ce21`.

### Rule 1 — fix blocking issue (vi.hoisted for mock fns)

**Found during:** Task 2 GREEN gate first run (search test failed at module-resolve with "Cannot access 'mockGetUser' before initialization").
**Issue:** The PLAN's `<interfaces>` search.test.ts declared `const mockGetUser = vi.fn()` at module top and then referenced it in the `vi.mock` factory body. This is incompatible with vitest's hoisting rule — `vi.mock(path, factory)` factories are hoisted to the very top of the file, BEFORE the const declarations execute. The factory ran first, attempted to read `mockGetUser`, and threw the ReferenceError.
**Fix:** Switched to `const { mockGetUser, mockRpc, mockEmbedTexts } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockRpc: vi.fn(), mockEmbedTexts: vi.fn() }))` — vi.hoisted() lifts its callback alongside the vi.mock factory hoisting, so both bindings are available when the factories run.
**Files modified:** `apps/web/lib/rag/search.test.ts` (lines 18-26 — declaration block).
**Commit:** Folded into `2187bc9` (GREEN commit, before staging).

### Rule 1 — fix blocking issue (manifest path resolution depth)

**Found during:** Task 2 (writing search.test.ts W3 drift detection test).
**Issue:** The PLAN's `<interfaces>` test used `path.resolve(__dirname, '../../../vision-service/...')` (3 levels up). From the test file at `apps/web/lib/rag/`, going 3 levels up reaches `apps/` (not the repo root). The actual repo root is 4 levels up.
**Fix:** Changed to `'../../../../vision-service/scripts/data/books_manifest.json'` (4 segments). Verified by isolated test run — the drift detection test passes.
**Files modified:** `apps/web/lib/rag/search.test.ts` (line 244 — manifest path).
**Commit:** Folded into `2187bc9`.

### No other deviations

- Rule 2 (other than rerank fallback): NONE
- Rule 3 (blocking issues other than test-side): NONE
- Rule 4 (architectural): NONE applied; no checkpoint emitted (plan was AUTONOMOUS).
- Auth gates: N/A (no founder/external system interaction during execution; the auth gate IN search.ts itself is a tested feature, not an execution gate).

## Self-Check: PASSED

- [x] `apps/web/lib/rag/rerank.ts` exists (verified via Read, 93 lines)
- [x] `apps/web/lib/rag/search.ts` exists (verified via Read, 159 lines)
- [x] Commit `cdf61cc` (RED rerank test) exists in `git log`
- [x] Commit `623ce21` (GREEN rerank impl) exists in `git log`
- [x] Commit `e103aa9` (RED search test) exists in `git log`
- [x] Commit `2187bc9` (GREEN search impl + flipped test) exists in `git log`
- [x] 18/18 new tests pass (`pnpm test:run lib/rag/rerank.test.ts lib/rag/search.test.ts` exits 0)
- [x] 45/45 lib/rag/ overall passes (`pnpm test:run lib/rag/` exits 0, 5 files / 0 skipped)
- [x] zero it.todo entries in any lib/rag/ file (full Wave 0 flip complete)
- [x] zero `throw` statements in rerank.ts (D-N2 graceful invariant)
- [x] tsc clean for both new files (pre-existing Phase 5/3 dívida documented as out-of-scope)
- [x] LGPD literal-grep clean for both new files
- [x] ALTA_PRIORIDADE_BOOKS Set cardinality (7) matches manifest alta_prioridade=true count
- [x] W3 drift detection test green in isolation
- [x] All required grep gates pass (use server, match_knowledge_chunks, Promise.all, rerankChunks, applyWeights, rag_retrieve)
- [x] No new regressions in apps/web full test suite (305 passed / 3 failed; 3 failed are pre-existing Phase 3 dívida; +18 passes vs baseline = exactly the rerank 8 + search 10 added here)
