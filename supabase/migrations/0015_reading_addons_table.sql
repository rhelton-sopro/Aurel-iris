-- supabase/migrations/0015_reading_addons_table.sql
-- Phase 7.4 — Iris Codex: cria tabela reading_addons (vazia em V1; populated por V1.1+).
--
-- Extensible para 6 addon_type values (D-ADD3):
--   - iridological_deep (V1.1 — Análise Iridológica Aprofundada, 1ª implementação)
--   - client_facing (V1.1+ — Relatório para Cliente Final)
--   - therapeutic_plan (V1.1+ — Plano Terapêutico)
--   - longitudinal_comparison (V1.1+ — Comparação Longitudinal)
--   - nutritional_map (V1.1+ — Mapa Nutricional)
--   - exam_recommendations (V1.1+ — Recomendações de Exames)
--
-- RLS: therapist sees only own. Patterns therapist_id = auth.uid() (NOT auth.users
-- query — MEMORY.md note: auth.users SELECT denied to authenticated role; here we
-- compare uuid FK to auth.uid() return value, which is allowed).
--
-- Phase 7.4 | Plan 07.4-01 | Decisões: D-SCH1, D-ADD1, D-ADD3

begin;

-- ============================================================================
-- 1) CREATE TABLE reading_addons (empty in V1)
-- ============================================================================
create table if not exists reading_addons (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid not null references readings(id) on delete cascade,
  addon_type text not null check (addon_type in (
    'iridological_deep',
    'client_facing',
    'therapeutic_plan',
    'longitudinal_comparison',
    'nutritional_map',
    'exam_recommendations'
  )),
  generated_content jsonb,
  generated_at timestamptz,
  credit_cost int not null default 1,
  model_version text,
  therapist_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 2) INDEXES (FK lookups + therapist-scoped queries)
-- ============================================================================
create index if not exists idx_reading_addons_reading_id on reading_addons(reading_id);
create index if not exists idx_reading_addons_therapist_id on reading_addons(therapist_id);

-- ============================================================================
-- 3) RLS — therapist owns own rows (same pattern as readings table from 0001)
-- ============================================================================
alter table reading_addons enable row level security;

drop policy if exists reading_addons_therapist_select on reading_addons;
create policy reading_addons_therapist_select on reading_addons
  for select using (therapist_id = auth.uid());

drop policy if exists reading_addons_therapist_insert on reading_addons;
create policy reading_addons_therapist_insert on reading_addons
  for insert with check (therapist_id = auth.uid());

-- Note: no UPDATE/DELETE policies in V1 — add-on rows are append-only;
-- V1.1 will revisit if regeneration of an add-on is supported.

commit;
