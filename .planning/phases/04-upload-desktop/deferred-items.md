# Phase 04 — Deferred Items

Out-of-scope discoveries logged during plan execution. Do NOT fix in current plan.

## audit:vocabulary pre-existing failures (Fase 3)

**Discovered during:** Plan 04-01 execution (Task 1 verification)
**Files affected (all pre-existing, not modified by 04-01):**

- `apps/web/app/(auth)/login/page.tsx:58, 75` — comments using "diagnóstico"
- `apps/web/app/(auth)/signup/page.tsx:56, 74` — comments using "diagnóstico"
- `apps/web/app/api/capture/validate/route.ts:9, 92, 139` — comments using "validar"/"Diagnóstico"
- `apps/web/components/capture/CapturePreview.tsx:101` — debug overlay JSX comment using "diagnóstico"

**Nature:** All occurrences are in **technical comments** (JSDoc, inline `//`, JSX `{/* */}`), never in user-facing strings. The LGPD vocabulary gate is intended for product surfaces (UI copy, marketing). The comments are about **HTTP diagnostic logging**, not iridology diagnosis.

**Why deferred:** These violations existed on `main` BEFORE plan 04-01 started (verified by stashing local changes and running audit on clean tree — same 8 matches reported). They are out of scope for plan 04-01 per executor's Scope Boundary rule.

**Recommended action:** Open a separate maintenance plan (or fold into a future phase touching these files) to either:
1. Replace "diagnóstico"/"Diagnóstico" with synonyms ("depuração", "depuration logging", "log diagnóstico técnico" → "log de depuração técnica"), OR
2. Tighten the audit-vocabulary regex to skip comments (riskier — false negatives in JSX where comments and copy can blur).

**Status:** Logged 2026-05-03 by plan-04-01 executor.

## tsc errors em lib/capture/quality-scoring.test.ts (Fase 3)

**Discovered during:** Plan 04-02 execution (Task 2 verification — `pnpm tsc --noEmit -p .`)
**Files affected (pre-existing, not modified by 04-02):**

- `apps/web/lib/capture/quality-scoring.test.ts:47:15` — `Property 'reflex' does not exist on type ...`
- `apps/web/lib/capture/quality-scoring.test.ts:54:62` — idem

**Nature:** Test references `WEIGHTS.reflex` mas `quality-scoring.ts` exporta apenas `centeredness/distance/sharpness/exposure/occlusion` (sem `reflex`). Resíduo da pivô VLM da Fase 3 (UAT 03), onde `reflex_total` virou razão do VLM em vez de score numérico.

**Why deferred:** Pre-existente — verificado via `git stash + tsc` em tree limpo: os mesmos 2 erros aparecem antes da plan 04-02 começar. Fora do scope boundary do executor (arquivo nem nas dependências da plan 04-02).

**Recommended action:** Plan de cleanup da Fase 3 (ou fold em uma plan futura que toca quality-scoring) para remover as referências obsoletas a `WEIGHTS.reflex` em `quality-scoring.test.ts`.

**Status:** Logged 2026-05-03 by plan-04-02 executor.

**Update 2026-05-03 (plan-04-04 executor):** os mesmos resíduos `WEIGHTS.reflex` causam **3 falhas runtime** em `pnpm test:run lib/capture/quality-scoring.test.ts` (linhas 47, 54, 110), além dos 2 erros tsc já registrados. Confirmadas como pré-existentes via `git stash + pnpm test:run` em tree limpo no commit `ca6c851` (após Task 1 GREEN da plan 04-04, antes da Task 2). Mesmo cleanup resolve ambos. Não bloqueia plan 04-04.
