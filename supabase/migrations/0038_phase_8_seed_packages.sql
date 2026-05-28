-- 0038_phase_8_seed_packages.sql
--
-- Fase 8: Pagamento + LGPD — seed dos 4 SKUs de pacotes (Wave 1, Plano 08-01).
--
-- CONTEXTO:
--   Popula a tabela credit_packages com os 4 SKUs cuja pricing está locked no
--   CONTEXT.md D-02. Estes valores são FINAIS — não estimativas.
--
-- PRICING LOCKED (D-02):
--   avulsa : 1 leitura  × R$ 99,70   — sem badge
--   pequeno: 5 leituras × R$ 298,50  — sem badge         (R$ 59,70/un)
--   medio  : 15 leituras × R$ 745,50 — badge mais_escolhido (R$ 49,70/un)
--   grande : 30 leituras × R$ 1191,00 — badge melhor_valor  (R$ 39,70/un)
--
-- IDEMPOTÊNCIA: INSERT ... ON CONFLICT (sku) DO NOTHING
--   Re-executar a migration não altera rows existentes.
--   Se founder atualizar pricing futuro: criar novo SKU (ex: 'avulsa_v2')
--   e desativar o antigo via UPDATE active=false (founder dashboard).
--
-- NOTA: Escolha de seed na própria migration (não script .mjs separado):
--   menos moving parts; supabase db push garante que packages aparecem
--   imediatamente após a migração ser aplicada. RESEARCH §0038 §No Analog Found.
--
-- Divisão de trabalho: Claude autorou; founder aplica (supabase db push --linked).

begin;

insert into public.credit_packages
  (sku, name, leituras_count, price_brl, badge, display_order, active)
values
  ('avulsa',  'Leitura Avulsa',  1,  99.70, null,             1, true),
  ('pequeno', 'Pacote Pequeno',  5, 298.50, null,             2, true),
  ('medio',   'Pacote Médio',   15, 745.50, 'mais_escolhido', 3, true),
  ('grande',  'Pacote Grande',  30, 1191.00, 'melhor_valor',  4, true)
on conflict (sku) do nothing;

commit;
