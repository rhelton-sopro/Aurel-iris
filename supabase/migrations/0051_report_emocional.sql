-- Relatório emocional ("Mapa do Ser") — o 2º tipo de relatório, gerado a partir do
-- MESMO Stage 1 (report_findings.exame_json) da leitura que já existe.
--
-- Guardamos o MARKDOWN, não o HTML: o desenho muda com frequência (só hoje mudaram o
-- índice, a régua, o bloco 7 e o mapa emocional), e com o markdown guardado a
-- re-renderização é de graça — os relatórios já gerados acompanham a mudança sem
-- pagar API de novo. Guardar HTML congelaria cada relatório no desenho do dia.
--
-- Segue o padrão que a tabela já usa para report_v2 / report_generated_sonnet_direct.
-- Sem RLS nova: herda as policies de `readings` (o dono é o therapist_id da leitura).

alter table public.readings
  add column if not exists report_emocional text,
  add column if not exists report_emocional_generated_at timestamptz,
  add column if not exists report_emocional_metadata jsonb;

comment on column public.readings.report_emocional is
  'Markdown estruturado (@BLOCOS) do relatório emocional. O HTML é derivado no render, nunca guardado.';
comment on column public.readings.report_emocional_generated_at is
  'Quando o Stage 2 emocional rodou. NULL = nunca gerado.';
comment on column public.readings.report_emocional_metadata is
  'modelo, tokens in/out, custo, latência e versão do prompt — mesmo espírito de sonnet_direct_run_metadata.';

-- Consulta típica: "esta leitura já tem relatório emocional?" no carregamento da página.
create index if not exists readings_report_emocional_idx
  on public.readings (id)
  where report_emocional is not null;
