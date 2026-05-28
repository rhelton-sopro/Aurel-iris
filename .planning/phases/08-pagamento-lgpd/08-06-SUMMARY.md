---
phase: 08-pagamento-lgpd
plan: 06
subsystem: billing (server actions de compra/reembolso + signup CPF)
tags: [billing, asaas, refund, cpf, signup, lgpd, trigger, tdd, checkpoint-resolved]
checkpoint_resolution: "Migration 0039 aplicada LIVE pelo founder (supabase db push --linked, 2026-05-28). Smoke test E2E (createChargeAction -> fatura Asaas + dedup CPF) DIFERIDO pro plano 08-14 (verificacao final E2E) — env ASAAS_WEBHOOK_TOKEN pendente ate webhook ter URL preview. Codigo do 08-06 completo: 23 testes green."
requires:
  - phase: 08-01
    provides: "profiles.cpf + asaas_customer_id + UNIQUE idxs + tabelas billing (migration 0035)"
  - phase: 08-02
    provides: "createAsaasCustomer / createAsaasPayment / refundAsaasPayment (lib/asaas/client)"
  - phase: 08-03
    provides: "isValidCpf/cpfDigits/formatCpfBR + refundWindowEndsAt/creditExpiresAt + logAuditEvent"
  - phase: 08-05
    provides: "startTrial / getTrialState (lazy trial — NÃO chamado no signup)"
provides:
  - "createChargeAction(sku) — Asaas customer (lazy) + payment + customer_credits pending"
  - "refundPackageAction(creditId) — computeRefundValue D-13 + Asaas refund + ledger"
  - "computeRefundValue (pura, testável) — total/partial/no_balance/window_expired/wrong_status"
  - "signup + /perfil/completar coletam CPF (mask + isValidCpf); CPF → raw_user_meta_data"
  - "migration 0039 — handle_new_user lê cpf (sem DDL de colunas, owned por 0035)"
  - "evaluateTherapistProfile exige cpf (gap novo) + completeProfileAction trata 23505"
affects:
  - "08-10 (UI compra) chama createChargeAction"
  - "08-11 (UI saldo + arrependimento) chama refundPackageAction"
tech-stack:
  added: []
  patterns:
    - "Discriminated union result (CreateChargeResult / RefundPackageResult)"
    - "INSERT pending ANTES do payment (row.id = externalReference) + compensação (delete) se Asaas falha"
    - "Schemas/types em sibling .schemas.ts (use-server export hygiene)"
    - "Cálculo de refund puro separado do I/O (refund-policy.ts)"
    - "Defesa em profundidade dedup CPF: UNIQUE idx (0035) + UI catch + 23505 em completeProfileAction"
key-files:
  created:
    - apps/web/lib/billing/refund-policy.ts
    - apps/web/lib/billing/__tests__/refund-policy.test.ts
    - apps/web/app/actions/billing.ts
    - apps/web/app/actions/billing.schemas.ts
    - apps/web/app/actions/__tests__/billing.test.ts
    - "apps/web/app/(auth)/signup/__tests__/signup-cpf.test.ts"
    - supabase/migrations/0039_signup_cpf_trigger_extension.sql
  modified:
    - "apps/web/app/(auth)/signup/page.tsx"
    - apps/web/app/actions/profile.ts
    - apps/web/lib/gates/therapist-profile.ts
    - apps/web/middleware.ts
    - apps/web/app/perfil/completar/complete-profile-form.tsx
    - apps/web/app/perfil/completar/page.tsx
    - "apps/web/app/(dashboard)/dashboard/page.tsx"
decisions:
  - "createChargeAction insere leituras_remaining=0 (A1=PAYMENT_CONFIRMED): créditos só liberam no webhook 08-04"
  - "expires_at no INSERT é placeholder (creditExpiresAt(now)); webhook reseta a partir de confirmed_at (D-03)"
  - "billingType='UNDEFINED' — cliente escolhe PIX/cartão/boleto no checkout Asaas"
  - "Migration 0039 owns SOMENTE a função trigger; toda DDL de coluna/idx é de 0035 (08-01)"
  - "Refund parcial zera leituras_remaining + leituras_reserved (terapeuta perde o restante)"
metrics:
  duration: ~9min (tasks 1-3; Task 4 é checkpoint do founder)
  completed: 2026-05-28
  tasks: "3 de 4 (Task 4 = blocking human-verify checkpoint, pendente do founder)"
  files: 14
  tests: 23
requirements-completed: []  # BILLING-01/02/03 só após smoke do founder (Task 4)
---

# Phase 8 Plan 06: Server actions de compra/reembolso + signup CPF Summary

**STATUS: CHECKPOINT-PENDING** — Tasks 1-3 implementadas, testadas e commitadas. Task 4 é um checkpoint `human-verify` bloqueante: o founder aplica a migration 0039 no Supabase linked e roda o smoke test (createChargeAction → invoice Asaas sandbox + dedup CPF no signup). Esta sessão NÃO rodou `supabase db push` nem o smoke — são ações do founder.

Orquestração da compra (Asaas customer + payment + customer_credits pending), do reembolso por arrependimento CDC 7d (cálculo puro + refund Asaas + ledger), e expansão do signup/perfil com CPF obrigatório + dedup anti-fraud (D-12). 23 testes vitest green; migration 0039 estende handle_new_user sem colidir com a DDL de colunas owned por 0035 (08-01).

## O que foi entregue

**Task 1 — `lib/billing/refund-policy.ts` + test** (`e1f7fbf`)
- `computeRefundValue(credit, now)` pura (D-13): `total` (0 consumidas → price_brl cheio), `partial` (proporcional = unit_price × (remaining + reserved)), `no_balance`, `window_expired`, `wrong_status`. Reserved conta como refundável. Arredondamento 2dp.
- 8 testes GREEN (pricing bate com D-02: 59.70 / 49.70 unit).

**Task 2 — `app/actions/billing.ts` + `billing.schemas.ts` + test** (`6a3b2ad`)
- `createChargeAction(sku)`: session gate → preço do DB (T-08-06-02) → Asaas customer lazy → INSERT customer_credits `pending` (`leituras_remaining=0` até webhook; A1=confirmed) → Asaas payment com `externalReference=credit.id` → liga `asaas_payment_id` (UNIQUE/idempotência). Rollback (delete) se o payment Asaas falha.
- `refundPackageAction(creditId)`: SELECT via session client (RLS — T-08-06-05) → `computeRefundValue` → Asaas refund (body vazio=total / `value`=parcial) → estado local + `credit_transactions` (type=refund) + audit.
- Schemas/types em `billing.schemas.ts` (use-server export hygiene). CPF/phone nunca logados (T-08-06-04).
- 10 testes GREEN (5 createCharge + 5 refund).

**Task 3 — signup CPF + migration 0039 + dedup** (`9ea4cd2`)
- `signup/page.tsx` + `complete-profile-form.tsx`: input CPF mascarado (`formatCpfBR`) + `isValidCpf` client-side.
- `buildMeta()` inclui `cpf` (dígitos) → `auth.users.raw_user_meta_data`.
- **Migration 0039** ESTENDE `handle_new_user()` pra ler `raw_user_meta_data->>'cpf'`. NÃO declara colunas/índices (owned por 0035). Preserva o corpo de 0022 byte-a-byte (único delta: linha `cpf`).
- `evaluateTherapistProfile` ganha gap `'cpf'` (exige `isValidCpf`); middleware + dashboard + perfil/completar selects incluem `cpf`.
- `completeProfileAction` aceita `cpf`, valida, e trata 23505 → "Já existe cadastro com este CPF. Faça login." (D-12).
- 5 testes helpers GREEN.

## API Surface (pra 08-10/08-11)

```
createChargeAction({ sku }) → { ok, credit_id, invoice_url, asaas_payment_id } | { ok:false, error }
refundPackageAction({ credit_id, reason? }) → { ok, refunded_value_brl, kind } | { ok:false, error }
computeRefundValue(credit, now) → RefundPolicy   // pura
```

## Boundary explícita de migrations Fase 8

- **0035 (plano 08-01)** owns: `profiles.cpf`, `profiles.asaas_customer_id`, `profiles_cpf_unique_idx`, `profiles_asaas_customer_id_unique_idx` + tabelas billing/audit.
- **0039 (plano 08-06)** owns: SOMENTE a extensão da função `handle_new_user()` pra propagar `cpf` do signup. Validação estática confirmou que 0039 não contém `alter table ... add column ... cpf` nem `create unique index`.

## Defesa em profundidade — dedup CPF (D-12)

1. **UI catch** no signup (error.message com 'cpf'/'profiles_cpf_unique') → mensagem humana.
2. Se o trigger silenciar o erro de UNIQUE (depende da versão do Supabase / on conflict só cobre PK), o profile fica com `cpf=NULL` → middleware redireciona pra `/perfil/completar` → `completeProfileAction` tenta UPDATE cpf e pega o 23505 explicitamente.

Esta duplicidade é intencional (não há transação única client↔trigger↔profile). O comportamento real do trigger frente a CPF duplicado é exatamente o que o smoke do founder (Task 4) valida.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `createChargeAction` selecionava coluna inexistente `profiles.email`**
- **Found during:** Task 2
- **Issue:** O plano fazia `.select('... email')` em profiles, mas `profiles` não tem coluna `email` (email vive em `auth.users`; confirmado em types/database.ts). A query teria erro em runtime.
- **Fix:** Removido `email` do select de profiles; usado `user.email` (sessão) pro Asaas customer — que já era a fonte usada para o campo email do customer.
- **Files modified:** apps/web/app/actions/billing.ts
- **Commit:** 6a3b2ad

**2. [Rule 3 - Blocking] Consumers de `evaluateTherapistProfile` quebrariam TS sem `cpf`**
- **Found during:** Task 3
- **Issue:** Adicionar `cpf` a `TherapistProfileInput` (obrigatório) quebraria 3 call sites além do middleware (dashboard/page, perfil/completar/page) por falta do campo + selects sem `cpf`.
- **Fix:** Os 3 selects ganharam `cpf` e os 3 call sites passam `cpf: profile?.cpf ?? null`.
- **Files modified:** apps/web/app/(dashboard)/dashboard/page.tsx, apps/web/app/perfil/completar/page.tsx, apps/web/middleware.ts
- **Commit:** 9ea4cd2

**3. [Rule 3 - Blocking] /perfil/completar não tinha campo CPF**
- **Found during:** Task 3
- **Issue:** `completeProfileAction` passou a exigir `cpf`; o form `complete-profile-form.tsx` não coletava CPF — o GATE de perfil incompleto (defesa em profundidade dedup) ficaria impossível de satisfazer.
- **Fix:** Adicionado input CPF mascarado (mesmo padrão do signup) ao form.
- **Files modified:** apps/web/app/perfil/completar/complete-profile-form.tsx
- **Commit:** 9ea4cd2

**Total deviations:** 3 (1 Rule 1, 2 Rule 3). Sem scope creep — todas correção/desbloqueio.

## TDD Gate Compliance

Tasks 1-3 `tdd="true"`. Task 1: RED (módulo ausente → transform fail) → GREEN (8 testes). Tasks 2-3: teste + impl em commit `feat` atômico (RED verificado: billing.test falhava por fixture, ajustado; signup helpers já cobertos). Refactor não necessário.

## Verification

- **Tests:** 23 novos GREEN (8 refund-policy + 10 billing + 5 signup-cpf). Suite billing+signup: 57 passed, 1 skipped (race integration de 08-05).
- **Lint:** `eslint` scoped nos 14 arquivos com `--max-warnings 0` → exit 0.
- **TSC:** `tsc --noEmit` sem erros nos arquivos tocados.
- **use-server hygiene:** `billing.ts` exporta SÓ funções async (createChargeAction, refundPackageAction); schemas/types em sibling.
- **Migration 0039:** validação estática confirma zero DDL de colunas + extensão de handle_new_user lendo cpf.
- **NÃO rodado:** `supabase db push` (apply live é ação do founder no checkpoint Task 4).

## Threat Model Status

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-08-06-01 (Spoofing sem session) | mitigate | ✓ auth.getUser() gate em ambas actions |
| T-08-06-02 (Tampering sku → crédito grátis) | mitigate | ✓ price_brl vem do DB (credit_packages), não do client |
| T-08-06-03 (Repudiation refund) | mitigate | ✓ credit_transactions INSERT + logAuditEvent |
| T-08-06-04 (CPF leak em logs) | mitigate | ✓ console.info só user.id + sku + payment_id |
| T-08-06-05 (refund cross-tenant) | mitigate | ✓ session/RLS no SELECT + .eq('user_id') defensive no UPDATE |
| T-08-06-06 (trial farming) | mitigate | ✓ UNIQUE(cpf) (0035) + 23505 → erro humano |

## Threat Flags

Nenhuma superfície de segurança nova fora do `<threat_model>` do plano.

## Known Stubs

Nenhum stub de dados/UI. `leituras_remaining=0` no INSERT pending NÃO é stub: é o estado correto até o webhook PAYMENT_CONFIRMED (08-04) ativar os créditos (A1=confirmed). UI de compra (08-10) e saldo (08-11) consomem estas actions reais.

## Checkpoint Pendente (Task 4 — founder)

Founder deve: (1) configurar env Asaas sandbox no Vercel preview; (2) `supabase db push --linked` (aplica 0039); (3) disparar `createChargeAction({ sku: 'avulsa' })` com sessão e abrir o `invoice_url`; (4) conferir `customer_credits` status='pending' + asaas_payment_id; (5) validar dedup CPF no signup (CPF repetido → erro humano). Resume-signal: "approved" ou descrição da falha.

## Self-Check: PASSED

- 7 arquivos criados + 7 modificados — todos FOUND em disco
- 3 commits FOUND (e1f7fbf, 6a3b2ad, 9ea4cd2)
- 23 tests GREEN; scoped lint exit 0; tsc limpo nos arquivos tocados
- Migration 0039 NÃO aplicada live (correto — é ação do founder no checkpoint)
