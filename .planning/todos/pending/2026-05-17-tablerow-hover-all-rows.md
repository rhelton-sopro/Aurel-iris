# Observação — TableRow hover em todas as linhas

**Origem:** Cluster 2 do redesign (design system Iris Codex), 2026-05-17.

`components/ui/table.tsx` → `TableRow` aplica `hover:bg-ivory` em **todas** as
linhas (fiel ao `icb-table tbody tr:hover` do design system). OK no volume
atual (~3 clientes / poucas leituras).

**Sem ação imediata.** Revisitar quando produção atingir ~50+ clientes/leituras:
decidir se o hover deve ficar só em linhas clicáveis (affordance) ou ter
intensidade reduzida para não criar ruído visual em listas longas.

Não é bug — é escolha de design consciente registrada para o futuro.
