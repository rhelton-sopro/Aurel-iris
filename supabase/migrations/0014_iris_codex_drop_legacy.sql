-- supabase/migrations/0014_iris_codex_drop_legacy.sql
-- Phase 7.4 — Iris Codex: drop GENERATED columns ai_report_raw + ai_report_edited
-- + drop function jsonb_concat_sections_pt_br().
--
-- LLM-04 contract (Phase 7 D-P1) REVOGADO: report_v2 jsonb é consumido diretamente
-- por ReportAdaptiveView + PDF (Phase 8). Texto concatenado markdown era artefato
-- de retrocompat; sem callers ativos no web app (grep confirmou zero refs em código
-- de produção; testes referenciam via fixture, OK).
--
-- Drop order: columns FIRST (depend on function), then function. Postgres bloqueia
-- DROP FUNCTION enquanto columns generated_as referenciam — daí a ordem.
--
-- One-shot atômico em transação para evitar estado intermediário.
--
-- Phase 7.4 | Plan 07.4-01 | Decisões: D-SCH2

begin;

-- ============================================================================
-- 1) DROP GENERATED columns (depend on jsonb_concat_sections_pt_br function)
-- ============================================================================
alter table readings
  drop column if exists ai_report_raw,
  drop column if exists ai_report_edited;

-- ============================================================================
-- 2) DROP function (now unreferenced — safe to drop)
-- ============================================================================
drop function if exists jsonb_concat_sections_pt_br(jsonb);

commit;
