-- 0041_phase_8_fix_reserve_balance_constraint.sql
--
-- Fase 8 HOTFIX: reserva de crédito PAGO sempre falhava com CHECK violation.
--
-- BUG (descoberto no go-live 2026-05-30, primeira compra real R$5):
--   fifo_reserve_credit (0037) reserva fazendo `leituras_reserved += 1` SEM
--   decrementar leituras_remaining (o remaining só baixa na conversão definitiva,
--   em convert_reservation_to_consume). Mas o CHECK constraint de 0035 era:
--       leituras_remaining + leituras_reserved <= leituras_purchased
--   Num crédito recém-ativado (remaining = purchased = N, reserved = 0), o
--   PRIMEIRO reserve estoura:  remaining(N) + reserved(1) = N+1 > purchased(N)
--   → Postgres 23514 (check_violation).
--   reserveCreditForReading (credits.ts) só mapeia P0001 → no_balance; um 23514
--   cai em db_error → analyze/route.ts:209 retorna 500 "Erro ao verificar
--   créditos. Tente novamente." → IMPOSSÍVEL gerar relatório com crédito pago.
--   (Trial e internal_use escapam: têm credit_id NULL, não tocam customer_credits.)
--
-- CAUSA RAIZ: dois modelos mentais conflitantes.
--   As 3 funções de billing (fifo_reserve_credit / release_reservation /
--   convert_reservation_to_consume, em 0037+0040) tratam reserved como um
--   SUBCONJUNTO de remaining — o disponível real pra nova reserva é
--   (remaining - reserved). É exatamente o que o SELECT FIFO de 0037 usa:
--       where (leituras_remaining - leituras_reserved) > 0     (linha 161)
--   Nesse modelo o invariante correto é `reserved <= remaining`.
--   O constraint de 0035 ficou no modelo DISJUNTO (reserved e remaining são
--   baldes separados que somam <= purchased) — que este código nunca seguiu.
--
-- FIX (mínimo — só troca o constraint; NÃO toca nenhuma função):
--   As funções de 0037+0040 já estão corretas e consistentes entre si:
--     reserve:  reserved += 1                       (remaining intacto)
--     convert:  remaining -= 1, reserved -= 1       (0040 linha 138-143)
--     release:  reserved -= 1                       (0040 linha 57-59)
--   Ciclo de 1 crédito pago (purchased=1):
--     ativação  → remaining=1, reserved=0   (reserved<=remaining: 0<=1 ✓)
--     reserve   → remaining=1, reserved=1   (1<=1 ✓)   ← com constraint ANTIGO: 2>1 ✗ (o bug)
--     convert   → remaining=0, reserved=0   (0<=0 ✓)
--   Só o constraint precisava mudar pra refletir o modelo que o código já usa.
--
-- DADOS EXISTENTES: o único crédito ativo em prod (purchased=1, remaining=1,
--   reserved=0) satisfaz o novo constraint (0<=1). Swap aplica sem violar linhas.
--
-- IDEMPOTÊNCIA: drop constraint if exists + add. Forward-only.
-- NÃO destrutivo de dados (só troca a definição do CHECK).
-- ⛔ NÃO APLICADA — aguarda OK do founder + `supabase db push --linked`.

begin;

alter table public.customer_credits
  drop constraint if exists customer_credits_balance_check;

alter table public.customer_credits
  add constraint customer_credits_balance_check
  check (leituras_reserved <= leituras_remaining);

comment on constraint customer_credits_balance_check on public.customer_credits is
  'Fase 8 (fix 0041): reservado nunca excede o disponível. Modelo das funções de billing (0037+0040): disponível real para nova reserva = leituras_remaining - leituras_reserved. reserve faz reserved+=1; convert faz remaining-=1 e reserved-=1; release faz reserved-=1. Substitui o constraint disjunto de 0035 (remaining+reserved<=purchased) que quebrava TODO reserve de crédito pago com CHECK violation 23514.';

commit;
