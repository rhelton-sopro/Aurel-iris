---
phase: 02-auth-dashboard-basico
plan: "01"
subsystem: auth
tags: [supabase, ssr, middleware, pkce, magic-link, postgres, trigger, next15]

# Dependency graph
requires:
  - phase: 01-setup
    provides: Supabase projeto remoto linkado + schema público com tabela profiles + pnpm workspace configurado

provides:
  - "createClient() browser via createBrowserClient<Database> em lib/supabase/client.ts"
  - "createClient() server via createServerClient<Database> + await cookies() em lib/supabase/server.ts"
  - "updateSession() helper com getUser() (não getSession) em lib/supabase/middleware.ts"
  - "Auth guard Next.js 15 middleware.ts protegendo /dashboard, /clientes, /leituras, /assinatura"
  - "PKCE callback server-only em app/api/auth/callback/route.ts com exchangeCodeForSession"
  - "Trigger on_auth_user_created criando profiles com subscription_status=trial + trial_ends_at=14d"
  - "NEXT_PUBLIC_SITE_URL em apps/web/.env.example"

affects:
  - 02-02-auth-pages
  - 02-03-dashboard-layout
  - 02-04-crud-clientes
  - 03-pipeline-visao
  - qualquer plano que use autenticação ou sessão

# Tech tracking
tech-stack:
  added:
    - "@supabase/ssr@0.10.2"
    - "@supabase/supabase-js@2.105.1"
  patterns:
    - "SSR auth via createServerClient + await cookies() (Next.js 15 async cookies)"
    - "Middleware auth guard com PROTECTED_PATHS array + updateSession helper"
    - "PKCE callback server-only: nunca expõe token ao browser"
    - "SQL trigger security definer + set search_path = '' para criação automática de profiles"

key-files:
  created:
    - apps/web/lib/supabase/client.ts
    - apps/web/lib/supabase/server.ts
    - apps/web/lib/supabase/middleware.ts
    - apps/web/middleware.ts
    - apps/web/app/api/auth/callback/route.ts
    - supabase/migrations/0003_profiles_trigger.sql
    - apps/web/.env.example
  modified:
    - apps/web/.env.local.example
    - apps/web/package.json
    - pnpm-lock.yaml

key-decisions:
  - "getUser() em vez de getSession() em todo código servidor — valida JWT contra chaves públicas Supabase (T-02-01)"
  - "await cookies() obrigatório em Next.js 15 — cookies() retorna Promise (Pitfall 1)"
  - "middleware.ts nome mantido (não proxy.ts) — projeto está em Next.js 15.5.15, renomeação é v16+"
  - "Trigger SQL com security definer + set search_path = '' previne SQL injection via search_path (T-02-05)"
  - "NEXT_PUBLIC_SITE_URL fixo em produção; .env.example documenta valor de desenvolvimento"

patterns-established:
  - "Pattern SSR auth: createServerClient com cookies getAll/setAll em Server Components e Server Actions"
  - "Pattern middleware: updateSession helper separado de apps/web/middleware.ts para testabilidade"
  - "Pattern callback PKCE: exchangeCodeForSession server-only, nunca expõe code ou token no browser"
  - "Pattern trigger: handle_new_user() com ON CONFLICT DO NOTHING para idempotência"

requirements-completed:
  - AUTH-01
  - AUTH-02
  - AUTH-03

# Metrics
duration: 6min
completed: "2026-05-01"
---

# Phase 2 Plan 01: Auth Foundation Summary

**@supabase/ssr instalado com clientes browser/server/middleware, auth guard Next.js 15 protegendo rotas do dashboard, callback PKCE server-only para magic link, e trigger SQL criando profiles com trial de 14 dias no signup**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-01T11:37:30Z
- **Completed:** 2026-05-01T11:43:19Z
- **Tasks:** 3
- **Files modified:** 9 (7 criados, 2 modificados)

## Accomplishments

- Três clientes Supabase (browser, server, middleware) criados com os padrões @supabase/ssr para Next.js 15
- middleware.ts protege /dashboard, /clientes, /leituras, /assinatura usando getUser() validado server-side
- /api/auth/callback troca code PKCE server-side e redireciona para /dashboard (sem exposição de token)
- Migration 0003 aplicada ao Supabase remoto — trigger on_auth_user_created cria profiles com trial automaticamente
- NEXT_PUBLIC_SITE_URL documentado em apps/web/.env.example e .env.local.example

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Instalar @supabase/ssr e criar os três clientes Supabase** - `ac5f7eb` (feat)
2. **Task 2: Criar middleware.ts (auth guard) e /api/auth/callback** - `29b12d7` (feat)
3. **Task 3: Migration 0003 (profiles trigger) + supabase db push + .env.example** - `d318cf3` (feat)

## Files Created/Modified

- `apps/web/lib/supabase/client.ts` — createBrowserClient<Database> para uso em Client Components
- `apps/web/lib/supabase/server.ts` — createServerClient<Database> com await cookies() para Server Components e Server Actions
- `apps/web/lib/supabase/middleware.ts` — updateSession() helper que chama getUser() (não getSession) e retorna { supabase, supabaseResponse, user }
- `apps/web/middleware.ts` — Auth guard Next.js 15, protege PROTECTED_PATHS, redireciona /login para /dashboard se logado
- `apps/web/app/api/auth/callback/route.ts` — GET handler PKCE: exchangeCodeForSession server-only, redirect /dashboard ou /login?error=
- `supabase/migrations/0003_profiles_trigger.sql` — trigger on_auth_user_created com security definer, ON CONFLICT DO NOTHING, coalesce full_name
- `apps/web/.env.example` — template de variáveis do Next.js incluindo NEXT_PUBLIC_SITE_URL
- `apps/web/.env.local.example` — NEXT_PUBLIC_SITE_URL adicionado ao template existente
- `apps/web/package.json` + `pnpm-lock.yaml` — @supabase/ssr@0.10.2 e @supabase/supabase-js@2.105.1 adicionados

## Decisions Made

- **getUser() em vez de getSession()** no servidor — getSession() não valida assinatura JWT (T-02-01 do threat model); getUser() valida contra as chaves públicas do projeto Supabase
- **await cookies()** obrigatório — Next.js 15 tornou cookies() assíncrono; chamada sem await retorna Promise silenciosamente (Pitfall 1 do RESEARCH.md)
- **middleware.ts mantido** (não proxy.ts) — o projeto usa Next.js 15.5.15; a renomeação para proxy.ts só entra em v16+
- **set search_path = ''** no trigger — previne SQL injection via substituição de funções por um atacante que controla o search_path
- **coalesce(full_name, 'Terapeuta')** — profiles.full_name é NOT NULL; coalesce previne violação se o signup não incluir full_name nos metadados

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Copiar supabase/.temp/ para o worktree**
- **Found during:** Task 3 (supabase db push --linked)
- **Issue:** O worktree não tinha os arquivos .temp do Supabase CLI (linked-project.json, project-ref, etc.) que o CLI precisa para saber qual projeto remoto usar. Executar `supabase db push --linked` no worktree retornou "Cannot find project ref"
- **Fix:** Copiar o diretório `supabase/.temp/` do repo principal (`D:/Projetos/Iridologista/supabase/.temp/`) para o worktree equivalente antes de executar db push
- **Files modified:** supabase/.temp/ (runtime — não versionado, não commitado)
- **Verification:** `supabase migration list --linked` listou as 3 migrations corretamente; db push aplicou 0003 com sucesso
- **Committed in:** Não commitado — .temp/ não é versionado (correto)

---

**Total deviações:** 1 auto-corrigida (1 Rule 3 — bloqueante)
**Impacto no plano:** Correção necessária para aplicar a migration ao banco remoto. Sem impacto no código entregue.

## Issues Encountered

- `.supabase/` link não existe no worktree — o worktree compartilha código mas não o estado do CLI do Supabase. Resolvido copiando `supabase/.temp/` do repo principal antes do db push.

## User Setup Required

**Configurações externas necessárias (não automatizáveis).** O plano marca `autonomous: false` por conta destas ações manuais nos dashboards externos:

### 1. Resend — Verificar domínio mail.soprodaorigem.com

1. Acesse `resend.com/domains` → "Add Domain" → inserir `mail.soprodaorigem.com`
2. O Resend fornecerá registros SPF TXT e DKIM TXT
3. Adicionar esses registros DNS no painel Hostinger (DNS Zone Editor para `mail.soprodaorigem.com`)
4. Aguardar propagação (5–30 min) → clicar "Verify" no Resend

### 2. Supabase — Configurar SMTP custom (Resend)

No Supabase Dashboard > Project `owgbrllpznsngrkvodyw` > Authentication > Email > SMTP Settings:

```
Enable custom SMTP: ON
Host:     smtp.resend.com
Port:     465
Username: resend
Password: [valor de RESEND_API_KEY]
Sender name:  Aurel Iris
Sender email: noreply@mail.soprodaorigem.com
```

### 3. Supabase — Customizar template do magic link

Supabase Dashboard > Authentication > Email Templates > Magic Link:
- **Subject:** `Seu acesso ao Aurel Iris`
- **Body:** HTML pt-BR com botão "Entrar no Aurel Iris" e href `{{ .ConfirmationURL }}` (template completo em `02-RESEARCH.md` seção "Template de Magic Link")

### 4. Supabase — Registrar Redirect URLs

Supabase Dashboard > Authentication > URL Configuration:
- **Site URL:** `https://aurel-iris-web.vercel.app`
- **Redirect URLs:** adicionar:
  - `https://aurel-iris-web.vercel.app/api/auth/callback`
  - `http://localhost:3000/api/auth/callback`

### 5. Vercel — Adicionar NEXT_PUBLIC_SITE_URL

Vercel > Project `aurel-iris-web` > Settings > Environment Variables:
- `NEXT_PUBLIC_SITE_URL` = `https://aurel-iris-web.vercel.app` (Production + Preview + Development)

## Checkpoint: Human Verify

**Status:** Aguardando configuração manual dos dashboards externos (user_setup acima).

Os 3 tasks automáticos foram concluídos e commitados. A infraestrutura de auth está pronta no código:
- Clientes Supabase criados e tipados
- Middleware protegendo rotas
- Callback PKCE funcional
- Trigger no banco criando profiles com trial

O magic link end-to-end só funcionará em produção após completar os passos de user_setup acima (especialmente o SMTP Resend e o registro de Redirect URLs no Supabase).

**Em desenvolvimento local:** O Supabase tem SMTP built-in (limite: 4 emails/hora) que permite testar o fluxo sem o Resend configurado. O magic link pode ser testado via Supabase Dashboard > Authentication > Users > "Send magic link".

## Next Phase Readiness

- **02-02 (Auth Pages):** Pronto para iniciar — lib/supabase/ e middleware.ts estão disponíveis
- **02-03 (Dashboard Layout):** Pronto para iniciar em paralelo com 02-02
- **Bloqueador para AUTH-01 em produção:** SMTP Resend + DNS verificado + Redirect URLs cadastrados

---
*Phase: 02-auth-dashboard-basico*
*Completed: 2026-05-01*

## Self-Check: PASSED

- All 7 created files found on disk
- All 3 task commits verified in git log (ac5f7eb, 29b12d7, d318cf3)
- SUMMARY.md created at expected path
