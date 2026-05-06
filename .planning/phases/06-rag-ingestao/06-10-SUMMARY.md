---
phase: 06-rag-ingestao
plan: "10"
subsystem: rag-typescript-pure-functions
status: complete
completed_date: "2026-05-06"
duration_minutes: 25
tasks_completed: 2
tasks_total: 2
files_created: 2
files_modified: 2
tags: [rag, typescript, queries, weights, pure-functions, wave-3, autonomous]
requirements_completed: [RAG-04]

dependency_graph:
  requires:
    - phase: 06-rag-ingestao/06-02
      provides: "apps/web/lib/rag/types.ts (ReportSection union with 7 members including nutricao_carencias; KnowledgeChunkRow shape) + section-queries.ts (SECTION_QUERY_TEMPLATES Record<ReportSection, ...> exhaustive)"
    - phase: 06-rag-ingestao/06-01
      provides: "Wave 0 stubs for build-queries.test.ts (9 it.todo) and score-weights.test.ts (7 it.todo)"
  provides:
    - "apps/web/lib/rag/build-queries.ts (buildFamilyA + buildFamilyB pure functions; IrisFeaturesForRag interface)"
    - "apps/web/lib/rag/score-weights.ts (WEIGHTS const + applyWeights pure function; SECTION_THEMES per-section dimensoes intersection map)"
    - "20 vitest passes (was 16 todos) — net -16 todos / +20 passes / -2 file-skips in lib/rag/"
  affects:
    - "06-11-PLAN (search.ts orchestrator imports buildFamilyA + buildFamilyB to compose query batches; imports applyWeights to post-process retrieved chunks after rerank)"

tech_stack:
  added: []  # all dependencies pinned in earlier waves; this plan adds only pure TS modules
  patterns:
    - "compile-time-exhaustiveness-via-Record (continuation of section-queries.ts in 06-02): SECTION_THEMES is typed `Record<ReportSection, string[]>` so tsc fails to compile if a new ReportSection union member is added without a theme entry. The 7th key `nutricao_carencias` was added in 06-02 founder edits — this plan completes the SECTION_THEMES mapping for that key (mapped to ['fisica', 'constitucional'])."
    - "subset-of-canonical-vocabulary verification: SECTION_THEMES values are validated against vision-service/scripts/data/vocabularies.json `dimensoes` array (6 canonical: fisica, psicossomatica, transgeracional, constitucional, energetica, comportamental). All 6 values used in SECTION_THEMES are subset-of-canonical — verified via Python script in plan acceptance gate. If a typo introduced 'emotional' instead of 'psicossomatica', the intersection check would silently never match and weighting would be a no-op."
    - "pure-function-with-immutable-output: applyWeights returns chunks.map(c => ({ ...c, score })) — never mutates input. Testable via reference-equality + value-equality assertions (tests 'does not mutate input array' + 'preserves chunk shape')."
    - "compounding-multiplicative-weights: D-R4 prescribes 3 multipliers that COMPOUND when multiple conditions match. 1.5 (clinical_data) × 1.1 (alta_prioridade) × 1.2 (dimensoes_intersect) = 1.98×. Test asserts via toBeCloseTo with 6-decimal precision."
    - "structurally-typed-feature-subset: IrisFeaturesForRag declares only the fields buildFamilyA reads (constitution, sectors with hour+findings, rings). The full IrisFeatures from Phase 5 (vision-service/pipeline/features.py output) is structurally compatible — passes through TS structural typing. Avoids hard dependency from apps/web/lib/rag/ on the vision-service schema."
    - "comment-must-also-pass-LGPD-grep: the plan's acceptance criterion `grep -E 'diagn[óo]stico|tratamento|cura'` must return zero matches even in COMMENTS. Initial header comment quoted the proibido vocabulary literally for explanatory context — re-worded to reference `PROJECT.md \"Restrições não-negociáveis\"` instead. Lesson: LGPD-aware code comments cannot quote the proibido words even as examples."

key_files:
  created:
    - "apps/web/lib/rag/build-queries.ts (74 lines — IrisFeaturesForRag + buildFamilyA + buildFamilyB)"
    - "apps/web/lib/rag/score-weights.ts (78 lines — WEIGHTS const + SECTION_THEMES + applyWeights)"
  modified:
    - "apps/web/lib/rag/build-queries.test.ts (Wave-0 stubs flipped: 9 todos → 10 passes; +1 test 'compounds: constitution + sector + ring all emit')"
    - "apps/web/lib/rag/score-weights.test.ts (Wave-0 stubs flipped: 7 todos → 10 passes; +3 tests for WEIGHTS constants + 1 'does NOT multiply by dimensoes when section is null')"

key_decisions:
  - "SECTION_THEMES['nutricao_carencias'] = ['fisica', 'constitucional']. The PLAN's verbatim SECTION_THEMES had only 6 entries (matching the 6 ReportSections present at PLAN authoring time), but 06-02 founder edits added a 7th ReportSection (nutricao_carencias) that the PLAN was authored against. Without the 7th entry, `Record<ReportSection, string[]>` would not type-check (Rule 3 — blocking issue). Mapping rationale: nutritional deficiencies present as physical findings in the iris (escleras, anel anêmico, manchas) — `fisica` dimension fits — and Jensen's constitutional typology directly correlates with mineral/vitamin deficiency patterns (linfática→cálcio, biliar→ferro) — `constitucional` fits. Both values are subset of canonical dimensoes vocabulary."
  - "buildFamilyA guards against empty primary constitution. The PLAN's `<interfaces>` example pushed `constituição ${primary}` unconditionally — the test 'returns minimal output when features has no constitution' asserts the function returns `[]` for `primary: ''`. Implementation guards with `if (features.constitution.primary)` to honor the test. This handles the edge case where Phase 5 produces a partial/null features payload (e.g. low-quality capture)."
  - "Defensive-coercion on Fern/SDK optionals NOT needed here. Unlike 06-09 (embed.ts wrapper of voyageai SDK), build-queries.ts and score-weights.ts have no external SDK dependency — they consume hand-rolled in-tree types. KnowledgeChunkRow.metadata.dimensoes is typed `string[]` (not optional), so `.some(...)` is safe without nullish-coalescing."
  - "Header comment must avoid proibido vocabulary. The plan's LGPD acceptance gate runs `grep -E 'diagn[óo]stico|tratamento|cura' apps/web/lib/rag/build-queries.ts` and requires zero matches. Initial header comment quoted those words literally for explanatory context (mirrors 06-02's section-queries.ts comment style); re-worded to reference PROJECT.md instead. The literal grep is stricter than the audit:vocabulary script (which only scans `app/` and `components/` until 06-12 extends it). Both are now satisfied."

metrics:
  duration_minutes: 25
  commits: 3  # 13b09f1 RED test + d70fd9e GREEN build-queries + 47b351b GREEN score-weights (combined test+impl since RED for score-weights was uncommitted)
  vitest_passes_added: 20  # 9+7 todos → 10+10 passes (each suite gained 1 extra test beyond Wave-0 count)
  vitest_skips_removed: 2  # build-queries.test.ts and score-weights.test.ts no longer skip-at-file-level
  vitest_todos_removed: 16  # 9 build-queries todos + 7 score-weights todos
  build_queries_test_count: 10  # was 9 (added 'compounds' test from PLAN's interface)
  score_weights_test_count: 10  # was 7 (added 3 WEIGHTS-constants tests + 1 null-section test)

threat_register_status:
  - "T-RAG-04 (compile-time exhaustiveness on ReportSection): MITIGATED. SECTION_THEMES is `Record<ReportSection, string[]>` — adding a new ReportSection without a theme breaks tsc. Mirror of section-queries.ts (06-02). Verified by tsc --noEmit clean for score-weights.ts."
  - "T-RAG-08 (LGPD vocabulário proibido in code we write): MITIGATED. Both build-queries.ts and score-weights.ts pass `grep -E 'diagn[óo]stico|tratamento|cura'` with zero hits — strings, identifiers, and comments all clean. The `pnpm audit:vocabulary` script does not yet scan lib/rag/ (DIRS extension lands in 06-12) so the literal grep gate is the canonical check until then."
  - "T-RAG-09 (silent intersection-no-match from typo'd dimensoes): MITIGATED. SECTION_THEMES values are verified subset of canonical `dimensoes` array in vision-service/scripts/data/vocabularies.json. Acceptance gate runs a Python script that loads the canonical JSON and asserts `themes_used.issubset(canonical)`. If a typo like 'emotional' instead of 'psicossomatica' enters SECTION_THEMES, the intersection check would silently never match — the gate catches this loud."
---

# Phase 6 Plan 10: Wave 3 — build-queries.ts + score-weights.ts Pure Functions Summary

**One-liner:** Two retrieval-side pure-function modules — `build-queries.ts` (D-R2 Family A + Family B query generators consuming `IrisFeaturesForRag` features and `ReportSection[]`) and `score-weights.ts` (D-R4 multiplicative weights — clinical_data 1.5×, alta_prioridade 1.1×, dimensoes intersect 1.2× — applied immutably as `chunks.map(c => ({ ...c, score }))`) — landed with 20/20 vitest passes (was 16 todos), tsc clean for both new files, LGPD audit clean, and SECTION_THEMES verified as subset of canonical `dimensoes` vocabulary. **Wave 3 progressed: 06-09 (embed.ts) + 06-10 (this plan) complete; 06-11 (search.ts orchestrator) and 06-08 (founder-gated ingest run) remain.**

## Tasks completed

### Task 1: build-queries.ts + flip build-queries.test.ts to GREEN (TDD RED → GREEN)

**RED commit `13b09f1`** — replaced 9 it.todo stubs with 10 real assertions (added `compounds: constitution + sector + ring all emit` from the PLAN's `<interfaces>` block). Tests fail at module-resolve time because `./build-queries` does not yet exist.

**GREEN commit `d70fd9e`** — implemented `apps/web/lib/rag/build-queries.ts`:

- `IrisFeaturesForRag` interface: subset of Phase 5 IrisFeatures declaring only `constitution`, `sectors[*].hour/findings[*].type`, `rings`. Exported so search.ts (06-11) and tests can name it.
- `buildFamilyA(features)`: guards against empty primary, emits `constituição {X}` for primary + secondary, `{type, type} no setor {N}` for sectors with findings, `{ringName} presente` for active rings.
- `buildFamilyB(features, sections)`: `sections.flatMap(s => SECTION_QUERY_TEMPLATES[s]?.(features) ?? [])`. Skips unknown sections (test asserts no throw) and returns `[]` for empty section list.

10/10 vitest passes:

```
✓ buildFamilyA (visual findings — D-R2A) (6 tests)
  ✓ emits 1 query per primary constitution
  ✓ emits 1 query per secondary constitution when present
  ✓ emits 1 query per sector with findings.length > 0
  ✓ emits 1 query per active global ring/sign
  ✓ returns empty when features has no constitution and no findings
  ✓ compounds: constitution + sector + ring all emit
✓ buildFamilyB (report sections — D-R2B) (4 tests)
  ✓ emits queries from SECTION_QUERY_TEMPLATES for each section
  ✓ combines constitution.primary into each section template
  ✓ returns empty when reportSections is empty
  ✓ skips sections without a registered template (no throw)
```

### Task 2: score-weights.ts + flip score-weights.test.ts to GREEN (TDD RED → GREEN)

**RED step (uncommitted)** — replaced 7 it.todo stubs with 10 real assertions (added 3 WEIGHTS-constants tests + 1 null-section test). Tests failed at module-resolve time.

**GREEN commit `47b351b`** — implemented `apps/web/lib/rag/score-weights.ts` with both test+impl in one commit (RED was uncommitted):

- `WEIGHTS` const: `{ CLINICAL_DATA: 1.5, ALTA_PRIORIDADE: 1.1, DIMENSAO_INTERSECT: 1.2 }` (`as const` — readonly, locked at compile time).
- `SECTION_THEMES`: `Record<ReportSection, string[]>` mapping all 7 ReportSections to subsets of canonical `dimensoes`. Includes the 7th key `nutricao_carencias` (added in 06-02 founder edits) mapped to `['fisica', 'constitucional']` — Rule 3 fix without which `Record<ReportSection>` exhaustiveness would not compile.
- `applyWeights(chunks, section, altaPrioridadeBooks)`: returns `chunks.map(c => ({ ...c, score: scoreCompounded(c) }))`. Never mutates input. Section may be null (Family A only path) — short-circuits the dimensoes intersection check.

10/10 vitest passes:

```
✓ WEIGHTS constants (D-R4) (3 tests)
  ✓ CLINICAL_DATA = 1.5
  ✓ ALTA_PRIORIDADE = 1.1
  ✓ DIMENSAO_INTERSECT = 1.2
✓ applyWeights (D-R4) (7 tests)
  ✓ multiplies score by 1.5 when source_type === clinical_data
  ✓ multiplies score by 1.1 when book in altaPrioridadeBooks
  ✓ multiplies score by 1.2 when dimensoes intersects section theme
  ✓ does NOT multiply by dimensoes when section is null
  ✓ compounds all 3 multipliers (1.5 × 1.1 × 1.2 = 1.98×)
  ✓ does not mutate input array
  ✓ preserves chunk shape (only score changes)
```

## Verification gates

| Gate | Command | Result |
| ---- | ------- | ------ |
| build-queries test count | `pnpm test:run lib/rag/build-queries.test.ts` | `10 passed` ✓ |
| score-weights test count | `pnpm test:run lib/rag/score-weights.test.ts` | `10 passed` ✓ |
| Combined gate | `pnpm test:run lib/rag/build-queries.test.ts lib/rag/score-weights.test.ts` | `20 passed (≥19 required)` ✓ |
| zero it.todo build-queries | `grep -c "it.todo" lib/rag/build-queries.test.ts` | `0` ✓ |
| zero it.todo score-weights | `grep -c "it.todo" lib/rag/score-weights.test.ts` | `0` ✓ |
| pt-BR template literal | `grep -c "constituição" lib/rag/build-queries.ts` | `1` ✓ (≥1 required) |
| WEIGHTS.CLINICAL_DATA pin | `grep -c "CLINICAL_DATA: 1.5" lib/rag/score-weights.ts` | `1` ✓ |
| WEIGHTS.ALTA_PRIORIDADE pin | `grep -c "ALTA_PRIORIDADE: 1.1" lib/rag/score-weights.ts` | `1` ✓ |
| WEIGHTS.DIMENSAO_INTERSECT pin | `grep -c "DIMENSAO_INTERSECT: 1.2" lib/rag/score-weights.ts` | `1` ✓ |
| LGPD literal-grep build-queries | `grep -E "diagn[óo]stico\|tratamento\|cura" lib/rag/build-queries.ts` | `(empty)` ✓ |
| LGPD literal-grep score-weights | `grep -E "diagn[óo]stico\|tratamento\|cura" lib/rag/score-weights.ts` | `(empty)` ✓ |
| SECTION_THEMES vocabulary integrity | Python script asserting themes ⊆ canonical dimensoes | `OK — 6 themes used, all subset of canonical (6 total)` ✓ |
| tsc on build-queries.ts | `pnpm exec tsc --noEmit \| grep "lib/rag/build-queries"` | `(empty)` ✓ |
| tsc on score-weights.ts | `pnpm exec tsc --noEmit \| grep "lib/rag/score-weights"` | `(empty)` ✓ |
| lib/rag/ overall | `pnpm test:run lib/rag/` | `3 passed (27) + 2 skipped (16 todos)` ✓ — was 1 passed (7) + 4 skipped (32 todos); net +20 passes / -16 todos / -2 file-skips |

## Pre-existing tsc errors (out of scope, documented)

`pnpm exec tsc --noEmit` reports the same Phase 5 / Phase 3 dívida already documented in 06-09-SUMMARY.md and STATE.md "Itens diferidos":

- **Phase 5 dívida** (~10 errors): `app/actions/readings.test.ts`, `app/api/vision/webhook/route.ts`, `components/readings/ReprocessButton.test.tsx`, `components/readings/StatusBadge.tsx`, `lib/vision/modal-client.test.ts` — STATE.md line 41 explicit callout.
- **Phase 3 dívida** (2 errors): `lib/capture/quality-scoring.test.ts(47,54)` references `WEIGHTS.reflex` removed in UAT 03 VLM pivot — STATE.md line 134 + deferred-items.md.

The plan's gates explicitly scope verification to `lib/rag/build-queries` and `lib/rag/score-weights` and treat other tree errors as pre-existing dívida (mirror of 06-07 + 06-09 which faced the same).

## Pre-existing apps/web vitest failures (out of scope, documented)

`pnpm test:run` (full apps/web suite) reports 3 failures, all in `lib/capture/quality-scoring.test.ts` — Phase 3 pre-existing failures from the UAT 03 VLM pivot when `WEIGHTS.reflex` was removed but the tests were not updated. Documented in STATE.md "Itens diferidos" line 134 and `deferred-items.md`. **NOT introduced by this plan** — verified that the same failures pre-exist on baseline `26e55f8` (the commit before this plan's first commit).

The plan-level scope boundary explicitly excludes pre-existing failures in unrelated files. **lib/rag/ is 100% green** (27/27 passes + 16 todos + 0 fails).

## Pre-existing audit:vocabulary hits (out of scope)

`pnpm audit:vocabulary` reports 8 hits — **NONE in `lib/rag/build-queries.ts`, `lib/rag/build-queries.test.ts`, `lib/rag/score-weights.ts`, `lib/rag/score-weights.test.ts`**. All hits are in pre-existing technical comments in `app/(auth)/login|signup/page.tsx`, `app/api/capture/validate/route.ts`, `components/capture/CapturePreview.tsx` (Phase 3 dívida documented in STATE.md "Itens diferidos" + deferred-items.md). The audit currently scans `app/` and `components/` (not `lib/rag/`) — the directory-extension to include `lib/rag/` ships in 06-12.

## Test count delta

Baseline (HEAD `26e55f8`):

```
4 file-skips + 32 todos + 1 file with 7 passes
- rerank.test.ts:        7 todos (file-skip)
- score-weights.test.ts: 7 todos (file-skip)
- search.test.ts:        9 todos (file-skip)
- build-queries.test.ts: 9 todos (file-skip)
- embed.test.ts:         7 passes
```

Post-06-10 (HEAD after final docs commit):

```
2 file-skips + 16 todos + 3 files with 27 passes
- rerank.test.ts:        7 todos (file-skip — unchanged; 06-11 owes flip)
- search.test.ts:        9 todos (file-skip — unchanged; 06-11 owes flip)
- build-queries.test.ts: 10 passes (FLIPPED — was 9 todos)
- score-weights.test.ts: 10 passes (FLIPPED — was 7 todos)
- embed.test.ts:         7 passes (unchanged)
```

Net: +20 passes / -16 todos / -2 file-skips. Each flipped suite gained 1 extra test beyond the Wave-0 todo count (build-queries: +1 'compounds' test from PLAN's `<interfaces>`; score-weights: +3 WEIGHTS-constants tests).

## Deviations

### Rule 3 — fix blocking issue (SECTION_THEMES exhaustiveness for 7-member ReportSection union)

**Found during:** Task 2 (writing score-weights.ts).
**Issue:** `Record<ReportSection, string[]>` requires entries for all 7 ReportSection union members, but the PLAN's verbatim `<interfaces>` block defined only 6 entries (psicoemocional, transgeracional, simbolico, mental_cognitivo, constituicao, mensagem_final). The 7th member `nutricao_carencias` was added in 06-02 founder edits **after** the PLAN was authored — without an entry, tsc fails with TS2741.
**Fix:** Added `nutricao_carencias: ['fisica', 'constitucional']` — both values are subset of canonical `dimensoes` vocabulary. Mapping rationale: (a) nutritional deficiencies present as physical findings (escleras, anel anêmico, manchas) — `fisica` fits, (b) Jensen's constitutional typology correlates with deficiency patterns (linfática→cálcio, biliar→ferro) — `constitucional` fits.
**Files modified:** `apps/web/lib/rag/score-weights.ts` (mapping addition + explanatory comment block).
**Commit:** `47b351b`.

### Rule 1 — fix LGPD literal-grep gate (header comment quoted proibido vocabulary)

**Found during:** Task 1 (running acceptance gate `grep -E 'diagn[óo]stico|tratamento|cura' build-queries.ts`).
**Issue:** Initial header comment had a line `(diagnóstico/tratamento/cura)` as parenthetical examples of the proibido vocabulary — same pattern used in `lib/rag/section-queries.ts` (06-02 baseline). The PLAN's literal-grep gate is stricter than `pnpm audit:vocabulary` (which doesn't currently scan lib/rag/) and matches even comment text.
**Fix:** Re-worded the comment to reference `PROJECT.md "Restrições não-negociáveis"` instead of quoting the words literally. Functional content of comment unchanged.
**Files modified:** `apps/web/lib/rag/build-queries.ts` (header comment — line 14).
**Commit:** Folded into `d70fd9e` (GREEN commit, before staging).

### No other deviations

- Auto-fixes Rule 2 (missing critical functionality): NONE
- Rule 4 (architectural): NONE applied; no checkpoint emitted (plan was AUTONOMOUS)
- Auth gates: N/A (no founder/external system interaction)

## Self-Check: PASSED

- [x] `apps/web/lib/rag/build-queries.ts` exists (verified via Read, 74 lines)
- [x] `apps/web/lib/rag/score-weights.ts` exists (verified via Read, 78 lines)
- [x] Commit `13b09f1` (RED build-queries test) exists (verified via git log)
- [x] Commit `d70fd9e` (GREEN build-queries impl) exists (verified via git log)
- [x] Commit `47b351b` (GREEN score-weights test+impl) exists (verified via git log)
- [x] 20/20 tests pass via `pnpm test:run lib/rag/build-queries.test.ts lib/rag/score-weights.test.ts`
- [x] zero it.todo entries in either flipped test file
- [x] tsc clean for both new files (pre-existing Phase 5/3 dívida documented as out-of-scope)
- [x] LGPD literal-grep clean for both new files
- [x] SECTION_THEMES values are verified subset of canonical `dimensoes` vocabulary
- [x] lib/rag/ baseline preserved + advanced (was 1 passed file / 4 skipped — now 3 passed / 2 skipped; +20 passes net)
