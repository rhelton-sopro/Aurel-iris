---
phase: 06-rag-ingestao
plan: "01"
subsystem: rag-test-scaffolding
status: complete
completed_date: "2026-05-05"
duration_minutes: 25
tasks_completed: 2
tasks_total: 2
files_created: 16
files_modified: 1
tags: [rag, testing, pytest, vitest, wave-0, scaffolding]
requirements_completed: []  # RAG-01/02/04 são marcados quando os módulos GREEN landam (06-04..06-11)

dependency_graph:
  requires: []
  provides:
    - vision-service/tests/test_ingest_extract.py (Wave 0 stubs — RAG-01 PDF + DOCX extraction; flips in 06-04)
    - vision-service/tests/test_chunker.py (Wave 0 stubs — D-C1..C3 + content_hash D-E2; flips in 06-04)
    - vision-service/tests/test_books_manifest.py (Wave 0 stubs — D-M1 schema + Pydantic enums; flips in 06-03)
    - vision-service/tests/test_embedder.py (Wave 0 stubs — D-E1 voyage-3 batch=128 dim=1024; flips in 06-05)
    - vision-service/tests/test_idempotency.py (Wave 0 stubs — D-E2 content_hash determinism; flips in 06-04)
    - vision-service/tests/test_budget.py (Wave 0 stubs — D-G1 hardcap US$5; flips in 06-05)
    - vision-service/tests/test_persist.py (Wave 0 stubs — D-E2 ON CONFLICT + D-I2 purge; flips in 06-07)
    - vision-service/tests/test_vocabularies.py (Wave 0 stubs — D-T2..T5 vocabulary enforcement; flips in 06-02)
    - vision-service/tests/test_contextualizer.py (Wave 0 stubs — D-N1 Haiku 4.5 + prompt caching; flips in 06-06)
    - vision-service/tests/test_contextualize_budget.py (Wave 0 stubs — D-N1 hardcap US$15; flips in 06-05)
    - apps/web/lib/rag/search.test.ts (Wave 0 todos — RAG-04 retrieve contract + D-R5 latency; flips in 06-11)
    - apps/web/lib/rag/build-queries.test.ts (Wave 0 todos — D-R2 Family A+B; flips in 06-10)
    - apps/web/lib/rag/score-weights.test.ts (Wave 0 todos — D-R4 multipliers; flips in 06-10)
    - apps/web/lib/rag/rerank.test.ts (Wave 0 todos — D-N2 voyage-rerank-2.5; flips in 06-11)
    - vision-service/tests/fixtures/sample_book.txt (synthetic 3-section iridology text; LGPD audit clean)
    - vision-service/tests/fixtures/sample_book.pdf (67-byte placeholder; regenerated in 06-04)
  affects:
    - 06-02-PLAN (executor flips test_vocabularies.py GREEN)
    - 06-03-PLAN (executor flips test_books_manifest.py GREEN)
    - 06-04-PLAN (executor flips test_ingest_extract.py + test_chunker.py + test_idempotency.py GREEN; regenerates sample_book.pdf)
    - 06-05-PLAN (executor flips test_embedder.py + test_budget.py + test_contextualize_budget.py GREEN)
    - 06-06-PLAN (executor flips test_contextualizer.py GREEN)
    - 06-07-PLAN (executor flips test_persist.py GREEN)
    - 06-10-PLAN (executor flips build-queries.test.ts + score-weights.test.ts GREEN)
    - 06-11-PLAN (executor flips search.test.ts + rerank.test.ts GREEN)
    - 06-VALIDATION.md (frontmatter wave_0_complete: false → true; 14 checkboxes flipped)

tech_stack:
  added: []  # nothing new — pytest + vitest already configured in Phase 5
  patterns:
    - "lazy-import-inside-test: import target module INSIDE test body so collection succeeds before module exists (mirrors Phase 5 test_error_summary.py)"
    - "skip-with-plan-id reason scheme: `Wave 0 — flip in 06-XX-PLAN` so future executors grep their tests"
    - "it.todo for TS scaffolding: vitest counts todos as pass; flipped to it() with assertions in implementation plan"
    - "fixture-as-text-spec: sample_book.txt is the human-readable spec for the synthetic PDF; sample_book.pdf is regenerated from it deterministically"

key_files:
  created:
    - vision-service/tests/test_ingest_extract.py
    - vision-service/tests/test_chunker.py
    - vision-service/tests/test_books_manifest.py
    - vision-service/tests/test_embedder.py
    - vision-service/tests/test_idempotency.py
    - vision-service/tests/test_budget.py
    - vision-service/tests/test_persist.py
    - vision-service/tests/test_vocabularies.py
    - vision-service/tests/test_contextualizer.py
    - vision-service/tests/test_contextualize_budget.py
    - vision-service/tests/fixtures/sample_book.txt
    - vision-service/tests/fixtures/sample_book.pdf
    - apps/web/lib/rag/search.test.ts
    - apps/web/lib/rag/build-queries.test.ts
    - apps/web/lib/rag/score-weights.test.ts
    - apps/web/lib/rag/rerank.test.ts
  modified:
    - .planning/phases/06-rag-ingestao/06-VALIDATION.md (wave_0_complete: false → true; 14 checkboxes flipped)

decisions: []  # plano executado verbatim; sem deciões novas

metrics:
  duration_minutes: 25
  commits: 2
  pytest_skips: 49
  vitest_todos: 32
  pytest_files: 10
  vitest_files: 4
  fixture_files: 2
  total_artifacts: 16
---

# Phase 6 Plan 01: Wave 0 — Test scaffolding Summary

**One-liner:** 14 RAG test files (10 pytest stubs SKIPPED + 4 vitest stubs todo) plus 2 fixtures committed; subsequent plans (06-02..06-11) grep `Wave 0 — flip in 06-XX-PLAN` to find their tests and turn them GREEN as modules land.

## Tasks Executed

### Task 1: 10 pytest scaffolding files for vision-service RAG modules

Status: **complete** (commit `7dd6287`)

Created 10 pytest test files under `vision-service/tests/` following the lazy-import-inside-test pattern (mirrors Phase 5 `test_error_summary.py`). Each test method is decorated with `@pytest.mark.skip(reason="Wave 0 — flip in 06-XX-PLAN")` so pytest collects but skips it. Total **49 skips** across the 10 files.

Per-file skip count and target plan for flip-to-green:

| File | Class | Tests | Skip plan ID | Coverage |
|------|-------|-------|--------------|----------|
| `test_ingest_extract.py` | `TestPdfExtractor` (3) + `TestDocxExtractor` (1) | 4 | 06-04 | RAG-01 PyMuPDF/pdfplumber/python-docx (D-C4) |
| `test_chunker.py` | `TestChunker` | 5 | 06-04 | RAG-01 chunk size 300–700, overlap=80 within section, no cross-chapter overlap, metadata shape, content_hash sha256 locked (D-C1..C2 + D-E2) |
| `test_books_manifest.py` | `TestBooksManifest` | 5 | 06-03 | D-M1 18 entries + filename existence + Pydantic Literal enums (extrator, escola) + extra='forbid' (D-T6) |
| `test_embedder.py` | `TestEmbedder` | 6 | 06-05 | D-E1 voyage-3 + BATCH_SIZE=128 + input_type='document' + dim=1024 + retry 1/4/16s + missing API key error |
| `test_idempotency.py` | `TestContentHashIdempotency` | 4 | 06-04 | D-E2 deterministic hash + strip canonicalization + NO unicode normalization (NFC ≠ NFD per RESEARCH Pitfall 1) |
| `test_budget.py` | `TestVoyageBudgetGuard` | 4 | 06-05 | D-G1 HARDCAP_USD=5.0 + PRICE_PER_1M=0.06 + abort at hardcap + log every 10 chunks (D-G2) |
| `test_persist.py` | `TestPersister` | 4 | 06-07 | D-E2 ON CONFLICT content_hash ignore_duplicates + D-I2 purge_book + Pitfall 14 service-role key validation |
| `test_vocabularies.py` | `TestVocabularies` | 7 | 06-02 | D-T2 constituicao (6 entries verbatim) + D-T3 setores h1..h12 + D-T5 dimensoes (6) + D-T5 escola_origem (7 schools) + D-T4 sinais baseline + LGPD audit |
| `test_contextualizer.py` | `TestContextualizer` | 5 | 06-06 | D-N1 Haiku 4.5 default + cache_control ephemeral + budget guard token bookkeeping + canonical PROMPT_TEMPLATE |
| `test_contextualize_budget.py` | `TestContextualBudgetGuard` | 5 | 06-05 | D-N1 HARDCAP_USD=15.0 + Haiku 4.5 input/cache-read/output pricing + 3-token-type cost formula |
| **Total** | **10 classes** | **49** | — | — |

Verification:
```
$ cd vision-service && python -m pytest tests/test_ingest_extract.py tests/test_chunker.py tests/test_books_manifest.py tests/test_embedder.py tests/test_idempotency.py tests/test_budget.py tests/test_persist.py tests/test_vocabularies.py tests/test_contextualizer.py tests/test_contextualize_budget.py -q
49 skipped in 0.12s
PYTEST_EXIT=0
```

Acceptance criteria met:
- ✅ 10 files exist with class names matching the spec
- ✅ pytest exit 0 (skips count as pass)
- ✅ 49 skips ≥ 40 threshold
- ✅ test_chunker.py has 5 skips (≥ 5 required)
- ✅ test_embedder.py has 6 skips (≥ 6 required)
- ✅ Each test imports target module inside test body
- ✅ Skip-reason pattern `Wave 0 — flip in 06-XX-PLAN` matches grep contract for future executors

### Task 2: 4 vitest scaffolding files for apps/web/lib/rag/ + synthetic PDF fixture

Status: **complete** (commit `f242400`)

Created `apps/web/lib/rag/` directory (didn't exist before) with 4 vitest test files using `it.todo()` (vitest counts todos as pass for exit code). Total **32 todos** across the 4 files.

Per-file todo count and target plan:

| File | describe blocks | Todos | Flip plan ID | Coverage |
|------|----------------|-------|--------------|----------|
| `search.test.ts` | `retrieveRelevantKnowledge` (1) | 9 | 06-11 | RAG-04 retrieve contract + D-R3 dedup ≤30 + D-R5 latency p99≤3s + D-N4 p95≤2s + D-N2 graceful fallback + auth gate + telemetry |
| `build-queries.test.ts` | `buildFamilyA` (1) + `buildFamilyB` (1) | 9 | 06-10 | D-R2A visual findings (4) + D-R2B section templates (4) + empty edge cases |
| `score-weights.test.ts` | `applyWeights` (1) | 7 | 06-10 | D-R4 multipliers clinical_data 1.5× / alta_prioridade 1.1× / dimensoes intersect 1.2× + compounding + immutability + WEIGHTS constant exposure |
| `rerank.test.ts` | `rerankChunks` (1) | 7 | 06-11 | D-N2 voyage-rerank-2.5 reorder + graceful fallback (API error / missing key) + RERANK_MODEL env override + p95<1s latency + relevanceScore replaces score + topK default 30 |
| **Total** | **5 describe blocks** | **32** | — | — |

Fixtures committed:

- `vision-service/tests/fixtures/sample_book.txt` (1.95 KB) — synthetic 3-section iridology text:
  - CAPÍTULO I — Introdução à Iridologia (~300 words)
  - CAPÍTULO II — Setores Iridais → 1.1 Setor 7 — Fígado (~250 words)
  - 1.2 Lacunas e Criptas (~150 words, ends mid-sentence intentionally)
  - LGPD audit clean (regex `\bdiagn[óo]stico\b|\btratamento\b|\bcura\b` returns None)
  - Replaced "diagnose holística" with "eixo de avaliação holística" per plan note (no false positive on "diagnose" but neutral language is safer for canonical fixture)
  - Removed reference to "Battello" (per CONTEXT D-S2 — author does not exist; replaced with Birello)
- `vision-service/tests/fixtures/sample_book.pdf` (67 bytes) — placeholder PDF stub `%PDF-1.7\n%stub for 06-01 - regenerated in 06-04 with PyMuPDF\n%%EOF\n`. Will be regenerated as full 3-page synthetic PDF in 06-04 once PyMuPDF dependency lands in 06-03.

Verification:
```
$ cd apps/web && pnpm test:run lib/rag/
Test Files: 4 skipped (4)
Tests:      32 todo (32)
Duration:   1.82s
VITEST_EXIT=0
```

Acceptance criteria met:
- ✅ 4 files exist at `apps/web/lib/rag/{search,build-queries,score-weights,rerank}.test.ts`
- ✅ vitest exit 0
- ✅ 32 todos ≥ 30 threshold
- ✅ search.test.ts has 9 todos (≥ 9 required)
- ✅ Each todo description references the relevant decision ID (D-R2, D-R3, D-R4, D-R5, D-N1, D-N2, D-N4)
- ✅ sample_book.txt exists with the 3-chapter content
- ✅ sample_book.pdf exists (67 bytes > 0; stub OK per plan)
- ✅ LGPD vocabulary regex returns None for sample_book.txt
- ✅ vision-service `python -m scripts.audit_vocabulary` clean

## Verification Summary

| Gate | Command | Result |
|------|---------|--------|
| Pytest collection (10 files) | `cd vision-service && python -m pytest tests/test_ingest_extract.py [...] -q` | **EXIT 0** — 49 skipped |
| Vitest collection (4 files) | `cd apps/web && pnpm test:run lib/rag/` | **EXIT 0** — 32 todos, 4 file-level skips |
| LGPD audit (vision-service) | `cd vision-service && python -m scripts.audit_vocabulary` | **EXIT 0** — clean |
| LGPD regex on fixture | `python -c "import re; ... re.search(forbidden, text)"` | **EXIT 0** — None match |
| Wave 0 file count | `ls vision-service/tests/test_*.py apps/web/lib/rag/*.test.ts` | **14 files** (10 + 4) |

## Deviations from Plan

**None.** Plan executed verbatim. Two minor implementation choices noted for record:

1. **sample_book.txt**: replaced "Battello" reference (mentioned in plan template) with "Birello/Lo Rito" per CONTEXT D-S2 — Battello is a documented false-positive author name. Original plan template predates the D-S2 correction.
2. **sample_book.txt**: replaced "diagnose holística" with "eixo de avaliação holística" per plan's own NOTE on vocabulário proibido (the word `diagnose` does not match the audit regex `\bdiagn[óo]stico\b`, but neutral language is safer for the canonical fixture used by 06-04 chunker tests).

Both adjustments are documentation/copy edits — they don't affect chunking semantics, structure, or token counts of the fixture.

### Auth gates encountered

None. Task is fully local file creation.

### Pre-existing legacy items (out of scope)

- `pnpm audit:vocabulary` (apps/web tree) currently fails with 8 pre-existing matches in Phase 3 code comments — already documented in `.planning/phases/04-upload-desktop/deferred-items.md`. None of the 16 files created in this plan contribute to those failures (verified by `grep -i "rag|sample_book|test_" pnpm-audit-output` returns empty). Out of scope per Rule 1-4 deviation policy (pre-existing, not caused by this task).

## Known Stubs

- `vision-service/tests/fixtures/sample_book.pdf` (67 bytes) — intentionally a stub. Plan acceptance criteria explicitly allow it (`size > 0 — stub OK; regenerated in 06-04`). Will be replaced with a full 3-page synthetic PDF (matching sample_book.txt content) in plan 06-04 once PyMuPDF lands in 06-03.

All 49 pytest tests + 32 vitest tests are intentional Wave 0 stubs by design — the plan's contract is "RED first, GREEN as plans execute". Each subsequent plan owner knows exactly which tests to flip.

## Self-Check: PASSED

Verified all claims:

| Claim | Verification |
|-------|--------------|
| 10 pytest files exist | `ls vision-service/tests/test_{ingest_extract,chunker,books_manifest,embedder,idempotency,budget,persist,vocabularies,contextualizer,contextualize_budget}.py` → all FOUND |
| 4 vitest files exist | `ls apps/web/lib/rag/{search,build-queries,score-weights,rerank}.test.ts` → all FOUND |
| 2 fixture files exist | `ls vision-service/tests/fixtures/sample_book.{txt,pdf}` → both FOUND (1995 + 67 bytes) |
| Commit `7dd6287` exists | `git log --oneline | grep 7dd6287` → FOUND ("test(06-01): scaffold 10 pytest stubs...") |
| Commit `f242400` exists | `git log --oneline | grep f242400` → FOUND ("test(06-01): scaffold 4 vitest stubs...") |
| Pytest exit 0 | `python -m pytest [...] -q; echo $?` → 0 |
| Vitest exit 0 | `pnpm test:run lib/rag/; echo $?` → 0 |
| VALIDATION.md frontmatter updated | `head -10 06-VALIDATION.md` → `wave_0_complete: true` |
| 14 Wave 0 checkboxes flipped to [x] | grep `\[x\]` count in Wave 0 Requirements section → 14 |
