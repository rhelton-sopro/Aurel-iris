---
phase: 06-rag-ingestao
plan: "02"
subsystem: rag-canonical-data
status: complete
completed_date: "2026-05-05"
duration_minutes: 35
tasks_completed: 3
tasks_total: 3
files_created: 3
files_modified: 2
tags: [rag, canonical-data, vocab, lgpd, founder-gate, wave-0, contract]
requirements_completed: [RAG-01, RAG-04]

dependency_graph:
  requires:
    - phase: 06-rag-ingestao/06-01
      provides: "test_vocabularies.py scaffolding (7 stubs flipped GREEN by this plan)"
  provides:
    - vision-service/scripts/data/vocabularies.json (D-T2..T5 controlled vocabularies; v0.1.1 founder-approved)
    - vision-service/data/jensen-reference.md (D-T4 24 sinais canônicos founder-validated)
    - apps/web/lib/rag/types.ts (D-P2 KnowledgeChunkMetadata + KnowledgeChunkRow + 7 ReportSection slugs)
    - apps/web/lib/rag/section-queries.ts (D-R2B SECTION_QUERY_TEMPLATES frozen v1)
  affects:
    - 06-03-PLAN (manifest.py Pydantic Literal enums must mirror escola_origem)
    - 06-04-PLAN (chunker.py validates metadata against vocabularies.json)
    - 06-05-PLAN (embedder.py + budget guards)
    - 06-06-PLAN (contextualizer.py)
    - 06-07-PLAN (persister.py loads vocabularies for tagging audit)
    - 06-09-PLAN (apps/web embed.ts pinned voyage-3 matching Python)
    - 06-10-PLAN (build-queries.ts + score-weights.ts consume SECTION_QUERY_TEMPLATES)
    - 06-11-PLAN (search.ts types return shape against KnowledgeChunkRow)
    - 06-12-PLAN (audit:vocabulary extension scans scripts/data + lib/rag)
    - 07-PHASE (Fase 7 super prompt referenced section slugs — 7 sections after founder edit)

tech_stack:
  added: []  # nothing new — JSON + TS + MD only
  patterns:
    - "founder-gate-with-version-bump: v0.1.0 -> v0.1.1 reflects founder edits (3 sinais added) per D-T6 versioning rule"
    - "synced-canonical-pair: vocabularies.json sinais_referenciados array MUST mirror jensen-reference.md backtick-listed signs (regression test pins both)"
    - "compile-time-exhaustiveness: Record<ReportSection, ...> in section-queries.ts forces tsc to fail if a new union member lacks an implementation — prevents drift between types.ts and the templates map"
    - "regression-test-as-contract: test_vocabularies.py asserts version == '0.1.1' + founder_additions issubset — locks the founder-gate decisions as a forever-test"

key_files:
  created:
    - vision-service/scripts/data/vocabularies.json
    - vision-service/data/jensen-reference.md
    - apps/web/lib/rag/types.ts
    - apps/web/lib/rag/section-queries.ts
  modified:
    - vision-service/tests/test_vocabularies.py (Wave 0 stubs flipped GREEN; +regression guards for v0.1.1 + founder additions)

key_decisions:
  - "Approved 3 founder additions: pterigium_pigmentar + nevus + criptas_radiais"
  - "Renamed 'Manchas' category in jensen-reference.md to 'Manchas e pigmentações' to accommodate the 2 non-iris-tissue marks (pterigium + nevus)"
  - "Rejected setor_em_brasa per founder's 'only if already in canon' instruction (grep returned no matches in jensen-reference.md)"
  - "Added nutricao_carencias slug to ReportSection — Fase 7 super prompt section for nutritional deficiencies"
  - "Rejected mineral_balance + exercicio — out of Fase 7 super prompt scope per founder feedback"
  - "Kept dimensoes at 6 — comportamental/psicossomatica overlap flagged for Fase 7 review (deferred, not blocking)"
  - "Bumped vocabularies.json version 0.1.0 -> 0.1.1 reflecting founder edits (D-T6 versioning rule)"

patterns_established:
  - "Founder gate as commit-pair: pre-checkpoint commit (canonical lists) + post-checkpoint commit (founder edits + version bump). Audit trail preserves the proposed-vs-approved diff."
  - "Test contract regression guard: when a founder-gate decision is made, lock it via subset assertion in the corresponding test file (e.g. founder_additions.issubset(sinais_referenciados))."

metrics:
  duration_minutes: 35
  commits: 3  # b4065f1 + a9f42c5 + f09d0ad
  pytest_assertions_locked: 7  # was 7 stubs in 06-01; now 7 GREEN with extra regression assertions
  vocab_version: "0.1.1"
  sinais_canonical_count: 24  # was 21 in pre-checkpoint draft
  report_sections_count: 7  # was 6 in pre-checkpoint draft
---

# Phase 6 Plan 02: Wave 0 — Canonical RAG data (vocabularies + types + section-queries) Summary

**One-liner:** 4 frozen-v1 canonical-data files committed (vocabularies.json + jensen-reference.md + types.ts + section-queries.ts) with founder-gate edits applied (+3 sinais, +1 section slug, version 0.1.0 -> 0.1.1); test_vocabularies.py flipped GREEN with regression guards.

## Performance

- **Duration:** ~35 min total (across 3 commits, including founder-gate pause)
- **Started:** 2026-05-05 (pre-checkpoint Tasks 1+2)
- **Completed:** 2026-05-05 (post-checkpoint founder edits)
- **Tasks:** 3 (Task 1 + Task 2 + Task 3 founder-gate)
- **Files created:** 4
- **Files modified:** 1 (test_vocabularies.py)
- **Commits:** 3 (b4065f1 + a9f42c5 + f09d0ad)

## Accomplishments

- D-T2..T5 controlled vocabularies frozen as v0.1.1 (rag_controlled_vocabularies catalog)
- D-T4 sinais canônicos list founder-validated: 24 entries across 7 categories (Lacunas e criptas, Pontas e raios, Anéis e arcos, Manchas e pigmentações, Vasos e colarete, Defeitos pupilares, Heterocromias)
- D-R2B SECTION_QUERY_TEMPLATES frozen as v1 with 7 sections (constituicao, psicoemocional, transgeracional, simbolico, mensagem_final, mental_cognitivo, nutricao_carencias)
- D-P2 metadata jsonb shape mirrored on TS side via KnowledgeChunkMetadata (RESEARCH Pitfall 9 — single source of truth in two places)
- test_vocabularies.py flipped GREEN with 7/7 assertions passing; added regression guards for version bump + 3 founder additions
- LGPD audit clean across all 4 canonical-data files (no diagnóstico/tratamento/cura)

## Task Commits

Each task was committed atomically:

1. **Task 1: Author vocabularies.json + jensen-reference.md (founder-gate baseline)** — `b4065f1` (feat)
   * 21 sinais canônicos baseline (pre-checkpoint draft)
   * 5 controlled vocab arrays (constituicao 6, setores 12, sinais 21, dimensoes 6, escolas 7)
   * Version v0.1.0 + founder approval date 2026-05-05
2. **Task 2: Author section-queries.ts + types.ts (TS contract)** — `a9f42c5` (feat)
   * 6 ReportSection slugs (pre-checkpoint draft)
   * KnowledgeChunkMetadata + KnowledgeChunkRow + RagError class
   * SECTION_QUERY_TEMPLATES with Record<ReportSection,...> exhaustiveness
3. **Task 3: Founder-gate edits + version bump** — `f09d0ad` (feat)
   * +3 sinais (pterigium_pigmentar, nevus, criptas_radiais) -> 24 total
   * +1 section slug (nutricao_carencias) -> 7 total
   * Renamed "Manchas" category -> "Manchas e pigmentações"
   * Version bumped 0.1.0 -> 0.1.1
   * test_vocabularies.py regression guards added

**Plan metadata commit:** (this SUMMARY commit, separate from per-task)

## Files Created/Modified

### Created (4)

- `vision-service/scripts/data/vocabularies.json` (v0.1.1; 5 keyed arrays totaling 55 entries: 6 + 12 + 24 + 6 + 7) — source of truth for D-T2..T5 controlled vocab; consumed by chunker tagging + post-ingest audit + Wave-0 vocab tests.
- `vision-service/data/jensen-reference.md` (24 backtick-listed sinais across 7 markdown categories + founder approval date 2026-05-05 + version 0.1.1) — source of truth for D-T4 sinais canônicos; tagger MUST select verbatim from this list.
- `apps/web/lib/rag/types.ts` (KnowledgeChunkMetadata + KnowledgeChunkRow + ReportSection union of 7 + RagError class + Database type re-export) — TS contract mirroring Python persister payload (RESEARCH Pitfall 9 defense).
- `apps/web/lib/rag/section-queries.ts` (SECTION_QUERY_TEMPLATES record with all 7 ReportSection keys; compile-time exhaustiveness enforced) — D-R2B Family B query templates frozen for Fase 7 super prompt contract.

### Modified (1)

- `vision-service/tests/test_vocabularies.py` (Wave 0 stubs flipped GREEN: 7/7 pass) — added 2 regression guards: `data["version"] == "0.1.1"` and `founder_additions.issubset(sinais_referenciados)`.

## Decisions Made

See frontmatter `key_decisions`. Key rationale:

- **3 founder additions accepted** (pterigium_pigmentar, nevus, criptas_radiais): all are clinically meaningful per founder's iridological practice and not contained in the pre-checkpoint draft. Adding them now is cheaper than refactor in 06-04+ (chunker tagging audit).
- **setor_em_brasa rejected**: the orchestrator pre-checked jensen-reference.md before resuming and confirmed the term has zero matches. Founder's instruction was "only if already in canon" — verification gate held.
- **dimensoes deferred**: comportamental ↔ psicossomatica overlap is real but renaming/splitting requires Fase 7 super prompt context (which dimensions does the prompt actually consume?). Tracked here, decision deferred to Fase 7.
- **Version bump 0.1.0 -> 0.1.1**: D-T6 versioning rule says additions require version bump. Patch-level (0.1.x) because the addition is non-breaking (subset compatibility — all v0.1.0 sinais still present). Approval date stays 2026-05-05 (same calendar day).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Test contract regression guards added during founder-gate**
- **Found during:** Task 3 (founder-gate edits)
- **Issue:** Plan said "update test_vocabularies.py to reflect new lists" but the existing tests use `issubset` for sinais — the founder additions would silently pass without explicit assertion. A future executor could remove `pterigium_pigmentar` from vocabularies.json and the existing test would still pass (subset still satisfied without it).
- **Fix:** Added `founder_additions.issubset(set(data["sinais_referenciados"]))` regression guard + `data["version"] == "0.1.1"` assertion. Now removing any of the 3 founder-approved sinais (or downgrading version) breaks the test.
- **Files modified:** vision-service/tests/test_vocabularies.py
- **Verification:** 7/7 pytest pass; if I delete e.g. `nevus` from vocabularies.json the test fails as expected (manually verified by mental simulation of subset semantics).
- **Committed in:** f09d0ad (Task 3 commit)

### Auth gates encountered

None. All edits are local file I/O.

### Pre-existing legacy items (out of scope)

- `pnpm exec tsc --noEmit` apps/web tree: 5 pre-existing errors in `lib/vision/modal-client.test.ts` (Phase 5 test code, tuple type narrowing). NOT caused by this plan; verified by `tsc 2>&1 | grep "lib/rag/"` returns empty. Documented as deferred Fase 5 cleanup in `.planning/STATE.md` (not duplicated in deferred-items.md since it's a Phase 5 artifact).

## Future considerations (deferred decisions)

- **dimensoes overlap** (comportamental ↔ psicossomatica): both founder + executor flagged this during the founder-gate. Not blocking — Fase 7 super prompt design will reveal whether both dimensions are consumed independently or if one subsumes the other. If the Fase 7 prompt only references e.g. psicossomatica, comportamental can be removed in a v0.1.2 bump. **Owner:** plan-phase 7. **Trigger:** super prompt draft review.

## Verification Summary

| Gate | Command | Result |
|------|---------|--------|
| LGPD audit | `cd vision-service && python -m scripts.audit_vocabulary` | **EXIT 0** — clean |
| Vocab regression tests | `cd vision-service && python -m pytest tests/test_vocabularies.py -v` | **EXIT 0** — 7/7 pass |
| Full vision-service pytest | `cd vision-service && python -m pytest -q` | **EXIT 0** — 142 passed, 46 skipped (baseline match) |
| tsc on lib/rag | `cd apps/web && pnpm exec tsc --noEmit 2>&1 \| grep "lib/rag/"` | **clean** (no errors; pre-existing Phase 5 errors out of scope) |
| Vitest lib/rag | `cd apps/web && pnpm test:run lib/rag/` | **EXIT 0** — 32 todos preserved, 4 file-skips |

## Issues Encountered

None during execution. The founder-gate pause itself is the canonical "issue" — by design, the plan splits at Task 3 to receive human input on canonical lists before they're locked. This is the correct flow for Wave 0 contract artifacts.

## User Setup Required

None. All 4 canonical-data files are local — no external service config needed.

## Next Phase Readiness

Wave 0 progress: 06-01 ✓ + 06-02 ✓ → 06-03 next (deps + manifest_assist.py + books_manifest.json).

Downstream contracts unblocked:
- 06-03: manifest.py Pydantic `escola: Literal[...]` will reuse the 7 escolas from vocabularies.json
- 06-04: chunker.py metadata tagger will validate against the 24 sinais + 12 setores + 6 constituições
- 06-10: build-queries.ts + score-weights.ts can import `SECTION_QUERY_TEMPLATES` from section-queries.ts (no longer it.todo)
- 06-11: search.ts return shape can import `KnowledgeChunkRow` from types.ts (no longer it.todo)

No blockers. The 3 founder additions are non-breaking for any downstream consumer (extensive subset of v0.1.0).

## Self-Check: PASSED

Verified all claims:

| Claim | Verification |
|-------|--------------|
| 4 canonical files exist | `ls vision-service/scripts/data/vocabularies.json vision-service/data/jensen-reference.md apps/web/lib/rag/types.ts apps/web/lib/rag/section-queries.ts` → all FOUND |
| Commit b4065f1 exists | `git log --oneline \| grep b4065f1` → FOUND ("feat(06-02): add controlled vocabularies + jensen-reference canon (D-T2..T5)") |
| Commit a9f42c5 exists | `git log --oneline \| grep a9f42c5` → FOUND ("feat(06-02): add section-queries + shared RAG types (D-R2B, D-P2)") |
| Commit f09d0ad exists | `git log --oneline \| grep f09d0ad` → FOUND ("feat(06-02): apply founder edits to canonical sinais (+3) and section slugs (+1)") |
| vocabularies.json version 0.1.1 | `python -c "import json; print(json.load(open('vision-service/scripts/data/vocabularies.json', encoding='utf-8'))['version'])"` → `0.1.1` |
| 24 sinais in vocabularies.json | `python -c "import json; print(len(json.load(open('vision-service/scripts/data/vocabularies.json', encoding='utf-8'))['sinais_referenciados']))"` → `24` |
| 3 founder additions in jensen-reference.md | `grep -c "pterigium_pigmentar\|^- \`nevus\`\|criptas_radiais" vision-service/data/jensen-reference.md` → 3 (all 3 lines) |
| nutricao_carencias in types.ts | `grep "nutricao_carencias" apps/web/lib/rag/types.ts` → FOUND (1 occurrence as union member) |
| nutricao_carencias in section-queries.ts | `grep "nutricao_carencias" apps/web/lib/rag/section-queries.ts` → FOUND (1 occurrence as Record key) |
| setor_em_brasa absent | `grep -i "setor_em_brasa\|brasa" vision-service/data/jensen-reference.md vision-service/scripts/data/vocabularies.json` → NO MATCHES |
| LGPD audit clean | `python -m scripts.audit_vocabulary; echo $?` → 0 |
| 7/7 vocab tests pass | `python -m pytest tests/test_vocabularies.py -v` → 7 passed |
| Full pytest baseline maintained | `python -m pytest -q` → 142 passed, 46 skipped (matches pre-edit baseline) |
| tsc clean for lib/rag | `pnpm exec tsc --noEmit 2>&1 \| grep "lib/rag/"` → empty |
| vitest todos preserved | `pnpm test:run lib/rag/` → 32 todo, 4 skipped, exit 0 |

---
*Phase: 06-rag-ingestao*
*Completed: 2026-05-05*
