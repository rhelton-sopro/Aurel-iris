-- supabase/migrations/0007_phase_7_analise_llm.sql
-- Phase 7 — Análise LLM: substitui ai_report_raw/ai_report_edited (text) por
-- jsonb canônico report_generated/report_delivered, mantendo retrocompat
-- sintática via GENERATED ALWAYS AS … STORED columns reconstruídas a partir
-- do jsonb por uma função IMMUTABLE PARALLEL SAFE.
--
-- Adiciona TODOS os 11 campos forward-compat da Fase 10 (SAC) — 07-CONTEXT.md
-- D-P2: report_generated_at, report_delivered_at, edit_diff, zonas_editadas,
-- tipo_edicao, clinical_feedback, exam_notes, feedback_collected_at,
-- audit_metadata, regeneration_count, regeneration_log.
--
-- Idempotência: DROP COLUMN IF EXISTS + ADD COLUMN IF NOT EXISTS + CREATE OR
-- REPLACE FUNCTION. CONTEXT D-P1 confirma: zero linhas existentes têm
-- ai_report_raw/edited populadas (Fase 7 nunca executou).
--
-- Pitfall 1 (RESEARCH): ORDER BY com cast numérico para evitar ordenação
-- lexicográfica '1, 10, 11, 12, 13, 2, 3, …'.
--
-- Migration 0006 learning: funções usadas em GENERATED ALWAYS AS (...) STORED
-- DEVEM ser IMMUTABLE PARALLEL SAFE e o body precisa ser pure SELECT (sem
-- SET runtime params, sem operações procedurais).
--
-- 07-PLAN-01 desta fase. Decisões: D-P1, D-P2, D-P3, D-P4.

begin;

-- ============================================================================
-- 1) Função IMMUTABLE jsonb_concat_sections_pt_br
-- Concatena valores do jsonb separados por dupla quebra de linha, ordenados
-- numericamente pelo prefixo '1_', '2_', …, '13_'. NULLS LAST garante que
-- 'encerramento_disclaimer' (sem prefixo numérico) ordene por último.
-- ============================================================================
create or replace function jsonb_concat_sections_pt_br(input jsonb)
  returns text
  language sql
  immutable
  parallel safe
as $$
  select string_agg(value, E'\n\n' order by
    coalesce((regexp_match(key, '^(\d+)_'))[1]::int, 99),
    key
  )
  from jsonb_each_text(input);
$$;

grant execute on function jsonb_concat_sections_pt_br(jsonb) to authenticated;

-- ============================================================================
-- 2) DROP+ADD das colunas ai_report_raw / ai_report_edited
-- One-shot atômico (zero rows affected — D-P1 confirmed). Em transação para
-- evitar estado intermediário com tabela inconsistente.
-- ============================================================================
alter table readings
  drop column if exists ai_report_raw,
  drop column if exists ai_report_edited;

-- ============================================================================
-- 3) Adicionar colunas canônicas jsonb + GENERATED text columns
-- ============================================================================
alter table readings
  add column if not exists report_generated jsonb,
  add column if not exists report_delivered jsonb,
  add column if not exists ai_report_raw text generated always as (
    jsonb_concat_sections_pt_br(report_generated)
  ) stored,
  add column if not exists ai_report_edited text generated always as (
    jsonb_concat_sections_pt_br(report_delivered)
  ) stored;

-- ============================================================================
-- 4) Adicionar 11 campos forward-compat (D-P2 — SAC Fase 10)
-- ============================================================================
alter table readings
  add column if not exists report_generated_at timestamptz,
  add column if not exists report_delivered_at timestamptz,
  add column if not exists edit_diff jsonb,
  add column if not exists zonas_editadas jsonb,
  add column if not exists tipo_edicao text[],
  add column if not exists clinical_feedback jsonb,
  add column if not exists exam_notes text,
  add column if not exists feedback_collected_at timestamptz,
  add column if not exists audit_metadata jsonb default '{}'::jsonb,
  add column if not exists regeneration_count int default 0,
  add column if not exists regeneration_log jsonb default '[]'::jsonb;

-- ============================================================================
-- 5) CHECK em regeneration_count (D-S4 — cap em 3)
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'readings_regeneration_count_cap_check'
  ) then
    alter table readings
      add constraint readings_regeneration_count_cap_check
      check (regeneration_count >= 0 and regeneration_count <= 3);
  end if;
end $$;

commit;
