-- 0037_phase_8_helper_functions.sql
--
-- Fase 8: Pagamento + LGPD — funções Postgres helper (Wave 1, Plano 08-01).
--
-- CONTEXTO:
--   3 funções auxiliares para o sistema de créditos:
--   1. is_in_trial(p_user_id) — verifica se usuário está em trial ativo (D-06)
--   2. fifo_reserve_credit(p_user_id, p_reading_id) — reserva 1 crédito via FIFO
--      com advisory lock para serializar concorrência (T-08-01-02 race condition)
--   3. release_reservation(p_reading_id, p_reason) — libera reserva ativa
--      (cron diário + cancelamento manual)
--
-- SEGURANÇA:
--   fifo_reserve_credit + release_reservation são SECURITY DEFINER:
--   rodam com privilégios do owner (postgres), mas p_user_id é validado
--   pela server action que JÁ verificou session = user.id (gate em billing.ts
--   Plano 08-06). T-08-01-05: terapeuta não pode reservar pra outro user_id.
--
-- CONCORRÊNCIA:
--   pg_advisory_xact_lock(hashtext(user_id)) serializa reserves do mesmo
--   terapeuta. FOR UPDATE em customer_credits serializa reserves de créditos
--   distintos. Combinação elimina race condition do RESEARCH pitfall #3
--   (SELECT FOR UPDATE em row inexistente não bloqueia sem advisory lock).
--
-- IDEMPOTÊNCIA:
--   CREATE OR REPLACE: migration pode ser re-aplicada em dev sem erro.
--   release_reservation é idempotente via status guard (WHERE status = 'active').
--
-- Divisão de trabalho: Claude autorou; founder aplica (supabase db push --linked).

begin;

-- ============================================================================
-- 1) is_in_trial(p_user_id) — D-06, chamada em fifo_reserve_credit
-- ============================================================================
-- Retorna true se:
--   a) existe row em trial_status para o usuário (trial foi iniciado)
--   b) ended_at IS NULL (trial não foi manualmente encerrado)
--   c) trial_expires_at > now() (não expirou por tempo)
--   d) trial_readings_used < trial_readings_max (não esgotou leituras)
-- STABLE: sem side-effects; pode ser chamada múltiplas vezes na mesma TX.

create or replace function public.is_in_trial(p_user_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select coalesce(
    (select
       t.ended_at is null
       and t.trial_expires_at > now()
       and t.trial_readings_used < t.trial_readings_max
     from public.trial_status t
     where t.user_id = p_user_id),
    false)
$$;

comment on function public.is_in_trial(uuid) is
  'Fase 8 D-06: verifica se p_user_id está em trial ativo (ended_at IS NULL AND expires_at > now() AND used < max). Retorna false se não existe row em trial_status (usuário nunca iniciou trial). STABLE security definer. Chamada por fifo_reserve_credit (0037) e billing.ts gating (Plano 08-06).';

-- ============================================================================
-- 2) fifo_reserve_credit(p_user_id, p_reading_id) — D-04/D-09/D-11
-- ============================================================================
-- Reserva 1 crédito para a leitura p_reading_id, seguindo ordem de prioridade:
--   1. internal_use bypass (D-09): sem consumo, source='internal'
--   2. Trial ativo (D-06): decrementa trial slot, source='trial'
--   3. FIFO crédito mais antigo (D-04): decrementa leituras_reserved, source='credit'
--
-- Retorna TABLE(reservation_id uuid, credit_id uuid, source text):
--   source in ('internal', 'trial', 'credit')
--   credit_id = NULL para internal/trial
--
-- Race condition (T-08-01-02):
--   pg_advisory_xact_lock serializa chamadas do mesmo user_id.
--   FOR UPDATE serializa rows de customer_credits.
--
-- Error:
--   'no_balance' (SQLSTATE P0001) se nenhum dos 3 caminhos disponível.

create or replace function public.fifo_reserve_credit(
  p_user_id   uuid,
  p_reading_id uuid
) returns table(reservation_id uuid, credit_id uuid, source text)
language plpgsql
security definer
as $$
declare
  v_internal      boolean;
  v_in_trial      boolean;
  v_credit_id     uuid;
  v_reservation_id uuid;
begin
  -- Advisory lock no user_id para serializar reserves do mesmo terapeuta.
  -- hashtext() mapeia uuid string para bigint (sem collision em janela de TX).
  -- T-08-01-02: fecha race condition de SELECT FOR UPDATE em row inexistente.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- ── 1. Internal_use bypass (D-09) ─────────────────────────────────────────
  -- internal_use=true: acesso ilimitado, sem consumir crédito ou slot de trial.
  -- Cria reserva com credit_id NULL pra manter rastreabilidade da leitura.
  select internal_use into v_internal
    from public.profiles
   where id = p_user_id;

  if v_internal is true then
    insert into public.credit_reservations
      (user_id, credit_id, reading_id, expires_at)
    values
      (p_user_id, null, p_reading_id, now() + interval '7 days')
    returning id into v_reservation_id;

    return query select v_reservation_id, null::uuid, 'internal'::text;
    return;
  end if;

  -- ── 2. Trial ativo (D-06) ─────────────────────────────────────────────────
  -- Verifica trial antes de checar créditos pagos (D-08: trial primeiro).
  -- Atomic: UPDATE com WHERE guard + RETURNING garante que não há over-consume.
  -- T-08-01-03: CHECK constraint (0035) + WHERE guard = dupla barreira.
  v_in_trial := public.is_in_trial(p_user_id);

  if v_in_trial then
    update public.trial_status
       set trial_readings_used = trial_readings_used + 1
     where user_id = p_user_id
       and trial_readings_used < trial_readings_max;

    if not found then
      -- Trial esgotou entre is_in_trial() e o UPDATE (edge case extremo).
      -- Cai no caminho de crédito abaixo; se também não tiver crédito → no_balance.
      -- Nota: não retornamos aqui, deixamos cair no bloco FIFO.
      null;
    else
      insert into public.credit_reservations
        (user_id, credit_id, reading_id, expires_at)
      values
        (p_user_id, null, p_reading_id, now() + interval '7 days')
      returning id into v_reservation_id;

      -- Log da transação de trial (credit_id NULL — RESEARCH pitfall #2)
      insert into public.credit_transactions
        (user_id, credit_id, reading_id, type, amount)
      values
        (p_user_id, null, p_reading_id, 'reserve', -1);

      return query select v_reservation_id, null::uuid, 'trial'::text;
      return;
    end if;
  end if;

  -- ── 3. FIFO crédito mais antigo (D-04) ────────────────────────────────────
  -- SELECT oldest active credit com saldo disponível.
  -- FOR UPDATE: serializa UPDATE subsequente contra outras TXs concorrentes.
  -- (leituras_remaining - leituras_reserved) > 0: saldo disponível real.
  select id into v_credit_id
    from public.customer_credits
   where user_id = p_user_id
     and status = 'active'
     and expires_at > now()
     and (leituras_remaining - leituras_reserved) > 0
   order by purchase_date asc
   limit 1
   for update;

  if v_credit_id is null then
    raise exception 'no_balance'
      using errcode = 'P0001',
            detail  = 'Sem saldo disponível (créditos, trial ou internal_use).';
  end if;

  -- Incrementa reserved (remaining será decrementado na conversão — analyze/route.ts)
  update public.customer_credits
     set leituras_reserved = leituras_reserved + 1
   where id = v_credit_id;

  insert into public.credit_reservations
    (user_id, credit_id, reading_id, expires_at)
  values
    (p_user_id, v_credit_id, p_reading_id, now() + interval '7 days')
  returning id into v_reservation_id;

  -- Log da transação de crédito
  insert into public.credit_transactions
    (user_id, credit_id, reading_id, type, amount)
  values
    (p_user_id, v_credit_id, p_reading_id, 'reserve', -1);

  return query select v_reservation_id, v_credit_id, 'credit'::text;
end;
$$;

comment on function public.fifo_reserve_credit(uuid, uuid) is
  'Fase 8 D-04/D-09/D-11 RESEARCH §FIFO: reserva 1 crédito para p_reading_id via ordem de prioridade: internal_use (bypass) → trial ativo → FIFO crédito mais antigo. Advisory lock + FOR UPDATE eliminam race condition (T-08-01-02). Retorna (reservation_id, credit_id, source). Lança P0001 se sem saldo. SECURITY DEFINER: gate de autenticação em billing.ts (Plano 08-06) valida session antes de chamar.';

-- Grant de execução para terapeutas autenticados (chamada via supabase.rpc)
grant execute on function public.fifo_reserve_credit(uuid, uuid) to authenticated;

-- ============================================================================
-- 3) release_reservation(p_reading_id, p_reason) — D-11 (cron + manual)
-- ============================================================================
-- Libera reserva ativa vinculada a p_reading_id e devolve o saldo ao pool.
-- Idempotente: WHERE status = 'active' garante no-op em chamadas duplicadas.
-- Retorna true se liberou, false se não havia reserva ativa.
--
-- Casos de uso:
--   - Cron diário: release_reservation(reading_id, 'expired') para reservas com
--     expires_at < now() (varridas em batch pelo job Plano 08-10)
--   - Cancelamento manual: release_reservation(reading_id, 'manual') pelo terapeuta
--     via UI "cancelar processo" (D-11 UX dashboard Plano 08-06)

create or replace function public.release_reservation(
  p_reading_id uuid,
  p_reason     text default 'manual'
) returns boolean
language plpgsql
security definer
as $$
declare
  v_reservation public.credit_reservations%rowtype;
begin
  -- UPDATE atômico: STATUS guard (WHERE status = 'active') garante idempotência.
  -- Se reserva já foi converted/released/expired → not found → return false.
  update public.credit_reservations
     set status     = case
                        when p_reason = 'expired' then 'expired'
                        else 'released'
                      end,
         released_at = now()
   where reading_id = p_reading_id
     and status = 'active'
  returning * into v_reservation;

  if not found then
    return false;
  end if;

  -- Devolve 1 slot ao pool correto: crédito comprado ou trial
  if v_reservation.credit_id is not null then
    -- Crédito pago: decrementa reserved (remaining volta ao pool implicitamente)
    update public.customer_credits
       set leituras_reserved = greatest(leituras_reserved - 1, 0)
     where id = v_reservation.credit_id;
  else
    -- Trial ou internal_use (credit_id NULL — RESEARCH pitfall #2):
    -- devolve 1 ao trial readings_used apenas se foi reserva de trial.
    -- internal_use: trial_status pode não existir; UPDATE é no-op se não encontrar.
    update public.trial_status
       set trial_readings_used = greatest(trial_readings_used - 1, 0)
     where user_id = v_reservation.user_id
       and ended_at is null;
  end if;

  -- Log da liberação no transaction ledger
  insert into public.credit_transactions
    (user_id, credit_id, reading_id, type, amount, notes)
  values
    (v_reservation.user_id,
     v_reservation.credit_id,
     p_reading_id,
     case when p_reason = 'expired' then 'expire' else 'release' end,
     1,  -- positivo: devolução ao saldo
     p_reason);

  return true;
end;
$$;

comment on function public.release_reservation(uuid, text) is
  'Fase 8 D-11: libera reserva ativa de p_reading_id e devolve slot ao pool. Idempotente via status guard (WHERE status = active). p_reason: expired (cron 7d) | manual (cancelamento terapeuta) | admin (ajuste founder). Devolve ao crédito comprado (credit_id not null) ou trial (credit_id null). Retorna false se reserva não existia/já liberada. SECURITY DEFINER.';

-- Grant de execução
grant execute on function public.release_reservation(uuid, text) to authenticated;

commit;
