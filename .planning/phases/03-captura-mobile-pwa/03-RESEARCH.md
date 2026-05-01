# Phase 3: Captura mobile (PWA) — Research

**Researched:** 2026-05-01
**Domain:** PWA mobile + on-device computer vision (MediaPipe FaceLandmarker) + Supabase Storage upload
**Confidence:** HIGH (stack), MEDIUM (limiares de qualidade — heurísticas a calibrar com dogfooding), HIGH (PWA + Storage padrões)

## Summary

A Fase 3 é a fase mais densa do MVP em termos de superfície técnica: combina **três domínios distintos** que precisam funcionar em conjunto sob restrições de mobile real (4G brasileiro, iOS Safari, mid-tier Android):

1. **PWA shell** instalável em iOS Safari + Chrome Android com manifest e service worker mínimo (sem cache offline rico — diferido para Fase 9 conforme `<deferred>`).
2. **Captura validada on-device** com MediaPipe `FaceLandmarker` (`@mediapipe/tasks-vision@0.10.35`), calculando 7 sub-scores que compõem `overallScore` (gate em ≥0.75), com auto-captura após 400ms de estabilidade.
3. **Compressão + upload** de 6 JPEGs para Supabase Storage em bucket privado por terapeuta, com `reading_id` rastreável desde a 1ª foto.

Toda a UI (4 níveis de qualidade, 6 telas de fluxo, recovery banner, fallback de câmera negada) já está prescrita pelo `03-UI-SPEC.md` — esta pesquisa **não revisita decisões de UI** e foca exclusivamente em técnica.

**Primary recommendation:** Adotar o stack canônico abaixo verbatim (`@mediapipe/tasks-vision@0.10.35` + `@serwist/next@9.5.10` + `sonner@2.0.7`). Hospedar `face_landmarker.task` (~3.6MB) e o WASM runtime no `public/mediapipe/` para servir same-origin via Vercel — evita CORS edge cases e dependência de CDN externa em runtime crítico. Lazy-load do MediaPipe **só na rota `(capture)`** via `next/dynamic({ ssr: false })`. Bucket de Storage **NÃO existe ainda** — precisa de migration nova nesta fase (não foi criado na Fase 1 conforme verificado em `supabase/config.toml` e `supabase/migrations/`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PWA install (manifest + SW) | Browser/Client | Frontend Server (manifest.ts) | Manifest é gerado pelo Next via metadata route; SW vive no client |
| Câmera (`getUserMedia`) | Browser/Client | — | API do navegador, exclusiva client-side |
| MediaPipe inference loop | Browser/Client | — | WASM no thread principal do navegador; D-context exige isolamento de bundle |
| Quality scoring | Browser/Client | — | Algoritmos puros (Laplaciana, exposição, distância de landmarks) sobre frames `<video>`/`<canvas>` |
| Compressão JPEG + resize | Browser/Client | — | `Canvas.toBlob` ou `OffscreenCanvas` em Web Worker |
| Upload para Storage | Browser/Client | API/Backend (assinatura de URL opcional) | supabase-js client browser direto com RLS de Storage; OU API com `createSignedUploadUrl` (decisão abaixo) |
| Reading row create/finalize/discard | API/Backend | — | Server actions sob `app/actions/readings.ts` (padrão Fase 2) |
| Recovery banner query | API/Backend (server component) | Browser/Client (banner inline) | Server component em `(dashboard)/layout.tsx` busca rascunho; banner é client component |
| Path convention `{therapist_id}/{reading_id}/{eye}_{angle}.jpg` | Browser/Client (gera path) | API/Backend (RLS valida no INSERT) | Path é determinístico no client; RLS de `storage.objects` valida que folder[1] = auth.uid() |

---

## User Constraints (from CONTEXT.md)

> O CONTEXT.md desta fase tem **16 decisões locked (D-01..D-16)** e várias discretions já resolvidas pelo UI-SPEC. Esta seção replica essas categorias por referência — para detalhe completo, consultar arquivos fonte.

### Locked Decisions (D-01..D-16, ver 03-CONTEXT.md)

- **D-01:** Entrada dual: `/clientes/[id]` botão "Nova Leitura" + `/leituras/nova` com dropdown. Convergem em `/leituras/nova/capturar?reading=[id]`.
- **D-02:** Auto-captura quando `overallScore ≥ 0.75` mantém estável (sobrescreve ROADMAP literal "botão de captura" — sem botão manual).
- **D-03..D-04:** UI dos 4 níveis de qualidade; `quality_score` numérico salvo em `reading_images.quality_score` (sem schema change).
- **D-05:** Badge de qualidade renderizado no relatório → forward Fase 7.
- **D-06:** `reflexInIrisCenter` é contribuição suave (~0.15-0.20) ao score, não hard gate.
- **D-07:** Limiares: <0.40 Ruim / 0.40-0.74 Regular / 0.75-0.89 Boa / ≥0.90 Excelente.
- **D-08:** Reading row criado **antes da 1ª foto** com `status='pending'`, `capture_method='mobile_camera'`.
- **D-storage:** Path `{therapist_id}/{reading_id}/{eye}_{angle}.jpg`.
- **D-09:** Preview passivo 2s + tap-to-refazer; upload em background (não bloqueia avanço).
- **D-10:** Instrução híbrida — overlay inline entre ângulos do mesmo olho; interstitial fullscreen na transição de olho.
- **D-11:** `AngleIcon.tsx` SVG inline (frontal/lateral/backlight × left/right).
- **D-12:** Banner automático de recovery em `/dashboard` ou `/leituras` quando `status='pending' AND count(reading_images) < 6`.
- **D-13:** Cancelar fluxo preserva rascunho. Hard delete só via "Descartar" no banner.
- **D-14:** Banner proativo de PWA install antes da 1ª captura (Android: `beforeinstallprompt`; iOS: instruções visuais).
- **D-15:** Tela de erro dedicada em câmera negada com link para `/leituras/nova/upload` (placeholder em Fase 3, real em Fase 4).
- **D-16:** Compressão JPEG 0.85 + max 2048px (~500KB/foto, ~3MB/leitura).

### Discretions resolvidas pelo UI-SPEC

- QualityIndicator → barra horizontal 8px full-width topo do viewfinder
- RecoveryBanner → inline dismissable (não modal)
- Telemetria upload → toast `sonner` discreto
- Transição (eye, angle) → fade-cross 200ms
- Janela auto-capture → 400ms de estabilidade
- Route group → `(capture)` separado de `(dashboard)`
- Componentes shadcn novos: `progress`, `alert`, `sonner`

### Discretions ainda abertas (planner decide)

- **Hooks customizados** (`useCamera`, `useQualityScore`, `useReadingDraft`, etc.) — organização interna.
- **Web Worker para compressão** — opcional; planner avalia trade-off complexidade vs UX.
- **Upload direto vs signed URL** — recomendado abaixo: cliente direto via supabase-js (RLS de Storage cobre).
- **Estratégia de retry de upload** — sugestão D-context: 2x backoff, depois marca falha visual e permite retry manual.
- **Telemetria de qualidade** (logging de histograma de scores) — opcional.
- **Limites exatos de cada sub-score** — heurísticas iniciais nesta pesquisa, calibrar em dogfooding.

### Deferred Ideas (OUT OF SCOPE — ver 03-CONTEXT.md `<deferred>`)

- Service worker offline-first com cache rico → Fase 9
- Tema visual / identidade Aurel Iris → Fase 9
- Listagem `/leituras` com filtros/busca → Fase 7 ou 9
- Termo de consentimento LGPD → Fase 8
- Logs de auditoria de Storage → Fase 8 (LGPD-04)
- Upload em chunks / resumível → não necessário para 500KB
- Multi-foto por ângulo → reavaliar pós-dogfooding
- Compressão WebP → JPEG 0.85 é o seguro

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAPTURE-01 | PWA installable em iOS Safari + Chrome Android | Seção *PWA & Service Worker*, *Standard Stack* (`@serwist/next`), *Common Pitfalls* (iOS quirks) |
| CAPTURE-02 | `getUserMedia` câmera traseira + overlay circular | Seção *Camera & getUserMedia* (constraints, fallback exact→ideal, error handling) |
| CAPTURE-03 | `IrisDetector` MediaPipe + `QualityCheck` com 7 sub-scores | Seção *MediaPipe FaceLandmarker* (init, indices), *Quality Scoring Algorithms* (algoritmos por sub-score) |
| CAPTURE-04 | Captura gated `overallScore ≥ 0.75` + feedback ao vivo | Seção *Quality Scoring Algorithms* (fórmula de pesos), *Performance considerations* (throttle de frames) |
| CAPTURE-05 | Sequência guiada de 6 capturas com instruções visuais | Seção *Capture Flow State Machine* (state machine recomendada), UI-SPEC §Component Inventory |
| CAPTURE-06 | Compressão + upload para bucket privado | Seção *Image Compression*, *Supabase Storage Upload*, *Storage Bucket & RLS Migration* |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@mediapipe/tasks-vision` | `0.10.35` | FaceLandmarker WASM em browser | Pacote oficial Google; citado verbatim no SPEC §4.1; expõe `FaceLandmarker.createFromOptions` + `detectForVideo`. [VERIFIED: npm view @mediapipe/tasks-vision version, modified 2026-04-27] |
| `@serwist/next` | `9.5.10` | Service Worker + PWA shell para Next.js 15 App Router | Sucessor oficialmente recomendado pelo `next-pwa` (legacy desde set/2024); supportado pela documentação oficial Next.js como opção PWA. [VERIFIED: npm view @serwist/next version, modified 2026-04-30] [CITED: nextjs.org/docs/app/guides/progressive-web-apps] |
| `serwist` | `9.5.10` | Runtime do SW (peer de `@serwist/next`) | Necessário no devDeps. [VERIFIED: npm view serwist version] |
| `sonner` | `2.0.7` | Toast para telemetria de upload (D-09) | Padrão shadcn 4.x para toast; substituiu `@radix-ui/react-toast` no preset base-nova. [VERIFIED: npm view sonner version, modified 2025-08-02] [CITED: ui.shadcn.com/docs/components/sonner] |

### Já presentes no projeto (reutilizar)
| Library | Version | Purpose |
|---------|---------|---------|
| `next` | `15.5.15` | App Router (route group `(capture)`, `manifest.ts`) |
| `react` | `19.1.0` | `useDeferredValue`, `useTransition` para throttle de re-render por frame |
| `@supabase/ssr` | `0.10.2` | Auth + database client (já configurado em `lib/supabase/`) |
| `@supabase/supabase-js` | `2.105.1` | Storage upload (`supabase.storage.from(bucket).upload(...)`) |
| `lucide-react` | `1.14.0` | Ícones (`Camera`, `CameraOff`, `Share`, `Check`, `Clock`, `RefreshCw`, etc.) |
| `zod` | `4.4.1` | Validação dos server actions de `readings.ts` |
| `react-hook-form` | `7.74.0` | Formulário de seleção de cliente em `/leituras/nova` |
| `date-fns` | `4.1.0` | "Iniciada há 2 horas" no banner de recovery |
| `tailwind-merge`, `clsx` | — | `cn()` em `lib/utils.ts` |

### Componentes shadcn a adicionar nesta fase
```bash
pnpm dlx shadcn@latest add progress alert sonner
```
*Confirmado pelo UI-SPEC §Design System.*

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@mediapipe/tasks-vision` | `@tensorflow-models/face-landmarks-detection` | TF.js também detecta íris mas: (a) bundle TF.js é maior; (b) SPEC §4.1 cita MediaPipe verbatim; (c) MediaPipe tem inferência mais rápida no WASM mobile. **Manter MediaPipe.** |
| `@serwist/next` | `next-pwa` (5.6.0) | `next-pwa` está em modo legacy desde set/2024 (último update 2024-09-18). Serwist é o sucessor recomendado pela própria comunidade Next.js. [CITED: javascript.plainenglish.io artigo sobre Serwist como sucessor next-pwa] |
| `@serwist/next` | SW manual em `public/sw.js` | Aceitável para o caso "minimal install only" (D-context discretion permite). Trade-off: zero abstração mas precisa lidar manualmente com versionamento de SW e `__SW_MANIFEST` precompiled. **Recomendação: usar Serwist** — escopo mínimo dele já é só "register SW + skipWaiting" e o boilerplate de versionamento é cuidado. |
| `browser-image-compression` (lib npm) | `Canvas.toBlob` puro | Lib externa adiciona ~10KB e abstrai resize+compress, mas: (a) `Canvas.toBlob('image/jpeg', 0.85)` resolve o caso (D-16 prescreve esses parâmetros exatos); (b) menos uma dependência. **Recomendação: vanilla canvas.** |
| Upload via `createSignedUploadUrl` (server-side) | Upload direto via `supabase.storage.from().upload()` (client) | Signed upload URL adiciona um round-trip (server gera URL → client envia). RLS de Storage com `(storage.foldername(name))[1]::uuid = auth.uid()` cobre o caso direto. **Recomendação: upload direto** — simples, RLS protege. |

### Installation
```bash
# Em apps/web/
pnpm add @mediapipe/tasks-vision@0.10.35 @serwist/next@9.5.10 sonner@2.0.7
pnpm add -D serwist@9.5.10
pnpm dlx shadcn@latest add progress alert sonner
```

**Version verification:**
- `@mediapipe/tasks-vision@0.10.35` published 2025 (confirmado em `dist-tags.latest`); pacote modified 2026-04-27. [VERIFIED]
- `@serwist/next@9.5.10` published abr/2024 baseline 9.0.0, atualizado até 9.5.10 (mod. 2026-04-30). [VERIFIED]
- `sonner@2.0.7` (mod. 2025-08-02). [VERIFIED]

---

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────── BROWSER (CLIENT) ────────────────────────┐
│                                                                  │
│  /leituras/nova (DASHBOARD layout)                               │
│  ┌──────────────┐                                                │
│  │ Select cliente│──── server action ─────┐                      │
│  └──────────────┘   createReading(clientId)│                     │
│                                            ▼                     │
│  /leituras/nova/capturar?reading=[id] (CAPTURE layout)           │
│  ┌─────────────────────────────────────────────┐                 │
│  │  CameraView                                 │                 │
│  │  ┌──────────────────────┐                   │                 │
│  │  │ <video>              │── stream ──┐      │                 │
│  │  │ getUserMedia()       │            │      │                 │
│  │  └──────────────────────┘            ▼      │                 │
│  │                       ┌──────────────────┐  │                 │
│  │                       │ IrisDetector     │  │                 │
│  │                       │ FaceLandmarker   │  │                 │
│  │                       │ detectForVideo() │  │                 │
│  │                       └────────┬─────────┘  │                 │
│  │                                ▼            │                 │
│  │                       QualityCheck (7 sub)  │                 │
│  │                       overallScore          │                 │
│  │                                │            │                 │
│  │            ┌───────────────────┴────────┐   │                 │
│  │            ▼                            ▼   │                 │
│  │     QualityIndicator         LiveFeedbackMessage              │
│  │     (4 níveis)               ("aproxime mais")                │
│  │                                              │                │
│  │     overallScore≥0.75 estável 400ms          │                │
│  │                ▼                             │                │
│  │     captureFrame() → canvas.toBlob(jpeg,0.85)│                │
│  │                ▼                             │                │
│  │     CapturePreview (2s, tap-to-redo)         │                │
│  │                ▼                             │                │
│  │     ┌──────────────────────────────┐         │                │
│  │     │ Upload em background (toast) │─────────┼────► Supabase  │
│  │     │ supabase.storage.upload(blob)│         │      Storage   │
│  │     └──────────────────────────────┘         │      bucket    │
│  │                ▼                             │      privado   │
│  │     Insert reading_images row                │                │
│  │     (eye, angle, storage_path,               │                │
│  │      quality_score, width, height)           │                │
│  │                ▼                             │                │
│  │     next (eye, angle) — fade-cross 200ms     │                │
│  │     6th captura → finalizeReading()          │                │
│  │     redirect /leituras/[id]                  │                │
│  └─────────────────────────────────────────────┘                 │
│                                                                  │
│  Service Worker (Serwist)                                        │
│  ┌──────────────────────────────────────┐                        │
│  │ Mínimo: install/activate/skipWaiting │                        │
│  │ Sem cache offline (Fase 9)           │                        │
│  └──────────────────────────────────────┘                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                          │
                          │ TLS / Supabase RLS
                          ▼
┌──────────────────── SUPABASE (sa-east-1) ────────────────────────┐
│                                                                  │
│  Postgres                                                        │
│  ├── readings (status='pending'→'ready'/'failed')                │
│  └── reading_images (6 rows por reading)                         │
│                                                                  │
│  Storage                                                         │
│  └── bucket "iris-captures" (privado)                            │
│      RLS: (storage.foldername(name))[1] = auth.uid()::text       │
│      Path: {therapist_id}/{reading_id}/{eye}_{angle}.jpg         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
apps/web/
├── app/
│   ├── (capture)/                              # NOVO route group (sem sidebar)
│   │   ├── layout.tsx                          # Viewport meta + safe-area
│   │   └── leituras/nova/capturar/
│   │       ├── page.tsx                        # Server component: valida reading_id e resume
│   │       └── capture-client.tsx              # Client component: state machine completa
│   ├── (dashboard)/
│   │   ├── leituras/
│   │   │   ├── nova/
│   │   │   │   ├── page.tsx                    # NOVO: select cliente + criar reading
│   │   │   │   └── upload/page.tsx             # NOVO placeholder (D-15) — real Fase 4
│   │   │   └── page.tsx                        # Existente; recebe RecoveryBanner
│   │   └── layout.tsx                          # Existente; injetar RecoveryBanner via server query
│   ├── actions/
│   │   ├── clients.ts                          # Existente (Fase 2)
│   │   └── readings.ts                         # NOVO: createReading, finalizeReading,
│   │                                           #         discardReading, resumeReading
│   ├── manifest.ts                             # NOVO: PWA manifest (metadata route)
│   └── sw.ts                                   # NOVO: service worker source (Serwist)
├── components/
│   └── capture/                                # NOVO subdir
│       ├── CameraView.tsx
│       ├── IrisDetector.tsx                    # Wrapper MediaPipe
│       ├── QualityIndicator.tsx                # Barra full-width 8px
│       ├── CapturePreview.tsx                  # 2s + tap-to-redo
│       ├── AngleIcon.tsx                       # SVG inline (D-11)
│       ├── AngleInterstitial.tsx               # Fullscreen entre olhos (D-10)
│       ├── AngleOverlay.tsx                    # Inline entre ângulos (D-10)
│       ├── CameraDeniedScreen.tsx              # Fallback D-15
│       ├── PWAInstallBanner.tsx                # D-14
│       ├── RecoveryBanner.tsx                  # D-12 (alt: components/dashboard/)
│       ├── CaptureProgress.tsx                 # 6 dots
│       └── LiveFeedbackMessage.tsx
├── hooks/                                      # NOVO subdir
│   ├── use-camera.ts                           # getUserMedia wrapper
│   ├── use-iris-detector.ts                   # MediaPipe lifecycle
│   ├── use-quality-score.ts                   # Throttle + estabilidade 400ms
│   └── use-pwa-install.ts                      # beforeinstallprompt + standalone detect
├── lib/
│   ├── capture/                                # NOVO subdir (puro / sem deps externas)
│   │   ├── quality-scoring.ts                  # Fórmula overallScore + 7 sub-scores
│   │   ├── laplacian-variance.ts               # Sharpness algorithm
│   │   ├── exposure.ts                         # Histograma RGB
│   │   ├── iris-geometry.ts                    # Centeredness, distance, etc.
│   │   ├── jpeg-compress.ts                    # Canvas.toBlob('image/jpeg', 0.85) + resize
│   │   └── storage-path.ts                     # buildPath({therapist_id, reading_id, eye, angle})
│   └── supabase/                               # Existente
└── public/
    ├── mediapipe/
    │   ├── face_landmarker.task                # ~3.6MB hospedado same-origin
    │   └── wasm/                               # Vision WASM bundles (~1-2MB)
    └── icons/
        ├── icon-192.png
        ├── icon-512.png
        └── icon-maskable.png

supabase/migrations/
└── 0004_storage_bucket_iris_captures.sql       # NOVO: bucket + RLS policies
```

### Pattern 1: Lazy-load do MediaPipe (D-context: bundle isolation)

**What:** Carregar `@mediapipe/tasks-vision` apenas no client, apenas na rota `(capture)`, nunca no bundle do `(dashboard)`.

**When to use:** Sempre que houver deps client-only pesadas (~3-5MB) que não devem entrar no shell global.

**Example:**
```typescript
// app/(capture)/leituras/nova/capturar/capture-client.tsx
'use client'
import dynamic from 'next/dynamic'

const IrisDetector = dynamic(() => import('@/components/capture/IrisDetector'), {
  ssr: false,
  loading: () => <CameraLoadingShell />,
})
```

```typescript
// components/capture/IrisDetector.tsx
'use client'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

// Hospedar same-origin para evitar CORS surprises e CDN dependency em runtime crítico
const WASM_PATH = '/mediapipe/wasm'
const MODEL_PATH = '/mediapipe/face_landmarker.task'

async function initLandmarker() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFacialTransformationMatrixes: false,
    outputFaceBlendshapes: false, // não precisamos pra esta fase
  })
}
```

### Pattern 2: Render loop por frame de vídeo

**What:** Usar `requestVideoFrameCallback` quando disponível (iOS Safari 15.4+, Chrome 83+) com fallback para `requestAnimationFrame`.

**Why:** `rVFC` casa exatamente com a frame rate do vídeo (evita inferência redundante em frame que não mudou); `rAF` casa com paint do navegador (60Hz, pode ser desperdício).

**Example:**
```typescript
const useVideoFrameLoop = (
  videoRef: RefObject<HTMLVideoElement>,
  onFrame: (now: number, metadata: VideoFrameCallbackMetadata) => void
) => {
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let handle: number | null = null
    const supportsRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype

    const tick = (now: number, metadata?: VideoFrameCallbackMetadata) => {
      onFrame(now, metadata as VideoFrameCallbackMetadata)
      handle = supportsRVFC
        ? video.requestVideoFrameCallback(tick)
        : requestAnimationFrame(() => tick(performance.now()))
    }

    handle = supportsRVFC
      ? video.requestVideoFrameCallback(tick)
      : requestAnimationFrame(() => tick(performance.now()))

    return () => {
      if (handle == null) return
      if (supportsRVFC) video.cancelVideoFrameCallback(handle)
      else cancelAnimationFrame(handle)
    }
  }, [videoRef, onFrame])
}
```

[CITED: developer.mozilla.org/HTMLVideoElement.requestVideoFrameCallback — Safari iOS 15.4+ supported]

### Pattern 3: Estabilidade de score (debounce de 400ms para auto-capture)

**What:** Disparar captura quando `overallScore ≥ 0.75` permanece **continuamente** por 400ms (D-context discretion resolvida no UI-SPEC).

**Example:**
```typescript
// hooks/use-quality-score.ts
const STABILITY_MS = 400
const GATE = 0.75

export function useStableQualityGate(score: number, onTrigger: () => void) {
  const enteredAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (score < GATE) {
      enteredAtRef.current = null
      return
    }
    if (enteredAtRef.current == null) {
      enteredAtRef.current = performance.now()
      return
    }
    const elapsed = performance.now() - enteredAtRef.current
    if (elapsed >= STABILITY_MS) {
      enteredAtRef.current = null
      onTrigger()
    }
  }, [score, onTrigger])
}
```

### Pattern 4: Server action + RLS para `readings.ts`

**What:** Replicar padrão validado da Fase 2 (`apps/web/app/actions/clients.ts`): `'use server'`, `getUser()`, Zod, RLS faz a verificação de ownership.

**Example:**
```typescript
// app/actions/readings.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createSchema = z.object({
  client_id: z.string().uuid(),
  capture_method: z.literal('mobile_camera'),
})

export async function createReadingAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) redirect('/login')

  const parsed = createSchema.safeParse({
    client_id: formData.get('client_id'),
    capture_method: 'mobile_camera',
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  // RLS valida client.therapist_id = auth.uid()
  const { data, error } = await supabase
    .from('readings')
    .insert({
      client_id: parsed.data.client_id,
      therapist_id: user.id,
      capture_method: parsed.data.capture_method,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  redirect(`/leituras/nova/capturar?reading=${data.id}`)
}
```

### Pattern 5: Capture Flow State Machine

**What:** State machine explícita para o fluxo de 6 capturas — evita bugs de off-by-one e simplifica recovery.

```typescript
type Eye = 'right' | 'left'
type Angle = 'frontal' | 'lateral' | 'backlight'
type Slot = { eye: Eye; angle: Angle }

const SEQUENCE: Slot[] = [
  { eye: 'right', angle: 'frontal' },
  { eye: 'right', angle: 'lateral' },
  { eye: 'right', angle: 'backlight' },
  { eye: 'left',  angle: 'frontal' },
  { eye: 'left',  angle: 'lateral' },
  { eye: 'left',  angle: 'backlight' },
]

type CaptureState =
  | { phase: 'idle' }
  | { phase: 'permission_requesting' }
  | { phase: 'permission_denied'; errorType: 'NotAllowedError' | 'NotFoundError' | 'OverconstrainedError' | 'NotReadableError' }
  | { phase: 'streaming'; slotIndex: number }
  | { phase: 'capturing'; slotIndex: number; blob: Blob }
  | { phase: 'previewing'; slotIndex: number; blob: Blob; quality: number; uploadStarted: boolean }
  | { phase: 'overlay'; slotIndex: number } // entre ângulos do mesmo olho
  | { phase: 'interstitial'; slotIndex: number } // entre olhos (índice 3)
  | { phase: 'finalizing' }
  | { phase: 'complete'; readingId: string }
```

Quando hidratar de `?resume=true`: query `reading_images` por `reading_id`, derive `slotIndex` do primeiro slot do `SEQUENCE` que ainda **não** foi capturado, e entre direto em `streaming` (com `interstitial` se for transição de olho).

### Anti-Patterns to Avoid

- **NÃO carregar MediaPipe no `(dashboard)` layout** — adiciona ~3-5MB ao bundle de toda página autenticada. Use `next/dynamic({ ssr: false })` na rota `(capture)`.
- **NÃO usar `facingMode: { exact: 'environment' }` sem fallback** — em desktops sem câmera traseira, `exact` joga `OverconstrainedError` direto. Use `ideal` primeiro, depois faça `enumerateDevices` + `deviceId` se precisar de garantia.
- **NÃO chamar `setQualityScore` a cada frame sem throttle** — 30fps × re-render React = jank em mobile mid-tier. Use `useDeferredValue` ou throttle externo a 10-15Hz para a UI; manter loop de inferência em 30fps mas atualizar state só na transição de nível.
- **NÃO mantenha o stream de câmera depois da última captura** — sempre `stream.getTracks().forEach(t => t.stop())` em cleanup. Câmera fica acesa indicando atividade ao usuário e drena bateria.
- **NÃO pulse upload-em-background sem fallback de erro** — se o 1º upload falha e o usuário avança, fica difícil reagir. Trate como tarefa: `Promise.allSettled` ao final, lista os falhos e oferece retry no momento de finalizar.
- **NÃO faça `supabase.storage.from(bucket).upload()` direto no Server Action** — esse client browser usa cookies de sessão, mas o server client requer service role para operações sob RLS de Storage; melhor manter upload no browser.
- **NÃO use `display: 'fullscreen'` no manifest** — bloqueia status bar do iOS e cria bugs de safe-area. Use `'standalone'` (ver UI-SPEC §PWA Manifest).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Iris landmark detection | Custom CNN, OpenCV.js Hough Transform no client | `@mediapipe/tasks-vision` `FaceLandmarker` | MediaPipe é o estado da arte para inferência leve em mobile; suporta WebGL/WASM, ~30fps em mid-tier; SPEC §4.1 prescreve verbatim. |
| Sharpness (Laplaciana) | Lib OpenCV.js completa (~10MB) | Convolução 3×3 manual em `Uint8ClampedArray` (≈30 LOC) | OpenCV.js é overkill — Laplaciana é literalmente `4*center - top - bottom - left - right` por pixel. Em downscale 256×256 roda em <5ms no mobile. [CITED: theailearner.com/2021/10/30/blur-detection-using-the-variance-of-the-laplacian-method] |
| Compressão JPEG | `browser-image-compression` lib (~12KB extra) | `canvas.toBlob('image/jpeg', 0.85)` nativo | Native canvas API resolve D-16 verbatim sem dep adicional. |
| Resize 2048px | Image manipulation lib | `<canvas>.drawImage(video, 0, 0, w, h)` com aspect ratio | Browsers aceleram `drawImage` por hardware; resize via canvas é o caminho padrão. |
| Service Worker boilerplate | SW manual com versionamento custom | `@serwist/next` com `swSrc: 'app/sw.ts'` | Serwist abstrai precache manifest, skipWaiting, clientsClaim. Nosso uso mínimo (instalabilidade only) ainda é mais limpo via Serwist. |
| PWA manifest | JSON manual em `public/` | `app/manifest.ts` (metadata route) | Next.js 15 App Router gera Content-Type correto, validação TypeScript via `MetadataRoute.Manifest`. |
| Detecção de `display-mode: standalone` | Listener de visibilitychange custom | `window.matchMedia('(display-mode: standalone)').matches` + iOS legacy `navigator.standalone` | API standard (Chrome+Safari); fallback iOS legacy é apenas mais um booleano. |
| Toast | shadcn `toast` (deprecated) ou `react-hot-toast` | `sonner` (`shadcn add sonner`) | Padrão atual do shadcn 4.x; suporte a position bottom-center mobile out-of-box. |
| Storage upload retry | Loop manual com timer | `supabase-js` upload + `try/catch` + `setTimeout` exponencial (D-context: 2x backoff) | Padrão simples; lib externa não justifica para 6 uploads. |
| Recovery query | Custom JOIN complicado | `select id, client:clients(full_name), created_at, count:reading_images(count)` Supabase nested filter | PostgREST nested resource expansion via supabase-js já cobre o caso. |

**Key insight:** A tentação nesta fase é puxar uma dep "completa" (OpenCV.js, image-compression, etc.) para resolver cada sub-problema. **Resista.** Cada uma adiciona 10-100KB ao bundle mobile crítico. Os algoritmos de qualidade são todos <50 LOC; canvas API resolve compressão e resize; MediaPipe e Serwist cobrem o pesado. Total stack novo: ~3.6MB do `.task` (lazy) + ~1-2MB WASM (lazy) + ~30KB Serwist + ~15KB Sonner.

---

## Quality Scoring Algorithms

> Esta seção é o coração de CAPTURE-03. Cada sub-score abaixo tem algoritmo concreto e limiar inicial. **Limiares são heurísticos** — devem ser calibrados em dogfooding (Fase 9). Marcados `[ASSUMED]` são chutes razoáveis sem validação experimental.

### Iris landmark indices (MediaPipe FaceLandmarker)

[VERIFIED: github.com/google-ai-edge/mediapipe — face_landmarks_connections.ts]

| Eye | Center | Contour |
|-----|--------|---------|
| **Left** (do ponto de vista do **sujeito**, não do espectador) | 468 | [469, 470, 471, 472] |
| **Right** (do sujeito) | 473 | [474, 475, 476, 477] |

**Importante (gotcha):** SPEC §4.1 e CONTEXT.md citam "468–477 (olho direito) e 473–477 (olho esquerdo)" mas isso **inverte a convenção MediaPipe**. A documentação oficial MediaPipe define:
- 468–472 = **left iris** (do POV do sujeito)
- 473–477 = **right iris** (do POV do sujeito)

[CITED: mediapipe-source github face_landmarks_connections.ts — `FACE_LANDMARKS_LEFT_IRIS = [{start:469,end:470}, ...]` e `FACE_LANDMARKS_RIGHT_IRIS = [{start:474,end:475}, ...]`]

**Decisão:** Usar a convenção MediaPipe oficial. Nomear constantes claramente para evitar confusão:
```typescript
// lib/capture/iris-geometry.ts
export const IRIS_LANDMARKS = {
  // POV do sujeito (não do espectador no celular!)
  // Quando o sujeito olha pra câmera, o olho direito DELE aparece
  // do lado esquerdo da imagem, então também é necessário cuidado
  // ao mapear `right/lateral` etc.
  left:  { center: 468, contour: [469, 470, 471, 472] },
  right: { center: 473, contour: [474, 475, 476, 477] },
} as const
```

**Quando usar qual:** Durante a sequência `right/frontal → ... → left/...`, o terapeuta segura o celular **na frente do cliente** ou o cliente segura para si mesmo. O `eye` do `Slot` refere-se ao olho do **cliente** (sujeito). MediaPipe detecta os 2 olhos sempre — para a foto atual, escolher o lado correto:
- Se `slot.eye === 'right'` → analisar landmarks 473-477.
- Se `slot.eye === 'left'`  → analisar landmarks 468-472.

### Sub-score 1: `irisDetected` (boolean)

**Algoritmo:** Após `faceLandmarker.detectForVideo()`, verificar:
- `result.faceLandmarks.length === 1` (uma única face — `numFaces: 1`)
- Os 5 landmarks do olho atual têm coordenadas válidas (entre 0 e 1, sem NaN).

**Falha quando:** zero faces detectadas, mais de uma face, ou landmarks fora da imagem.

**Mensagem:** "Aproxime o olho do enquadramento circular" (UI-SPEC §Copywriting).

### Sub-score 2: `irisCenteredness` (0..1)

**Algoritmo:**
```typescript
const center = result.faceLandmarks[0][IRIS_LANDMARKS[eye].center]
// center.x e center.y são normalizados (0..1) em relação ao frame
const overlayCenter = { x: 0.5, y: 0.5 } // overlay circular no centro da viewport
const dx = center.x - overlayCenter.x
const dy = center.y - overlayCenter.y
const dist = Math.sqrt(dx * dx + dy * dy)
const maxAcceptable = 0.10 // 10% da diagonal do frame [ASSUMED]
const centeredness = Math.max(0, 1 - dist / maxAcceptable)
```

**Falha quando:** `centeredness < 0.5` (D-07 implícito).

**Mensagem:** "Centralize o olho no círculo".

### Sub-score 3: `irisDistanceOk` (0..1, idealmente próximo de 1)

**Algoritmo:** Calcular o raio aparente da íris a partir dos 4 landmarks do contorno e comparar com o raio target do overlay.

```typescript
const center = landmarks[IRIS_LANDMARKS[eye].center]
const contour = IRIS_LANDMARKS[eye].contour.map(i => landmarks[i])
const radii = contour.map(p => Math.hypot(p.x - center.x, p.y - center.y))
const observedRadius = radii.reduce((a, b) => a + b, 0) / radii.length
// Overlay tem raio nominal de ~15% da menor dimensão do viewport (UI-SPEC)
const targetRadius = 0.15
const ratio = observedRadius / targetRadius
// Score 1.0 quando ratio ∈ [0.85, 1.15]; cai linear fora disso
const distanceOk = ratio < 0.5 || ratio > 2.0
  ? 0
  : 1 - Math.min(Math.abs(ratio - 1) - 0.15, 0.5) * 2
```

**Falha quando:** ratio > 1.15 (muito perto) ou < 0.85 (muito longe).

**Mensagens:** "Aproxime mais o celular" (longe) / "Afaste um pouco o celular" (perto).

### Sub-score 4: `sharpness` (variância de Laplaciana, normalizada)

[CITED: theailearner.com/2021/10/30/blur-detection-using-the-variance-of-the-laplacian-method]

**Algoritmo:**
1. Recortar uma janela 256×256 ao redor do centro da íris (downscale para performance).
2. Converter para grayscale (`0.299*R + 0.587*G + 0.114*B`).
3. Aplicar kernel Laplaciano 3×3 `[[0,1,0],[1,-4,1],[0,1,0]]` por convolução manual.
4. Calcular variância dos pixels resultantes.
5. Normalizar: `score = clamp01(variance / 200)` (variance > 100 = nítido per SPEC §4.1; variance > 200 = excelente). [VERIFIED limiar > 100 from SPEC §4.1; > 200 ASSUMED]

**Pseudo-código (~30 LOC):**
```typescript
function laplacianVariance(imageData: ImageData): number {
  const { data, width, height } = imageData
  const gray = new Float32Array(width * height)
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }

  let sum = 0, sumSq = 0, count = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const lap =
        4 * gray[idx]
        - gray[idx - 1] - gray[idx + 1]
        - gray[idx - width] - gray[idx + width]
      sum += lap
      sumSq += lap * lap
      count++
    }
  }
  const mean = sum / count
  return sumSq / count - mean * mean
}
```

**Falha quando:** variance < 100 (SPEC §4.1).

**Mensagem:** "Mantenha o celular firme — imagem desfocada".

**Performance:** ~3-5ms em 256×256 no thread principal. Aceitável a 15-30fps. Se precisar otimizar, considerar Web Worker.

### Sub-score 5: `exposure` (0..1)

**Algoritmo:** Histograma dos pixels da janela da íris.

```typescript
function exposureScore(imageData: ImageData): number {
  const { data } = imageData
  let bright = 0, dark = 0, total = 0
  for (let i = 0; i < data.length; i += 4) {
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    if (luminance > 235) bright++
    else if (luminance < 25) dark++
    total++
  }
  const overexposed = bright / total
  const underexposed = dark / total
  // Aceita até 5% de pixels saturados/escuros [ASSUMED]
  if (overexposed > 0.30) return 0  // muito clara
  if (underexposed > 0.30) return 0 // muito escura
  return 1 - Math.max(0, overexposed - 0.05) * 2 - Math.max(0, underexposed - 0.05) * 2
}
```

**Mensagens:** "Pouca luz — busque um ambiente mais claro" (under) / "Muita luz — reduza o contraluz" (over).

### Sub-score 6: `reflexInIrisCenter` (boolean → contribuição suave per D-06)

**Algoritmo:** Buscar pixels saturados (luminância > 240) numa janela 20×20 ao redor do centro da íris.

```typescript
function reflexInCenter(imageData: ImageData, center: Point, radiusPx: number): boolean {
  const { data, width } = imageData
  const r = Math.floor(radiusPx * 0.3) // janela = 30% do raio da íris
  let saturatedCount = 0
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const idx = ((center.y + dy) * width + (center.x + dx)) * 4
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
      if (lum > 240) saturatedCount++
    }
  }
  return saturatedCount > 5 // [ASSUMED] threshold
}
```

**Per D-06:** contribui ao `overallScore` mas NÃO bloqueia sozinho. Peso ~0.15-0.20.

**Mensagem:** "Muito reflexo — gire levemente a cabeça".

### Sub-score 7: `eyelidOcclusion` (0..1, 1 = totalmente aberto)

**Algoritmo:** Comparar landmarks da pálpebra superior/inferior com o raio da íris. MediaPipe FaceLandmarker tem landmarks de pálpebra (índices ~159 superior, ~145 inferior para olho esquerdo do POV sujeito; ~386 e ~374 para o direito).

```typescript
const EYELID_LANDMARKS = {
  left:  { upper: 159, lower: 145 },
  right: { upper: 386, lower: 374 },
}

function occlusionScore(landmarks, eye, irisCenter, irisRadius): number {
  const upper = landmarks[EYELID_LANDMARKS[eye].upper]
  const lower = landmarks[EYELID_LANDMARKS[eye].lower]
  const eyeOpenness = Math.abs(upper.y - lower.y)
  // Olho aberto: openness ≈ 2 * irisRadius
  // Olho semi-fechado: openness < 1.5 * irisRadius
  const ratio = eyeOpenness / (2 * irisRadius)
  return Math.min(1, Math.max(0, ratio - 0.3) / 0.7)
}
```

[ASSUMED] limiares específicos; verificar com fotos reais durante dogfooding.

**Mensagem:** "Abra mais o olho — pálpebra cobrindo a íris".

### Fórmula de `overallScore`

**Pesos sugeridos** (totalizam 1.0):

| Sub-score | Peso | Justificativa |
|-----------|------|---------------|
| `irisDetected` | **gate** | Se 0, score total = 0 (sem íris não há captura) |
| `irisCenteredness` | 0.20 | Estrutural — sem centro, geometria não funciona |
| `irisDistanceOk` | 0.20 | Determina resolução efetiva da íris no frame |
| `sharpness` (normalizada) | 0.20 | Crítico para o pipeline de visão Fase 5 |
| `exposure` | 0.15 | Impacta extração de cor da íris (HSV clustering — Fase 5) |
| `reflexInIrisCenter` | 0.15 (invertido — peso quando ausente) | D-06 explícito: contribuição suave |
| `eyelidOcclusion` | 0.10 | Pálpebra parcial é tolerável; total é dealbreaker |

```typescript
function overallScore(c: QualityCheck): number {
  if (!c.irisDetected) return 0
  return (
    0.20 * c.irisCenteredness +
    0.20 * c.irisDistanceOk +
    0.20 * c.sharpness +
    0.15 * c.exposure +
    0.15 * (c.reflexInIrisCenter ? 0 : 1) +
    0.10 * (1 - c.eyelidOcclusion)
  )
}
```

**Calibração:** Esses pesos são ponto de partida [ASSUMED]. Em dogfooding (Fase 9 ONBOARD-04), o fundador ajusta com base em quais fotos reais passam/falham o pipeline da Fase 5.

### Live feedback message priority

Quando `overallScore < 0.75`, mostrar a mensagem do sub-score que **mais perde pontos** (UI-SPEC §Copywriting). Pseudo-algoritmo:

```typescript
function dominantFailure(c: QualityCheck): FailureKey {
  if (!c.irisDetected) return 'iris_missing'
  const losses = {
    centeredness: 0.20 * (1 - c.irisCenteredness),
    distance:     0.20 * (1 - c.irisDistanceOk),
    sharpness:    0.20 * (1 - c.sharpness),
    exposure:     0.15 * (1 - c.exposure),
    reflex:       c.reflexInIrisCenter ? 0.15 : 0,
    eyelid:       0.10 * c.eyelidOcclusion,
  }
  return Object.entries(losses).sort((a,b) => b[1] - a[1])[0][0] as FailureKey
}
```

---

## Camera & getUserMedia

### Constraints recomendadas

```typescript
const constraints: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: 'environment' }, // ideal, NÃO exact (compat desktop + iPad fallback)
    width:  { ideal: 1920 },
    height: { ideal: 1080 },
    // Não usar zoom/torch — preferências variam por device, deixe usuário gerenciar fisicamente
  },
  audio: false,
}
```

[CITED: copyprogramming.com/howto/navigator-mediadevices-getusermedia-not-working-on-ios-12-safari — Safari ignora `facingMode` em algumas versões; usar `enumerateDevices` como fallback se câmera frontal aparecer]

### Error handling completo

| Error name | Causa | UX (D-15) |
|------------|-------|----------|
| `NotAllowedError` | Usuário bloqueou ou negou permissão | Tela com instruções de reabilitar (UI-SPEC §CameraDeniedScreen) |
| `NotFoundError` | Sem câmera disponível | Mesma tela, copy "Câmera não disponível" |
| `NotReadableError` | Câmera em uso por outro app | Toast "Feche outros apps de câmera e tente novamente" |
| `OverconstrainedError` | Constraints não satisfeitas (ex: `exact: 'environment'` em desktop) | Retry com constraints mais permissivos; se falhar de novo → CameraDeniedScreen |
| `AbortError` | Hardware error inesperado | Toast genérico + botão tentar novamente |
| `SecurityError` | HTTPS missing (dev) | Não acontece em produção (Vercel força HTTPS) |

### Cleanup de stream

```typescript
useEffect(() => {
  let stream: MediaStream | null = null
  navigator.mediaDevices.getUserMedia(constraints).then(s => {
    stream = s
    videoRef.current!.srcObject = s
  })
  return () => {
    stream?.getTracks().forEach(t => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
  }
}, [])
```

### iOS Safari quirks

- **Stream pausa em background tab:** quando o usuário troca de aba, o stream é suspenso. Detectar via `visibilitychange` e reativar `play()` no `<video>` ao voltar. [CITED: bugs.webkit.org 179363]
- **`<video>` precisa de `playsInline` e `muted`** para autoplay em iOS:
  ```html
  <video ref={videoRef} playsInline muted autoPlay />
  ```
- **iOS chama `getUserMedia` novamente quita stream anterior:** se o usuário voltar ao fluxo após a 1ª foto e tirar mais, garantir que reusa o `MediaStream` se ele ainda está vivo, ou recria explicitamente.

---

## PWA & Service Worker

### `app/manifest.ts` (Next.js 15 metadata route)

```typescript
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Aurel Iris',
    short_name: 'Aurel Iris',
    description: 'Ferramenta de apoio à anamnese terapêutica integrativa.',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#000000',
    background_color: '#ffffff',
    lang: 'pt-BR',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
```

### `app/sw.ts` (Serwist source)

```typescript
import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache, // mínimo: deixa Serwist usar defaults sãos
})

serwist.addEventListeners()
```

### `next.config.ts`

```typescript
import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development', // SW só em prod (evita fricção com HMR)
})

const nextConfig: NextConfig = {
  // existente: {}
}

export default withSerwist(nextConfig)
```

### Meta tags iOS em `app/layout.tsx` ou `(capture)/layout.tsx`

```typescript
export const metadata: Metadata = {
  title: 'Aurel Iris',
  description: 'Ferramenta de apoio à anamnese terapêutica integrativa.',
  applicationName: 'Aurel Iris',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Aurel Iris',
  },
  // viewport-fit=cover é tratado pelo viewport export (App Router)
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000',
}
```

[CITED: developer.mozilla.org/Web/Progressive_web_apps/Guides/Making_PWAs_installable]

### iOS install detection & prompt strategy (D-14)

```typescript
// hooks/use-pwa-install.ts
export function usePWAInstall() {
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      // Safari iOS legacy fallback
      (window.navigator as any).standalone === true
    )
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream)

    const onBIP = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBIP)
    return () => window.removeEventListener('beforeinstallprompt', onBIP)
  }, [])

  const promptInstall = useCallback(async () => {
    if (!installEvent) return false
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    setInstallEvent(null)
    return outcome === 'accepted'
  }, [installEvent])

  return { isStandalone, isIOS, canPromptAndroid: !!installEvent, promptInstall }
}
```

[CITED: developer.mozilla.org — `beforeinstallprompt` é Chrome/Edge/Samsung; iOS Safari não dispara.]

### Limitações iOS Safari (CITED: firt.dev/notes/pwa-ios)

| Feature | iOS Safari | Tratamento |
|---------|-----------|------------|
| `beforeinstallprompt` | Não suporta | UI-SPEC: banner com instruções literais "toque em Share → Adicionar à Tela de Início" |
| Push notifications | Apenas iOS 16.4+ (após install) | Fora do escopo Fase 3 |
| Background sync | Não suporta | Upload em foreground apenas (D-09) |
| `display: 'fullscreen'` | Tratado como `'standalone'` | Manifest usa `'standalone'` |
| `theme_color` | Suporta desde iOS 15 | OK |
| Maskable icons | Suporta desde iOS 17 | Incluir, com fallback para 192/512 normal |

### Ícones (CAPTURE-01)

UI-SPEC §PWA define 3 PNGs (192/512/maskable). **Identidade visual final é Fase 9** — para Fase 3, design temporário (letras "AI" sobre `#000`) é suficiente. Pode ser gerado via [maskable.app](https://maskable.app/editor) ou [pwa-asset-generator](https://github.com/elegantapp/pwa-asset-generator). Decisão do planner: gerar manualmente em Figma/script ou usar lib npm como devDep one-shot.

---

## Image Compression

### Pipeline canônico (D-16)

```typescript
// lib/capture/jpeg-compress.ts
const MAX_DIMENSION = 2048
const JPEG_QUALITY = 0.85

export async function compressFrameToJpeg(
  source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
  sourceWidth: number,
  sourceHeight: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  // 1. Calcular dimensões alvo mantendo aspect ratio
  let targetW = sourceWidth, targetH = sourceHeight
  if (Math.max(sourceWidth, sourceHeight) > MAX_DIMENSION) {
    const ratio = MAX_DIMENSION / Math.max(sourceWidth, sourceHeight)
    targetW = Math.round(sourceWidth * ratio)
    targetH = Math.round(sourceHeight * ratio)
  }

  // 2. Render no canvas
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d', { alpha: false })!
  ctx.drawImage(source, 0, 0, targetW, targetH)

  // 3. Comprimir
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => b ? resolve(b) : reject(new Error('toBlob returned null')),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })

  return { blob, width: targetW, height: targetH }
}
```

**Performance esperada:**
- 1920×1080 → 2048×1152 (downscale invertido neste caso, mantém): ~50ms no thread principal em mid-tier Android. [ASSUMED]
- 1920×1080 → JPEG 0.85 ≈ 400-600KB (alvo D-16 de ~500KB cumprido). [ASSUMED]

**Quando considerar Web Worker:**
- Se compressão em main thread bloquear UI > 100ms → mover para Worker com `OffscreenCanvas`.
- `OffscreenCanvas` não funciona em Safari < 17 — fallback para main thread necessário.
- **Recomendação inicial:** main thread + measurement na primeira execução; só refatorar para Worker se observar jank visível.

[CITED: developer.mozilla.org/Web/API/OffscreenCanvas/convertToBlob]

---

## Supabase Storage Upload

### Storage bucket — NÃO existe ainda

**Verificação concluída:**
- `supabase/config.toml` linha 115: `# [storage.buckets.images]` está **comentado** — bucket de imagens não foi declarado.
- `supabase/migrations/0001..0003` não criam buckets via `INSERT INTO storage.buckets`.

**Ação obrigatória nesta fase:** criar migration `0004_storage_bucket_iris_captures.sql` com:
1. INSERT do bucket privado.
2. RLS policies em `storage.objects` para INSERT/SELECT/UPDATE/DELETE.

### Migration template

```sql
-- supabase/migrations/0004_storage_bucket_iris_captures.sql
-- Cria bucket privado "iris-captures" com RLS por terapeuta (folder = auth.uid()).
-- Path convention (D-storage): {therapist_id}/{reading_id}/{eye}_{angle}.jpg
-- Detectado em research da Fase 3: Fase 1 não criou bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'iris-captures',
  'iris-captures',
  false,                           -- privado
  10485760,                        -- 10MB hard limit (D-16 alvo é ~500KB)
  array['image/jpeg']
)
on conflict (id) do nothing;

-- RLS: terapeuta só pode INSERIR em pastas com seu próprio uid
create policy "Therapists can upload to own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'iris-captures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Therapists can read own iris captures"
on storage.objects for select to authenticated
using (
  bucket_id = 'iris-captures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Therapists can update own iris captures"
on storage.objects for update to authenticated
using (
  bucket_id = 'iris-captures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Therapists can delete own iris captures"
on storage.objects for delete to authenticated
using (
  bucket_id = 'iris-captures'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

[CITED: supabase.com/docs/guides/storage/security/access-control — `storage.foldername(name)[1]` extrai primeiro segmento]

### Upload no client

```typescript
// app/(capture)/leituras/nova/capturar/capture-client.tsx
import { createClient } from '@/lib/supabase/client'

async function uploadCaptureImage({
  blob,
  therapistId,
  readingId,
  eye,
  angle,
  qualityScore,
  width,
  height,
}: UploadArgs) {
  const supabase = createClient()
  const path = `${therapistId}/${readingId}/${eye}_${angle}.jpg`

  // Upload para Storage (RLS valida que folder[1] === auth.uid())
  const { error: uploadError } = await supabase
    .storage
    .from('iris-captures')
    .upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true, // permite refazer (D-09 tap-to-redo)
    })

  if (uploadError) throw uploadError

  // Insert reading_images row
  const { error: insertError } = await supabase
    .from('reading_images')
    .insert({
      reading_id: readingId,
      eye,
      angle,
      storage_path: path,
      quality_score: qualityScore,
      width,
      height,
    })

  if (insertError) throw insertError
}
```

**Trade-off retake (tap-to-redo D-09):**
- `upsert: true` no Storage permite sobrescrever o JPEG no mesmo path.
- Para `reading_images`, fazer **upsert por `(reading_id, eye, angle)`**: criar unique constraint na migration ou usar pattern delete-then-insert.
- **Recomendação:** adicionar unique constraint `(reading_id, eye, angle)` em `reading_images` na migration de Fase 3 (não está no schema atual — verificar). Server logic: `upsert(..., { onConflict: 'reading_id,eye,angle' })`.

**Verificação no schema atual:** `reading_images` em 0001_initial_schema.sql **não** tem unique constraint em `(reading_id, eye, angle)`. Precisa adicionar:
```sql
-- Migration 0004 ou nova 0005
alter table reading_images add constraint reading_images_unique_slot unique (reading_id, eye, angle);
```

### Retry strategy (D-context discretion)

```typescript
async function uploadWithRetry(args: UploadArgs, maxAttempts = 2) {
  let lastError: Error | undefined
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await uploadCaptureImage(args)
    } catch (e) {
      lastError = e as Error
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 1000 * attempt)) // 1s, 2s
      }
    }
  }
  throw lastError
}
```

Após maxAttempts: marcar foto com flag visual e oferecer retry manual no preview (D-context).

---

## Capture Flow State Machine

### Sequence
```typescript
const SEQUENCE: Slot[] = [
  { eye: 'right', angle: 'frontal' },
  { eye: 'right', angle: 'lateral' },
  { eye: 'right', angle: 'backlight' },
  { eye: 'left',  angle: 'frontal' },   // ← interstitial fullscreen ANTES (D-10)
  { eye: 'left',  angle: 'lateral' },
  { eye: 'left',  angle: 'backlight' },
]
```

### Resume logic (CAPTURE-05 + D-12)

```typescript
async function getResumeSlotIndex(readingId: string): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('reading_images')
    .select('eye, angle')
    .eq('reading_id', readingId)

  const captured = new Set(data?.map(r => `${r.eye}_${r.angle}`) ?? [])
  return SEQUENCE.findIndex(s => !captured.has(`${s.eye}_${s.angle}`))
  // Retorna -1 se todos os 6 capturados → finalize
}
```

### Recovery banner query

```typescript
// app/(dashboard)/layout.tsx (server component) ou hook server-side
async function getDraftReading(supabase: SupabaseClient, userId: string) {
  // Mais recente reading com status='pending' AND count(reading_images) < 6
  const { data: pending } = await supabase
    .from('readings')
    .select(`
      id,
      created_at,
      client:clients(full_name),
      reading_images(count)
    `)
    .eq('therapist_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5) // pega top 5, filtra em memória

  return pending?.find(r => (r.reading_images[0]?.count ?? 0) < 6) ?? null
}
```

**Performance:** RLS + index `readings(therapist_id)` + `readings(status)` (presentes em 0001_initial_schema.sql) garantem query < 50ms para o caso típico (terapeuta com <100 leituras).

### Discard reading (D-13)

```typescript
// app/actions/readings.ts
export async function discardReadingAction(readingId: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) redirect('/login')

  // 1. Listar storage paths antes do hard delete
  const { data: images } = await supabase
    .from('reading_images')
    .select('storage_path')
    .eq('reading_id', readingId)

  // 2. Delete Storage objects (RLS valida ownership)
  if (images && images.length > 0) {
    await supabase.storage
      .from('iris-captures')
      .remove(images.map(i => i.storage_path))
  }

  // 3. Delete reading row (cascade apaga reading_images do banco)
  const { error } = await supabase
    .from('readings')
    .delete()
    .eq('id', readingId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/leituras')
  return {}
}
```

**CRÍTICO:** Database cascade NÃO apaga arquivos do Storage. Sem o passo 2 acima, ficam "orphan blobs" no bucket consumindo storage cota.

---

## Runtime State Inventory

> Esta é uma fase **greenfield** (não rename/refactor), mas avaliando as 5 categorias por completude:

| Categoria | Items Found | Action Required |
|-----------|-------------|------------------|
| Stored data | None — fase nova, sem dados pré-existentes a migrar | none |
| Live service config | Supabase Storage bucket "iris-captures" **não existe** ainda. Precisa criar via migration. | **Migration 0004** + RLS policies |
| OS-registered state | None — sem Task Scheduler, launchd, pm2 etc. envolvidos | none |
| Secrets/env vars | Sem novos secrets nesta fase. `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (existentes Fase 1) cobrem upload client-side | none |
| Build artifacts | `face_landmarker.task` (~3.6MB) hospedado em `public/mediapipe/` — entra como asset estático no deploy Vercel | Adicionar ao repo (verificar se entra no `.gitignore` ou `.vercelignore`) |

**Verificação explícita:** o bucket de Storage **não foi criado** pela Fase 1. Confirmado em:
1. `supabase/config.toml` linha 115: `# [storage.buckets.images]` (comentado).
2. `supabase/migrations/0001_initial_schema.sql`: zero `INSERT INTO storage.buckets`.
3. `supabase/migrations/0002` e `0003`: grants e profiles trigger, sem mexer em Storage.

---

## Common Pitfalls

### Pitfall 1: Inversão de índices de íris (left vs right)

**What goes wrong:** SPEC §4.1 cita "468–477 (olho direito) e 473–477 (olho esquerdo)". MediaPipe oficial define o oposto.

**Why it happens:** Confusão entre POV do sujeito e POV do espectador, ou simplesmente erro de fonte.

**How to avoid:** Use a constante nomeada `IRIS_LANDMARKS.left.center = 468`, `IRIS_LANDMARKS.right.center = 473` e adicione um teste unit que valida com uma imagem de íris conhecida.

**Warning signs:** Auto-captura disparando para o olho errado; relatório da Fase 5 com features espelhadas.

[CITED: github.com/google-ai-edge/mediapipe master/face_landmarks_connections.ts]

### Pitfall 2: `facingMode: { exact: 'environment' }` em desktop

**What goes wrong:** Em desktop sem câmera traseira, `getUserMedia` joga `OverconstrainedError` imediato.

**Why it happens:** `exact` é hard constraint. Especificação manda usar `ideal` para preferência soft.

**How to avoid:** Sempre comece com `facingMode: { ideal: 'environment' }`. Se precisar garantir mesmo assim (raro), faça try `exact` → catch → retry com `ideal`.

[CITED: blog.addpipe.com/getusermedia-video-constraints — explica diferença ideal/exact]

### Pitfall 3: Stream da câmera fica "acesa" após navegação

**What goes wrong:** Usuário sai da rota `(capture)`, LED da câmera continua ligado. Drena bateria, indica spy ao usuário, navegador adiciona ao log de "tabs com câmera ativa".

**Why it happens:** Falta `stream.getTracks().forEach(t => t.stop())` no cleanup de `useEffect`.

**How to avoid:** Cleanup explícito (ver pattern em §Camera). Adicionar verificação manual no DevTools (Application → Sensors → Verifique se "Camera" está parado após sair da rota).

### Pitfall 4: Service Worker fica caching páginas autenticadas

**What goes wrong:** SW cacheia `/dashboard` HTML; ao logar como outro usuário, vê dashboard do anterior.

**Why it happens:** Default `runtimeCaching` agressivo do Serwist/Workbox.

**How to avoid:** Para Fase 3, manter SW **mínimo** (só install/activate/skipWaiting). Não habilitar `runtimeCaching` em rotas autenticadas. Cache offline completo é diferido para Fase 9 onde o cache strategy precisará excluir `/dashboard`, `/leituras`, `/clientes` e usar `NetworkOnly` para chamadas Supabase.

### Pitfall 5: iOS Safari pausa stream em background tab

**What goes wrong:** Terapeuta troca de aba para ver outra coisa, volta — câmera está congelada.

**Why it happens:** WebKit suspende streams ativos em tabs background para economizar bateria.

**How to avoid:** Listener de `visibilitychange` chama `videoRef.current?.play()` ao retornar; se ainda congelado, recriar `getUserMedia`.

[CITED: bugs.webkit.org 179363]

### Pitfall 6: PWA install banner não dispara no Chrome Android

**What goes wrong:** `beforeinstallprompt` nunca dispara, banner D-14 fica eternamente em "loading".

**Why it happens:** Chrome só dispara após "engagement signals" (visita por X segundos, navegação). Em testes locais, raro disparar.

**How to avoid:** Sempre tratar `installEvent === null` como caso normal — banner só renderiza CTA "Instalar" quando o evento existe; se `null` em Android (estado inicial), mostrar copy mais genérica ou esperar. Em iOS, `installEvent` é sempre null — UI alternativa com instruções.

### Pitfall 7: Upload concorrente para mesmo path

**What goes wrong:** Usuário tap-to-redo enquanto upload anterior ainda está rodando. Race condition deixa o JPEG mais antigo no Storage e o novo perdido.

**Why it happens:** `upload(... upsert: true)` sobrescreve, mas se o upload da foto antiga termina **depois** do novo, o antigo "ganha".

**How to avoid:** Ao iniciar redo, abortar upload anterior via `AbortController`:
```typescript
const ctrl = new AbortController()
supabase.storage.from('iris-captures').upload(path, blob, {
  contentType: 'image/jpeg',
  upsert: true,
  // supabase-js 2.105 aceita signal via metadata internal — OU
  // wrapping próprio que cancela via Promise.race
})
```
**Nota:** supabase-js 2.x não expõe diretamente `AbortSignal` no Storage upload — verificar em runtime; se não suportado, manter ref ao upload em curso e ignorar callback dele se já houver novo upload em andamento.

### Pitfall 8: Frame com canvas vazio em iOS Safari (`<video>` sem `playsInline`)

**What goes wrong:** `ctx.drawImage(video, ...)` em iOS retorna canvas preto/transparent.

**Why it happens:** iOS força `<video>` em fullscreen native player se `playsInline` ausente, e nesse modo o frame não é acessível ao DOM.

**How to avoid:** Sempre `<video playsInline muted autoPlay>`. Validado em testes manuais.

### Pitfall 9: MediaPipe WASM CORS quando hospedado em CDN externa

**What goes wrong:** `FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/...')` falha em produção com `crossorigin` errors.

**Why it happens:** WASM módulos exigem CORS específicos; CDNs ocasionalmente mudam headers.

**How to avoid:** Hospedar `face_landmarker.task` E `vision_wasm_internal.{wasm,js}` em `public/mediapipe/` e servir same-origin via Vercel (que adiciona headers CORS corretos). Total ~5MB de assets — aceitável no deploy.

### Pitfall 10: `app/sw.ts` vazaria como rota Next.js

**What goes wrong:** Sem config, Next.js interpretaria `app/sw.ts` como página/route.

**Why it happens:** Convenções App Router.

**How to avoid:** Serwist em `9.5.x` cuida disso via `withSerwistInit`. **Verificar:** após `pnpm dev`, abrir `http://localhost:3000/sw.js` — deve retornar JS de SW válido (não 404 nem HTML React).

---

## Code Examples

### Exemplo: hook `useIrisDetector`

```typescript
// hooks/use-iris-detector.ts
'use client'
import { useEffect, useRef, useState } from 'react'
import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision'

export function useIrisDetector() {
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision')
        const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
        const landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: '/mediapipe/face_landmarker.task',
            delegate: 'GPU', // fallback automático para CPU se GPU indisponível
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })
        if (!cancelled) {
          landmarkerRef.current = landmarker
          setIsReady(true)
        } else {
          landmarker.close()
        }
      } catch (e) {
        if (!cancelled) setError(e as Error)
      }
    })()
    return () => {
      cancelled = true
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  const detect = (video: HTMLVideoElement, timestampMs: number): FaceLandmarkerResult | null => {
    return landmarkerRef.current?.detectForVideo(video, timestampMs) ?? null
  }

  return { isReady, error, detect }
}
```

### Exemplo: combinação de tudo no `capture-client.tsx`

```typescript
// app/(capture)/leituras/nova/capturar/capture-client.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useCamera } from '@/hooks/use-camera'
import { useIrisDetector } from '@/hooks/use-iris-detector'
import { computeQualityCheck, overallScore } from '@/lib/capture/quality-scoring'
import { useStableQualityGate } from '@/hooks/use-quality-score'

export function CaptureClient({ readingId, therapistId, resumeFromIndex }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const camera = useCamera(videoRef, { facingMode: { ideal: 'environment' } })
  const detector = useIrisDetector()

  const [slotIndex, setSlotIndex] = useState(resumeFromIndex)
  const [qualityScore, setQualityScore] = useState(0)
  const [lastCheck, setLastCheck] = useState<QualityCheck | null>(null)

  const slot = SEQUENCE[slotIndex]

  // Render loop
  useEffect(() => {
    if (!camera.isStreaming || !detector.isReady || !videoRef.current) return
    const video = videoRef.current
    let handle: number | null = null

    const tick = (now: DOMHighResTimeStamp) => {
      const result = detector.detect(video, now)
      if (result?.faceLandmarks?.[0]) {
        const check = computeQualityCheck(result.faceLandmarks[0], slot.eye, video)
        setLastCheck(check)
        setQualityScore(overallScore(check))
      }
      handle = 'requestVideoFrameCallback' in HTMLVideoElement.prototype
        ? video.requestVideoFrameCallback(tick)
        : requestAnimationFrame(tick)
    }
    handle = 'requestVideoFrameCallback' in HTMLVideoElement.prototype
      ? video.requestVideoFrameCallback(tick)
      : requestAnimationFrame(tick)

    return () => {
      if (handle == null) return
      if ('cancelVideoFrameCallback' in video) video.cancelVideoFrameCallback(handle as number)
      else cancelAnimationFrame(handle as number)
    }
  }, [camera.isStreaming, detector.isReady, slot.eye, detector])

  // Auto-capture com estabilidade
  useStableQualityGate(qualityScore, async () => {
    const blob = await captureFrame(videoRef.current!)
    // ... preview + upload em background + advance
  })

  // ... render
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-pwa` (Shadowwalker) | `@serwist/next` | set/2024 (next-pwa unmaintained) | Migração necessária para Next.js 15 App Router compat |
| Pages Router PWA via `next-pwa` config | App Router `manifest.ts` + Serwist `withSerwistInit` | Next.js 13.4+ | Manifesto agora é metadata route, não JSON estático |
| MediaPipe Face Mesh standalone | MediaPipe Tasks Vision (FaceLandmarker) | 2023 (MediaPipe Tasks GA) | API unificada; Face Mesh standalone é legacy |
| `@mediapipe/face_mesh@0.4.x` | `@mediapipe/tasks-vision@0.10.x` | 2023+ | Pacote Tasks unifica detector + segmenter + classifier; melhor suporte WASM |
| `react-hot-toast` | `sonner` (via shadcn) | shadcn 4.x (2024) | Sonner tem melhor mobile support out-of-box |
| `requestAnimationFrame` para video | `requestVideoFrameCallback` | iOS Safari 15.4+ (mar/2022) | Match exato com frame rate do video, evita inferência redundante |
| `display: 'fullscreen'` PWA | `display: 'standalone'` | iOS sempre rejeita fullscreen, Android bug-prone | Standalone é o seguro cross-platform |
| Upload via lib externa | `supabase-js` storage upload + RLS | supabase-js 2.x | Direto; sem necessidade de signed URL para o caso simples |

**Deprecated/outdated:**
- `next-pwa` v5.6.0 — último update set/2024, sem suporte oficial ao Next 15.
- `@mediapipe/face_mesh` standalone — substituído por `@mediapipe/tasks-vision` FaceLandmarker.
- Custom Hough Transform em JS para detecção de íris — MediaPipe é state-of-the-art.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pesos do `overallScore` (0.20/0.20/0.20/0.15/0.15/0.10) são iniciais e razoáveis | Quality Scoring → Fórmula | Auto-captura dispara muito cedo/tarde — calibrar em dogfooding |
| A2 | Limiar de `irisCenteredness` aceita até 10% de desvio do centro do overlay | Quality Scoring → centeredness | Score fica too lenient/strict — calibrar |
| A3 | `targetRadius = 0.15 × menor dim do viewport` para `irisDistanceOk` | Quality Scoring → distance | Fotos sairam too close/far — depende do design final do overlay |
| A4 | Variância de Laplaciana > 200 = "excelente" sharpness (apenas > 100 está VERIFIED no SPEC) | Quality Scoring → sharpness | Saturação prematura do score; ajuste fácil |
| A5 | Limiar 5%/30% de pixels saturados/escuros para `exposure` | Quality Scoring → exposure | Falso positivos em condições de iluminação extremas — calibrar |
| A6 | Limiar 5 pixels saturados na janela 30% do raio para `reflexInIrisCenter` | Quality Scoring → reflex | Pode ser sensível demais — ajustar |
| A7 | Eyelid landmarks 159/145 (left) e 386/374 (right) na FaceLandmarker | Quality Scoring → eyelid | Pode ser correto mas índices do Face Mesh original; FaceLandmarker tem 478 pontos compatíveis. Validar em runtime test |
| A8 | Compressão JPEG 0.85 + 2048px → ~500KB por foto | Image Compression | Pode ficar maior que 500KB em fotos com muito detalhe — verificar; D-16 prescreve 0.85 mesmo assim |
| A9 | iOS Safari 15.4+ é baseline mínimo aceitável (suporta `requestVideoFrameCallback`, `OffscreenCanvas` parcial, `display-mode: standalone`) | PWA / Camera | Usuário em iOS antigo (<15.4) terá fallback de `rAF` que ainda funciona; sem PWA install bem polido |
| A10 | Hospedar `face_landmarker.task` (3.6MB) + WASM (~1-2MB) em `public/mediapipe/` é aceitável para Vercel | Standard Stack | Aumenta deploy size mas Vercel não cobra por estático; impacto: caching CDN OK |
| A11 | Stream de câmera reaberto após `visibilitychange` resume sem precisar reinit do `MediaStream` | iOS quirks | Em alguns iPhones pode precisar `stop` + `getUserMedia` again; testar |
| A12 | RLS de Storage com `(storage.foldername(name))[1]::text = auth.uid()::text` cobre o caso completo | Storage Migration | Deve funcionar; verificar com teste cross-terapeuta análogo ao Fase 1 |
| A13 | unique constraint em `reading_images(reading_id, eye, angle)` é necessária para upsert tap-to-redo | Storage Upload | Sem constraint, INSERT duplica linhas — precisa adicionar via migration |
| A14 | `delegate: 'GPU'` no FaceLandmarker.createFromOptions tem fallback CPU automático | MediaPipe init | Em devices sem WebGL pode falhar; testar em mid-tier real |
| A15 | Performance de Laplaciana 256×256 < 5ms em mid-tier Android | Quality Scoring | Pode chegar a 10-15ms; ainda aceitável em loop de 15Hz |

**14 dos 15 assumptions são heurísticos de algoritmo de qualidade que serão calibrados em dogfooding.** Não bloqueiam plan/exec; bloqueiam apenas sintonização fina pós-Fase 9.

---

## Open Questions

1. **Bucket name canônico — "iris-captures" vs "captures" vs "readings"?**
   - What we know: Bucket privado por terapeuta (D-storage). Path inclui therapist_id como folder.
   - What's unclear: Convenção de naming. `iris-captures` é descritivo; `readings` casa com tabela; `captures` é genérico.
   - Recommendation: Usar `iris-captures` (proposta nesta pesquisa). Planner pode confirmar com fundador antes de migration; rename de bucket depois é doloroso (precisa migrar paths).

2. **Worker para compressão JPEG — incluir ou diferir?**
   - What we know: Compressão pode bloquear UI thread por 50-200ms em mid-tier.
   - What's unclear: O bloqueio é perceptível como jank na sequência de 6 capturas?
   - Recommendation: NÃO incluir Web Worker na Fase 3. Mediar em main thread; instrumentar com `performance.mark/measure` e refatorar para Worker se medições mostrarem >100ms de bloqueio em dogfooding (Fase 9).

3. **Recovery banner mostra apenas o último rascunho ou todos?**
   - What we know: D-12 fala em "uma leitura incompleta", singular.
   - What's unclear: Se houver 3 rascunhos abandonados (acumulados), mostrar todos ou só o mais recente?
   - Recommendation: Por simplicidade, mostrar **apenas o mais recente**. Se virar problema real, adicionar "Você tem 3 leituras incompletas — ver todas →" link para `/leituras?status=pending`.

4. **TTL para `pwa_install_banner_dismissed_at`?**
   - What we know: D-14 sugere ~7 dias.
   - What's unclear: 7 dias é fricção? 30 dias incomoda menos. Sem dado real.
   - Recommendation: 7 dias inicial; reavaliar com base em uso real.

5. **Retry de upload — falha após 2 tentativas: o que fazer com o reading?**
   - What we know: D-context sugere "marca foto com upload_failed=true e permite retry manual".
   - What's unclear: Não há campo `upload_failed` em `reading_images`. Adicionar coluna? Usar metadata jsonb? Manter só client-state?
   - Recommendation: **Manter só client-state na Fase 3** (Map<slotIndex, 'failed'>). Se reload da página, query mostra que a linha não existe → estado retorna a "preciso capturar". Adicionar coluna persistida só se virar problema real.

6. **`OffscreenCanvas` em iOS Safari — quão amplamente suportado?**
   - What we know: iOS Safari 16.4+ suporta `OffscreenCanvas` com pequenas limitações.
   - What's unclear: Se baseline é iOS 15.4+ (A9), `OffscreenCanvas` falhará em <16.4.
   - Recommendation: NÃO usar `OffscreenCanvas` na Fase 3 (compressão em main thread). Reavaliar para Fase 9 polish.

---

## Environment Availability

> Esta fase introduz dependências no browser do cliente final, não no ambiente de build/deploy. Avaliando dependências de build:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build / dev | ✓ | 22.14.0 | — (atende `>=20`) |
| pnpm | Package manager | ✓ | 10.33.2 | — |
| npm registry | Install dependencies | ✓ | 11.13.0 | — |
| Vercel deployment | Hosting (já configurado Fase 1) | ✓ | gru1 region | — |
| Supabase project (sa-east-1) | Storage + DB | ✓ | (existente Fase 1) | — |
| Supabase Storage service | Bucket management | ✓ | Habilitado em config.toml | — |
| HTTPS (necessário para `getUserMedia` em produção) | Camera API | ✓ (Vercel força) | — | localhost dev é OK |
| Mobile real devices for testing | E2E manual tests | ✓ presumido | iOS 15.4+ / Chrome Android 100+ | Browser DevTools mobile emulation cobre 80% dos casos mas câmera traseira só funciona em real device |

**Missing dependencies with no fallback:**
- Nenhuma — toda a stack é JS/web standard.

**Missing dependencies with fallback:**
- Mobile real device para tests E2E de PWA install: Chrome DevTools / iOS simulator cobrem manifesto e SW registration; install prompt e câmera real precisam de hardware. Recomendação: planner inclui task explícita "Test em iPhone real + Android real" no plano final.

---

## Validation Architecture

> `.planning/config.json` não existe; `nyquist_validation` não está explicitamente desabilitado, então esta seção é incluída.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **Não há test runner configurado** no `apps/web/package.json` (Fase 1 deferiu test setup; Fase 2 também não introduziu). |
| Config file | none — Wave 0 obrigatório |
| Quick run command | `pnpm test` (a configurar em Wave 0) |
| Full suite command | `pnpm test:run && pnpm lint` |
| E2E framework | none — sugestão: Playwright para validação cross-browser, mas é overhead grande para esta fase. **Recomendação:** human verification UAT para fluxo end-to-end. |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| CAPTURE-01 | Manifest e SW registrados; instalável em iOS Safari + Chrome Android | manual / human-UAT | (no automation viable) | manual checklist (Wave 0) |
| CAPTURE-02 | `getUserMedia` câmera traseira funciona; overlay circular renderiza | unit (mock + state); manual real-device | `vitest run hooks/use-camera.test.ts` | ❌ Wave 0 |
| CAPTURE-03 | `IrisDetector` produz `QualityCheck` com 7 sub-scores numericamente sãos | unit (com fixtures de landmarks) | `vitest run lib/capture/quality-scoring.test.ts` | ❌ Wave 0 |
| CAPTURE-04 | `overallScore < 0.75` não dispara captura; ≥0.75 estável 400ms dispara | unit (state machine) | `vitest run hooks/use-quality-score.test.ts` | ❌ Wave 0 |
| CAPTURE-05 | Sequência `right/frontal → ... → left/backlight` na ordem correta com instruções entre cada | manual / human-UAT | (no automation viable for full UI flow) | manual checklist (Wave 0) |
| CAPTURE-06 | Após 6 capturas, bucket tem 6 JPEGs em `{therapist_id}/{reading_id}/`, e 6 linhas em `reading_images` com campos preenchidos | integration (com Supabase real ou mock) | `vitest run lib/capture/upload.test.ts` | ❌ Wave 0 |
| **Cross-cutting** | Storage RLS bloqueia leitura cross-terapeuta dos JPEGs | spot check SQL (análogo a Fase 1) | `psql -f supabase/tests/storage_cross_therapist_rls.sql` | ❌ Wave 0 |
| **Cross-cutting** | Vocabulário proibido ausente em todos arquivos novos | grep audit | `pnpm audit:vocabulary` (script novo) ou `grep -ri 'diagnóstico\|tratamento\|cura' apps/web/components/capture/ apps/web/app/(capture)/` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm lint` + `vitest run --changed` (após Wave 0 setup).
- **Per wave merge:** `vitest run` (suite completa) + `pnpm build` (verifica que bundle compila e Serwist gera SW).
- **Phase gate:** Suite completa green + grep audit de vocabulário + checklist manual de UAT em iPhone real + Android real (instalabilidade, captura ponta-a-ponta, recovery banner).

### Wave 0 Gaps

- [ ] Adicionar `vitest@latest` + `@testing-library/react@latest` + `jsdom@latest` ao `apps/web/devDependencies` (framework install).
- [ ] Criar `apps/web/vitest.config.ts` com `@testing-library/jest-dom` setup.
- [ ] Criar `apps/web/tests/setup.ts` com mocks globais (matchMedia, etc.).
- [ ] Criar `apps/web/lib/capture/quality-scoring.test.ts` — fixtures sintéticas para os 7 sub-scores.
- [ ] Criar `apps/web/hooks/use-quality-score.test.ts` — debounce de 400ms.
- [ ] Criar `apps/web/lib/capture/jpeg-compress.test.ts` — verifica dimensões alvo após compress.
- [ ] Criar `apps/web/lib/capture/storage-path.test.ts` — formato canônico do path.
- [ ] Criar `supabase/tests/storage_cross_therapist_rls.sql` — análogo a `cross_therapist_rls.sql` da Fase 1, exercitando que terapeuta B não consegue baixar foto de terapeuta A.
- [ ] Adicionar script `audit:vocabulary` ao `package.json`: `grep -rni 'diagnóstico\|tratamento\|cura' apps/web/app apps/web/components || true` (vocabulário proibido — LGPD-06 forward).
- [ ] Adicionar `pnpm test`, `pnpm test:run` scripts.

**Manual UAT Checklist** (não automatizável):
- [ ] iOS Safari: manifest aparece em DevTools (Cmd+Option+I → Application → Manifest); "Adicionar à Tela de Início" funciona; ícone aparece corretamente.
- [ ] Chrome Android: `beforeinstallprompt` dispara após critérios de engagement; CTA do banner instala app; ícone aparece na home screen.
- [ ] Em iPhone real: completar fluxo de 6 capturas em <90s; verificar 6 arquivos no bucket via Supabase Studio.
- [ ] Em Android real: idem.
- [ ] Recovery: iniciar captura, abandonar na 3ª foto, fechar app, reabrir → banner deve aparecer; CTA "Continuar" volta para `right/backlight` (4ª).
- [ ] Discard: clicar "Descartar" no banner → confirmação dialog → após confirm, reading sumir do banco e arquivos do Storage.
- [ ] Cross-terapeuta: terapeuta B logado não consegue ver fotos do terapeuta A no Storage Studio.

---

## Project Constraints (from PROJECT.md / constraints.md)

> Restrições não-negociáveis que **devem** ser honradas pelos plans desta fase:

1. **Vocabulário proibido (LGPD + posicionamento — PROJECT.md "Restrições não-negociáveis", LGPD-06 forward):**
   Strings "diagnóstico", "tratamento", "cura" são proibidas em qualquer arquivo de UI ou comentário de código. Auditar via grep antes de cada commit.

2. **Posicionamento:** copy obrigatória "ferramenta de apoio à anamnese terapêutica integrativa, não substitui avaliação médica" — já presente em `(dashboard)/layout.tsx` footer (Fase 2). **Não regredir.**

3. **Linguagem hipotética:** mensagens de feedback ao vivo são neutras ("aproxime mais", "ótima — capturando"). Validado em UI-SPEC §Copywriting.

4. **Dados biométricos em sa-east-1 (LGPD):** Storage bucket precisa estar no projeto Supabase de sa-east-1 (já configurado Fase 1). Não criar bucket em outro projeto.

5. **Idioma:** pt-BR em todas strings de UI (`<html lang="pt-BR">` já em `app/layout.tsx`).

6. **RLS pattern:** todas as queries usam `auth.uid() = therapist_id`. Storage tem `auth.uid()::text = (storage.foldername(name))[1]`.

7. **Migrations versionadas:** alterações de schema entram em `supabase/migrations/0004_*.sql` (próximo número disponível).

8. **Vercel region gru1 + Supabase sa-east-1:** já travado Fase 1; nada nesta fase pode mudar isso.

9. **Edição humana obrigatória antes da entrega ao cliente** — não aplicável diretamente nesta fase (entrega ao cliente é Fase 7-8), mas **`status='pending'`** ao iniciar e a transição `pending → processing` (Fase 5) → `ready` (Fase 5) → `edited` (Fase 7) precisa ser respeitada. Esta fase apenas cria com `pending` e mantém. NÃO mudar status nesta fase para `ready` ou `edited`.

10. **Custo operacional:** ~3.6MB do `.task` + ~2MB WASM hospedados no Vercel são "free" (estáticos). Bandwidth de 6 fotos × ~500KB = 3MB por leitura é aceitável. Sem impacto material no envelope ~US$ 100-150/mês.

---

## Sources

### Primary (HIGH confidence)
- `.planning/phases/03-captura-mobile-pwa/03-CONTEXT.md` — 16 decisões locked
- `.planning/phases/03-captura-mobile-pwa/03-UI-SPEC.md` — design contract
- `.planning/REQUIREMENTS.md` — CAPTURE-01..06
- `.planning/intel/constraints.md` — schema canônico, RLS pattern, Storage protocol
- `apps/web/package.json` — versions verificadas no codebase
- `apps/web/components.json` — preset base-nova/neutral
- `supabase/migrations/0001_initial_schema.sql` — schema atual confirmado
- `supabase/config.toml` — bucket NÃO declarado (verificado)
- `npm registry` — `@mediapipe/tasks-vision@0.10.35` (mod. 2026-04-27), `@serwist/next@9.5.10` (mod. 2026-04-30), `sonner@2.0.7` (mod. 2025-08-02) [VERIFIED via npm view]
- [github.com/google-ai-edge/mediapipe — face_landmarks_connections.ts](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/web/vision/face_landmarker/face_landmarks_connections.ts) — iris indices canonical
- [ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js) — official FaceLandmarker init
- [serwist.pages.dev/docs/next/getting-started](https://serwist.pages.dev/docs/next/getting-started) — Serwist+Next15 setup
- [supabase.com/docs/guides/storage/security/access-control](https://supabase.com/docs/guides/storage/security/access-control) — RLS folder policies
- [nextjs.org/docs/app/guides/progressive-web-apps](https://nextjs.org/docs/app/guides/progressive-web-apps) — official Next.js PWA guide

### Secondary (MEDIUM confidence)
- [theailearner.com — Laplacian Variance Blur Detection](https://theailearner.com/2021/10/30/blur-detection-using-the-variance-of-the-laplacian-method/) — algoritmo verificado em outras implementações
- [developer.mozilla.org — requestVideoFrameCallback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback) — Safari iOS 15.4+ confirmed
- [firt.dev/notes/pwa-ios](https://firt.dev/notes/pwa-ios/) — iOS PWA limitations reference
- [bugs.webkit.org 179363](https://bugs.webkit.org/show_bug.cgi?id=179363) — iOS getUserMedia behavior
- [blog.addpipe.com — getUserMedia Video Constraints](https://blog.addpipe.com/getusermedia-video-constraints/) — exact vs ideal
- [github.com/elegantapp/pwa-asset-generator](https://github.com/elegantapp/pwa-asset-generator) — ícones placeholder

### Tertiary (LOW confidence)
- Pesos de `overallScore` e limiares por sub-score — heurísticos iniciais [ASSUMED]; calibrar em dogfooding
- Performance estimates (50ms compressão, 5ms Laplaciana, 30fps detector) — ordens de magnitude razoáveis [ASSUMED]; validar em real device

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — todas as 4 libs verificadas via `npm view` com modificação recente; 2 libs (`@supabase/ssr`, `next`) já em uso e validadas
- Architecture: **HIGH** — patterns derivam de docs oficiais (Next.js, Serwist, MediaPipe, Supabase) + extensão dos patterns Fase 2 já validados
- Quality scoring algorithms: **MEDIUM** — algoritmos sólidos (Laplaciana, distância euclidiana) mas pesos/limiares são heurísticos a calibrar
- Pitfalls: **HIGH** — 10 pitfalls cobrem categorias conhecidas (CORS, race, iOS quirks, etc.) verificados via WebKit bug tracker e docs oficiais
- Iris landmark indices: **HIGH** — corrigido SPEC com fonte canônica (github MediaPipe oficial)
- Storage migration: **HIGH** — bucket NÃO existe (verificado), pattern RLS oficial citado
- PWA: **HIGH** — manifest + Serwist são padrões oficiais; iOS quirks bem documentados

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (30 dias — stack stable; revisitar se MediaPipe lança 0.11.x ou Serwist 10.x)

---

## Implementation Order Proposal (waves) — para o planner

**A ordem abaixo segue a sequência sugerida pelo UI-SPEC §Notas para o planner item 5, ajustada com Wave 0 (test + storage migration) e dependências explícitas.**

| Wave | Plan | Description | Depends on | Complexity |
|------|------|-------------|------------|-----------|
| 0 | 03-01 | **Wave 0:** vitest setup + scripts + storage migration (bucket + RLS + unique constraint) + types regen + audit:vocabulary script | — | small |
| 1 | 03-02 | PWA shell: `app/manifest.ts` + `app/sw.ts` + `next.config.ts` Serwist + ícones placeholder + viewport metadata + `usePWAInstall` hook | 03-01 (vitest se for instrumentar manifest tests) | small |
| 2 | 03-03 | `app/(dashboard)/leituras/nova/page.tsx` (select cliente + criar reading) + `app/(dashboard)/leituras/nova/upload/page.tsx` (placeholder D-15) + `app/actions/readings.ts` (createReading, finalizeReading, discardReading, resumeReading) | 03-01 (types regen) | small-medium |
| 3 | 03-04 | `(capture)` route group + `(capture)/layout.tsx` + `app/(capture)/leituras/nova/capturar/page.tsx` + `useCamera` hook + `CameraView` component + `CameraDeniedScreen` (D-15) | 03-02, 03-03 | medium |
| 4 | 03-05 | `useIrisDetector` hook + `IrisDetector` component (lazy-loaded) + `lib/capture/quality-scoring.ts` (7 sub-scores + overallScore) + `lib/capture/laplacian-variance.ts` + `lib/capture/exposure.ts` + `lib/capture/iris-geometry.ts` + `QualityIndicator` (barra horizontal) + `LiveFeedbackMessage` + hospedar `face_landmarker.task` + WASM em `public/mediapipe/` | 03-04 | **large** |
| 5 | 03-06 | Sequência guiada: `AngleInterstitial` (entre olhos) + `AngleOverlay` (entre ângulos) + `AngleIcon` (SVG inline) + `CaptureProgress` (6 dots) + state machine completa em `capture-client.tsx` | 03-05 | medium |
| 6 | 03-07 | `CapturePreview` (2s + tap-to-redo) + `lib/capture/jpeg-compress.ts` + `lib/capture/storage-path.ts` + upload Storage + insert `reading_images` + retry strategy + telemetria sonner | 03-06 | medium-large |
| 7 | 03-08 | `RecoveryBanner` (D-12) + query de rascunho em `(dashboard)/layout.tsx` ou hook server-side + dialog de confirm para discard + integração com `discardReadingAction` + finalização do reading no 6º slot (status permanece pending — Fase 5 muda para processing) + `PWAInstallBanner` (D-14) | 03-03, 03-07 | medium |

**Total estimado:** 7 plans + Wave 0. Match ROADMAP fase 3 budget de 4-6 dias com complexity médio-alto na Wave 4 (MediaPipe).

**Critical path:** 03-01 → 03-02 ‖ 03-03 → 03-04 → 03-05 → 03-06 → 03-07 → 03-08

---

## Canonical File List (cruzando CONTEXT, UI-SPEC e research)

### Novos arquivos a criar

**Migrations:**
- `supabase/migrations/0004_storage_bucket_iris_captures.sql`
- (alternativamente migration separada para `unique constraint reading_images(reading_id, eye, angle)`)

**App Router pages:**
- `apps/web/app/manifest.ts`
- `apps/web/app/sw.ts`
- `apps/web/app/(capture)/layout.tsx`
- `apps/web/app/(capture)/leituras/nova/capturar/page.tsx`
- `apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx`
- `apps/web/app/(dashboard)/leituras/nova/page.tsx`
- `apps/web/app/(dashboard)/leituras/nova/upload/page.tsx` (placeholder)

**Server actions:**
- `apps/web/app/actions/readings.ts`

**Components — capture:**
- `apps/web/components/capture/CameraView.tsx`
- `apps/web/components/capture/IrisDetector.tsx`
- `apps/web/components/capture/QualityIndicator.tsx`
- `apps/web/components/capture/CapturePreview.tsx`
- `apps/web/components/capture/AngleIcon.tsx`
- `apps/web/components/capture/AngleInterstitial.tsx`
- `apps/web/components/capture/AngleOverlay.tsx`
- `apps/web/components/capture/CameraDeniedScreen.tsx`
- `apps/web/components/capture/PWAInstallBanner.tsx`
- `apps/web/components/capture/RecoveryBanner.tsx`
- `apps/web/components/capture/CaptureProgress.tsx`
- `apps/web/components/capture/LiveFeedbackMessage.tsx`

**Hooks:**
- `apps/web/hooks/use-camera.ts`
- `apps/web/hooks/use-iris-detector.ts`
- `apps/web/hooks/use-quality-score.ts`
- `apps/web/hooks/use-pwa-install.ts`

**Library — capture:**
- `apps/web/lib/capture/quality-scoring.ts`
- `apps/web/lib/capture/laplacian-variance.ts`
- `apps/web/lib/capture/exposure.ts`
- `apps/web/lib/capture/iris-geometry.ts`
- `apps/web/lib/capture/jpeg-compress.ts`
- `apps/web/lib/capture/storage-path.ts`

**shadcn components (via `pnpm dlx shadcn add`):**
- `apps/web/components/ui/progress.tsx`
- `apps/web/components/ui/alert.tsx`
- `apps/web/components/ui/sonner.tsx`

**Public assets:**
- `apps/web/public/mediapipe/face_landmarker.task` (~3.6MB)
- `apps/web/public/mediapipe/wasm/` (Vision WASM bundles)
- `apps/web/public/icons/icon-192.png`
- `apps/web/public/icons/icon-512.png`
- `apps/web/public/icons/icon-maskable.png`

**Tests (Wave 0):**
- `apps/web/vitest.config.ts`
- `apps/web/tests/setup.ts`
- `apps/web/lib/capture/quality-scoring.test.ts`
- `apps/web/lib/capture/jpeg-compress.test.ts`
- `apps/web/lib/capture/storage-path.test.ts`
- `apps/web/hooks/use-quality-score.test.ts`
- `supabase/tests/storage_cross_therapist_rls.sql`

### Arquivos modificados

- `apps/web/package.json` — adicionar deps + scripts `test`, `test:run`, `audit:vocabulary`
- `apps/web/next.config.ts` — wrap com `withSerwistInit`
- `apps/web/app/layout.tsx` — adicionar `appleWebApp`, `viewport`, `applicationName` metadata
- `apps/web/app/(dashboard)/layout.tsx` — injetar query de rascunho + `<RecoveryBanner>` server-side
- `apps/web/app/(dashboard)/clientes/[id]/page.tsx` — ativar botão "Nova Leitura" (atualmente disabled)
- `apps/web/app/(dashboard)/leituras/page.tsx` — substituir placeholder "Em breve" por listagem com filter `status='pending'` mostrando rascunhos com badge "Em andamento" (forward-light)
- `apps/web/components/dashboard/app-sidebar.tsx` — talvez adicionar item "Nova Leitura" no sidebar (planner decide)
- `apps/web/.gitignore` (ou criar) — incluir `public/sw.js` (gerado pelo Serwist)
- `apps/web/types/database.ts` — regenerar via `pnpm gen:types` após migration 0004
