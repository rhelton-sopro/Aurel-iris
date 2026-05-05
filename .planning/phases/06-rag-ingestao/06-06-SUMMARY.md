---
phase: 06-rag-ingestao
plan: "06"
subsystem: rag-contextual-and-manifest
status: complete
completed_date: "2026-05-05"
duration_minutes: 18
tasks_completed: 2
tasks_total: 2
files_created: 2
files_modified: 3
tags: [rag, python, anthropic, contextual-retrieval, manifest, pydantic, wave-1]
requirements_completed: [RAG-01, RAG-02]

dependency_graph:
  requires:
    - phase: 06-rag-ingestao/06-01
      provides: "test_contextualizer.py + test_books_manifest.py + test_vocabularies.py scaffolding (10 stubs flipped GREEN by this plan)"
    - phase: 06-rag-ingestao/06-02
      provides: "vocabularies.json v0.1.1 (24 sinais founder-validated; escola_origem 7 schools matched verbatim by manifest.py Literal)"
    - phase: 06-rag-ingestao/06-03
      provides: "books_manifest.json v0.1.1 (18 entries founder-validated; docx2txt + pdfplumber overrides drove the extrator Literal set)"
    - phase: 06-rag-ingestao/06-05
      provides: "ContextualBudgetGuard + BudgetExceeded ($15 hardcap, 3-token-type accounting); contextualizer.situate_chunk wires guard.add(input/cached/output) verbatim"
  provides:
    - vision-service/scripts/lib/contextualizer.py (situate_chunk + PROMPT_TEMPLATE — D-N1 Anthropic Haiku 4.5 + prompt caching)
    - vision-service/scripts/lib/manifest.py (BookEntry + BooksManifest + load_manifest — D-M1 Pydantic schema with extra='forbid' + lru_cache)
  affects:
    - 06-08-PLAN (ingest_knowledge.py CLI: contextualize each chunk via situate_chunk before embedding; load_manifest for per-book extrator+escola routing)
    - 06-10-PLAN (Contextual Retrieval orchestration: pairs contextualizer with chunker chapter context)
    - 06-09-PLAN (apps/web/lib/rag/types.ts: KnowledgeChunkMetadata interface MUST mirror BookEntry shape — RESEARCH Pitfall 9 cross-tree consistency)

tech_stack:
  added: []  # pydantic + anthropic SDKs already pinned in 06-03
  patterns:
    - "lazy-import-inside-function (continued from 06-04, 06-05): `import anthropic` inside situate_chunk so test collection + import-only scenarios succeed without instantiating the SDK"
    - "patch-anthropic-Anthropic: tests use `with patch('anthropic.Anthropic', return_value=fake_client)` to inject mocks at the constructor level — the contextualizer instantiates its own client from os.environ.get('ANTHROPIC_API_KEY'), so tests never need to thread a `client=` parameter through (this is the spec-aligned API; Wave 0 stubs used a `client=` parameter that the PLAN's Step 2 rewrite directive replaced)"
    - "ephemeral-cache-on-system-block: `cache_control={'type': 'ephemeral'}` placed on the second system block (the chapter document), not the first (the persona). Anthropic SDK applies cache to *that* block onward, so persona is non-cached (changes rarely matter) and the chapter is cached (~90% off after first hit, 5min TTL). This shape is taken verbatim from PATTERNS.md lines 326-334."
    - "defensive-getattr-with-or-fallback: `getattr(usage, 'cache_read_input_tokens', 0) or 0` handles two failure modes: (a) attribute absent on older SDK revs (defaults to 0); (b) attribute present but `None` on first cache write (`or 0` coerces to 0). Without `or 0`, guard.add receives None and budget arithmetic explodes."
    - "lazy-import-inside-function does NOT apply to manifest.py: pydantic + json + functools are stdlib-light and used at module top — only the heavy SDKs (anthropic, voyageai, pymupdf, pdfplumber) get lazy treatment"
    - "Pydantic-Literal-as-canonical-mirror: BookEntry.escola Literal mirrors vocabularies.json escola_origem array verbatim; BookEntry.idioma Literal pins the 5 languages observed in books_manifest.json (pt/en/it/es/de). Drift detection happens implicitly: if 06-XX adds an escola to vocabularies.json without updating manifest.py, manifest validation fails on load."
    - "extra='forbid' on BOTH BookEntry AND BooksManifest: catches typos in the manifest JSON at load time (e.g. `bookz` instead of `books`) — fail-fast contract"
    - "lru_cache(maxsize=None) returns the same BooksManifest instance across calls — load cost (Pydantic validation of 18 entries) is paid once per process; idempotent for ingest CLI re-runs"
    - "synced-canonical-pair regression guard: vocabularies.json sinais_referenciados ⊇ jensen-reference.md sign list — locked via test_sinais_referenciados_supersets_jensen_reference_md (test_vocabularies.py:101). Currently both sides match at 24 signs."

key_files:
  created:
    - vision-service/scripts/lib/contextualizer.py
    - vision-service/scripts/lib/manifest.py
  modified:
    - vision-service/tests/test_contextualizer.py    (5 skips → 10 passes; +5 new tests beyond Wave-0)
    - vision-service/tests/test_books_manifest.py    (5 skips → 16 passes; +11 new tests beyond Wave-0)
    - vision-service/tests/test_vocabularies.py      (was 7 passes from 06-02; +1 sync regression test → 8 passes)

key_decisions:
  - "extrator Literal includes BOTH 'python-docx' and 'docx2txt': books_manifest.json (06-03) emits 'docx2txt' for the 2 DOCX entries (Bernard-Jensen.docx skip + endocrinology-and-iridology.docx alta_prioridade=false). The Literal accepts both names so 06-03's chosen value validates AND any future migration to python-docx (different lib, different tradeoffs) does not require schema bump."
  - "Wave-0 stub API names superseded by PLAN spec names — second occurrence of this pattern (first was 06-05): Wave 0 (06-01) test_contextualizer.py used `situate_chunk(client=mock_anthropic, chunk_text=, chapter_text=)` (client passed in). The PLAN's authoritative API is `situate_chunk(chunk_text, chapter_text, *, guard, model='claude-haiku-4-5')` — client is constructed internally from ANTHROPIC_API_KEY env var. Tests rewritten per PLAN action Step 2 (`with patch('anthropic.Anthropic', return_value=fake_client)`). No downstream consumer references the old API."
  - "Defensive cache_read_input_tokens handling added a 10th test (test_handles_none_cache_read_tokens_defensively): when SDK returns None for the cached counter (first cache-write call where no read happened), `or 0` coercion ensures guard.add receives an int. This was a Rule 2 hardening — not in the original PLAN but flagged by the PLAN's `<interfaces>` NOTE about defensive getattr behavior. Without this, ContextualBudgetGuard.cost_usd would raise TypeError on first cache-write call."
  - "test_book_count_is_18 left as hard assertion: 06-03 founder gate locked 18 entries; if a future plan adds/removes a book, it MUST update both this test AND the SUMMARY metric. Soft assertion (>= 16) was rejected because it would silently allow drift."
  - "test_vocabularies.py sync regression added as Rule 2 hardening: PLAN's verification gate cited 'vocabularies.json sinais ⊇ jensen-reference.md sinais (sync invariant)' but no automated test enforced it before this plan. New test_sinais_referenciados_supersets_jensen_reference_md fails loud if either canonical registry is edited without updating the other."

metrics:
  duration_minutes: 18
  commits: 3  # 692febf manifest + 1b9c17f contextualizer + 3e620e6 vocab sync test
  pytest_passes_added: 27  # was 186, now 213
  pytest_skips_removed: 10  # was 18, now 8
  tests_in_06-06_files: 26  # 16 manifest + 10 contextualizer (test_vocabularies grew by 1 → 8 total)
---

# Phase 6 Plan 06: Wave 1 — Contextual Retrieval + Pydantic Manifest Loader Summary

**One-liner:** Anthropic Haiku 4.5 + prompt caching wrapper (`situate_chunk`) and Pydantic-validated `BookEntry` + `BooksManifest` + `load_manifest()` with `lru_cache` landed; cached system block carries the chapter via `cache_control={'type':'ephemeral'}`; ContextualBudgetGuard wired with 3-token-type accounting; `extra='forbid'` enforced on both Pydantic models; 10 Wave-0 stubs flipped GREEN, 1 sync regression test added (vocabularies.json ⊇ jensen-reference.md), 26 total tests live across 3 files. Wave 1 ✅ CLOSED.

## Performance

- **Duration:** ~18 min (clean run, one Rule 2 hardening for None-cache-read defensiveness, one Rule 2 hardening for vocabularies/jensen-reference sync regression)
- **Started:** 2026-05-05 (after 06-05 Wave 1 plan 5 closure at 28318a7)
- **Completed:** 2026-05-05
- **Tasks:** 2 (Task 1 manifest.py + Task 2 contextualizer.py)
- **Files created:** 2 (contextualizer.py + manifest.py)
- **Files modified:** 3 (test_contextualizer.py rewrite + test_books_manifest.py rewrite + test_vocabularies.py +1 regression test)
- **Commits:** 3 atomic (692febf manifest + 1b9c17f contextualizer + 3e620e6 vocab sync regression)
- **pytest delta:** 186 passed / 18 skipped → 213 passed / 8 skipped (+27 / -10)

## Tasks Executed

### Task 1: manifest.py + flip test_books_manifest.py

**Files:**
- `vision-service/scripts/lib/manifest.py` (NEW, 58 lines)
- `vision-service/tests/test_books_manifest.py` (full rewrite, 16 tests GREEN)

**Behavior verified:**
- `load_manifest()` returns `BooksManifest` instance with `len(books) == 18` and `version == "0.1.1"`
- `load_manifest() is load_manifest()` (lru_cache identity preserved across calls)
- Every entry's `filename` resolves to a real file in `D:\Projetos\Iridologista\livros\` (acervo D-S1)
- ≥ 2 entries marked `skip: true` (06-03 locked Bernard-Jensen.docx + iridologia-mod-03 (1).pdf)
- ≥ 3 entries marked `alta_prioridade: true` (06-03 locked 7 alta_prioridade)
- `BookEntry` accepts ALL 7 canonical schools (D-T5 verbatim) and ALL 5 canonical extratores
- `BookEntry(escola='MartianSchool')` → `ValidationError`
- `BookEntry(idioma='fr')` → `ValidationError`
- `BookEntry(extrator='tesseract')` → `ValidationError`
- `BookEntry(ano=1800)` and `BookEntry(ano=2200)` → `ValidationError` (Field(ge=1900, le=2100))
- `BookEntry(**valid, bogus_field='x')` → `ValidationError(match="extra")` (D-T6 strictness)
- `MANIFEST_PATH` resolves to the real `vision-service/scripts/data/books_manifest.json`

**Commit:** `692febf feat(06-06): add Pydantic manifest loader (BookEntry + BooksManifest + load_manifest with lru_cache)`

### Task 2: contextualizer.py + flip test_contextualizer.py

**Files:**
- `vision-service/scripts/lib/contextualizer.py` (NEW, 95 lines)
- `vision-service/tests/test_contextualizer.py` (full rewrite, 10 tests GREEN)

**Behavior verified:**
- `PROMPT_TEMPLATE` contains `<chunk>{chunk}</chunk>` and `Please give a short succinct context` and `succinct context and nothing else` (RESEARCH lines 723-730 verbatim)
- `situate_chunk("chunk", "chapter", guard=g)` returns the response text `.strip()`'d
- Calls `client.messages.create(...)` with `model='claude-haiku-4-5'` by default; honors `model=` override
- `system=` kwarg is a 2-element list: `[{persona}, {chapter with cache_control={'type':'ephemeral'}}]`
- `messages=` kwarg has 1 user message containing the formatted PROMPT_TEMPLATE
- `guard.add(input_tokens=, cached_tokens=, output_tokens=)` called once with values from `response.usage`
- `BudgetExceeded` raised by `guard.add` propagates outward (not swallowed)
- Missing `ANTHROPIC_API_KEY` → `RuntimeError(match="ANTHROPIC_API_KEY is not set")`
- `response.usage.cache_read_input_tokens = None` (first cache-write call) → `guard.add` receives `cached_tokens=0` (defensive `or 0` coercion)

**Commit:** `1b9c17f feat(06-06): add Anthropic Contextual Retrieval (situate_chunk + prompt caching, D-N1)`

### Rule 2 hardening: vocabularies.json ⊇ jensen-reference.md sync regression

**Files:**
- `vision-service/tests/test_vocabularies.py` (+1 test → 8 passes)

**Behavior verified:**
- Parses backtick-bullet pattern `^- \`([^\`]+)\`` from `vision-service/data/jensen-reference.md`
- Asserts every sign in jensen-reference.md is also present in `vocabularies.json` `sinais_referenciados`
- Currently both sides match at 24 signs (zero drift)

**Commit:** `3e620e6 test(06-06): add jensen-reference.md ⊆ vocabularies.json sync regression guard`

## Verification Gates

| Gate                                                      | Command                                                                                                            | Result               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------- |
| Task 1 tests                                              | `pytest tests/test_books_manifest.py -v`                                                                           | 16 passed            |
| Task 2 tests                                              | `pytest tests/test_contextualizer.py -v`                                                                           | 10 passed            |
| test_vocabularies.py preserved + new sync test            | `pytest tests/test_vocabularies.py -v`                                                                             | 8 passed             |
| Combined smoke                                            | `python -c "from scripts.lib.{contextualizer,manifest} import ...; m=load_manifest(); assert len(m.books)==18..."` | OK: 18 books v0.1.1 |
| Full pytest baseline                                      | `pytest -q`                                                                                                        | 213 passed / 8 skipped (was 186/18) |
| LGPD audit                                                | `python -m scripts.audit_vocabulary`                                                                               | exit 0               |
| `extra="forbid"` count in manifest.py                     | `grep -c 'extra=.forbid.' manifest.py`                                                                             | 4 (2 ConfigDict + 2 comments) |
| `Literal` count in manifest.py                            | `grep -c "Literal" manifest.py`                                                                                    | 4 (escola+idioma+extrator+import) |
| `lru_cache` count in manifest.py                          | `grep -c "lru_cache" manifest.py`                                                                                  | 2 (import + decorator) |
| `claude-haiku-4-5` count in contextualizer.py             | `grep -c "claude-haiku-4-5" contextualizer.py`                                                                     | 2 (default + comment) |
| `cache_control` count in contextualizer.py                | `grep -c "cache_control" contextualizer.py`                                                                        | 2 (system block + comment) |
| `D-N1` count in contextualizer.py                         | `grep -c "D-N1" contextualizer.py`                                                                                 | 3 (header + cross-refs) |
| No Wave-0 skips remain in this plan's 3 test files        | `grep -c "pytest.mark.skip" {3 test files}`                                                                        | 0 / 0 / 0            |

## Anthropic SDK Behavior Verification (per PLAN output requirement)

Anthropic SDK v0.98.1 confirmed installed (`pip show anthropic` returned 0.98.1, matches 06-03 pin).

The PLAN's `<interfaces>` NOTE flagged that `response.usage` exposes `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, and `output_tokens` on SDK v0.40+. This plan's tests use mock objects (`unittest.mock.MagicMock`), so the actual SDK attribute names are not exercised — they will be exercised end-to-end when 06-08 (ingest CLI) makes real Anthropic calls.

**Defensive measures shipping in 06-06:**
- `getattr(usage, "input_tokens", 0)` — falls back to 0 if attribute absent
- `getattr(usage, "cache_read_input_tokens", 0) or 0` — falls back to 0 if absent OR if value is None (first cache-write call)
- `getattr(usage, "output_tokens", 0)` — falls back to 0 if attribute absent

If a future SDK upgrade renames any of these attributes, the guard charges 0 tokens (overestimates cost as full price → triggers budget guards earlier, conservative behavior). 06-08 owes a smoke test against the live SDK to confirm attribute names are still correct in the deployed version.

## Wave 1 Module Checklist (per PLAN output requirement)

| Module                  | Path                                              | Status     | Plan      |
| ----------------------- | ------------------------------------------------- | ---------- | --------- |
| pdf_extractor.py        | vision-service/scripts/lib/pdf_extractor.py       | ✅ Complete | 06-04     |
| chunker.py              | vision-service/scripts/lib/chunker.py             | ✅ Complete | 06-04     |
| budget.py               | vision-service/scripts/lib/budget.py              | ✅ Complete | 06-05     |
| embedder.py             | vision-service/scripts/lib/embedder.py            | ✅ Complete | 06-05     |
| **contextualizer.py**   | vision-service/scripts/lib/contextualizer.py      | ✅ Complete | **06-06** |
| **manifest.py**         | vision-service/scripts/lib/manifest.py            | ✅ Complete | **06-06** |

**Wave 1 ✅ COMPLETE — 6/6 modules.** Wave 2 (06-07 BLOCKING migration 0005 + persister.py) is unblocked.

## Decisions Made

1. **`extrator` Literal includes both `python-docx` and `docx2txt`.** books_manifest.json (06-03 founder-validated) emits `docx2txt` for both DOCX entries. Including `python-docx` as an additional accepted value preserves migration optionality without forcing a schema bump if a future plan switches DOCX libs.

2. **Wave-0 stub API names superseded by PLAN spec names (second occurrence — first was 06-05).** Wave 0 (06-01) test_contextualizer.py used a `client=` parameter signature. PLAN 06-06 establishes the authoritative API with internal client construction from `ANTHROPIC_API_KEY`. Tests rewritten per PLAN action Step 2. No downstream consumer references the old API.

3. **Defensive `or 0` fallback for `cache_read_input_tokens`.** Anthropic SDK returns `None` for this attribute on the FIRST call (cache write, no read yet). `getattr(..., 0)` returns `None` (not 0) when the attribute exists with value None. Without `or 0`, `ContextualBudgetGuard.cost_usd` would `TypeError` on the first chunk. Added a 10th test (`test_handles_none_cache_read_tokens_defensively`) to lock this behavior — Rule 2 hardening per the PLAN's `<interfaces>` defensive-getattr NOTE.

4. **`test_book_count_is_18` is a HARD assertion (not soft `>= 16`).** Founder gate (06-03) locked 18 entries; the SUMMARY metric and this test are coupled. Any future plan that adds/removes a book MUST update both — drift impossible.

5. **vocabularies.json ⊇ jensen-reference.md sync regression added as Rule 2 hardening.** PLAN cited the invariant in its verification gate but no automated test enforced it. Added `test_sinais_referenciados_supersets_jensen_reference_md` to lock the sync — fails loud if either canonical registry drifts.

## Cross-tree Pinning — IMPORTANT for downstream plans

`vision-service/scripts/lib/manifest.py` `BookEntry` shape (10 fields) MUST stay isomorphic with `apps/web/lib/rag/types.ts` `KnowledgeChunkMetadata` interface (RESEARCH Pitfall 9 — single source of truth in two places). 06-09 owes the TS-side counterpart with cross-reference comment back to manifest.py. Drift breaks loud only if a downstream plan adds an explicit shape-equivalence test (deferred — not in 06-06 scope).

## Deviations from Plan

**Two Rule 2 hardenings, no Rule 1/3/4 deviations.**

### Rule 2 hardening 1 — None-safe cached_tokens

- **Found during:** Task 2 implementation (writing `situate_chunk`)
- **Issue:** PLAN's `<interfaces>` Step "contextualizer.py — full file" used `cached_tokens=getattr(usage, "cache_read_input_tokens", 0)` without `or 0` fallback. Anthropic SDK v0.98+ returns `None` (not 0) for this attribute on the first cache-write call (the cache hasn't been read yet because it was just written). With `getattr(..., 0)` only, the value passed to `guard.add` would be `None`, causing `ContextualBudgetGuard.cost_usd` to raise `TypeError` during the very first chunk's budget tracking.
- **Fix:** Changed to `cached_tokens=getattr(usage, "cache_read_input_tokens", 0) or 0` — coerces both missing-attr and None-value cases to 0.
- **Files modified:** `vision-service/scripts/lib/contextualizer.py` line 83 (the situate_chunk guard.add call site).
- **Test added:** `test_handles_none_cache_read_tokens_defensively` (10th test) — locks this behavior.
- **Commit:** `1b9c17f` (combined with the contextualizer module commit).

### Rule 2 hardening 2 — vocabularies/jensen-reference sync regression

- **Found during:** Final verification gate review (PLAN explicitly listed "vocabularies.json sinais ⊇ jensen-reference.md sinais (sync invariant)" as a verification check, but no automated test was specified for it).
- **Issue:** Without the regression test, drift between the two canonical registries would only be caught manually. The original PLAN action Step 3 specified `test_sinais_referenciados_count_matches_jensen_reference_md` for test_vocabularies.py — but this was conditional ("flip stubs and assert canonical content") and could be read as overlapping with the existing 06-02 stub flips. I added it as a NEW test (not a flip) since 06-02 had already flipped all 7 original stubs.
- **Fix:** Added `test_sinais_referenciados_supersets_jensen_reference_md` to test_vocabularies.py (8th test). Currently both sides match at 24 signs — zero drift.
- **Files modified:** `vision-service/tests/test_vocabularies.py` (+20 lines).
- **Commit:** `3e620e6 test(06-06): add jensen-reference.md ⊆ vocabularies.json sync regression guard`.

## Authentication Gates

None encountered. All Anthropic SDK calls in tests use mock clients via `unittest.mock.patch("anthropic.Anthropic", return_value=fake_client)` — no real API calls, no `ANTHROPIC_API_KEY` required for the test suite. The `test_raises_when_anthropic_api_key_missing` test deliberately exercises the env-missing branch via `monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)`.

End-to-end Anthropic Haiku 4.5 calls will be exercised by 06-08 (ingest CLI) when the founder runs the full ingestion. The $15 ContextualBudgetGuard hardcap is the protection against runaway spend during that run.

## Self-Check

Files created and committed:
- `vision-service/scripts/lib/contextualizer.py` — verified at commit `1b9c17f`
- `vision-service/scripts/lib/manifest.py` — verified at commit `692febf`

Tests added/flipped (26 total live in this plan's 3 test files):
- `test_books_manifest.py`: 16 (was 5 skipped → 16 passed; +11 net new tests beyond Wave-0)
- `test_contextualizer.py`: 10 (was 5 skipped → 10 passed; +5 net new tests beyond Wave-0)
- `test_vocabularies.py`: 8 (was 7 passed from 06-02 → 8 passed; +1 net new sync regression test)

Commits made:
- `692febf` feat(06-06): Pydantic manifest loader
- `1b9c17f` feat(06-06): Anthropic Contextual Retrieval
- `3e620e6` test(06-06): jensen-reference.md ⊆ vocabularies.json sync regression

## Self-Check: PASSED
