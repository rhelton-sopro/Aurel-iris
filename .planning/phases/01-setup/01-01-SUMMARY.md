---
phase: 01-setup
plan: 01
subsystem: infra

tags: [nextjs, tailwind, shadcn-ui, pnpm, monorepo, typescript, vercel]

requires: []
provides:
  - Monorepo root scaffolding (pnpm-workspace, package.json, .gitignore, .vercelignore, .nvmrc, README)
  - apps/web/ Next.js 15 (App Router, TypeScript, Tailwind v4, ESLint) funcional
  - shadcn/ui inicializado em apps/web/ (style base-nova, neutral baseColor, css variables)
  - cn() helper em @/lib/utils
  - apps/web/types/ placeholder pro database.ts (plan 1.4)
affects: [01-02-vision-service, 01-03-supabase, 01-04-supabase-link, 01-05-rls-test, 01-06-vercel-deploy, 02-auth, 03-clients]

tech-stack:
  added:
    - "next@15.5.15 (App Router, React 19.1)"
    - "tailwindcss@4.2.4 + @tailwindcss/postcss"
    - "shadcn/ui (CLI v4.6, style base-nova)"
    - "lucide-react, class-variance-authority, clsx, tailwind-merge, tw-animate-css"
    - "eslint@9 + eslint-config-next@15.5.15"
    - "typescript@5.9"
  patterns:
    - "Monorepo pnpm com apps/* (workspace formal desde já)"
    - "Root scripts delegam via pnpm --filter web (dev/build/start/lint/type-check)"
    - "Vocabulario LGPD compliant desde o primeiro commit (audit grep no CI futuro)"
    - "Tailwind v4 inline config (sem tailwind.config.ts)"

key-files:
  created:
    - .nvmrc
    - .gitignore
    - .vercelignore
    - package.json
    - pnpm-workspace.yaml
    - README.md
    - pnpm-lock.yaml
    - apps/web/package.json
    - apps/web/tsconfig.json
    - apps/web/next.config.ts
    - apps/web/postcss.config.mjs
    - apps/web/eslint.config.mjs
    - apps/web/components.json
    - apps/web/app/layout.tsx
    - apps/web/app/page.tsx
    - apps/web/app/globals.css
    - apps/web/lib/utils.ts
    - apps/web/components/ui/button.tsx
    - apps/web/types/.gitkeep
  modified: []

key-decisions:
  - "pnpm 10.33 em packageManager (env tem pnpm 10.33; plan dizia 9.12 mas corepack precisa match com instalacao real)"
  - "Next 15.5.15 (pinned via create-next-app@15) em vez de @latest que ja resolve para 16.x"
  - "Tailwind v4 sem tailwind.config.ts (config inline via @tailwindcss/postcss; plan listava arquivo mas v4 dispensa)"
  - "shadcn init com --defaults --no-monorepo (CLI v4 nao aceita --base-color; preset base-nova ja vem com neutral baseColor)"
  - "pnpm-workspace.yaml criado agora apesar de Deferred Idea no CONTEXT (trivial agora, evita refator depois — plan ja autorizava)"
  - "app/layout.tsx atualizado: title 'Aurel Iris', lang pt-BR (boilerplate dizia 'Create Next App' / lang en)"
  - "gen:types script adicionado como stub falhando intencionalmente (plan 1.4 substitui — D-09)"

patterns-established:
  - "Vocabulario proibido: zero ocorrencias de diagnostico/tratamento/cura em apps/web/{app,components,lib} desde commit 1"
  - "Layout monorepo D-01: apps/web/ contem Next.js, vision-service/ e supabase/ excluidos do bundle Vercel"
  - "Node 20+ travado via .nvmrc (D-04)"

requirements-completed: [SETUP-01]

duration: ~12min
completed: 2026-04-30
---

# Phase 1 Plan 01: Monorepo + Next.js 15 + shadcn/ui Setup Summary

**Monorepo pnpm com apps/web rodando Next.js 15.5.15 + Tailwind v4 + shadcn/ui (style base-nova), home pt-BR LGPD-compliant, build prod passando.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-30T~21:43Z (apos leitura de PLAN/PROJECT/STATE/CONTEXT)
- **Completed:** 2026-05-01T00:55:44Z
- **Tasks:** 2 (ambas auto)
- **Files committed:** 27 (6 root + 21 apps/web)

## Accomplishments

- Repo monorepo bootado com convencoes pnpm/Vercel/Node alinhadas a D-01..D-04
- `apps/web/` rodando Next 15.5.15 com App Router, TS, Tailwind v4, ESLint flat config
- shadcn/ui inicializado (components.json, lib/utils.ts com `cn()`, components/ui/button.tsx) — base para Fase 2 UI
- Home pt-BR LGPD-compliant ("Ferramenta de apoio à anamnese terapêutica integrativa. Não substitui avaliação médica.") substitui boilerplate do create-next-app
- `pnpm dev` (root) levanta o app em http://localhost:3000 com HTTP 200; HTML contem "Aurel Iris" e "apoio à anamnese"
- `pnpm exec next build` em apps/web passa sem erro (5 paginas estaticas, 102 kB First Load JS)
- `pnpm exec tsc --noEmit` em apps/web retorna 0 erros
- Auditoria de vocabulario: zero ocorrencias de "diagnostico"/"tratamento"/"cura" em apps/web/{app,components,lib,types}

## Task Commits

1. **Task 1: Inicializar root scaffolding monorepo** — `a54b77d` (feat)
   - Files: `.nvmrc`, `.gitignore`, `.vercelignore`, `package.json`, `pnpm-workspace.yaml`, `README.md`

2. **Task 2: Scaffold Next.js 15 + Tailwind + shadcn/ui em apps/web/** — `dbcfc34` (feat)
   - Files: 21 sob `apps/web/` + `pnpm-lock.yaml`
   - Comandos canônicos:
     - `pnpm dlx create-next-app@15 apps/web --typescript --tailwind --eslint --app --no-src-dir --no-turbopack --import-alias "@/*" --use-pnpm --skip-install`
     - `cd apps/web && pnpm install`
     - `cd apps/web && pnpm dlx shadcn@latest init --yes --defaults --no-monorepo`

**Plan metadata commit:** será criado pelo orquestrador (per `<sequential_execution>` do prompt).

## Files Created/Modified

### Root (Task 1)
- `.nvmrc` — Node 20 (D-04)
- `.gitignore` — node_modules/.next/.vercel/.env.local/__pycache__/supabase artifacts
- `.vercelignore` — vision-service/ + supabase/ (D-01: Vercel nao deploy esses subdirs)
- `package.json` — root pnpm com scripts dev/build/start/lint/type-check delegando via --filter web
- `pnpm-workspace.yaml` — workspaces formais (apps/*)
- `README.md` — pt-BR com vocabulario "apoio a anamnese"

### apps/web/ (Task 2)
- `apps/web/package.json` — Next 15.5.15, React 19.1, Tailwind v4, shadcn deps
- `apps/web/tsconfig.json` — strict, paths `@/*`
- `apps/web/next.config.ts` — defaults (sem custom config no MVP)
- `apps/web/postcss.config.mjs` — `@tailwindcss/postcss` (Tailwind v4 inline)
- `apps/web/eslint.config.mjs` — flat config Next 15
- `apps/web/components.json` — shadcn config (base-nova, neutral, css variables)
- `apps/web/app/layout.tsx` — metadata pt-BR, lang="pt-BR", Geist fonts
- `apps/web/app/page.tsx` — landing minimalista pt-BR (Aurel Iris + apoio à anamnese + nao substitui avaliacao medica)
- `apps/web/app/globals.css` — tailwind v4 + shadcn css variables (gerado por shadcn init)
- `apps/web/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `apps/web/components/ui/button.tsx` — primeiro componente shadcn (gerado por init)
- `apps/web/types/.gitkeep` — placeholder pro database.ts (plan 1.4)
- `apps/web/.gitignore` — defaults do create-next-app
- `apps/web/public/*` — assets default (next.svg, vercel.svg, file/globe/window.svg)

### Lockfile
- `pnpm-lock.yaml` — versionado (D-03)

## Decisions Made

1. **pnpm 10.33 em packageManager** — env tem pnpm 10.33.2; plan especificava 9.12 mas Corepack/pnpm verifica match e falharia. Escolha de runtime override (Rule 3: blocking).
2. **create-next-app@15 em vez de @latest** — `@latest` agora resolve para 16.x. Plan diz "Next.js 15" e acceptance criterion exige 15.x. Pinning `@15` da o scaffold da major correta. Documentado como Rule 3 deviation (compatibilidade plan).
3. **shadcn init flags ajustadas** — CLI v4 nao tem `--base-color`; usei `--defaults --no-monorepo`. Preset `base-nova` ja vem com neutral baseColor + css variables. Equivalente semantico.
4. **Sem tailwind.config.ts** — Tailwind v4 usa configuracao inline via `@tailwindcss/postcss`. Plan listava `apps/web/tailwind.config.ts` em files_modified mas v4 nao precisa. Comportamento equivalente; documentado no commit.
5. **layout.tsx atualizado** — Boilerplate dizia `title: "Create Next App"` e `lang="en"`. Atualizei para `"Aurel Iris"` / `"pt-BR"` (Rule 2: vocabulario do produto + idioma pt-BR conforme PROJECT.md restrição operacional).
6. **pnpm-workspace.yaml criado agora** — Plan ja autorizava (mesmo sendo Deferred Idea no CONTEXT). Trivial agora, evita refator quando aparecer `packages/shared/`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] packageManager pin mismatch (pnpm 9.12 -> 10.33)**
- **Found during:** Task 1
- **Issue:** Plan template usa `"packageManager": "pnpm@9.12.0"` mas o ambiente tem pnpm 10.33.2. Corepack verifica match e falharia com `Cannot find matching keyid` ou similar.
- **Fix:** Atualizei para `"packageManager": "pnpm@10.33.2"` (versao instalada).
- **Files modified:** package.json (root)
- **Verification:** `pnpm install` rodou sem erro de version mismatch.
- **Committed in:** a54b77d

**2. [Rule 3 - Blocking] .gitignore precisava `.env.local` literal**
- **Found during:** Task 1 (verify automated)
- **Issue:** Acceptance criterion exigia substring literal `.env.local` em `.gitignore`. Template do plan tinha apenas `.env*.local` (que matcheia semanticamente mas grep -q falha pelo asterisk).
- **Fix:** Adicionada linha `.env.local` antes de `.env*.local` no .gitignore.
- **Files modified:** .gitignore
- **Verification:** `grep -q ".env.local" .gitignore` retorna 0.
- **Committed in:** a54b77d

**3. [Rule 3 - Blocking] create-next-app@latest instalou Next 16.2.4 em vez de Next 15.x**
- **Found during:** Task 2 (primeira tentativa de scaffolding)
- **Issue:** Plan acceptance criterion exige "versão 15.x". `@latest` ja resolve para 16.2.4 (cutoff).
- **Fix:** Removi apps/web e re-scaffoldei com `pnpm dlx create-next-app@15 apps/web ...`. Resultado: Next 15.5.15 + react 19.1 + eslint-config-next 15.5.15 (cohesivo).
- **Files modified:** apps/web/* (re-criado)
- **Verification:** `grep '"next":' apps/web/package.json` mostra `15.5.15`.
- **Committed in:** dbcfc34

**4. [Rule 3 - Blocking] shadcn CLI v4 nao aceita --base-color**
- **Found during:** Task 2 (shadcn init)
- **Issue:** Plan usa `pnpm dlx shadcn@latest init --yes --base-color slate --css-variables`. CLI v4 da `error: unknown option '--base-color'`. Flags sao agora `-b/--base radix|base` e `-d/--defaults`.
- **Fix:** Usei `pnpm dlx shadcn@latest init --yes --defaults --no-monorepo`. Preset default `base-nova` ja inclui neutral baseColor + css variables.
- **Files modified:** apps/web/components.json (gerado pelo CLI), apps/web/lib/utils.ts, apps/web/components/ui/button.tsx, apps/web/app/globals.css, apps/web/package.json (deps shadcn add)
- **Verification:** `cat components.json` mostra `"style": "base-nova"`, `"baseColor": "neutral"`, `"cssVariables": true`. `lib/utils.ts` exporta `cn`.
- **Committed in:** dbcfc34

**5. [Rule 2 - Missing critical] Boilerplate metadata em ingles**
- **Found during:** Task 2 (apos shadcn init)
- **Issue:** `app/layout.tsx` ainda tinha `title: "Create Next App"`, `description: "Generated by create next app"`, `lang="en"`. PROJECT.md restricao operacional exige idioma do produto pt-BR.
- **Fix:** Atualizei metadata para `title: "Aurel Iris"`, `description: "Ferramenta de apoio à anamnese terapêutica integrativa."`, `lang="pt-BR"`.
- **Files modified:** apps/web/app/layout.tsx
- **Verification:** vocabulario clean + grep "Aurel Iris" hits.
- **Committed in:** dbcfc34

**6. [Rule 3 - Blocking] tailwind.config.ts nao foi gerado (Tailwind v4)**
- **Found during:** Task 2 (apos create-next-app)
- **Issue:** Plan listava `apps/web/tailwind.config.ts` em `files_modified`. Tailwind v4 (que veio com create-next-app@15) usa configuracao inline via `@tailwindcss/postcss` no `postcss.config.mjs` + diretivas `@theme` em `globals.css`. Nao gera `tailwind.config.ts`.
- **Fix:** Nenhum — comportamento de Tailwind v4 eh equivalente. Sem `tailwind.config.ts` o app builda + estiliza corretamente. Plan refletia Tailwind v3 (epoca em que tailwind.config era obrigatorio).
- **Files modified:** N/A (decisao de nao criar arquivo desnecessario)
- **Verification:** `pnpm exec next build` passa; classes Tailwind funcionam (verificadas em `pnpm dev`).
- **Documented in commit:** dbcfc34 (note no commit body)

---

**Total deviations:** 6 auto-fixed (5x Rule 3 blocking, 1x Rule 2 missing critical)
**Impact on plan:** Todas necessarias por evolucao do ecossistema (Next 16 lancado, Tailwind v4, shadcn CLI v4) + ambiente local (pnpm 10). Sem scope creep.

## Auth Gates Encountered

Nenhum (este plano nao toca em servicos externos com auth — Modal/Anthropic/Supabase entram a partir do plan 1.3).

## Issues Encountered

- Primeira tentativa do `create-next-app@latest` falhou com `application path is not writable` quando `apps/` ainda nao existia. Resolvido com `mkdir -p apps && rerun`. Documentado no flow.
- `shadcn init` reescreveu `app/page.tsx`/`app/layout.tsx`? Nao — verificado: shadcn so atualiza `app/globals.css` e cria `components.json`, `lib/utils.ts`, `components/ui/button.tsx`. `page.tsx` / `layout.tsx` foram manualmente atualizados depois.

## Next Phase Readiness

**Pronto para Wave 1 paralelo (plan 01-02 vision-service skeleton):**
- Layout monorepo D-01 firme: `apps/web/` ocupa o slot Next.js, `vision-service/` é subdir paralelo a criar.
- `.vercelignore` ja exclui `vision-service/` (Vercel nao tentara buildar Python).

**Pronto para Wave 2 (plan 01-03 Supabase init + plan 01-04 link + types):**
- `apps/web/types/.gitkeep` placeholder existe; `pnpm gen:types` script stub aguarda substituicao em plan 1.4.
- Lockfile versionado pra Vercel detectar pnpm.

**Sem blockers carregados pra fases seguintes.**

## Self-Check: PASSED

- [x] `.nvmrc` existe e contem `20`
- [x] `.gitignore` contem `node_modules/`, `.next/`, `.env.local`, `.vercel/`, `__pycache__/`, `supabase/.temp`
- [x] `.vercelignore` contem `vision-service/` e `supabase/`
- [x] `package.json` (root) contem `"name": "aurel-iris"`, `"private": true`, `"packageManager"`, `"engines": {"node": ">=20.0.0"}`, scripts dev/build/start/lint/type-check
- [x] `pnpm-workspace.yaml` contem `packages: - "apps/*"`
- [x] `README.md` menciona "apoio à anamnese" e nao contem "diagnostico"/"tratamento"/"cura"
- [x] `apps/web/app/` existe (App Router, sem src/)
- [x] `apps/web/package.json` contem `"next": "15.5.15"` e `"tailwindcss": "^4"`
- [x] `apps/web/tsconfig.json` tem paths `"@/*"`
- [x] `apps/web/components.json` tem `"style": "base-nova"`
- [x] `apps/web/lib/utils.ts` exporta `function cn`
- [x] `apps/web/app/page.tsx` contem "Aurel Iris" e "apoio à anamnese"
- [x] `pnpm exec tsc --noEmit` em apps/web returns 0
- [x] `pnpm exec next build` em apps/web passa
- [x] vocabulario clean (grep -riE 'diagn[óo]stico|tratamento|\bcura\b' apps/web/{app,components,lib} retorna 0 matches)
- [x] `apps/web/types/` existe (com `.gitkeep`)
- [x] `pnpm dev` (root) levanta apps/web em :3000 e responde 200; HTML contem "Aurel Iris" e "apoio à anamnese"
- [x] commits Task 1 (a54b77d) e Task 2 (dbcfc34) presentes em `git log`
- [x] STATE.md e ROADMAP.md NAO modificados (orquestrador faz isso)

---

*Phase: 01-setup*
*Plan: 01*
*Completed: 2026-04-30*
