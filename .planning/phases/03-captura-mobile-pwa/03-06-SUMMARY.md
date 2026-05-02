---
plan: 03-06
phase: 03-captura-mobile-pwa
subsystem: capture-sequence-ui
tags: [sequence, state-machine, svg, angle-icon, tdd, pwa, guided-capture]
depends_on: [03-05]
provides:
  - lib/capture/sequence
  - components/capture/AngleIcon
  - components/capture/AngleOverlay
  - components/capture/AngleInterstitial
  - components/capture/CaptureProgress
affects:
  - capture-client (state machine completa)
  - lib/capture/sequence
  - components/capture
tech_stack:
  added: []
  patterns:
    - "TDD RED-GREEN for pure lib (sequence.ts)"
    - "SVG inline 96×96 com 6 variantes (eye × angle)"
    - "motion-safe:* para reduced motion em todos os componentes animados"
    - "State machine SlotPhase com 6 fases na capture-client"
key_files:
  created:
    - apps/web/lib/capture/sequence.ts
    - apps/web/lib/capture/sequence.test.ts
    - apps/web/components/capture/AngleIcon.tsx
    - apps/web/components/capture/AngleIcon.test.tsx
    - apps/web/components/capture/AngleOverlay.tsx
    - apps/web/components/capture/AngleInterstitial.tsx
    - apps/web/components/capture/CaptureProgress.tsx
  modified:
    - apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx
decisions:
  - "Angle type importado de sequence.ts (não re-usado de quality-scoring.ts) para evitar conflito de source-of-truth"
  - "SVG inline com Array.from({length:8}) para 8 raios no backlight — sem asset externo (D-11)"
  - "Auto-trigger guard: if (phase !== 'streaming') return — mitigação T-03-06-03"
  - "captureGate.reset() em 3 pontos de transição: overlay timeout, interstitial/finalizing effect, CTA"
  - "slotIndex inicializado via getResumeSlotIndex(initialCaptured) com fallback para último slot se -1"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-01"
  tasks_completed: 3
  files_created: 7
  files_modified: 1
  tests_added: 39
---

# Phase 03 Plan 06: Guided Capture Sequence — State Machine + Angle UI Summary

Sequência guiada de 6 capturas com state machine completa: SEQUENCE canônica + getResumeSlotIndex testados via TDD; AngleIcon SVG inline com 6 variantes; AngleOverlay (entre ângulos do mesmo olho) + AngleInterstitial (transição de olho) + CaptureProgress (6 dots); state machine no capture-client com auto-trigger suspenso durante fases não-streaming.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests para sequence lib | 2c02174 | lib/capture/sequence.test.ts |
| 1 (GREEN) | sequence.ts — SEQUENCE + helpers | 5f3c1ca | lib/capture/sequence.ts |
| 2 | 4 componentes de sequência guiada | a35c4ca | AngleIcon.tsx, AngleIcon.test.tsx, CaptureProgress.tsx, AngleOverlay.tsx, AngleInterstitial.tsx |
| 3 | State machine no capture-client | 4121e0c | capture-client.tsx |
| CHECKPOINT | Task 4 (human-verify) | — | Parado aguardando UAT iPhone |

## Test Results

| Test File | Tests | Status |
|-----------|-------|--------|
| lib/capture/sequence.test.ts | 28 | PASS |
| components/capture/AngleIcon.test.tsx | 11 | PASS |
| **Novos neste plan** | **39** | **ALL PASS** |
| Full suite (todos os plans) | 111 | ALL PASS |

## Sequência e State Machine

### SEQUENCE canônica (lib/capture/sequence.ts)

```typescript
const SEQUENCE: readonly Slot[] = [
  { eye: 'right', angle: 'frontal' },   // índice 0
  { eye: 'right', angle: 'lateral' },   // índice 1
  { eye: 'right', angle: 'backlight' }, // índice 2
  { eye: 'left',  angle: 'frontal' },   // índice 3 ← AngleInterstitial ANTES
  { eye: 'left',  angle: 'lateral' },   // índice 4
  { eye: 'left',  angle: 'backlight' }, // índice 5
]
```

### State Machine (capture-client.tsx)

```
streaming → [score >= 0.75 por 400ms] → advanceToNextSlot()
  ↓ isOuterEyeTransition(2,3)?
  YES → interstitial (AngleInterstitial fullscreen, gate suspenso)
  NO  → overlay (AngleOverlay 2.5s, gate suspenso)
  ↓ após CTA / timeout
  streaming [captureGate.reset()]
  ↓ após 6/6
  finalizing (stub — 03-08)
```

**Mitigação T-03-06-03:** `if (phase !== 'streaming') return` no callback do auto-trigger; `captureGate.reset()` em 3 pontos de transição.

## AngleIcon — 6 Variantes SVG

| Variante | Descrição |
|----------|-----------|
| right/frontal | Olho + seta ↓ |
| right/lateral | Olho + seta ↗ (têmpora direita) |
| right/backlight | Olho + 8 raios de sol atrás |
| left/frontal | Olho + seta ↓ |
| left/lateral | Olho + seta ↖ (têmpora esquerda) |
| left/backlight | Olho + 8 raios de sol atrás |

ViewBox `0 0 96 96`. Sem `width=`/`height=` inline — somente via `className`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing await em função não-async no capture-client.tsx**
- **Found during:** Task 3 build verification
- **Issue:** Código de calibração adicionado no 03-05 usava `await import(...)` dentro do callback de `tick` que não era async. Gerava `Error: await isn't allowed in non-async function` no build.
- **Fix:** O arquivo foi substituído pela versão completa do Task 3 sem o código de calibração (substituído pelo stub de auto-trigger correto).
- **Files modified:** apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx
- **Commit:** 4121e0c

## UAT Status (Checkpoint)

Task 4 é `checkpoint:human-verify` (blocking). UAT em dispositivo físico ainda não foi realizado.

### Aguardando UAT (iPhone real):

1. Tela inicial: QualityIndicator + CaptureProgress "1 de 6" + LiveFeedbackMessage
2. Score >= 0.75 por 400ms → console stub → AngleOverlay "Próximo: olho direito — lateral" com ícone ↗
3. AngleOverlay minimiza para chip após 2.5s; dot 1 verde com check
4. Repetir até slot 3 (right/backlight) → AngleInterstitial fullscreen "Vamos para o olho esquerdo"
5. CTA "Pronto, vou capturar" avança para left/frontal
6. Slots 4-6 com AngleOverlays corretos (↖ para lateral esquerdo)
7. Após slot 6 → "6 de 6 imagens registradas — Finalizando leitura..."
8. Resume: recarregar com capturados < 6 → começa no slot correto (ou AngleInterstitial se resumindo em left)
9. Reduced motion: iOS Settings → Reduzir Movimento → pulse e slide desativados

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Auto-trigger: console.log + advanceToNextSlot (sem JPEG) | capture-client.tsx | 162-169 | Canvas.toBlob + upload + insert deferred para 03-07 |
| Finalizing: texto estático | capture-client.tsx | 240-245 | finalizeReadingAction + redirect deferred para 03-08 |
| Debug div (phase • slot • score) | capture-client.tsx | 248-251 | Dev-only; removido em 03-08 |

## TDD Gate Compliance

RED commit: 2c02174 (sequence.test.ts)
GREEN commit: 5f3c1ca (sequence.ts)
TDD gates satisfeitos para Task 1.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| lib/capture/sequence.ts | FOUND |
| lib/capture/sequence.test.ts | FOUND |
| components/capture/AngleIcon.tsx | FOUND |
| components/capture/AngleIcon.test.tsx | FOUND |
| components/capture/AngleOverlay.tsx | FOUND |
| components/capture/AngleInterstitial.tsx | FOUND |
| components/capture/CaptureProgress.tsx | FOUND |
| commit 2c02174 (RED) | FOUND |
| commit 5f3c1ca (GREEN) | FOUND |
| commit a35c4ca (Task 2) | FOUND |
| commit 4121e0c (Task 3) | FOUND |
| Build: verde | PASS |
| Tests: 111/111 | PASS |
| audit:vocabulary | PASS |
