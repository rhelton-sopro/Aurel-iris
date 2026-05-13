-- supabase/migrations/0013_iris_codex_schema.sql
-- Phase 7.4 — Iris Codex: adiciona schema report_v2 (jsonb estruturado) substituindo
-- report_generated (markdown jsonb) para readings novos. Existing readings com
-- report_generated populated recebem backfill report_version='1.0' (D-LEG1).
--
-- Drop de ai_report_raw/ai_report_edited GENERATED + jsonb_concat_sections_pt_br
-- function fica em 0014 (split atômico per concern). Tabela reading_addons em 0015.
--
-- Idempotência: ADD COLUMN IF NOT EXISTS + DO-block guards.
-- Atomicidade: begin/commit envelope.
--
-- Phase 7.4 | Plan 07.4-01 | Decisões: D-SCH1, D-SCH3, D-LEG1

begin;

-- ============================================================================
-- 1) ADD COLUMNS: report_v2 + delivered + edit_diff + timestamps + version flag
-- ============================================================================
alter table readings
  add column if not exists report_v2 jsonb,
  add column if not exists report_v2_delivered jsonb,
  add column if not exists report_v2_edit_diff jsonb default '{}'::jsonb,
  add column if not exists report_v2_generated_at timestamptz,
  add column if not exists report_v2_delivered_at timestamptz,
  add column if not exists report_version text not null default '2.0';

-- ============================================================================
-- 2) BACKFILL: existing readings with report_generated populated → legacy 1.0
-- ============================================================================
-- D-LEG1: 25 existing readings (Phase 7 dogfooding) keep their report_generated
-- jsonb and render via legacy EditorAccordion path (D-UI3). New readings post-deploy
-- default to '2.0' via column default + analyze-v2.ts writes report_v2.
update readings
  set report_version = '1.0'
  where report_generated is not null;

-- ============================================================================
-- 3) CHECK constraint: report_version IN ('1.0', '2.0')
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'readings_report_version_check'
  ) then
    alter table readings
      add constraint readings_report_version_check
      check (report_version in ('1.0', '2.0'));
  end if;
end $$;

commit;
