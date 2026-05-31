-- ----------------------------------------------------------------------------
-- 0042 — Fix: convert_reservation_to_consume "column reference user_id is ambiguous"
-- ----------------------------------------------------------------------------
-- BUG (0040): a função retorna TABLE(..., user_id uuid, ...) → o OUT cria uma
-- variável implícita `user_id` no escopo plpgsql. No UPDATE de débito (backed por
-- crédito), o predicado `and user_id = v_reservation.user_id` referenciava a
-- coluna `customer_credits.user_id` SEM qualificar → Postgres não sabe se é a
-- variável OUT ou a coluna → raise "column reference user_id is ambiguous".
--
-- Esse branch só roda quando v_reservation.credit_id IS NOT NULL (reserva backed
-- por CRÉDITO COMPRADO). Trial/internal (credit_id null) pulam → não davam erro.
-- Efeito: TODO consume de crédito comprado lançava exceção, engolida pelo
-- try/catch best-effort de analyze/route.ts → o relatório era entregue mas o
-- crédito NUNCA debitava (reserva ficava presa em 'active', saldo intacto).
-- Descoberto 2026-05-31 (reading 2c3df4c7, IRIS CODEX, 1ª leitura paga pós-trial).
--
-- FIX: qualificar a coluna como `customer_credits.user_id` no UPDATE. Idêntica
-- ao 0040 em todo o resto. Forward-only (CREATE OR REPLACE).

begin;

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
       and customer_credits.user_id = v_reservation.user_id; -- 0042: qualifica (era `user_id` ambíguo c/ a coluna OUT)
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
  'Fase 8 WR-07 (0040) + fix 0042: converte reservation active->converted + debita 1 leitura + grava ledger numa ÚNICA TX (atômico). 0042 qualifica customer_credits.user_id no UPDATE (era ambíguo com a coluna OUT user_id → quebrava todo consume de crédito comprado). Idempotente: already se não-active, not_found se inexistente. SECURITY DEFINER.';

grant execute on function public.convert_reservation_to_consume(uuid) to authenticated;

commit;
