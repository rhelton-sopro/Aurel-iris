---
phase: 06-rag-ingestao
plan: "14"
subsystem: rag-runbook-docs
status: complete
completed_date: "2026-05-05"
duration_minutes: 25
tasks_completed: 1
tasks_total: 1
files_created: 1
files_modified: 1
tags: [rag, docs, runbook, wave-4, phase-closure]
requirements_completed: [RAG-01, RAG-02, RAG-03]

dependency_graph:
  requires:
    - phase: 06-rag-ingestao/06-08
      provides: "knowledge_chunks populated (2761 chunks across 12 books) — final v1 corpus state to document"
    - phase: 06-rag-ingestao/06-12
      provides: "audit:vocabulary:db CLI script — documented in runbook quick reference"
    - phase: 06-rag-ingestao/06-13
      provides: "rag:spot-check CLI + 06-UAT.md sign-off + D-N1 reactivation — runbook reflects final shipped state with D-N1 ACTIVE (not deferred)"
  provides:
    - vision-service/README.md (## RAG Ingestion (Phase 6) section appended after Phase 5 smoke procedure)
  affects:
    - "Future founder onboarding: single source of truth for re-ingestion procedure (D-I2), cost guards (D-G1/D-N1 with v1 actuals), env vars, troubleshooting"
    - "Future-Claude-session tagging exercise (D-T1 / Fase 6.1): runbook documents inert state of D-R4 dimensoes intersect multiplier so the activation work is unambiguous"
    - "/gsd-verify-work 6 (next step): runbook is the documentation gate for phase verification"

tech_stack:
  added: []
  patterns:
    - "phase-closure-runbook-section: append a per-phase ops runbook to a service-level README rather than create a fresh markdown file. Founder can find Phase 5 smoke + Phase 6 RAG ops side-by-side in one document; keeps the README the canonical operational doc rather than scattering ops knowledge across .planning/."
    - "v1-limitation-blockquote: front-load known incompleteness with a `> v1 limitation:` blockquote immediately above the affected operation. Reader sees 'empty arrays after ingest' BEFORE seeing the post-ingest tagging section, eliminating the 'is this a bug?' moment. Pattern reusable for any feature shipped in incomplete-but-correct state."
    - "lgpd-prose-rephrase-during-docs: 'modo diagnóstico' → 'modo de inspeção'; 'UAT diagnóstico' → 'UAT smoke'. The forbidden-vocab pattern catches forms even in technical-sense usages where the term means 'troubleshooting mode' not 'medical diagnosis' — but the audit can't distinguish, and surface-level discipline (avoid the word entirely in product surfaces) is cheaper than carve-outs."

key_files:
  created:
    - .planning/phases/06-rag-ingestao/06-14-SUMMARY.md
  modified:
    - vision-service/README.md (line count 244 → 389; +145 lines; new ## RAG Ingestion (Phase 6) section after existing Phase 5 smoke procedure)

key_decisions:
  - "v1 acceptance gate checkbox at end of section uses real numbers (2761 chunks, 12 books, 91% Contexto coverage, $3.70 cost) not estimates. This makes the gate a falsifiable record of what shipped, not an aspirational target. Future re-ingests can compare against this baseline."
  - "Documented `RAG_INGEST_DEBUG_CACHE=1` env var (per-chunk cost breakdown). Originally introduced in 06-13 fix-chain (commit 1149f25 / 8da720b cache_creation tracking) but never user-documented; runbook surfaces it as the canonical real-time audit knob for the Anthropic budget."
  - "Documented mode-mismatch protection (corpus has [Contexto:] prefixes but --no-contextual was passed, or vice-versa). This is a 06-13 W5-callout safeguard that prevents corpus contamination during partial re-ingests; runbook makes the user-facing error message recoverable (`--purge` then re-ingest)."
  - "Acceptance gates checklist explicitly differentiates `apps/web` lib/rag/ test scope (45 passed across 5 files) from full apps/web suite (which has 8 pre-existing Phase 3 quality-scoring failures documented as out-of-scope per STATE.md 'Itens diferidos'). Runbook is honest about scope boundary."

patterns_established:
  - "single-doc-runbook-per-service: vision-service/README.md is now the canonical ops doc for both Modal pipeline (Phase 5) and RAG ingestion (Phase 6). When Phase 7 LLM analysis ships, its runbook section will be appended here too — keeping all founder-facing service ops in one place."

metrics:
  duration_minutes: 25  # docs-only plan; ~10 min reading context, ~10 min drafting, ~5 min audits + commit
  commits: 2  # README edit + this SUMMARY/STATE close
  lines_added: 145
  lines_removed: 0
---

# Phase 6 Plan 14: Wave 4 — RAG Runbook Documentation Summary

**One-liner:** Appended a 145-line `## RAG Ingestion (Phase 6)` section to `vision-service/README.md` documenting the 9 user-facing CLI commands, env vars, D-G1/D-N1 cost guards (with v1 actuals: $3.70 total / 2761 chunks / 91% Contexto coverage), D-I2 re-ingest procedure, D-T1 post-ingest tagging deferred state, and 9-issue troubleshooting matrix — closes Phase 6 implementation pending `/gsd-verify-work 6`.

## Performance

- **Duration:** ~25 minutes wall-clock
- **Started:** 2026-05-05
- **Completed:** 2026-05-05
- **Tasks:** 1 (autonomous append + LGPD prose-scan + commits)
- **Commits:** 2 (README edit + SUMMARY/STATE close)

## Accomplishments

### Pre/post line counts
- **Before:** `vision-service/README.md` = 244 lines (Phase 5 founder smoke procedure complete + rollback notes)
- **After:** `vision-service/README.md` = 389 lines (+145 lines = new `## RAG Ingestion (Phase 6)` section appended after `---` separator at line 245)
- **Phase 5 sections untouched:** `## Estrutura`, `## Setup local (desenvolvimento)`, `## Smoke procedure (founder)` (with all 7 numbered subsections + `### Rollback notes`) all verbatim — `grep -c "Smoke procedure (founder)"` returns 1, matching pre-edit baseline.

### Heading structure delta
- Pre-edit `^## ` count: 3 (Estrutura, Setup local, Smoke procedure (founder))
- Post-edit `^## ` count: 4 (Estrutura, Setup local, Smoke procedure (founder), RAG Ingestion (Phase 6))
- Delta: +1 exactly — matches plan acceptance criterion ("the tile heading count increased by exactly 1")

### Section content
The appended section includes:
1. **Intro paragraph** — Phase boundary statement + current v1 state (2761 chunks / 12 books / 91% Contexto / $3.70 cost)
2. **Quick reference table** — 9 commands (4 root-level rag:*, audit:vocabulary:db, audit:vocabulary, vision-service Python audit, rag:spot-check, mode flags `--no-contextual`/`--dry-run`/`--book`/`--limit-chunks`)
3. **Mode-mismatch protection blockquote** — explicit safeguard for partial re-ingest hazard
4. **Required env vars table** — 7 vars (VOYAGE_API_KEY, ANTHROPIC_API_KEY, SUPABASE_URL/SERVICE_ROLE_KEY, RAG_SPOT_CHECK_TOKEN, VOYAGE_RERANK_MODEL optional, RAG_INGEST_DEBUG_CACHE optional) + service-role JWT shape validation note (eyJ prefix)
5. **Cost guards section** — D-G1 hardcap $5 with v1 actual ~$0.16 (31× margin) + D-N1 hardcap $15 with v1 actual ~$3.59 (4.2× margin) + 5-bucket Anthropic accounting + reconciliation against billing dashboards + idempotency note (content_hash from source text not contextual prefix — locked invariant from 06-13 fix bdce870) + abort recovery procedure
6. **D-I2 re-ingestion procedure** — purge+ingest 3-step + corpus-wide DELETE escape hatch
7. **W5 v1-limitation blockquote** — front-loaded warning: empty metadata arrays make D-R4 `dimensoes intersect 1.2×` multiplier inert; ordering dominated by cosine + D-N1 + D-N2 + alta_prioridade 1.1× + clinical_data 1.5×; tagging is Fase 6.1 deferred work; "Não confunda o estado de arrays vazios com bug"
8. **Post-ingest tagging section (D-T1)** — explicit JSON schema of empty fields + Claude Code session-only operation (D-T2..T6 vocabularies) + by-design rationale (no scaling, founder validation real-time, zero marginal cost)
9. **Spot-check / Founder UAT subsection** — `pnpm rag:spot-check` walkthrough + 3 hardcoded scenarios listed
10. **Quick troubleshooting (10 issues)** — env unset, JWT shape, Voyage hardcap, Anthropic hardcap, mode mismatch, retry exhaustion, weird spot-check chunks, p95 latency tuning (`hnsw.ef_search` ALTER DATABASE), Route Handler 403
11. **Phase 6 acceptance gates checklist** — 8/9 checked (pytest 245 passed/4 skipped, lib/rag/ 45 passed, 3 LGPD audits, count ≥1000 = 2761, distinct ≥10 = 12, Contexto ≥80% = 91%, UAT signed, migrations 0005+0006); pending = `/gsd-verify-work 6`

### LGPD prose-scan result
- **Initial scan:** 2 prose hits (line 259 "modo diagnóstico", line 264 "UAT diagnóstico" — both technical-sense usages of the forbidden vocab in a markdown table)
- **Fix:** rephrased "modo diagnóstico" → "modo de inspeção"; "UAT diagnóstico" → "UAT smoke"
- **Final scan:** 0 prose hits across 389-line file (in-code-block forbidden-vocab references inside code samples like `'%diagnóstico%'` ILIKE patterns are acceptable per plan's prose-scan rule)
- **Audit script results:**
  - `cd vision-service && python -m scripts.audit_vocabulary` → exit 0 (vision-service/README.md not in SCAN_DIRS — pipeline/data/scripts/tests — manual prose scan is canonical)
  - `pnpm --filter web audit:vocabulary` → 8 pre-existing Phase 3 hits in apps/web/(login, signup, capture/validate, CapturePreview) unchanged from baseline (out-of-scope per STATE.md "Itens diferidos"); zero new hits from RAG runbook (which lives in vision-service/, not apps/web/)
  - `pnpm audit:vocabulary:db` → exit 2 in this shell session due to env vars not loaded; founder-side UAT (06-13 commit abbd567) confirmed exit 0 over 2761 chunks scanned (DB content unchanged by docs-only plan)

## Task Commits

1. `b1d212c` — `docs(06-14): add RAG Ingestion runbook section to vision-service/README.md` (1 file, +145 lines)
2. `[this commit]` — `docs(06-14): summary + STATE/ROADMAP — close Phase 6 implementation`

## Verification Summary

| Gate | Result |
|------|--------|
| `## RAG Ingestion (Phase 6)` heading present | ✓ (1 occurrence) |
| `## Smoke procedure (founder)` Phase 5 heading intact | ✓ (1 occurrence, line 34, unchanged) |
| Heading count delta `^## ` | ✓ (3 → 4, +1 exactly) |
| `pnpm rag:ingest` mentioned | ✓ (10 occurrences across quick-ref + procedures + troubleshooting) |
| `pnpm rag:purge` mentioned | ✓ (3 occurrences) |
| `pnpm rag:spot-check` mentioned | ✓ (2 occurrences) |
| `pnpm audit:vocabulary:db` mentioned | ✓ (2 occurrences) |
| `D-G1` hardcap referenced | ✓ |
| `D-N1` Contextual referenced | ✓ (10 occurrences) |
| `D-I2` re-ingestion procedure section | ✓ |
| `D-T1` post-ingest tagging section | ✓ |
| `content_hash` idempotency note | ✓ (4 occurrences) |
| `v1 limitation` callout (W5) | ✓ (1 occurrence) |
| `dimensoes intersect` named in W5 callout | ✓ (1 occurrence) |
| Troubleshooting subsection ≥ 5 issues | ✓ (10 issues) |
| LGPD prose-scan (regex `\bdiagn[oó]stico\b\|\btratamento\b\|\bcura\b` outside code blocks/inline code) | ✓ (0 hits) |
| Python audit `cd vision-service && python -m scripts.audit_vocabulary` | ✓ exit 0 |
| Phase 5 founder smoke section text unchanged | ✓ (verified via grep + line range comparison) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - LGPD bug] Rephrased two prose occurrences of forbidden vocab "diagnóstico"**
- **Found during:** Task 1 LGPD prose-scan (Step 5 of plan action)
- **Issue:** initial draft used "modo diagnóstico" (technical-sense for `--no-contextual` cost-inspection mode) and "UAT diagnóstico" (technical-sense for `pnpm rag:spot-check` smoke ritual) inside markdown table cells. The plan's prose-scan rule treats ALL non-code-block prose hits as failures regardless of technical-sense vs medical-sense.
- **Fix:** "modo diagnóstico" → "modo de inspeção"; "UAT diagnóstico" → "UAT smoke" (preserves intent + LGPD-clean)
- **Files modified:** vision-service/README.md (2 line edits)
- **Commit:** rolled into `b1d212c` (single README commit per plan's commit_protocol)

### Auth gates
None.

### Other deviations
None — plan executed verbatim apart from the LGPD rephrase above.

## Phase 6 closure status

This is the final Phase 6 implementation plan. After this commit:

| Plan | Status |
|------|--------|
| 06-01 Wave 0 test scaffolding | ✓ |
| 06-02 Canonical data | ✓ |
| 06-03 Deps + manifest | ✓ |
| 06-04 pdf_extractor + chunker | ✓ |
| 06-05 budget + embedder | ✓ |
| 06-06 contextualizer + manifest loader | ✓ |
| 06-07 [BLOCKING] migration 0005 + persister | ✓ |
| 06-08 ingest CLI + founder full ingest | ✓ |
| 06-09 embed.ts | ✓ |
| 06-10 build-queries + score-weights | ✓ |
| 06-11 rerank + search | ✓ |
| 06-12 LGPD audit extension | ✓ |
| 06-13 REQUIREMENTS + UAT + D-N1 reactivation | ✓ |
| **06-14 README runbook** | **✓ (this plan)** |

**14/14 plans complete.** Phase 6 is implementation-complete. Final pending step: `/gsd-verify-work 6` (phase verification by an isolated verifier agent — confirms all 4 RAG-* requirements + decision invariants + acceptance criteria + zero LGPD regressions).

## Self-Check: PASSED

- [x] vision-service/README.md exists and contains `## RAG Ingestion (Phase 6)` heading
- [x] commit b1d212c exists in git log
- [x] Phase 5 founder smoke procedure section unchanged
- [x] LGPD prose-scan returns 0 hits across 389-line file
- [x] All 4 root-level npm scripts referenced (`pnpm rag:ingest`, `pnpm rag:purge`, `pnpm rag:spot-check`, `pnpm audit:vocabulary:db`)
- [x] D-G1 + D-N1 + D-I2 + D-T1 + W5 callout + content_hash all referenced

---
*Phase: 06-rag-ingestao*
*Completed: 2026-05-05*
*Closes Phase 6 implementation. Pending: `/gsd-verify-work 6`*
