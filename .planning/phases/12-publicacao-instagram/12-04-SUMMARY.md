---
phase: 12-publicacao-instagram
plan: 04
subsystem: admin-notifications
tags: [instagram, admin, notifications, igpub-06, igpub-01, d-04, d-07]
requires:
  - "social_posts status='erro' (migration 0049, bump SocialPostStatus Plan 01)"
  - "app_settings.instagram_health flag (escrita pelo cron daily, Plan 05 — leitura defensiva aqui)"
provides:
  - "AdminNotifications.publishErrors (contagem de posts em 'erro')"
  - "AdminNotifications.instagramAuthError (sinal de saúde do token IG)"
  - "Card 'Falhas de publicação' + card 'Conexão Instagram' no portal /admin"
affects:
  - "apps/web/lib/admin/notifications-summary.ts"
  - "apps/web/app/admin/page.tsx"
tech-stack:
  added: []
  patterns:
    - "Cliente untyped (createServiceClient() as unknown as SupabaseClient) para app_settings (não está no Database type gerado)"
    - "Best-effort por fonte: cada query tem .catch(() => 0/false) — uma falha nunca quebra o /admin"
key-files:
  created:
    - "apps/web/lib/admin/__tests__/notifications-summary.test.ts"
  modified:
    - "apps/web/lib/admin/notifications-summary.ts"
    - "apps/web/app/admin/page.tsx"
decisions:
  - "app_settings acessado via cliente untyped (precedente token.ts/client-report-config.ts) — evita regenerar tipos por tabela auxiliar"
  - "instagramAuthError default false quando a flag instagram_health está ausente (Plan 05 ainda não rodou) — ausência ≠ regressão"
metrics:
  duration: "~4 min"
  completed: "2026-06-21"
  tasks: 3
  files: 3
  commits: 3
---

# Phase 12 Plan 04: Falhas de publicação na central de notificações Summary

Expõe falhas de publicação no `/admin` reusando `getAdminNotifications` (D-04): `publishErrors` conta `social_posts` em `'erro'` (IGPUB-06) e `instagramAuthError` lê a flag de saúde do token IG (D-07); card "Falhas de publicação" no portal linka pra fila de erro. Sucesso de publicação permanece silencioso (D-05).

## What Was Built

- **Task 1** (`762d5a3`) — `AdminNotifications` ganhou `publishErrors: number` e `instagramAuthError: boolean`. `countPublishErrors()` conta `social_posts` com `status='erro'` (head:true, cliente tipado). `checkInstagramAuthError()` lê `app_settings.instagram_health.value.ok` via cliente untyped, default `false` quando a flag está ausente. Ambas as fontes no `Promise.all` com `.catch(() => 0/false)`.
- **Task 2** (`20bda10`) — card "Falhas de publicação" (`count: notif.publishErrors`, `href: /admin/painel?status=erro`, `alert: >0`) após "Compras travadas (+2h)". Card extra "Conexão Instagram" empurrado no array quando `notif.instagramAuthError` (alerta visual D-07).
- **Task 3** (`940666b`) — teste vitest com `createServiceClient` e IMAP mockados (zero rede). O `from` roteia por nome de tabela (count thenable pra `social_posts`, `maybeSingle` pra `app_settings`). 6 casos: publishErrors=2; sucesso silencioso (0); best-effort (query lança → 0, /admin não quebra); auth ok=false→true; ok=true→false; flag ausente→false. 6/6 GREEN.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Acesso a `app_settings` via cliente untyped**
- **Found during:** Task 1
- **Issue:** O plano usava `createServiceClient()` (tipado, `SupabaseClient<Database>`) para `.from('app_settings')`, mas `app_settings` não existe no Database type gerado (migration 0048/0049 não regeneram tipos por tabela auxiliar) → `pnpm tsc` falharia.
- **Fix:** `createServiceClient() as unknown as SupabaseClient` apenas em `checkInstagramAuthError`, seguindo o precedente exato de `lib/instagram/token.ts` e `lib/admin/client-report-config.ts`. `countPublishErrors` segue tipado (`social_posts` ESTÁ no Database type). Adicionado `import type { SupabaseClient }`.
- **Files modified:** apps/web/lib/admin/notifications-summary.ts
- **Commit:** 762d5a3

## Authentication Gates

Nenhum.

## Known Stubs

Nenhum. `instagramAuthError` lê uma flag que o Plan 05 ainda não escreve — comportamento defensivo documentado (default `false`), coberto por teste explícito ("flag ausente → false"). Não é stub: é leitura defensiva de um sinal que passa a existir quando o cron daily rodar.

## Verification

- `pnpm tsc --noEmit` — zero erros novos nos 3 arquivos do plano (debt pré-existente Fase 3/5 e os 2 erros de `painel/actions.ts` pendentes de `gen:types` pós-db-push não são deste plano).
- `pnpm lint` — nenhum dos 3 arquivos aparece na lista de erros (25 erros são todos debt pré-existente em scripts/capture/tests).
- `pnpm test:run lib/admin/__tests__/notifications-summary.test.ts` — 6/6 GREEN.
- grep: `publishErrors`+`instagramAuthError`+`instagram_health` = 7 em notifications-summary.ts; `.catch` best-effort = 6; "Falhas de publicação" = 1 e `/admin/painel?status=erro` = 1 em page.tsx.

## Self-Check: PASSED
- FOUND: apps/web/lib/admin/notifications-summary.ts
- FOUND: apps/web/app/admin/page.tsx
- FOUND: apps/web/lib/admin/__tests__/notifications-summary.test.ts
- FOUND: commit 762d5a3 (Task 1)
- FOUND: commit 20bda10 (Task 2)
- FOUND: commit 940666b (Task 3)
