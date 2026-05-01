---
plan_id: 03-02
phase: 3
phase_slug: captura-mobile-pwa
subsystem: pwa/infra
tags: [pwa, serwist, service-worker, manifest, hooks, vitest]
dependency_graph:
  requires: [03-01]
  provides:
    - manifest.webmanifest válido via app/manifest.ts
    - Service Worker gerado em public/sw.js via Serwist
    - 3 ícones PWA placeholder (192/512/maskable) em public/icons/
    - hook usePWAInstall (beforeinstallprompt + standalone detection + iOS detection)
    - viewport com viewportFit=cover + appleWebApp metadata no layout root
  affects:
    - apps/web/package.json (novas deps @serwist/next, serwist, sharp)
    - apps/web/next.config.ts (wrap withSerwistInit)
    - apps/web/app/layout.tsx (viewport export + appleWebApp metadata)
    - apps/web/tsconfig.json (exclusão de app/sw.ts)
    - apps/web/eslint.config.mjs (ignorar public/sw.js e public/swe-worker-*.js)
tech_stack:
  added:
    - "@serwist/next@9.5.10"
    - "serwist@9.5.10 (devDep)"
    - "sharp@0.34.5 (devDep — geração de ícones)"
  patterns:
    - Next.js metadata route app/manifest.ts para /manifest.webmanifest
    - Serwist withSerwistInit wrap em next.config.ts com disable em development
    - app/sw.ts excluído do tsconfig.json (ServiceWorkerGlobalScope requer lib webworker incompatível com dom)
    - hook usePWAInstall com beforeinstallprompt (Android Chrome) + matchMedia standalone + iOS UA detection
key_files:
  created:
    - apps/web/app/manifest.ts
    - apps/web/app/sw.ts
    - apps/web/public/icons/icon-192.png
    - apps/web/public/icons/icon-512.png
    - apps/web/public/icons/icon-maskable.png
    - apps/web/scripts/generate-icons.mjs
    - apps/web/hooks/use-pwa-install.ts
    - apps/web/hooks/use-pwa-install.test.ts
  modified:
    - apps/web/next.config.ts (withSerwistInit wrap)
    - apps/web/app/layout.tsx (viewport export + appleWebApp metadata)
    - apps/web/package.json (novas deps)
    - apps/web/tsconfig.json (excluir app/sw.ts)
    - apps/web/eslint.config.mjs (ignorar artefatos Serwist)
    - pnpm-lock.yaml
decisions:
  - "app/sw.ts excluído do tsconfig.json: ServiceWorkerGlobalScope não existe na lib 'dom'; Serwist compila o SW via webpack separadamente — exclusão do tsconfig é o padrão correto para sw.ts"
  - "sharp@0.34.5 adicionado como devDep para geração de ícones via Node script (pwa-asset-generator exige acesso à internet não garantido); script removível em Fase 9 quando identidade visual final substituir os placeholders"
  - "eslint.config.mjs: public/sw.js e public/swe-worker-*.js adicionados aos ignores — são build artifacts do Serwist, não código-fonte; linting gerava 87 erros/warnings em código minificado de terceiros"
metrics:
  duration: "~5 min"
  completed_date: "2026-05-01"
  tasks_completed: 2
  tasks_total: 3
  checkpoint_reached: "Task 3 (checkpoint:human-verify)"
  files_created: 8
  files_modified: 6
---

# Phase 3 Plan 02: PWA Shell — Serwist SW + manifest + ícones + usePWAInstall Summary

**One-liner:** PWA shell completo com Serwist 9.5.10 gerando public/sw.js (44KB) em produção, manifest.webmanifest válido (display=standalone, lang=pt-BR, 3 ícones), ícones placeholder "AI over black" via sharp, viewport com viewportFit=cover, e hook usePWAInstall (beforeinstallprompt Android + standalone matchMedia + iOS UA detection) com 5 testes vitest verdes.

## Status

**PARCIAL — checkpoint:human-verify atingido após Task 2.**

Tasks 1 e 2 concluídas e commitadas. Task 3 requer verificação em device físico (Chrome DevTools Lighthouse + iPhone real + Android real) e está aguardando execução manual.

## O que foi entregue

### Task 1 — PWA shell (manifest, SW, ícones, next.config, layout)

1. **`@serwist/next@9.5.10`** instalado como dependency; **`serwist@9.5.10`** como devDependency.
2. **`apps/web/app/manifest.ts`** — rota Next.js que serve `/manifest.webmanifest`:
   - `display: 'standalone'`, `start_url: '/dashboard'`, `lang: 'pt-BR'`
   - `theme_color: '#000000'`, `background_color: '#ffffff'`
   - 3 ícones: `icon-192.png`, `icon-512.png`, `icon-maskable.png`
3. **`apps/web/app/sw.ts`** — source do Service Worker com `new Serwist({ skipWaiting: true, clientsClaim: true, navigationPreload: true, runtimeCaching: defaultCache })`.
4. **`apps/web/next.config.ts`** — wrap `withSerwistInit({ swSrc: 'app/sw.ts', swDest: 'public/sw.js', disable: process.env.NODE_ENV === 'development' })`.
5. **`apps/web/app/layout.tsx`** — adicionado `appleWebApp` + `applicationName` ao metadata; exportado `viewport: Viewport` com `viewportFit: 'cover'` + `themeColor: '#000000'`.
6. **3 ícones placeholder** gerados via `scripts/generate-icons.mjs` (sharp): texto "AI" branco sobre `#000`.
7. **Build de produção verde** — `pnpm run build` exit 0; `/manifest.webmanifest` rota visível; `public/sw.js` gerado (44.232 bytes).

### Task 2 — hook usePWAInstall

1. **`apps/web/hooks/use-pwa-install.ts`** — hook `'use client'` com:
   - `isStandalone`: `matchMedia('(display-mode: standalone)')` + `navigator.standalone` (iOS legacy)
   - `isIOS`: `/iPad|iPhone|iPod/.test(ua)` com guard `!MSStream`
   - `canPromptAndroid`: `installEvent !== null` (captura `beforeinstallprompt`)
   - `promptInstall()`: dispara `installEvent.prompt()`, aguarda `userChoice`, retorna `outcome === 'accepted'`
   - Cleanup explícito: 3 `removeEventListener` (matchMedia change, beforeinstallprompt, appinstalled)
2. **`apps/web/hooks/use-pwa-install.test.ts`** — 5 cenários vitest: iOS UA detection, isStandalone false, canPromptAndroid false, captura de beforeinstallprompt, promptInstall retorna false sem evento.
3. **`pnpm run test:run`** — 5/5 passando.
4. **`pnpm run lint`** — exit 0 (1 warning pré-existente em api/health/db/route.ts, fora do escopo).
5. **`pnpm run audit:vocabulary`** — "OK: vocabulário proibido ausente".

## Versões instaladas

| Pacote | Versão |
|--------|--------|
| @serwist/next | 9.5.10 |
| serwist | 9.5.10 |
| sharp | 0.34.5 (devDep — geração de ícones) |

## Artefatos

| Artefato | Tamanho |
|----------|---------|
| public/sw.js (gerado por Serwist no build) | 44.232 bytes |
| public/icons/icon-192.png | 2.929 bytes |
| public/icons/icon-512.png | 11.519 bytes |
| public/icons/icon-maskable.png | 10.278 bytes |

## Commits

| Task | Commit | Descrição |
|------|--------|-----------|
| 1 — PWA shell | 723085a | feat(03-02): PWA shell — Serwist SW, manifest, ícones placeholder, layout viewport |
| 2 — hook usePWAInstall | 48c9e62 | feat(03-02): hook usePWAInstall — beforeinstallprompt + standalone detection + tests |

## Verificação Pendente (Task 3 — checkpoint:human-verify)

Para completar o plan 03-02, o terapeuta/dev precisa:

**Desktop (Chrome DevTools):**
1. `cd apps/web && pnpm run build && pnpm run start`
2. Abrir http://localhost:3000 no Chrome
3. DevTools → Application → Manifest: verificar nome, start_url, display=standalone, 3 ícones
4. DevTools → Application → Service Workers: status "activated and is running", source = sw.js
5. Lighthouse → PWA audit: "Installable" deve ser PASS

**iPhone real (Safari):**
6. Abrir URL deployada no Safari iOS
7. Toque em ⎙ (compartilhar) → "Adicionar à Tela de Início"
8. Verificar ícone na home screen com nome "Aurel Iris"
9. Abrir em standalone (sem barra Safari); safe-area respeitada

**Android real (Chrome):**
10. Abrir URL no Chrome Android
11. Verificar prompt automático "Instalar app" ou menu Chrome → "Instalar app"
12. Após instalar: standalone funcional

Reportar OK + screenshots iOS e Android, ou listar issues.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript error: ServiceWorkerGlobalScope não encontrado em app/sw.ts**
- **Found during:** Task 1 — primeiro `pnpm run build`
- **Issue:** `declare const self: ServiceWorkerGlobalScope` falhou com `Cannot find name 'ServiceWorkerGlobalScope'. Did you mean 'WorkerGlobalScope'?`. O tsconfig usa `lib: ["dom", "dom.iterable", "esnext"]` — `ServiceWorkerGlobalScope` requer lib `"webworker"`, que conflita com `"dom"` (tipos duplicados/incompatíveis).
- **Fix:** Adicionar `app/sw.ts` à lista `exclude` do `tsconfig.json`. Serwist compila `sw.ts` via webpack separadamente (não pelo compilador TypeScript do Next.js); excluir é o padrão recomendado pela Serwist para projetos Next.js.
- **Files modified:** `apps/web/tsconfig.json`
- **Commit:** 723085a

**2. [Rule 3 - Blocking] ESLint falhando em public/sw.js (build artifact)**
- **Found during:** Task 2 — `pnpm run lint`
- **Issue:** `public/sw.js` (gerado pelo Serwist no build) estava sendo lintado pelo ESLint. O arquivo minificado continha 87 erros/warnings (`@typescript-eslint/no-this-alias`, `no-unused-expressions`, etc.) — código legítimo de terceiros dentro do bundle. ESLint retornava exit 1.
- **Fix:** Adicionar `"public/sw.js"` e `"public/swe-worker-*.js"` aos `ignores` em `eslint.config.mjs`. Esses são artefatos de build, não código-fonte do projeto.
- **Files modified:** `apps/web/eslint.config.mjs`
- **Commit:** 48c9e62

## Known Stubs

- `apps/web/public/icons/icon-*.png` — ícones placeholder com texto "AI" sobre fundo preto. **Identidade visual final é Fase 9 (deferred)** — ícones são intencionalmente provisórios e estão documentados como tal.
- `apps/web/hooks/use-pwa-install.ts` — hook criado e testado, mas ainda não consumido por nenhum componente. `PWAInstallBanner` (que consome este hook) é entregue em plan 03-08.

## Threat Flags

Nenhum surface novo além do planejado no threat model do plan (T-03-02-01, T-03-02-02, T-03-02-03).

Mitigações implementadas:
- **T-03-02-01:** SW usa apenas `defaultCache` (navigation-preload only) — sem `runtimeCaching` customizado para rotas autenticadas. Cache offline rico deferido para Fase 9.
- **T-03-02-02:** `public/sw.js` gerado com sucesso pelo build (44KB, não 404 nem HTML). `.gitignore` já exclui este artefato (adicionado em 03-01).
- **T-03-02-03:** `start_url=/dashboard` — middleware da Fase 2 redireciona para `/login` se sem sessão. Aceito.

## Self-Check: PASSED

Arquivos criados verificados:
- apps/web/app/manifest.ts: FOUND
- apps/web/app/sw.ts: FOUND
- apps/web/public/icons/icon-192.png: FOUND (2929 bytes)
- apps/web/public/icons/icon-512.png: FOUND (11519 bytes)
- apps/web/public/icons/icon-maskable.png: FOUND (10278 bytes)
- apps/web/scripts/generate-icons.mjs: FOUND
- apps/web/hooks/use-pwa-install.ts: FOUND
- apps/web/hooks/use-pwa-install.test.ts: FOUND
- apps/web/public/sw.js: FOUND (44232 bytes — gerado pelo build)

Commits verificados:
- 723085a: FOUND (Task 1)
- 48c9e62: FOUND (Task 2)
