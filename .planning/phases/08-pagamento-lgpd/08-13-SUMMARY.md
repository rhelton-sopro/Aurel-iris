---
phase: 08-pagamento-lgpd
plan: 13
subsystem: billing (cron temporal — fecha o loop de expiração/liberação)
tags: [billing, cron, vercel-cron, reservations, expiry, trial, notifications, middleware]
status: checkpoint-pending
requires:
  - phase: 08-05
    provides: "release_reservation RPC wrapping + estado do credit ledger (reservations/credits/trial)"
  - phase: 08-12
    provides: "notifyCreditExpiring (chamado pelo cron em 3 janelas 30/7/0d)"
  - phase: 08-03
    provides: "AuditEventType 'credit.expiring_warning' (WARN-4) já na lista"
provides:
  - "lib/billing/cron-jobs.ts — 4 jobs idempotentes (releaseExpiredReservations, expireOldCredits, expireOldTrials, sendExpirationWarnings)"
  - "GET /api/cron/daily — compositor bearer-auth dos 4 jobs"
  - "vercel.json crons '0 5 * * *' (02:00 BRT)"
  - "primeiro caller real de notifyCreditExpiring (estava sem caller após 08-12)"
affects:
  - "08-14 (smoke + integration final) — valida cron + webhook end-to-end em sandbox"
tech-stack:
  added: []
  patterns:
    - "Vercel Cron bearer auth (Authorization: Bearer ${CRON_SECRET}) → 401 sem"
    - "jobs idempotentes via WHERE de estado (status='active' / ended_at IS NULL) — re-run = no-op"
    - "dedup de notificação via audit_events event_type='credit.expiring_warning' + metadata.notification_days"
    - "email via auth.admin.getUserById (profiles sem coluna email) — espelha apply-payment.ts"
    - "fire-and-forget notify (void + .catch) dentro do job — email falho não quebra cron"
    - "vercel.json full-merge (não snippet) preservando todas as keys de deploy"
key-files:
  created:
    - apps/web/lib/billing/cron-jobs.ts
    - apps/web/app/api/cron/daily/route.ts
    - apps/web/app/api/cron/daily/__tests__/route.test.ts
  modified:
    - apps/web/vercel.json
    - apps/web/middleware.ts
decisions:
  - "expireOldCredits registra credit_transactions com amount 0 (saldo pré-update não está no retorno do UPDATE; o audit 'credit.expired' marca o evento terminal)"
  - "sendExpirationWarnings usa auth.admin.getUserById pra email (plano usava profiles!inner(email) — coluna inexistente, mesmo erro que 08-12 corrigiu)"
  - "notifyCreditExpiring chamado com signature REAL (leiturasRemaining + userName), não a do snippet do plano (leituras_remaining)"
  - "Task 3 middleware: /assinatura/comprar já coberto por /assinatura em PROTECTED_PATHS — edit foi comentário documentando cobertura + cron público (sem regressão)"
requirements-completed: [BILLING-02, BILLING-03]
metrics:
  duration: ~14min
  completed: 2026-05-29
  tasks: "3/4 (Task 4 = checkpoint human-verify, pendente founder)"
  files: 5
  tests: 4
---

# Phase 8 Plan 13: Cron daily (4 jobs temporais) Summary — CHECKPOINT PENDING

Cron diário compositor que fecha o loop temporal do credit ledger: libera reservas vencidas (devolve saldo), expira créditos 12m+, encerra trials 60d+ e dispara avisos de expiração em 30/7/0 dias. 4 jobs idempotentes + endpoint bearer-auth + merge seguro do vercel.json. Tasks 1-3 construídas e commitadas; **Task 4 é checkpoint human-verify bloqueante (founder configura CRON_SECRET + webhook Asaas + smoke) — NÃO executado por este agente.**

## O que foi construído (Tasks 1-3)

**Task 1 — `lib/billing/cron-jobs.ts` (4 jobs idempotentes)** — `bcb9cf0`
- `releaseExpiredReservations()` — SELECT reservations `status='active' AND expires_at < now` (cap 500), chama `release_reservation(p_reading_id, p_reason='expired')` RPC pra cada. Retorna `{ released, errors }`.
- `expireOldCredits()` — UPDATE `customer_credits SET status='expired', leituras_remaining=0 WHERE status='active' AND expires_at < now`; por crédito atingido: `credit_transactions` (type='expire') + audit `credit.expired`. Retorna `{ expired }`.
- `expireOldTrials()` — UPDATE `trial_status SET ended_at=now, ended_reason='days_elapsed' WHERE ended_at IS NULL AND trial_expires_at < now`; audit `trial.ended` por linha. Retorna `{ ended }`.
- `sendExpirationWarnings()` — 3 janelas (30d/7d/0d); dedup via `audit_events event_type='credit.expiring_warning'` + `metadata.notification_days`; email via `auth.admin.getUserById`; `notifyCreditExpiring` fire-and-forget; audit `credit.expiring_warning` por envio. Retorna `{ sent, skipped }`.

**Task 2 — `GET /api/cron/daily` + test + vercel.json** — `28aa67d`
- route.ts: 401 sem `Authorization: Bearer ${CRON_SECRET}`; roda os 4 jobs sequencialmente com `.catch` por job (falha de um não aborta os demais); `runtime='nodejs'`, `maxDuration=60`.
- vercel.json: **merge completo** — 7 keys originais preservados + `crons: [{ path: '/api/cron/daily', schedule: '0 5 * * *' }]` (05:00 UTC = 02:00 BRT). Gate verificado: 8 keys totais, buildCommand intacto, regions gru1.
- 4 testes vitest GREEN (401 missing, 401 wrong, 200 roda 4 jobs, continua quando um lança).

**Task 3 — `middleware.ts`** — `f65a089`
- `/assinatura/comprar` já estava coberto pelo prefixo `/assinatura` em `PROTECTED_PATHS` (sem sessão → /login). Edit cirúrgico = comentário documentando a cobertura + nota de que `/api/cron/daily` é público (bearer próprio). Zero regressão das mudanças de 08-06.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `notifyCreditExpiring` signature do snippet não bate com a real (08-12)**
- **Found during:** Task 1
- **Issue:** O snippet do plano chamava `notifyCreditExpiring({ leituras_remaining, packageName, ... })`. A função real (08-12) recebe `leiturasRemaining` (camelCase) + `userName`. O código do plano não compilaria.
- **Fix:** Chamada usa a signature real: `{ userEmail, userName, packageName, leiturasRemaining, expiresAt, daysOut }`.
- **Files modified:** apps/web/lib/billing/cron-jobs.ts
- **Commit:** bcb9cf0

**2. [Rule 1 - Bug] `sendExpirationWarnings` selecionava `profiles!inner(email)` — coluna inexistente**
- **Found during:** Task 1
- **Issue:** O snippet do plano fazia `.select('... profiles!inner(email, full_name)')`. `profiles` NÃO tem coluna `email` (mesmo bug que 08-12 corrigiu; memory `feedback_supabase_rls_no_auth_users` proíbe query em auth.users diretamente). A query falharia / email nunca resolveria.
- **Fix:** Email via `service.auth.admin.getUserById(c.user_id)`; `full_name` via `profiles`. Espelha exatamente o pattern de apply-payment.ts.
- **Files modified:** apps/web/lib/billing/cron-jobs.ts
- **Commit:** bcb9cf0

**3. [Rule 1 - Bug] `expireOldCredits` transaction usava `-row.leituras_remaining` (sempre 0 pós-update)**
- **Found during:** Task 1
- **Issue:** O snippet do plano lia `amount: -row.leituras_remaining` no SELECT pós-UPDATE — mas o UPDATE já zerou `leituras_remaining`, então o valor retornado é sempre 0. O saldo perdido real não está no retorno do UPDATE atômico.
- **Fix:** Transaction registrada com `amount: 0` + nota explicativa; o audit `credit.expired` marca o evento terminal. (Capturar o saldo pré-update exigiria um SELECT separado antes do UPDATE, abrindo janela de corrida — não vale a complexidade pra um campo de log; o saldo final correto é 0.)
- **Files modified:** apps/web/lib/billing/cron-jobs.ts
- **Commit:** bcb9cf0

**Total:** 3 auto-fixes (3 Rule 1), todas elevando correção/compilação. Sem scope creep.

## Threat Model Status

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-08-13-01 (spoofing /api/cron/daily) | mitigate | ✓ bearer CRON_SECRET; 401 sem (2 testes) |
| T-08-13-02 (DoS / loop infinito) | mitigate | ✓ cap 500 em release; UPDATEs bounded por WHERE; maxDuration 60s; .catch por job |
| T-08-13-03 (mudança de saldo sem rastro) | mitigate | ✓ credit_transactions + logAuditEvent em cada batch |
| T-08-13-04 (email de aviso duplicado) | mitigate | ✓ dedup audit_events 'credit.expiring_warning' + notification_days antes do send |
| T-08-13-05 (vercel.json snippet corrompe build) | mitigate | ✓ merge completo verificado (8 keys, buildCommand intacto) |

## Threat Flags

Nenhum surface novo fora do threat_model do plano.

## Known Stubs

Nenhum. Todos os jobs consomem RPCs/tabelas reais. `notifyCreditExpiring` (sem caller após 08-12) agora tem seu caller real.

## Verification

- 4 testes route GREEN; suite billing+cron+asaas: 52 passed, 1 skipped (race integration-gated), 0 fail
- vercel.json: 8 keys (7 originais + crons), buildCommand='pnpm build', regions inclui gru1 — gate node PASS
- tsc: 0 erros nos arquivos do plano (cron-jobs.ts, route.ts, route.test.ts, middleware.ts)
- eslint --max-warnings 0 scoped: exit 0 em todos os arquivos novos/modificados
- middleware: 2 ocorrências de "assinatura"; sem regressão de 08-06
- zero deps npm novas; nenhuma deleção de arquivo nos 3 commits

## Deferred Issues (out-of-scope)

`pnpm lint`/`next build` no app inteiro continua com errors/warnings **fora dos arquivos deste plano** (catalogado em deferred-items.md desde 08-02). Gate de deploy LIVE da Fase 8 — não é deste plano.

## CHECKPOINT PENDING — Task 4 (human-verify, bloqueante)

Task 4 NÃO foi executado (guardrail: não setar env, não tocar painel Asaas, não disparar cron live). Founder precisa, após o deploy:

1. **CRON_SECRET** — `openssl rand -hex 32` → Vercel env (Production + Preview).
2. **Webhook Asaas** (painel) — URL `/api/asaas/webhook` (sandbox: preview deploy; prod: iriscodex.com) + token `ASAAS_WEBHOOK_TOKEN`; eventos PAYMENT_CONFIRMED/RECEIVED/REFUNDED/PARTIALLY_REFUNDED/CHARGEBACK_REQUESTED.
3. **Deploy** + confirmar Cron Job visível em Vercel UI → Settings → Cron Jobs.
4. **Smoke cron** — `curl -H "Authorization: Bearer $CRON_SECRET" https://iriscodex.com/api/cron/daily` → 200 + JSON 4 results.
5. **Smoke PIX sandbox** — /assinatura/comprar → Avulsa → pagar PIX → webhook → credit ativo + email confirmação.

env vars finais da Fase 8: `ASAAS_API_KEY`, `ASAAS_API_BASE_URL`, `ASAAS_WEBHOOK_TOKEN`, `CRON_SECRET`, `RESEND_API_KEY`, `NEXT_PUBLIC_OPERATOR_EMAIL`.

Próximo plano (08-14) = smoke + integration testing final.

## Self-Check: PASSED

- 5 arquivos verificados em disco (3 created + 2 modified) — todos FOUND
- 3 commits verificados (bcb9cf0, 28aa67d, f65a089) — todos FOUND
- 4 testes route GREEN + suite billing/cron/asaas sem regressão; eslint scoped exit 0; tsc limpo
