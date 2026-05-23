-- 0030_report_persistence_rpcs.sql
--
-- Phase 7 | v2.3.0 Caminho 1 | Sonnet 2x architecture
--
-- 1. Adiciona coluna `analysis_completed_at` em `readings` pra idempotência
--    explícita (em vez de depender de nullify started_at). Pareada com
--    `analysis_started_at` (0027): inflight quando started_at IS NOT NULL
--    AND completed_at IS NULL. Janela de tolerância no orquestrador =
--    5min antes de considerar "stale" e permitir retry.
--
-- 2. RPC `persist_report_findings_versioned` — transação atômica pra
--    versionamento via superseded_at em report_findings. UPDATE current
--    + INSERT novo em uma única função SECURITY DEFINER. Evita race
--    condition quando dois re-process disparam simultaneamente (raríssimo
--    mas possível — founder decisão 2026-05-23: pagar 30min agora pra
--    não ter bug silencioso depois).
--
-- 3. RPC `persist_report_phrases_versioned` — mesmo padrão pra
--    report_phrases (memória inter-leituras).
--
-- Strictly additive. Decoupled mantido (sem FK dura). Founder aplica via
-- Supabase Dashboard. Orquestrador `process/route.ts` + `analyze/route.ts`
-- chamam as RPCs via `service.rpc('persist_report_*_versioned', {...})`.

-- === 1. analysis_completed_at em readings ===

alter table public.readings
  add column if not exists analysis_completed_at timestamptz;

comment on column public.readings.analysis_completed_at is
  'v2.3.0 (2026-05-23): pareado com analysis_started_at (0027). Marca quando o pipeline 2-call terminou (sucesso OU erro final). Idempotency gate no início da rota /analyze checa "started_at IS NOT NULL AND completed_at IS NULL AND age < 5min" → 409 (retry-after). Após 5min sem completed, considera stale e libera novo processamento.';

-- === 2. RPC persist_report_findings_versioned ===

create or replace function public.persist_report_findings_versioned(
  p_reading_id        uuid,
  p_therapist_id      uuid,
  p_prompt_version    text,
  p_prompt_sha        text,
  p_method_version    text,
  p_model             text,
  p_exame_json        jsonb,
  p_raw_xml           text,
  p_validation_status text,
  p_tokens_in         integer,
  p_tokens_out        integer,
  p_cost_usd          numeric,
  p_latency_ms        integer
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_id uuid;
begin
  -- Marca registro atual (se houver) como superseded
  update public.report_findings
     set superseded_at = now()
   where reading_id = p_reading_id
     and superseded_at is null;

  -- Insere novo registro current
  insert into public.report_findings (
    reading_id, therapist_id, prompt_version, prompt_sha,
    method_version, model, exame_json, raw_xml, validation_status,
    tokens_in, tokens_out, cost_usd, latency_ms, generated_at, superseded_at
  ) values (
    p_reading_id, p_therapist_id, p_prompt_version, p_prompt_sha,
    p_method_version, p_model, p_exame_json, p_raw_xml, p_validation_status,
    p_tokens_in, p_tokens_out, p_cost_usd, p_latency_ms, now(), null
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

comment on function public.persist_report_findings_versioned is
  'v2.3.0: transação atômica pra versionamento de report_findings. UPDATE current → INSERT new em PLPGSQL function (não em 2 SQL calls do client). Garante NO race condition quando 2 re-process simultâneos disparam pro mesmo reading_id. Retorna id do novo registro. SECURITY DEFINER porque service_role chama com seus próprios privilégios mas a transação roda como definer do function (= postgres role do owner da migration).';

-- Permite que o service_role execute (RLS desliga pra SECURITY DEFINER mas
-- precisa do grant na função).
grant execute on function public.persist_report_findings_versioned(
  uuid, uuid, text, text, text, text, jsonb, text, text,
  integer, integer, numeric, integer
) to service_role;

-- === 3. RPC persist_report_phrases_versioned ===

create or replace function public.persist_report_phrases_versioned(
  p_reading_id       uuid,
  p_therapist_id     uuid,
  p_prompt_version   text,
  p_prompt_sha       text,
  p_method_version   text,
  p_phrases          jsonb,
  p_markdown_blob_url text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_id uuid;
begin
  -- Marca current (se houver) como superseded
  update public.report_phrases
     set superseded_at = now()
   where reading_id = p_reading_id
     and superseded_at is null;

  -- Insere novo current
  insert into public.report_phrases (
    reading_id, therapist_id, prompt_version, prompt_sha,
    method_version, phrases, markdown_blob_url,
    generated_at, superseded_at
  ) values (
    p_reading_id, p_therapist_id, p_prompt_version, p_prompt_sha,
    p_method_version, p_phrases, p_markdown_blob_url,
    now(), null
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

comment on function public.persist_report_phrases_versioned is
  'v2.3.0: transação atômica pra versionamento de report_phrases (memória inter-leituras). Mesmo padrão de persist_report_findings_versioned — UPDATE+INSERT em PLPGSQL. Garante coerência da memória que alimenta a próxima Etapa 2 do mesmo terapeuta. SECURITY DEFINER + grant ao service_role.';

grant execute on function public.persist_report_phrases_versioned(
  uuid, uuid, text, text, text, jsonb, text
) to service_role;
