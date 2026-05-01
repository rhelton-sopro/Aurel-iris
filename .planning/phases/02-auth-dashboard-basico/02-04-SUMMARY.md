---
phase: 2
plan: 4
subsystem: clientes-crud
tags: [crud, server-actions, rls, shadcn, base-ui, zod-v4, react-hook-form]
dependency_graph:
  requires:
    - "02-03: dashboard layout (route group (dashboard) + SidebarProvider)"
    - "apps/web/lib/supabase/server.ts (createClient + getUser)"
    - "apps/web/types/database.ts (clients.Row, clients.Insert)"
  provides:
    - "createClientAction, updateClientAction, deleteClientAction (app/actions/clients.ts)"
    - "ClientsTable, ClientForm, DeleteClientDialog components"
    - "Rotas /clientes, /clientes/novo, /clientes/[id], /clientes/[id]/editar"
    - "GET /api/health/db (smoke test)"
  affects:
    - "apps/web/components/ui/ (table, dialog, select, textarea adicionados)"
tech_stack:
  added:
    - "@base-ui/react/select (via shadcn new-york v4 — sem Radix)"
    - "shadcn components: table, dialog, select, textarea (instalados via pnpm dlx shadcn add)"
  patterns:
    - "Server Actions com useActionState (React 19)"
    - "base-ui Button sem asChild: links de navegação usam buttonVariants + <Link> diretamente"
    - "base-ui Select com name prop: injeta hidden input para FormData nativa"
    - "Zod v4: .min(1, msg) em vez de { required_error: msg }"
key_files:
  created:
    - apps/web/app/actions/clients.ts
    - apps/web/components/clientes/clients-table.tsx
    - apps/web/components/clientes/client-form.tsx
    - apps/web/components/clientes/delete-client-dialog.tsx
    - apps/web/app/(dashboard)/clientes/page.tsx
    - apps/web/app/(dashboard)/clientes/novo/page.tsx
    - apps/web/app/(dashboard)/clientes/[id]/page.tsx
    - apps/web/app/(dashboard)/clientes/[id]/editar/page.tsx
    - apps/web/app/api/health/db/route.ts
    - apps/web/components/ui/table.tsx
    - apps/web/components/ui/dialog.tsx
    - apps/web/components/ui/select.tsx
    - apps/web/components/ui/textarea.tsx
  modified: []
decisions:
  - "Button base-ui sem asChild: usar buttonVariants + Link ao invés de Button asChild (incompatível com base-ui)"
  - "Select base-ui com name prop: FormData nativa sem bridge manual para react-hook-form"
  - "Busca client-side sem debounce (MVP — adequado para carteiras pequenas < 500 clientes)"
metrics:
  duration: "~7 min"
  completed_date: "2026-05-01"
  tasks_completed: 2
  files_created: 13
---

# Phase 2 Plan 4: CRUD Clientes + Smoke Test Summary

CRUD completo de clientes com Server Actions autenticados via getUser() (T-02-06), tabela com busca client-side, formulários react-hook-form + Zod v4, dialog de exclusão e smoke test GET /api/health/db.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 02-04-T1 | Instalar shadcn components + Server Actions de clientes | 489a787 | 5 files (4 shadcn ui + actions/clients.ts) |
| 02-04-T2 | Componentes UI de clientes e todas as páginas /clientes | e211efb | 8 files (3 components + 4 pages + health route) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Button asChild não existe no base-ui Button**
- **Found during:** Task 2 — TypeScript typecheck pós-criação dos arquivos
- **Issue:** O componente Button usa `@base-ui/react/button` (não Radix/shadcn padrão). O base-ui Button não tem prop `asChild`. O plano usava `Button asChild` em múltiplos lugares.
- **Fix:** Substituído `<Button asChild><Link ...></Button>` por `<Link className={cn(buttonVariants(...))} ...>` em todos os 6 ocorrências (clients-table, client-form, clientes/page, clientes/[id]/page).
- **Files modified:** clients-table.tsx, client-form.tsx, clientes/page.tsx, clientes/[id]/page.tsx
- **Commit:** e211efb

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Última leitura sempre "—" | components/clientes/clients-table.tsx | ~74 | Readings não implementadas ainda (Wave 5+). Intencional — coluna reservada para fase futura |
| Seção Leituras vazia com botão disabled | app/(dashboard)/clientes/[id]/page.tsx | ~70 | Intencional per spec — botão "Nova Leitura" disabled title="Disponível em breve" (requisito do plano) |

## Threat Surface Scan

Nenhum novo endpoint ou surface de segurança além dos mapeados no threat_model do plano:
- T-02-06: getUser() em todos os 3 Server Actions — mitigado
- T-02-01: getUser() no /api/health/db — mitigado
- T-02-07: vocabulário proibido ausente (grep confirmado: 0 resultados)
- T-02-csrf: Server Actions têm CSRF protection nativa do Next.js

## Self-Check: PASSED

- apps/web/app/actions/clients.ts: FOUND
- apps/web/components/ui/table.tsx: FOUND
- apps/web/components/ui/dialog.tsx: FOUND
- apps/web/components/clientes/clients-table.tsx: FOUND
- apps/web/app/api/health/db/route.ts: FOUND
- Commit 489a787: FOUND
- Commit e211efb: FOUND
- TypeScript clean: CONFIRMED (tsc --noEmit --skipLibCheck = 0 errors)
- getUser() count: 3 (um por Server Action)
- Vocabulário proibido: 0 ocorrências
