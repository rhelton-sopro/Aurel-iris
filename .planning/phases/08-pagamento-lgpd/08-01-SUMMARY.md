---
phase: 08-pagamento-lgpd
plan: "01"
subsystem: database
tags: [supabase, postgres, rls, billing, lgpd, credits, fifo, asaas]

requires:
  - phase: 07.4-iris-codex-report
    provides: report pipeline + analyze/route.ts que receberá gate de crédito
  - phase: 11.1-invite-therapist
    provides: profiles schema + RLS patterns estabelecidos (0033)

provides:
  - "7 tabelas de billing/LGPD: credit_packages, customer_credits, credit_transactions, credit_reservations, trial_status, asaas_webhook_events, audit_events"
  - "ALTER profiles: asaas_customer_id, internal_use, cpf (tos_accepted_at+tos_version já existiam)"
  - "3 funções Postgres: is_in_trial, fifo_reserve_credit (FIFO+advisory lock), release_reservation"
  - "4 SKUs seedados com pricing locked D-02"
  - "16 RLS policies (3 patterns: user_id, catálogo público, service-role only)"

affects:
  - 08-02-consent-term
  - 08-03-trial-gate
  - 08-04-asaas-webhook
  - 08-05-credit-reserve-flow
  - 08-06-billing-server-actions
  - 08-07-purchase-ui

tech-stack:
  added: []
  patterns:
    - "FIFO credit consumption via purchase_date ASC + advisory lock + FOR UPDATE"
    - "RLS Pattern C (service-role only) para tabelas de auditoria/webhook"
    - "SECURITY DEFINER function com advisory lock para serializar concorrência"
    - "Idempotência de migrations via IF NOT EXISTS + ON CONFLICT DO NOTHING"

key-files:
  created:
    - supabase/migrations/0035_phase_8_billing_lgpd_schema.sql
    - supabase/migrations/0036_phase_8_billing_lgpd_rls.sql
    - supabase/migrations/0037_phase_8_helper_functions.sql
    - supabase/migrations/0038_phase_8_seed_packages.sql
  modified:
    - apps/web/types/database.ts

key-decisions:
  - "tos_accepted_at e tos_version NÃO adicionados ao ALTER profiles (já existiam desde migration 0022)"
  - "credit_reservations.user_id adicionado explicitamente (necessário para release_reservation devolver ao trial correto)"
  - "A1 = confirmed: créditos liberados em PAYMENT_CONFIRMED (UX-first, aceita risco raro de chargeback) — usado em plano 08-04"
  - "A6 = ambos: termo de consentimento biométrico suportado em remote_link E office_handoff via consent_channel — usado em plano 08-08"

requirements-completed: [BILLING-01, BILLING-02, BILLING-03, LGPD-01, LGPD-04]

duration: ~35min
completed: 2026-05-28
---

# Phase 08 Plan 01: Billing + LGPD Schema — COMPLETO

**DDL foundation da Fase 8: 7 tabelas + ALTER profiles + 3 funções FIFO + 4 SKUs seedados em 4 migrations aditivas idempotentes — aplicadas LIVE pelo founder via `supabase db push --linked`, types regenerados, A1=confirmed + A6=ambos decididos**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-28T21:55:00Z
- **Completed:** 2026-05-28 (checkpoint resolvido pelo founder)
- **Tasks:** 5/5 completas
- **Files modified:** 4 criados, 1 modificado (types/database.ts)

## Accomplishments

- 4 migrations SQL criadas e commitadas atomicamente, estritamente aditivas, zero DROP, totalmente idempotentes
- Migration 0035: 7 tabelas novas + 3 colunas em profiles com CHECK constraints de defense-in-depth (T-08-01-01/03)
- Migration 0036: 16 RLS policies em 3 patterns (Pattern A user_id, B catálogo público, C service-role only) + invariante append-only em credit_transactions/audit_events
- Migration 0037: 3 funções SECURITY DEFINER — is_in_trial (STABLE), fifo_reserve_credit (PLPGSQL + advisory lock + FOR UPDATE — T-08-01-02), release_reservation (idempotente)
- Migration 0038: 4 SKUs com pricing exato D-02 via ON CONFLICT DO NOTHING

## Task Commits

1. **Task 1: Migration 0035 — schema (7 tabelas + ALTER profiles)** - `ccca3a5` (feat)
2. **Task 2: Migration 0036 — RLS policies (7 tabelas, 16 policies)** - `2745e97` (feat)
3. **Task 3: Migrations 0037+0038 — funções FIFO + seed 4 SKUs** - `c4711d1` (feat)
4. **Task 4: Regen types/database.ts** - `8f572fc` (feat)
5. **Task 5: Checkpoint human-verify** — RESOLVIDO pelo founder (migrations LIVE + A1/A6 decididos)

## Files Created

- `supabase/migrations/0035_phase_8_billing_lgpd_schema.sql` — 7 tabelas + ALTER profiles (291 linhas)
- `supabase/migrations/0036_phase_8_billing_lgpd_rls.sql` — 16 RLS policies em 7 tabelas (185 linhas)
- `supabase/migrations/0037_phase_8_helper_functions.sql` — 3 funções SECURITY DEFINER (232 linhas)
- `supabase/migrations/0038_phase_8_seed_packages.sql` — 4 SKUs pricing locked (36 linhas)

## Files Modified

- `apps/web/types/database.ts` — regenerado via `pnpm gen:types` após migrations LIVE; +324 linhas (7 tabelas + 3 colunas profiles + 3 funções), zero deleções

## Decisions Made

- `tos_accepted_at` + `tos_version` já existem desde migration 0022 — não recriados em 0035 (IF NOT EXISTS bastaria, mas comentário explicativo adicionado para clareza)
- `credit_reservations.user_id` adicionado explicitamente na tabela — necessário para `release_reservation()` saber qual usuário está devolvendo ao trial (o plano mencionava como coluna implícita, foi tornado explícito na implementação)
- `credit_transactions.user_id` adicionado explicitamente — FK para profiles com ON DELETE CASCADE, necessário para RLS Pattern A e para ledger por usuário
- A decisão de seed inline na migration (não script .mjs) mantida conforme RESEARCH §No Analog Found

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] user_id adicionado explicitamente em credit_reservations e credit_transactions**

- **Found during:** Task 1 (criação das tabelas) + Task 3 (release_reservation)
- **Issue:** O plano D-20 esboçou o schema sem mencionar `user_id` explicitamente em credit_reservations e credit_transactions. A função `release_reservation` precisa de `v_reservation.user_id` para devolver ao trial correto; a RLS Pattern A precisa de `user_id = auth.uid()` para filtrar rows do próprio terapeuta.
- **Fix:** Adicionado `user_id uuid not null references public.profiles(id) on delete cascade` em ambas as tabelas. Alinhado com o padrão de todos os demais models do sistema.
- **Arquivos:** 0035_phase_8_billing_lgpd_schema.sql
- **Comprometimento:** ccca3a5 (Task 1 commit)

**2. [Rule 3 - Blocking/Resolvido] Task 4 (types/database.ts) sequenciada após checkpoint**

- **Found during:** Task 4
- **Issue:** `pnpm gen:types` requer `supabase gen types typescript --linked` que conecta ao Supabase remoto. As migrations 0035-0038 só foram aplicadas ao linked remote pelo founder no checkpoint Task 5.
- **Fix:** Após o founder executar `supabase db push --linked` (4 migrations aplicadas sem erro) e rodar `pnpm gen:types`, o arquivo regenerado foi verificado (7 tabelas + 3 colunas profiles + 3 funções, +324 linhas, zero deleções) e commitado em `8f572fc`.
- **Impacto:** Resolvido. Type regen era sequencialmente dependente de supabase db push, agora concluído.

---

**Total deviations:** 2 (1 auto-fixed Rule 2, 1 sequencial Rule 3 — ambos resolvidos)
**Impact on plan:** Sem scope creep. user_id é coluna obrigatória para RLS e funções. Type regen concluído pós-checkpoint.

## Validação Estática das Migrations (sem supabase db push --linked)

- **Zero DROPs destrutivos:** grep confirmado em 0035 e 0036
- **Idempotência 0035:** 19 cláusulas `IF NOT EXISTS`
- **Idempotência 0036:** 16 `DROP POLICY IF EXISTS` antes de cada `CREATE POLICY`
- **Idempotência 0037:** 3 `CREATE OR REPLACE FUNCTION`
- **Idempotência 0038:** `ON CONFLICT (sku) DO NOTHING`
- **RLS 7 tabelas:** `enable row level security` confirmado em todas
- **16 policies criadas:** contagem confirmada
- **3 funções:** is_in_trial + fifo_reserve_credit + release_reservation
- **Pricing exact D-02:** 99.70 / 298.50 / 745.50 / 1191.00 confirmados

## Threat Surface Scan

Novas superfícies de ataque introduzidas (verificadas contra o threat model do plano):

| Flag | Arquivo | Descrição |
|------|---------|-----------|
| T-08-01-01 mitigado | 0035 | CHECK constraint `remaining+reserved<=purchased` — defense-in-depth |
| T-08-01-02 mitigado | 0037 | advisory lock + FOR UPDATE em fifo_reserve_credit |
| T-08-01-03 mitigado | 0035+0037 | CHECK `used<=max` + WHERE guard atômico em trial |
| T-08-01-04 mitigado | 0036 | RLS Pattern C — audit_events sem policy authenticated |
| T-08-01-05 parcial | 0037 | SECURITY DEFINER OK; gate em billing.ts (Plano 08-06) fecha |
| T-08-01-06 mitigado | 0035+0036 | credit_transactions append-only sem UPDATE/DELETE para authenticated |

## Known Stubs

Nenhum — migrations são DDL puro, sem stubs de dados ou UI.

## Checkpoint Task 5 — RESOLVIDO pelo founder

Founder aplicou as 4 migrations LIVE e verificou no Supabase remoto:

- **`supabase db push --linked`:** 4 migrations aplicadas sem erro (NOTICEs esperados de DROP IF EXISTS)
- **credit_packages:** 4 rows com pricing exato D-02 (avulsa R$99,70 / pequeno R$298,50 / médio R$745,50 / grande R$1.191,00)
- **RLS:** 7 tabelas com `rowsecurity = true`
- **Funções:** 3 presentes (`fifo_reserve_credit`, `is_in_trial`, `release_reservation`)
- **`pnpm gen:types`:** OK (só aviso cosmético de versão CLI) → `apps/web/types/database.ts` regenerado e commitado em `8f572fc`

### Decisões do founder

- **A1 = confirmed:** créditos liberados no evento `PAYMENT_CONFIRMED` (não `PAYMENT_RECEIVED`). UX-first; aceita risco raro de chargeback. → consumido pelo plano **08-04** (webhook Asaas).
- **A6 = ambos:** termo de consentimento biométrico do cliente suportado em **ambos** os canais — `remote_link` (cliente em casa via convite) E `office_handoff` (terapeuta no consultório com tablet) via campo `consent_channel`. → consumido pelo plano **08-08**.

## Next Phase Readiness

- Migrations 0035-0038 LIVE no remoto + types regenerados → Waves 2-6 desbloqueadas
- Plano 08-02 (termo de consentimento) pode rodar — A6=ambos resolvido
- Plano 08-04 (webhook Asaas) pode rodar — A1=confirmed resolvido
- Plano 08-08 (UI termo biométrico) usa A6=ambos via consent_channel

## Self-Check: PASSED

- 5 arquivos verificados em disco (4 migrations + types/database.ts) — todos FOUND
- 4 commits verificados no git log (ccca3a5, 2745e97, c4711d1, 8f572fc) — todos FOUND
- Zero deleções no commit Task 4 (8f572fc): +324 linhas, 0 removidas

---
*Phase: 08-pagamento-lgpd*
*Status: COMPLETO — todas as 5 tasks concluídas, checkpoint resolvido pelo founder*
*Completed: 2026-05-28*
