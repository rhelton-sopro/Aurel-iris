-- 0002_grant_authenticated_role.sql
--
-- NOTA: Esta migration NÃO está no SPEC §3 verbatim. É necessária pra que as
-- policies RLS do SPEC §3 sejam funcionais: em Postgres, RLS só filtra LINHAS
-- depois que o role tem permissão de TABELA. Sem GRANT, o `authenticated` role
-- recebe `permission denied for table` em vez de RLS-filtrar.
--
-- Padrão Supabase: anon, authenticated, service_role têm USAGE no schema public
-- e privilégios completos nas tabelas (RLS então filtra rows por policy).
--
-- Detectado durante plan 01-05 (RLS test cross-terapeuta) — primeira chamada
-- impersonando o terapeuta A retornou "permission denied for table clients"
-- mesmo com RLS habilitada.

grant usage on schema public to anon, authenticated, service_role;

-- Privilégios completos nas tabelas existentes do schema public.
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- Default privileges para tabelas/sequences/funções FUTURAS criadas por postgres no schema public.
-- Próximas migrations não precisam repetir os grants — herdam destes defaults.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
