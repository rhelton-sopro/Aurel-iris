---
plan_id: 03-04
phase: 3
phase_slug: captura-mobile-pwa
subsystem: frontend/capture
tags: [camera, getUserMedia, pwa, hooks, tdd, route-group, fullscreen, ios-safari]
dependency_graph:
  requires: [03-02, 03-03]
  provides:
    - "(capture) route group com layout fullscreen (sem sidebar, bg-black, min-h-100dvh)"
    - "CapturarPage server component com validacao RLS de readingId + guard de status"
    - "CaptureClient skeleton com header (cancelar D-13) + CameraView"
    - "useCamera hook (getUserMedia + error mapping + cleanup + iOS visibilitychange)"
    - "CameraView com overlay circular + estados visuais (idle/requesting/streaming/denied/error)"
    - "CameraDeniedScreen com instrucoes por SO + 2 CTAs (D-15)"
    - "shadcn alert component instalado"
  affects:
    - "apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx (atualizado para usar CameraView)"
tech_stack:
  added:
    - "shadcn alert (components/ui/alert.tsx)"
  patterns:
    - "TDD RED/GREEN para useCamera (vitest + @testing-library/react)"
    - "Route group (capture) separado de (dashboard) para fullscreen sem sidebar"
    - "getUserMedia com facingMode ideal environment (nao exact — compat desktop)"
    - "stream.getTracks().forEach(t => t.stop()) cleanup em unmount"
    - "visibilitychange listener para iOS Safari background tab quirk"
    - "classifyError mapeia error.name para CameraErrorType enum (sem expor error.message)"
key_files:
  created:
    - apps/web/app/(capture)/layout.tsx
    - apps/web/app/(capture)/leituras/nova/capturar/page.tsx
    - apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx
    - apps/web/hooks/use-camera.ts
    - apps/web/hooks/use-camera.test.ts
    - apps/web/components/capture/CameraView.tsx
    - apps/web/components/capture/CameraDeniedScreen.tsx
    - apps/web/components/capture/CameraDeniedScreen.test.tsx
    - apps/web/components/ui/alert.tsx
  modified: []
decisions:
  - "facingMode usa ideal (nao exact) para suporte a desktop + iPad sem OverconstrainedError"
  - "Auth guard duplicado no layout (alem do middleware) — defesa em profundidade padrao T-02-06"
  - "status != pending redireciona para /leituras (nao para /leituras/nova) — reading ja foi processado"
  - "capture-client integra CameraView diretamente (nao placeholder) ja no Task 3 deste plan"
metrics:
  duration: "~8 min"
  completed_date: "2026-05-01"
  tasks_completed: 3
  tasks_total: 4
  files_created: 9
  files_modified: 1
  checkpoint_reached: "Task 4 — human-verify (UAT mobile fisico obrigatoria)"
---

# Phase 3 Plan 04: Capture Route Group + useCamera + CameraView + CameraDeniedScreen Summary

**One-liner:** Route group `(capture)` fullscreen sem sidebar com validacao RLS de readingId, hook `useCamera` (getUserMedia + cleanup + iOS visibilitychange), `CameraView` com overlay circular, e `CameraDeniedScreen` (D-15) com instrucoes por SO e fallback para upload.

**Status:** PARCIAL — Tasks 1, 2, 3 completas. Task 4 (checkpoint:human-verify UAT mobile) aguardando verificacao manual em iPhone/Android real.

---

## O que foi entregue

### Task 1 — (capture) route group + layout + page + capture-client skeleton

**Commit:** `86c554c`

**Arquivos criados:**

1. **`apps/web/app/(capture)/layout.tsx`** — layout fullscreen sem sidebar:
   - `min-h-[100dvh] bg-black flex flex-col text-white`
   - Viewport metadata: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`
   - Auth guard `getUser()` em defesa em profundidade (alem do middleware)
   - `redirect('/login')` se nao autenticado

2. **`apps/web/app/(capture)/leituras/nova/capturar/page.tsx`** — server component:
   - Valida `readingId` via `supabase.from('readings').select(...).eq('id', readingId).single()` — RLS filtra ownership
   - `redirect('/leituras/nova')` se `readingId` ausente ou reading nao encontrado
   - `redirect('/leituras')` se `reading.status !== 'pending'` (reading ja processado)
   - Passa `readingId`, `therapistId`, `clientName`, `capturedSlots`, `resumeMode` para `CaptureClient`

3. **`apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx`** — client orchestrator:
   - Header com nome do cliente + icone X (cancelar → /leituras, preserva rascunho D-13)
   - Integra `<CameraView videoRef={videoRef} />` (atualizado apos Task 3)
   - Dev hint no rodape com reading ID

**Middleware check:** `/leituras/*` ja coberto pelo `PROTECTED_PATHS` em `middleware.ts` — sem modificacao necessaria.

**Build:** passou com rota `/leituras/nova/capturar` listada como `ƒ` (Dynamic).

---

### Task 2 — useCamera hook (TDD RED/GREEN)

**TDD RED** (commit `f0352be`): `use-camera.test.ts` criado com 7 testes — falhou como esperado (modulo nao existia).

**TDD GREEN** (commit `2796f65`): `use-camera.ts` implementado, 7/7 testes passando.

**Resultado dos testes vitest:**

```
✓ hooks/use-camera.test.ts (7 tests) 453ms
```

**Exportacoes do hook:**

| Export | Tipo | Descricao |
|--------|------|-----------|
| `useCamera` | Hook | `({ videoRef, autoStart? }) → UseCameraResult` |
| `UseCameraOptions` | Interface | `{ videoRef: RefObject<HTMLVideoElement|null>, autoStart?: boolean }` |
| `UseCameraResult` | Interface | `{ status, errorType, error, stream, start, stop }` |
| `CameraStatus` | Type | `idle | requesting | streaming | denied | error` |
| `CameraErrorType` | Type | `NotAllowed/NotFound/NotReadable/Overconstrained/Abort/Security/Unknown` |

**Comportamentos implementados:**

- Constraints: `facingMode: { ideal: 'environment' }` — NÃO `exact` (compat desktop sem OverconstrainedError)
- `autoStart=true` (default): chama `start()` no mount
- `start()` re-entrante: para stream anterior antes de pedir novo
- Cleanup em unmount: `stream.getTracks().forEach(t => t.stop())` + `videoRef.current.srcObject = null`
- iOS quirk: `visibilitychange` listener chama `play()` ao voltar para foreground (RESEARCH Pitfall 8)
- Error mapping: `NotAllowedError` → `status='denied'`; demais erros conhecidos → `status='error'`; nenhum `error.message` exposto na UI (T-03-04-04)

---

### Task 3 — CameraView + CameraDeniedScreen + alert shadcn

**Commit:** `67e366b`

1. **`apps/web/components/capture/CameraView.tsx`**:
   - `useCamera({ videoRef })` — herda status/errorType/start
   - `status=denied|error` → renderiza `<CameraDeniedScreen errorType={errorType} onRetry={start} />`
   - `<video playsInline muted autoPlay>` — atributos obrigatorios iOS Safari (T-03-04-03)
   - `status=idle|requesting` → overlay escuro com `Camera` icon pulsando + "Solicitando acesso a camera"
   - `status=streaming` → video visivel + overlay circular `border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]`

2. **`apps/web/components/capture/CameraDeniedScreen.tsx`** (D-15):
   - `CameraOff` icon `text-destructive` 64px
   - Heading por `errorType` via `HEADING` map (7 entradas)
   - Instrucoes especificas por SO (iOS Safari / Chrome Android / Chrome Desktop) via shadcn `Alert`
   - Botao "Tentar novamente" (primary, `h-12`) — chama `onRetry()`
   - Link "Continuar via upload no computador" (ghost, `h-12`) → `/leituras/nova/upload`

3. **`apps/web/components/ui/alert.tsx`** — instalado via `pnpm dlx shadcn add alert`.

4. **`apps/web/components/capture/CameraDeniedScreen.test.tsx`** — 5/5 testes passando.

**Resultado dos testes completos:**

```
✓ tests/smoke.test.ts (1 test)
✓ hooks/use-pwa-install.test.ts (5 tests)
✓ app/actions/readings.test.ts (5 tests)
✓ components/capture/CameraDeniedScreen.test.tsx (5 tests)
✓ hooks/use-camera.test.ts (7 tests)

Test Files  5 passed (5)
     Tests  23 passed (23)
```

---

### Task 4 — Checkpoint human-verify (NAO EXECUTADA)

Esta task requer UAT manual em device fisico (iPhone/Android). Nao pode ser automatizada.

**Verificacoes pendentes (executar manualmente):**

1. **Chrome desktop:** `/leituras/nova/capturar?reading=<uuid>` — sidebar ausente, video fullscreen, overlay circular, header X funcional
2. **Deny flow:** bloquear camera nas permissoes → CameraDeniedScreen com heading "Permissao da camera negada" + 2 CTAs
3. **iPhone Safari real:** camera traseira ativa (nao frontal), video visivel (playsInline funcionando), troca de aba retoma stream (visibilitychange), saida da rota apaga LED
4. **Android Chrome real:** idem iPhone
5. **Cleanup:** LED da camera apaga apos navegar para /leituras (clicar X)

---

## Commits

| Task | Commit | Descricao |
|------|--------|-----------|
| 1 — Route group | 86c554c | feat(03-04): (capture) route group + layout fullscreen + page server component + capture-client skeleton |
| 2 — TDD RED | f0352be | test(03-04): add failing tests for useCamera hook (RED) |
| 2 — TDD GREEN | 2796f65 | feat(03-04): implement useCamera hook — getUserMedia + error mapping + cleanup + iOS visibilitychange (GREEN) |
| 3 — Componentes | 67e366b | feat(03-04): CameraView + CameraDeniedScreen (D-15) + shadcn alert + integrate into capture-client |

---

## Deviations from Plan

### Auto-fixed Issues

Nenhum — plan executado exatamente como escrito, com uma adaptacao de scope:

**1. [Scope] capture-client integra CameraView no Task 3 (nao era obrigatorio pelo plano)**
- **Found during:** Task 3
- **Issue:** O plan dizia "capture-client renderiza CameraView" mas o Task 1 foi executado antes do CameraView existir (Task 3). O plano documentava isso como "skeleton sem CameraView e OK ate Task 3".
- **Fix:** Apos criar CameraView no Task 3, o capture-client.tsx foi imediatamente atualizado para integrar o componente real — eliminando o placeholder inline de video + overlay circular do capture-client e delegando tudo ao CameraView.
- **Resultado:** Sem duplicacao de codigo; CameraView e a unica fonte de verdade para camera + overlay.

---

## Verificacoes de segurança (threat model)

| Ameaca | Status |
|--------|--------|
| T-03-04-01: IDOR via readingId | Mitigado — RLS filtra ownership automaticamente; null → redirect /leituras/nova; status!=pending → redirect /leituras |
| T-03-04-02: Stream ativo apos navegacao | Mitigado — useCamera cleanup chama stop() que faz getTracks().forEach(t => t.stop()) + srcObject=null; 7 testes vitest validam incluindo unmount cleanup |
| T-03-04-03: iOS fullscreen native player | Mitigado — `<video playsInline muted autoPlay>` obrigatorios presentes; UAT iPhone real pendente (Task 4) |
| T-03-04-04: error.message exposto na UI | Mitigado — classifyError mapeia error.name para CameraErrorType enum; CameraDeniedScreen usa HEADING map com copy pt-BR conhecida; nenhum error.message exibido |

---

## Known Stubs

- `CaptureClient`: dev hint `"Reading {readingId.slice(0,8)} — captura ativa em fases seguintes"` visivel em producao ate state machine 03-06. Intencional — indica ao terapeuta que o skeleton esta ativo.
- `CaptureClient`: props `_capturedSlots`, `_resumeMode`, `_therapistId` prefixadas com `_` (nao usadas) — serao conectadas em 03-05/06 com a state machine de captura sequencial.

## Threat Flags

Nenhum surface novo alem do planejado no threat model do plan (T-03-04-01..04).

---

## Self-Check: PASSED

Arquivos criados verificados:
- apps/web/app/(capture)/layout.tsx: FOUND
- apps/web/app/(capture)/leituras/nova/capturar/page.tsx: FOUND
- apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx: FOUND
- apps/web/hooks/use-camera.ts: FOUND
- apps/web/hooks/use-camera.test.ts: FOUND
- apps/web/components/capture/CameraView.tsx: FOUND
- apps/web/components/capture/CameraDeniedScreen.tsx: FOUND
- apps/web/components/capture/CameraDeniedScreen.test.tsx: FOUND
- apps/web/components/ui/alert.tsx: FOUND

Commits verificados:
- 86c554c: FOUND (feat task 1)
- f0352be: FOUND (test RED)
- 2796f65: FOUND (feat GREEN)
- 67e366b: FOUND (feat task 3)
