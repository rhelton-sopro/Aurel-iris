---
phase: 08-pagamento-lgpd
plan: 05
subsystem: billing (camada de serviço do credit ledger)
tags: [billing, credits, trial, reservations, fifo, rpc, lgpd-audit, tdd]
requires:
  - phase: 08-01
    provides: "RPCs fifo_reserve_credit/release_reservation/is_in_trial + tabelas trial_status/credit_reservations/customer_credits/credit_transactions + types regen"
  - phase: 08-03
    provides: "lib/billing/config.ts (TRIAL_READINGS_MAX, trialExpiresAt) + lib/audit/log.ts (logAuditEvent)"
provides:
  - "lib/billing/trial.ts — evaluateTrial (pure) + startTrial + getTrialState"
  - "lib/billing/credits.ts — reserveCreditForReading + convertReservationToConsume (único entry point pra consumir crédito)"
  - "lib/billing/reservations.ts — listActiveReservations (RLS) + cancelReservation (ownership-checked)"
affects:
  - "08-06 billing server actions (importa reserve/cancel/trial)"
  - "08-07 analyze route (importa convertReservationToConsume)"
  - "08-08+ UI Processos em andamento (importa listActiveReservations)"
tech-stack:
  added: []
  patterns:
    - "service-role RPC wrapper com erro tipado (no_balance P0001 → union)"
    - "state-guarded idempotent UPDATE (.eq('status','active') race guard)"
    - "session client (RLS) pra leitura cross-tenant-safe; service client só onde precisa bypass"
    - "thenable builder mock pra bare-awaited UPDATE chains (espelha apply-payment.test.ts)"
    - "integration test gated por env var, skip default (não bloqueia CI)"
key-files:
  created:
    - apps/web/lib/billing/trial.ts
    - apps/web/lib/billing/credits.ts
    - apps/web/lib/billing/reservations.ts
    - apps/web/lib/billing/__tests__/trial.test.ts
    - apps/web/lib/billing/__tests__/credits.test.ts
    - apps/web/lib/billing/__tests__/race.test.ts
  modified: []
decisions:
  - "credit_reservations.created_at exposto como reserved_at na API pública (schema 0035 não tem coluna reserved_at)"
  - "ActiveReservation.source restrito a 'trial'|'credit' (internal indistinguível de trial nesta camada — UI distingue via internal_use)"
  - "race test promovido de placeholder pra suite real de unit (list + cancel) cobrindo T-08-05-03/05"
metrics:
  duration: ~12min
  completed: 2026-05-28
  tasks: 3
  files: 6
  tests: 25
requirements-completed: [BILLING-02, BILLING-03]
---

# Phase 8 Plan 05: Camada de serviço do credit ledger Summary

Camada de serviço que isola server actions (08-06) e analyze route (08-07) da RPC do banco: trial gating puro+testável, único entry point de consumo de crédito wrappando o FIFO RPC, e gestão de reservas com ownership/RLS. 25 testes determinísticos via mocks + 1 race test integration-gated.

## What Was Built

**Task 1 — `lib/billing/trial.ts` + test** (`bb8c1ab`)
- `evaluateTrial(row, now)` puro → union `{ active | ended | no_trial }`; precedência ended_at → days_elapsed → readings_exhausted → active
- `startTrial(userId)` idempotent (unique violation 23505 → `created:false`) + audit `trial.started`
- `getTrialState(userId)` lê trial_status e delega ao avaliador puro
- 9 testes GREEN (6 puros evaluateTrial + 3 startTrial mocked)

**Task 2 — `lib/billing/credits.ts` + test** (`0f65aeb`)
- `reserveCreditForReading(userId, readingId)` — ÚNICO entry point de consumo; wrappa `fifo_reserve_credit` RPC; `no_balance` (P0001) → reason tipado; audit `credit.reserved`
- `convertReservationToConsume(readingId)` — flip state-guarded `active→converted` + débito firme; idempotent (já-convertido ou race perdida → `already:true`); trial reservation (credit_id NULL) não toca customer_credits; audit `credit.consumed`
- 9 testes GREEN (4 reserve + 5 convert)

**Task 3 — `lib/billing/reservations.ts` + race test** (`27e8096`)
- `listActiveReservations(userId)` — session client (RLS) cross-tenant-safe; `source` derivado de credit_id; `created_at`→`reserved_at`
- `cancelReservation(readingId, userId)` — ownership SELECT antes do `release_reservation` RPC; unauthorized/not_found/no-op tipados
- 7 unit GREEN + 1 race test integration-gated (skip default)

## API Surface (pra 08-06/07/08+)

```
evaluateTrial(row, now) → TrialState                              // pure
startTrial(userId) → { ok, created }                             // signup
getTrialState(userId) → TrialState
reserveCreditForReading(userId, readingId) → ReserveResult        // D-10/D-11
convertReservationToConsume(readingId) → ConsumeResult            // analyze route
listActiveReservations(userId) → ActiveReservation[]             // painel D-11
cancelReservation(readingId, userId) → CancelResult              // cancelar processo
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `listActiveReservations` selecionava coluna inexistente `reserved_at`**
- **Found during:** Task 3 (verificação do schema contra o plano)
- **Issue:** O plano fazia `.select('... reserved_at ...')` e ordenava por ela, mas `credit_reservations` (migration 0035) tem `created_at`, não `reserved_at`. A query falharia em runtime (coluna inexistente).
- **Fix:** Select usa `created_at`, mapeado para `reserved_at` na API pública (linguagem do domínio preservada). Documentado em docstring.
- **Files modified:** apps/web/lib/billing/reservations.ts
- **Commit:** 27e8096

**2. [Rule 2 - Missing Critical] race.test.ts: placeholder trivial substituído por unit suite real**
- **Found during:** Task 3
- **Issue:** O plano deixava só `expect(true).toBe(true)` como cobertura de `listActiveReservations`/`cancelReservation` — os paths de ownership (T-08-05-03) e RLS (T-08-05-05) ficariam sem teste.
- **Fix:** Adicionados 7 unit tests cobrindo mapeamento de source, erro→[], release feliz, unauthorized, not_found, no-op não-ativo, db_error. Bloco de integração race preservado intacto e ainda skip-default.
- **Files modified:** apps/web/lib/billing/__tests__/race.test.ts
- **Commit:** 27e8096

**Total deviations:** 2 (1 Rule 1, 1 Rule 2). Sem scope creep — ambas elevam correção/cobertura.

## Race Test Gating

Skip por default. Rodar manualmente contra DB linked/sandbox:

```
INTEGRATION=true RACE_TEST_USER_ID=<uuid> pnpm vitest run lib/billing/__tests__/race.test.ts
```

Pré-requisito: user existe em profiles com `internal_use=false`. O teste reseta trial (max=3) e dispara 5 reserves concorrentes → exige exatamente 3 ok + 2 no_balance (valida pg_advisory_xact_lock do `fifo_reserve_credit`).

## Verification

- **Tests:** 25 novos GREEN (9 trial + 9 credits + 7 reservations) + 1 race integration skipped. Suite billing completa: 34 passed, 1 skipped.
- **Lint:** `eslint` scoped nos 6 arquivos com `--max-warnings 0` → exit 0
- **TSC:** zero erros nos 3 source files novos
- **Zero deps npm novas**
- `listActiveReservations` usa session client (RLS-respecting); demais usam service-role só onde RPC/ownership exige

## TDD Gate Compliance

Cada task seguiu RED (módulo ausente → "no tests"/fail) → GREEN (implementação → all pass), verificado nos 3 casos. Combinados em commits feat únicos (RED verificado antes do GREEN em cada task). Refactor não necessário.

## Threat Surface

Nenhuma superfície fora do `<threat_model>` do plano. Mitigações aplicadas: T-08-05-01 (FIFO race — RPC + race test), T-08-05-03 (ownership em cancelReservation), T-08-05-04 (credit_transactions + audit em cada ramo), T-08-05-05 (session/RLS em listActiveReservations).

## Known Stubs

Nenhum. Todos os módulos consomem RPCs/tabelas reais de 08-01; sem dados hardcoded nem UI placeholder.

## Next Phase Readiness

- 08-06 (server actions) pode importar reserve/cancel/trial
- 08-07 (analyze route) pode importar convertReservationToConsume
- 08-08+ (UI Processos em andamento) pode importar listActiveReservations

## Self-Check: PASSED

- 6 arquivos verificados em disco — todos FOUND
- 3 commits verificados no git log (bb8c1ab, 0f65aeb, 27e8096) — todos FOUND
- 25 tests GREEN + 1 integration skipped; scoped lint exit 0; tsc limpo nos novos arquivos
