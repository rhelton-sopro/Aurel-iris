# Observação — className longa do SidebarMenuButton

**Origem:** Cluster 3 do redesign (design system Iris Codex), 2026-05-17.

`components/dashboard/app-sidebar.tsx` → o `SidebarMenuButton` tem ~8
modifiers Tailwind concatenados numa única string (rounded-none, border-l,
text-mist, hover:*, data-active:* x4). Funciona corretamente (override do
`sidebarMenuButtonVariants` shadcn via tailwind-merge), mas é difícil de ler.

**Sem ação imediata.** Se essa className precisar mudar no futuro, extrair
para uma constante nomeada (ex.: `NAV_ITEM_CLASS`) no topo do arquivo antes
de editar — não reescrever inline.

Não é bug — escolha consciente registrada para manutenção futura.
