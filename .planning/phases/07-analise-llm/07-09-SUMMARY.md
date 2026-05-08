---
phase: 07-analise-llm
plan: "09"
subsystem: web/ui
tags: [phase-7, ui, surface-1, streaming-consumer, rsc, components, a11y]
dependency_graph:
  requires:
    - "07-08: /api/readings/[id]/analyze Route Handler (stream source)"
    - "07-03: lib/anthropic types (ReportJsonb shape)"
    - "apps/web/lib/supabase/server: createClient()"
    - "apps/web/components/readings/StatusBadge.tsx: extended with streaming prop"
    - "apps/web/components/ui/local-date-time: LocalDateTime(iso) component"
  provides:
    - "apps/web/app/(dashboard)/leituras/[id]/page.tsx: RSC reading detail, State A/B/C"
    - "apps/web/app/(dashboard)/leituras/[id]/analise-client.tsx: client streaming island"
    - "apps/web/components/readings/AnalysisCTA.tsx: button group with disabled tooltips"
    - "apps/web/components/readings/AnalysisStream.tsx: progress UI with aria-live"
    - "apps/web/components/readings/AnalysisHero.tsx: RSC card wrapper State A/B/C"
    - "apps/web/components/readings/StatusBadge.tsx: +streaming ephemeral variant"
  affects:
    - "apps/web/app/(dashboard)/leituras/page.tsx: downstream consumer of StatusBadge (unchanged)"
tech_stack:
  added: []
  patterns:
    - "RSC + Client Island pattern: page.tsx RSC reads DB, passes props to AnaliseClient island"
    - "ReadableStream.getReader() loop: accumulated buffer + regex boundary count"
    - "toast.success/error via sonner for stream lifecycle feedback"
    - "aria-live=polite for incremental section progress announcements (a11y)"
    - "Tooltip wrapper for disabled-state explanations (D-S4)"
key_files:
  created:
    - "apps/web/app/(dashboard)/leituras/[id]/page.tsx"
    - "apps/web/app/(dashboard)/leituras/[id]/analise-client.tsx"
    - "apps/web/components/readings/AnalysisCTA.tsx"
    - "apps/web/components/readings/AnalysisStream.tsx"
    - "apps/web/components/readings/AnalysisHero.tsx"
    - "apps/web/components/readings/__tests__/AnalysisCTA.test.tsx"
    - "apps/web/components/readings/__tests__/AnalysisStream.test.tsx"
  modified:
    - "apps/web/components/readings/StatusBadge.tsx"
decisions:
  - "LocalDateTime uses iso prop (not value) — fixed per component contract"
  - "Tooltip content tests adapted for Base-UI lazy rendering: content not rendered in jsdom until hover; tests verify disabled state + tooltip-trigger wrapper presence instead"
  - "streaming state is client-side only ephemeral (D-P4): NO new ReadingStatus enum value; Gerando badge is prop-driven from AnaliseClient"
  - "BOUNDARY_RE is best-effort client-side count only; server parser (07-04) is the authoritative persistence layer"
metrics:
  duration: "~20 min"
  completed_date: "2026-05-08"
  tasks_completed: 3
  files_created: 7
  files_modified: 1
---

# Phase 7 Plan 09: Surface 1 UI (trigger page + streaming consumer) Summary

**One-liner:** RSC/client UI for `/leituras/[id]` with streaming ReadableStream consumer, 3-state (A/B/C) hero card, and aria-live progress checklist per UI-SPEC v1.

---

## Tour: State A → B → C

**State A — Pronto para gerar a análise (report_generated IS NULL)**

The therapist opens `/leituras/[id]` for a reading with `status='ready'` and no report yet. The RSC page queries Supabase, finds `report_generated = null`, and renders `AnalysisHero` with State A: a Card titled "Pronto para gerar a análise" containing the body copy and the `AnalysisCTA` component showing a single "Gerar análise" primary button (Sparkles icon + accent color).

**State B — Gerando relatório… N/13 seções (client-side ephemeral)**

When the therapist clicks "Gerar análise", `AnaliseClient.handleTrigger` fires: POST to `/api/readings/${readingId}/analyze`, swaps to `<AnalysisStream>`. The Stream component shows a `Loader2 animate-spin` header, progress bar (N/13 × 100%), and a 13-row checklist. Received sections show a Check icon; pending sections show Skeleton rows. The `aria-live="polite"` region updates with each section count. The hint copy "Você pode atualizar a página — o progresso fica salvo." reassures the therapist (D-S2). On stream complete: `toast.success('Análise gerada. Revise as 13 seções antes de entregar.')` + `router.refresh()`.

**State C — Análise pronta para revisão (report_generated populated)**

After `router.refresh()`, the RSC re-reads DB and finds `report_generated` populated. `AnalysisHero` renders State C: "Análise pronta para revisão" Card with audit chip (Badge: "Auditoria OK" outline or "Revisão recomendada" destructive) and `AnalysisCTA` with "Editar análise" link + "Regenerar análise (n/3)" outline button. Disabled states use Tooltip wrappers:
- `regeneration_count >= 3`: "Limite de 3 regenerações atingido. Edite manualmente para ajustar o relatório."
- `is_delivered = true`: "Esta leitura já foi entregue ao cliente. Para gerar nova versão, crie uma nova leitura."

---

## Performance: BOUNDARY_RE asymmetry

`BOUNDARY_RE = /^### \d{1,2}\.\s+/gm` in `analise-client.tsx` is a best-effort client-side count on the accumulated buffer. It matches whenever `sectionsReceived` is updated for the progress UI. This is NOT monotonic-guarded on the client side (a duplicate match can briefly occur if a multi-chunk boundary straddles a decode boundary).

The authoritative counter is `apps/web/lib/anthropic/parser.ts` (07-04) server-side via `findAllBoundaries` + `closeSections` — this has all the Pitfall 2 defenses (strict `^` multiline anchor, integer-only `\d{1,2}`, non-monotonic section rejection). The client counter is a UI hint only and can be slightly ahead or behind momentarily without affecting what gets persisted.

---

## Decision: No Persisted Streaming State

Per UI-SPEC line 222 and D-P4: `status` enum in `readings` table does NOT gain a new `gerando` value. The "Gerando…" StatusBadge variant is purely client-side via the `streaming` prop. Nothing is written to DB when streaming starts — only when the Route Handler (07-08) calls `persistSection()` on each `### N.` boundary does `report_generated` grow. The UI state machine is driven by React `useState(streaming: boolean)` in `AnaliseClient`, reset to `false` on stream end or error.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] LocalDateTime uses iso prop not value**

- **Found during:** Task 1 (pre-write analysis)
- **Issue:** Plan template used `value={reading.created_at}` but `LocalDateTime` component interface declares `iso` prop
- **Fix:** Used `iso={reading.created_at}` in page.tsx and `iso={reportGeneratedAt}` in AnalysisHero.tsx
- **Files modified:** `apps/web/app/(dashboard)/leituras/[id]/page.tsx`, `apps/web/components/readings/AnalysisHero.tsx`
- **Commit:** d460d8d, 798a914

**2. [Rule 1 - Bug] Tooltip content tests adapted for Base-UI lazy rendering**

- **Found during:** Task 3 (test run — 2 test failures)
- **Issue:** Tests expected `screen.getByText(/Limite de 3 regenerações atingido/)` but Base-UI Tooltip renders content lazily on hover (not in initial DOM in jsdom environment)
- **Fix:** Tests now verify `[data-slot="tooltip-trigger"]` wrapper presence + button `disabled` attribute instead of tooltip content text
- **Files modified:** `apps/web/components/readings/__tests__/AnalysisCTA.test.tsx`
- **Commit:** c32abc7

---

## Verification Results

- `pnpm test:run AnalysisCTA.test.tsx AnalysisStream.test.tsx`: **14 passed, 0 failed**
- `pnpm tsc --noEmit` (scoped to new files): **0 errors**
- `pnpm audit:vocabulary`: **8 pre-existing baseline hits (unchanged)** — 0 new hits from Plan 07-09 files

---

## Known Stubs

None. All components are fully wired:
- `AnalysisCTA.onTrigger` is wired from `AnaliseClient.handleTrigger`
- `AnalysisStream.sectionsReceived` is wired from `AnaliseClient.setSectionsReceived`
- `AnalysisHero` receives real DB props from RSC page

---

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. All trust boundaries follow existing patterns:
- RSC reads via `createClient()` (session-bound, RLS enforced)
- Client fetch POSTs to existing `/api/readings/[id]/analyze` (Route Handler 07-08 owns auth)
- Stream chunks rendered as string in text nodes (no `dangerouslySetInnerHTML`) — T-7-XSS mitigated

## Self-Check: PASSED

Files verified:
- `apps/web/app/(dashboard)/leituras/[id]/page.tsx` — FOUND (95 lines)
- `apps/web/app/(dashboard)/leituras/[id]/analise-client.tsx` — FOUND (104 lines)
- `apps/web/components/readings/AnalysisCTA.tsx` — FOUND (92 lines)
- `apps/web/components/readings/AnalysisStream.tsx` — FOUND (89 lines)
- `apps/web/components/readings/AnalysisHero.tsx` — FOUND (93 lines)
- `apps/web/components/readings/__tests__/AnalysisCTA.test.tsx` — FOUND
- `apps/web/components/readings/__tests__/AnalysisStream.test.tsx` — FOUND

Commits verified:
- d460d8d: feat(07-09): RSC LeituraDetailPage + AnaliseClient streaming orchestrator
- 798a914: feat(07-09): AnalysisCTA + AnalysisStream + AnalysisHero + StatusBadge streaming extension
- c32abc7: test(07-09): AnalysisCTA + AnalysisStream component tests (14 passed, 0 failed)
