-- 0039_signup_cpf_trigger_extension.sql
-- Fase 8 — Plano 08-06 — D-08/D-12: propaga CPF do signup pro profiles via trigger.
--
-- Pré-requisitos (JÁ aplicados pela migration 0035 do plano 08-01 — esta
-- migration NÃO os redeclara):
--   - profiles.cpf TEXT
--   - profiles.asaas_customer_id TEXT
--   - profiles_cpf_unique_idx (UNIQUE WHERE cpf IS NOT NULL)
--   - profiles_asaas_customer_id_unique_idx (UNIQUE WHERE asaas_customer_id IS NOT NULL)
--
-- Esta migration apenas substitui a função `public.handle_new_user()` para ler
-- `raw_user_meta_data->>'cpf'` (assinado no signup via signInWithOtp options.data)
-- e gravar em `profiles.cpf` no INSERT inicial. Sem essa extensão, mesmo com a
-- coluna existente, o CPF do cadastro nunca chegaria ao profile.
--
-- Boundary explícita de migrations Fase 8:
--   - 0035 (plano 08-01) owns toda a DDL de colunas/índices de billing+LGPD.
--   - 0039 (este, plano 08-06) owns SOMENTE a extensão da função trigger.
--
-- Preserva byte-a-byte o resto do corpo de 0022 (full_name coalesce, phone,
-- specialties array-cast, tos_*, subscription_status='trial',
-- trial_ends_at = now() + 14 days, on conflict (id) do nothing). Único delta:
-- coluna `cpf` no INSERT.
--
-- Forward-only, idempotente (create or replace + drop trigger if exists).
-- security definer + search_path='' mantidos (pg_catalog sempre buscado; public
-- é qualificado).
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
    new.raw_user_meta_data->>'cpf',   -- NOVO Fase 8 (08-06): propaga CPF assinado no signup
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

-- Re-bind trigger (idempotente; preserva nome legado on_auth_user_created de 0022/0003).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

commit;
