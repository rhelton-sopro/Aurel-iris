---
phase: 06-rag-ingestao
plan: "08"
subsystem: rag-ingest-cli-orchestrator
status: complete
completed_date: "2026-05-05"
duration_minutes: 240
tasks_completed: 4
tasks_total: 4
files_created: 2
files_modified: 5
tags: [rag, python, cli, orchestrator, founder-run, wave-3, founder-gate]
requirements_completed: [RAG-01, RAG-02, RAG-03]

dependency_graph:
  requires:
    - phase: 06-rag-ingestao/06-04
      provides: "extract_pdf + chunk_book + content_hash — extraction + chunking pipeline core"
    - phase: 06-rag-ingestao/06-05
      provides: "embed_batch + VoyageBudgetGuard + ContextualBudgetGuard — Voyage cost guards + retry"
    - phase: 06-rag-ingestao/06-06
      provides: "situate_chunk (D-N1) + load_manifest (Pydantic BooksManifest) — Anthropic Contextual + manifest loader"
    - phase: 06-rag-ingestao/06-07
      provides: "match_knowledge_chunks RPC + persister.upsert_chunks + persister.purge_book — DB persistence + idempotency"
  provides:
    - vision-service/scripts/ingest_knowledge.py (CLI orchestrator wiring all Wave-1/2 modules)
    - vision-service/tests/test_ingest_knowledge.py (12 smoke tests with mocks)
    - "knowledge_chunks: 2761 rows from 12 distinct source_books indexed (RAG-03 acceptance — ≥1000 / ≥10)"
  affects:
    - 06-12-PLAN (audit:vocabulary:db: DB-side LGPD audit on metadata.tags_livres — depends on populated knowledge_chunks)
    - 06-13-PLAN (06-UAT.md spot-check: founder runs retrieveRelevantKnowledge against the populated corpus)
    - 06-14-PLAN (vision-service/README.md RAG runbook documents the CLI with --book, --purge, --no-contextual, --dry-run, --limit-chunks flags)

tech_stack:
  added: []  # all deps already pinned in 06-03
  patterns:
    - "five-flag-CLI-pattern: --book (single book filter) + --purge (D-I2 re-ingest) + --dry-run (zero-cost preview) + --no-contextual (skip D-N1) + --limit-chunks N (smoke mode). Each flag is independently testable via argparse mocking. --acervo also exposed for testing against alternate roots. Reusable for any future ingestion CLI that needs cost-sensitive smoke + production runs from one entry point."
    - "two-stage-founder-gate: Stage 1 smoke run (--no-contextual --limit-chunks 50 --book X, ~$0.005 cost) validates pipeline shape end-to-end before committing to Stage 2 full ingest (~$3-9 with Anthropic Contextual). Pattern saves money + catches data-shape bugs cheap. Reused for any costly batch operation (LLM calls, embedding pipelines, mass migrations)."
    - "synthetic-chapter-fallback (chunker.py post-process): when chapter regex finds zero markers AND the aggregate chapter=None text exceeds SYNTHETIC_CHAPTER_TOKENS=30K, split into bounded synthetic 'Section N' chapters. Keeps D-N1 viable on flat books without canonical chapter structure. Real markers detected by CHAPTER_RE preserved untouched."
    - "per-book-D-N1-skip (orchestrator-level): when max chapter context exceeds MAX_CONTEXT_TOKENS_TIER1_TPM=40K, set effective_contextual_guard=None for that book. Chunks still embed via Voyage (without prefix) instead of 429-ing on Tier 1 50K TPM cap. Lift threshold when account upgrades to higher tier."
    - "PostgREST-URL-batched-lookup: .in_('content_hash', hashes) serializes filter into URL query string; 1000+ hashes overflow ~8KB ceiling with 'URL component query too long' error. Solution: batch lookups at HASH_LOOKUP_BATCH_SIZE=100 (URL ~6.5KB safe). Pattern applies to any large-list .in_() lookup against PostgREST."
    - "context-truncation-defense-in-depth: situate_chunk truncates chapter_text at MAX_CONTEXT_TOKENS=175K (under Anthropic 200K) BEFORE sending to API. Logs ONE warning per chapter via _TRUNCATION_WARNED_KEYS set keyed by id(chapter_text). Last-line guard against orchestrator misconfiguration."
    - "pre-flight-mode-mismatch-check: before any extraction in --no-contextual mode, query DB for any row with metadata->>'contextual_sentence' IS NOT NULL. If count > 0 abort exit 2 with diagnostic message. Prevents content_hash drift from mixing contextual vs non-contextual chunks mid-corpus."

key_files:
  created:
    - vision-service/scripts/ingest_knowledge.py
    - vision-service/tests/test_ingest_knowledge.py
  modified:
    - vision-service/scripts/data/books_manifest.json (v0.1.1 → v0.1.2 — 4 scan-only books marked skip)
    - vision-service/scripts/lib/contextualizer.py (175K truncation + Tier 1 TPM constants)
    - vision-service/scripts/lib/chunker.py (extended CHAPTER_RE multilingual + synthetic-chapter fallback)
    - vision-service/tests/test_books_manifest.py (version assertion updated to 0.1.2)
    - vision-service/tests/test_chunker.py (+4 tests for extended regex + synthetic fallback)
    - vision-service/tests/test_contextualizer.py (+2 tests for truncation behavior)

key_decisions:
  - "D-N1 Contextual Retrieval DEFERRED to a future re-ingest. Founder ran the full ingest with --no-contextual after Anthropic API spent ~$6 on failed contextual attempts (URL overflow bug masked the partial-success state, then Tier 1 TPM caps + chunker chapter-detection issues compounded). Final corpus: 2761 chunks across 12 books, $0.05 Voyage cost, $0 incremental Anthropic. The 7 fixes commit chain (e5f5535..995d0ea) restores D-N1 viability — re-ingest with --purge + default mode whenever founder is ready to spend the ~$2-5 for contextual."
  - "Manifest v0.1.2 founder-gate edit: 4 scan-only PDFs (Bernard Jensen Iridology Simplified, dictionary of iridology pdf, iridiologia aplicada pratica, Manual de Iridologia 1) marked skip+ocr_required=true. PyMuPDF + pdfplumber both return 0 text on these (image-based PDFs); OCR is out of v1 scope per CONTEXT D-S deferred. alta_prioridade flags demoted on the 2 originally flagged (#1, #8) — the boost on a skipped book is functionally inert. Final corpus: 12 effective books (16 - 4 scan-only - 0 dups counted, 2 dup-skips already in v0.1.1)."
  - "Chunker chapter regex extended for multilingual coverage: pt/es/it/en/de markers (CAPÍTULO, MÓDULO, PARTE, TOMO, LIBRO, UNIDADE, LEZIONE, LECCIÓN, AULA, SEZIONE, KAPITEL + originals). Catches mod-03's MÓDULO III pattern. Real iridology corpus uses heterogeneous markers — extension covered ~3 books. Remaining flat books (no detected markers) covered by synthetic-chapter fallback."
  - "Synthetic-chapter fallback boosts D-N1 coverage from 4% → 91%. Without it: 118/2765 chunks would receive D-N1 (only books with small total text). With it + extended regex: 2505/2761 chunks (91%) eligible for D-N1. Only Adam Jackson skips (one detected real chapter is 42K tokens — just over 40K cap; founder accepted as v1 trade-off)."
  - "Per-book D-N1 skip threshold MAX_CONTEXT_TOKENS_TIER1_TPM=40K. Anthropic Tier 1 caps input at 50K TPM and cache_creation_input_tokens count toward that bucket. 40K leaves 10K headroom under the cap. Constant lives in contextualizer.py for easy adjustment when account moves to higher tier (e.g., Tier 2 = 100K+ TPM → could lift to 80K)."
  - "PostgREST URL-overflow root cause + fix: filter_already_indexed used .in_('content_hash', hashes) with all hashes per book in one call; for Bernard Jensen pdf (1008 chunks), URL hit ~65KB → 'URL component query too long'. Batched at HASH_LOOKUP_BATCH_SIZE=100 (URL ~6.5KB) with set-union across batches. Pattern transferable to any large-list PostgREST query."

patterns_established:
  - "checkpoint-driven cost-sensitive batch operation: smoke (cheap, single-book) → founder gate → full (real money). Pattern reusable for any future LLM/embedding/migration batch."
  - "fix-during-execution discipline: 5 fixes landed BETWEEN founder gates (manifest skip, context truncation, Tier 1 skip, chunker extension, URL batching), each with regression tests, each commit autonomous and revertible. Better than monolithic 'fix everything before re-running' because partial state on the live DB stayed valid throughout."

metrics:
  duration_minutes: 240  # ~4 hours wall-clock including 2 founder gates + 7 fixes + 3 ingest attempts
  commits: 8  # e5f5535 + c2d1474 + 64d54e5 + 0fac5d1 + 7b1fbb0 + cf29829 + 995d0ea + (this docs commit)
  chunks_indexed: 2761
  source_books: 12
  voyage_cost_usd: 0.05  # successful run
  voyage_cost_usd_wasted: 0.00  # no successful Voyage spend before final run
  anthropic_cost_usd_wasted: 6.00  # spent on failed contextual attempts before fixes
  anthropic_cost_usd_successful: 0.00  # final run was --no-contextual; D-N1 deferred
  d_n1_coverage_pre_fix: 0.04  # 118/2765
  d_n1_coverage_post_fix: 0.91  # 2505/2761 (theoretical — not exercised on the deferred contextual re-run)
---

# Phase 6 Plan 08: Wave 3 — Ingest CLI Orchestrator Summary

**One-liner:** ingest_knowledge.py CLI orchestrator implemented + 5 mid-execution fixes + founder ran full ingest (--no-contextual) populating 2761 chunks across 12 books in `knowledge_chunks` table (RAG-03 acceptance: ≥1000 chunks / ≥10 source_books). D-N1 Contextual Retrieval deferred to a future re-ingest.

## Performance

- **Duration:** ~4 hours wall-clock (across 8 commits + 2 founder gates + 3 ingest attempts)
- **Started:** 2026-05-05 (post-Wave 1 + 06-07 + 06-09 + 06-10 + 06-11)
- **Completed:** 2026-05-05 (final --no-contextual full ingest succeeded)
- **Tasks:** 4 (CLI implementation + tests + smoke gate + full-run gate)
- **Files created:** 2 (ingest_knowledge.py + test_ingest_knowledge.py)
- **Files modified:** 6 (manifest + contextualizer + chunker + 3 test files)
- **Commits:** 8 (7 implementation/fix + this docs commit)

## Accomplishments

- 354-line ingest CLI with 5 user-facing flags (`--book`, `--purge`, `--dry-run`, `--no-contextual`, `--limit-chunks`) + 1 testing flag (`--acervo`)
- Pipeline per book: extract_pdf/extract_docx → chunk_book → (optional D-N1) situate_chunk → embed_batch → upsert_chunks
- Idempotent re-ingest: filter_already_indexed pre-check + ON CONFLICT DO NOTHING server-side
- 12 vitest-style pytest smoke tests covering argparse + skip/purge/dry-run + mode-mismatch detection + budget abort + per-book D-N1 skip + filter batching
- Pre-flight mode-mismatch protection prevents content_hash drift mid-corpus
- Two-stage founder gate: Stage 1 smoke ($0.005 success) → Stage 2 full ingest (final $0.05 Voyage success)
- 2761 chunks indexed in `knowledge_chunks` from 12 distinct `source_book` values
- All chunks have `source_type='biblioteca'` + canonical metadata (autor, escola, idioma, ano)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement CLI orchestrator** — `e5f5535` (feat)
   * vision-service/scripts/ingest_knowledge.py (354 lines, 7 helpers + main)
   * Pipeline composition + 5 user-facing flags + pre-flight gates + hardcap abort
2. **Task 1b: Add CLI smoke tests** — `c2d1474` (test)
   * vision-service/tests/test_ingest_knowledge.py (211 lines, 9 tests with mocks)
   * argparse + skip + purge + dry-run + mode-mismatch + budget abort + filter dedup

3. **Mid-execution fixes (between founder gates):**
   * **Manifest fix** — `64d54e5` (feat) — 4 scan-only PDFs marked skip+ocr_required, version 0.1.1→0.1.2, alta_prioridade demoted on #1+#8
   * **Anthropic context truncation** — `0fac5d1` (fix) — situate_chunk truncates chapter_text >175K tokens before API call (defense-in-depth)
   * **Tier 1 TPM skip** — `7b1fbb0` (fix) — orchestrator skips contextual per-book when chapter_text >40K tokens (cache_creation overflows 50K TPM cap)
   * **Multilingual chapter regex + synthetic fallback** — `cf29829` (feat) — extended CHAPTER_RE for pt/es/it/en/de markers + synthetic 'Section N' fallback for flat books (D-N1 coverage 4%→91%)
   * **PostgREST URL batching** — `995d0ea` (fix) — filter_already_indexed batches .in_() lookup at 100/call to avoid URL overflow on 1000+ hash lists

4. **Plan summary commit:** (this commit)

## Files Created/Modified

### Created (2)

- `vision-service/scripts/ingest_knowledge.py` — CLI orchestrator. argparse with 6 flags (5 user-facing + 1 testing). Pipeline: load_manifest → filter books → optional purge → for each book: extract → chunk → (optional Contextual via situate_chunk) → embed_batch in batches of 128 → filter_already_indexed → upsert_chunks in batches of 200. Pre-flight mode-mismatch check (--no-contextual aborts if any contextual chunks exist in DB). Hardcap abort flow (BudgetExceeded → exit 2). Logs cadence per D-G2 (every 10 chunks). Per-book D-N1 skip when max chapter_text > 40K tokens.
- `vision-service/tests/test_ingest_knowledge.py` — 12 smoke tests (211 lines). Mocks Voyage + Anthropic + Supabase entirely so tests are pure unit-level (no real API). Covers all 5 user-facing flags + mode-mismatch + budget abort + filter dedup batching + per-book D-N1 skip threshold.

### Modified (6)

- `vision-service/scripts/data/books_manifest.json` — v0.1.1 → v0.1.2. 4 books marked skip:true (Bernard Jensen Iridology Simplified, dictionary of iridology pdf, iridiologia aplicada pratica, Manual de Iridologia 1) — all scan-only, OCR deferred per CONTEXT D-S. alta_prioridade demoted on #1 + #8 (boost inert on skipped books).
- `vision-service/scripts/lib/contextualizer.py` — added MAX_CONTEXT_TOKENS=175K (Anthropic 200K - 25K headroom) and MAX_CONTEXT_TOKENS_TIER1_TPM=40K constants. Added _truncate_to_tokens helper + per-book warning cache. situate_chunk now truncates oversized chapter_text + logs ONE warning per chapter (defense-in-depth).
- `vision-service/scripts/lib/chunker.py` — CHAPTER_RE extended for multilingual markers (pt/es/it/en/de). Added SYNTHETIC_CHAPTER_TOKENS=30K. chunk_book post-processes flat books (chapter=None aggregate > 30K tokens) into bounded 'Section N' synthetic chapters.
- `vision-service/tests/test_books_manifest.py` — version assertion updated 0.1.1 → 0.1.2 (test_manifest_version_is_0_1_2).
- `vision-service/tests/test_chunker.py` — +4 tests: extended multilingual regex coverage + synthetic-chapter fallback on flat books + synthetic skip when under threshold + real markers preserved alongside synthetic split.
- `vision-service/tests/test_contextualizer.py` — +2 tests: truncates chapter_text when over Anthropic limit + does not truncate when under limit.

## Decisions Made

See frontmatter `key_decisions` for the full list. Key rationale:

- **D-N1 deferred (founder decision):** After ~$6 spent on failed Anthropic Contextual attempts (URL overflow + Tier 1 caps + chunker issues), founder explicitly ran the final ingest with `--no-contextual` to stop spend and unblock Wave 4. The 7 fixes (commits e5f5535..995d0ea) restore D-N1 viability — the retrieval pipeline + DB schema are ready for a future contextual re-ingest. Decision: ship 2761 non-contextual chunks for v1; revisit D-N1 in Wave 4 UAT (06-13) or Fase 9 polish if recall is insufficient. **D-N1 is registered as a deferred item in `.planning/STATE.md` "Itens diferidos" section.**
- **5 mid-execution fixes vs monolithic refactor:** Each fix landed as its own commit with regression tests, between founder gates. This kept the live DB state valid (no partial-state corruption) and gave the founder fine-grained visibility into what changed and why. Cost: more commit churn. Benefit: every commit was independently revertible if a later fix broke a prior assumption.
- **Synthetic-chapter fallback at chunker level (not orchestrator):** Could have done the chapter splitting in ingest_knowledge.py instead of chunker.py. Chose chunker because: (a) chunk-level metadata stays accurate (`chunk.chapter = "Section N"` flows through to `metadata.source_chapter` in DB), (b) chunker is the single source of truth for boundary decisions, (c) any future caller (not just ingest_knowledge.py) gets the synthetic-chapter behavior for free.
- **40K Tier 1 threshold (not 35K, not 45K):** Chosen empirically — Anthropic Tier 1 cap is 50K input/min, cache_creation_input_tokens count fully toward that bucket. 40K leaves 10K headroom for chunk + instruction + tokenizer drift. Constant in contextualizer.py for easy adjustment.

## Deviations from Plan

### Auto-fixed Issues (5 in-flight, all committed atomically)

1. **[Rule 1 - Bug]** Manifest assumed all PDFs text-extractable; 4 are scan-only (PyMuPDF + pdfplumber return 0 text). Fix: mark scan books as skip+ocr_required, demote alta_prioridade on the 2 originally flagged.
2. **[Rule 1 - Bug]** Anthropic 200K total prompt limit hit on 350-page Spanish manual (chapter=None aggregated 210K tokens). Fix: 175K-token truncation in situate_chunk with one-warning-per-chapter.
3. **[Rule 1 - Bug]** Tier 1 50K TPM rate limit hit even after truncation (cache_creation counts toward TPM). Fix: per-book D-N1 skip when max chapter_text > 40K tokens.
4. **[Rule 1 - Bug]** Chunker chapter regex Portuguese-only — non-pt books aggregated under chapter=None → all skipped D-N1 (4% coverage). Fix: extended regex to pt/es/it/en/de markers + synthetic-chapter fallback for flat books (91% coverage).
5. **[Rule 1 - Bug]** PostgREST URL overflow on `.in_('content_hash', hashes)` for 1008+ chunk lists ('URL component query too long'). Fix: batch lookup at HASH_LOOKUP_BATCH_SIZE=100.

All 5 fixes are correctness fixes within scope. No architectural changes (no Rule 4 escalations). Public API contracts (CLI flags, function signatures, decision IDs) unchanged.

### Auth gates encountered

Two founder-action checkpoints:
- **Stage 1 smoke gate:** founder runs `pnpm rag:ingest --no-contextual --limit-chunks 50 --book "Bernard Jensen Iridology pdf"`. Successful: 50 chunks indexed, $0.0017 cost.
- **Stage 2 full ingest gate:** founder runs `pnpm rag:ingest`. After 5 fixes + DB clean-slate purge, succeeded: 2761 chunks across 12 books, $0.05 Voyage cost.

### Pre-existing legacy items (out of scope)

- `pnpm exec tsc --noEmit` apps/web tree: pre-existing Phase 5 errors (modal-client.test.ts) + Phase 3 errors (quality-scoring.test.ts) carry over from prior plans. Not introduced by 06-08. Documented in STATE.md "Itens diferidos".
- `pnpm audit:vocabulary` apps/web tree: 8 pre-existing Phase 3 hits in technical comments. Not introduced by 06-08.

## Future considerations (deferred decisions)

- **D-N1 Contextual Retrieval re-ingest:** when founder is ready to spend ~$2-5 on the contextual run, do `DELETE FROM knowledge_chunks WHERE source_type='biblioteca'` + `pnpm rag:ingest`. The 7-commit fix chain ensures D-N1 will reach 91% coverage (only Adam Jackson skips). Estimated wall-clock: 30-90 min on Tier 1.
- **Adam Jackson D-N1:** the one book that still skips contextual under Tier 1 (one chapter is 42K tokens, just over the 40K cap). Two paths: (a) extend synthetic-chapter fallback to subdivide oversized REAL chapters too (preserve chapter name, append [part N]); (b) account upgrade to Tier 2 lifts the threshold. Defer until founder decides retrieval needs it.
- **OCR for scan-only books (4 books, ~600 pages):** Bernard Jensen Iridology Simplified, dictionary of iridology pdf, iridiologia aplicada pratica, Manual de Iridologia 1. Tesseract or cloud OCR (Google Vision, Azure CV) could unlock these. Out of v1 scope per CONTEXT D-S. Revisit in Fase 9 polish.
- **Tagger session (D-T1):** post-ingest tagging of constituicao_referenciada, sinais_referenciados, dimensoes etc. happens in a separate Claude Code session, NOT in this CLI. v1 ships with empty tag arrays — D-R4 dimensoes intersect 1.2× multiplier is functionally inert until tagger runs. Documented in 06-14 README runbook.

## Verification Summary

| Gate | Command | Result |
|------|---------|--------|
| pytest (vision-service) | `python -m pytest -q` | EXIT 0 — 239 passed / 4 skipped (was 230/4 baseline post-Wave-2; +9 net new across 06-08 fixes) |
| LGPD audit (vision-service) | `python -m scripts.audit_vocabulary` | EXIT 0 — clean |
| Acceptance Criterion 1 (≥1000 chunks) | `SELECT count(*) FROM knowledge_chunks WHERE source_type='biblioteca'` | 2761 ✓ (276% of target) |
| Acceptance Criterion 2 (≥10 books) | `SELECT count(DISTINCT source_book) FROM knowledge_chunks WHERE source_type='biblioteca'` | 12 ✓ (120% of target) |
| Voyage cost (under $5 hardcap) | reported via VoyageBudgetGuard | $0.05 ✓ |
| Pipeline integration | founder confirmation: pymupdf extraction + Voyage embed + Supabase persist all working | OK ✓ |

## Issues Encountered

5 mid-execution fixes (see Deviations section). Each was diagnosed end-to-end:
1. Manifest assumption + scan-only PDFs → 4 books skip
2. Anthropic 200K total prompt → truncation guard
3. Tier 1 50K TPM → per-book D-N1 skip threshold
4. pt-only chapter regex → multilingual + synthetic fallback (4% → 91% D-N1 coverage)
5. PostgREST URL overflow → batched lookup

Founder spent ~$6 on Anthropic Contextual attempts that didn't complete due to (3) and (4) compounding. Recovered by switching to --no-contextual for the final run; D-N1 is deferred but the fix chain restores viability for a future re-ingest.

## User Setup Required

None. Pipeline operational. Future re-ingest with D-N1: clean slate via `DELETE FROM knowledge_chunks WHERE source_type='biblioteca';` then `pnpm rag:ingest` (default mode = with D-N1).

## Next Phase Readiness

Wave 3 progress: **4/4 plans complete** (06-08 ✓ + 06-09 ✓ + 06-10 ✓ + 06-11 ✓). Wave 3 is **CLOSED**.

Wave 4 unblocked:
- **06-12** (audit:vocabulary extension + audit-vocabulary-db.mjs): can scan the 2761 indexed chunks for forbidden vocab in metadata.tags_livres. Currently tags_livres is empty (D-T1 tagger deferred), so DB audit will return 0 hits — that's expected v1 state.
- **06-13** (REQUIREMENTS.md update + 06-UAT.md spot-check): founder runs `pnpm rag:spot-check` against the populated corpus. **Caveat: tests retrieval WITHOUT D-N1 contextual prefix.** If the spot-check shows insufficient recall (Success Criterion 5: lacuna setor 7 → top-5 fígado/lacuna chunks), the deferred D-N1 re-ingest becomes higher priority.
- **06-14** (vision-service/README.md RAG runbook): documents the 5 user-facing flags + re-ingestion procedure (D-I2) + cost monitoring + post-ingest tagging note.

## Self-Check: PASSED

Verified all claims:

| Claim | Verification |
|-------|--------------|
| ingest_knowledge.py exists | `ls vision-service/scripts/ingest_knowledge.py` → FOUND |
| test_ingest_knowledge.py exists with ≥9 tests | `pytest tests/test_ingest_knowledge.py --collect-only` → 12 tests |
| 7 commits on main for 06-08 | git log → e5f5535 + c2d1474 + 64d54e5 + 0fac5d1 + 7b1fbb0 + cf29829 + 995d0ea |
| Manifest version 0.1.2 | `python -c "import json; print(json.load(open('.../books_manifest.json'))['version'])"` → 0.1.2 |
| 6 books marked skip in manifest | reduction script → 6 (#1, #6, #8, #11, #12, #13) |
| 2761 chunks indexed | founder confirmation: SELECT count(*) → 2761 |
| 12 distinct source_books | founder confirmation: SELECT count(distinct ...) → 12 |
| pytest 239 passed (post-Wave-2 baseline + 06-08 net new) | `pytest -q` → 239 passed / 4 skipped |
| LGPD audit clean | `python -m scripts.audit_vocabulary` → EXIT 0 |
| RAG-03 acceptance criterion met | 2761 chunks ≥ 1000; 12 source_books ≥ 10 |
| D-N1 deferred + documented | this SUMMARY + STATE.md "Itens diferidos" entry |

---
*Phase: 06-rag-ingestao*
*Completed: 2026-05-05*
