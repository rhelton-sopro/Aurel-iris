-- supabase/migrations/0004_storage_bucket_iris_captures.sql
-- Fase 3 — Captura mobile (PWA): infraestrutura de Storage e constraint para retake.
--
-- O que esta migration cobre:
--   1) Cria bucket privado "iris-captures" (não foi criado pela Fase 1 — verificado em
--      supabase/config.toml linha 115 onde [storage.buckets.images] está comentado, e em
--      0001..0003 onde nenhum INSERT INTO storage.buckets existe).
--   2) Aplica 4 policies RLS folder-based em storage.objects para INSERT/SELECT/UPDATE/DELETE
--      (per CONTEXT D-storage: path = {therapist_id}/{reading_id}/{eye}_{angle}.jpg —
--      auth.uid() = primeiro segmento da pasta).
--   3) Adiciona UNIQUE constraint (reading_id, eye, angle) em reading_images, viabilizando
--      upsert tap-to-redo (CONTEXT D-09) sem duplicar linhas.
--
-- Idempotente: pode ser re-aplicada sem erro (on conflict do nothing, drop policy if exists,
-- alter table ... if not exists no constraint via DO block).

-- ============================================================================
-- 1) Bucket privado iris-captures
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'iris-captures',
  'iris-captures',
  false,                             -- privado: jamais public=true (LGPD: dado biométrico)
  10485760,                          -- 10MB hard limit (D-16 alvo é ~500KB; 10MB é teto de segurança)
  array['image/jpeg']                -- D-16 prescreve JPEG
)
on conflict (id) do nothing;

-- ============================================================================
-- 2) Policies de RLS em storage.objects
-- Convenção CONTEXT D-storage: path = {therapist_id}/{reading_id}/{eye}_{angle}.jpg
-- → primeiro segmento da pasta = uuid do terapeuta = auth.uid()
-- ============================================================================

-- Drop policies anteriores (idempotência em re-runs)
drop policy if exists "Terapeutas inserem fotos em sua própria pasta" on storage.objects;
drop policy if exists "Terapeutas leem suas próprias fotos de íris" on storage.objects;
drop policy if exists "Terapeutas atualizam suas próprias fotos de íris" on storage.objects;
drop policy if exists "Terapeutas removem suas próprias fotos de íris" on storage.objects;

-- INSERT
create policy "Terapeutas inserem fotos em sua própria pasta"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'iris-captures'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- SELECT
create policy "Terapeutas leem suas próprias fotos de íris"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'iris-captures'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- UPDATE (necessária para upsert: true no supabase-js — RESEARCH §Storage Upload + D-09 retake)
create policy "Terapeutas atualizam suas próprias fotos de íris"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'iris-captures'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'iris-captures'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- DELETE (necessária para discardReadingAction — CONTEXT D-13)
create policy "Terapeutas removem suas próprias fotos de íris"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'iris-captures'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- 3) UNIQUE constraint em reading_images(reading_id, eye, angle)
-- Viabiliza upsert tap-to-redo (CONTEXT D-09) sem duplicar linhas.
-- DO block em vez de IF NOT EXISTS porque ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS
-- não é suportado em todas as versões do Postgres.
-- ============================================================================
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reading_images_reading_eye_angle_unique'
  ) then
    alter table reading_images
      add constraint reading_images_reading_eye_angle_unique
      unique (reading_id, eye, angle);
  end if;
end $$;
