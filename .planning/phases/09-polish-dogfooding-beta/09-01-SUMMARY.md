---
phase: 09-polish-dogfooding-beta
plan: 01
subsystem: schema/migrations
tags: [migration, schema, onboarding, notification, types-regen, wave-1]
dependency-graph:
  requires:
    - "supabase/migrations/0031_report_generations_v2_3_alignment.sql (formato canônico)"
    - "Schema remoto Supabase (CLI linked)"
  provides:
    - "readings.notification_sent_at timestamptz NULL (idempotência e-mail leitura pronta, D-04)"
    - "profiles.onboarding_dismissed_at timestamptz NULL (persistência dismiss wizard, D-02)"
    - "apps/web/types/database.ts atualizado com as 2 colunas em Row + Insert + Update"
  affects:
    - "Plan 09-02 (wizard onboarding) — desbloqueado: usa profiles.onboarding_dismissed_at"
    - "Plan 09-03 (e-mail leitura pronta) — desbloqueado: usa readings.notification_sent_at"
tech-stack:
  added: []
  patterns:
    - "ALTER TABLE IF NOT EXISTS para idempotência de re-execução"
    - "COMMENT ON COLUMN com referência cruzada a decisões da fase (D-04, D-02)"
    - "supabase gen types --linked --schema public (sync TS ↔ remote schema)"
key-files:
  created:
    - path: "supabase/migrations/0032_phase_9_onboarding_and_notification.sql"
      purpose: "Migration additiva 2 colunas: readings.notification_sent_at + profiles.onboarding_dismissed_at"
  modified:
    - path: "apps/web/types/database.ts"
      change: "+23 linhas — as 2 colunas em Row + Insert + Update de readings + profiles"
decisions:
  - "Migration única atômica (mesma fase, mesmo tema) em vez de 2 migrations separadas — reduz drift entre tipos e código"
  - "Strictly additive, zero backfill, zero DROP — pode ser aplicada antes ou depois do código sem quebrar prod (colunas NULL default)"
  - "IF NOT EXISTS em ambos ALTERs — idempotência total, re-execução é no-op"
  - "Sem INDEX — colunas são read 1x em RSC dashboard load + write 1x por reading/profile, não query-hot"
  - "COMMENT ON COLUMN documenta D-04 e D-02 inline pra rastrear intenção de produto direto no schema"
metrics:
  duration: "~17.85 min wall-clock (incluindo checkpoint bloqueante)"
  completed_date: "2026-05-26"
  tasks_completed: 3
  files_touched: 2
  commits: 2
---

# Phase 09 Plan 01: Migration + Types Regen Summary

**One-liner:** Migration 0032 adiciona `readings.notification_sent_at` (idempotência e-mail leitura pronta, D-04) e `profiles.onboarding_dismissed_at` (persistência dismiss wizard onboarding, D-02) + regenera `types/database.ts` — destravando Plans 09-02 (wizard) e 09-03 (e-mail hook).

## What Shipped

### Task 1 — Migration 0032 criada (commit `6d23b1b`)

Arquivo `supabase/migrations/0032_phase_9_onboarding_and_notification.sql` (53 linhas) criado espelhando o formato canônico de 0031:

- Header docstring extenso documentando Fase 9, D-04, D-02, idempotência via `IF NOT EXISTS`, strictly additive
- `ALTER TABLE public.readings ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz`
- `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_dismissed_at timestamptz`
- `COMMENT ON COLUMN` em ambas referenciando D-04 e D-02 inline

**Acceptance criteria — todos PASSED:**
- `alter table public.readings` × 1 (≥1 ✓)
- `alter table public.profiles` × 1 (≥1 ✓)
- `notification_sent_at` × 5 (≥2 ✓)
- `onboarding_dismissed_at` × 5 (≥2 ✓)
- `if not exists` × 3 (≥2 ✓)
- `comment on column` × 2 (≥2 ✓)
- "Fase 9" × 4, "D-04" × 4, "D-02" × 5 (header docstring + comments)

### Task 2 — Migration aplicada no remoto (BLOCKING checkpoint resolvido)

Founder aplicou `supabase db push --linked` (ou Dashboard SQL Editor) e confirmou "supabase pushado". Schema remoto agora tem as 2 colunas novas.

### Task 3 — Types regenerados (commit `004c41b`)

`pnpm gen:types` (de `apps/web/`) rodou `supabase gen types typescript --linked --schema public > types/database.ts` contra o schema remoto pós-Task 2.

**Diff:** `apps/web/types/database.ts` +23/-0 linhas.

**Grep verification (acceptance criteria):**
- `notification_sent_at: string | null` nas linhas 595 (Row), 642 (Insert), 689 (Update) = **3 ocorrências** (≥3 ✓)
- `onboarding_dismissed_at: string | null` nas linhas 437 (Row), 455 (Insert), 473 (Update) = **3 ocorrências** (≥3 ✓)
- Insert/Update com `?:` opcional (timestamptz default NULL → coluna opcional em writes)

**tsc baseline preservado:** `pnpm --filter @aurel/web tsc --noEmit` retornou 22 erros, **todos pré-existentes** em:
- `app/actions/readings.test.ts` (12 erros — baseline conhecido)
- `components/readings/ReprocessButton.test.tsx` (3 erros — baseline)
- `lib/capture/quality-scoring.test.ts` (2 erros — baseline, MEMORY feedback_quality_scoring_test_gate)
- `lib/vision/modal-client.test.ts` (5 erros — baseline)

Zero erros novos introduzidos pela mudança em `types/database.ts`. Per MEMORY rule, debt pré-existente não gate ROADMAP.

## Deviations from Plan

None — plan executado exatamente como escrito.

A única nota worth recording é que o filter name correto para o monorepo é `web` (não `@aurel/web` como o plan sugeriu em algumas seções). Solução: rodei `cd apps/web && pnpm gen:types` diretamente, que funcionou perfeitamente. Não é um deviation real, apenas correção de nomeclatura.

## Wave 2 Unblocked

Esta plan era pré-requisito blocking para Wave 2. Com Task 3 verde:

- **Plan 09-02 (wizard onboarding)** desbloqueado — pode usar `profiles.onboarding_dismissed_at` em RSC dashboard + Server Action `dismissOnboardingAction`
- **Plan 09-03 (e-mail leitura pronta)** desbloqueado — pode usar `readings.notification_sent_at` como flag idempotente no hook em `/api/readings/[id]/analyze/route.ts`

## Commits

| Task | Hash      | Message |
|------|-----------|---------|
| 1    | `6d23b1b` | `feat(09-01): migration 0032 — readings.notification_sent_at + profiles.onboarding_dismissed_at` |
| 3    | `004c41b` | `feat(09-01): types regen — notification_sent_at + onboarding_dismissed_at` |

## Threat Register Status

| Threat ID    | Disposition | Outcome |
|--------------|-------------|---------|
| T-09-01-01   | mitigate    | ✓ IF NOT EXISTS em ambos ALTERs garante idempotência. Re-execução é no-op. |
| T-09-01-02   | accept      | ✓ Comments referenciam "D-04 / D-02 / Fase 9" — meta-info de planejamento, não dados sensíveis. Schema interno via RLS. |
| T-09-01-03   | mitigate    | ✓ Founder rodou `supabase db push --linked` localmente — token disponível. |
| T-09-01-04   | mitigate    | ✓ Grep verificou as 2 colunas em Row + Insert + Update. Wave 2 não vai falhar tsc por coluna ausente. |

## Self-Check: PASSED

**Files exist:**
- `supabase/migrations/0032_phase_9_onboarding_and_notification.sql` — FOUND
- `apps/web/types/database.ts` (modified) — FOUND

**Commits exist:**
- `6d23b1b` — FOUND (Task 1)
- `004c41b` — FOUND (Task 3)

**Verification gates GREEN:**
- Migration grep checks: 9/9 PASSED
- types/database.ts grep counts: 3 + 3 (≥3 both) PASSED
- tsc baseline preserved: 22 errors (all pre-existing, zero new)
