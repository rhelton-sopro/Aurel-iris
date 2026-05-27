-- 0034_invite_notify_on_capture.sql
--
-- v2.9.0 (2026-05-27): preferência por convite — terapeuta escolhe se quer
-- receber email "captura completa" pra ESTE link. Founder verbatim:
-- "coloque a opção de confirmação de captura por email como toggle...
-- marcado na hora de gerar link... se o terapeuta não quiser... ele
-- desmarca".
--
-- Modelo: flag por TOKEN (não por terapeuta global). Permite controle
-- granular — terapeuta gera 1 link "sem aviso" pra captura em consultório
-- presente, outro link "com aviso" pra cliente remoto. Default TRUE
-- mantém comportamento prévio.
--
-- Lido pelo notify-therapist-capture-complete.ts: se flag=false no token
-- que originou a leitura (used_by_reading_id), retorna cedo sem enviar.
--
-- NÃO mexe em notify-report-ready (já desativado globalmente em a5f6371).
-- Esta migration é APENAS pra capture-complete.
--
-- Strictly additive. Backfill via DEFAULT TRUE em tokens pre-existentes
-- (comportamento antigo preservado). Idempotent (ADD COLUMN IF NOT EXISTS).

alter table public.client_invite_tokens
  add column if not exists notify_on_capture_complete boolean not null default true;

comment on column public.client_invite_tokens.notify_on_capture_complete is
  'v2.9.0 (2026-05-27): se true (default), notify-therapist-capture-complete dispara email quando o cliente completa as 6 fotos via este token. Se false, terapeuta optou por não receber aviso (ex: captura em consultório presente, sem necessidade de notificação). Escolha do terapeuta no momento de gerar o link (InviteLinkDialog checkbox).';
