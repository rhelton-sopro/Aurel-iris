-- 0032_phase_9_onboarding_and_notification.sql
--
-- Fase 9 | Polish + dogfooding + beta
--
-- CONTEXTO:
--   Fase 9 adiciona dois features essenciais pra launch B2B convite:
--
--   a) E-mail "leitura pronta" (D-04): quando status='ready' pela 1ª vez,
--      o hook em /api/readings/[id]/analyze/route.ts dispara e-mail Resend
--      pra terapeuta. Idempotência exige flag no DB — regen NÃO re-dispara.
--      Coluna: readings.notification_sent_at (timestamptz NULL)
--
--   b) Wizard de onboarding inline na dashboard (D-02): banner "Vamos
--      começar (1 de 3)" aparece pra terapeuta nova, some quando os 3 steps
--      completam OU quando terapeuta clica "Pular". O dismiss é persistido
--      pra não reaparecer a cada reload.
--      Coluna: profiles.onboarding_dismissed_at (timestamptz NULL)
--
-- 2 mudanças (ambas strictly additive / safe):
--
--   1. readings.notification_sent_at timestamptz NULL — flag idempotente
--      pra e-mail "leitura pronta" (D-04). NULL = nunca enviado.
--      Non-NULL = idempotência garantida (regen NÃO duplica notificação).
--
--   2. profiles.onboarding_dismissed_at timestamptz NULL — persistência do
--      dismiss do wizard de onboarding inline (D-02). NULL = wizard ainda
--      pode aparecer. Non-NULL = terapeuta clicou "Pular" explicitamente.
--
-- Strictly additive. Zero DROP, zero backfill, zero reordenação de colunas.
-- Pode ser aplicada antes OU depois do código sem quebrar prod: colunas novas
-- com NULL default → código existente que não conhece as colunas segue
-- funcionando; código novo (09-02 wizard + 09-03 e-mail) lê NULL como
-- "ainda não enviado / wizard ainda ativo" — graceful degradation.
--
-- Ambos os ALTER TABLE usam IF NOT EXISTS pra idempotência total:
-- re-executar esta migration em ambiente que já tem as colunas é inofensivo.
--
-- Refs: 09-CONTEXT.md D-02 (onboarding) + D-04 (e-mail idempotência);
--       Plans 09-02 (wizard) + 09-03 (e-mail hook) dependem desta migration.

-- ── 1. readings.notification_sent_at ─────────────────────────────────────────
alter table public.readings
  add column if not exists notification_sent_at timestamptz;

comment on column public.readings.notification_sent_at is
  'Fase 9 (2026-05-26): timestamp do envio do e-mail "leitura pronta" pro terapeuta. NULL = nunca enviado. Non-NULL = idempotência da notificação (D-04: regen NÃO re-dispara e-mail). Set pelo hook em /api/readings/[id]/analyze/route.ts após report_generated UPDATE bem-sucedido.';

-- ── 2. profiles.onboarding_dismissed_at ──────────────────────────────────────
alter table public.profiles
  add column if not exists onboarding_dismissed_at timestamptz;

comment on column public.profiles.onboarding_dismissed_at is
  'Fase 9 (2026-05-26): timestamp do dismiss manual do wizard de onboarding inline (D-02). NULL = wizard ainda pode aparecer. Non-NULL = terapeuta clicou "Pular" e não quer ver mais. Wizard ALSO some quando os 3 steps de onboarding completam (estado derivado de DB), independente desta coluna — D-02.';
