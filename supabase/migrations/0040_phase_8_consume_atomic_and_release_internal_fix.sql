-- 0040_phase_8_consume_atomic_and_release_internal_fix.sql
--
-- Fase 8: correções pós code-review (REVIEW.md WR-01 + WR-07).
--
-- Forward-only. CREATE OR REPLACE redefine duas funções de 0037 + adiciona uma
-- nova função SECURITY DEFINER. Editar 0037 in-place seria no-op (db push é
-- version-tracked, não content-tracked) — daí esta migration nova.
--
-- Divisão de trabalho: Claude autorou; founder aplica (supabase db push --linked).
--
-- ============================================================================
-- WR-01: release_reservation NÃO pode decrementar trial_readings_used para
--        reservas internal_use (credit_id NULL é compartilhado entre trial E
--        internal). O founder (internal_use=true) também tem row em
--        trial_status; a release atual re-concedia trial silenciosamente.
--        Fix: re-checar internal_use antes de mexer no contador de trial.
--
-- WR-07: convertReservationToConsume (credits.ts) fazia flip de status +
--        decrement de saldo em 2 statements NÃO-atômicos. Crash entre eles =
--        reservation 'converted' mas leituras_reserved nunca decrementado
--        (slot travado pra sempre). Fix: função SECURITY DEFINER que faz
--        flip + decrement + ledger numa única TX (espelha fifo_reserve_credit).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- WR-01: release_reservation — não decrementa trial para internal_use
-- ----------------------------------------------------------------------------
create or replace function public.release_reservation(
  p_reading_id uuid,
  p_reason     text default 'manual'
) returns boolean
language plpgsql
security definer
as $$
declare
  v_reservation public.credit_reservations%rowtype;
  v_internal    boolean;
begin
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

  if v_reservation.credit_id is not null then
    -- Crédito pago: devolve 1 ao pool de reserved.
    update public.customer_credits
       set leituras_reserved = greatest(leituras_reserved - 1, 0)
     where id = v_reservation.credit_id;
  else
    -- credit_id NULL = trial OU internal_use. WR-01: só devolve ao contador de
    -- trial se NÃO for internal_use (o reserve de internal nunca incrementou o
    -- contador — fifo_reserve_credit retorna antes). Decrementar aqui re-
    -- concederia trial pro founder.
    select coalesce(internal_use, false) into v_internal
      from public.profiles
     where id = v_reservation.user_id;

    if not v_internal then
      update public.trial_status
         set trial_readings_used = greatest(trial_readings_used - 1, 0)
       where user_id = v_reservation.user_id
         and ended_at is null;
    end if;
  end if;

  insert into public.credit_transactions
    (user_id, credit_id, reading_id, type, amount, notes)
  values
    (v_reservation.user_id,
     v_reservation.credit_id,
     p_reading_id,
     case when p_reason = 'expired' then 'expire' else 'release' end,
     1,
     p_reason);

  return true;
end;
$$;

comment on function public.release_reservation(uuid, text) is
  'Fase 8 D-11 (+WR-01 fix 0040): libera reserva ativa de p_reading_id e devolve slot ao pool. Idempotente via status guard. credit_id not null = devolve ao crédito; credit_id null + internal_use=false = devolve ao trial; internal_use=true = NÃO mexe no trial (evita re-grant ao founder). SECURITY DEFINER.';

grant execute on function public.release_reservation(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- WR-07: convert_reservation_to_consume — flip + decrement + ledger atômicos
-- ----------------------------------------------------------------------------
-- Converte a reservation 'active' de p_reading_id → 'converted', debita
-- firmemente 1 leitura do crédito (se backed por crédito) e grava o ledger,
-- TUDO numa única TX. Espelha a atomicidade de fifo_reserve_credit.
--
-- Idempotente: se a reservation não está 'active' → retorna ('already', null).
-- Race-safe: o UPDATE com WHERE status='active' + RETURNING garante que apenas
-- um writer flipa; concorrentes caem em not found → 'already'.
--
-- Retorna TABLE(outcome text, reservation_id uuid, user_id uuid, credit_id uuid):
--   outcome in ('consumed', 'already', 'not_found')

create or replace function public.convert_reservation_to_consume(
  p_reading_id uuid
) returns table(outcome text, reservation_id uuid, user_id uuid, credit_id uuid)
language plpgsql
security definer
as $$
declare
  v_reservation public.credit_reservations%rowtype;
begin
  -- Flip atômico active → converted (race guard via WHERE + RETURNING).
  update public.credit_reservations
     set status = 'converted'
   where reading_id = p_reading_id
     and status = 'active'
  returning * into v_reservation;

  if not found then
    -- Já converted/released/expired OU inexistente. Diferencia pro caller.
    if exists (select 1 from public.credit_reservations where reading_id = p_reading_id) then
      return query select 'already'::text, null::uuid, null::uuid, null::uuid;
    else
      return query select 'not_found'::text, null::uuid, null::uuid, null::uuid;
    end if;
    return;
  end if;

  -- Backed por crédito (não trial/internal): debita firmemente — MESMA TX.
  if v_reservation.credit_id is not null then
    update public.customer_credits
       set leituras_remaining = greatest(leituras_remaining - 1, 0),
           leituras_reserved  = greatest(leituras_reserved - 1, 0)
     where id = v_reservation.credit_id
       and user_id = v_reservation.user_id; -- defensive (pitfall #9)
  end if;

  insert into public.credit_transactions
    (user_id, credit_id, reading_id, type, amount, notes)
  values
    (v_reservation.user_id,
     v_reservation.credit_id,
     p_reading_id,
     'consume',
     -1,
     'convert_reservation_to_consume ' || v_reservation.id);

  return query select 'consumed'::text, v_reservation.id, v_reservation.user_id, v_reservation.credit_id;
end;
$$;

comment on function public.convert_reservation_to_consume(uuid) is
  'Fase 8 WR-07 fix 0040: converte reservation active→converted + debita 1 leitura + grava ledger numa ÚNICA TX (atômico, espelha fifo_reserve_credit). Substitui os 2 statements não-atômicos de credits.ts. Idempotente: outcome=already se não-active, not_found se inexistente. SECURITY DEFINER.';

grant execute on function public.convert_reservation_to_consume(uuid) to authenticated;

commit;
