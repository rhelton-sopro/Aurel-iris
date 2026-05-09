-- ============================================================================
-- Migration 0010 — calibration_diagnoses (free-text operational document)
--
-- Tabela complementar a calibration_annotations (0009). Separação de conceitos:
--   - calibration_annotations: campos estruturados (real_iris_color, real_constitution,
--     findings_*) → corpus pra ML futuro (Wave B + Phase 10).
--   - calibration_diagnoses (esta): texto livre com 3 seções operacionais
--     (ANOTAÇÃO HUMANA + DIAGNÓSTICO COMPARATIVO + AÇÃO DE CALIBRAÇÃO PROPOSTA)
--     resultante de análise externa (founder + AI assistant em conversa fora do app).
--     Vira histórico de o que foi observado e o que precisa ser feito no código.
--
-- Por que tabela separada (não coluna em calibration_annotations):
--   - Diagnose pode existir sem form preenchido (founder analisa primeiro,
--     classifica formalmente depois)
--   - Form pode existir sem diagnose (corpus puro pra ML, sem análise comparativa)
--   - UPSERT simples por tabela, sem merge logic entre actions
--
-- RLS: hardcoded founder email (mesmo padrão de 0009 — middleware é gate primário,
-- RLS é defense-in-depth).
--
-- Idempotente: create table if not exists + DO blocks + drop policy if exists.
-- Re-runs safe.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists calibration_diagnoses (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid not null references readings(id) on delete cascade,
  diagnosed_by uuid not null references auth.users(id) on delete restrict,
  diagnosis text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- UNIQUE constraint — uma diagnose por reading (UPSERT por reading_id)
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'calibration_diagnoses_reading_id_key'
  ) then
    alter table calibration_diagnoses
      add constraint calibration_diagnoses_reading_id_key unique (reading_id);
  end if;
end $$;

create index if not exists calibration_diagnoses_updated_at_idx
  on calibration_diagnoses(updated_at desc);

-- ============================================================================
-- RLS — gate hardcoded por email do founder (mesmo padrão de 0009)
-- ============================================================================
alter table calibration_diagnoses enable row level security;

drop policy if exists "founder_full_access" on calibration_diagnoses;
create policy "founder_full_access"
  on calibration_diagnoses
  for all
  to authenticated
  using (
    (select email from auth.users where id = auth.uid()) = 'rhelton@gmail.com'
  )
  with check (
    (select email from auth.users where id = auth.uid()) = 'rhelton@gmail.com'
  );

comment on table calibration_diagnoses is
  'Diagnóstico operacional de calibração em texto livre. Output da análise founder ↔ AI externa. Distinto de calibration_annotations (campos estruturados/corpus ML). Migration 0010 (Phase 7.1).';

comment on column calibration_diagnoses.diagnosis is
  'Texto livre. Tipicamente contém 3 seções: ANOTAÇÃO HUMANA + DIAGNÓSTICO COMPARATIVO + AÇÃO DE CALIBRAÇÃO PROPOSTA. Format livre — humano + AI escrevem como faz sentido pra cada caso.';
