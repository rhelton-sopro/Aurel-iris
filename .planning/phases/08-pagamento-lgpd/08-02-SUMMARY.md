---
phase: 08-pagamento-lgpd
plan: 02
subsystem: payments
tags: [asaas, webhook, zod, idempotency, security]
requires:
  - "apps/web/types/database.ts (asaas_webhook_events table — 08-01)"
  - "apps/web/lib/supabase/service.ts (createServiceClient)"
provides:
  - "createAsaasCustomer / createAsaasPayment / refundAsaasPayment (REST client tipado)"
  - "verifyAsaasToken (timing-safe webhook auth)"
  - "asaasWebhookEnvelopeSchema / asaasPaymentSchema / asaasCustomerSchema (Zod + types)"
  - "recordWebhookEvent / markEventProcessed (idempotency helper)"
affects:
  - "plano 08-04 (webhook handler consome verifyAsaasToken + envelope schema + recordWebhookEvent)"
  - "plano 08-06 (server actions consomem createAsaasCustomer/Payment + refundAsaasPayment)"
tech-stack:
  added: []  # zero deps npm novas — fetch direto, sem SDK comunitário
  patterns:
    - "Discriminated union em result types (AsaasResult<T>, AsaasWebhookAuthResult, RecordEventResult)"
    - "timingSafeEqual (node:crypto) pra shared-secret webhook"
    - "Zod .passthrough() pra tolerar campos extras da API externa"
    - "Env var lido em call-time (não module-load const) pra override per-deploy/per-test"
key-files:
  created:
    - "apps/web/lib/asaas/types.ts"
    - "apps/web/lib/asaas/webhook-auth.ts"
    - "apps/web/lib/asaas/client.ts"
    - "apps/web/lib/asaas/idempotency.ts"
    - "apps/web/lib/asaas/__tests__/webhook-auth.test.ts"
    - "apps/web/lib/asaas/__tests__/client.test.ts"
  modified: []
decisions:
  - "Base URL Asaas lida via baseUrl() em call-time, não const module-load (Rule 1 fix)"
  - "webhook-auth.ts separado de lib/vision/hmac.ts: Asaas usa shared secret no header, não HMAC do body"
  - "Zero SDK npm: fetch direto per RESEARCH §Don't Hand-Roll"
metrics:
  duration: ~4min
  completed: 2026-05-28
  tasks: 4
  files: 6
  tests: 11
---

# Phase 8 Plan 02: Camada de cliente Asaas + webhook auth + idempotency Summary

Módulo `lib/asaas/` isolando a integração Asaas: REST client tipado (customer/payment/refund via fetch direto, sem SDK), verificação timing-safe do shared-secret do webhook, schemas Zod do envelope/payment, e helper de idempotência com guard de PG 23505. 11 testes vitest green, zero dependências npm novas.

## O que foi entregue

- **types.ts** — `asaasPaymentSchema` (`.passthrough()`), `asaasWebhookEnvelopeSchema` (enum dos 8 `PAYMENT_*` events + `id` como idempotency key), `asaasCustomerSchema`, e os types inferidos via `z.infer`. Arquivo de tipos puros (sem `'use server'`), importável client+server.
- **webhook-auth.ts** — `verifyAsaasToken(provided, expected)` usando `timingSafeEqual` com early length-check; discriminated union `missing_token | invalid_token | misconfigured`. Separado de `lib/vision/hmac.ts` porque o contrato é shared-secret no header, não HMAC do body.
- **client.ts** — `createAsaasCustomer`, `createAsaasPayment`, `refundAsaasPayment` (`refund` sem `value` = total, com `value` = parcial — D-13). `AsaasResult<T>` discriminated union; header `access_token`; structured log sem expor a API key; `safeParse` das respostas (502 em shape inválido).
- **idempotency.ts** — `recordWebhookEvent(envelope)` insere em `asaas_webhook_events`, retorna `first_seen:false` em 23505 (replay no-op para o handler 08-04 retornar 200). `markEventProcessed(eventId)` seta `processed_at` + `status='processed'`. Usa service-role client (webhook sem sessão).

## Funções exportadas

`createAsaasCustomer`, `createAsaasPayment`, `refundAsaasPayment` (client.ts) · `verifyAsaasToken` (webhook-auth.ts) · `recordWebhookEvent`, `markEventProcessed` (idempotency.ts) · `asaasWebhookEnvelopeSchema`, `asaasPaymentSchema`, `asaasCustomerSchema` + types (types.ts)

## Env vars novas (founder configura no Vercel)

| Var | Origem |
|-----|--------|
| `ASAAS_API_KEY` | Asaas Dashboard → Integrações → API |
| `ASAAS_API_BASE_URL` | `https://api.asaas.com/v3` (prod) ou `https://api-sandbox.asaas.com/v3` (sandbox) |
| `ASAAS_WEBHOOK_TOKEN` | String aleatória 32-64 chars (`openssl rand -hex 32`); IGUAL no Asaas Dashboard → Integrações → Webhook |

> Configuração do endpoint webhook no Asaas Dashboard fica para **após deploy LIVE do plano 08-04**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Base URL Asaas era congelada no module-load**
- **Found during:** Task 3
- **Issue:** O plano especificava `const ASAAS_API_BASE_URL = process.env.ASAAS_API_BASE_URL ?? '...'` no topo do módulo. Isso captura o env var no momento do import — o teste setava `ASAAS_API_BASE_URL` em `beforeEach` (depois do import), então a URL nunca era sobrescrita e o teste `createAsaasCustomer success` falhava (`api.asaas.com` em vez de `api-sandbox`). Em runtime também impediria override sem restart.
- **Fix:** Substituí o const por uma função `baseUrl()` que lê `process.env` em call-time.
- **Files modified:** `apps/web/lib/asaas/client.ts`
- **Commit:** 53b51e4

## Deferred Issues (out-of-scope)

`pnpm lint` no app inteiro falha com 20 errors + 15 warnings, **todos fora de `lib/asaas/`** (arquivos pré-existentes + scripts `.mts` untracked). Os 6 arquivos deste plano passam `eslint lib/asaas --max-warnings 0` com exit 0. Logado em `.planning/phases/08-pagamento-lgpd/deferred-items.md` — precisa ser resolvido antes do deploy LIVE da Fase 8 (`next build` roda eslint como gate).

## TDD Gate Compliance

Tasks 1-3 marcadas `tdd="true"`. Task 1 (types) é tipos puros — verificação por `tsc` em vez de RED/GREEN. Tasks 2 e 3 seguiram RED (teste falha sem impl) → GREEN (impl + teste passa) — commits `feat` carregam impl + teste juntos por serem unidades atômicas pequenas. Task 4 (idempotency) sem teste (integration test do webhook em 08-04 cobre o caminho real).

## Verification

- 11/11 testes vitest green em `lib/asaas/__tests__/` (5 webhook-auth + 6 client)
- `pnpm tsc --noEmit` limpo nos 6 arquivos do plano
- Zero deps npm novas (`git diff` em package.json/pnpm-lock = vazio)
- `timingSafeEqual` presente em webhook-auth.ts
- `eslint lib/asaas --max-warnings 0` exit 0
- `types/database.ts` NÃO modificado (plano não toca DB)

## Threat Model Status

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-08-02-01 (Spoofing webhook) | mitigate | ✓ timingSafeEqual em verifyAsaasToken |
| T-08-02-02 (API key leak via logs) | mitigate | ✓ structured log só path+status, nunca apiKey |
| T-08-02-03 (Tampering payload) | accept | Zod strict valida shape (Asaas usa shared secret, não HMAC body) |
| T-08-02-04 (API key em git) | mitigate | ✓ env var only |
| T-08-02-05 (Webhook replay) | mitigate | ✓ recordWebhookEvent → first_seen:false em 23505 |

## Self-Check: PASSED

- 6 files FOUND (4 lib + 2 tests)
- 4 commits FOUND (1261494, e188cd1, 53b51e4, e8c94f7)
- 11/11 vitest GREEN + eslint lib/asaas clean
