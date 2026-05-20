-- 0026_readings_seen.sql
--
-- Notificações de convite (founder UAT 2026-05-20): quando cliente
-- conclui leitura via /convite/[token], terapeuta precisa de aviso no
-- dashboard. Marcador "esta leitura ainda não foi aberta pelo dono":
-- coluna `seen_by_therapist_at` (timestamptz, nullable).
--
-- Semântica:
--   NULL  = terapeuta ainda não abriu /leituras/[id] desta leitura
--   != NULL = terapeuta abriu pelo menos uma vez (timestamp da 1ª abertura)
--
-- O dashboard conta convite-source readings com NULL para mostrar badge
-- "X novas leituras". A flip do NULL pra now() acontece no render do
-- /leituras/[id] (UPDATE idempotente WHERE seen_by_therapist_at IS NULL).
--
-- Strictly additive. Coluna nullable + sem default → readings antigas
-- ficam NULL (semanticamente "não-vistas") mas o cross-join com
-- client_invite_tokens filtra só as via convite, evitando barulho.

alter table public.readings
  add column if not exists seen_by_therapist_at timestamptz;

comment on column public.readings.seen_by_therapist_at is
  'Notificação de convite (0026, 2026-05-20): NULL = terapeuta ainda não abriu /leituras/[id]. Flip pra now() acontece no render server-side. Dashboard query = COUNT readings via convite com seen NULL.';

-- Índice parcial p/ query rápida do dashboard
-- "count readings WHERE therapist_id=me AND seen IS NULL".
create index if not exists readings_unseen_by_therapist_idx
  on public.readings (therapist_id)
  where seen_by_therapist_at is null;
