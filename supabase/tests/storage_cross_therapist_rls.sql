-- supabase/tests/storage_cross_therapist_rls.sql
-- Fase 3 — Prova empiricamente que RLS de storage.objects bloqueia leitura cross-terapeuta
-- no DB REMOTO sa-east-1 (idempotente, em transação com ROLLBACK).
-- Roda com: supabase db query --linked -f supabase/tests/storage_cross_therapist_rls.sql
--           ou: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/storage_cross_therapist_rls.sql
--
-- Estratégia (paralela a cross_therapist_rls.sql):
--   1) FIXTURE: 2 auth.users dummy + 1 storage.objects de cada (path com folder = uuid do owner).
--   2) CONTROL (BYPASSRLS, role postgres): assert que select count(*) from storage.objects = 2.
--   3) Impersonar terapeuta A (set_config request.jwt.claims + role authenticated).
--   4) OWN-DATA: assert que A lê próprio arquivo = 1 row.
--   5) CROSS-THERAPIST: assert que A lê arquivo de B = 0 rows. Espelho B->A.
--   6) Tudo dentro de BEGIN; ... ROLLBACK; — banco volta ao estado anterior.
--
-- NOTA: storage.objects não suporta DELETE direto via SQL (trigger protect_delete do Supabase
-- bloqueia para evitar objetos órfãos). O ROLLBACK ao final garante limpeza automática — não
-- é necessário DELETE explícito. auth.users usa on conflict do nothing para idempotência.

begin;

-- IDs determinísticos (mesmos do cross_therapist_rls.sql para coerência mental)
-- Therapist A: 11111111-1111-1111-1111-111111111111
-- Therapist B: 22222222-2222-2222-2222-222222222222

-- 1) FIXTURE: 2 auth.users (idempotente via on conflict)
insert into auth.users (id, email, instance_id, aud, role, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', 'storage-a@aurel-iris-test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'storage-b@aurel-iris-test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), now())
on conflict (id) do nothing;

-- 2) FIXTURE: 1 storage.objects para cada terapeuta
-- Path convention CONTEXT D-storage: {therapist_id}/{reading_id}/{eye}_{angle}.jpg
-- Paths usam UUIDs únicos de teste (sem conflito com dados reais de produção)
insert into storage.objects (bucket_id, name, owner, metadata)
values
  ('iris-captures',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/right_frontal.jpg',
   '11111111-1111-1111-1111-111111111111',
   '{"size": 512000, "mimetype": "image/jpeg"}'::jsonb),
  ('iris-captures',
   '22222222-2222-2222-2222-222222222222/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/right_frontal.jpg',
   '22222222-2222-2222-2222-222222222222',
   '{"size": 512000, "mimetype": "image/jpeg"}'::jsonb)
on conflict (bucket_id, name) do nothing;

-- 3) CONTROL: como postgres (bypassrls), deve ver os 2 objetos
do $$
declare
  cnt integer;
begin
  select count(*) into cnt from storage.objects
    where bucket_id = 'iris-captures'
      and ((storage.foldername(name))[1] = '11111111-1111-1111-1111-111111111111'
        or (storage.foldername(name))[1] = '22222222-2222-2222-2222-222222222222');
  if cnt < 2 then
    raise exception 'CONTROL FAIL: postgres deveria ver >= 2 objetos, viu %', cnt;
  end if;
  raise notice 'CONTROL OK: postgres vê % objeto(s) (bypassrls)', cnt;
end $$;

-- 4) Impersonar Terapeuta A
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

-- 5) OWN-DATA + CROSS-THERAPIST checks impersonando A
do $$
declare
  cnt_own integer;
  cnt_cross integer;
begin
  select count(*) into cnt_own from storage.objects
    where bucket_id = 'iris-captures'
      and (storage.foldername(name))[1] = '11111111-1111-1111-1111-111111111111';
  if cnt_own < 1 then
    raise exception 'OWN-DATA FAIL (A): A deveria ler >= 1 objeto seu, leu %', cnt_own;
  end if;

  select count(*) into cnt_cross from storage.objects
    where bucket_id = 'iris-captures'
      and (storage.foldername(name))[1] = '22222222-2222-2222-2222-222222222222';
  if cnt_cross <> 0 then
    raise exception 'CROSS-THERAPIST FAIL (A->B): A não deveria ler objetos de B, leu %', cnt_cross;
  end if;

  raise notice 'PASS A: own=1 cross=0';
end $$;

-- 6) Espelho: impersonar B
reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '22222222-2222-2222-2222-222222222222',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  cnt_own integer;
  cnt_cross integer;
begin
  select count(*) into cnt_own from storage.objects
    where bucket_id = 'iris-captures'
      and (storage.foldername(name))[1] = '22222222-2222-2222-2222-222222222222';
  if cnt_own < 1 then
    raise exception 'OWN-DATA FAIL (B): B deveria ler >= 1 objeto seu, leu %', cnt_own;
  end if;

  select count(*) into cnt_cross from storage.objects
    where bucket_id = 'iris-captures'
      and (storage.foldername(name))[1] = '11111111-1111-1111-1111-111111111111';
  if cnt_cross <> 0 then
    raise exception 'CROSS-THERAPIST FAIL (B->A): B não deveria ler objetos de A, leu %', cnt_cross;
  end if;

  raise notice 'PASS B: own=1 cross=0';
end $$;

-- 7) Cleanup via ROLLBACK
reset role;
rollback;
-- ROLLBACK garante que todos os INSERTs desta transação são desfeitos.
-- (storage.protect_delete() bloqueia DELETE direto em storage.objects —
-- ROLLBACK é o mecanismo correto para limpeza de storage.objects inseridos via SQL direto.)
