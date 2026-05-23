-- 0031_report_generations_v2_3_alignment.sql
--
-- Phase 7 | v2.3.0 alinhamento da tabela legacy report_generations com
-- o pipeline Sonnet 2x.
--
-- CONTEXTO (Carol UAT, 2026-05-23):
--   A primeira leitura v2.3.0 em prod (reading 8d63988a-...) gerou
--   report_findings + report_phrases + readings.report_generated OK, MAS o
--   INSERT em report_generations falhou silenciosamente:
--     "new row for relation \"report_generations\" violates check constraint
--      \"report_generations_method_check\""
--   Causa: o CHECK em method (0017) só aceita ('vigente','sam','sonnet_direct').
--   Sem rastro o pipeline parecia ter rodado; analytics ficou cego pra v2.3.0.
--
-- 3 mudanças (todas additive / safe):
--
--   1. ALTER CHECK constraint em report_generations.method pra incluir
--      'sonnet_2x' (qualitativo, estável). Versão semver vira coluna nova.
--
--   2. ADD COLUMN method_version em report_generations. Convenção v2.3.0+:
--      method='sonnet_2x' + method_version='0.1.0'. Rows pré-v2.3.0
--      (vigente/sam/sonnet_direct) ficam com method_version NULL — sem
--      backfill (não havia semver explícito antes).
--
--   3. ADD COLUMN cache_creation_input_tokens + cache_read_input_tokens em
--      report_generations E report_findings. Anthropic Messages API retorna
--      4 buckets de tokens (input/output/cache_write/cache_read); até hoje
--      só persistíamos 2 → DB subestimava custo real. Logs do Vercel tinham
--      tudo mas analytics SQL ficava incompleto.
--
-- NÃO altera report_phrases (não tem campos de custo — só persiste frases).
--
-- Strictly additive. Sem backfill, sem DROP, sem reordenação de coluna.
-- Code (analyze/route.ts + log-generation.ts) é atualizado no mesmo commit
-- pra alimentar as colunas novas a partir desta migration aplicada.
--
-- Division of labor: Claude escreve; founder aplica via Supabase Dashboard
-- antes do próximo push de código (senão code novo escreve em coluna que
-- ainda não existe — degrade gracioso por enquanto, mas evita ruído).

-- ── 1. ALTER CHECK: aceitar 'sonnet_2x' ────────────────────────────────────
-- Postgres não tem "ALTER CONSTRAINT" pra modificar a expressão; precisa
-- DROP + ADD. Mantém o mesmo nome de constraint pra continuidade dos logs.
alter table public.report_generations
  drop constraint if exists report_generations_method_check;

alter table public.report_generations
  add constraint report_generations_method_check
  check (method in ('vigente', 'sam', 'sonnet_direct', 'sonnet_2x'));

-- ── 2. ADD COLUMN method_version ──────────────────────────────────────────
alter table public.report_generations
  add column if not exists method_version text;

comment on column public.report_generations.method_version is
  'v2.3.0 (2026-05-23): semver de iteração do method. Convenção: method=qualitativo estável (sonnet_2x), method_version=semver (0.1.0, 0.2.0...). NULL em rows pré-v2.3.0 (não havia semver explícito). Permite analytics group_by(method) sem perder rastro de qual iteração foi.';

-- ── 3. ADD COLUMN cache tokens (2 tabelas) ────────────────────────────────
alter table public.report_generations
  add column if not exists cache_creation_input_tokens integer,
  add column if not exists cache_read_input_tokens     integer;

comment on column public.report_generations.cache_creation_input_tokens is
  'v2.3.0 (2026-05-23): tokens escritos no prompt cache da Anthropic nesta chamada. Pesa ~1.25x input normal. Faz parte do custo real — somar a (tokens_in + tokens_out) pra reconciliação com fatura. NULL em rows pré-v2.3.0 (não persistido antes).';

comment on column public.report_generations.cache_read_input_tokens is
  'v2.3.0 (2026-05-23): tokens lidos do prompt cache da Anthropic nesta chamada (cache hit). Paga ~0.1x input normal. Métrica de eficiência do caching. NULL em rows pré-v2.3.0.';

alter table public.report_findings
  add column if not exists cache_creation_input_tokens integer,
  add column if not exists cache_read_input_tokens     integer;

comment on column public.report_findings.cache_creation_input_tokens is
  'v2.3.1 (2026-05-23): mesmo significado de report_generations.cache_creation_input_tokens. Persiste pra Stage 1 também — sem isso o custo real da Stage 1 (especialmente com as 6 fotos no cache write inicial) ficava só no console.info do Vercel.';

comment on column public.report_findings.cache_read_input_tokens is
  'v2.3.1 (2026-05-23): mesmo significado de report_generations.cache_read_input_tokens. Stage 1 da 1ª leitura de cada terapeuta tipicamente tem cache_read=0; reads aparecem em leituras subsequentes do mesmo dia (TTL 5min Anthropic).';

-- ── 4. CREATE OR REPLACE persist_report_findings_versioned ─────────────────
-- A RPC original (migration 0030) não tinha parâmetros pra cache tokens —
-- sem este replace, mesmo com as colunas novas o INSERT recebe NULL e o
-- caller TS não tem como passar os valores. Mantém assinatura aditiva
-- (params novos são INTEGER nullable; chamadas existentes que não
-- repassarem ficam com NULL).
--
-- Drop explícito pra evitar conflito de assinatura (postgres não permite
-- "ALTER FUNCTION" da lista de params; precisa drop+create). Mesmo nome,
-- mesma SECURITY DEFINER, mesma policy.
drop function if exists public.persist_report_findings_versioned(
  uuid, uuid, text, text, text, text, jsonb, text, text,
  integer, integer, numeric, integer
);

create or replace function public.persist_report_findings_versioned(
  p_reading_id                    uuid,
  p_therapist_id                  uuid,
  p_prompt_version                text,
  p_prompt_sha                    text,
  p_method_version                text,
  p_model                         text,
  p_exame_json                    jsonb,
  p_raw_xml                       text,
  p_validation_status             text,
  p_tokens_in                     integer,
  p_tokens_out                    integer,
  p_cost_usd                      numeric,
  p_latency_ms                    integer,
  p_cache_creation_input_tokens   integer default null,
  p_cache_read_input_tokens       integer default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_id uuid;
begin
  update public.report_findings
     set superseded_at = now()
   where reading_id = p_reading_id
     and superseded_at is null;

  insert into public.report_findings (
    reading_id, therapist_id, prompt_version, prompt_sha,
    method_version, model, exame_json, raw_xml, validation_status,
    tokens_in, tokens_out, cache_creation_input_tokens, cache_read_input_tokens,
    cost_usd, latency_ms, generated_at, superseded_at
  ) values (
    p_reading_id, p_therapist_id, p_prompt_version, p_prompt_sha,
    p_method_version, p_model, p_exame_json, p_raw_xml, p_validation_status,
    p_tokens_in, p_tokens_out, p_cache_creation_input_tokens, p_cache_read_input_tokens,
    p_cost_usd, p_latency_ms, now(), null
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

comment on function public.persist_report_findings_versioned is
  'v2.3.1 (2026-05-23): replace de 0030 com 2 params novos pra cache tokens (defaults NULL pra retrocompat). UPDATE current + INSERT new em PLPGSQL pra evitar race condition de re-process simultâneo. SECURITY DEFINER + grant ao service_role.';

grant execute on function public.persist_report_findings_versioned(
  uuid, uuid, text, text, text, text, jsonb, text, text,
  integer, integer, numeric, integer, integer, integer
) to service_role;
