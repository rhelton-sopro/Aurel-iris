-- 0052_fecha_brechas_de_credito.sql
--
-- Auditoria externa de 2026-09-11 (item 1), verificada no código: o banco deixava um
-- terapeuta logado — e em parte até quem NÃO está logado — mexer em crédito direto,
-- sem passar pelo app. Nenhuma das 51 migrações anteriores tinha um REVOKE.
--
-- As quatro portas que esta migração fecha:
--
--   A. INSERT direto em customer_credits (policy só checava user_id = auth.uid()):
--      o terapeuta se dava saldo — status 'active', N leituras, validade livre.
--      Mesma porta em credit_transactions (histórico forjável), credit_reservations
--      (uma reserva 'converted' inventada fazia o gate de geração achar que era
--      regeneração = relatório de graça) e trial_status.
--
--   B. UPDATE no próprio profiles em QUALQUER coluna (policy "for all" de 0001, sem
--      proteção de coluna): ligar internal_use = geração ilimitada sem cobrança;
--      zerar beta_readings_used; trocar o asaas_customer_id.
--
--   C. EXECUTE nas funções SECURITY DEFINER liberado para anon e authenticated
--      (0002 dá "grant all on all functions" + default privileges, e 0040 ainda dá
--      grant explícito a authenticated). Nenhuma confere quem chama. Com a chave
--      pública do site, sem login: reservar e depois QUEIMAR o crédito de qualquer
--      terapeuta; trocar o exame de qualquer leitura; liberar a própria reserva no
--      meio da geração (relatório grátis + trial eterno).
--
--   D. Default privileges: toda função criada no futuro nasceria executável por anon.
--
-- ⭐ Nada disto muda o app: TODA escrita legítima de crédito já passa pelo servidor com
-- service-role (compra, webhook, cron, painel admin, geração) — conferido arquivo por
-- arquivo em 2026-09-11. O terapeuta continua LENDO os próprios créditos/reservas/trial
-- (as policies de SELECT ficam) e editando nome, telefone, CPF, especialidades, termos e
-- endereço do perfil (colunas que o trigger abaixo não toca).
--
-- Checagem só-leitura em produção antes de aplicar (2026-09-11): nenhuma conta com
-- internal_use ligado, toda reserva com rastro de auditoria, nenhum exame trocado —
-- nenhum sinal de que alguém tenha usado as portas.
--
-- Divisão de trabalho: Claude autorou; aplicar com `supabase db push --linked`.

begin;

-- ============================================================================
-- A. Tabelas de crédito — terapeuta só LÊ; quem escreve é o servidor
-- ============================================================================
drop policy if exists "customer_credits_self_insert"    on public.customer_credits;
drop policy if exists "credit_transactions_self_insert" on public.credit_transactions;
drop policy if exists "credit_reservations_self_insert" on public.credit_reservations;
drop policy if exists "trial_status_self_insert"        on public.trial_status;

-- ============================================================================
-- B. profiles — colunas de cobrança e controle só mudam pelo servidor
-- ============================================================================
-- Trigger em vez de GRANT por coluna: o "grant all" de 0002 vale para a tabela
-- inteira e revogar coluna a coluna exigiria regravar o GRANT de todas as outras.
--
-- `current_user` distingue quem escreve: requisição do navegador chega como
-- 'authenticated' (ou 'anon'); service-role chega como 'service_role'; funções
-- SECURITY DEFINER (signup, fifo_reserve_credit…) rodam como o dono, 'postgres'.
-- Só as duas primeiras são barradas.
create or replace function public.profiles_protege_colunas_de_cobranca()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- O perfil nasce pelo trigger de signup (definer). Um INSERT vindo do navegador
    -- não pode nascer com privilégio.
    new.internal_use       := false;
    new.beta_readings_used := 0;
    new.asaas_customer_id  := null;
    new.stripe_customer_id := null;
    return new;
  end if;

  if new.internal_use        is distinct from old.internal_use
     or new.beta_readings_used  is distinct from old.beta_readings_used
     or new.asaas_customer_id   is distinct from old.asaas_customer_id
     or new.stripe_customer_id  is distinct from old.stripe_customer_id
     or new.subscription_status is distinct from old.subscription_status
     or new.trial_ends_at       is distinct from old.trial_ends_at
     or new.created_at          is distinct from old.created_at
     or new.id                  is distinct from old.id
  then
    raise exception 'coluna protegida de profiles: alteração só pelo servidor'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.profiles_protege_colunas_de_cobranca() is
  '0052 (auditoria 2026-09-11): barra o navegador (authenticated/anon) de alterar internal_use, beta_readings_used, asaas_customer_id, stripe_customer_id, subscription_status, trial_ends_at, created_at e id em profiles. Service-role e funções SECURITY DEFINER passam.';

drop trigger if exists profiles_protege_colunas_de_cobranca on public.profiles;
create trigger profiles_protege_colunas_de_cobranca
  before insert or update on public.profiles
  for each row execute function public.profiles_protege_colunas_de_cobranca();

-- ============================================================================
-- C. Funções SECURITY DEFINER — só o servidor executa
-- ============================================================================
-- Por NOME, cobrindo todas as assinaturas: `persist_report_findings_versioned` tem
-- duas (0030 e 0031 — o "create or replace" com parâmetros novos criou uma sobrecarga
-- em vez de substituir). O app chama todas elas com service-role (conferido).
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'fifo_reserve_credit',
         'release_reservation',
         'convert_reservation_to_consume',
         'is_in_trial',
         'increment_beta_readings_used',
         'persist_report_findings_versioned',
         'persist_report_phrases_versioned',
         'claim_due_social_posts',
         'claim_one_social_post',
         'reap_stuck_publishing',
         'profiles_protege_colunas_de_cobranca'
       )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.assinatura);
    execute format('grant execute on function %s to service_role', f.assinatura);
  end loop;
end;
$$;

-- ============================================================================
-- D. Funções FUTURAS nascem fechadas
-- ============================================================================
-- ⚠️ Consequência para quem escrever a próxima migração: uma função nova que o
-- NAVEGADOR precise chamar (como a `match_knowledge_chunks`, que roda com a sessão do
-- terapeuta) precisa de `grant execute ... to authenticated` explícito. As que já
-- existem mantêm o que têm — "create or replace" preserva as permissões.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

commit;
