-- 0019_client_profile_min.sql
--
-- Cadastro mínimo do examinado + ponteiro de estado de consentimento.
-- Perna "Cadastro + Consentimento LGPD" — FASE 1 (Etapa 2: schema).
--
-- PARTE ADITIVA (segura, NULL = ainda não preenchido):
--   clients.biological_sex        — sexo biológico de nascimento (param da leitura)
--   clients.email                 — contato (obrigatório no app/Zod; DB nullable — E-3)
--   clients.phone                 — contato/WhatsApp (idem)
--   clients.consent_current_version — última versão de termo aceita (current-pointer,
--                                     denormalizado de client_consents — ver 0020)
--   clients.consent_last_at       — timestamp do último aceite (dispara regra dos 12m)
--
-- PARTE DESTRUTIVA (founder aprovou — colunas MORTAS, zero dados verificado):
--   DROP clients.gender                 (substituída por biological_sex c/ função clínica)
--   DROP clients.consent_signed_at      (letra morta — nunca escrita/lida por código)
--   DROP clients.consent_document_url   (idem)
--
-- clients.notes PERMANECE como está (anotação operacional do terapeuta; barreira
-- §5 garante que não vaza pro prompt — ver lib/anthropic/analyze-direct.ts).
--
-- Forward-only, idempotente (add column if not exists / DO-block constraint /
-- drop column if exists → re-run seguro). Grants herdados de 0002
-- (alter default privileges). birth_date continua nullable no DB; idade ≥ 18 e
-- obrigatoriedade de email/phone são enforced no app (Zod) — decisão E-3.
--
-- Divisão de trabalho: Claude autorou esta migration; o founder aplica em
-- produção (supabase db push) — mesmo padrão de 0016/0017.

begin;

-- ── 1. Colunas novas (aditivas, nullable) ──────────────────────────────────
alter table public.clients
  add column if not exists biological_sex          text,
  add column if not exists email                   text,
  add column if not exists phone                   text,
  add column if not exists consent_current_version text,
  add column if not exists consent_last_at         timestamptz;

-- ── 2. CHECK em biological_sex (DO-block: ADD CONSTRAINT não tem IF NOT EXISTS;
--       mesmo padrão idempotente da 0004). NULL permitido (DB nullable — E-3;
--       app/Zod é quem exige o valor). ────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_biological_sex_chk'
  ) then
    alter table public.clients
      add constraint clients_biological_sex_chk
      check (biological_sex is null or biological_sex in ('feminino', 'masculino'));
  end if;
end $$;

comment on column public.clients.biological_sex is
  'Sexo biológico de nascimento (feminino|masculino). Parâmetro interpretativo da leitura iridológica. NULL nas 3 linhas legadas até edição (E-3); app/Zod exige no cadastro novo.';
comment on column public.clients.email is
  'Contato do examinado. Obrigatório no app (Zod); DB nullable para não quebrar as 3 linhas existentes (E-3). Sem verificação de e-mail no MVP.';
comment on column public.clients.phone is
  'Contato/WhatsApp do examinado (canal único, WhatsApp implícito). Obrigatório no app (Zod); DB nullable (E-3).';
comment on column public.clients.consent_current_version is
  'Current-pointer: versão de consent_terms do último aceite válido deste cliente. Denormalizado de client_consents (event-log) para gating rápido sem join. Mantido pela rota de consentimento.';
comment on column public.clients.consent_last_at is
  'Current-pointer: timestamp do último aceite. evaluateConsent() usa para a regra de reconfirmação por expiração (> 12 meses). Denormalizado de client_consents.';

-- ── 3. Drop das colunas mortas (founder-aprovado; zero dados — verificado via
--       probe PostgREST). if exists → re-run seguro. Sem policy/índice/FK
--       dependente (única índice é clients(therapist_id); única policy é por
--       therapist_id). ───────────────────────────────────────────────────────
alter table public.clients
  drop column if exists gender,
  drop column if exists consent_signed_at,
  drop column if exists consent_document_url;

commit;
