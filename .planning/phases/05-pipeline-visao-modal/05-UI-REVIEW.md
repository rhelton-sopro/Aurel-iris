---
phase: 5
slug: pipeline-visao-modal
audit_date: 2026-05-04
overall_score: 18/24
mode: code-only
---

# Phase 5 — UI Review

## Summary

Phase 5 ships a competent, functional surface for pipeline status — pt-BR copy is locked to a small table, LGPD vocabulary audit passes (verified: `python scripts/audit_vocabulary.py` → "OK: vocabulário proibido ausente em vision-service/"), and the components exercise sane primitives (Base UI Tooltip, shadcn Badge/Button) with good test coverage (16 vitest cases across both components, all passing in 05-14-SUMMARY). The code-quality fundamentals are solid.

What holds it back from "best in class" is **discoverability and feedback**: the `Falhou` badge does not signal that hovering reveals an error summary (no underline, info icon, or `cursor-help`); the Reprocessar in-flight spinner has no `aria-live` so screen-reader users only learn about the action via disabled-state change; and the badge palette in this neutral OKLCH theme makes `Aguardando` (outline), `Editado` (outline), and `Processando` (secondary) visually near-indistinguishable at a glance. Overall the implementation is correct but under-communicates state.

## Scores

| Pillar | Score | Verdict |
|--------|-------|---------|
| Copywriting | 3/4 | LGPD-clean, terse single-word labels. `Editado` is ambiguous in isolation; non-202 errors swallow user feedback. |
| Visuals | 2/4 | No tooltip-affordance on `Falhou`, spinner has no announce, three badge variants (outline/secondary/outline) collapse into "neutral pill" in the project's grayscale theme. |
| Color | 4/4 | Uses theme tokens exclusively (no hardcoded colors); destructive-only red is the sole accent, consistent with the neutral OKLCH palette. |
| Typography | 4/4 | Inherits theme. No new font sizes introduced; only `text-xs` (Badge built-in) and `text-sm` (Button `sm` size built-in). |
| Spacing | 3/4 | Uses Tailwind scale tokens (`mr-1 h-4 w-4`, `w-32`); no arbitrary `[7px]` values. `w-32` action column is too narrow for the Reprocessar label + icon and will truncate on edge cases. |
| Experience Design | 2/4 | Non-202 fetch failures fall through silently (`console.error` only); no toast, no inline error, no retry-after-failure UX. Tooltip-only-on-failed creates a hidden discoverability tax. |

**Overall: 18/24**

## Per-Pillar Findings

### Copywriting (3/4)

**Verdict:** Locked pt-BR vocabulary is LGPD-clean and concise; one label is ambiguous and one error path is silent.

**Findings:**
- `apps/web/components/readings/StatusBadge.tsx:40` — `'Editado'` as a standalone past-participle leaves the terapeuta wondering "edited by whom, when, and what?". In the table row, this label sits next to a date that means "created_at", not "edited_at" — wording mismatch with adjacent context. Better: `'Relatório editado'` or include an edit timestamp in a tooltip.
- `apps/web/components/readings/ReprocessButton.tsx:48-51` — On non-202 the only feedback is `console.error(...)` which is invisible to the terapeuta. After clicking Reprocessar and seeing the spinner spin and stop, the badge will still say `Falhou` — but the user has no idea whether (a) the dispatch failed, (b) it succeeded but the pipeline is still queued, or (c) something else entirely. Surface a toast (`sonner` is already in `components/ui/`) or inline error.
- `vision-service/data/error_summary.json:5-9` — All 5 strings reviewed; pt-BR is grammatical, em-dashes preserved (U+2014 not hyphen), no forbidden tokens (verified via Grep). However `'Falha temporária no processamento — tente novamente'` is the catch-all fallback and may surface for non-transient errors as well; from the user's perspective it's reassuring but potentially misleading. Acceptable trade-off for MVP.

**Top fix:** Wire `sonner` into `ReprocessButton` so non-202 produces `toast.error('Não foi possível reprocessar agora — tente novamente em instantes')`. Roughly 5 lines.

### Visuals (2/4)

**Verdict:** Components exist but under-communicate state — no tooltip affordance on the `Falhou` badge and no live-region announcement during reprocess.

**Findings:**
- `apps/web/components/readings/StatusBadge.tsx:70-80` — The `Falhou` badge wraps in a tooltip silently: there's no `cursor-help`, no underline, no info-icon (`<Info className="size-3" />` from `lucide-react`), no visual distinction from a non-tooltip-bearing failed badge (which exists when `errorSummary` is null). Terapeutas have no reason to hover the badge at all. The only signal the tooltip exists is hover → reveal, which is a discoverability anti-pattern. Add `cursor-help` to the wrapping `<span>` at minimum, ideally a small `<Info />` icon inline with the label.
- `apps/web/components/readings/ReprocessButton.tsx:72-75` — The `RefreshCw` spinner uses `aria-hidden`; the only state change visible to assistive tech is the button toggling `disabled`. No `aria-busy` on the button, no `aria-live="polite"` region announcing "Reprocessando...". Screen-reader users cannot tell the action is in flight.
- `apps/web/components/readings/StatusBadge.tsx:74-76` — The `<TooltipTrigger asChild>` wraps an extra `<span>` around the Badge, which in turn renders a `<span>` (default Badge tag). Two `<span>` layers around a string. Since `Badge` uses `useRender` and accepts a `render` prop, you can collapse this: `<TooltipTrigger render={<Badge variant={variant} data-status={...}>{label}</Badge>} />` or pass the Badge directly without the wrapping span. Minor DOM hygiene — not a blocker, but a small visual win (fewer focus targets, cleaner outline behavior).

**Top fix:** Add an inline `<Info className="ml-0.5 size-3" aria-hidden />` and `cursor-help` on the `Falhou` badge whenever `errorSummary` is present, so the tooltip is discoverable without relying on serendipitous hover.

### Color (4/4)

**Verdict:** Strictly token-driven; the destructive accent is the only chromatic color in the surface, consistent with the project's neutral OKLCH theme.

**Findings:**
- `apps/web/components/readings/StatusBadge.tsx:35-46` — Variant mapping uses the four core Badge variants (`default`, `secondary`, `destructive`, `outline`); zero hardcoded `#hex`/`rgb()`/`oklch()` literals. Verified via `Grep` — no matches for hex/rgb in `components/readings/`.
- `apps/web/app/globals.css:51-83` — The base theme is monochrome OKLCH (`primary`, `secondary`, `muted`, `accent` all in 0.205–0.97 lightness band, near-zero chroma). Only `--destructive` carries chroma (0.245 at hue 27 — red). The `Falhou` badge is therefore the *only* row that visually pops, which is exactly what destructive semantics call for. 60/30/10 reads as "98% neutral, 2% red on failed rows" — appropriate for a healthtech listing where red should be reserved for action-required state.
- No dark-mode regressions visible — Badge `destructive` variant has explicit `dark:bg-destructive/20` (`apps/web/components/ui/badge.tsx:16`), and the page uses semantic tokens (`text-muted-foreground`, `text-foreground`) that flip via `:root.dark`.

**Top fix:** Nothing material. If anything, consider a green/success accent token (`oklch(0.65 0.15 145)` or similar) for `Pronto` so success state has visual identity beyond "filled near-black pill" — currently `Pronto` (variant `default`) renders the same near-black as the page's `Nova leitura` CTA. **Optional, not a defect.**

### Typography (4/4)

**Verdict:** No new font sizes or weights introduced; everything inherits from the design system.

**Findings:**
- `apps/web/components/readings/StatusBadge.tsx` — No explicit text classes; relies on Badge's built-in `text-xs font-medium` (`apps/web/components/ui/badge.tsx:8`).
- `apps/web/components/readings/ReprocessButton.tsx` — No explicit text classes; `Button` size `sm` carries `text-[0.8rem]` (`apps/web/components/ui/button.tsx:26`). Single source of truth preserved.
- `apps/web/app/(dashboard)/leituras/page.tsx:49,57,58` — Page uses `text-2xl font-semibold` (h1), `text-lg font-medium` (empty-state heading), `text-sm text-muted-foreground` (subtext). Three sizes total, all standard Tailwind scale. No arbitrary `text-[Npx]` values.
- `globals.css:7-12` — Theme defines `--font-sans`, `--font-mono`, `--font-heading` (heading aliased to sans). No font-stack drift in this phase.

**Top fix:** None — typography is the cleanest pillar.

### Spacing (3/4)

**Verdict:** Uses Tailwind tokens cleanly; the `w-32` action column is undersized for two coexisting button styles.

**Findings:**
- `apps/web/components/readings/ReprocessButton.tsx:73` — `mr-1 h-4 w-4` for the icon spacing — Tailwind tokens, fine. No arbitrary values. `Grep` for `\[.*px\]|\[.*rem\]` in `components/readings/` returned zero matches.
- `apps/web/app/(dashboard)/leituras/page.tsx:73` — `<TableHead className="w-32" />` (128px) is the action column. The Reprocessar button at size `sm` is `h-7` (`button.tsx:26`) plus `<RefreshCw>` (h-4) + `mr-1` + "Reprocessar" label (~92px text). With `px-2.5` button padding (10px each side), full width is ≈ 18 (svg) + 4 (gap) + 92 (text) + 20 (padding) = ~134px. **Already overflows the 128px column.** TableCell has `whitespace-nowrap` (`table.tsx:88`), so it will simply expand and push the rest of the row. Either widen the column to `w-40` or shorten the label to "Tentar novamente" / icon-only with tooltip.
- `apps/web/app/(dashboard)/leituras/page.tsx:107-122` — When a row is `failed` AND `isRascunho`-eligible (theoretically impossible per business logic, but the code allows both conditional renders to fire), both `<Continuar>` link AND `<ReprocessButton>` would render in the same cell with no `gap-` or `flex` parent — they would stack inline with default whitespace. Defensive but loose. Wrap the cell content in `<div className="flex items-center gap-2">` for predictable layout regardless of business invariants.

**Top fix:** Widen the action column from `w-32` → `w-40` (or `min-w-[10rem]`) so Reprocessar fits without expanding the cell into the Status column.

### Experience Design (2/4)

**Verdict:** Loading state is partial; error state on dispatch failure is silent; no in-place state-transition reassurance after Reprocessar succeeds.

**Findings:**
- `apps/web/components/readings/ReprocessButton.tsx:36-60` — Loading state ✅ (spinner + disabled), success path ✅ (`router.refresh()`), but **error path** (non-202, fetch throws) only logs to `console.error`. The terapeuta sees the spinner stop, the button re-enable, and… nothing. No toast, no inline error, no aria-live. The button does not become red, does not announce "Falha", and the badge still says `Falhou`. From a UX standpoint, the click was a no-op as far as the user can tell.
- `apps/web/components/readings/StatusBadge.tsx:33` — `Tooltip` wraps trigger directly without exposing `aria-describedby` linkage — Base UI does this internally for hover/focus, but on touch devices the tooltip is unreachable (no long-press default in Base UI tooltip). Mobile terapeutas cannot read `error_summary` at all; they see only the bare `Falhou` badge. If the listing is ever used on iPad in-consultório (which the PWA target suggests it is), this is a real gap.
- `apps/web/app/(dashboard)/leituras/page.tsx:101-106` — `errorSummary` is read from `r.vision_features.processing_metadata.error_summary` — but the `vision_features` jsonb cast is `as { processing_metadata?: { error_summary?: string } } | null`, which silently swallows shape drift. If 05-12 webhook ever writes `error_summary: { code, message }` instead of a plain string (a refactor risk), the badge will still render as a tooltip-less `Falhou` and the failure mode will be invisible. Consider Zod-parsing the `vision_features` shape at the page boundary.
- No empty-state for "all readings are failed" — the founder-smoke happy-path is visualized, but a terapeuta who returns Monday to find every Friday-night reading failed gets no aggregate signal (no banner, no count). Edge case for MVP, deferrable.
- `Editado` status has no associated action — it's a terminal display state. No `Ver relatório` button, no link to `/leituras/[id]`. The CONTEXT explicitly defers `/leituras/[id]` to Fase 7, but the row still fails to invite any next action for `ready` and `edited` rows. Today these rows are visually inert. Acceptable given Fase 7 is the destination, but worth flagging.

**Top fix:** Add `import { toast } from 'sonner'` to `ReprocessButton.tsx` and replace the two `console.error` calls with `toast.error(...)` invocations carrying short pt-BR messages from a tiny inline catalog (e.g. `'Não foi possível reprocessar agora — tente novamente'`). Keeps non-202 paths visible without changing the trigger-route contract.

## Cross-Cutting Findings

- **Tooltip discoverability + mobile reachability** spans Visuals and Experience Design: the affordance is missing (no info icon, no cursor-help — Visuals) AND on touch devices the tooltip is structurally unreachable (Base UI tooltip is hover/focus-only — Experience Design). Either both fixes happen or the `error_summary` becomes an inline secondary line under the badge for consistent reach.
- **Silent failure on non-202** spans Copywriting and Experience Design: the user-facing copy for "Reprocessar dispatched but server said no" is missing (Copywriting) and the structural feedback channel is missing (Experience Design). One sonner toast call solves both.
- **Action cell crowding** spans Spacing and Visuals: `w-32` is too tight (Spacing) and the layout has no flex parent so two siblings would stack unpredictably (Visuals). One `<div className="flex items-center gap-2 w-40">` solves both.
- **`Editado` semantics** spans Copywriting (label is ambiguous) and Experience Design (no associated action). The phase explicitly defers Fase 7 detail page, so the action gap is deferrable, but the label gap is fixable today.

## Top 3 Fixes

1. **Wire `sonner` toasts into `ReprocessButton.tsx` non-202 / fetch-throw paths** — converts a silent `console.error` into a user-visible failure signal. Highest impact-per-effort (~5 lines), addresses Experience Design and Copywriting simultaneously, removes the worst current UX bug (silent dispatch failure). Touch:
   - `apps/web/components/readings/ReprocessButton.tsx:46-58` — replace both `console.error` calls with `toast.error('Não foi possível reprocessar agora — tente novamente')` plus a `console.error` for the dev log.

2. **Add tooltip-affordance + mobile fallback to `Falhou` badge** — currently the `error_summary` is hidden behind a hover-only Base UI tooltip with no visual cue. Add an inline `<Info className="ml-0.5 size-3" aria-hidden />` icon and `cursor-help` when `errorSummary` is present, AND render the error_summary as a small `<p className="text-xs text-muted-foreground">` line below the badge in the row (or inside the same cell) so touch users on iPad reach it. Addresses Visuals + Experience Design + the entire Copywriting investment in `error_summary.json` (which today only ~50% of users can actually read). Touch:
   - `apps/web/components/readings/StatusBadge.tsx:70-81` — add `cursor-help` and info icon to the trigger span; consider rendering `errorSummary` as a `<span class="block text-[0.7rem] text-muted-foreground">` line under the badge for mobile reach.

3. **Resize and structure the action column** — change `w-32` → `min-w-[10rem]` on the `<TableHead className="w-32" />` (line 73), and wrap the action TableCell content in a `<div className="flex items-center gap-2">` so the (mutually-exclusive today, but easy to break) Continuar + Reprocessar buttons render predictably and the row layout is stable. Defends against future business-rule drift. Touch:
   - `apps/web/app/(dashboard)/leituras/page.tsx:73` and `:107-122`.

## Methodology

- **Files audited:**
  - `apps/web/components/readings/StatusBadge.tsx` (84 LoC)
  - `apps/web/components/readings/StatusBadge.test.tsx` (78 LoC, 9 vitest cases)
  - `apps/web/components/readings/ReprocessButton.tsx` (79 LoC)
  - `apps/web/components/readings/ReprocessButton.test.tsx` (104 LoC, 7 vitest cases)
  - `apps/web/app/(dashboard)/leituras/page.tsx` (132 LoC)
  - `vision-service/data/error_summary.json` (12 lines, 5 D-E1 strings)
  - Reference: `apps/web/components/ui/badge.tsx`, `apps/web/components/ui/button.tsx`, `apps/web/components/ui/tooltip.tsx`, `apps/web/components/ui/table.tsx`, `apps/web/app/globals.css`
  - Reference: `.planning/phases/05-pipeline-visao-modal/{05-CONTEXT.md, 05-14-PLAN.md, 05-14-SUMMARY.md, 05-16-PLAN.md, 05-16-SUMMARY.md}`
- **Playwright runtime:** No. `mcp__playwright__*` tools not registered in this session; `curl http://localhost:3000` returned 000 (no dev server). Code-only audit — no runtime screenshots captured.
- **LGPD vocabulary check:** PASS. `cd vision-service && python scripts/audit_vocabulary.py` → exit 0, output: `OK: vocabulário proibido ausente em vision-service/`. Cross-checked via `Grep -i 'diagnóstico|diagnostico|tratamento|cura|doença|patologia|remédio|medicação'` against `apps/web/components/readings/` and `vision-service/data/error_summary.json` — zero matches in both paths.
- **Registry safety audit:** Skipped. `components.json` not present at repo root (`test -f components.json` → NO_SHADCN). The project consumes shadcn/Base UI primitives via direct file copies in `apps/web/components/ui/`, not via the shadcn CLI registry — no third-party registries to audit.
- **Adversarial stance applied:** Started from "every pillar fails until proven otherwise". Two pillars (Color, Typography) earned 4/4 only after explicit Grep evidence (zero hardcoded colors, zero arbitrary text sizes). Two pillars (Visuals, Experience Design) scored 2/4 because the silent non-202 failure path and the missing tooltip affordance are real defects that would degrade founder-smoke and any cliente-facing demo.
