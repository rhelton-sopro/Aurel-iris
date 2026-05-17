-- 0020_consent_infra.sql
--
-- Infraestrutura de consentimento LGPD — FASE 1 (Etapa 2: schema).
-- Padrão CURRENT-POINTER + EVENT-LOG:
--
--   • consent_terms   = registro IMUTÁVEL de versões do termo. Linha nunca é
--                       UPDATE-ada; nova redação = nova linha + flip is_current.
--                       Integridade do texto exibido garantida por content_sha256.
--
--   • client_consents = EVENT-LOG append-only (a trilha de auditoria jurídica).
--                       Uma linha por aceite/reconfirmação. NUNCA UPDATE/DELETE
--                       pelo terapeuta (imutável). client_id é FK ON DELETE SET
--                       NULL: na exclusão do titular o vínculo se quebra mas a
--                       PROVA (term_version + consented_at + event_type)
--                       sobrevive anonimizada (LGPD art. 16) — mesma filosofia
--                       do report_generations.client_id (0017, sem FK).
--
--   • O current-pointer (clients.consent_current_version / consent_last_at,
--     migration 0019) é o cache denormalizado deste log para gating rápido.
--
-- Estritamente aditivo (CREATE TABLE — não toca tabela existente). Forward-only,
-- idempotente (create table/index if not exists; drop policy if exists + create).
-- Grants herdados de 0002. Escritas do path do examinado vêm via service-role
-- (rota token-validada na Fase 2) que bypassa RLS — por isso não há policy de
-- INSERT para 'authenticated'.
--
-- Divisão de trabalho: Claude autorou; founder aplica (supabase db push).

begin;

-- ============================================================================
-- 1) consent_terms — registro imutável de versões do termo
-- ============================================================================
create table if not exists public.consent_terms (
  id             uuid primary key default gen_random_uuid(),
  version        text not null unique,
  body           text not null,
  content_sha256 text not null,
  effective_from timestamptz not null default now(),
  is_current     boolean not null default false,
  created_at     timestamptz not null default now()
);

-- Garante NO MÁXIMO uma versão vigente: índice único parcial sobre as linhas
-- is_current=true (duas vigentes colidiriam no valor `true`). O flip de versão
-- (Fase 2 seed) deve, numa transação: is_current=false na antiga ANTES de
-- inserir/marcar a nova como true.
create unique index if not exists consent_terms_one_current
  on public.consent_terms (is_current)
  where is_current;

comment on table public.consent_terms is
  'CURRENT-POINTER+EVENT-LOG (parte 1/2): registro IMUTÁVEL de versões do termo de consentimento LGPD. Linha nunca é editada; nova redação = nova linha. content_sha256 prova o texto exato exibido. Índice parcial garante 1 vigente. Semeada pelo founder via script de seed (service-role) na Fase 2, NÃO nesta migration.';
comment on column public.consent_terms.version is
  'Identificador monotônico (ex.: v1, v2). UNIQUE.';
comment on column public.consent_terms.content_sha256 is
  'sha256 do body exibido — integridade/auditoria. Casado com apps/web/lib/consent/term-v1.md no repo.';
comment on column public.consent_terms.is_current is
  'Exatamente uma linha true (índice parcial consent_terms_one_current). Flip de versão é transacional no seed.';

-- ============================================================================
-- 2) client_consents — event-log append-only (trilha de auditoria)
-- ============================================================================
create table if not exists public.client_consents (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid references public.clients(id) on delete set null,
  reading_id      uuid,
  term_version    text not null,
  event_type      text not null check (event_type in (
                     'initial',
                     'reconfirm_version',
                     'reconfirm_expiry',
                     'reconfirm_device'
                   )),
  consent_channel text not null check (consent_channel in (
                     'b2c_self',
                     'therapist_created',
                     'office_handoff',
                     'office_qr',
                     'remote_link'
                   )),
  ip              inet,
  user_agent      text,
  consented_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists client_consents_client_idx
  on public.client_consents (client_id);

comment on table public.client_consents is
  'CURRENT-POINTER+EVENT-LOG (parte 2/2): EVENT-LOG append-only de consentimentos. Uma linha por aceite/reconfirmação — imutável (sem policy UPDATE/DELETE p/ terapeuta). client_id FK ON DELETE SET NULL: exclusão do titular quebra o vínculo mas preserva a prova jurídica anonimizada (LGPD art. 16). Linhas anonimizadas (client_id NULL) somem para o terapeuta (EXISTS-join falha) e ficam visíveis só ao founder (auditoria).';
comment on column public.client_consents.client_id is
  'FK clients(id) ON DELETE SET NULL. NULL = consentimento de titular já excluído (anonimizado). deleteClientAction também zera ip/user_agent antes do delete (scrub de PII; Etapa 3).';
comment on column public.client_consents.reading_id is
  'Leitura que disparou o aceite (auditoria). SEM FK — desacoplado do ciclo de vida do reading (espelha report_generations.reading_id, 0017).';
comment on column public.client_consents.event_type is
  'initial = 1º aceite | reconfirm_version = termo mudou | reconfirm_expiry = > 12 meses | reconfirm_device = heurística dispositivo/IP (slot reservado, Fase futura).';
comment on column public.client_consents.consent_channel is
  'Porta de entrada do aceite. b2c_self reservado p/ fase B2C futura (inativo no MVP). MVP ativo: therapist_created, office_handoff, office_qr, remote_link.';

-- ============================================================================
-- 3) RLS
-- ============================================================================

-- consent_terms: texto legal exibível — leitura por qualquer autenticado
-- (terapeutas). O path do examinado lê via service-role (bypassa RLS).
alter table public.consent_terms enable row level security;

drop policy if exists "consent_terms_read" on public.consent_terms;
create policy "consent_terms_read"
  on public.consent_terms
  for select
  to authenticated
  using (true);

drop policy if exists "founder_full_access" on public.consent_terms;
create policy "founder_full_access"
  on public.consent_terms
  for all
  to authenticated
  using ((auth.jwt() ->> 'email') = 'rhelton@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'rhelton@gmail.com');

-- client_consents: terapeuta vê só consents dos PRÓPRIOS clientes (EXISTS join
-- em clients.therapist_id = auth.uid() — padrão de 0001/0015; NÃO toca
-- auth.users). SEM policy UPDATE/DELETE p/ authenticated → append-only/imutável.
-- INSERT vem da rota token-validada via service-role (bypassa RLS).
alter table public.client_consents enable row level security;

drop policy if exists "client_consents_therapist_select" on public.client_consents;
create policy "client_consents_therapist_select"
  on public.client_consents
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.clients c
      where c.id = client_consents.client_id
        and c.therapist_id = auth.uid()
    )
  );

-- founder_full_access = 4ª camada de defesa (mirror 0011/0017). Inclui o
-- escape de auditoria do founder; a imutabilidade operacional é garantida
-- pela AUSÊNCIA de UPDATE/DELETE para o terapeuta acima.
drop policy if exists "founder_full_access" on public.client_consents;
create policy "founder_full_access"
  on public.client_consents
  for all
  to authenticated
  using ((auth.jwt() ->> 'email') = 'rhelton@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'rhelton@gmail.com');

commit;
