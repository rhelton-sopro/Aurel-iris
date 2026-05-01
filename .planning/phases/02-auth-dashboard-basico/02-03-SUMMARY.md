---
phase: 02-auth-dashboard-basico
plan: "03"
subsystem: ui
tags: [nextjs, shadcn, sidebar, dashboard, supabase, date-fns, tailwind, lucide]

# Dependency graph
requires:
  - phase: 02-auth-dashboard-basico plan 01
    provides: createClient() server-side, lib/supabase/server.ts, middleware.ts, types/database.ts

provides:
  - Dashboard layout com SidebarProvider + AppSidebar + DashboardHeader + footer LGPD
  - AppSidebar com nav links Dashboard/Clientes/Leituras e ícones lucide
  - DashboardHeader com SidebarTrigger + badge trial (outline/destructive) + avatar + dropdown Sair
  - SummaryCards com 3 cards (Clientes, Leituras esta semana, Assinatura) com cálculo de trial
  - /dashboard page (Server Component) contando clientes via RLS
  - /leituras page placeholder "Em breve"
  - shadcn components instalados: sidebar, avatar, badge, dropdown-menu, separator, sheet, skeleton, tooltip
  - date-fns@4.1.0 instalado
affects:
  - 02-04 (CRUD clientes consome o AppSidebar e DashboardLayout já criados)
  - fases futuras que adicionam páginas ao route group (dashboard)

# Tech tracking
tech-stack:
  added:
    - shadcn sidebar (base-nova preset, @base-ui/react)
    - shadcn avatar (@base-ui/react/avatar)
    - shadcn badge (cva, class-variance-authority)
    - shadcn dropdown-menu (@base-ui/react/menu)
    - shadcn separator, sheet, skeleton, tooltip
    - hooks/use-mobile.ts (IntersectionObserver breakpoint hook)
    - date-fns@4.1.0 (differenceInDays para cálculo de trial)
  patterns:
    - Server Component layout que busca sessão + perfil e passa props para Client Components de UI
    - render prop (não asChild) para SidebarMenuButton do @base-ui/react — padrão do preset base-nova
    - DropdownMenuTrigger sem asChild (children como Avatar para trigger visual)
    - RLS-first: queries de clients sem filtro explícito (therapist_id filtrado por RLS)
    - getUser() server-side obrigatório (nunca getSession no servidor — T-02-01)

key-files:
  created:
    - apps/web/app/(dashboard)/layout.tsx
    - apps/web/app/(dashboard)/dashboard/page.tsx
    - apps/web/app/(dashboard)/leituras/page.tsx
    - apps/web/components/dashboard/app-sidebar.tsx
    - apps/web/components/dashboard/dashboard-header.tsx
    - apps/web/components/dashboard/summary-cards.tsx
    - apps/web/components/ui/sidebar.tsx
    - apps/web/components/ui/avatar.tsx
    - apps/web/components/ui/badge.tsx
    - apps/web/components/ui/dropdown-menu.tsx
    - apps/web/components/ui/separator.tsx
    - apps/web/components/ui/sheet.tsx
    - apps/web/components/ui/skeleton.tsx
    - apps/web/components/ui/tooltip.tsx
    - apps/web/hooks/use-mobile.ts
  modified:
    - apps/web/package.json (+ date-fns@4.1.0)
    - pnpm-lock.yaml

key-decisions:
  - "render prop em vez de asChild para SidebarMenuButton — preset base-nova usa @base-ui/react que não expõe asChild na API pública do componente shadcn gerado"
  - "DropdownMenuTrigger sem asChild — Avatar colocado como children direto do trigger; DropdownMenuTrigger do @base-ui/react/menu não aceita asChild prop"
  - "Layout server-side busca profile e passa fullName/trialEndsAt/subscriptionStatus como props; DashboardHeader é client-side (precisa de router e supabase client)"

patterns-established:
  - "Pattern 1: Server Component busca dados + passa props para Client Components de UI (sem prop drilling de supabase client)"
  - "Pattern 2: @base-ui/react SidebarMenuButton usa render={<Link href='' />} para comportamento de link sem asChild"
  - "Pattern 3: Segurança defense-in-depth — layout valida getUser() mesmo que middleware já proteja"

requirements-completed: [CLIENT-03, AUTH-02, AUTH-03]

# Metrics
duration: 18min
completed: 2026-05-01
---

# Phase 2 Plan 3: Dashboard Layout e Páginas Summary

**Dashboard layout completo com AppSidebar (lucide icons, render-prop Link), DashboardHeader (trial badge + avatar dropdown), SummaryCards (3 cards com date-fns), route group (dashboard) com Server Component protegido por getUser() + RLS, e placeholder /leituras**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-01T09:00:00Z
- **Completed:** 2026-05-01T09:18:00Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- 6 arquivos de componentes e páginas do dashboard criados (AppSidebar, DashboardHeader, SummaryCards, layout, /dashboard, /leituras)
- 9 componentes shadcn instalados (sidebar + avatar + badge + dropdown-menu + separator + sheet + skeleton + tooltip + hooks/use-mobile)
- Date-fns@4.1.0 instalado para cálculo de dias restantes de trial
- TypeScript limpo (tsc --noEmit --skipLibCheck) ao final das 2 tasks
- Threat mitigations T-02-01 e T-02-06 implementados: getUser() server-side + redirect(/login) + RLS

## Task Commits

1. **Task 1: shadcn components + AppSidebar + DashboardHeader + SummaryCards** — `f8afd01` (feat)
2. **Task 2: (dashboard)/layout.tsx + /dashboard/page.tsx + /leituras/page.tsx** — `612d030` (feat)

**Plan metadata:** SUMMARY commit (docs)

## Files Created/Modified

- `apps/web/app/(dashboard)/layout.tsx` — Server Component com auth gate (getUser), busca profile, monta SidebarProvider + AppSidebar + DashboardHeader + footer LGPD
- `apps/web/app/(dashboard)/dashboard/page.tsx` — Server Component contando clients via RLS, renderiza SummaryCards
- `apps/web/app/(dashboard)/leituras/page.tsx` — Placeholder "Em breve" com ícone Eye
- `apps/web/components/dashboard/app-sidebar.tsx` — Sidebar com nav links e render prop para Link
- `apps/web/components/dashboard/dashboard-header.tsx` — Header com trial badge e dropdown logout
- `apps/web/components/dashboard/summary-cards.tsx` — 3 cards: clientes, leituras, assinatura
- `apps/web/components/ui/sidebar.tsx` — shadcn Sidebar (base-nova, @base-ui/react)
- `apps/web/components/ui/avatar.tsx` — shadcn Avatar (@base-ui/react)
- `apps/web/components/ui/badge.tsx` — shadcn Badge (cva, outline/destructive variants)
- `apps/web/components/ui/dropdown-menu.tsx` — shadcn DropdownMenu (@base-ui/react/menu)
- `apps/web/components/ui/separator.tsx` — shadcn Separator
- `apps/web/components/ui/sheet.tsx` — shadcn Sheet (mobile sidebar drawer)
- `apps/web/components/ui/skeleton.tsx` — shadcn Skeleton
- `apps/web/components/ui/tooltip.tsx` — shadcn Tooltip
- `apps/web/hooks/use-mobile.ts` — Hook de breakpoint mobile

## Decisions Made

- **render prop em vez de asChild para SidebarMenuButton:** o preset base-nova do shadcn usa `@base-ui/react` cujo componente `SidebarMenuButton` gerado usa `useRender` com `render` prop, não expondo `asChild`. Uso de `render={<Link href="" />}` é o padrão correto.
- **DropdownMenuTrigger sem asChild:** `MenuPrimitive.Trigger` do `@base-ui/react/menu` não aceita `asChild`. Avatar é passado como children direto e o trigger renderiza ao redor dele.
- **Layout como Server Component puro:** busca sessão e perfil server-side, passa dados como props para os Client Components (DashboardHeader) — evita waterfalls e expõe menos surface client-side.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrigido uso de asChild incompatível com @base-ui/react**
- **Found during:** Task 1 (verificação TypeScript)
- **Issue:** O plano especificava `asChild` em `SidebarMenuButton` e `DropdownMenuTrigger`, mas o shadcn base-nova instala componentes baseados em `@base-ui/react` que não expõem `asChild` — TypeScript reportou 2 erros: `Property 'asChild' does not exist`.
- **Fix:** `SidebarMenuButton` passou a usar `render={<Link href={item.href} />}`. `DropdownMenuTrigger` recebeu `Avatar` como children direto sem wrapper `asChild`.
- **Files modified:** `apps/web/components/dashboard/app-sidebar.tsx`, `apps/web/components/dashboard/dashboard-header.tsx`
- **Verification:** `pnpm exec tsc --noEmit --skipLibCheck` — limpo sem erros.
- **Committed in:** f8afd01 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug de incompatibilidade de API)
**Impact on plan:** Fix necessário para compilar; sem mudança de comportamento funcional. O resultado visual e de interação é idêntico ao especificado no plano.

## Issues Encountered

- API `asChild` do shadcn padrão (Radix UI) não existe no preset base-nova que usa `@base-ui/react` — descoberta durante typecheck da Task 1. Resolvido imediatamente via Rule 1.

## Known Stubs

- `SummaryCards`: card "Leituras esta semana" mostra `0` hardcoded. Stub intencional documentado no plano (D-11: `0` placeholder Fase 2). Será wired quando módulo de leituras for implementado.

## User Setup Required

Nenhuma — sem configuração de serviço externo necessária neste plano.

## Next Phase Readiness

- Route group `(dashboard)` com layout completo pronto para receber novas páginas (ex: `/clientes` do plano 02-04)
- AppSidebar já tem link `/clientes` — página ainda não existe, será criada no próximo plano
- shadcn `card`, `table`, `input`, `label`, `select`, `textarea`, `dialog`, `form` ainda precisam ser instalados para o plano 02-04 (CRUD clientes)
- TooltipProvider: shadcn add tooltip adicionou tooltip.tsx e recomendou wrap em `app/layout.tsx` — não crítico para este plano mas pode ser adicionado no plano 02-04 se necessário

## Threat Flags

Nenhum — nenhuma superfície nova fora do threat model do plano.

## Self-Check: PASSED

- FOUND: apps/web/app/(dashboard)/layout.tsx
- FOUND: apps/web/app/(dashboard)/dashboard/page.tsx
- FOUND: apps/web/app/(dashboard)/leituras/page.tsx
- FOUND: apps/web/components/dashboard/app-sidebar.tsx
- FOUND: apps/web/components/dashboard/dashboard-header.tsx
- FOUND: apps/web/components/dashboard/summary-cards.tsx
- FOUND: apps/web/components/ui/sidebar.tsx
- FOUND: apps/web/components/ui/avatar.tsx
- FOUND: apps/web/components/ui/badge.tsx
- COMMIT f8afd01: feat(02-03): instalar shadcn dashboard components
- COMMIT 612d030: feat(02-03): criar (dashboard)/layout.tsx, /dashboard/page.tsx e /leituras/page.tsx

---
*Phase: 02-auth-dashboard-basico*
*Completed: 2026-05-01*
