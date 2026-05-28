-- 0036_phase_8_billing_lgpd_rls.sql
--
-- Fase 8: Pagamento + LGPD — RLS policies para as 8 tabelas novas (Wave 1, Plano 08-01).
--
-- CONTEXTO:
--   Política de segurança Row Level Security para as tabelas criadas em 0035.
--   Deve ser aplicada APÓS 0035 (ordem obrigatória via supabase migration queue).
--
-- TRUST BOUNDARIES (per threat model Plano 08-01):
--   client→DB via RLS     : Terapeuta authenticated só lê/insere rows com user_id = auth.uid()
--   service-role→DB       : Webhook + cron + audit emitter bypassam RLS automaticamente
--   founder→all tables    : auth.jwt() ->> 'email' = 'rhelton@gmail.com' bypassa toda RLS
--   any→fifo_reserve_credit: SECURITY DEFINER — function roda com privilégios do owner (0037)
--
-- PADRÕES:
--   Pattern A — tabelas com user_id (terapeuta vê próprios dados):
--     customer_credits, credit_transactions, credit_reservations, trial_status
--   Pattern B — catálogo público read-only (active=true):
--     credit_packages
--   Pattern C — service-role only + founder read (terapeuta NÃO vê):
--     asaas_webhook_events, audit_events
--
-- IMPORTANTE: NÃO criar policy em `profiles` — Fase 1 já configurou (0011).
--   ALTER de colunas (0035) não exige nova RLS.
--
-- IDEMPOTÊNCIA: cada policy precedida de DROP POLICY IF EXISTS + CREATE.
--   Permite re-aplicar a migration em dev sem erro.
--
-- INVARIANTE DE IMUTABILIDADE:
--   credit_transactions e audit_events NÃO têm policy UPDATE/DELETE para authenticated.
--   Isso garante append-only operacional (service-role pode fazer UPDATE se necessário).
--
-- Per memory `feedback_supabase_rls_no_auth_users`: NUNCA query auth.users em policies.
--   Usar auth.jwt() ->> 'email' para founder bypass (verificado em 0020/0033).
--
-- Divisão de trabalho: Claude autorou; founder aplica (supabase db push --linked).

begin;

-- ============================================================================
-- Pattern A — customer_credits (terapeuta vê próprios créditos)
-- ============================================================================
alter table public.customer_credits enable row level security;

drop policy if exists "customer_credits_self_read" on public.customer_credits;
create policy "customer_credits_self_read"
  on public.customer_credits for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "customer_credits_self_insert" on public.customer_credits;
create policy "customer_credits_self_insert"
  on public.customer_credits for insert to authenticated
  with check (user_id = auth.uid());

-- Sem UPDATE/DELETE para authenticated: modificações vêm via service-role
-- (webhook handler, cron) ou função SECURITY DEFINER (fifo_reserve_credit).

drop policy if exists "founder_full_access" on public.customer_credits;
create policy "founder_full_access"
  on public.customer_credits for all to authenticated
  using ((auth.jwt() ->> 'email') = 'rhelton@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'rhelton@gmail.com');

-- ============================================================================
-- Pattern A — credit_transactions (append-only — sem UPDATE/DELETE)
-- ============================================================================
alter table public.credit_transactions enable row level security;

drop policy if exists "credit_transactions_self_read" on public.credit_transactions;
create policy "credit_transactions_self_read"
  on public.credit_transactions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "credit_transactions_self_insert" on public.credit_transactions;
create policy "credit_transactions_self_insert"
  on public.credit_transactions for insert to authenticated
  with check (user_id = auth.uid());

-- INVARIANTE: sem UPDATE/DELETE para authenticated = append-only (imutável).
-- Auditabilidade garantida: nenhum terapeuta pode apagar rastro de transação.

drop policy if exists "founder_full_access" on public.credit_transactions;
create policy "founder_full_access"
  on public.credit_transactions for all to authenticated
  using ((auth.jwt() ->> 'email') = 'rhelton@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'rhelton@gmail.com');

-- ============================================================================
-- Pattern A — credit_reservations (terapeuta vê reservas próprias)
-- ============================================================================
alter table public.credit_reservations enable row level security;

drop policy if exists "credit_reservations_self_read" on public.credit_reservations;
create policy "credit_reservations_self_read"
  on public.credit_reservations for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "credit_reservations_self_insert" on public.credit_reservations;
create policy "credit_reservations_self_insert"
  on public.credit_reservations for insert to authenticated
  with check (user_id = auth.uid());

-- Sem UPDATE/DELETE para authenticated: status updates via service-role ou
-- função SECURITY DEFINER (release_reservation em 0037).

drop policy if exists "founder_full_access" on public.credit_reservations;
create policy "founder_full_access"
  on public.credit_reservations for all to authenticated
  using ((auth.jwt() ->> 'email') = 'rhelton@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'rhelton@gmail.com');

-- ============================================================================
-- Pattern A — trial_status (1 row por terapeuta, chave primária = user_id)
-- ============================================================================
alter table public.trial_status enable row level security;

drop policy if exists "trial_status_self_read" on public.trial_status;
create policy "trial_status_self_read"
  on public.trial_status for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "trial_status_self_insert" on public.trial_status;
create policy "trial_status_self_insert"
  on public.trial_status for insert to authenticated
  with check (user_id = auth.uid());

-- Sem UPDATE/DELETE para authenticated: incremento de trial_readings_used
-- ocorre INSIDE fifo_reserve_credit() SECURITY DEFINER (0037 — atomic + serialized).

drop policy if exists "founder_full_access" on public.trial_status;
create policy "founder_full_access"
  on public.trial_status for all to authenticated
  using ((auth.jwt() ->> 'email') = 'rhelton@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'rhelton@gmail.com');

-- ============================================================================
-- Pattern B — credit_packages (catálogo público read-only para terapeutas)
-- ============================================================================
alter table public.credit_packages enable row level security;

drop policy if exists "credit_packages_read_all" on public.credit_packages;
create policy "credit_packages_read_all"
  on public.credit_packages for select to authenticated
  using (active = true);

-- founder bypass: criar/desativar SKUs, editar pricing para novos SKUs
drop policy if exists "founder_full_access" on public.credit_packages;
create policy "founder_full_access"
  on public.credit_packages for all to authenticated
  using ((auth.jwt() ->> 'email') = 'rhelton@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'rhelton@gmail.com');

-- ============================================================================
-- Pattern C — asaas_webhook_events (service-role + founder, terapeuta NÃO vê)
-- ============================================================================
alter table public.asaas_webhook_events enable row level security;

-- Sem policy authenticated: INSERT/SELECT bloqueado para terapeuta.
-- Service-role bypassa RLS automaticamente (Supabase default).
-- Security: se anon/service_key vazar, nenhum terapeuta lista eventos raw de pagamento.

drop policy if exists "founder_full_access" on public.asaas_webhook_events;
create policy "founder_full_access"
  on public.asaas_webhook_events for all to authenticated
  using ((auth.jwt() ->> 'email') = 'rhelton@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'rhelton@gmail.com');

-- ============================================================================
-- Pattern C — audit_events (append-only, service-role + founder, terapeuta NÃO vê)
-- ============================================================================
alter table public.audit_events enable row level security;

-- Sem policy authenticated: terapeuta não lê audit log.
-- Service-role insere eventos via audit emitter (Plano 08-09).
-- INVARIANTE append-only: sem UPDATE/DELETE para authenticated (incluindo founder
-- que já tem all-access — invariante operacional é garantida por ausência de
-- policy UPDATE/DELETE para o role autenticado genérico).

drop policy if exists "founder_full_access" on public.audit_events;
create policy "founder_full_access"
  on public.audit_events for all to authenticated
  using ((auth.jwt() ->> 'email') = 'rhelton@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'rhelton@gmail.com');

commit;
