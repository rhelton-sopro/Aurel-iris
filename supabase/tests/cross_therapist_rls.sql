-- supabase/tests/cross_therapist_rls.sql
-- D-13: prova empiricamente que RLS bloqueia leitura cross-terapeuta no DB REMOTO (sa-east-1).
-- Roda com: supabase db query --db-url "$SUPABASE_DB_URL" -f supabase/tests/cross_therapist_rls.sql
--           ou: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/cross_therapist_rls.sql
--
-- Estratégia (3 níveis de assertion):
--   1) FIXTURE: Inserir 2 usuários auth dummy + profiles + 1 client/reading/image cada (via service-role/postgres bypass).
--   2) CONTROL (BYPASSRLS, role postgres): assert que select count(*) from clients = 2.
--      Sem isso, um falso PASS é possível se inserts falharem silenciosamente em RLS-on tables.
--   3) Para cada terapeuta, impersonar via set_config('request.jwt.claims', json_build_object('sub', uuid, 'role', 'authenticated')::text, true) + role=authenticated.
--   4) OWN-DATA: assert que terapeuta A lê seu próprio cliente = 1 row.
--      Sem isso, "RLS bloqueia tudo" passa (false PASS); este check distingue "RLS funciona" de "RLS está aterrorizada".
--   5) CROSS-THERAPIST: assert que terapeuta A lê cliente de B = 0 rows. Espelho para B->A.
--   6) Cobertura: clients, readings, reading_images, profiles.
--   7) Toda inserção/teste num BEGIN; ... ROLLBACK; — DB volta ao estado anterior (idempotente, seguro pra remoto).

begin;

-- IDs determinísticos (UUIDs fixos para reprodutibilidade)
-- Therapist A: 11111111-1111-1111-1111-111111111111
-- Therapist B: 22222222-2222-2222-2222-222222222222

-- Limpa estado de runs anteriores (idempotente). Roda como postgres (BYPASSRLS aqui).
delete from reading_images where reading_id in (
  select id from readings where therapist_id in (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
  )
);
delete from readings where therapist_id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);
delete from clients where therapist_id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);
delete from profiles where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);
delete from auth.users where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

-- 1) FIXTURE: 2 auth.users dummy (mínimo para FK profiles.id -> auth.users.id).
-- Em remoto, postgres role tem privilégio para inserir em auth.users (operação service-side).
insert into auth.users (id, email, instance_id, aud, role, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', 'therapist-a@aurel-iris-test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'therapist-b@aurel-iris-test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), now());

-- 2) Profiles
insert into profiles (id, full_name) values
  ('11111111-1111-1111-1111-111111111111', 'Terapeuta A'),
  ('22222222-2222-2222-2222-222222222222', 'Terapeuta B');

-- 3) Cada terapeuta tem 1 cliente
insert into clients (id, therapist_id, full_name) values
  ('aaaaaaaa-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Cliente do Terapeuta A'),
  ('bbbbbbbb-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Cliente do Terapeuta B');

-- 4) Cada terapeuta tem 1 reading
insert into readings (id, client_id, therapist_id, status) values
  ('cccccccc-1111-1111-1111-111111111111', 'aaaaaaaa-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'pending'),
  ('dddddddd-2222-2222-2222-222222222222', 'bbbbbbbb-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'pending');

-- 5) Cada reading tem 1 imagem
insert into reading_images (reading_id, eye, angle, storage_path) values
  ('cccccccc-1111-1111-1111-111111111111', 'right', 'frontal', 'therapist-a/reading-c/right-frontal.jpg'),
  ('dddddddd-2222-2222-2222-222222222222', 'right', 'frontal', 'therapist-b/reading-d/right-frontal.jpg');

-- ===========================================================
-- CONTROL: roda como postgres (BYPASSRLS) e prova que fixture
-- realmente inseriu 2 clients. Se RLS já estivesse engajada para postgres,
-- isso falharia e sinalizaria que o ambiente de teste está quebrado
-- (ex.: postgres role em remoto sem BYPASSRLS por algum motivo).
-- ===========================================================

do $$
declare
  cnt_clients_total integer;
  cnt_readings_total integer;
begin
  select count(*) into cnt_clients_total from clients
    where therapist_id in (
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222'
    );
  if cnt_clients_total <> 2 then
    raise exception 'CONTROL FAIL: fixture nao inseriu 2 clients (postgres BYPASSRLS view). Esperado 2, viu %. Ambiente de teste quebrado.', cnt_clients_total;
  end if;

  select count(*) into cnt_readings_total from readings
    where therapist_id in (
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222'
    );
  if cnt_readings_total <> 2 then
    raise exception 'CONTROL FAIL: fixture nao inseriu 2 readings (postgres BYPASSRLS view). Esperado 2, viu %.', cnt_readings_total;
  end if;

  raise notice 'CONTROL PASS: fixture inseriu 2 clients e 2 readings (verificado com BYPASSRLS).';
end $$;

-- ===========================================================
-- IMPERSONA TERAPEUTA A E TENTA LER DADOS DE B
-- (set_config canônico Supabase: request.jwt.claims = JSON com sub + role)
-- ===========================================================

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  cnt_clients_a_self integer;
  cnt_clients_b integer;
  cnt_readings_a_self integer;
  cnt_readings_b integer;
  cnt_images_b integer;
  cnt_profiles_b integer;
begin
  -- OWN-DATA: terapeuta A deve ler o próprio cliente (sanity positivo).
  select count(*) into cnt_clients_a_self from clients
    where therapist_id = '11111111-1111-1111-1111-111111111111';
  if cnt_clients_a_self <> 1 then
    raise exception 'OWN-DATA FAIL: Terapeuta A nao consegue ler proprio cliente. Esperado 1, viu %. RLS bloqueando demais.', cnt_clients_a_self;
  end if;

  select count(*) into cnt_readings_a_self from readings
    where therapist_id = '11111111-1111-1111-1111-111111111111';
  if cnt_readings_a_self <> 1 then
    raise exception 'OWN-DATA FAIL: Terapeuta A nao consegue ler proprio reading. Esperado 1, viu %.', cnt_readings_a_self;
  end if;

  -- CROSS-THERAPIST: terapeuta A NAO deve ler nada de B.
  select count(*) into cnt_clients_b from clients
    where therapist_id = '22222222-2222-2222-2222-222222222222';
  if cnt_clients_b <> 0 then
    raise exception 'RLS FAIL: Terapeuta A leu % cliente(s) de B em clients', cnt_clients_b;
  end if;

  select count(*) into cnt_readings_b from readings
    where therapist_id = '22222222-2222-2222-2222-222222222222';
  if cnt_readings_b <> 0 then
    raise exception 'RLS FAIL: Terapeuta A leu % reading(s) de B em readings', cnt_readings_b;
  end if;

  select count(*) into cnt_images_b from reading_images
    where reading_id = 'dddddddd-2222-2222-2222-222222222222';
  if cnt_images_b <> 0 then
    raise exception 'RLS FAIL: Terapeuta A leu % imagem(ns) do reading de B em reading_images', cnt_images_b;
  end if;

  select count(*) into cnt_profiles_b from profiles
    where id = '22222222-2222-2222-2222-222222222222';
  if cnt_profiles_b <> 0 then
    raise exception 'RLS FAIL: Terapeuta A leu o profile de B (count = %)', cnt_profiles_b;
  end if;

  raise notice 'PASS: Terapeuta A le proprio cliente/reading (1+1) e e bloqueado em todas as 4 tabelas vs B (0+0+0+0).';
end $$;

-- ===========================================================
-- IMPERSONA TERAPEUTA B E TENTA LER DADOS DE A (espelho)
-- ===========================================================

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '22222222-2222-2222-2222-222222222222',
    'role', 'authenticated'
  )::text,
  true
);

do $$
declare
  cnt_clients_b_self integer;
  cnt_clients_a integer;
  cnt_readings_b_self integer;
  cnt_readings_a integer;
  cnt_images_a integer;
  cnt_profiles_a integer;
begin
  -- OWN-DATA: terapeuta B deve ler o próprio cliente.
  select count(*) into cnt_clients_b_self from clients
    where therapist_id = '22222222-2222-2222-2222-222222222222';
  if cnt_clients_b_self <> 1 then
    raise exception 'OWN-DATA FAIL: Terapeuta B nao consegue ler proprio cliente. Esperado 1, viu %.', cnt_clients_b_self;
  end if;

  select count(*) into cnt_readings_b_self from readings
    where therapist_id = '22222222-2222-2222-2222-222222222222';
  if cnt_readings_b_self <> 1 then
    raise exception 'OWN-DATA FAIL: Terapeuta B nao consegue ler proprio reading. Esperado 1, viu %.', cnt_readings_b_self;
  end if;

  -- CROSS-THERAPIST: terapeuta B NAO deve ler nada de A.
  select count(*) into cnt_clients_a from clients
    where therapist_id = '11111111-1111-1111-1111-111111111111';
  if cnt_clients_a <> 0 then
    raise exception 'RLS FAIL: Terapeuta B leu % cliente(s) de A em clients', cnt_clients_a;
  end if;

  select count(*) into cnt_readings_a from readings
    where therapist_id = '11111111-1111-1111-1111-111111111111';
  if cnt_readings_a <> 0 then
    raise exception 'RLS FAIL: Terapeuta B leu % reading(s) de A em readings', cnt_readings_a;
  end if;

  select count(*) into cnt_images_a from reading_images
    where reading_id = 'cccccccc-1111-1111-1111-111111111111';
  if cnt_images_a <> 0 then
    raise exception 'RLS FAIL: Terapeuta B leu % imagem(ns) do reading de A em reading_images', cnt_images_a;
  end if;

  select count(*) into cnt_profiles_a from profiles
    where id = '11111111-1111-1111-1111-111111111111';
  if cnt_profiles_a <> 0 then
    raise exception 'RLS FAIL: Terapeuta B leu o profile de A (count = %)', cnt_profiles_a;
  end if;

  raise notice 'PASS: Terapeuta B le proprio cliente/reading (1+1) e e bloqueado em todas as 4 tabelas vs A (0+0+0+0).';
end $$;

-- Cleanup
reset role;
rollback;
-- ROLLBACK garante que o teste é destrutivo apenas dentro de sua própria transação:
-- o DB remoto volta ao estado anterior. Idempotente: pode rodar 100x sem efeito acumulado.
