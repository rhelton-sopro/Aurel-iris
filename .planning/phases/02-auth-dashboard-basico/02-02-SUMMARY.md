---
phase: 02-auth-dashboard-basico
plan: "02"
subsystem: auth
tags: [nextjs, shadcn, react-hook-form, zod, supabase-auth, magic-link, lgpd]

# Dependency graph
requires:
  - phase: 02-01
    provides: apps/web/lib/supabase/client.ts (createClient browser), middleware.ts (auth guard), /api/auth/callback (PKCE)
provides:
  - Route group (auth) com layout minimal e footer LGPD obrigatorio
  - /signup: formulario email + full_name, shouldCreateUser true, confirmation state
  - /login: formulario email, shouldCreateUser false, confirmation state, Suspense wrapper
  - shadcn components instalados: input, label, card (via CLI), form (manual base-nova)
  - react-hook-form 7.74.0 + zod 4.4.1 + @hookform/resolvers 5.2.2
affects:
  - 02-03 (dashboard layout usa mesma estrutura de route group)
  - 02-04 (CRUD clientes usa form.tsx e Input/Card/Label instalados aqui)

# Tech tracking
tech-stack:
  added:
    - react-hook-form@7.74.0
    - zod@4.4.1
    - "@hookform/resolvers@5.2.2"
    - shadcn input, label, card (via pnpm dlx shadcn)
    - form.tsx criado manualmente (base-nova nao gera via CLI)
  patterns:
    - Magic link flow via signInWithOtp com shouldCreateUser diferenciado (signup vs login)
    - Confirmation state substitui formulario apos envio (sem redirect)
    - Zod v4 API: .min(1, msg) em vez de required_error nas schemas
    - FormControl usa React.cloneElement para propagar id/aria-* para filho unico
    - Login page extrai useSearchParams para componente separado wrapped em Suspense

key-files:
  created:
    - apps/web/app/(auth)/layout.tsx
    - apps/web/app/(auth)/signup/page.tsx
    - apps/web/app/(auth)/login/page.tsx
    - apps/web/components/ui/input.tsx
    - apps/web/components/ui/label.tsx
    - apps/web/components/ui/card.tsx
    - apps/web/components/ui/form.tsx
  modified:
    - apps/web/package.json (react-hook-form, zod, @hookform/resolvers adicionados)
    - pnpm-lock.yaml

key-decisions:
  - "form.tsx criado manualmente: shadcn@4.6.0 base-nova retorna registry item vazio para 'form' — sem arquivos gerados via CLI"
  - "toast depreciado no shadcn 4.6.0 — nao instalado neste plan; substituir por sonner quando necessario em plans futuros"
  - "Login page extrai LoginForm com useSearchParams para componente filho wrapped em Suspense — evita build error de SSR no Next.js 15"
  - "FormControl usa React.cloneElement para propagar id/aria-* diretamente ao input filho em vez de wrapper div — mantém associacao label-input correta"

patterns-established:
  - "Pattern auth: signInWithOtp com shouldCreateUser: true em /signup, false em /login (T-02-04)"
  - "Pattern confirmation: setSent(true) + setSentEmail substitui formulario (sem redirect, sem double-submit)"
  - "Pattern error-state: div bg-destructive/10 border-destructive no topo do form para erros de nivel de formulario"
  - "Pattern Zod v4: z.string().min(1, 'msg') em todos os campos obrigatorios"

requirements-completed: [AUTH-01, AUTH-02]

# Metrics
duration: 22min
completed: 2026-05-01
---

# Phase 2 Plan 02: Auth Pages Summary

**Paginas /signup e /login com magic link Supabase, formularios react-hook-form + Zod v4, confirmation state apos envio, layout (auth) com footer LGPD obrigatorio, e shadcn components base-nova instalados**

## Performance

- **Duration:** 22 min
- **Started:** 2026-05-01T11:40:00Z
- **Completed:** 2026-05-01T12:02:22Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Route group `(auth)` com layout minimal centralizado e footer LGPD: "Ferramenta de apoio a anamnese terapeutica integrativa, nao substitui avaliacao medica."
- `/signup` com campo email + full_name, `shouldCreateUser: true`, confirmation state com MailCheck icon apos envio bem-sucedido
- `/login` com campo email, `shouldCreateUser: false` (mitiga T-02-04 — nao cria contas acidentais), tratamento de erro "nao encontramos conta", Suspense wrapper para useSearchParams
- shadcn components instalados: `input`, `label`, `card` via CLI; `form.tsx` criado manualmente (CLI retorna vazio para base-nova)
- react-hook-form 7.74.0 + zod 4.4.1 + @hookform/resolvers 5.2.2 adicionados como dependencias de producao

## Task Commits

1. **Task 1: shadcn components + (auth)/layout.tsx** - `0cf750b` (feat)
2. **Task 2: signup/page.tsx e login/page.tsx** - `b4d0305` (feat)

## Files Created/Modified

- `apps/web/app/(auth)/layout.tsx` — layout minimal de auth com footer LGPD obrigatorio (Server Component)
- `apps/web/app/(auth)/signup/page.tsx` — pagina de cadastro com magic link, shouldCreateUser: true
- `apps/web/app/(auth)/login/page.tsx` — pagina de login com magic link, shouldCreateUser: false, Suspense
- `apps/web/components/ui/form.tsx` — componente Form shadcn criado manualmente com react-hook-form integration
- `apps/web/components/ui/input.tsx` — instalado via shadcn CLI (base-nova, @base-ui/react)
- `apps/web/components/ui/label.tsx` — instalado via shadcn CLI
- `apps/web/components/ui/card.tsx` — instalado via shadcn CLI
- `apps/web/package.json` — react-hook-form, zod, @hookform/resolvers adicionados
- `pnpm-lock.yaml` — lockfile atualizado

## Decisions Made

- **form.tsx manual:** shadcn@4.6.0 com style base-nova retorna registry item sem arquivos para o componente `form` — comportamento confirmado via `pnpm dlx shadcn view form`. Criado manualmente seguindo o padrao shadcn/react-hook-form.
- **toast nao instalado:** componente depreciado no shadcn 4.6.0 (mensagem de erro: "The toast component is deprecated. Use the sonner component instead."). Nenhum uso de toast neste plan — diferido para instalacao quando necessario em plans futuros.
- **Suspense em login/page.tsx:** Next.js 15 App Router requer Suspense para componentes com useSearchParams em SSR. `LoginForm` extraido como subcomponente wrapped em `<Suspense>` na `LoginPage` exportada. Build prod estatico confirmado.
- **FormControl via cloneElement:** Base-nova usa `@base-ui/react/input` sem Radix Slot. FormControl propaga `id`/`aria-*` diretamente ao filho via `React.cloneElement` para manter associacao correta label-input. TypeScript satisfeito com cast `React.ReactElement<Record<string, unknown>>`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FormControl ajustado para propagar id diretamente ao input**
- **Found during:** Task 2 (criacao das paginas de auth com shadcn Form)
- **Issue:** FormControl original usava wrapper `<div id={formItemId}>` — label apontava para o div, nao para o input (quebra acessibilidade label-input)
- **Fix:** Refatorado para usar `React.cloneElement` passando `id`, `aria-describedby`, `aria-invalid` diretamente ao filho unico
- **Files modified:** apps/web/components/ui/form.tsx
- **Verification:** TypeScript limpo, build prod passou, label aponta para input correto
- **Committed in:** b4d0305 (Task 2 commit)

**2. [Rule 1 - Bug] Suspense wrapper para useSearchParams em login/page.tsx**
- **Found during:** Task 2 — nota no plano + prevencao proativa
- **Issue:** Next.js 15 nao permite useSearchParams fora de Suspense em paginas estaticas (build error potencial)
- **Fix:** LoginForm extraido como componente cliente separado; LoginPage exporta Suspense wrapper — build prod confirma /login gerado como static (○)
- **Files modified:** apps/web/app/(auth)/login/page.tsx
- **Verification:** Build prod: `○ /login` (Static) — sem erros
- **Committed in:** b4d0305 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2x Rule 1 — bug fix/prevencao)
**Impact on plan:** Ambos necessarios para corretude e acessibilidade. Sem escopo extra.

## Issues Encountered

- **shadcn add form CLI silencioso:** `pnpm dlx shadcn@4.6.0 add form` retorna exit 0 sem criar arquivos (comportamento confirmado com `--overwrite`, sem flags). Resolvido criando form.tsx manualmente baseado no padrao shadcn/react-hook-form.
- **shadcn toast depreciado:** `pnpm dlx shadcn add toast` retorna exit 1 com mensagem de deprecacao. Componente nao e necessario neste plan — diferido.

## Known Stubs

Nenhum. Todas as funcionalidades entregues sao funcionais:
- Formularios submetem via Supabase Auth (nao mock)
- Confirmation state exibe email real enviado
- Erros do Supabase sao tratados e exibidos

## Threat Flags

Nenhuma superficie nova alem do plano. Boundaries cobertos pelo threat model do plan:
- T-02-04 (shouldCreateUser: false em /login): implementado
- T-02-07 (vocabulario proibido ausente): verificado — zero ocorrencias

## User Setup Required

None - nenhuma configuracao externa necessaria para este plan. As variaveis `NEXT_PUBLIC_SITE_URL` e credenciais Supabase foram configuradas no plan 02-01.

## Next Phase Readiness

- Route group `(auth)` completo com layout + 2 paginas funcionais
- shadcn form components disponiveis para plans 02-03 (dashboard) e 02-04 (CRUD clientes)
- Build prod limpo: /login e /signup estaticos, /api/auth/callback dinamico
- Proxima wave: 02-03 (dashboard layout com sidebar + header)

---
*Phase: 02-auth-dashboard-basico*
*Completed: 2026-05-01*
