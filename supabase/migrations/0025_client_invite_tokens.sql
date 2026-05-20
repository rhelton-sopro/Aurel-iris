-- 0025_client_invite_tokens.sql
--
-- Convites de cliente — link único single-use. Founder UAT 2026-05-20:
-- antes de fazer rodadas com terapeutas-aluno, ele quer testar a captura
-- com CLIENTES REAIS (mais variedade de íris, mais variedade de aparelho).
-- Fluxo: terapeuta gera link, envia por WhatsApp, cliente abre, faz
-- cadastro (ou pula se já existe), faz as 6 fotos, leitura vai pro
-- terapeuta. Cliente NÃO vira usuário do Supabase.
--
-- Dois modos cobertos pelo MESMO token table:
--   1. NOVO cliente:        client_id IS NULL no token → form de cadastro
--                           inline preenche dados + consent + cria
--                           clients row; token marca used_at + used_by_client_id.
--   2. CLIENTE existente:   client_id já preenchido → skip form, vai
--                           direto pra captura. Re-consent 'reconfirm_device'
--                           + 'remote_link' por leitura.
--
-- Single-use: used_at != NULL bloqueia novo acesso. expires_at é gate
-- separado (mesmo não usado, expira).
--
-- RLS: terapeuta-dono vê os próprios; founder vê todos (defense-in-depth
-- pro /admin/relatorios — não está no escopo desta migration mas a policy
-- já preserva isso). Service-role bypassa pra validar token no /convite/*
-- público sem sessão.

create table if not exists public.client_invite_tokens (
  id                   uuid primary key default gen_random_uuid(),
  -- 32-char URL-safe random (lib/invite/tokens.ts). Único — colisão
  -- viraria leak de leitura entre terapeutas.
  token                text not null unique,
  therapist_id         uuid not null references public.profiles(id) on delete cascade,
  -- NULL = convite p/ cliente novo (form de cadastro inline).
  -- Preenchido = convite p/ cliente existente (skip form).
  client_id            uuid references public.clients(id) on delete cascade,
  created_at           timestamptz not null default now(),
  -- Default 7 dias — terapeuta pode override no createInviteTokenAction.
  expires_at           timestamptz not null default (now() + interval '7 days'),
  -- Single-use: NULL = pristine. Preenchido = não pode mais ser usado.
  used_at              timestamptz,
  -- Quando used_at é preenchido E client_id era NULL no momento da geração,
  -- aqui vai o id do client recém-criado. Pra existing clients é o mesmo
  -- de client_id. Atalho pro reverse-lookup "que cliente esse token virou?".
  used_by_client_id    uuid references public.clients(id) on delete set null,
  -- Reading id criado dentro do fluxo de convite. Atalho pra rastreio
  -- "esse convite gerou que leitura?". NULL até a primeira foto subir.
  used_by_reading_id   uuid references public.readings(id) on delete set null
);

comment on table public.client_invite_tokens is
  'Convites single-use que terapeuta gera p/ cliente fazer cadastro+captura remoto (next.js public route /convite/[token]). client_id NULL = novo cliente; preenchido = re-captura de cliente existente. used_at != NULL bloqueia.';
comment on column public.client_invite_tokens.token is
  '32 chars URL-safe random (crypto.randomBytes em lib/invite/tokens.ts). UNIQUE — colisão = leak de leitura.';
comment on column public.client_invite_tokens.expires_at is
  'Default +7 dias (interval na column DEFAULT). Terapeuta pode override no momento da geração. Validação em SQL no path público.';
comment on column public.client_invite_tokens.used_at is
  'NULL = pristine. Preenchido = single-use queimado. Reabrir token depois disso = 404 no /convite/[token].';

create index if not exists client_invite_tokens_token_idx
  on public.client_invite_tokens (token);
create index if not exists client_invite_tokens_therapist_idx
  on public.client_invite_tokens (therapist_id, created_at desc);

-- RLS — terapeuta vê os próprios; founder vê todos (defense-in-depth).
alter table public.client_invite_tokens enable row level security;

drop policy if exists "therapist_owns_tokens" on public.client_invite_tokens;
create policy "therapist_owns_tokens"
  on public.client_invite_tokens
  for all
  to authenticated
  using (
    therapist_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'rhelton@gmail.com'
  )
  with check (
    therapist_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'rhelton@gmail.com'
  );

-- ATENÇÃO: o path público /convite/[token] NÃO tem sessão Supabase. As
-- escritas de validação/uso do token são feitas via SERVICE-ROLE em
-- /api/convite/[token]/* (bypass de RLS). Por isso NÃO há policy de
-- INSERT/UPDATE para o role 'anon' — service-role é a única escrita
-- desautenticada. Mesmo padrão do report_generations / capture_attempts.
