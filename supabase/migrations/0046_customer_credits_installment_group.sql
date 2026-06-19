-- ============================================================================
-- 0046 — customer_credits.asaas_installment_id (grupo de parcelamento)
-- ============================================================================
-- Contexto (auditoria 2026-06-19): compras parceladas no cartão (pacote grande
-- até 3x) criam UMA cobrança no Asaas que retorna a 1ª parcela + um id de GRUPO
-- (`payment.installment`). Cada parcela é um payment object com `id` PRÓPRIO e
-- dispara webhooks PRÓPRIOS (CONFIRMED/RECEIVED/REFUNDED/CHARGEBACK). Antes só
-- guardávamos `asaas_payment_id` (id da 1ª parcela), então:
--   - refund do grupo / chargeback de parcela 2+ NÃO casavam com nenhuma row
--     → crédito não revertia (fraude passava; estorno só pegava a 1ª parcela).
-- Esta coluna guarda o grupo; o handler do webhook passa a casar por
-- `asaas_payment_id` OU `asaas_installment_id` (apply-payment.ts), cobrindo todas
-- as parcelas. Idempotência espelha asaas_payment_id (1 grupo = 1 row).

alter table public.customer_credits
  add column if not exists asaas_installment_id text;

comment on column public.customer_credits.asaas_installment_id is
  'Grupo de parcelamento Asaas (payment.installment). NULL em compras à vista/PIX. Setado só em cartão parcelado (grande até 3x). Webhook casa por asaas_payment_id OU asaas_installment_id → crédito 1×, refund e chargeback cobrindo todas as parcelas. Migration 0046 (auditoria 2026-06-19).';

-- UNIQUE parcial: 1 grupo de parcelamento = 1 row de crédito (mesma garantia de
-- idempotência do asaas_payment_id UNIQUE). Parcial (WHERE not null) p/ permitir
-- múltiplas rows à vista com installment_id NULL.
create unique index if not exists customer_credits_asaas_installment_id_key
  on public.customer_credits (asaas_installment_id)
  where asaas_installment_id is not null;
