---
phase: 09-polish-dogfooding-beta
plan: 02
subsystem: dashboard/onboarding
tags: [onboarding, wizard, server-action, rsc, tdd, dashboard, backward-compat]
dependency-graph:
  requires:
    - "Plan 09-01 — profiles.onboarding_dismissed_at column (migration 0032)"
    - "apps/web/lib/gates/therapist-profile.ts (evaluateTherapistProfile)"
    - "apps/web/components/dashboard/summary-cards.tsx (Card pattern reference)"
  provides:
    - "dismissOnboardingAction() — UPDATE profiles.onboarding_dismissed_at + revalidatePath('/dashboard')"
    - "OnboardingWizard RSC — 3-step wizard inline, skipable, state-derivado de DB"
    - "dashboard/page.tsx — Promise.all paralelo + render condicional OnboardingWizard"
  affects:
    - "Plan 09-03 (e-mail leitura pronta) — dashboard load pattern expanded com readingsCount"
tech-stack:
  added: []
  patterns:
    - "Server Action form action wrapper void (Next.js type constraint)"
    - "TDD RED/GREEN cycle para server action + RSC component"
    - "Promise.all paralelo para 3 queries DB no RSC dashboard"
    - "Short-circuit null para backward-compat (3/3 completos → não renderiza)"
key-files:
  created:
    - path: "apps/web/app/actions/onboarding.ts"
      purpose: "Server Action dismissOnboardingAction — auth gate + UPDATE profiles.onboarding_dismissed_at + revalidatePath"
    - path: "apps/web/app/actions/onboarding.test.ts"
      purpose: "5 testes vitest: unauthenticated gate, update call shape, ok+revalidate, DB error, ISO-8601 timestamp"
    - path: "apps/web/components/dashboard/onboarding-wizard.tsx"
      purpose: "Componente RSC 3-step wizard com checkmarks condicionais + CTAs + form action dismiss"
    - path: "apps/web/components/dashboard/onboarding-wizard.test.tsx"
      purpose: "8 testes vitest: render 0/1/3 completos, null return, hrefs, form action, data-testid"
  modified:
    - path: "apps/web/app/(dashboard)/dashboard/page.tsx"
      change: "Promise.all expandido (+ readingsCount), profile select expandido, OnboardingWizard render condicional acima de InviteReadingsSection"
decisions:
  - "form action wrapper void inline no componente (handleDismiss) para satisfazer tipo React (formData: FormData) => void | Promise<void> sem quebrar 'use server' hygiene rule"
  - "showWizard = !dismissed simples; componente garante null-return quando completedCount === 3 (short-circuit)"
  - "Promise.all com 3 queries paralelas (clients count + readings count + profile) em vez de sequencial"
metrics:
  duration: "~6 min wall-clock"
  completed_date: "2026-05-26"
  tasks_completed: 3
  files_touched: 5
  commits: 3
---

# Phase 09 Plan 02: Onboarding Wizard 3-Step (ONBOARD-01) Summary

**One-liner:** Wizard inline 3-step na dashboard (Perfil → 1º cliente → 1ª leitura) com state derivado de DB via Promise.all, dismiss persistido em `profiles.onboarding_dismissed_at`, short-circuit para backward-compat de terapeutas existentes — 13 testes vitest GREEN.

## What Shipped

### Task 1 — Server Action dismissOnboardingAction (commit `1773d2c`)

`apps/web/app/actions/onboarding.ts` (28 linhas):
- `'use server'` directive — SÓ 1 função async exportada (memory rule `feedback_use_server_export_hygiene`)
- Auth gate via `supabase.auth.getUser()` → `{ ok: false, error: 'Unauthenticated' }` sem redirect
- UPDATE `profiles.onboarding_dismissed_at = new Date().toISOString()` + `.eq('id', user.id)`
- `revalidatePath('/dashboard')` apenas no happy path
- Retorno `{ ok: boolean; error?: string }` para feedback toast

`apps/web/app/actions/onboarding.test.ts` (5 testes GREEN):
- Test 1: sem sessão → `{ok:false, error:'Unauthenticated'}`, sem UPDATE
- Test 2: sessão válida → `update({onboarding_dismissed_at: ...}).eq('id', userId)` chamado 1x
- Test 3: update OK → `{ok:true}` + `revalidatePath('/dashboard')` 1x
- Test 4: update DB falha → `{ok:false, error:...}` sem revalidatePath
- Test 5: timestamp é ISO-8601 válido com sufixo Z (`new Date(ts).toISOString() === ts`)

### Task 2 — Componente OnboardingWizard RSC (commit `e998c65` + fix em `b84d862`)

`apps/web/components/dashboard/onboarding-wizard.tsx`:
- Sem `'use client'` — RSC puro
- Props: `step1Complete, step2Complete, step3Complete: boolean`
- `completedCount === 3` → `return null` (backward-compat)
- 3 steps com `data-testid="onboarding-step-{1,2,3}"`: checkmark quando done, CTA "Começar" quando pendente
- CTAs: `/perfil/completar`, `/clientes/novo`, `/leituras/nova`
- Dismiss via `<form action={handleDismiss}>` (wrapper void para satisfazer tipo React)
- `data-testid="onboarding-wizard"` (section) + `data-testid="onboarding-dismiss-btn"` (button)
- LGPD audit clean: zero "diagnóstico/tratamento/cura"

`apps/web/components/dashboard/onboarding-wizard.test.tsx` (8 testes GREEN):
- Test 1: 0/3 → "Vamos começar (0 de 3)" + 3 steps + 3 CTAs + botão Pular
- Test 2: 1/3 → "Vamos começar (1 de 3)" + checkmark step 1 + CTAs steps 2/3
- Test 3: 3/3 → `container.firstChild === null`
- Test 4-6: hrefs `/perfil/completar`, `/clientes/novo`, `/leituras/nova`
- Test 7: botão dismiss dentro de `<form>`
- Test 8: wrapper é `<section data-testid="onboarding-wizard">`

### Task 3 — Wire-up em dashboard/page.tsx (commit `b84d862`)

`apps/web/app/(dashboard)/dashboard/page.tsx`:
- Imports: `OnboardingWizard`, `evaluateTherapistProfile`
- Promise.all paralelo: `clientsCount` + `readingsCount` + `profile` (com campos onboarding)
- Profile select expandido: `phone, specialties, tos_accepted_at, onboarding_dismissed_at`
- Cálculo booleans: `step1 = therapistGate.status === 'ok'`; `step2 = clientsCount > 0`; `step3 = readingsCount > 0`
- `showWizard = !dismissed` (componente curto-circuita internamente quando 3/3)
- Ordem JSX: AutoRefresh → h1+Link → **OnboardingWizard (NEW)** → InviteReadingsSection → SummaryCards

## Backward-compat

Terapeutas existentes (founder, Cristiane-pop) com ≥1 reading + ≥1 cliente:
- `step2Complete=true`, `step3Complete=true` → `completedCount ≥ 2`
- Mesmo com `step1=false` (perfil incompleto) e `dismissed=null`, componente renderiza "2 de 3" + CTA pro perfil
- Para **não** ver banner: ou terem perfil completo (step1=true → 3/3 → null) ou clicar "Pular" 1x
- Aceitável per T-09-02-04 — pior caso = founder vê "2 de 3" uma vez, clica Pular

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] form action tipo incompatível com Next.js**
- **Found during:** Task 3 (tsc check pós-implementação)
- **Issue:** `dismissOnboardingAction` retorna `Promise<{ok, error?}>` mas React `<form action>` espera `(formData: FormData) => void | Promise<void>`
- **Fix:** Wrapper `handleDismiss` inline no componente com `'use server'` inline — chama `dismissOnboardingAction()` e descarta o retorno
- **Files modified:** `apps/web/components/dashboard/onboarding-wizard.tsx`
- **Commit:** `b84d862`

**2. [Rule 1 - Bug] TS2352 no test: acesso a `mock.calls[0][0]` com tuple vazio inferido**
- **Found during:** Task 3 (tsc check pós-implementação)
- **Issue:** Vitest `mock.calls` é inferido como `[][]` pelo tsc strict, cast direto falha
- **Fix:** Double-cast via `unknown as [...][]` no Test 5 do onboarding.test.ts
- **Files modified:** `apps/web/app/actions/onboarding.test.ts`
- **Commit:** `b84d862`

**3. [Rule 1 - Bug] Lint warnings: `container` unused em 2 testes**
- **Found during:** Task 3 (lint check)
- **Issue:** Testes Test 2 e Test 7 desestruturavam `container` mas não o usavam
- **Fix:** Removido destructuring nos 2 testes
- **Files modified:** `apps/web/components/dashboard/onboarding-wizard.test.tsx`
- **Commit:** `b84d862`

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| `app/actions/onboarding.test.ts` | 5 | GREEN |
| `components/dashboard/onboarding-wizard.test.tsx` | 8 | GREEN |
| **Total** | **13** | **GREEN** |

## Baseline Preservation

- **tsc errors:** 22 linhas (todos pré-existentes em test files — baseline 09-01: 22 erros). Zero novos erros em arquivos do plano.
- **lint:** Zero erros/warnings em arquivos novos/modificados pelo plano. Erros existentes em `scripts/` (pré-existentes, untracked).

## Commits

| Task | Hash      | Message |
|------|-----------|---------|
| 1    | `1773d2c` | `test(09-02): add failing tests for dismissOnboardingAction (RED)` |
| 2    | `e998c65` | `feat(09-02): OnboardingWizard RSC + 8 testes vitest GREEN` |
| 3    | `b84d862` | `feat(09-02): wire OnboardingWizard em dashboard/page.tsx (ONBOARD-01)` |

## Threat Register Status

| Threat ID    | Disposition | Outcome |
|--------------|-------------|---------|
| T-09-02-01   | mitigate    | ✓ getUser() gate retorna {ok:false, error:'Unauthenticated'} antes do UPDATE. Test 1 cobre. |
| T-09-02-02   | mitigate    | ✓ UPDATE inclui .eq('id', user.id) — RLS adicional. Test 2 verifica eq call. |
| T-09-02-03   | accept      | ✓ Counts são do próprio terapeuta (RLS via createClient). Nada exposto além do que já vê. |
| T-09-02-04   | mitigate    | ✓ Short-circuit null em 3/3. Terapeutas com dados veem "2 de 3" no máximo → Pular 1x. |
| T-09-02-05   | accept      | ✓ UPDATE só em click explícito "Pular". Dashboard GET é só read. |
| T-09-02-06   | mitigate    | ✓ OnboardingWizard não renderiza specialties — só usa para gate. Sem path de injection. |

## Known Stubs

Nenhum. Todos os 3 booleans são derivados de dados reais do DB (perfil, clientes.count, readings.count). O wizard renderiza estado real em produção.

## Self-Check: PASSED

**Files exist:**
- `apps/web/app/actions/onboarding.ts` — FOUND
- `apps/web/app/actions/onboarding.test.ts` — FOUND
- `apps/web/components/dashboard/onboarding-wizard.tsx` — FOUND
- `apps/web/components/dashboard/onboarding-wizard.test.tsx` — FOUND
- `apps/web/app/(dashboard)/dashboard/page.tsx` — FOUND (modified)

**Commits exist:**
- `1773d2c` — FOUND (Task 1)
- `e998c65` — FOUND (Task 2)
- `b84d862` — FOUND (Task 3)

**Verification gates GREEN:**
- 13/13 testes vitest: PASSED
- tsc: zero erros novos (22 pré-existentes): PASSED
- lint: zero erros em arquivos do plano: PASSED
- OnboardingWizard antes de SummaryCards (linha 65 < 72): PASSED
- LGPD audit (0 hits diagnóstico/tratamento/cura): PASSED
