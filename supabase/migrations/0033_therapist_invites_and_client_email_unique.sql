-- 0033_therapist_invites_and_client_email_unique.sql
--
-- Fase 11.1 | Invite terapeuta via signup form
--
-- CONTEXTO:
--   Fase 11.1 resolve o bug de PKCE no fluxo de convite de terapeutas (Supabase
--   generateLink redirectTo=/dashboard causava redirect pra /login) e implementa
--   UX de signup form pré-preenchido via rota dedicada /convite-terapeuta/[token].
--
-- Esta migration é pré-requisito (Wave 1) para:
--   - 11.1-02: inviteTherapistAction rewrite (INSERT nesta tabela, D-DUPE check)
--   - 11.1-03: rota /convite-terapeuta/[token] (lookup + form + markUsed)
--
-- Mudanças (strictly additive):
--
--   1. CREATE TABLE therapist_invites — tokens de convite para terapeutas.
--      D-DUPE: token uuid PK + email citext; inviteTherapistAction checa auth.users
--      antes de gerar token (bloqueia se email já cadastrado).
--      D-TTL: expires_at = created_at + interval '7 days' (default); GET
--      em /convite-terapeuta/[token] checa expires_at > now() — 404 se expirado.
--      RLS habilitada: bloqueio total pra authenticated/anon; service role bypass
--      natural. Nenhuma policy criada — defense-in-depth contra leak de token.
--
--   2. UNIQUE(therapist_id, email) em clients (D-CLIENT):
--      Resolve memory tech debt project_clients_unique_email_tech_debt.
--      Per terapeuta, não global — terapeuta B pode ter mesmo email do terapeuta A.
--      createClientAction trata violation com mensagem amigável.
--      Backfill: founder confirmou zero dups em prod (não há ON CONFLICT).
--
-- Strictly additive. Zero DROP, zero backfill em therapist_invites.
-- A constraint em clients pressupõe zero dups existentes (confirmed).

-- ── 1. Tabela therapist_invites ───────────────────────────────────────────────
create table if not exists public.therapist_invites (
  token            uuid        primary key default gen_random_uuid(),
  email            citext      not null,
  invited_by       uuid        not null references public.profiles(id) on delete cascade,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default (now() + interval '7 days'),
  used_at          timestamptz null,
  used_by_user_id  uuid        null references auth.users(id) on delete set null
);

-- ── 2. Indexes ────────────────────────────────────────────────────────────────

-- Lookup por email: inviteTherapistAction verifica tokens pendentes / histórico
create index if not exists therapist_invites_email_idx
  on public.therapist_invites (email);

-- Validação rápida no GET /convite-terapeuta/[token]: token ativo (used_at IS NULL)
create index if not exists therapist_invites_token_active_idx
  on public.therapist_invites (token, expires_at, used_at)
  where used_at is null;

-- Lookup por founder: futura UI de "meus convites enviados" em /admin/terapeutas
create index if not exists therapist_invites_invited_by_idx
  on public.therapist_invites (invited_by);

-- ── 3. RLS — bloqueio total client-side ──────────────────────────────────────
alter table public.therapist_invites enable row level security;

-- Sem policies pra authenticated/anon — bloqueio total.
-- Service role bypass naturalmente (Supabase default).
-- Defense-in-depth: garante que mesmo se anon key vazar, ninguém liste tokens.
-- Leituras/escritas via server actions com SUPABASE_SERVICE_ROLE_KEY.

-- ── 4. COMMENTs documentando decisões ────────────────────────────────────────
comment on table public.therapist_invites is
  'Fase 11.1 (2026-05-26): tokens de convite para terapeutas via /convite-terapeuta/[token]. Founder gera via /admin/terapeutas (inviteTherapistAction); terapeuta abre URL + preenche form + verifica OTP (D-OTP). Token marca used_at quando submit OK. Expira em 7d (D-TTL). RLS bloqueia tudo exceto service role — nenhuma policy para authenticated/anon.';

comment on column public.therapist_invites.token is
  'uuid PK gerado pelo DB (gen_random_uuid). Forma da URL: /convite-terapeuta/{token}. uuid v4: brute-force inviável em janela de 7 dias (T-11.1-01-01).';

comment on column public.therapist_invites.email is
  'citext (case-insensitive) — email do terapeuta convidado. D-DUPE: inviteTherapistAction pré-checa auth.users antes de INSERT; bloqueia se email já cadastrado. Não há DB constraint cross-schema (auth é schema separado).';

comment on column public.therapist_invites.invited_by is
  'profiles.id do founder que gerou o convite. ON DELETE CASCADE — se founder deletado, convites somem junto. isFounderEmail check garante que só founder chame inviteTherapistAction.';

comment on column public.therapist_invites.expires_at is
  'D-TTL: default = created_at + interval 7 dias. GET em /convite-terapeuta/[token] checa expires_at > now() — retorna 404 com mensagem clara se expirado. 7d escolhido pra compatibilidade com hand-held WhatsApp (terapeuta pode abrir link 2 dias depois).';

comment on column public.therapist_invites.used_at is
  'Timestamp do markTherapistInviteUsedAction (pós-verifyOtp OK). NULL = token ainda usável. Non-NULL = idempotência (token 1x uso). UPDATE usa WHERE used_at IS NULL pra garantir atomicidade.';

comment on column public.therapist_invites.used_by_user_id is
  'auth.users.id do user que ativou o convite. ON DELETE SET NULL — se user deletado, histórico do token preservado (used_at non-null, used_by NULL indica deleção pós-uso).';

-- ── 5. UNIQUE constraint em clients (D-CLIENT) ───────────────────────────────
alter table public.clients
  add constraint clients_therapist_email_unique unique (therapist_id, email);

comment on constraint clients_therapist_email_unique on public.clients is
  'Fase 11.1 D-CLIENT (2026-05-26): per terapeuta, email único. NÃO global — terapeutas diferentes podem ter mesmo cliente. Resolve tech debt project_clients_unique_email_tech_debt. createClientAction trata violation (23505) com mensagem amigável: "Cliente com este e-mail já cadastrado em sua lista."';
