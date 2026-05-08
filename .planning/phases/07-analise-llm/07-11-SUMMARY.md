---
phase: 07-analise-llm
plan: 11
subsystem: ui
tags: [phase-7, listing, cta-extension, navigation, conditional-rendering, supabase-select]

# Dependency graph
requires:
  - phase: 07-analise-llm
    provides: "07-09 detail page /leituras/[id] and 07-10 editor /leituras/[id]/editar"
provides:
  - "5th column 'Análise' in /leituras/page.tsx with 4 conditional CTAs"
  - "Complete navigational loop: lista → detalhe → editar → lista"
affects: [07-verify, 07-uat]

# Tech tracking
tech-stack:
  added: []
  patterns: ["renderAnalysisLink helper function — server component helper returning React.ReactNode based on (is_delivered, status, report_generated)"]

key-files:
  created: []
  modified:
    - apps/web/app/(dashboard)/leituras/page.tsx

key-decisions:
  - "Fallback — (dash span) for pending/processing/failed — no CTA when vision pipeline has not yet run"
  - "is_delivered check takes priority over status checks — delivered readings always show 'Ver entregue' regardless of status"
  - "Gerar análise uses variant=default (primary style) to visually emphasize call-to-action; other CTAs use variant=outline"
  - "renderAnalysisLink extracted as named function at module scope (not inline) for readability"

patterns-established:
  - "renderAnalysisLink(reading) pattern: derive 3 boolean flags (hasReport, isDelivered, status) then cascade checks; return React.ReactNode"

requirements-completed: [LLM-01, LLM-04]

# Metrics
duration: 15min
completed: 2026-05-08
---

# Phase 07 Plan 11: Listing Extension Summary

**5th 'Análise' column added to /leituras/page.tsx with 4 conditional CTAs (Ver entregue / Continuar editando / Ver análise / Gerar análise) closing the navigational loop lista ↔ detalhe ↔ editar**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-08T00:00:00Z
- **Completed:** 2026-05-08T00:15:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Extended Supabase select query to include `report_generated` and `is_delivered` fields
- Added `renderAnalysisLink` function covering all 4 CTA states defined in UI-SPEC §Surface 3 lines 150-157
- Added "Análise" TableHead and new TableCell per row in the existing table structure
- Navigational loop is now closed: therapist can go `/leituras` → click "Gerar análise" → `/leituras/[id]` → click "Editar análise" → `/leituras/[id]/editar` → save → "Voltar para leituras" → back in listing

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend leituras/page.tsx with Análise column** - `ac1bb80` (feat)

**Plan metadata:** (see SUMMARY commit below)

## Files Created/Modified

- `apps/web/app/(dashboard)/leituras/page.tsx` — Extended with `report_generated`/`is_delivered` in select, `renderAnalysisLink` function, 5th "Análise" column (TableHead + TableCell per row)

## Decisions Made

- **Fallback `—` for non-actionable statuses:** `pending`, `processing`, and `failed` statuses have no CTA in the Análise column because the vision pipeline hasn't completed yet (or failed). The existing last column already handles `failed` via ReprocessButton. This separation of concerns keeps each column focused.
- **`is_delivered` check is highest priority:** A delivered reading should always show "Ver entregue" regardless of other status values, because delivery is terminal.
- **`Gerar análise` uses `variant='default'`** (primary/filled button) to emphasize it's the primary CTA when no report exists yet. All other Análise CTAs use `variant='outline'` per the existing pattern in the file.
- **React import added** explicitly because `renderAnalysisLink` returns `React.ReactNode` and the function signature references it. This is needed even in Next.js 15 App Router for explicit type annotations outside JSX scope.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- **TypeScript check via worktree:** The worktree shares code with the main repo but does not have its own `node_modules`. Running `tsc --noEmit` from the worktree's `apps/web` dir fails with module-not-found errors for every file (same errors in `(auth)/login/page.tsx`, etc.). Verified the same errors exist in the main repo pre-existing worktree by running tsc from the main repo — no errors on `leituras/page.tsx`. Pre-existing vocabulary audit failures (`diagnóstico` in code comments) also confirmed pre-existing in main repo. Content correctness verified via Node.js script (8/8 checks pass).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Listing page is fully connected to the Phase 7 detail and editor pages
- All 4 UI-SPEC §Surface 3 copy strings are present (`Ver análise`, `Gerar análise`, `Continuar editando`, `Ver entregue`)
- Ready for 07-UAT verification scenarios

## Known Stubs

None — all conditional CTAs are wired to real routes created in 07-09 and 07-10. The `report_generated` field check is live against the database column populated by the LLM pipeline (07-01 through 07-08).

## Threat Flags

None — changes are read-only extensions to an existing RLS-protected query. The `reading.id` used in Link hrefs comes directly from the same query (RLS-enforced), and destination routes `/leituras/[id]` and `/leituras/[id]/editar` have their own auth gates (RSC + Route Handler level, built in 07-09 and 07-10).

## Self-Check

- [x] `apps/web/app/(dashboard)/leituras/page.tsx` modified and committed: ac1bb80
- [x] Contains `report_generated` in select
- [x] Contains `is_delivered` in select
- [x] Contains all 4 CTA literals: "Ver análise", "Gerar análise", "Continuar editando", "Ver entregue"
- [x] Contains "Análise" TableHead
- [x] Contains `renderAnalysisLink` function
- [x] No vocabulary violations introduced in leituras/page.tsx
- [x] No file deletions in commit ac1bb80

## Self-Check: PASSED

---
*Phase: 07-analise-llm*
*Completed: 2026-05-08*
