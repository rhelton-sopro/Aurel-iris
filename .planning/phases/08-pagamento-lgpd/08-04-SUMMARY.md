---
phase: 08-pagamento-lgpd
plan: "04"
subsystem: payments
tags: [asaas, webhook, billing, idempotency, state-machine, security]

requires:
  - "08-01: customer_credits + credit_transactions + audit_events tables (LIVE)"
  - "08-02: verifyAsaasToken + recordWebhookEvent/markEventProcessed + asaasWebhookEnvelopeSchema"
  - "08-03: creditExpiresAt (lib/billing/config) + logAuditEvent (lib/audit/log)"

provides:
  - "POST /api/asaas/webhook — endpoint que fecha o loop de pagamento (única forma de creditar saldo)"
  - "applyPaymentEvent(envelope) — state machine CONFIRMED/REFUNDED/PARTIALLY_REFUNDED/CHARGEBACK"

affects:
  - "08-13 (config webhook URL no painel Asaas) — depende deste endpoint estar LIVE"
  - "08-07 (purchase UI) — créditos só aparecem ativos após este webhook processar"

tech-stack:
  added: []
  patterns:
    - "Env var ASAAS_CREDIT_EVENT lido em call-time (override A1 sem deploy)"
    - "Builder thenable mock pra cobrir chain awaitada (.eq().eq()) + maybeSingle()"
    - "vi.hoisted() pra mocks referenciados no factory de vi.mock"
    - "status guard + defensive .eq('user_id') em todas as writes service-role"

key-files:
  created:
    - "apps/web/lib/billing/apply-payment.ts"
    - "apps/web/lib/billing/__tests__/apply-payment.test.ts"
    - "apps/web/app/api/asaas/webhook/route.ts"
    - "apps/web/app/api/asaas/webhook/__tests__/route.test.ts"
  modified: []

decisions:
  - "A1=confirmed aplicado: trigger = PAYMENT_CONFIRMED (lido call-time via ASAAS_CREDIT_EVENT, default PAYMENT_CONFIRMED)"
  - "Partial refund computa débito proporcional + soma refunds prévios pra idempotency (delta<=0 = no-op)"
  - "CHARGEBACK_REQUESTED tratado como refund total (zera saldo)"

requirements-completed: [BILLING-01]

metrics:
  duration: ~12min
  completed: 2026-05-28
  tasks: 2
  files: 4
  tests: 15
---

# Phase 08 Plan 04: Webhook Asaas — COMPLETO

**Endpoint `POST /api/asaas/webhook` + state machine `applyPaymentEvent` que fecham o loop PRINCIPAL da Fase 8: terapeuta paga no Asaas → webhook valida shared-secret → dedup via event.id PK → muta `customer_credits`. A1=confirmed (PAYMENT_CONFIRMED) aplicado, idempotência em duas camadas, defensive cross-tenant filtering. 15 testes vitest green.**

## O que foi entregue

- **lib/billing/apply-payment.ts** — `applyPaymentEvent(envelope)` despacha 4 branches:
  - **PAYMENT_CONFIRMED** (A1): SELECT credit pending → UPDATE `status='active'`, `leituras_remaining=leituras_purchased`, `expires_at=+365d` (D-03) → INSERT credit_transactions `type='purchase'` → `logAuditEvent('credit.purchase_confirmed')`. Duplicate (já active) = no-op `wrong_state`.
  - **PAYMENT_REFUNDED** (full): UPDATE `status='refunded'`, `leituras_remaining=0` com status guard `.eq('status','active')` race-safe → INSERT `type='refund'` `amount=-saldo` → `credit.refunded`. Já refunded = no-op idempotente (WARN-6).
  - **PAYMENT_PARTIALLY_REFUNDED** (D-13): `leituras_a_debitar = round(refundedValue / preço_unitário)`, subtrai débitos prévios (soma `credit_transactions type='refund'`), `delta<=0` = no-op idempotente. `status` fica `'active'`.
  - **PAYMENT_CHARGEBACK_REQUESTED**: zera saldo + `status='refunded'`.
  - Demais eventos → no-op `no_op_event`.
- **app/api/asaas/webhook/route.ts** — POST handler `runtime='nodejs'` + `maxDuration=10`. Pipeline: `verifyAsaasToken` (401) → `request.text()`+Zod (400) → `recordWebhookEvent` (500 em falha não-23505; 200 `idempotent` em duplicate) → `applyPaymentEvent` → `markEventProcessed` → `revalidatePath('/assinatura')`.

## A1 decision aplicada + override

Trigger de crédito = **PAYMENT_CONFIRMED** (08-01-SUMMARY A1=confirmed, UX-first). Lido em call-time via `creditTriggerEvent()` (env `ASAAS_CREDIT_EVENT`, default `PAYMENT_CONFIRMED`) — founder pode trocar pra `PAYMENT_RECEIVED` no Vercel **sem redeploy** se o risco de chargeback virar problema.

## Idempotência (duas camadas)

1. **Primária** — `asaas_webhook_events.event_id` PK (08-02): INSERT 23505 = duplicate → handler retorna 200 `{ ok: true, noop: 'idempotent' }`, `applyPaymentEvent` nunca roda.
2. **Secundária** — `customer_credits.status` guard (`.eq('status', ...)`) em cada write absorve eventos out-of-order/race que passem da barreira do event.id.

## Cross-tenant protection (T-08-04-06 / pitfall #9)

Todas as `.update()` carregam `.eq('user_id', credit.user_id)` defensivo além do `.eq('id', ...)`. Service-role bypassa RLS, então o filtro explícito é a barreira.

## Task Commits

1. **Task 1: apply-payment.ts state machine + test** — `ef161fb` (feat) — 9 testes
2. **Task 2: webhook/route.ts POST handler + test** — `04846c0` (feat) — 6 testes

## Funções/exports

`applyPaymentEvent` + type `ApplyPaymentResult` (apply-payment.ts) · `POST` + `runtime` + `maxDuration` (route.ts)

## Env var nova

| Var | Default | Origem |
|-----|---------|--------|
| `ASAAS_CREDIT_EVENT` | `PAYMENT_CONFIRMED` | Opcional — override A1 sem deploy. Setar `PAYMENT_RECEIVED` no Vercel se necessário |

> `ASAAS_WEBHOOK_TOKEN` já documentado no 08-02-SUMMARY (usado por verifyAsaasToken).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mocks referenciados em vi.mock factory hoisted antes da declaração**
- **Found during:** Task 2 (primeira execução de teste)
- **Issue:** `vi.mock('@/lib/asaas/webhook-auth', () => ({ verifyAsaasToken: verifyMock }))` falhava com `Cannot access 'verifyMock' before initialization` — `vi.mock` é hoisted acima das `const verifyMock = vi.fn()`, e o factory referencia o const no momento do import (não lazy como no mock de apply-payment).
- **Fix:** Movi as 4 mocks pra `vi.hoisted(() => ({ verifyMock, recordMock, markMock, applyMock }))`.
- **Files modified:** `apps/web/app/api/asaas/webhook/__tests__/route.test.ts`
- **Commit:** 04846c0

**2. [Rule 2 - Missing Critical] Guard de pacote ausente no partial refund**
- **Found during:** Task 1
- **Issue:** O plano calculava `unitPriceBrl = pkg.price_brl / pkg.leituras_count` sem checar se `credit_packages` veio null/zero. Nested select pode retornar null (FK órfã) → `NaN`/divisão por zero corromperia o débito.
- **Fix:** Adicionado guard `if (!pkg || pkg.leituras_count <= 0) return { applied: false, reason: 'db_error', detail: 'missing_package' }`.
- **Files modified:** `apps/web/lib/billing/apply-payment.ts`
- **Commit:** ef161fb

**Total:** 2 auto-fixes (1 Rule 3 teste, 1 Rule 2 correção). Sem scope creep.

## Threat Model Status

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-08-04-01 (Spoofing PAYMENT falso) | mitigate | ✓ verifyAsaasToken timing-safe + 401 sem detail |
| T-08-04-02 (replay) | mitigate | ✓ event.id PK → 200 no-op idempotent |
| T-08-04-03 (out-of-order) | mitigate | ✓ status guard em customer_credits absorve; refund/partial tratam "no row" gracefully |
| T-08-04-04 (log expõe payment.id) | accept | payment IDs não-secret; logs Vercel privados |
| T-08-04-05 (DoS spam) | accept | Vercel rate limiting + fila Asaas pausa após 15 falhas |
| T-08-04-06 (cross-tenant write) | mitigate | ✓ defensive .eq('user_id', credit.user_id) em todas as updates |
| T-08-04-07 (mudança sem rastro) | mitigate | ✓ credit_transactions INSERT + logAuditEvent('credit.*') em cada branch |

## Threat Flags

Nenhum surface novo fora do threat_model do plano.

## Known Stubs

Nenhum — lógica completa, sem placeholders.

## Verification

- 15/15 testes vitest green (9 apply-payment + 6 route)
- `eslint` exit 0 nos 4 arquivos novos (`--max-warnings 0`)
- `tsc --noEmit` sem erros relacionados a apply-payment / asaas/webhook
- `runtime='nodejs'` presente (timingSafeEqual)
- Todas as `.update()` têm `.eq('user_id', ...)` defensive
- Structured logs `[asaas-webhook]` presentes em todos os branches
- Zero deps npm novas

## Deferred Issues (out-of-scope)

`pnpm lint` no app inteiro continua falhando com errors/warnings **fora dos 4 arquivos deste plano** (já catalogado em `deferred-items.md` desde 08-02). Os arquivos deste plano passam eslint scoped limpo. Gate `next build` precisa ser resolvido antes do deploy LIVE da Fase 8.

## Next Phase Readiness

- Endpoint `/api/asaas/webhook` pronto — fica **LIVE após deploy**
- Plano **08-13** configura a URL do webhook no painel Asaas Dashboard → Integrações → Webhook (apontando pra `https://<domínio>/api/asaas/webhook` com `ASAAS_WEBHOOK_TOKEN`)
- Plano **08-07** (purchase UI) já pode assumir que créditos confirmados ativam o saldo via este loop

## Self-Check: PASSED

- 4 arquivos verificados em disco — todos FOUND (2 lib/billing + 2 app/api/asaas/webhook)
- 2 commits verificados no git log (ef161fb, 04846c0) — ambos FOUND
- 15/15 vitest GREEN + eslint scoped exit 0
