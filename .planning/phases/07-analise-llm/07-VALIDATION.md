---
phase: 7
slug: analise-llm
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-08
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 07-RESEARCH.md §"Validation Architecture" + 07-CONTEXT.md decisions D-A1, D-A2, D-S2, D-P1, D-U2, D-PR2.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (apps/web) — installed Wave 0 if absent |
| **Config file** | `apps/web/vitest.config.ts` (Wave 0 creates if absent) |
| **Quick run command** | `pnpm --filter @iridologista/web test:run -- <file>` |
| **Full suite command** | `pnpm --filter @iridologista/web test:run` |
| **Estimated runtime** | ~30-60s for unit suite (no LLM calls — fixtures only) |

---

## Sampling Rate

- **After every task commit:** Run quick command on the file modified
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Filled by planner from RESEARCH.md "Validation Architecture" section. Planner MUST cite test file paths from research and add specific test commands per task.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD-by-planner | TBD | 0 | LLM-01..04 | T-7-* | TBD | unit/integration | `pnpm --filter @iridologista/web test:run -- <path>` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Identified by RESEARCH.md as the Wave-0 test stubs the planner must include in PLAN files. Planner MUST map at least one task per file below into Wave 0 (or document in PLAN frontmatter why a file is moved later).

- [ ] `apps/web/lib/anthropic/__tests__/parser.test.ts` — section-boundary regex monotonic increase, out-of-range rejection, no false positives in body (D-S2)
- [ ] `apps/web/lib/anthropic/__tests__/audit.test.ts` — anchor rate calc D-A1 (sentence-split), forbidden vocab regex D-A2 (word-boundary), audit_metadata shape D-A3
- [ ] `apps/web/lib/anthropic/__tests__/diff.test.ts` — D-U2 classifier (adicionado/removido/corrigido/reescrito) at 30% threshold, edit_diff jsonb shape, zonas_editadas list, tipo_edicao text[]
- [ ] `apps/web/lib/anthropic/__tests__/prompts.test.ts` — system.md token count ≥ 2200 (cache_control ephemeral threshold), feature-injection placeholder substitution
- [ ] `apps/web/lib/anthropic/__tests__/client.test.ts` — Anthropic client config (cache_control on system, model env override, AbortController plumbing)
- [ ] `apps/web/lib/rag/__tests__/section-queries.test.ts` — D-PR2 frozen contract: every slug analyze.ts passes exists in SECTION_QUERY_TEMPLATES Record (CI gate)
- [ ] `apps/web/app/api/readings/[id]/analyze/__tests__/route.test.ts` — Route Handler auth gates (a-e in CONTEXT §Established Patterns), 409 on regen cap, 409 on report_delivered set, params Promise unwrap
- [ ] `apps/web/app/(dashboard)/leituras/[id]/editar/__tests__/save-action.test.ts` — saveReportDelivered Server Action: edit_diff calc, vocab block on save, status transition to 'edited', report_delivered_at carimbo
- [ ] `apps/web/components/readings/__tests__/EditorAccordion.test.tsx` — 13 sections render, disclaimer read-only, banner shows when audit_metadata flagged
- [ ] `apps/web/components/readings/__tests__/AnalysisCTA.test.tsx` — disabled when regen cap reached, disabled when report_delivered set, click POSTs to /api/readings/[id]/analyze
- [ ] `apps/web/components/readings/__tests__/AnalysisStream.test.tsx` — consumes ReadableStream, renders incremental sections, error fallback inline + retry button
- [ ] `supabase/tests/0007_jsonb_concat_order.sql` (path remap from initial `supabase/migrations/__tests__/0007_smoke.sql` to match actual project layout — see 07-01 plan) — jsonb_concat_sections_pt_br orders 1_..13_ correctly (NOT lex order: `13_` before `2_`), GENERATED columns recompute on jsonb update, IMMUTABLE PARALLEL SAFE flags set
- [ ] `apps/web/scripts/__tests__/audit-vocabulary.test.mjs` — DIRS includes `lib/anthropic`, `prompts/` allowlist marker honored
- [ ] `apps/web/lib/anthropic/__tests__/integration.test.ts` — **skip-by-default** via `describe.skip` quando `process.env.ANTHROPIC_INTEGRATION !== '1'`; opt-in: `ANTHROPIC_INTEGRATION=1 pnpm test:run lib/anthropic/__tests__/integration.test.ts`. Asserts: 14 sections received, encerramento appended server-side, anchor_rate computed, vocab clean, cache_creation_input_tokens > 0 na primeira call. Stub criado em 07-02 Task 3; founder preenche o body manualmente quando habilitar (fixture setup documentado em README ao primeiro uso)

> Wave 0 also installs/configures: `pnpm --filter @iridologista/web add -D vitest @testing-library/react jsdom`, `pnpm --filter @iridologista/web add react-markdown remark-gfm diff @types/diff`, vitest.config.ts with jsdom env for component tests.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Streaming UX feels natural in browser | LLM-01 / SC1 | Real Sonnet 4.6 latency varies 30-60s; subjective "feels live" judgment | Founder triggers `gerar análise` on a real reading from the dashboard; observes incremental section rendering, no full-page jank |
| Anchor rate ≥95% on real generations | LLM-03 / SC2 | LLM output non-deterministic; needs ≥10 distinct features samples | Run 10 consecutive generations on different readings; record anchor_rate_pct in audit_metadata; verify per-section ≥95% in sections 2-6 |
| Forbidden vocab absent in 10 consecutive generations | LLM-02 / SC3 | LLM output non-deterministic across distinct prompts | Run 10 generations; query `audit_metadata->'forbidden_vocab'` — must be empty array for all 10 |
| Disclaimer literal SPEC §6 lines 624-627 always present | LLM-03 / SC4 | Server-side append guarantees presence, but full literal match needs visual check | Open 3 generations in editor; verify disclaimer matches SPEC §6 word-for-word, not editable, collapsed by default |
| 13 collapsible sections editor UX | LLM-04 / SC5 / D-U1 | Subjective UX feel (accordion responsiveness, markdown preview legibility) | Founder edits 3 distinct sections in `/leituras/[id]/editar`, saves, verifies edit_diff/zonas_editadas/tipo_edicao populate correctly in DB |
| Cost per analysis ≤ $0.30 (target) | NFR-cost | Real Anthropic billing; first 5 dogfood runs only | Founder triggers 5 analyses; reads regeneration_log cost_estimate_usd entries; spot-checks against Anthropic console |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner fills Per-Task map)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (14 test files above) — distribution: 8 stubs in 07-02 (parser, audit, diff, prompts, client, integration skip-by-default, section-queries CI gate, audit-vocabulary script test), 1 in 07-08 (route.test.ts), 2 in 07-09 (AnalysisCTA.test.tsx, AnalysisStream.test.tsx), 3 in 07-10 (save-action.test.ts skip-by-default, EditorAccordion.test.tsx, EditorSectionItem.test.tsx). Migration smoke remapped to supabase/tests/0007_jsonb_concat_order.sql per 07-01 plan
- [ ] No watch-mode flags (`--watch` forbidden in plan acceptance criteria)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner completes per-task map)

**Approval:** pending — orchestrator created template; planner must complete Per-Task Verification Map before flipping `nyquist_compliant: true`.
