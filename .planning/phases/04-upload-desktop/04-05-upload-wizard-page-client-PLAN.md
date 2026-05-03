---
phase: 04-upload-desktop
plan: 05
type: execute
wave: 3
depends_on:
  - 01
  - 02
  - 03
  - 04
files_modified:
  - apps/web/app/(dashboard)/leituras/nova/upload/page.tsx
  - apps/web/app/(dashboard)/leituras/nova/upload/upload-client.tsx
autonomous: true
requirements:
  - UPLOAD-01
  - UPLOAD-02

tags:
  - phase-04
  - upload-desktop
  - wizard
  - client

must_haves:
  truths:
    - "page.tsx (server component) lê ?reading=<id> e busca reading via Supabase RLS; redireciona pra /leituras/nova se não existe."
    - "page.tsx redireciona para /leituras/nova/capturar?reading=<id> quando reading.capture_method === 'mobile_camera' (D-04 — método imutável; quem digitou URL errada cai no fluxo correto)."
    - "page.tsx redireciona para /leituras quando reading.status !== 'pending' (já finalizou ou está em processamento)."
    - "upload-client.tsx é client component que clona state machine de capture-client.tsx (Phase = 'instruction' | 'analyzing' | 'previewing' | 'finalizing')."
    - "upload-client.tsx renderiza UploadDropzone (não <input capture>) na phase='instruction'."
    - "upload-client.tsx chama validateUploadFile ANTES de qualquer processamento; rejeição mostra toast com mensagem do FileValidationResult.error."
    - "upload-client.tsx chama convertHeicToJpeg quando needsHeicConversion=true (CONTEXT D-11) — com toast.loading + toast.dismiss."
    - "upload-client.tsx chama analyzeCapturedJpeg do lib/capture/post-capture-analysis.ts SEM modificação (reusa pipeline VLM da Fase 3 — D-09)."
    - "upload-client.tsx usa CapturePreview com mode='upload' (botão diz 'Trocar arquivo')."
    - "upload-client.tsx usa AngleInterstitial com mode='upload' OU equivalente desktop (CTA 'Selecionar arquivo')."
    - "upload-client.tsx chama uploadWithRetry sem modificação (mesmo path canônico {therapist_id}/{reading_id}/originais/{eye}_{angle}.jpg)."
    - "Upload roda em background via Promise registrada em uploadPromisesRef; finalize aguarda todas (D-13)."
    - "Botão X no header chama router.push('/leituras') SEM disparar discardReadingAction (D-14 — preserva rascunho)."
    - "Após 6/6 capturas, finalize chama finalizeReadingAction(readingId) e router.push('/leituras')."
    - "Storage path canônico {therapist_id}/{reading_id}/originais/{eye}_{angle}.jpg consistente com Fase 3 (auditável via grep buildOriginalStoragePath)."
    - "RLS pattern auth.uid() = therapist_id em todas as queries (page.tsx usa client server com RLS implícita)."
    - "Vocabulário proibido LGPD ('diagnóstico', 'tratamento', 'cura') ausente em todas as strings."
  artifacts:
    - path: "apps/web/app/(dashboard)/leituras/nova/upload/page.tsx"
      provides: "Server component que substitui placeholder existente"
      contains: "UploadClient"
      min_lines: 50
    - path: "apps/web/app/(dashboard)/leituras/nova/upload/upload-client.tsx"
      provides: "Wizard client component (state machine + dropzone + reuso de capture libs)"
      exports: ["UploadClient"]
      min_lines: 200
  key_links:
    - from: "apps/web/app/(dashboard)/leituras/nova/upload/upload-client.tsx"
      to: "validateUploadFile + convertHeicToJpeg"
      via: "import from @/lib/upload/{validate-file,heic-to-jpeg}"
      pattern: "from ['\"]@/lib/upload/"
    - from: "apps/web/app/(dashboard)/leituras/nova/upload/upload-client.tsx"
      to: "uploadWithRetry + analyzeCapturedJpeg + SEQUENCE + finalizeReadingAction"
      via: "import from @/lib/capture + @/app/actions/readings"
      pattern: "uploadWithRetry|analyzeCapturedJpeg|SEQUENCE"
    - from: "apps/web/app/(dashboard)/leituras/nova/upload/upload-client.tsx"
      to: "UploadDropzone"
      via: "import from @/components/upload/UploadDropzone"
      pattern: "UploadDropzone"
    - from: "apps/web/app/(dashboard)/leituras/nova/upload/page.tsx"
      to: "Supabase select(... capture_method ...)"
      via: "RLS implícita filtra para auth.uid()=therapist_id"
      pattern: "capture_method"
---

<objective>
Substituir o placeholder em `app/(dashboard)/leituras/nova/upload/page.tsx` pelo fluxo real do wizard de upload desktop e criar o `upload-client.tsx` correspondente.

**page.tsx (server component)** — análogo direto ao `app/(capture)/leituras/nova/capturar/page.tsx`, com 3 guards:
1. `?reading=<id>` ausente → redirect `/leituras/nova`.
2. Reading não encontrado (RLS) → redirect `/leituras/nova`.
3. Reading não-pending → redirect `/leituras`.
4. **NOVO em Fase 4:** `reading.capture_method === 'mobile_camera'` → redirect `/leituras/nova/capturar?reading=<id>` (D-04: método imutável; URL trocada cai no fluxo correto).

**upload-client.tsx (client wizard)** — clone cirúrgico do `capture-client.tsx` com 3 substituições:
1. `<input type="file" capture="environment">` é REMOVIDO. UploadDropzone visível na phase='instruction' aceita drop/click.
2. `handleFileSelected` (recebia `ChangeEvent<HTMLInputElement>`) vira `handleFileAccepted` (recebe `File` direto). Adicionado: `validateUploadFile` → toast on error → `convertHeicToJpeg` se `needsHeicConversion` → `analyzeCapturedJpeg` (idêntico à Fase 3) → setPendingPreview.
3. `<CapturePreview mode="upload">` (texto "Trocar arquivo"). `<AngleInterstitial mode="upload">` ou estrutura equivalente sem o alert "Use a câmera traseira" (não aplicável ao upload — terapeuta já tirou foto).

**Reuso máximo da Fase 3:**
- `SEQUENCE`, `getResumeSlotIndex`, `getSlotProgressLabel`, `Slot` — verbatim.
- `analyzeCapturedJpeg` (chama VLM via `/api/capture/validate`) — verbatim. CONTEXT D-09: VLM hard block reusado.
- `uploadWithRetry` — verbatim. Mesmo path canônico.
- `QUALITY_TO_SCORE` mapping — verbatim.
- `finalizeReadingAction` — verbatim.
- `CaptureProgress` (componente) — reusado sem modificação.
- State machine (Phase, refs, useEffect de finalização, useEffect de cleanup) — verbatim com substituições marcadas.

Implementa: **UPLOAD-01** (dropzone + preview + validação tipo/tamanho), **UPLOAD-02** (estrutura `reading_images` com `capture_method='desktop_upload'`). Honra **D-04** (capture_method imutável — guard no page.tsx), **D-05** (wizard sequencial), **D-06** (sempre 6 obrigatórias), **D-07** (refazer via upsert — herdado do uploadWithRetry), **D-09** (VLM hard block), **D-10** (validação técnica), **D-11** (HEIC convert), **D-13** (upload background), **D-14** (cancelar preserva rascunho).

Output: Wizard funcional ponta-a-ponta. Após este plan, o terapeuta no desktop com `?reading=<id>` válida pode subir 6 fotos e ver leitura criada com `capture_method='desktop_upload'` e 6 linhas em `reading_images` com path canônico.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/04-upload-desktop/04-CONTEXT.md
@.planning/phases/04-upload-desktop/04-PATTERNS.md

# Plans anteriores na mesma fase (interfaces que este plan consome)
@.planning/phases/04-upload-desktop/04-01-validate-file-heic-libs-PLAN.md
@.planning/phases/04-upload-desktop/04-02-extender-create-reading-action-PLAN.md
@.planning/phases/04-upload-desktop/04-03-upload-dropzone-component-PLAN.md
@.planning/phases/04-upload-desktop/04-04-adaptar-componentes-capture-mode-PLAN.md

# Source files canônicos a clonar/imitar
@apps/web/app/(capture)/leituras/nova/capturar/page.tsx
@apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx

# Arquivo placeholder a substituir
@apps/web/app/(dashboard)/leituras/nova/upload/page.tsx

# Libs reusadas verbatim (não modificar)
@apps/web/lib/capture/post-capture-analysis.ts
@apps/web/lib/capture/upload.ts
@apps/web/lib/capture/sequence.ts
@apps/web/lib/capture/quality-scoring.ts

# Componentes reusados
@apps/web/components/capture/CapturePreview.tsx
@apps/web/components/capture/AngleInterstitial.tsx
@apps/web/components/capture/CaptureProgress.tsx

# Layout dashboard (para entender que upload-client roda DENTRO de SidebarInset)
@apps/web/app/(dashboard)/layout.tsx

<interfaces>
<!-- Tipos do upload-client (idênticos ao capture-client com renaming): -->

```typescript
// upload-client.tsx
'use client'

type Phase = 'instruction' | 'analyzing' | 'previewing' | 'finalizing'
interface CapturedSlot { eye: string; angle: string }
interface UploadClientProps {
  readingId: string
  therapistId: string
  clientName: string
  capturedSlots: CapturedSlot[]
  resumeMode: boolean
}
interface PendingPreview {
  blob: Blob
  imageUrl: string
  qualityScore: number
  width: number
  height: number
  slotIndex: number
  analysis: PostCaptureAnalysis
}
```

<!-- API contracts (já existentes — não modificar): -->

```typescript
// lib/capture/post-capture-analysis.ts
export async function analyzeCapturedJpeg(blob: Blob): Promise<PostCaptureAnalysis>
export interface PostCaptureAnalysis {
  imageWidth: number
  imageHeight: number
  vlmInvalidAlert: boolean
  hasAlert: boolean
  cameraDetection: CameraDetectionResult
  vlmValidation: ValidationResult
}

// lib/capture/upload.ts
export async function uploadWithRetry(args: UploadArgs, maxAttempts?: number): Promise<UploadResult>

// lib/upload/validate-file.ts (Plan 04-01)
export function validateUploadFile(file: File): FileValidationResult
export interface FileValidationResult {
  ok: boolean
  error?: string
  needsHeicConversion?: boolean
}

// lib/upload/heic-to-jpeg.ts (Plan 04-01)
export async function convertHeicToJpeg(file: File | Blob): Promise<Blob>

// app/actions/readings.ts (Plan 04-02)
export async function finalizeReadingAction(readingId: string): Promise<{ error?: string }>
```

<!-- Contrato dos params do page.tsx (Next.js 15 async searchParams): -->
```typescript
searchParams: Promise<{ reading?: string; resume?: string }>
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Criar app/(dashboard)/leituras/nova/upload/page.tsx (server component)</name>
  <read_first>
    - apps/web/app/(capture)/leituras/nova/capturar/page.tsx (arquivo inteiro — template direto, 60 linhas)
    - apps/web/app/(dashboard)/leituras/nova/upload/page.tsx (placeholder atual a substituir, 14 linhas)
    - apps/web/app/(dashboard)/layout.tsx (entender que sidebar fica visível; sem env(safe-area-inset-top) extra)
    - .planning/phases/04-upload-desktop/04-PATTERNS.md seção "app/(dashboard)/leituras/nova/upload/page.tsx (server component, request-response)"
    - .planning/phases/04-upload-desktop/04-CONTEXT.md D-04 (método imutável)
  </read_first>
  <files>
    apps/web/app/(dashboard)/leituras/nova/upload/page.tsx
  </files>
  <action>
**Substituir totalmente** o conteúdo do `apps/web/app/(dashboard)/leituras/nova/upload/page.tsx` (placeholder atual de 14 linhas) por este server component:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UploadClient } from './upload-client'

/**
 * Tela do wizard de upload desktop.
 *
 * Ponto de entrada: /leituras/nova/upload?reading=<uuid>
 *   - reading deve estar em status='pending' e capture_method='desktop_upload'.
 *   - Reading é criada por createReadingAction (formData.method='desktop_upload')
 *     a partir de /leituras/nova (CONTEXT D-01, D-03).
 *
 * Guards:
 *   1. Sem ?reading → redirect /leituras/nova (recomeça fluxo).
 *   2. Reading não encontrado (RLS bloqueia se não é dono) → redirect /leituras/nova.
 *   3. CONTEXT D-04: capture_method='mobile_camera' → redirect /capturar?reading=<id>.
 *      (Método é imutável uma vez criado; URL trocada cai no fluxo correto.)
 *   4. Reading status !== 'pending' → redirect /leituras (já finalizou).
 *
 * Substitui placeholder Fase 3.
 */
export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ reading?: string; resume?: string }>
}) {
  const { reading: readingId, resume } = await searchParams

  if (!readingId) {
    redirect('/leituras/nova')
  }

  const supabase = await createClient()
  // T-02-01 / T-02-06: getUser() server-side, nunca getSession.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS de readings filtra automaticamente para auth.uid() = therapist_id.
  // Se o readingId não pertence ao terapeuta, a query retorna null → redirect.
  const { data: reading, error } = await supabase
    .from('readings')
    .select(`
      id,
      status,
      capture_method,
      client_id,
      created_at,
      clients(full_name),
      reading_images(id, eye, angle, quality_score, storage_path)
    `)
    .eq('id', readingId)
    .single()

  if (!reading || error) {
    redirect('/leituras/nova')
  }

  // CONTEXT D-04: método é imutável após criação. URL para o fluxo errado
  // → redireciona para o fluxo correto, mantendo o reading.
  if (reading.capture_method === 'mobile_camera') {
    redirect(`/leituras/nova/capturar?reading=${readingId}`)
  }

  // Reading já saiu de pending (Fase 5 processing/ready/edited) — não tem
  // sentido voltar pra captura.
  if (reading.status !== 'pending') {
    redirect('/leituras')
  }

  // Estrutura do client name vinda do select pode ser objeto ou array.
  const clientObj = Array.isArray(reading.clients) ? reading.clients[0] : reading.clients
  const clientName = (clientObj as { full_name?: string } | null)?.full_name ?? 'Cliente'

  return (
    <UploadClient
      readingId={reading.id}
      therapistId={user.id}
      clientName={clientName}
      capturedSlots={(reading.reading_images ?? []).map(
        (img: { eye: string; angle: string }) => ({ eye: img.eye, angle: img.angle }),
      )}
      resumeMode={resume === 'true'}
    />
  )
}
```

**Notas:**
- Ainda NÃO podemos rodar `pnpm build` aqui porque `upload-client.tsx` não existe ainda (Task 2). O build vai quebrar entre Task 1 e Task 2 — isto é esperado. Não rodar build até Task 2 concluir.
- O placeholder original (com texto "Upload no computador em breve — Disponível na Fase 4") é totalmente substituído. Manter o `import { Upload }` antigo NÃO é necessário.
- Nenhuma string nova com vocabulário proibido (auditável após Task 2 com `audit:vocabulary`).
  </action>
  <verify>
    <automated>cd apps/web && grep -n "redirect.*capturar.*reading" 'app/(dashboard)/leituras/nova/upload/page.tsx' && grep -n "capture_method" 'app/(dashboard)/leituras/nova/upload/page.tsx'</automated>
    Ambos os greps devem retornar pelo menos 1 linha cada (guard D-04 + select com capture_method).

    Adicionalmente:
    - `wc -l 'apps/web/app/(dashboard)/leituras/nova/upload/page.tsx'` deve mostrar ≥ 50 linhas.
    - O texto "Upload no computador em breve" NÃO deve mais existir no arquivo: `grep -c 'em breve' 'apps/web/app/(dashboard)/leituras/nova/upload/page.tsx'` retorna 0.
  </verify>
  <acceptance_criteria>
    - Arquivo `app/(dashboard)/leituras/nova/upload/page.tsx` com 50+ linhas (server component completo).
    - Não é mais um placeholder (string "em breve" ausente, `<Upload />` icon do placeholder removido).
    - Quatro guards implementados: sem `?reading`, reading não-encontrado, capture_method=mobile_camera, status !== pending.
    - Importa `UploadClient` de `./upload-client` (que será criado em Task 2).
    - Select inclui `capture_method` (auditável via grep).
    - Auth via `getUser()` (não `getSession`).
  </acceptance_criteria>
  <done>
    Server component pronto. Build vai quebrar até Task 2 — esperado.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Criar upload-client.tsx (state machine + dropzone + reuso pipeline VLM)</name>
  <read_first>
    - apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx (arquivo inteiro — 350 linhas, template direto)
    - apps/web/lib/capture/post-capture-analysis.ts (entender o que analyzeCapturedJpeg retorna)
    - apps/web/lib/capture/upload.ts (entender args do uploadWithRetry)
    - apps/web/lib/capture/sequence.ts (após Plan 04-04 — CaptureMode type disponível)
    - apps/web/components/capture/CapturePreview.tsx (após Plan 04-04 — mode prop disponível)
    - apps/web/components/capture/AngleInterstitial.tsx (após Plan 04-04 — mode prop disponível)
    - apps/web/components/upload/UploadDropzone.tsx (após Plan 04-03)
    - apps/web/lib/upload/validate-file.ts (após Plan 04-01)
    - apps/web/lib/upload/heic-to-jpeg.ts (após Plan 04-01)
    - .planning/phases/04-upload-desktop/04-PATTERNS.md seção "app/(dashboard)/leituras/nova/upload/upload-client.tsx (client wizard, state-machine)" — TEMPLATE PRINCIPAL
  </read_first>
  <files>
    apps/web/app/(dashboard)/leituras/nova/upload/upload-client.tsx
  </files>
  <action>
Criar `apps/web/app/(dashboard)/leituras/nova/upload/upload-client.tsx` clonando `capture-client.tsx` com substituições cirúrgicas. Conteúdo completo:

```typescript
'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { finalizeReadingAction } from '@/app/actions/readings'
import { AngleInterstitial } from '@/components/capture/AngleInterstitial'
import { CapturePreview } from '@/components/capture/CapturePreview'
import { CaptureProgress } from '@/components/capture/CaptureProgress'
import {
  analyzeCapturedJpeg,
  type PostCaptureAnalysis,
} from '@/lib/capture/post-capture-analysis'
import { uploadWithRetry } from '@/lib/capture/upload'
import { createClient } from '@/lib/supabase/client'
import {
  SEQUENCE,
  getResumeSlotIndex,
  getSlotProgressLabel,
  type Slot,
} from '@/lib/capture/sequence'
import type { QualityLevel } from '@/lib/capture/quality-scoring'
// Phase 4 — novos imports
import { UploadDropzone } from '@/components/upload/UploadDropzone'
import { validateUploadFile } from '@/lib/upload/validate-file'
import { convertHeicToJpeg } from '@/lib/upload/heic-to-jpeg'

// Mapeamento idêntico ao capture-client (CONTEXT D-09 — VLM gate reusado).
const QUALITY_TO_SCORE: Record<QualityLevel, number> = {
  ruim: 0.20,
  regular: 0.55,
  boa: 0.82,
  excelente: 0.95,
}

function computeQualityScore(analysis: PostCaptureAnalysis): number {
  return QUALITY_TO_SCORE[analysis.vlmValidation.quality]
}

// State machine idêntica ao capture-client.
type Phase = 'instruction' | 'analyzing' | 'previewing' | 'finalizing'

interface CapturedSlot { eye: string; angle: string }

interface UploadClientProps {
  readingId: string
  therapistId: string
  clientName: string
  capturedSlots: CapturedSlot[]
  resumeMode: boolean
}

interface PendingPreview {
  blob: Blob
  imageUrl: string
  qualityScore: number
  width: number
  height: number
  slotIndex: number
  analysis: PostCaptureAnalysis
}

/**
 * Wizard de upload desktop. Clone funcional do capture-client (Fase 3) com 3
 * substituições cirúrgicas:
 *   1. <input type="file" capture="environment"> → UploadDropzone (drop + click).
 *   2. handleFileSelected (ChangeEvent) → handleFileAccepted (File direto).
 *      Adicionado: validateUploadFile + convertHeicToJpeg.
 *   3. CapturePreview / AngleInterstitial recebem mode="upload".
 *
 * Pipeline pós-arquivo idêntico à Fase 3:
 *   File → validate (MIME/size) → HEIC convert (se preciso) →
 *   analyzeCapturedJpeg (VLM via /api/capture/validate) →
 *   CapturePreview com badge → Confirmar → uploadWithRetry (background) →
 *   próximo slot.
 *
 * CONTEXT D-13: upload roda em background (Promise registrada em
 * uploadPromisesRef); finalize aguarda Promise.allSettled.
 * CONTEXT D-14: X no header faz router.push('/leituras') sem destruir reading.
 */
export function UploadClient({
  readingId,
  therapistId,
  clientName,
  capturedSlots: initialCaptured,
  resumeMode: _resumeMode,
}: UploadClientProps) {
  const supabase = React.useMemo(() => createClient(), [])
  const router = useRouter()

  const initialIndex = React.useMemo(() => {
    const idx = getResumeSlotIndex(initialCaptured)
    return idx === -1 ? SEQUENCE.length - 1 : idx
  }, [initialCaptured])

  const [slotIndex, setSlotIndex] = React.useState(initialIndex)
  const [phase, setPhase] = React.useState<Phase>('instruction')
  const [capturedCount, setCapturedCount] = React.useState(initialCaptured.length)
  const [pendingPreview, setPendingPreview] = React.useState<PendingPreview | null>(null)

  // Refs idênticas ao capture-client. Sem fileInputRef — UploadDropzone
  // expõe callback onFileAccepted.
  const slotAbortRefs = React.useRef<Map<number, AbortController>>(new Map())
  const uploadPromisesRef = React.useRef<Map<number, Promise<unknown>>>(new Map())
  const finalizingTriggeredRef = React.useRef(false)

  const slot: Slot = SEQUENCE[Math.min(slotIndex, SEQUENCE.length - 1)]

  // -------------------------------------------------------------------------
  // Handler de arquivo (substitui handleFileSelected do capture-client)
  // -------------------------------------------------------------------------
  const handleFileAccepted = React.useCallback(async (file: File) => {
    // 1) Validação técnica MIME + tamanho (CONTEXT D-10, D-12).
    const validation = validateUploadFile(file)
    if (!validation.ok) {
      toast.error(validation.error ?? 'Arquivo inválido')
      return
    }

    setPhase('analyzing')

    // 2) HEIC → JPEG (CONTEXT D-11, dynamic import dentro de convertHeicToJpeg).
    let processedBlob: File | Blob = file
    if (validation.needsHeicConversion) {
      const toastId = toast.loading('Convertendo HEIC...')
      try {
        processedBlob = await convertHeicToJpeg(file)
        toast.dismiss(toastId)
      } catch (err) {
        console.error('[upload-client] HEIC convert error:', err)
        toast.dismiss(toastId)
        toast.error(
          'Não consegui converter este HEIC. Exporte como JPEG do iPhone (Configurações → Câmera → Formatos → Mais Compatível) ou tente outra foto.',
        )
        setPhase('instruction')
        return
      }
    }

    const imageUrl = URL.createObjectURL(processedBlob)
    try {
      // 3) Pipeline VLM idêntico à Fase 3 (CONTEXT D-09).
      // analyzeCapturedJpeg roda EXIF detection (kind='unknown' em arquivos sem
      // EXIF — esperado em fotos exportadas) e VLM via /api/capture/validate.
      // Sem bloqueio precoce de câmera frontal aqui: terapeuta está subindo
      // foto de câmera profissional (não selfie de iPhone).
      const analysis = await analyzeCapturedJpeg(processedBlob)

      const score = computeQualityScore(analysis)
      const currentSlotIdx = slotIndex

      setPendingPreview({
        blob: processedBlob,
        imageUrl,
        qualityScore: score,
        width: analysis.imageWidth,
        height: analysis.imageHeight,
        slotIndex: currentSlotIdx,
        analysis,
      })
      setPhase('previewing')
    } catch (err) {
      console.error('[upload-client] analyze error:', err)
      URL.revokeObjectURL(imageUrl)
      toast.error('Falha ao processar imagem. Tente novamente.')
      setPhase('instruction')
    }
  }, [slotIndex])

  // -------------------------------------------------------------------------
  // Upload (idêntico ao capture-client; CONTEXT D-13 background + D-07 upsert)
  // -------------------------------------------------------------------------
  const executeUpload = React.useCallback(() => {
    const preview = pendingPreview
    if (!preview) return
    const currentSlotIdx = preview.slotIndex

    const previousAbort = slotAbortRefs.current.get(currentSlotIdx)
    if (previousAbort) previousAbort.abort()
    const ac = new AbortController()
    slotAbortRefs.current.set(currentSlotIdx, ac)

    const toastId = toast.loading(`Salvando imagem ${currentSlotIdx + 1}/6...`)

    const uploadP = uploadWithRetry({
      supabase,
      blob: preview.blob,
      width: preview.width,
      height: preview.height,
      therapistId,
      readingId,
      eye: SEQUENCE[currentSlotIdx].eye,
      angle: SEQUENCE[currentSlotIdx].angle,
      qualityScore: preview.qualityScore,
      signal: ac.signal,
    })
    uploadPromisesRef.current.set(currentSlotIdx, uploadP)
    void uploadP
      .then(() => {
        if (ac.signal.aborted) return
        toast.success('Imagem salva.', { id: toastId, duration: 2000 })
        slotAbortRefs.current.delete(currentSlotIdx)
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') {
          toast.dismiss(toastId)
          return
        }
        console.error(
          '[upload-client] upload error — eye:',
          SEQUENCE[currentSlotIdx].eye,
          'angle:',
          SEQUENCE[currentSlotIdx].angle,
        )
        toast.error(`Falha ao salvar imagem ${currentSlotIdx + 1}/6. Tente refazer.`, {
          id: toastId,
          duration: Infinity,
        })
      })

    URL.revokeObjectURL(preview.imageUrl)
    setPendingPreview(null)
    setCapturedCount((c) => c + 1)

    const next = slotIndex + 1
    if (next >= SEQUENCE.length) {
      setPhase('finalizing')
    } else {
      setSlotIndex(next)
      setPhase('instruction')
    }
  }, [pendingPreview, slotIndex, supabase, therapistId, readingId])

  const handleConfirm = executeUpload

  const handleRedo = React.useCallback(() => {
    if (pendingPreview?.imageUrl) URL.revokeObjectURL(pendingPreview.imageUrl)
    const previousAbort = slotAbortRefs.current.get(slotIndex)
    if (previousAbort) {
      previousAbort.abort()
      slotAbortRefs.current.delete(slotIndex)
    }
    setPendingPreview(null)
    setPhase('instruction')
    // Sem setTimeout + click() — UploadDropzone fica visível na phase='instruction'
    // e o terapeuta arrasta/clica novamente.
  }, [pendingPreview, slotIndex])

  // -------------------------------------------------------------------------
  // useEffect de finalização (idêntico ao capture-client)
  // -------------------------------------------------------------------------
  React.useEffect(() => {
    if (phase !== 'finalizing') return
    if (finalizingTriggeredRef.current) return
    finalizingTriggeredRef.current = true

    const run = async () => {
      const pending = Array.from(uploadPromisesRef.current.values())
      if (pending.length > 0) await Promise.allSettled(pending)
      const result = await finalizeReadingAction(readingId)
      if (result.error) {
        toast.error(`Falha ao finalizar leitura: ${result.error}`)
        finalizingTriggeredRef.current = false
        return
      }
      toast.success('Leitura registrada.')
      router.push('/leituras')
      router.refresh()
    }
    void run()
  }, [phase, readingId, router])

  // -------------------------------------------------------------------------
  // Cleanup de AbortControllers (idêntico ao capture-client)
  // -------------------------------------------------------------------------
  React.useEffect(() => {
    const abortMap = slotAbortRefs.current
    return () => {
      abortMap.forEach((ac) => ac.abort())
      abortMap.clear()
    }
  }, [])

  // -------------------------------------------------------------------------
  // Render (3 substituições do capture-client)
  // -------------------------------------------------------------------------
  return (
    <div className="relative flex-1 flex flex-col">
      {/* Header com nome do cliente + X (CONTEXT D-14: X preserva rascunho) */}
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-sm text-foreground/80 truncate max-w-[60%]">{clientName}</span>
        <Link
          href="/leituras"
          aria-label="Cancelar leitura"
          className="rounded-full bg-muted p-2 text-foreground"
        >
          <X className="h-5 w-5" />
        </Link>
      </header>

      <div className="flex-1 flex flex-col items-center gap-6 px-4 py-8">
        {/* Progress chip — sempre visível */}
        <CaptureProgress currentIndex={slotIndex} capturedCount={capturedCount} />

        {phase === 'instruction' && (
          <div className="w-full max-w-md flex flex-col items-center gap-6">
            {/* Heading + subtitle do slot atual (mesma copy do AngleInterstitial,
                sem o alert mobile-only de câmera traseira/flash). */}
            <div className="text-center space-y-2">
              <h1 className="text-xl font-semibold">
                Foto {slotIndex + 1} de {SEQUENCE.length} — Olho{' '}
                {slot.eye === 'left' ? 'ESQUERDO' : 'DIREITO'} ·{' '}
                {slot.angle === 'frontal'
                  ? 'Frente'
                  : slot.angle === 'lateral'
                    ? 'Direita'
                    : 'Esquerda'}
              </h1>
            </div>
            <UploadDropzone
              onFileAccepted={handleFileAccepted}
              slotLabel={`Foto ${slotIndex + 1} de ${SEQUENCE.length}`}
            />
          </div>
        )}

        {phase === 'analyzing' && (
          <div className="flex flex-col items-center justify-center gap-4 text-foreground py-12">
            <div
              aria-hidden="true"
              className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary motion-safe:animate-spin"
            />
            <p className="text-sm text-muted-foreground">Analisando imagem...</p>
          </div>
        )}

        {phase === 'previewing' && pendingPreview && (
          <div className="w-full max-w-2xl">
            <CapturePreview
              imageUrl={pendingPreview.imageUrl}
              qualityScore={pendingPreview.qualityScore}
              analysis={pendingPreview.analysis}
              onRedo={handleRedo}
              onConfirm={handleConfirm}
              mode="upload"
            />
          </div>
        )}

        {phase === 'finalizing' && (
          <div className="flex flex-col items-center justify-center gap-4 text-foreground py-12">
            <h1 className="text-xl font-semibold">{getSlotProgressLabel(SEQUENCE.length - 1)} imagens registradas</h1>
            <p className="text-sm text-muted-foreground">Finalizando leitura...</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

**Notas críticas:**
- **NÃO usar `<input capture>`** em lugar nenhum. UploadDropzone substitui completamente.
- **NÃO usar fileInputRef.** UploadDropzone gerencia seu próprio input internamente.
- **NÃO renderizar AngleInterstitial diretamente** na phase='instruction' do desktop. O AngleInterstitial original tem um alert "Use a câmera traseira · Nunca utilize o flash" que NÃO faz sentido no upload (terapeuta está subindo foto pronta). Em vez disso, este wizard renderiza um header textual simples + UploadDropzone embutida. Esta é uma decisão deliberada da phase='instruction' deste plan.
- **Nota sobre AngleInterstitial não usado:** mantemos o import para que esteja disponível caso UI review futura queira reintroduzir uma versão "leve" (sem alert mobile-only). Por ora, render direto com heading inline.

  ATUALIZAÇÃO: remover o import `AngleInterstitial` se não for usado (ESLint vai reclamar). Manter apenas se de fato usar. Como o JSX acima NÃO usa AngleInterstitial, REMOVER o import na implementação final. O import de `AngleInterstitial` listado no preâmbulo está por padrão de clonagem mas deve ser removido se não usado.

- **CapturePreview com mode="upload"**: muda label do botão Refazer para "Trocar arquivo" (Plan 04-04).

- **Vocabulário proibido LGPD**: ZERO 'diagnóstico', 'tratamento', 'cura'. As strings novas:
  - "Convertendo HEIC..." → neutro
  - "Não consegui converter este HEIC..." → neutro
  - "Falha ao processar imagem. Tente novamente." → neutro
  - "Salvando imagem N/6..." → neutro
  - "Imagem salva." → neutro
  - "Falha ao salvar imagem N/6. Tente refazer." → neutro
  - "Analisando imagem..." → neutro
  - "Cancelar leitura" → neutro
  - "Leitura registrada." → neutro
  - "Falha ao finalizar leitura: ..." → neutro
  - Heading "Foto N de 6 — Olho ESQUERDO · Frente" → neutro

  TODAS PASSAM no audit:vocabulary.

- **Não criar testes vitest para upload-client.tsx neste plan**: a state machine é cópia do capture-client (que tem cobertura UAT em produção). Smoke tests aqui seriam dups; cobertura real virá via UAT no Plan 04-07.

Após criar o arquivo, rodar `pnpm build` (não obrigatório no automated verify, mas útil) para confirmar que compila.
  </action>
  <verify>
    <automated>cd apps/web && pnpm tsc --noEmit -p . && pnpm audit:vocabulary</automated>
    Ambos exit 0.

    Adicionalmente:
    - `grep -c "validateUploadFile\\|convertHeicToJpeg\\|UploadDropzone\\|uploadWithRetry\\|analyzeCapturedJpeg\\|finalizeReadingAction\\|SEQUENCE" 'apps/web/app/(dashboard)/leituras/nova/upload/upload-client.tsx'` retorna ≥ 7 (cada import usado).
    - `grep -c "mode=.upload." 'apps/web/app/(dashboard)/leituras/nova/upload/upload-client.tsx'` retorna ≥ 1 (CapturePreview com mode='upload').
    - `grep -c "input.*capture" 'apps/web/app/(dashboard)/leituras/nova/upload/upload-client.tsx'` retorna 0 (zero usos de `<input capture>`).
    - `grep -c "Phase = 'instruction' | 'analyzing' | 'previewing' | 'finalizing'" 'apps/web/app/(dashboard)/leituras/nova/upload/upload-client.tsx'` retorna 1.
    - `wc -l 'apps/web/app/(dashboard)/leituras/nova/upload/upload-client.tsx'` mostra 200+ linhas.
  </verify>
  <acceptance_criteria>
    - Arquivo `upload-client.tsx` existe com 200+ linhas.
    - `'use client'` na primeira linha.
    - Export named `UploadClient` (sem default).
    - Imports usam: `UploadDropzone`, `validateUploadFile`, `convertHeicToJpeg`, `analyzeCapturedJpeg`, `uploadWithRetry`, `finalizeReadingAction`, `SEQUENCE`, `CapturePreview` (com mode='upload').
    - State machine `Phase` idêntica ao capture-client.
    - Não há `<input type="file" capture="...">` no JSX.
    - Header tem `<X />` icon que linka para `/leituras` (preserva rascunho — D-14).
    - `pnpm tsc --noEmit -p .` exit 0.
    - `pnpm audit:vocabulary` exit 0.
  </acceptance_criteria>
  <done>
    Wizard funcional fim-a-fim: terapeuta no desktop com `?reading=<uuid>` válida arrasta 6 fotos sequencialmente, cada uma passa por validate → HEIC convert (se preciso) → VLM gate → preview → upload background → próxima. Após 6/6, finalize chama finalizeReadingAction e router.push('/leituras').
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser file (drag/drop ou picker) → upload-client | terapeuta entrega arquivo arbitrário. |
| upload-client → /api/capture/validate (VLM) | client envia base64 image; servidor valida. |
| upload-client → Supabase Storage (uploadWithRetry) | client → Supabase com path RLS-protected. |
| upload-client → Supabase reading_images (saveReadingImagesAction via uploadWithRetry) | INSERT/UPSERT em tabela RLS-protected. |
| URL `?reading=<id>` → page.tsx | id é guess-able; RLS é a barreira. |
| capture_method=mobile_camera URL spoofing → page.tsx | usuário malicioso/curioso entra com URL desktop em reading mobile. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-05-01 | Tampering | upload-client (validate-file) | mitigate | `validateUploadFile` rejeita MIME/extensão fora da whitelist e tamanho > 25MB ANTES de chamar VLM ou upload. ASVS L1 V12.1.1 ✓, V12.1.2 ✓. |
| T-04-05-02 | Tampering | upload-client (HEIC conversion) | mitigate | `convertHeicToJpeg` lança Error em entrada malformada → UI mostra toast e volta pra phase='instruction'. Sem upload em caso de erro. |
| T-04-05-03 | Information Disclosure | page.tsx (RLS) | mitigate | Query `.eq('id', readingId)` sem cláusula explícita de `therapist_id` confia em RLS. RLS bloqueia se reading.therapist_id != auth.uid() → query retorna null → redirect /leituras/nova. Padrão ASVS L1 V4.2.1: object-level authorization ✓. T-02-06 mantido (getUser, não getSession). |
| T-04-05-04 | Tampering | page.tsx (capture_method routing) | mitigate | D-04 enforced: se URL aponta /upload mas reading é mobile_camera, redirect para /capturar. Previne mistura de fluxos com fotos parciais já subidas. |
| T-04-05-05 | Information Disclosure | upload-client (storage path) | mitigate | `buildOriginalStoragePath` (Fase 3) usa `{therapist_id}/{reading_id}/originais/...`. RLS folder-based no bucket (Fase 3 migration 0004) bloqueia cross-tenant. Path validado contra path traversal por `validateSegment`. |
| T-04-05-06 | Tampering | upload-client (VLM bypass) | accept | Terapeuta pode forjar response do `/api/capture/validate` via DevTools → UI aceita foto ruim. Aceito porque: (a) bloquear via DevTools afeta apenas o reading próprio, (b) Fase 5 vai detectar e marcar status='failed' se imagens não passam validação, (c) custo de mitigation (HMAC do response) é alto pra threat baixo. |
| T-04-05-07 | Denial of Service | upload-client (uploads paralelos) | accept | Terapeuta pode disparar 6 uploads simultâneos × 25MB = 150MB peak. Mitigado por `uploadWithRetry` que usa `AbortController` por slot e cancelar slot anterior em retake. Aceito — caso de uso normal. |
| T-04-05-08 | Information Disclosure | upload-client (toasts/logs) | mitigate | Toasts mostram apenas slot.eye/slot.angle (ex: "Salvando imagem 1/6...") — nunca storage_path completo. console.error mostra eye+angle sem path completo. Comportamento herdado da Fase 3 (T-03-07-03). |
</threat_model>

<verification>
1. `cd apps/web && pnpm tsc --noEmit -p .` exit 0 (compatibilidade global de tipos).
2. `cd apps/web && pnpm test:run` exit 0 (regressão dos testes Wave 1/2 não quebrou nada).
3. `cd apps/web && pnpm audit:vocabulary` exit 0.
4. `cd apps/web && pnpm build` (opcional mas recomendado): build deve completar sem erros. Verificar nas ASCII trees do build que `heic2any` aparece em chunk SEPARADO de `(dashboard)/leituras` (evidência de dynamic import correto).
5. **Smoke manual** (não automatizável, mas executor pode tentar): rodar `pnpm dev`, criar reading via curl/SQL com `capture_method='desktop_upload'`, navegar pra `/leituras/nova/upload?reading=<id>`, ver dropzone aparecer.
</verification>

<success_criteria>
- page.tsx com 4 guards funcionais (sem reading, não-encontrado, capture_method=mobile_camera, status !== pending).
- upload-client.tsx implementa state machine `Phase` idêntica ao capture-client.
- Pipeline completo: File → validate → HEIC convert → VLM analyze → preview → background upload → próximo slot.
- 6/6 capturas → finalize chama finalizeReadingAction.
- Storage path canônico {therapist_id}/{reading_id}/originais/{eye}_{angle}.jpg.
- TypeScript compila globalmente.
- Vocabulário proibido ausente.
- Build passa (heic2any em chunk dinâmico).
</success_criteria>

<output>
Após completar, criar `.planning/phases/04-upload-desktop/04-05-SUMMARY.md` documentando:
- Arquivos criados (page.tsx + upload-client.tsx) com contagem de linhas.
- Imports usados (lista completa).
- Os 4 guards do page.tsx.
- Confirmação que `pnpm tsc --noEmit` e `pnpm audit:vocabulary` passaram.
- Output de `pnpm build` se executado, especialmente confirmação que heic2any aparece em chunk separado.
- Confirmação que `<input capture>` NÃO existe no upload-client.
</output>
