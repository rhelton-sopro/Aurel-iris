-- 0023_capture_attempts.sql
--
-- Instrumentação do gate de captura (Haiku VLM em /api/capture/validate).
-- Hoje a rota só faz console.log; isso impede medir a TAXA DE APROVEITAMENTO
-- dos terapeutas (fotos aceitas / fotos tentadas), que é a métrica #1 do
-- relatório gerencial do beta (/admin/relatorios). Esta migração cria a
-- tabela onde a rota passa a logar uma linha por chamada (best-effort —
-- nunca bloqueia a resposta ao usuário).
--
-- Strictly additive. Sem FK pra profiles/readings (decoupled, mesmo padrão
-- de report_generations 0017 — sobrevive a delete de terapeuta/cliente).
--
-- Division of labor: Claude escreve a migration; founder aplica em
-- produção (supabase db push / dashboard). A rota e o /admin/relatorios
-- degradam gracioso até a tabela existir (insert engolido no try/catch;
-- página mostra "sem dados ainda").

create table if not exists public.capture_attempts (
  id                 uuid primary key default gen_random_uuid(),
  -- therapist_id = auth.uid() no momento da chamada. Sem FK (idem
  -- report_generations) — análise sobrevive a delete de terapeuta.
  therapist_id       uuid not null,
  -- Veredicto do Haiku 4.5 (clamped pelos VALID_QUALITY_VALUES da rota).
  vlm_quality        text not null check (vlm_quality in ('ruim', 'regular', 'boa', 'excelente')),
  -- Reason clamped pelos VALID_REASON_VALUES da rota.
  vlm_reason         text not null check (vlm_reason in (
    'olho_detectado', 'sem_olho', 'dois_olhos', 'muito_longe',
    'borrado', 'reflexo_total', 'olho_fechado'
  )),
  -- Derivado: aceita = quality != 'ruim'. Persistido pra evitar CASE
  -- repetido em todo dashboard query.
  accepted           boolean not null,
  -- Tamanho do payload base64 que chegou (proxy do resize 512×512 estar
  -- funcionando — esperado 40-110KB).
  image_bytes        integer not null,
  -- Latência da chamada Anthropic (ms). NÃO inclui o tempo do client
  -- preparar/postar o JPEG.
  latency_ms         integer not null,
  tokens_in          integer,
  tokens_out         integer,
  -- Custo estimado em USD computado no servidor a partir de
  -- (tokens_in * Haiku in-rate + tokens_out * Haiku out-rate). Persistido
  -- pra dashboards sem ter que carregar a tabela de preços por query.
  cost_estimate_usd  numeric(10, 6),
  -- Modelo efetivamente cobrado (response.model). Diferente de MODEL
  -- constante se Anthropic fizer fallback/upgrade transparente.
  model_version      text not null,
  created_at         timestamptz not null default now()
);

comment on table public.capture_attempts is
  'Phase beta (2026-05-20): uma linha por chamada a /api/capture/validate. Suporta /admin/relatorios — taxa de aproveitamento (accepted/total), top reasons de recusa, custo Haiku do gate, throughput por terapeuta. Inserção best-effort (rota nunca bloqueia se a insert falhar).';
comment on column public.capture_attempts.accepted is
  'Derivado: vlm_quality != ''ruim''. Persistido p/ evitar CASE em toda query do dashboard.';
comment on column public.capture_attempts.cost_estimate_usd is
  'Estimado no servidor (tokens_in × Haiku-in + tokens_out × Haiku-out). NÃO é a fatura Anthropic — é uma estimativa razoável p/ dashboards.';

-- Índice principal: queries do /admin/relatorios filtram por janela de
-- tempo e agrupam por terapeuta. (therapist_id, created_at desc) cobre
-- ambos casos sem precisar índice extra em created_at.
create index if not exists capture_attempts_therapist_created_idx
  on public.capture_attempts (therapist_id, created_at desc);

-- Índice secundário p/ queries cross-terapeuta filtradas só por tempo
-- (rollups globais do /admin/relatorios sem breakdown).
create index if not exists capture_attempts_created_idx
  on public.capture_attempts (created_at desc);

-- RLS: founder-only read (espelha 0017 report_generations / 0011
-- calibration_*). Email vem do JWT — nunca tocar auth.users
-- ([[feedback-supabase-rls-no-auth-users]]). Service-role inserts da
-- rota /api/capture/validate bypassam RLS. Defense-in-depth: middleware
-- + admin/layout + isFounderEmail já gateiam /admin; este é o 4º layer.
alter table public.capture_attempts enable row level security;
drop policy if exists "founder_full_access" on public.capture_attempts;
create policy "founder_full_access"
  on public.capture_attempts
  for all
  to authenticated
  using ((auth.jwt() ->> 'email') = 'rhelton@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'rhelton@gmail.com');
