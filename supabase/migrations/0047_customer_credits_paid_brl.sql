-- ============================================================================
-- 0047 — customer_credits.paid_brl (valor REALMENTE pago)
-- ============================================================================
-- Contexto (founder 2026-06-19): PIX passa a dar 5% de desconto (médio+grande).
-- Com desconto, o valor pago ≠ credit_packages.price_brl (preço de tabela). Pra
-- o reembolso do arrependimento 7d e o relatório de receita ficarem corretos,
-- gravamos o valor cobrado nesta coluna. NULL em rows antigas → consumidores
-- caem no preço de tabela (coalesce), preservando o comportamento atual.

alter table public.customer_credits
  add column if not exists paid_brl numeric;

comment on column public.customer_credits.paid_brl is
  'Valor REALMENTE cobrado nesta compra (R$). Pode ser < price_brl quando há desconto PIX (5% médio/grande). Base de reembolso (refund-policy) e receita (reports). NULL em compras anteriores à migration 0047 → usa credit_packages.price_brl.';
