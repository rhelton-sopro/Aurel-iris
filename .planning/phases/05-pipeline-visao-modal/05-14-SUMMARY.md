---
phase: 05-pipeline-visao-modal
plan: 14
subsystem: web-ui
tags: [vision, ui, react, badge, listing, reprocess, lgpd]
dependency_graph:
  requires:
    - 05-11  # trigger route /api/readings/[id]/process (ReprocessButton posts here)
    - 05-10  # vision_features.processing_metadata.error_summary contract
  provides:
    - StatusBadge component (all status variants, Rascunho override, tooltip on failed)
    - ReprocessButton component (POST to trigger route, disabled while in-flight/processing)
    - /leituras listing with pipeline status surface
  affects:
    - apps/web/app/(dashboard)/leituras/page.tsx
    - apps/web/components/readings/
tech_stack:
  added: []
  patterns:
    - Server component wrapping client component (StatusBadge wraps Tooltip from tooltip.tsx)
    - Client component with useRouter.refresh() instead of polling (D-T2)
    - Optimistic disable pattern (setPending before await)
key_files:
  created:
    - apps/web/components/readings/StatusBadge.tsx
    - apps/web/components/readings/StatusBadge.test.tsx
    - apps/web/components/readings/ReprocessButton.tsx
    - apps/web/components/readings/ReprocessButton.test.tsx
  modified:
    - apps/web/app/(dashboard)/leituras/page.tsx
decisions:
  - StatusBadge is a server component with no 'use client' — tooltip.tsx has "use client" but is safely imported from server component context per Next.js App Router design
  - router.refresh() chosen over polling (D-T2) — server re-renders listing after successful Reprocessar POST
  - Tooltip is suppressed when errorSummary is null/undefined/empty (not just on non-failed status)
  - isRascunho=true overrides ALL status variants including failed (Rascunho is user-actionable state)
  - STATUS_LABEL/STATUS_CLASS/RASCUNHO_CLASS dicts removed — StatusBadge is now single source of truth
metrics:
  duration: 25m
  completed: 2026-05-04
  tasks_completed: 3
  files_created: 4
  files_modified: 1
---

# Phase 5 Plan 14: UI Status Surface (StatusBadge + ReprocessButton) Summary

Surfaced the Modal pipeline state in the /leituras listing via a `StatusBadge` server component and `ReprocessButton` client component, replacing the hardcoded inline `<span>` badge with a domain component that supports pt-BR copy, Rascunho override, tooltip-on-failed (D-F2), and retry-on-failed (D-T3).

## What Was Built

### StatusBadge (`apps/web/components/readings/StatusBadge.tsx`)

Server component wrapping shadcn `<Badge>` with a locked pt-BR copy table:

| status | label (pt-BR) | variant |
|--------|---------------|---------|
| pending | Aguardando | outline |
| processing | Processando | secondary |
| ready | Pronto | default |
| failed | Falhou | destructive |
| edited | Editado | outline |

**Rascunho override:** When `isRascunho=true`, renders 'Rascunho' with variant `outline` regardless of underlying status. This preserves the Fase 3 UX: partial-capture readings (1..5 of 6 photos, status=pending) show as Rascunho with a 'Continuar' button rather than 'Aguardando'.

**Tooltip on failed (D-F2):** When `status='failed'` AND `!isRascunho` AND `errorSummary` is populated, wraps the badge in shadcn `<TooltipProvider>/<Tooltip>` showing the literal `error_summary` string. No tooltip rendered when any of these conditions fail (no tooltip for non-failed, no tooltip for rascunho, no tooltip when errorSummary is null/undefined/empty).

**data-status attribute:** Badge exposes `data-status` for E2E test hooks ('rascunho' override or the actual status value).

### ReprocessButton (`apps/web/components/readings/ReprocessButton.tsx`)

Client component (`'use client'`) with optimistic disable + router.refresh on success:

- **Disabled states:** `status === 'processing'` (D-T3 — pipeline already running) OR `pending === true` (POST is in-flight)
- **Click handler:** `setPending(true)` → `fetch('/api/readings/${readingId}/process', { method: 'POST' })` → on 202: `router.refresh()` → `setPending(false)` in finally
- **On non-202:** logs error, does NOT call `router.refresh()` — UI stays as-is, badge reflects server state on next navigation
- **No polling (D-T2):** `router.refresh()` triggers a server re-render of the listing RSC; terapeuta sees badge transition `failed → processing` immediately after clicking Reprocessar
- **aria-label:** `Reprocessar leitura ${readingId}` — ties button to reading for accessibility and repudiation audit (T-05-14-06)

### `/leituras` page changes (`apps/web/app/(dashboard)/leituras/page.tsx`)

1. **Removed** `STATUS_LABEL`, `STATUS_CLASS`, `RASCUNHO_CLASS` dicts and the `badgeClass`/`badgeLabel` derivations — StatusBadge owns this mapping
2. **Added** `vision_features` to the Supabase query select clause (needed for error_summary tooltip)
3. **Replaced** the inline `<span>` badge with `<StatusBadge status=... isRascunho=... errorSummary=...>`
4. **Added** `<ReprocessButton>` conditionally on `status === 'failed'` in the actions cell
5. **Preserved** the Rascunho 'Continuar' link — both can coexist (a reading cannot be simultaneously failed and rascunho per business logic, but the layout accommodates both)

## Decisions Made

1. **StatusBadge as server component:** No `'use client'` needed — no interactivity. Tooltip components from `tooltip.tsx` are client components but Next.js App Router allows server components to import and render client components. The tooltip is hydrated on the client.

2. **router.refresh() not revalidatePath():** `revalidatePath` is a server-side API (server actions, route handlers). `router.refresh()` is the correct client-side API to invalidate the RSC cache and re-fetch the listing. Consistent with D-T2 (no polling).

3. **isRascunho overrides tooltip:** A failed reading that is also somehow a rascunho (edge case) shows 'Rascunho' — the rascunho override takes total precedence, preventing the tooltip from showing error_summary that doesn't apply to the rascunho UX path.

4. **errorSummary as `string | null`:** Typed nullable to match the Supabase `jsonb` nullable return. The `?? null` coercion in the page normalizes `undefined` to `null` before passing to the prop.

## Threat Model Compliance

All T-05-14-0x threats mitigated as designed:
- **T-05-14-01** (privilege escalation): ReprocessButton only carries `readingId`; trigger route (05-11) enforces ownership server-side
- **T-05-14-02** (disabled state circumvented): Server-side status guard is authoritative; disabled UI is UX-only
- **T-05-14-03** (error_summary leaks): error_summary is pt-BR catalog strings (D-E1); no PII, no stack traces
- **T-05-14-04** (XSS via error_summary): Rendered as `{errorSummary}` JSX text — React escapes by default
- **T-05-14-05** (DoS repeated clicks): `setPending(true)` before await disables button immediately; server-side status guard is secondary gate
- **T-05-14-06** (repudiation): `aria-label="Reprocessar leitura <id>"` ties button to reading; server logs trace each click

## LGPD Compliance

All UI strings pass `pnpm audit:vocabulary` (no 'diagnóstico'/'tratamento'/'cura'):
- Badge copy: 'Aguardando', 'Processando', 'Pronto', 'Falhou', 'Editado', 'Rascunho'
- Button copy: 'Reprocessar'
- error_summary strings from D-E1 catalog (set by vision-service, not this plan) are clean by design

## Test Coverage

**StatusBadge.test.tsx** (9 tests):
- 5 × `it.each` for all status variants (pt-BR copy rendered)
- Rascunho override replaces Aguardando
- Failed without errorSummary renders badge without tooltip wrapper
- data-status attribute matches status
- data-status='rascunho' override
- Failed with errorSummary: badge label still visible
- Non-failed with errorSummary: errorSummary text NOT rendered
- isRascunho=true overrides even for failed status

**ReprocessButton.test.tsx** (7 tests):
- Renders 'Reprocessar' label + data-testid
- Disabled when status='processing' (D-T3)
- Enabled when status='failed'
- POSTs to correct URL with method='POST'
- Calls router.refresh on 202
- Does NOT call router.refresh on 502
- Button disabled while POST in-flight, re-enabled after

## Deviations from Plan

None — plan executed exactly as specified.

The `tooltip.tsx` exports confirmed (`Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger`) match the plan's expected API. No import adjustment needed.

## Known Stubs

None. All props are wired to real data:
- `status` comes from `r.status` (Supabase row)
- `isRascunho` computed from actual count + status
- `errorSummary` extracted from `r.vision_features.processing_metadata.error_summary`

The `vision_features` field will be `null` until 05-12 webhook writes it. The `?.processing_metadata?.error_summary ?? null` chain safely produces `null` in the meantime, suppressing the tooltip.

## Self-Check: PASSED

- `apps/web/components/readings/StatusBadge.tsx` — created, 5 status labels present, Rascunho override present
- `apps/web/components/readings/StatusBadge.test.tsx` — created, 9 test cases
- `apps/web/components/readings/ReprocessButton.tsx` — created, 'use client', router.refresh(), disabled guard
- `apps/web/components/readings/ReprocessButton.test.tsx` — created, 7 test cases
- `apps/web/app/(dashboard)/leituras/page.tsx` — modified, STATUS_LABEL/STATUS_CLASS/RASCUNHO_CLASS removed, vision_features added to query, StatusBadge + ReprocessButton rendered
