---
plan: 03-07
phase: 03-captura-mobile-pwa
subsystem: capture-upload
tags: [upload, storage, compression, preview, sonner, abort-controller, tdd]
depends_on: [03-06]
provides:
  - lib/capture/jpeg-compress
  - lib/capture/storage-path
  - lib/capture/upload
  - components/capture/CapturePreview
  - components/ui/sonner
affects:
  - capture-client (pipeline auto-trigger real integrado)
  - app/layout (Toaster montado)
  - lib/capture/sequence (SlotPhase inclui 'previewing')
tech_stack:
  added:
    - sonner 2.0.7 (toast notifications)
  patterns:
    - TDD RED-GREEN para 3 libs (storage-path, jpeg-compress, upload)
    - AbortController por slot para cancelamento de uploads concorrentes (T-03-07-02)
    - upload em background (void promise) — NÃO bloqueia UI (D-09)
    - canvas.toBlob downscale-only com MAX_DIMENSION=2048 e quality=0.85 (D-16)
    - upsert onConflict='reading_id,eye,angle' para idempotência em tap-to-redo
key_files:
  created:
    - apps/web/lib/capture/storage-path.ts
    - apps/web/lib/capture/storage-path.test.ts
    - apps/web/lib/capture/jpeg-compress.ts
    - apps/web/lib/capture/jpeg-compress.test.ts
    - apps/web/lib/capture/upload.ts
    - apps/web/lib/capture/upload.test.ts
    - apps/web/components/capture/CapturePreview.tsx
    - apps/web/components/capture/CapturePreview.test.tsx
    - apps/web/components/ui/sonner.tsx
  modified:
    - apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx
    - apps/web/app/layout.tsx
    - apps/web/lib/capture/sequence.ts
    - apps/web/package.json
decisions:
  - "canvas.toBlob não lança em null — usado Promise<Blob|null> com guard para throw manual"
  - "Teste de portrait downscale ajustado: 1080x1920 tem max_side=1920 < 2048 → sem resize (teste do plano tinha expectativa incorreta)"
  - "capture-client substituído por pipeline auto-trigger real (remove grid de revisão e captura manual da versão 03-06/e6890cb)"
  - "SlotPhase adicionada 'previewing' em sequence.ts (não quebrando sequence.test.ts)"
  - "AbortController cópia via 'const abortMap = slotAbortRefs.current' no cleanup do useEffect (React ref-in-cleanup lint warning)"
metrics:
  duration: "~7 minutes"
  completed: "2026-05-02"
  tasks_completed: 3
  files_created: 9
  files_modified: 4
  tests_added: 35
---

# Phase 03 Plan 07: Compressão JPEG + Storage Upload + CapturePreview Summary

Pipeline completo de captura real: JPEG 0.85 / max 2048px client-side, upload para bucket `iris-captures` com path determinístico, upsert em `reading_images`, preview passivo 2s com tap-to-redo e AbortController por slot, toast sonner em background sem bloquear avanço.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests para 3 libs | 5cf5c79 | storage-path.test.ts, jpeg-compress.test.ts, upload.test.ts |
| 1 (GREEN) | Implementar jpeg-compress + storage-path + upload | 10efbca | jpeg-compress.ts, storage-path.ts, upload.ts |
| 2 | CapturePreview + sonner + Toaster no root layout | da92293 | CapturePreview.tsx, CapturePreview.test.tsx, sonner.tsx, layout.tsx, package.json |
| 3 | Integrar captura real no capture-client | 35d518c | capture-client.tsx, sequence.ts |
| CHECKPOINT | Task 4 (human-verify) | — | Aguardando UAT iPhone + Android |

## Test Results

| Test File | Tests | Status |
|-----------|-------|--------|
| lib/capture/storage-path.test.ts | 12 | PASS |
| lib/capture/jpeg-compress.test.ts | 9 | PASS |
| lib/capture/upload.test.ts | 8 | PASS |
| components/capture/CapturePreview.test.tsx | 6 | PASS |
| **Novos neste plan** | **35** | **ALL PASS** |
| Full suite (novos + anteriores) | 144 | ALL PASS |
| Pre-existing failures (quality-scoring.test.ts) | 3 | FAIL (pré-existentes, out of scope) |

## Implementações

### storage-path.ts

```typescript
buildStoragePath(therapistId, readingId, eye, angle)
// → '{therapistId}/{readingId}/{eye}_{angle}.jpg'
// Valida segmentos: rejeita '/', '..', '\' (T-03-07-01)
```

### jpeg-compress.ts

```typescript
compressFrameToJpeg(source, sourceW, sourceH)
// → { blob: Blob, width: number, height: number }
// MAX_DIMENSION = 2048, JPEG_QUALITY = 0.85
// downscale-only (não upscale), canvas.toBlob('image/jpeg', 0.85)
// Throws se toBlob retorna null
```

### upload.ts

```typescript
uploadCaptureImage(args) // → UploadResult { path }
uploadWithRetry(args, maxAttempts=2) // → UploadResult; retry backoff 1s, 2s
// AbortSignal suportado — AbortError não é retentado
// upsert: true no storage + onConflict='reading_id,eye,angle' no DB
```

### CapturePreview

- Preview passivo 2s com `window.setTimeout(onTimeout, durationMs)`
- Countdown circular SVG (r=14, circumference=2πr)
- Badge de qualidade canto superior esquerdo (LEVEL_BG_CLASS, LEVEL_TEXT_CLASS)
- Botão full-screen tap-to-redo com `RefreshCw` icon
- `motion-safe:animate-in motion-safe:fade-in` para reduced motion

### capture-client.tsx — Pipeline real

```
streaming [score≥0.50 por 200ms]
  → captureCurrentFrame()
    → compressFrameToJpeg(video)
    → URL.createObjectURL(blob)
    → setPendingPreview + setPhase('previewing')
    → void uploadWithRetry({ signal: ac }) // background
      → toast.loading 'Salvando N/6...'
      → .then → toast.success 'Imagem salva.'
      → .catch → toast.error (persistente) ← T-03-07-04

phase='previewing'
  CapturePreview onTimeout → advanceToNextSlot()
    → URL.revokeObjectURL
    → next<6 ? overlay/interstitial : finalizing
  CapturePreview onRedo → redoCurrent()
    → ac.abort() // cancela upload slot (T-03-07-02)
    → URL.revokeObjectURL
    → setPhase('streaming')
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste jpeg-compress com expectativa incorreta de upscale**
- **Found during:** Task 1 GREEN (testes falharam no caso portrait 1080x1920)
- **Issue:** O plano esperava `1080x1920 → 1152x2048`, mas max(1080,1920)=1920 < 2048, logo NÃO há downscale. A lógica correta é: downscale-only quando maxSide > 2048. A expectativa do teste estava errada.
- **Fix:** Teste ajustado para `1080x1920 → 1080x1920` (sem resize) + adicionado caso `2160x3840 → 1152x2048` como teste de portrait downscale real.
- **Files modified:** apps/web/lib/capture/jpeg-compress.test.ts
- **Commit:** 10efbca

**2. [Rule 2 - Missing critical] capture-client substituição completa**
- **Found during:** Task 3
- **Issue:** O `capture-client.tsx` atual (e6890cb) tinha captura manual com botão, grid de revisão 2x3, retake mode, dataURLToBlob, e `saveReadingImagesAction` — toda uma UX diferente da prescrita no plano 03-07.
- **Fix:** Substituição completa pelo pipeline auto-trigger + CapturePreview + upload background (conforme plan 03-07).
- **Files modified:** apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx
- **Commit:** 35d518c

### Deferred Issues (Pre-existing, Out of Scope)

| File | Issue | Deferred |
|------|-------|---------|
| lib/capture/quality-scoring.test.ts | 3 testes falhando (weights reflex, dominantFailure reflex) | Pré-existentes antes de 03-07; não introduzidos por este plan |

## UAT Status (Checkpoint)

Task 4 é `checkpoint:human-verify` (blocking). UAT em dispositivo físico ainda não realizado.

### Aguardando UAT (iPhone real + Android):

1. Iniciar nova leitura; auto-trigger dispara quando score ≥ 0.50 por 200ms
2. CapturePreview aparece com foto + badge qualidade + countdown circular
3. Toast "Salvando imagem 1/6..." aparece em background
4. Após 2s sem tap → preview some, AngleOverlay/Interstitial aparece
5. Toast muda para "Imagem salva." (2s) ou persiste em erro
6. Supabase Studio: 6 arquivos em iris-captures/{therapistId}/{readingId}/
7. reading_images: 6 linhas com eye, angle, storage_path, quality_score, width, height
8. Tap-to-redo no slot 5: upload anterior abortado, volta para streaming mesmo slot
9. Soma de 6 arquivos < 5MB (alvo ~3MB)
10. RLS: terapeuta B não acessa reading de A

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Finalizing: texto estático + sem redirect | capture-client.tsx | finalizeReadingAction + redirect deferred para 03-08 |

## Threat Model Mitigations Implemented

| Threat | Mitigation |
|--------|------------|
| T-03-07-01 Storage path collision | buildStoragePath inclui therapistId + readingId; validateSegment rejeita '/', '..'; UNIQUE constraint reading_images |
| T-03-07-02 Race condition tap-to-redo | slotAbortRefs Map com AbortController por slot; upload anterior abortado ao iniciar novo |
| T-03-07-03 PII em logs/toast | Toast mostra apenas 'N/6'; console.error usa apenas slot.eye/slot.angle; storage_path nunca aparece em UI |
| T-03-07-04 Upload silencioso | uploadWithRetry 2 tentativas + backoff; toast persistente (duration: Infinity) em falha final |
| T-03-07-05 JPEG inflado | MAX_DIMENSION=2048, JPEG_QUALITY=0.85 — fixos, não configuráveis pelo usuário |

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| apps/web/lib/capture/storage-path.ts | FOUND |
| apps/web/lib/capture/jpeg-compress.ts | FOUND |
| apps/web/lib/capture/upload.ts | FOUND |
| apps/web/components/capture/CapturePreview.tsx | FOUND |
| apps/web/components/ui/sonner.tsx | FOUND |
| apps/web/app/layout.tsx inclui Toaster | FOUND |
| commit 5cf5c79 (RED tests) | FOUND |
| commit 10efbca (GREEN libs) | FOUND |
| commit da92293 (CapturePreview + sonner) | FOUND |
| commit 35d518c (capture-client integrado) | FOUND |
| Build: verde | PASS |
| Tests novos: 35/35 | PASS |
| audit:vocabulary | PASS |
| Lint: 0 errors | PASS |
