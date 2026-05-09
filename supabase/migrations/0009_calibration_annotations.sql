-- ============================================================================
-- Migration 0009 — calibration_annotations (ground-truth corpus founder ↔ AI)
--
-- Tabela usada por /admin/calibration (founder-only) para capturar ground truth
-- iridológico por reading. Corpus alimenta:
--   - Wave B (PLAN 07.1-02) — recalibração de centróides LAB (B1b)
--   - Phase 9 RESP-01..03 — confidence visível, calibração linguística, checklist
--   - Phase 10 — seed dataset do sistema de aprendizagem clínica
--
-- Decisões de gate (founder 2026-05-09):
--   1. FOUNDER_EMAIL = 'rhelton@gmail.com' (gate primário em middleware.ts)
--   2. RLS usa email literal hardcoded como defense-in-depth (sem env injection,
--      sem SECURITY DEFINER function — middleware é gate primário; RLS protege
--      apenas se middleware for misconfigurado).
--
-- Idempotente: create table if not exists + DO blocks + drop policy if exists +
-- create or replace function. Re-runs safe.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists calibration_annotations (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid not null references readings(id) on delete cascade,
  annotated_by uuid not null references auth.users(id) on delete restrict,
  annotated_at timestamptz not null default now(),

  real_iris_color text not null,
  real_constitution text not null,
  findings_correct text default '',
  findings_invented text default '',
  findings_missed text default '',
  notes text default '',

  reviewed boolean not null default false,
  reviewed_at timestamptz
);

-- ============================================================================
-- UNIQUE constraint — uma annotation por reading (UPSERT por reading_id)
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'calibration_annotations_reading_id_key'
  ) then
    alter table calibration_annotations
      add constraint calibration_annotations_reading_id_key unique (reading_id);
  end if;
end $$;

-- ============================================================================
-- CHECK constraints — enums espelham vocabulário canônico
-- real_iris_color: alinhado com classify_iris_color (vision-service/pipeline/features.py)
-- real_constitution: alinhado com escolas iridológicas brasileiras
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'calibration_annotations_iris_color_check'
  ) then
    alter table calibration_annotations
      add constraint calibration_annotations_iris_color_check
      check (real_iris_color in ('azul','verde','castanho','mista_biliar','mista_hematogenea','outra'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'calibration_annotations_constitution_check'
  ) then
    alter table calibration_annotations
      add constraint calibration_annotations_constitution_check
      check (real_constitution in ('linfatica','biliar','hematogenea','mista_biliar','mista_hematogenea','neurogenica'));
  end if;
end $$;

create index if not exists calibration_annotations_reviewed_idx
  on calibration_annotations(reviewed);
create index if not exists calibration_annotations_annotated_at_idx
  on calibration_annotations(annotated_at desc);

-- ============================================================================
-- RLS — gate hardcoded por email do founder
--
-- Defense-in-depth: middleware.ts é o gate primário em /admin/*; esta policy
-- protege apenas se middleware for misconfigurado (env var ausente, matcher
-- furado, etc).
--
-- Email hardcoded vs SECURITY DEFINER function: hardcoded é mais simples (sem
-- ALTER DATABASE SET, sem função extra). Trade-off: trocar founder no futuro
-- requer nova migration. Aceitável — founder é singular por design Phase 7.1.
-- ============================================================================
alter table calibration_annotations enable row level security;

drop policy if exists "founder_full_access" on calibration_annotations;
create policy "founder_full_access"
  on calibration_annotations
  for all
  to authenticated
  using (
    (select email from auth.users where id = auth.uid()) = 'rhelton@gmail.com'
  )
  with check (
    (select email from auth.users where id = auth.uid()) = 'rhelton@gmail.com'
  );

comment on table calibration_annotations is
  'Ground-truth iridológico anotado pelo founder via /admin/calibration. Corpus pra Wave B + Phase 9 + Phase 10. Migration 0009 (Phase 7.1).';

comment on column calibration_annotations.real_iris_color is
  'Cor real da íris observada pelo founder (ground truth vs vision_features.iris_color.primary).';

comment on column calibration_annotations.real_constitution is
  'Constituição real observada pelo founder (ground truth vs vision_features.constitution.primary).';

comment on column calibration_annotations.findings_correct is
  'Achados que o pipeline detectou corretamente (texto livre, separados por vírgula ou linha).';

comment on column calibration_annotations.findings_invented is
  'Achados que o pipeline reportou mas NÃO existem (falsos positivos).';

comment on column calibration_annotations.findings_missed is
  'Achados que o founder vê mas o pipeline NÃO reportou (falsos negativos).';
