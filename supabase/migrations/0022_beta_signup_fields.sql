-- 0022_beta_signup_fields.sql
--
-- Cluster 2a — campos novos do cadastro de TERAPEUTA + autoexame + aceite
-- de Termos/Privacidade do terapeuta.
--
-- PARTE ADITIVA (segura, NULL/false = ainda não preenchido):
--   profiles.specialties      text[]      — 1..3 especialidades (lista fixa no app;
--                                            "Outro" já substituído pelo texto livre)
--   profiles.tos_accepted_at  timestamptz — aceite dos Termos/Privacidade do terapeuta
--   profiles.tos_version      text        — versão do ToS aceita (ver lib/consent/tos.ts)
--   clients.is_self           boolean NOT NULL default false — leitura do próprio
--                                            terapeuta (autoexame, Cluster 2c)
--
-- handle_new_user() estendido: além de full_name, persiste phone + specialties +
-- tos_accepted_at + tos_version vindos de raw_user_meta_data (signInWithOtp
-- options.data no signup). profiles.phone JÁ existe (0001) — não recriado.
--
-- Forward-only, idempotente (add column if not exists / create or replace).
-- Grants herdados de 0002. security definer + search_path='' mantidos
-- (pg_catalog é sempre buscado; public é qualificado).
--
-- Divisão de trabalho: Claude autorou; founder aplica (supabase db push).

begin;

-- ── 1. Colunas novas ────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists specialties     text[],
  add column if not exists tos_accepted_at timestamptz,
  add column if not exists tos_version     text;

alter table public.clients
  add column if not exists is_self boolean not null default false;

comment on column public.profiles.specialties is
  '1..3 especialidades do terapeuta (lista fixa no app/Zod). "Outro" é substituído pelo texto livre digitado antes de salvar — sem o literal "Outro" no array.';
comment on column public.profiles.tos_accepted_at is
  'Timestamp do aceite dos Termos de Uso + Política de Privacidade do TERAPEUTA (distinto do consentimento do examinado — ver client_consents/0020). NULL = conta antiga que ainda não aceitou (GATE /perfil/completar).';
comment on column public.profiles.tos_version is
  'Versão do ToS aceita. Casada com TOS_VERSION em apps/web/lib/consent/tos.ts.';
comment on column public.clients.is_self is
  'true = autoexame (o próprio terapeuta como examinado, Cluster 2c). Conta normalmente no cap de leituras.';

-- ── 2. handle_new_user() estendido ──────────────────────────────────────────
-- Mantém: security definer, search_path='', on conflict do nothing (idempotente
-- contra double-fire do trigger). full_name continua com coalesce (NOT NULL).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (
    id, full_name, phone, specialties, tos_accepted_at, tos_version,
    subscription_status, trial_ends_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Terapeuta'),
    new.raw_user_meta_data->>'phone',
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

  return new;
end;
$$;

-- Trigger já existe (0003); create or replace na função basta. Recriado por
-- segurança/idempotência (mesma assinatura).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

commit;
