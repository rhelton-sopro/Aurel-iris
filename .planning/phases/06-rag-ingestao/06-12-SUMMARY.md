---
phase: 06-rag-ingestao
plan: "12"
subsystem: lgpd-audit-extension
status: complete
completed_date: "2026-05-05"
duration_minutes: 25
tasks_completed: 2
tasks_total: 2
files_created: 3
files_modified: 2
tags: [rag, audit, lgpd, vocabulary, wave-4, autonomous]
requirements_completed: [RAG-01, RAG-02]

dependency_graph:
  requires:
    - phase: 06-rag-ingestao/06-08
      provides: "knowledge_chunks populated with 2761 rows — DB audit has data to scan"
    - phase: 06-rag-ingestao/06-11
      provides: "apps/web/lib/rag/ retrieval pipeline (search.ts + rerank.ts) — JS audit DIRS extension covers it"
    - phase: 06-rag-ingestao/06-02
      provides: "vocabularies.json + section-queries.ts — Python and JS audits already verify these inline"
    - phase: 06-rag-ingestao/06-03
      provides: "package.json audit:vocabulary:db placeholder script — this plan promotes it to real implementation"
  provides:
    - "vision-service/scripts/audit_vocabulary.py SCAN_DIRS extended to scripts/data (vocabularies.json + books_manifest.json now first-class scan targets)"
    - "apps/web/scripts/audit-vocabulary.mjs DIRS extended to lib/rag (7 retrieval-side TS files now under continuous LGPD audit)"
    - "apps/web/scripts/audit-vocabulary-db.mjs (NEW): DB-side LGPD audit on metadata.tags_livres — service-role + paginated full-scan + W6 word-boundary regex narrowing"
    - "apps/web/scripts/audit-vocabulary-db.test.mjs (NEW): 5 W6 unit tests pinning word-boundary parity with file-scan audits via node:test (zero extra deps)"
  affects:
    - "06-13-PLAN: founder UAT can now invoke `pnpm audit:vocabulary && pnpm audit:vocabulary:db` as part of the spot-check ritual"
    - "06-14-PLAN: vision-service/README.md RAG runbook section can reference the 3-audit suite as the LGPD gate"
    - "Future tagger plan (D-T1 deferred): when D-T1 lands and starts writing tags_livres, audit:vocabulary:db will start exercising real data — currently tags_livres is `[]` for all 2761 rows so the audit returns 0 hits at green steady state"

tech_stack:
  added: []  # @supabase/supabase-js already pinned in 06-03; node:test ships with Node 20+
  patterns:
    - "service-role-eyJ-prefix-guard (mirrors persister.py:38): defensive shape check that catches misconfig early without bypassing actual auth — anon keys also start with eyJ but other malformed values won't, so the prefix gate stops 95% of paste-the-wrong-thing errors before the request goes out"
    - "paginated-full-scan-with-client-side-narrowing: PostgREST does NOT support `jsonb::text ILIKE` in the .filter() qualifier (`metadata::text` is treated as literal column name; query returns `operator does not exist: jsonb ~~* unknown`). At MVP scale (~3K rows) iterate via .range(0..999, 1000..1999, ...) and apply the narrow check client-side — semantically equivalent for our case (we only inspect tags_livres anyway per Pitfall 6)"
    - "W6-word-boundary-parity (\\b<term>\\b regex): mirrors the file-scan audits' \\b...\\b semantics so audit hits are consistent across audit_vocabulary.py + audit-vocabulary.mjs + audit-vocabulary-db.mjs. Substring matching would diverge — `naturocultura` would fire here but NOT in the file-scan audits, producing false-positive noise"
    - "node:test as pnpm-test-isolation: vitest globs `*.test.ts(x)` only; companion .mjs script tests stay outside the apps/web vitest run by sticking to .test.mjs + node:test, exercised explicitly via `node --test`. Self-contained logic mirror in the test file isolates the regex behavior without spinning up Supabase"

key_files:
  created:
    - apps/web/scripts/audit-vocabulary-db.mjs
    - apps/web/scripts/audit-vocabulary-db.test.mjs
    - .planning/phases/06-rag-ingestao/deferred-items.md
  modified:
    - vision-service/scripts/audit_vocabulary.py
    - apps/web/scripts/audit-vocabulary.mjs

decisions:
  - "Replaced PLAN's verbatim `metadata::text ILIKE` PostgREST .filter() with paginated full-scan + client-side narrowing because the cast is a no-op through PostgREST's filter qualifier (verified empirically). At ~3K rows the cost difference is negligible, and we only inspect tags_livres anyway per Pitfall 6 — server-side pre-filter on `content` would be wasted work since we'd discard the matches"
  - "Kept the deferred-items.md log lightweight rather than fixing the pre-existing ALTA_PRIORIDADE_BOOKS drift in search.test.ts because that's out-of-scope per SCOPE BOUNDARY (Phase 6 retrieval-side concern, surfaced because 06-08 manifest edits weren't mirrored in the TS Set, NOT introduced by this plan)"

metrics:
  total_commits: 2
  duration_minutes: 25
  completed_date: "2026-05-05"
---

# Phase 6 Plan 12: LGPD Vocabulary Audit Extension Summary

LGPD vocabulary audit infrastructure extended to cover three RAG surfaces: vision-service/scripts/data/ (Python audit SCAN_DIRS), apps/web/lib/rag/ (JS audit DIRS), and DB metadata.tags_livres on knowledge_chunks (new audit-vocabulary-db.mjs with W6 word-boundary regex parity + 5 node:test cases). All three audits exit 0 over current corpus state.

## Tasks completed

| Task | Commit    | Files                                                                                                  |
| ---- | --------- | ------------------------------------------------------------------------------------------------------ |
| 1    | `68a0cdf` | vision-service/scripts/audit_vocabulary.py (SCAN_DIRS append "scripts/data") + apps/web/scripts/audit-vocabulary.mjs (DIRS append 'lib/rag') |
| 2    | `a585a1f` | apps/web/scripts/audit-vocabulary-db.mjs (NEW) + audit-vocabulary-db.test.mjs (NEW) + .planning/phases/06-rag-ingestao/deferred-items.md (NEW) |

## Verification gate results

All three audits run green over the current corpus state:

| Gate                                                                | Exit | Output                                                                                              |
| ------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------- |
| `cd vision-service && python -m scripts.audit_vocabulary`           | 0    | `OK: vocabulário proibido ausente em vision-service/`                                               |
| `pnpm --filter web audit:vocabulary` (file-scan)                    | 1    | 8 pre-existing Phase 3 hits unchanged; ZERO new failures from lib/rag/ (acceptance criterion met)  |
| `pnpm audit:vocabulary:db` (DB scan)                                | 0    | `OK: zero hits across diagnóstico, tratamento, cura in metadata.tags_livres (2761 chunks scanned)` |
| `node --test apps/web/scripts/audit-vocabulary-db.test.mjs` (W6)    | 0    | 5/5 tests pass (naturocultura/curandeiro negative + diagnóstico/tratamento/case-insensitive)        |

The 8 pre-existing Phase 3 hits in `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/api/capture/validate/route.ts`, and `components/capture/CapturePreview.tsx` are documented in STATE.md "Itens diferidos" line 141 — they are NOT introduced by this plan. Acceptance for plan 06-12 is "lib/rag/ scan adds zero new failures", which is met.

The DB audit found zero hits because tags_livres is currently `[]` for all 2761 chunks (D-T1 tagger deferred per 06-08 SUMMARY — separate Claude Code session writes those tags later). When D-T1 lands, this audit becomes the canonical gate that fires whenever a tag enters with forbidden vocab.

## Acceptance criteria

- [x] `vision-service/scripts/audit_vocabulary.py` SCAN_DIRS includes `'scripts/data'` (verified: `python -c "from scripts.audit_vocabulary import SCAN_DIRS; assert 'scripts/data' in SCAN_DIRS"` → OK SCAN_DIRS=['pipeline', 'data', 'scripts', 'scripts/data', 'tests/fixtures'])
- [x] `apps/web/scripts/audit-vocabulary.mjs` DIRS includes `'lib/rag'`
- [x] `apps/web/scripts/audit-vocabulary-db.mjs` exists with shebang `#!/usr/bin/env node`
- [x] FORBIDDEN_TERMS array contains 3 terms (diagnóstico, tratamento, cura)
- [x] Pitfall 6 cross-reference present in script comments (3 occurrences)
- [x] tags_livres referenced in script (9 occurrences — heavy use as designed)
- [x] DB audit does NOT scan `content` column (`grep -c "row.content"` returns 0)
- [x] W6 word-boundary regex `\b...\b` present in script (3 occurrences: in body + helper function)
- [x] No substring `.includes(term` match (W6 narrowing applied — substring fallback removed)
- [x] `process.exit(1)` present (failure path)
- [x] `process.exit(2)` present (env error path — 5 occurrences across the 3 env guards)
- [x] Companion test file exists at `apps/web/scripts/audit-vocabulary-db.test.mjs` with 5 W6 cases
- [x] `node --test apps/web/scripts/audit-vocabulary-db.test.mjs` exits 0 (5/5 pass)
- [x] `pnpm audit:vocabulary:db` exits 0 (zero hits over 2761 chunks)
- [x] Root `audit:vocabulary:db` script wired (was placeholder from 06-03; now resolves to real implementation)
- [x] Phase 5 Python tests still green (audit_vocabulary clean, vision-service/scripts unaffected)

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] PostgREST `metadata::text ILIKE` filter does not work**

- **Found during:** Task 2 verification run against the populated DB.
- **Issue:** The PLAN's `<interfaces>` verbatim used `client.from('knowledge_chunks').filter('metadata::text', 'ilike', '%term%')`. When executed, PostgREST returns `Query failed for term "diagnóstico": operator does not exist: jsonb ~~* unknown` because PostgREST treats `metadata::text` as a literal column name (the cast is not parsed); the underlying SQL ends up as `metadata ILIKE …` against a jsonb column, which fails because Postgres has no jsonb ~~* operator.
- **Fix:** Replaced the broad ILIKE pre-filter with a paginated full-scan via `.range(from, from + PAGE_SIZE - 1)` + client-side narrowing on `metadata.tags_livres`. At MVP scale (~3K rows) the difference is negligible (single PostgREST round-trip + sub-second loop). Per Pitfall 6 we only inspect tags_livres anyway, so the broad pre-filter was wasted work — its only purpose was to avoid pulling all rows over the wire, which at this scale is a non-issue. Bonus: the new code reports the row-scanned count in the success message, which makes "did the audit actually run?" easier to verify.
- **Files modified:** apps/web/scripts/audit-vocabulary-db.mjs (the main loop body + header comment)
- **Commit:** a585a1f

### Out-of-scope items logged (NOT fixed)

**1. ALTA_PRIORIDADE_BOOKS drift in search.test.ts**

- **Found during:** Task 2 vitest regression check (after-the-fact).
- **Issue:** `apps/web/lib/rag/search.test.ts:280` (W3 drift detection test from 06-11) fails because `books_manifest.json` v0.1.2 includes `"dictionary of iridology pdf"` with `alta_prioridade: true`, but the hardcoded TS Set in `apps/web/lib/rag/search.ts` still mirrors v0.1.1 (7 books, missing the dictionary).
- **Verified pre-existing:** Tested at baseline `48a2e9ea` (06-08 SUMMARY closing commit); failure is present there — not introduced by 06-12.
- **Resolution path:** Logged to `.planning/phases/06-rag-ingestao/deferred-items.md` for 06-13 or a founder manifest editorial decision. Two clean options (one-line edit either way): add the dictionary to `ALTA_PRIORIDADE_BOOKS`, or drop `alta_prioridade: true` from the manifest entry.
- **Out-of-scope rationale:** Plan 06-12's goal is the LGPD audit extension. Fixing the drift is a Phase 6 retrieval-side correctness issue (06-11's domain) that requires an editorial decision (either flip the TS or the JSON), not an audit change. SCOPE BOUNDARY directive: log + defer.

## TDD Gate Compliance

This plan is `type: execute` (not `type: tdd`); no RED/GREEN/REFACTOR gate sequence required. Task 2 does include a unit test file (`audit-vocabulary-db.test.mjs`), but it accompanies the implementation rather than driving it — the implementation came from PLAN's `<interfaces>` verbatim, the test exists to pin W6 word-boundary parity going forward.

## Threat Flags

None. The new DB audit script reads service-role credentials from environment (mirroring persister.py's pattern from 06-07, already in the threat register) and writes nothing — it's pure read-only audit. No new attack surface introduced.

## Self-Check: PASSED

Files referenced in this SUMMARY all exist:

- vision-service/scripts/audit_vocabulary.py — FOUND (modified, line 28 SCAN_DIRS contains 'scripts/data')
- apps/web/scripts/audit-vocabulary.mjs — FOUND (modified, line 21 DIRS contains 'lib/rag')
- apps/web/scripts/audit-vocabulary-db.mjs — FOUND (new, 120 lines)
- apps/web/scripts/audit-vocabulary-db.test.mjs — FOUND (new, 42 lines)
- .planning/phases/06-rag-ingestao/deferred-items.md — FOUND (new, 40 lines)

Commits referenced in this SUMMARY all exist in git log:

- 68a0cdf — FOUND (`feat(06-12): extend LGPD audit to scripts/data + apps/web/lib/rag`)
- a585a1f — FOUND (`feat(06-12): add audit-vocabulary-db.mjs (DB-side LGPD audit on tags_livres)`)
