---
phase: 6
slug: rag-ingestao
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-05-05
---

# Phase 6 — RAG Ingestão — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source of truth: `06-RESEARCH.md ## Validation Architecture` + `06-CONTEXT.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frameworks** | pytest 9.x (vision-service Python — already in use) + vitest 2.1.x (apps/web TypeScript — already in use) |
| **Config files** | `vision-service/pytest.ini`, `apps/web/vitest.config.ts` (existing — Phase 5) |
| **Quick run command (Python)** | `cd vision-service && python -m pytest tests/ -v -k "ingest or chunker or embed or contextualize or budget"` |
| **Quick run command (TS)** | `pnpm --filter web test:run lib/rag/` |
| **Full suite command** | `cd vision-service && python -m pytest tests/ -v` && `pnpm test:run` |
| **Audit gate (LGPD)** | `pnpm audit:vocabulary` (cross-tree, MUST extend to scan `books_manifest.json` + `vocabularies.json` + DB `metadata.tags_livres`) |
| **Estimated runtime** | ~30s quick (Python+TS in parallel) / ~120s full suite |

---

## Sampling Rate

- **After every task commit:** Run quick command for the changed tree (`pytest -k "test_<changed>"` Python OR `vitest run --changed` TS) — under 30s
- **After every plan wave:** Run full suite cross-tree + `audit:vocabulary`
- **Before `/gsd-verify-work 6`:** Full suite green + manual UAT spot-check (RAG-04 Success Criterion 5) + manifest schema validated + migration applied successfully on linked Supabase
- **Max feedback latency:** 30s for quick, 120s for full

---

## Per-Task Verification Map

> Populated as plans are written. Initial map covers requirement-level verification; plan-checker enforces every task in PLAN.md frontmatter has either an `<automated>` test command or a Wave-0 dependency.

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| RAG-01 | PyMuPDF extracts text from fixture PDF | unit | `pytest vision-service/tests/test_ingest_extract.py -v` | ❌ Wave 0 |
| RAG-01 | Chunker splits 1500-token sample preserving chapter/section boundaries; produces overlap=80; honors 300–700 range (D-C1) | unit | `pytest vision-service/tests/test_chunker.py -v` | ❌ Wave 0 |
| RAG-01 | Chunker emits `chapter`, `section`, `page`, `tokens_estimated` per chunk (D-C2) | unit | `pytest vision-service/tests/test_chunker.py::test_chunk_metadata_shape` | ❌ Wave 0 |
| RAG-01 | DOCX extractor handles `.docx` via `python-docx` or `docx2txt` (2 files in acervo) | unit | `pytest vision-service/tests/test_ingest_extract.py::test_docx` | ❌ Wave 0 |
| RAG-01 | Manifest schema validation (Pydantic) — `books_manifest.json` conforms (D-M1) | unit | `pytest vision-service/tests/test_books_manifest.py` | ❌ Wave 0 |
| RAG-02 | Voyage client mocked: batch of 128 texts → returns 128 vectors of dim 1024 (D-E1) | unit | `pytest vision-service/tests/test_embedder.py::test_batch_size_128` | ❌ Wave 0 |
| RAG-02 | content_hash deduplication: re-ingesting same text is idempotent (D-E2) | unit | `pytest vision-service/tests/test_idempotency.py` | ❌ Wave 0 |
| RAG-02 | Hardcap enforcement: when running_total_tokens × $0.06/1M > $5, raises `BudgetExceeded` (D-G1) | unit | `pytest vision-service/tests/test_budget.py` | ❌ Wave 0 |
| RAG-02 | Migration 0005 applies cleanly + idempotently (content_hash UNIQUE, source_type CHECK, btree indexes) (D-P1) | integration (db) | `psql -f supabase/migrations/0005_*.sql` (twice) + `\d knowledge_chunks` | ❌ Wave 0 |
| RAG-02 | INSERT with `ON CONFLICT (content_hash) DO NOTHING` skips duplicate | integration (db) | `pytest vision-service/tests/test_persist.py::test_insert_idempotent` (against local supabase) | ❌ Wave 0 |
| **RAG-02** | **Contextual Retrieval (D-N1) — generates situating sentence per chunk via Haiku 4.5 + prompt caching** | unit | `pytest vision-service/tests/test_contextualizer.py::test_generate_context_attaches_situating_sentence` | ❌ Wave 0 |
| **RAG-02** | **Contextual Retrieval cache hit rate ≥ 60% on second pass (idempotent re-run)** | integration | `pytest vision-service/tests/test_contextualizer.py::test_cache_efficiency` | ❌ Wave 0 |
| **RAG-02** | **Contextual Retrieval hardcap dedicated (US$ 15)** | unit | `pytest vision-service/tests/test_contextualize_budget.py::test_aborts_at_15usd` | ❌ Wave 0 |
| RAG-03 | After full ingestion, `SELECT COUNT(*) FROM knowledge_chunks WHERE source_type='biblioteca'` ≥ 1000 + ≥10 distinct source_book values | manual smoke | `psql -c "SELECT source_book, COUNT(*) FROM knowledge_chunks GROUP BY 1 ORDER BY 2 DESC"` after `python ingest_knowledge.py` | manual (founder Wave runner) |
| RAG-03 | Spot-check 5 random chunks per book have non-empty `text`, populated `metadata.escola`, valid embedding (1024 floats) | manual smoke | `psql -c "SELECT id, source_book, length(text), metadata->'escola' FROM knowledge_chunks ORDER BY random() LIMIT 50"` | manual |
| RAG-04 | `retrieveRelevantKnowledge(features, sections)` returns ≤30 chunks deduped by id with score field, ordered desc (D-R3) | unit | `vitest run apps/web/lib/rag/search.test.ts` | ❌ Wave 0 |
| RAG-04 | Family A queries are generated from features (D-R2A) | unit | `vitest run apps/web/lib/rag/build-queries.test.ts::test_family_a` | ❌ Wave 0 |
| RAG-04 | Family B queries are generated from reportSections × constitution (D-R2B) | unit | `vitest run apps/web/lib/rag/build-queries.test.ts::test_family_b` | ❌ Wave 0 |
| RAG-04 | Weighting D-R4: clinical_data → 1.5×; alta_prioridade → 1.1×; dimensoes intersect → 1.2× | unit | `vitest run apps/web/lib/rag/score-weights.test.ts` | ❌ Wave 0 |
| **RAG-04** | **Reranking (D-N2) — voyage-rerank-2.5 reorders top-50 → top-30 candidates correctly** | unit | `vitest run apps/web/lib/rag/rerank.test.ts::test_rerank_reorders_top30` | ❌ Wave 0 |
| **RAG-04** | **Reranking falls back gracefully on API error (devolve top-30 cosine puro)** | unit | `vitest run apps/web/lib/rag/rerank.test.ts::test_falls_back_on_api_error` | ❌ Wave 0 |
| **RAG-04** | **Reranking latency < 1s p95 em 50 chunks** | unit | `vitest run apps/web/lib/rag/rerank.test.ts::test_latency_under_1s` | ❌ Wave 0 |
| RAG-04 | Latency end-to-end ≤3s with 8 mocked queries running in `Promise.all` (D-R5) | unit | `vitest run apps/web/lib/rag/search.test.ts::test_latency_budget` | ❌ Wave 0 |
| **RAG-04** | **Latency p95 ≤ 2s (D-N4 early-warning gate, < D-R5 cap of 3s)** | perf | `vitest run apps/web/lib/rag/search.test.ts::test_latency_p95_under_2s` | ❌ Wave 0 |
| RAG-04 | Spot-check (Success Criterion 5): feature `lacuna setor 7 (fígado)` returns top-5 chunks visibly relevant; comparar plain vs +contextual+rerank em 10 queries (D-N5) | manual UAT | `npx tsx apps/web/scripts/rag-spot-check.ts` (or test fixture) | manual |

---

## Wave 0 Requirements

**Files to create as test scaffolding (Wave 0 — before pipeline implementation):**

- [x] `vision-service/tests/test_ingest_extract.py` — RAG-01 PDF + DOCX extraction (06-01 scaffold; flips in 06-04)
- [x] `vision-service/tests/test_chunker.py` — RAG-01 chunking strategy + boundary preservation (D-C1..C3) (06-01 scaffold; flips in 06-04)
- [x] `vision-service/tests/test_books_manifest.py` — D-M1 schema + file existence (06-01 scaffold; flips in 06-03)
- [x] `vision-service/tests/test_embedder.py` — RAG-02 Voyage batching + dim assertions (D-E1) (06-01 scaffold; flips in 06-05)
- [x] `vision-service/tests/test_idempotency.py` — D-E2 content_hash dedup (06-01 scaffold; flips in 06-04)
- [x] `vision-service/tests/test_budget.py` — D-G1 hardcap (US$ 5 embedding) (06-01 scaffold; flips in 06-05)
- [x] `vision-service/tests/test_persist.py` — integration test against local supabase (or test container) (06-01 scaffold; flips in 06-07)
- [x] `vision-service/tests/test_vocabularies.py` — D-T2..T5 vocabulary enforcement (06-01 scaffold; flips in 06-02)
- [x] **`vision-service/tests/test_contextualizer.py`** — D-N1 Contextual Retrieval (sentence generation, cache hit rate) (06-01 scaffold; flips in 06-06)
- [x] **`vision-service/tests/test_contextualize_budget.py`** — D-N1 dedicated hardcap (US$ 15 Contextual Retrieval) (06-01 scaffold; flips in 06-05)
- [x] `apps/web/lib/rag/search.test.ts` — RAG-04 retrieve contract + D-R5 latency budget (06-01 scaffold; flips in 06-11)
- [x] `apps/web/lib/rag/build-queries.test.ts` — D-R2 Family A+B query generation (06-01 scaffold; flips in 06-10)
- [x] `apps/web/lib/rag/score-weights.test.ts` — D-R4 weighting (06-01 scaffold; flips in 06-10)
- [x] **`apps/web/lib/rag/rerank.test.ts`** — D-N2 voyage-rerank-2.5 reorder + fallback + latency (06-01 scaffold; flips in 06-11)

**Data files to create (Wave 0):**

- [ ] `vision-service/scripts/data/vocabularies.json` — canonical vocab arrays for D-T2..T5 (read by both ingest + tests)
- [ ] `vision-service/scripts/data/books_manifest.json` — D-M1 (founder fills in Wave 0)
- [ ] `vision-service/data/jensen-reference.md` — D-T4 canonical signs list (founder validates)
- [ ] `apps/web/lib/rag/section-queries.ts` — D-R2 templates (frozen v1 set; consumed by Fase 7)
- [ ] **Migration `0005_knowledge_chunks_content_hash_and_source_type.sql`** — D-P1
- [ ] **Migration `0005_match_knowledge_chunks_rpc.sql`** (or combined into 0005) — pgvector RPC with `SET LOCAL hnsw.ef_search = 100`

**Framework install:** Nothing new — pytest already configured (`vision-service/pytest.ini` exists), vitest already configured. New SDKs: `voyageai` npm + `voyageai` PyPI + `anthropic` PyPI (for Contextual Retrieval D-N1) — installed in Wave 0 as separate task.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Founder validates `vocabularies.json` (especially `sinais_referenciados` canonical list — D-T4) | RAG-01 / D-T4 | Iridologist domain expertise — pos-MVP this could be auto-extracted from chunks but founder is the canonical source for v1 | Founder reads `vision-service/data/jensen-reference.md`, edits + commits |
| Founder fills `books_manifest.json` (`alta_prioridade`, `escola`, `extrator`, `skip` per book) | RAG-03 / D-M1 | Domain decision per book; auto-detection unreliable | Founder runs `python vision-service/scripts/manifest_assist.py` (interactive), commits resulting JSON |
| Spot-check Success Criterion 5: lacuna setor 7 → top-5 fígado/lacuna chunks visibly relevant; compare plain vs +contextual+rerank | RAG-04 / D-N5 | Domain expertise; subjective relevance qualification | Founder runs `npx tsx apps/web/scripts/rag-spot-check.ts` (Wave-late); script outputs side-by-side; founder marks pass/fail in UAT.md |
| Founder UAT against full corpus quality (≥10 representative queries Family A + B; comparar com/sem técnicas Ninja Pass) | RAG-04 / D-N5 | Subjective qualification of retrieval quality before opening Fase 7 | Founder runs interactive UAT script; logs pass/fail per query |
| Vocabulary audit on `metadata.tags_livres` (LGPD) | D-T6 / Pitfall #6 | Tags are content WE write; trecho de livro pode usar palavra proibida (citação direta), mas tag livre não | `psql -c "SELECT id, source_book, metadata->'tags_livres' FROM knowledge_chunks WHERE metadata::text ILIKE '%diagnóstico%'"`; founder revisa hits |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (enforced by gsd-plan-checker)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ MISSING references in the verification map above
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s quick / 120s full
- [ ] Performance gate: end-to-end retrieval p95 < 2s (early warning) and < 3s (D-R5 hard cap)
- [ ] LGPD audit gate green on `tags_livres`, `metadata`, `source_chapter`, all string fields
- [ ] `nyquist_compliant: true` set in frontmatter (after Wave 0 completes and all 14 test files exist with at least 1 passing test each)

**Approval:** pending — set to `approved YYYY-MM-DD` after planner consumes this and plan-checker validates coverage.
