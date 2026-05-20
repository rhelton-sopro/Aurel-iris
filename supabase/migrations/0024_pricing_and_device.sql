-- 0024_pricing_and_device.sql
--
-- Duas adições complementares ao /admin/relatorios:
--
--   1. ai_model_pricing — tabela de preços Anthropic com vigência por
--      data. Resolve "como manter o custo atualizado" — preço no momento
--      da chamada é persistido na linha de capture_attempts via lookup
--      pela data; quando Anthropic mexer no preço, founder insere nova
--      linha (e fecha a antiga via valid_to). Histórico fica congelado
--      correto. Anthropic NÃO tem API pública de preços; founder é a
--      fonte autorizada (Supabase dashboard).
--
--   2. capture_attempts.user_agent + device_type + os_family +
--      browser_family — habilita o bloco "Aproveitamento por dispositivo"
--      do relatório (founder quer saber se iPhone, Android ou PC tem
--      taxa de aceitação diferente). Parseado server-side da request
--      headers em /api/capture/validate (zero dep, regex local).
--
-- Strictly additive. Sem FK em ai_model_pricing (model_pattern é texto
-- livre c/ LIKE). Tabela vazia ou faltando = pricing.ts faz fallback
-- hardcoded; capture_attempts sem device cols = bloco mostra "—".

-- ── 1. ai_model_pricing ────────────────────────────────────────────────

create table if not exists public.ai_model_pricing (
  id                    uuid primary key default gen_random_uuid(),
  -- Padrão SQL LIKE (% wildcard). Match mais específico (texto mais
  -- longo) vence em getPricingFor — ver lib/anthropic/pricing.ts.
  model_pattern         text not null,
  input_usd_per_mtok    numeric(10, 4) not null,
  output_usd_per_mtok   numeric(10, 4) not null,
  -- Vigência: lookup escolhe a linha onde valid_from <= chamada <
  -- COALESCE(valid_to, infinity). NULL valid_to = ainda vigente.
  valid_from            timestamptz not null default now(),
  valid_to              timestamptz,
  notes                 text,
  created_at            timestamptz not null default now()
);

comment on table public.ai_model_pricing is
  'Preços Anthropic versionados por data. Lookup: model_version do response.model LIKE model_pattern + janela valid_from/to. Match mais específico vence. Founder edita via Supabase dashboard quando Anthropic mexer no preço.';
comment on column public.ai_model_pricing.model_pattern is
  'SQL LIKE pattern. Ex: ''claude-haiku-4-5-20251001'' (exato) ou ''claude-haiku-4-5-%'' (família). Mais longo (mais específico) vence o lookup.';
comment on column public.ai_model_pricing.valid_to is
  'NULL = vigente. Pra trocar preço: UPDATE valid_to=now() na linha velha + INSERT nova com valid_from=now().';

create index if not exists ai_model_pricing_pattern_idx
  on public.ai_model_pricing (model_pattern);
create index if not exists ai_model_pricing_valid_from_idx
  on public.ai_model_pricing (valid_from desc);

-- RLS founder-only (mirror 0017/0023).
alter table public.ai_model_pricing enable row level security;
drop policy if exists "founder_full_access" on public.ai_model_pricing;
create policy "founder_full_access"
  on public.ai_model_pricing
  for all
  to authenticated
  using ((auth.jwt() ->> 'email') = 'rhelton@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'rhelton@gmail.com');

-- Seed inicial — preços vigentes em 2026-01 (ref. anthropic.com/pricing).
-- Pattern mais específico primeiro (vence o lookup). ON CONFLICT n/a
-- (sem unique constraint — re-seed cria duplicata; idempotência via
-- WHERE NOT EXISTS).
insert into public.ai_model_pricing
  (model_pattern, input_usd_per_mtok, output_usd_per_mtok, valid_from, notes)
select * from (values
  -- Haiku 4.5 (gate de captura — /api/capture/validate)
  ('claude-haiku-4-5-20251001'::text, 0.80::numeric, 4.00::numeric,
   '2026-01-01T00:00:00Z'::timestamptz,
   'Haiku 4.5 — gate de captura (Anthropic pricing 2026-01)'::text),
  ('claude-haiku-4-5-%', 0.80, 4.00, '2026-01-01T00:00:00Z',
   'Haiku 4.5 — variantes futuras'),
  -- Sonnet 4.x (canon-bbox + report)
  ('claude-sonnet-4-6%', 3.00, 15.00, '2026-01-01T00:00:00Z',
   'Sonnet 4.6 — report + bbox'),
  ('claude-sonnet-4-5%', 3.00, 15.00, '2026-01-01T00:00:00Z',
   'Sonnet 4.5 — report + bbox'),
  -- Opus 4.7 (não usado em runtime hoje, mas presente p/ futuro)
  ('claude-opus-4-7%', 15.00, 75.00, '2026-01-01T00:00:00Z',
   'Opus 4.7')
) as v(model_pattern, input_usd_per_mtok, output_usd_per_mtok, valid_from, notes)
where not exists (
  select 1 from public.ai_model_pricing p where p.model_pattern = v.model_pattern
);

-- ── 2. capture_attempts: device + UA columns ──────────────────────────

alter table public.capture_attempts
  add column if not exists user_agent     text,
  add column if not exists device_type    text,  -- mobile/tablet/desktop/bot/unknown
  add column if not exists os_family      text,  -- iOS/Android/Windows/macOS/Linux/Other/unknown
  add column if not exists browser_family text;  -- Safari/Chrome/Firefox/Edge/Samsung/Opera/Other/unknown

comment on column public.capture_attempts.user_agent is
  'request.headers[user-agent] cru. Mantido p/ futuras heurísticas (versão de OS, modelo de aparelho).';
comment on column public.capture_attempts.os_family is
  'Família parseada server-side em /api/capture/validate (regex local). Habilita "aproveitamento por dispositivo" no /admin/relatorios.';

-- Índice p/ agregação por OS no relatório (typical query: WHERE
-- created_at em janela, GROUP BY os_family).
create index if not exists capture_attempts_os_created_idx
  on public.capture_attempts (os_family, created_at desc);
