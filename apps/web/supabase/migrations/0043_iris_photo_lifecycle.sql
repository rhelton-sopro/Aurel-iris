-- 0043 — Ciclo de vida da foto da íris (LGPD / 2026-06-03)
--
-- Decisão de produto (founder): a foto da íris é o dado mais íntimo que existe
-- e tem hora pra ir embora. Ela é apagada PARA SEMPRE do bucket iris-captures
-- assim que o relatório é gerado E auditado como completo — ou, em qualquer
-- caso, em no máximo 24h após o upload (cron horário /api/cron/photo-ttl).
-- Como o "regenerar" do terapeuta foi removido, o delete só acontece quando o
-- gate de auditoria (audit_metadata.section_completeness.complete) passa;
-- relatórios incompletos retêm a foto pra resgate manual em /admin/regenerar.
--
-- Estas duas colunas dão: (1) idempotência do cron (pular já-apagadas),
-- (2) sinal de UI ("foto apagada"), (3) trilha de auditoria do erasure.
-- A LP e a FAQ públicas prometem esse comportamento — o sistema honra.

alter table public.readings
  add column if not exists images_purged_at timestamptz,
  add column if not exists images_purge_reason text
    check (images_purge_reason in ('audit_complete', 'ttl_24h'));

comment on column public.readings.images_purged_at is
  'Quando as fotos da íris (originais + canônicas) foram apagadas do bucket. NULL = ainda presentes.';
comment on column public.readings.images_purge_reason is
  'Motivo do erasure: audit_complete (relatório completo na geração) | ttl_24h (varredura horária do TTL de 24h).';

-- Índice parcial pra varredura horária do cron achar rápido o que ainda não
-- foi apagado (volume cresce; mantém o sweep barato).
create index if not exists idx_readings_images_not_purged
  on public.readings (created_at)
  where images_purged_at is null;
