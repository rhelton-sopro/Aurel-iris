-- 0027_readings_analysis_started.sql
--
-- Marker de "geração de relatório em andamento" — founder UAT 2026-05-20:
-- abriu uma leitura, clicou "Gerar análise", fechou a aba antes de
-- terminar; ao voltar, sections estavam parciais e o gerar novo
-- DUPLICOU o custo (regeneration_count++ + Sonnet rodou 2x).
--
-- Semântica:
--   NULL  = idle (sem geração em curso ou já terminou)
--   != NULL = stream Sonnet em curso desde este timestamp
--
-- Set no início de POST /api/readings/[id]/analyze; clear no finalize
-- (success OU error). Stale window de 5min: se started_at > 5min, é
-- considerado morto (handler crashou) — UI libera o botão de novo + um
-- segundo POST tem permissão de rodar.
--
-- Strictly additive. Nullable + sem default → readings existentes ficam
-- NULL (não impactam).

alter table public.readings
  add column if not exists analysis_started_at timestamptz;

comment on column public.readings.analysis_started_at is
  'NULL=idle. !=NULL=geração Sonnet em curso desde este timestamp. Cleared no finalize (success/error). Stale >5min=considerado morto (handler crashou) — libera retry. Founder UAT 2026-05-20.';

-- Índice parcial p/ query rápida de "in progress" (poucas linhas
-- na maior parte do tempo).
create index if not exists readings_analysis_in_progress_idx
  on public.readings (analysis_started_at)
  where analysis_started_at is not null;
