-- 0028_report_findings.sql
--
-- Persistência da observação estruturada da Etapa 1 do pipeline v2.3.0
-- (Sonnet 2x). Uma linha "current" por leitura: a Etapa 1 faz varredura
-- visual livre + ranqueamento por intensidade + correlações com âncora
-- visual + linha temporal com idade aproximada livre + sistemas
-- preservados + constituição base; o resultado vem em XML
-- <exame_iridologico>, parsed pra exame_json (validated pelo zod schema
-- em stage1-schema.ts) e persistido aqui.
--
-- O conteúdo desta tabela NUNCA vai pro cliente (ele só vê o markdown da
-- Etapa 2, que vive em report_generations). Esta tabela serve auditoria e
-- calibração futura: "em quantos % das leituras achados[0] é fígado?",
-- "qual a distribuição de natureza_da_carga?", "frequência de cada termo
-- canônico do glossário de 38?", etc.
--
-- Strictly additive. Decoupled de readings/profiles (mesmo padrão de 0017
-- report_generations e 0023 capture_attempts) — análise sobrevive a delete
-- de terapeuta ou cliente.
--
-- Versionamento via superseded_at (founder decision 2026-05-23):
-- re-process de uma leitura NÃO faz UPDATE no registro antigo. Em vez
-- disso: (1) UPDATE superseded_at = NOW() no registro current antigo, +
-- (2) INSERT do novo registro (entra com superseded_at IS NULL). Partial
-- unique index WHERE superseded_at IS NULL garante no máximo 1 row
-- "current" por reading. Permite comparação antes/depois e debugging
-- futuro. Custo de storage trivial.
--
-- Query padrão da aplicação SEMPRE filtra WHERE superseded_at IS NULL pra
-- pegar o exame current. Re-process precisa ser atômico (transação) pra
-- evitar race condition entre o UPDATE de superseded e o INSERT do novo.
--
-- Division of labor: Claude escreve a migration; founder aplica em
-- produção (supabase db push / dashboard). analyze-direct.ts +
-- process/route.ts degradam gracioso se a tabela não existir (insert no
-- try/catch; pipeline continua sem persistir o exame).

create table if not exists public.report_findings (
  id                 uuid primary key default gen_random_uuid(),
  -- reading_id sem FK (decoupled, mesmo padrão de report_generations).
  -- Múltiplas rows possíveis pra mesma reading_id; partial unique index
  -- abaixo garante no máximo 1 "current" (superseded_at IS NULL).
  reading_id         uuid not null,
  -- therapist_id no momento da chamada (auth.uid()). Sem FK (decoupled).
  therapist_id       uuid not null,
  -- Versão semver humana do prompt da Etapa 1 (do stage1-scan.md carregado
  -- naquele momento). Pareada com prompt_sha pra impressão digital exata.
  prompt_version     text not null,
  prompt_sha         text not null,
  -- Versão do método de geração (sonnet_2x_0.1.0 inicial). Difere de model
  -- — captura "qual orquestração foi usada".
  method_version     text not null,
  -- Modelo Anthropic efetivamente cobrado (response.model).
  model              text not null,
  -- JSON validado contra zod (stage1-schema.ts). Estrutura completa:
  -- assinatura_visual_caracteristica, achados_de_atencao[] (ordenado DESC
  -- por intensidade), sistemas_preservados[], correlacoes_observadas[]
  -- (máx 4), linha_temporal[] (idade aproximada livre, ex: "~8 anos" /
  -- "por volta dos 12-14" / "final da adolescência ~17"), constituicao_base.
  -- 5 blindagens enforced runtime: achados ordem DESC, correlações com
  -- ancora_visual presente e máx 4, linha_temporal com marca_visivel,
  -- polaridade_funcional ∈ {vital_ativo, neutro}, natureza_da_carga ∈ enum.
  exame_json         jsonb not null,
  -- Output XML bruto preservado pra debug (casos onde validation falhou
  -- e queremos ver o que Sonnet produziu de fato).
  raw_xml            text not null,
  -- 'valid' = passou no schema na 1ª chamada; 'invalid_retried' = 1ª
  -- falhou, retry corrigiu; 'invalid_final' = falhou 2x, exame_json é
  -- best-effort parcial (pipeline seguiu pra entregar relatório).
  validation_status  text not null check (validation_status in (
    'valid', 'invalid_retried', 'invalid_final'
  )),
  tokens_in          integer,
  tokens_out         integer,
  -- Custo estimado em USD pela tabela ai_model_pricing (Sonnet 4.6 rates
  -- vigentes na geração). NÃO é fatura Anthropic — estimativa razoável.
  cost_usd           numeric(10, 6),
  latency_ms         integer,
  generated_at       timestamptz not null default now(),
  -- NULL = exame current desta leitura. Timestamp = quando foi
  -- substituído por re-process. Filtro padrão de queries da aplicação:
  -- WHERE superseded_at IS NULL pra pegar current. Histórico preservado.
  superseded_at      timestamptz
);

comment on table public.report_findings is
  'v2.3.0 (2026-05-23): persiste o output da Etapa 1 do pipeline Sonnet 2x — observação estruturada XML <exame_iridologico>. Multiple rows per reading possíveis (histórico via superseded_at), 1 current por reading (partial unique index). NUNCA vai pro cliente (Etapa 2 markdown vive em report_generations). Suporta auditoria/calibração futura: distribuição de achado[0] por sistema, frequência de termos canônicos do glossário 38, distribuição de natureza_da_carga, etc. Insert best-effort no analyze-direct.ts (pipeline degrada gracioso se schema falhar 2x).';

comment on column public.report_findings.exame_json is
  'JSON validado contra zod (apps/web/lib/anthropic/stage1-schema.ts). Estrutura: { assinatura_visual_caracteristica: string, achados_de_atencao: Array<{campo, intensidade 1-5, natureza_da_carga, lateralidade, descricao_visual, observacao_qualifying}> (ordenado DESC), sistemas_preservados: Array<{campo, polaridade_funcional, sinal_visual_positivo, implicacao_funcional}>, correlacoes_observadas: Array<{campos[2], natureza, ancora_visual}> (máx 4), linha_temporal: Array<{idade_aproximada, marca_visivel, tipo_provavel, status}>, constituicao_base: {cor_predominante, trama_fibras, pupila, anel_interno, outros_sinais_globais[]} }';

comment on column public.report_findings.validation_status is
  'valid (passou no zod 1x), invalid_retried (1ª falhou, retry com instrução de correção corrigiu), invalid_final (2 falhas, exame_json é best-effort parcial — pipeline seguiu pra não bloquear entrega de relatório ao cliente).';

comment on column public.report_findings.superseded_at is
  'NULL = exame current desta leitura. Timestamp = quando foi substituído por re-process. Re-process flow: UPDATE superseded_at = NOW() no current antigo + INSERT do novo (que entra com NULL). Partial unique index report_findings_reading_current_idx garante max 1 current por reading. Aplicação SEMPRE filtra WHERE superseded_at IS NULL pra current. Histórico full pra comparação antes/depois e debug.';

-- Partial unique index: garante no máximo 1 registro "current" por
-- reading. Permite múltiplos rows pra mesma reading_id desde que apenas
-- 1 tenha superseded_at IS NULL.
create unique index if not exists report_findings_reading_current_idx
  on public.report_findings (reading_id)
  where superseded_at is null;

-- Hot query: histórico do terapeuta (current only — UI + analytics).
create index if not exists report_findings_therapist_generated_idx
  on public.report_findings (therapist_id, generated_at desc)
  where superseded_at is null;

-- Analytics queries em campos do JSONB (futuro dashboard /admin/relatorios):
-- distribuição de termos canônicos, intensidades, natureza_da_carga, etc.
-- Partial pra current only — superseded rows não pesam.
create index if not exists report_findings_exame_json_gin_idx
  on public.report_findings using gin (exame_json)
  where superseded_at is null;

-- RLS: founder-only read (espelha 0017 report_generations + 0023
-- capture_attempts). Service-role do route handler bypassa RLS pra insert.
-- Founder não é iridologista nem ensina iridologia; <exame_iridologico>
-- é ferramenta interna de calibração, não material educativo —
-- terapeutas não precisam acessar.
alter table public.report_findings enable row level security;
drop policy if exists "founder_full_access" on public.report_findings;
create policy "founder_full_access"
  on public.report_findings
  for all
  to authenticated
  using ((auth.jwt() ->> 'email') = 'rhelton@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'rhelton@gmail.com');
