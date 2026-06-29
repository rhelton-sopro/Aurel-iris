-- 0050_signup_trigger_creates_trial.sql
-- Garante que TODO terapeuta novo ganhe 1 trial, de forma atômica no signup.
--
-- Motivação (2026-06-28): o caminho de concessão do trial era best-effort no
-- front (`ensureTrialStartedAction()` em signup/page.tsx ignora o resultado).
-- Se a rede cai / aba fecha / a action lança, a row em `trial_status` nunca é
-- criada e ninguém percebe — o painel mostra "0 crédito". Auditoria da última
-- semana achou 2/2 cadastros novos SEM trial (Caroline 06-24, Celiane 06-28).
-- Falha sistemática, não azar isolado.
--
-- Correção definitiva: criar a row de `trial_status` dentro do MESMO trigger
-- `handle_new_user()` que já cria o `profiles`, na mesma transação do INSERT em
-- auth.users. Imune a queda de rede / aba fechada. O `ensureTrialStartedAction`
-- no front permanece como backstop idempotente (no-op via on conflict).
--
-- Regra (founder 2026-06-28): "todo terapeuta que cadastrar ganha 1 trial".
-- Números canônicos vêm de lib/billing/config.ts: 1 leitura / 15 dias.
--   trial_readings_max = 1   (D-06)
--   trial_expires_at   = now() + 15 days   (D-06)
--
-- Preserva byte-a-byte o INSERT em public.profiles de 0039. Único delta: novo
-- INSERT em public.trial_status (após o profiles, p/ satisfazer a FK
-- trial_status.user_id -> profiles(id) dentro da mesma transação).
--
-- Forward-only, idempotente (create or replace + on conflict do nothing).
-- security definer + search_path='' mantidos (public sempre qualificado).
--
-- Divisão de trabalho: Claude autorou; founder aplica (supabase db push).

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (
    id, full_name, phone, cpf, specialties, tos_accepted_at, tos_version,
    subscription_status, trial_ends_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Terapeuta'),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'cpf',
    case
      when jsonb_typeof(new.raw_user_meta_data->'specialties') = 'array'
      then array(
        select jsonb_array_elements_text(new.raw_user_meta_data->'specialties')
      )
      else null
    end,
    (new.raw_user_meta_data->>'tos_accepted_at')::timestamptz,
    new.raw_user_meta_data->>'tos_version',
    'trial',
    now() + interval '14 days'
  )
  on conflict (id) do nothing;

  -- NOVO (0050): concede o trial de billing (Fase 8) de forma atômica.
  -- 1 leitura / 15 dias (config.ts D-06). Idempotente via on conflict.
  insert into public.trial_status (
    user_id, trial_started_at, trial_expires_at, trial_readings_used, trial_readings_max
  )
  values (
    new.id,
    now(),
    now() + interval '15 days',
    0,
    1
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Re-bind trigger (idempotente; preserva nome legado on_auth_user_created).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

commit;
