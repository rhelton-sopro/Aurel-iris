-- 0029_report_phrases.sql
--
-- Persistência das frases-chave extraídas do markdown da Etapa 2 do
-- pipeline v2.3.0 (Sonnet 2x). Alimenta a memória inter-leituras: antes
-- de gerar nova leitura, o orquestrador query as 10 últimas frases do
-- mesmo therapist_id (WHERE superseded_at IS NULL) e injeta no user
-- content da Etapa 2 com instrução "NÃO repita estas frases nem
-- variações próximas — mantenha MESMO TOM, MESMA VOZ, varie só SINTAXE
-- e IMAGEM CONCRETA".
--
-- Frases extraídas (por reading, jsonb):
--   - sintese_inicial: string[] (3 primeiras frases do §1 Síntese inicial)
--   - abertura_secao_10: string[] (2 primeiras frases do §10 Dimensão Arquetípica)
--   - abertura_secao_14: string[] (2 primeiras frases do §14 Mensagem ao Cliente)
--   - perfil_secao_15: string (bloco 🧭 Perfil e Temperamento inteiro)
--   - em_poucas_palavras: string (frase-essência inteira)
--
-- Extração feita por regex sobre o markdown gerado
-- (apps/web/lib/anthropic/extract-phrases.ts) imediatamente após o stream
-- da Etapa 2 fechar. NÃO usa LLM (zero custo extra além da persistência).
--
-- Strictly additive. Decoupled de readings/profiles (mesmo padrão de
-- 0017/0023/0028) — análise sobrevive a delete de terapeuta ou cliente.
--
-- Versionamento via superseded_at (founder decision 2026-05-23, mesmo
-- padrão de 0028 report_findings): re-process NÃO faz UPDATE no registro
-- antigo. Em vez disso: (1) UPDATE superseded_at = NOW() no current
-- antigo, + (2) INSERT do novo (entra com superseded_at IS NULL).
-- Partial unique index WHERE superseded_at IS NULL garante max 1
-- "current" por reading. Re-process precisa ser atômico (transação).
--
-- IMPACTO NA MEMÓRIA INTER-LEITURAS: builder de contexto recente
-- (recent-phrases-context.ts) SEMPRE inclui WHERE superseded_at IS NULL.
-- Se uma reading antiga é re-processada, as frases velhas saem da
-- memória ativa (superseded) e as novas entram. Histórico full preservado
-- pra debug.
--
-- Markdown blob path (Vercel Blob, privado):
-- "report_phrases/{reading_id}/{epoch_ms}.md" — epoch_ms permite múltiplos
-- arquivos por reading conforme superseded_at se acumula. Founder pediu
-- MD inspecionável; o jsonb já tem tudo programaticamente, o MD é luxo
-- de DX. NULL aceitável (degrada gracioso se Blob falhar).
--
-- RLS founder-only (founder decision 2026-05-23) — mesma policy de 0028.
-- Terapeuta não vê as próprias frases. Material interno de calibração.
--
-- Division of labor: Claude escreve a migration; founder aplica em
-- produção (supabase db push / dashboard). Pipeline degrada gracioso se
-- a tabela não existir (insert no try/catch; geração funciona sem
-- memória inter-leituras — apenas a primeira geração de cada terapeuta
-- antes de a tabela existir, e fallback se a tabela cair).

create table if not exists public.report_phrases (
  id                 uuid primary key default gen_random_uuid(),
  -- reading_id sem FK (decoupled). Múltiplas rows possíveis pra mesma
  -- reading_id; partial unique index garante 1 current por reading.
  reading_id         uuid not null,
  -- therapist_id no momento da geração (auth.uid()). Sem FK.
  therapist_id       uuid not null,
  -- Versão semver do prompt da Etapa 2 (do system.md carregado naquele
  -- momento — em v2.3.0 = v2.1.0 do system.md, mesmo conteúdo).
  prompt_version     text not null,
  prompt_sha         text not null,
  -- Versão do método de geração (sonnet_2x_0.1.0 em v2.3.0).
  method_version     text not null,
  -- Frases extraídas do markdown da Etapa 2 (por extract-phrases.ts).
  -- Estrutura: { sintese_inicial: string[], abertura_secao_10: string[],
  --             abertura_secao_14: string[], perfil_secao_15: string,
  --             em_poucas_palavras: string }
  phrases            jsonb not null,
  -- Vercel Blob URL (privado) do markdown completo daquela geração.
  -- Founder pediu MD inspecionável pra debug visual. Pode ser NULL se
  -- Blob falhar (pipeline não bloqueia — jsonb phrases é a fonte
  -- autoritativa pra memória inter-leituras).
  markdown_blob_url  text,
  generated_at       timestamptz not null default now(),
  -- NULL = phrases current desta leitura. Timestamp = quando foi
  -- substituído por re-process. Filtro padrão: WHERE superseded_at IS NULL.
  superseded_at      timestamptz
);

comment on table public.report_phrases is
  'v2.3.0 (2026-05-23): frases-chave extraídas do markdown da Etapa 2 do pipeline Sonnet 2x. Alimenta memória inter-leituras (10 últimas POR therapist_id) injetada no user content da próxima Etapa 2 pra evitar repetição inter-leituras. Multiple rows per reading via superseded_at; 1 current por reading. Aplicação SEMPRE filtra WHERE superseded_at IS NULL. Insert best-effort no analyze-direct.ts pós-stream da Etapa 2. RLS founder-only — material interno de calibração, terapeuta não acessa.';

comment on column public.report_phrases.phrases is
  'JSON com 5 chaves: sintese_inicial (string[] das 3 primeiras frases do §1 Síntese inicial), abertura_secao_10 (string[] das 2 primeiras frases do §10), abertura_secao_14 (string[] das 2 primeiras frases do §14), perfil_secao_15 (string do bloco 🧭 Perfil e Temperamento inteiro), em_poucas_palavras (string da frase-essência inteira). Extraído por regex em extract-phrases.ts.';

comment on column public.report_phrases.markdown_blob_url is
  'Vercel Blob URL (privado) do markdown completo. Founder pediu MD inspecionável pra debug visual. Pode ser NULL se Blob falhar (pipeline não bloqueia — jsonb phrases é a fonte autoritativa pra memória inter-leituras). Path: report_phrases/{reading_id}/{epoch_ms}.md — epoch_ms permite múltiplos MDs por reading conforme superseded_at se acumula.';

comment on column public.report_phrases.superseded_at is
  'NULL = phrases current desta leitura. Timestamp = quando foi substituído por re-process. Mesmo padrão de versionamento de 0028 report_findings — UPDATE superseded_at + INSERT new em transação atômica. Builder de contexto recente (recent-phrases-context.ts) SEMPRE filtra WHERE superseded_at IS NULL pra montar memória das 10 últimas.';

-- Partial unique index: max 1 row "current" por reading.
create unique index if not exists report_phrases_reading_current_idx
  on public.report_phrases (reading_id)
  where superseded_at is null;

-- HOT QUERY: builder de contexto recente faz
-- SELECT phrases, generated_at FROM report_phrases
-- WHERE therapist_id = $1 AND superseded_at IS NULL
-- ORDER BY generated_at DESC LIMIT 10
-- Esse índice cobre exato esse caminho (partial pra current only).
create index if not exists report_phrases_therapist_generated_current_idx
  on public.report_phrases (therapist_id, generated_at desc)
  where superseded_at is null;

-- RLS founder-only (founder decision 2026-05-23) — mesma policy de 0028.
-- Material interno de calibração da arquitetura v2.3.0; terapeuta não
-- precisa acessar. Service-role do route handler bypassa RLS pra insert.
alter table public.report_phrases enable row level security;
drop policy if exists "founder_full_access" on public.report_phrases;
create policy "founder_full_access"
  on public.report_phrases
  for all
  to authenticated
  using ((auth.jwt() ->> 'email') = 'rhelton@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'rhelton@gmail.com');
