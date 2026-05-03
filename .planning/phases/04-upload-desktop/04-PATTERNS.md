# Phase 4: Upload desktop — Pattern Map

**Mapeado:** 2026-05-03
**Arquivos analisados:** 10 novos + 5 modificados = 15
**Analogs encontrados:** 14 / 15 (93%)

> Esta fase tem natureza incomum: ~90% do código é reutilizado literalmente da
> Fase 3. O padrão dominante é "clonar `capture-client.tsx` → trocar `<input
> capture>` por `<UploadDropzone>`" e adaptar cópias de string. Cada entrada
> abaixo documenta *quais linhas copiar*, quais props adaptar e quais behaviors
> são idênticos sem alteração.

---

## File Classification

| Arquivo novo / modificado | Papel | Fluxo | Analog mais próximo | Match |
|---|---|---|---|---|
| `app/(dashboard)/leituras/nova/upload/page.tsx` | server component (substituir placeholder) | request-response | `app/(capture)/leituras/nova/capturar/page.tsx` | exact |
| `app/(dashboard)/leituras/nova/upload/upload-client.tsx` | client wizard (state machine) | state-machine + event-driven | `app/(capture)/leituras/nova/capturar/capture-client.tsx` | exact |
| `components/upload/UploadDropzone.tsx` | component UI (drag-and-drop) | event-driven | `components/capture/AngleInterstitial.tsx` (botão CTA + layout) + `hooks/use-mobile.ts` (event listener pattern) | role-match |
| `components/upload/HeicConversionToast.tsx` (opcional) | component (feedback inline) | event-driven | `components/capture/CaptureProgress.tsx` (presentational simples) | role-match |
| `lib/upload/heic-to-jpeg.ts` | lib utilitária (browser API) | transform | `lib/capture/jpeg-compress.ts` (Canvas API, dynamic import pattern) | role-match |
| `lib/upload/validate-file.ts` | lib utilitária (pura) | transform | `lib/capture/validate-image.ts` (helpers puros com BLOCKING_REASONS exportado) | role-match |
| `app/actions/readings.ts` *(modificar)* | server action | CRUD | si mesmo — estender `createReadingAction` | self |
| `app/actions/readings.schemas.ts` *(modificar)* | schema Zod | — | si mesmo — estender `createReadingSchema` | self |
| `app/(dashboard)/leituras/nova/new-reading-form.tsx` *(modificar)* | client form | request-response | si mesmo — adicionar device-detect + hidden input `method` | self |
| `components/recovery/RecoveryBanner.tsx` *(criar — não existe)* | component (banner) | event-driven | `components/clientes/delete-client-dialog.tsx` (useTransition + server action) | role-match |
| `components/capture/CapturePreview.tsx` *(modificar)* | component (interactive) | event-driven | si mesmo — adicionar prop `mode` opcional | self |
| `components/capture/AngleInterstitial.tsx` *(modificar)* | component (full-screen) | event-driven | si mesmo — `copy.cta` já vem de `getSlotInstructionCopy` | self |
| `lib/capture/sequence.ts` *(modificar)* | lib (pura) | transform | si mesmo — `getSlotInstructionCopy` retorna `cta` hardcoded | self |

---

## Pattern Assignments

### `app/(dashboard)/leituras/nova/upload/page.tsx` (server component, request-response)

**Analog exato:** `apps/web/app/(capture)/leituras/nova/capturar/page.tsx` (60 linhas — lido acima)

**Diferença de rota group:** capturar vive em `(capture)` (sem sidebar). Upload vive em `(dashboard)` (com sidebar) por decisão arquitetural D-Claude's Discretion — terapeuta no desktop tem espaço pra sidebar e facilita navegação cross-leituras.

**Imports pattern** (linhas 1-3 — copiar verbatim):
```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UploadClient } from './upload-client'
```

**Server fetch + ownership guard + handoff** (linhas 5-59 — copiar quase verbatim, trocando apenas `CaptureClient` → `UploadClient` e rota de fallback):
```typescript
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS filtra automaticamente — se readingId não pertence ao terapeuta, retorna null
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

  // Guard extra: se o reading é de captura mobile, redireciona para o fluxo correto
  if (reading.capture_method === 'mobile_camera') {
    redirect(`/leituras/nova/capturar?reading=${readingId}`)
  }

  if (reading.status !== 'pending') {
    redirect('/leituras')
  }

  const clientObj = Array.isArray(reading.clients) ? reading.clients[0] : reading.clients
  const clientName = (clientObj as { full_name?: string } | null)?.full_name ?? 'Cliente'

  return (
    <UploadClient
      readingId={reading.id}
      therapistId={user.id}
      clientName={clientName}
      capturedSlots={(reading.reading_images ?? []).map((img: { eye: string; angle: string }) => ({
        eye: img.eye,
        angle: img.angle,
      }))}
      resumeMode={resume === 'true'}
    />
  )
}
```

**Convenções herdadas:**
- `searchParams` como `Promise<...>` (Next.js 15 async params)
- `notFound()` não é chamado — usa `redirect('/leituras/nova')` pra manter UX fluente
- RLS implícita na query (sem cláusula `therapist_id` explícita no `.eq()`)

---

### `app/(dashboard)/leituras/nova/upload/upload-client.tsx` (client wizard, state-machine)

**Analog exato:** `apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx` (350 linhas — lido acima)

Este é o arquivo mais central da Fase 4. A estrutura é **idêntica** ao `capture-client.tsx` linha a linha. As diferenças são cirúrgicas.

**Imports pattern** (linhas 1-23 — copiar verbatim, trocar apenas últimas importações):
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
// NOVO em relação ao capture-client:
import { UploadDropzone } from '@/components/upload/UploadDropzone'
import { validateUploadFile } from '@/lib/upload/validate-file'
import { convertHeicToJpeg } from '@/lib/upload/heic-to-jpeg'
```

**QUALITY_TO_SCORE** (linhas 37-42 — copiar verbatim, não altera):
```typescript
const QUALITY_TO_SCORE: Record<QualityLevel, number> = {
  ruim: 0.20,
  regular: 0.55,
  boa: 0.82,
  excelente: 0.95,
}
```

**Tipos** (linhas 52-74 — copiar com uma alteração na interface de props):
```typescript
// Phase type é IDÊNTICO ao capture-client
type Phase = 'instruction' | 'analyzing' | 'previewing' | 'finalizing'

interface CapturedSlot { eye: string; angle: string }

// Props: idênticas ao CaptureClientProps — mesma assinatura para receber
// os mesmos dados do page.tsx server component
interface UploadClientProps {
  readingId: string
  therapistId: string
  clientName: string
  capturedSlots: CapturedSlot[]
  resumeMode: boolean
}

// PendingPreview: idêntico ao capture-client
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

**State e refs** (linhas 87-103 — copiar verbatim exceto trocar `fileInputRef` por nenhuma ref — dropzone recebe callback):
```typescript
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

  // Sem fileInputRef — UploadDropzone expõe callback onFileAccepted
  const slotAbortRefs = React.useRef<Map<number, AbortController>>(new Map())
  const uploadPromisesRef = React.useRef<Map<number, Promise<unknown>>>(new Map())
  const finalizingTriggeredRef = React.useRef(false)

  const slot: Slot = SEQUENCE[Math.min(slotIndex, SEQUENCE.length - 1)]
```

**Handler de arquivo (ÚNICA diferença lógica substancial):**

No `capture-client`, a câmera é aberta via `fileInputRef.current?.click()` e o arquivo chega por `handleFileSelected` (onChange do input). No `upload-client`, o arquivo chega pelo callback `onFileAccepted` do `UploadDropzone`. O processamento *depois* do arquivo é idêntico:

```typescript
// No capture-client (linhas 115-154): handleFileSelected recebe ChangeEvent<HTMLInputElement>
// No upload-client: handleFileAccepted recebe File diretamente

const handleFileAccepted = React.useCallback(async (file: File) => {
  // validate-file.ts primeiro (client-side, antes do VLM)
  const validation = validateUploadFile(file)
  if (!validation.ok) {
    toast.error(validation.error)
    return
  }

  // Conversão HEIC → JPEG se necessário (dynamic import — não carrega heic lib se não precisar)
  let jpegFile: File | Blob = file
  if (file.type === 'image/heic' || file.type === 'image/heif' ||
      file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
    toast.loading('Convertendo HEIC...', { id: 'heic-conversion' })
    try {
      jpegFile = await convertHeicToJpeg(file)
      toast.dismiss('heic-conversion')
    } catch {
      toast.dismiss('heic-conversion')
      toast.error('Não consegui converter este HEIC. Exporte como JPEG do iPhone (Configurações → Câmera → Formatos → Mais Compatível) ou tente outra foto.')
      return
    }
  }

  setPhase('analyzing')
  const imageUrl = URL.createObjectURL(jpegFile)

  try {
    // analyzeCapturedJpeg: IDÊNTICO ao capture-client (linhas 126-147)
    // Nota: cameraDetection.kind nunca será 'front' em fotos de arquivo
    // (EXIF pode estar stripado) — não há bloqueio de câmera frontal aqui.
    const analysis = await analyzeCapturedJpeg(jpegFile)

    const score = computeQualityScore(analysis)
    const currentSlotIdx = slotIndex

    setPendingPreview({
      blob: jpegFile,
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
```

**executeUpload** (linhas 160-213 do capture-client — copiar VERBATIM sem nenhuma alteração):
```typescript
// Idêntico ao capture-client. uploadWithRetry aceita Blob (File extends Blob).
// Não há distinção de método no upload — o storage path é o mesmo.
const executeUpload = React.useCallback(() => {
  // ... copiar capture-client.tsx linhas 161-213 verbatim
}, [pendingPreview, slotIndex, supabase, therapistId, readingId])

const handleConfirm = executeUpload

const handleRedo = React.useCallback(() => {
  // ... copiar capture-client.tsx linhas 223-232 verbatim
  // Sem window.setTimeout + fileInputRef.current?.click() — dropzone fica visível na instruction phase
  if (pendingPreview?.imageUrl) URL.revokeObjectURL(pendingPreview.imageUrl)
  const previousAbort = slotAbortRefs.current.get(slotIndex)
  if (previousAbort) {
    previousAbort.abort()
    slotAbortRefs.current.delete(slotIndex)
  }
  setPendingPreview(null)
  setPhase('instruction')
  // NÃO tem setTimeout + click — dropzone fica visível quando phase='instruction'
}, [pendingPreview, slotIndex])
```

**useEffect de finalização** (linhas 235-258 do capture-client — copiar VERBATIM):
```typescript
// Idêntico ao capture-client — finalizeReadingAction é neutro de método
React.useEffect(() => {
  if (phase !== 'finalizing') return
  if (finalizingTriggeredRef.current) return
  // ... copiar verbatim
}, [phase, readingId, router])
```

**useEffect de cleanup de AbortControllers** (linhas 261-266 — copiar VERBATIM).

**Render — diferenças no JSX:**

| Phase | capture-client | upload-client |
|---|---|---|
| `'instruction'` | `AngleInterstitial` com `onProceed={openCamera}` | `AngleInterstitial` com `onProceed={undefined}` OU com `UploadDropzone` embutido inline |
| `'instruction'` | `<input ref={fileInputRef} capture="environment" ...>` hidden | **Sem `<input capture>`** — `<UploadDropzone onFileAccepted={handleFileAccepted}>` visível |
| `'analyzing'` | Spinner idêntico | Spinner idêntico (copiar verbatim) |
| `'previewing'` | `<CapturePreview mode="camera" ...>` | `<CapturePreview mode="upload" ...>` |
| `'finalizing'` | Mensagem idêntica | Idêntica |

**Tip banner de iluminação** (linhas 278-285 do capture-client): **omitir** no upload-client — o terapeuta está subindo fotos já tiradas; instrução de iluminação não se aplica.

**Header com X** (linhas 287-296 do capture-client — copiar VERBATIM):
```typescript
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
```
Nota: no upload em `(dashboard)`, sem `env(safe-area-inset-top)` pois o layout tem padding normal de desktop.

---

### `components/upload/UploadDropzone.tsx` (component UI, event-driven)

**Analog:** `apps/web/components/capture/AngleInterstitial.tsx` (layout fullscreen + Button CTA) + padrão de event listener de `hooks/use-mobile.ts`.

**Não há analog exato de drag-and-drop no codebase** — é o primeiro componente com `dragover`/`drop` nativo. Construir sobre padrões existentes.

**Interface de props** (derivada do uso em upload-client):
```typescript
interface UploadDropzoneProps {
  /** Callback chamado com o File aceito (após validação de MIME/size já feita aqui OU no caller) */
  onFileAccepted: (file: File) => void
  /** Desabilita interação durante 'analyzing' */
  disabled?: boolean
  /** Instrução do slot atual — exibida dentro da dropzone */
  slotLabel?: string
}
```

**Imports pattern** (seguir Pattern 4 — custom hook skeleton, mas como component):
```typescript
'use client'

import * as React from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
```

**Pattern de event listeners de drag** (baseado em `hooks/use-mobile.ts` linhas 9-16 — mesmo padrão de addEventListener + cleanup):
```typescript
export function UploadDropzone({ onFileAccepted, disabled, slotLabel }: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setIsDragOver(true)
  }
  const handleDragLeave = () => setIsDragOver(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file) onFileAccepted(file)
  }
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onFileAccepted(file)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 transition-colors cursor-pointer',
        isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-muted-foreground/60',
        disabled && 'pointer-events-none opacity-50',
      )}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label={`Área de upload${slotLabel ? ` — ${slotLabel}` : ''}`}
    >
      <Upload className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <div className="text-center space-y-1">
        {slotLabel && <p className="text-sm font-medium">{slotLabel}</p>}
        <p className="text-sm text-muted-foreground">
          Arraste e solte ou{' '}
          <span className="text-primary underline">selecione arquivo</span>
        </p>
        <p className="text-xs text-muted-foreground/70">JPEG · PNG · WebP · HEIC — máx. 25 MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  )
}
```

**Convenções herdadas:**
- Named export (sem default) — igual a todos os `components/capture/*.tsx`
- `cn()` de `@/lib/utils` para classes condicionais
- `aria-label` e `role` explícitos (a11y — padrão observado em `CapturePreview` linhas 81-86)
- `e.target.value = ''` depois de usar o input (igual a capture-client linha 117)

---

### `components/upload/HeicConversionToast.tsx` (opcional — pode ser inline)

**Decisão de planner:** se a conversão HEIC for inline no `handleFileAccepted` do upload-client com `toast.loading('Convertendo HEIC...', { id: 'heic-conversion' })`, este componente dedicado é desnecessário. Criar apenas se quiser um spinner mais elaborado dentro da dropzone.

**Analog se criado:** `apps/web/components/capture/CaptureProgress.tsx` (component presentacional simples):
```typescript
// Pattern: named export + interface props + Tailwind + lucide
'use client'
import * as React from 'react'
import { Loader2 } from 'lucide-react'

interface HeicConversionToastProps {
  isConverting: boolean
}

export function HeicConversionToast({ isConverting }: HeicConversionToastProps) {
  if (!isConverting) return null
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      Convertendo HEIC para JPEG...
    </div>
  )
}
```

---

### `lib/upload/heic-to-jpeg.ts` (lib utilitária, transform)

**Analog:** `apps/web/lib/capture/jpeg-compress.ts` (Canvas API, função async com Blob I/O) + padrão de dynamic import de `components/capture/IrisDetector.tsx` (só que aqui o dynamic import fica DENTRO da função, não no componente).

**Pattern de módulo lib puro** (baseado em `lib/utils.ts` e `lib/capture/storage-path.ts`):
```typescript
// Sem 'use client' ou 'use server' — lib pura (roda só no browser via import dinâmico)
// Dynamic import da lib HEIC dentro da função (bundle splitting — não carrega heic lib
// se o usuário não subir nenhum arquivo HEIC).

/**
 * Converte HEIC/HEIF para JPEG via dynamic import de heic2any (ou alternativa).
 * Chamado APENAS quando file.type === 'image/heic' || 'image/heif'.
 *
 * CONTEXT D-11: conversão client-side; bundle restrito à rota /upload via
 * dynamic import — não vaza pro resto do app.
 *
 * Fallback em erro: lança Error com mensagem amigável pt-BR — caller faz toast.
 */
export async function convertHeicToJpeg(file: File | Blob): Promise<Blob> {
  // Dynamic import — só carrega a lib quando necessário
  const heic2any = (await import('heic2any')).default
  const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
  // heic2any pode retornar Blob | Blob[]
  return Array.isArray(result) ? result[0] : result
}
```

**Convenções herdadas:**
- Named export (sem default)
- Sem `'use client'`/`'use server'` — lib pura
- Tipo de input/output explícito
- JSDoc com referência à decisão do CONTEXT

---

### `lib/upload/validate-file.ts` (lib utilitária, pura)

**Analog exato:** `apps/web/lib/capture/validate-image.ts` (pattern de `BLOCKING_REASONS` exportado + helpers puros `isVlmRejection`/`isBlockingRejection`) e `lib/capture/storage-path.ts` (validação de parâmetros lançando Error).

**Pattern completo** (baseado em `validate-image.ts` linhas 22-57 — estrutura de consts + tipos + helpers):
```typescript
// Sem 'use client' ou 'use server' — lib pura (roda no browser, sem IO)

const MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25MB — CONTEXT D-12

/** MIMEs aceitos diretamente (sem conversão). HEIC/HEIF são aceitos como input
 *  mas passam por convertHeicToJpeg antes de chegar no VLM. */
export const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

/** MIMEs que requerem conversão client-side antes de qualquer processamento. */
export const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif'])

export interface FileValidationResult {
  ok: boolean
  error?: string
  needsHeicConversion?: boolean
}

/**
 * Valida MIME type e tamanho do arquivo antes de enviar para VLM.
 * Puro e síncrono — sem IO.
 */
export function validateUploadFile(file: File): FileValidationResult {
  const mime = file.type.toLowerCase()
  // Fallback para extensão quando MIME não disponível (alguns SOs omitem para .heic)
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  const isHeic = HEIC_MIME_TYPES.has(mime) || ext === 'heic' || ext === 'heif'
  const isAccepted = ACCEPTED_MIME_TYPES.has(mime) || isHeic

  if (!isAccepted) {
    return {
      ok: false,
      error: 'Formato não suportado. Use JPEG, PNG, WebP ou HEIC.',
    }
  }

  if (file.size > MAX_SIZE_BYTES) {
    return {
      ok: false,
      error: 'Foto muito grande, máximo 25 MB. Verifique o formato (RAW e PNG não comprimido podem exceder o limite).',
    }
  }

  return { ok: true, needsHeicConversion: isHeic }
}
```

**Convenções herdadas:**
- Named exports (sem default) — igual a todos os `lib/capture/*.ts`
- Constantes em UPPER_SNAKE exportadas (igual a `BLOCKING_REASONS` em `validate-image.ts` linha 32)
- Tipo de resultado com `ok: boolean` + `error?: string` (mesmo padrão de `FileValidationResult`)
- JSDoc com referência à decisão do CONTEXT
- Sem side-effects, sem IO — puro e testável

---

### `app/actions/readings.ts` + `app/actions/readings.schemas.ts` (modificar)

**Pattern atual** (readings.ts linhas 34-61 — o trecho a modificar):
```typescript
// ANTES (atual, somente mobile_camera):
const parsed = createReadingSchema.safeParse({
  client_id: formData.get('client_id'),
})
// ...
const { data: reading, error } = await supabase
  .from('readings')
  .insert({
    client_id: parsed.data.client_id,
    therapist_id: user.id,
    status: 'pending',
    capture_method: 'mobile_camera',  // ← hardcoded
  })
```

```typescript
// DEPOIS (Fase 4 — aceita method do FormData):
// Em readings.schemas.ts — estender createReadingSchema:
export const createReadingSchema = z.object({
  client_id: z.string().uuid('client_id inválido'),
  method: z.enum(['mobile_camera', 'desktop_upload']).default('mobile_camera'),
})

// Em readings.ts — ler method do FormData:
const parsed = createReadingSchema.safeParse({
  client_id: formData.get('client_id'),
  method: formData.get('method') ?? 'mobile_camera',  // default garante compat retroativa
})
// ...
capture_method: parsed.data.method,  // ← vem do FormData
```

```typescript
// redirect destino depende do method:
if (parsed.data.method === 'desktop_upload') {
  redirect(`/leituras/nova/upload?reading=${reading.id}`)
} else {
  redirect(`/leituras/nova/capturar?reading=${reading.id}`)
}
```

**getDraftReading** — já retorna `capture_method` via select? Verificar. Se não, adicionar ao select:
```typescript
// Adicionar capture_method ao select de getDraftReading
const { data: pending } = await supabase
  .from('readings')
  .select(`
    id,
    created_at,
    client_id,
    capture_method,           // ← ADICIONAR para D-15 recovery banner routing
    client:clients(full_name),
    reading_images(count)
  `)
```

**DraftReading type** — adicionar campo:
```typescript
export type DraftReading = {
  id: string
  created_at: string
  client_id: string
  client_name: string
  imagesCaptured: number
  capture_method: 'mobile_camera' | 'desktop_upload'  // ← ADICIONAR para D-15
}
```

**Convenções críticas a manter** (Shared Pattern 1):
- `'use server'` na primeira linha
- `getUser()` não `getSession()` (T-02-06 — comentário inline obrigatório)
- `redirect('/login')` quando auth falha
- `revalidatePath('/leituras')` antes de `redirect`
- `therapist_id: user.id` em todo insert

---

### `app/(dashboard)/leituras/nova/new-reading-form.tsx` (modificar)

**Pattern atual** (60 linhas — lido acima inteiro).

A mudança é: o formulário atual tem um único submit button "Iniciar leitura". A Fase 4 adiciona:
1. Auto-detect de device no `useEffect`
2. Hidden input `method`
3. Dois CTAs (padrão D-01): botão principal + link de escape

**Pattern de device detection** (baseado em `hooks/use-mobile.ts` linhas 9-16 — mesmo padrão matchMedia):
```typescript
// Adicionar no início do componente:
const [chosenMethod, setChosenMethod] = React.useState<'mobile_camera' | 'desktop_upload'>('mobile_camera')

React.useEffect(() => {
  // matchMedia coarse+hover: mais robusto que User-Agent (cobre iPad modo desktop)
  const isTouchDevice = window.matchMedia('(pointer: coarse) and (hover: none)').matches
  setChosenMethod(isTouchDevice ? 'mobile_camera' : 'desktop_upload')
}, [])
```

**Hidden input no form** (pattern de `client-form.tsx` linha 110 — prop `name` obrigatória):
```typescript
// Dentro de <form action={formAction} ...>
<input type="hidden" name="method" value={chosenMethod} />
```

**Dois CTAs** (substituir botão único atual linhas 92-106 por):
```typescript
<div className="space-y-3 pt-2">
  <Button type="submit" disabled={isPending} aria-busy={isPending} className="w-full">
    {isPending ? (
      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparando leitura...</>
    ) : (
      chosenMethod === 'mobile_camera' ? 'Iniciar captura mobile' : 'Selecionar arquivos no computador'
    )}
  </Button>

  {/* Link de escape — discreto, abaixo do CTA principal */}
  <button
    type="submit"
    name="method"
    value={chosenMethod === 'mobile_camera' ? 'desktop_upload' : 'mobile_camera'}
    disabled={isPending}
    className="w-full text-sm text-muted-foreground underline-offset-2 hover:underline text-center"
  >
    {chosenMethod === 'mobile_camera'
      ? 'Tenho fotos prontas — subir do computador'
      : 'Quero usar a câmera do dispositivo'}
  </button>
</div>
```

**Nota sobre submit alternativo:** o botão de escape pode ser um `<button type="submit" name="method" value="...">` que sobrescreve o hidden input — é o padrão HTML canônico para dois submits com valores diferentes. O server action lê `formData.get('method')` e o browser envia o value do botão clicado.

---

### `components/recovery/RecoveryBanner.tsx` (criar — não existe ainda)

**Analog:** `apps/web/components/clientes/delete-client-dialog.tsx` (74 linhas — useTransition + server action + Loader2).

O `RecoveryBanner` foi planejado na Fase 3 mas nunca foi criado (verificado por Glob). Precisa ser criado nesta fase para implementar D-15 (routing por `capture_method`).

**Imports pattern** (copiar de `delete-client-dialog.tsx` linhas 1-14):
```typescript
'use client'

import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { discardReadingAction } from '@/app/actions/readings'
import { Button } from '@/components/ui/button'
import type { DraftReading } from '@/app/actions/readings'
```

**Interface de props:**
```typescript
interface RecoveryBannerProps {
  draft: DraftReading  // inclui capture_method após extensão D-15
}
```

**Pattern useTransition + server action** (copiar de `delete-client-dialog.tsx` linhas 28-35):
```typescript
export function RecoveryBanner({ draft }: RecoveryBannerProps) {
  const [isPending, startTransition] = useTransition()

  // D-15: roteia por capture_method
  const continueHref = draft.capture_method === 'desktop_upload'
    ? `/leituras/nova/upload?reading=${draft.id}&resume=true`
    : `/leituras/nova/capturar?reading=${draft.id}&resume=true`

  function handleDiscard() {
    startTransition(async () => {
      await discardReadingAction(draft.id)
    })
  }

  return (
    <div role="alert" className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-amber-900">
          Leitura incompleta de {draft.client_name}
        </p>
        <p className="text-xs text-amber-700">
          {draft.imagesCaptured}/6 fotos — {draft.capture_method === 'desktop_upload' ? 'upload desktop' : 'captura mobile'}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button variant="outline" size="sm" asChild>
          <a href={continueHref}>Continuar</a>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDiscard}
          disabled={isPending}
          aria-busy={isPending}
          className="text-destructive hover:text-destructive"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Descartar'}
        </Button>
      </div>
    </div>
  )
}
```

**Injeção no layout** — o `RecoveryBanner` precisa ser montado em `app/(dashboard)/layout.tsx`. Pattern para a query (baseado no layout atual, linhas 12-19):
```typescript
// Em app/(dashboard)/layout.tsx — adicionar APÓS a query de profile:
import { getDraftReading } from '@/app/actions/readings'
import { RecoveryBanner } from '@/components/recovery/RecoveryBanner'

// No corpo async:
const draft = await getDraftReading()

// No JSX, dentro de SidebarInset antes do <main>:
{draft && <div className="px-6 pt-4"><RecoveryBanner draft={draft} /></div>}
```

---

### `components/capture/CapturePreview.tsx` (modificar — prop `mode`)

**Pattern atual** (16 props na interface, linhas 16-29 — lido acima).

Adicionar prop opcional `mode` para adaptar copy do botão Refazer:
```typescript
interface CapturePreviewProps {
  imageUrl: string
  qualityScore: number
  onRedo: () => void
  onConfirm: () => void
  analysis?: PostCaptureAnalysis | null
  /** 'camera' (default) → "Refazer" | 'upload' → "Trocar arquivo" */
  mode?: 'camera' | 'upload'  // ← ADICIONAR
}
```

**No JSX** (linha 141-146 do `CapturePreview.tsx`):
```typescript
// ANTES:
<Button onClick={onRedo} variant="secondary" className="flex-1 h-11 text-sm font-semibold">
  Refazer
</Button>

// DEPOIS:
<Button onClick={onRedo} variant="secondary" className="flex-1 h-11 text-sm font-semibold">
  {mode === 'upload' ? 'Trocar arquivo' : 'Refazer'}
</Button>
```

Uso no `upload-client.tsx`:
```typescript
<CapturePreview
  imageUrl={pendingPreview.imageUrl}
  qualityScore={pendingPreview.qualityScore}
  analysis={pendingPreview.analysis}
  onRedo={handleRedo}
  onConfirm={handleConfirm}
  mode="upload"  // ← NOVO
/>
```

---

### `lib/capture/sequence.ts` (modificar — CTA do AngleInterstitial)

**Pattern atual** — `getSlotInstructionCopy` (linhas 109-137) retorna `cta: 'Abrir câmera'` hardcoded.

Para upload, o CTA deve ser "Selecionar arquivo". Solução mais limpa que uma prop string avulsa: adicionar parâmetro opcional `mode`:

```typescript
// ANTES (linha 135):
return {
  heading: `Foto ${slotIndex + 1} de ${SEQUENCE.length} — Olho ${eyeUpper} · ${angleLabel}`,
  subtitle,
  cta: 'Abrir câmera',
}

// DEPOIS:
export function getSlotInstructionCopy(
  slot: Slot,
  slotIndex: number,
  mode: 'camera' | 'upload' = 'camera',  // ← ADICIONAR parâmetro com default
): { heading: string; subtitle: string; cta: string } {
  // ...
  return {
    heading: `Foto ${slotIndex + 1} de ${SEQUENCE.length} — Olho ${eyeUpper} · ${angleLabel}`,
    subtitle,
    cta: mode === 'upload' ? 'Selecionar arquivo' : 'Abrir câmera',
  }
}
```

`AngleInterstitial` também precisa aceitar e repassar o `mode`:
```typescript
// AngleInterstitial.tsx — adicionar prop opcional:
interface AngleInterstitialProps {
  nextSlot: Slot
  slotIndex: number
  onProceed: () => void
  mode?: 'camera' | 'upload'  // ← ADICIONAR
}

// No corpo:
const copy = getSlotInstructionCopy(nextSlot, slotIndex, mode)
```

Uso no `upload-client.tsx`:
```typescript
<AngleInterstitial
  nextSlot={slot}
  slotIndex={slotIndex}
  onProceed={() => {/* No-op ou abrir file dialog */}}
  mode="upload"  // ← NOVO
/>
```

**Nota:** `onProceed` no upload-client pode ser no-op pois a dropzone já está visível na fase `'instruction'`. Ou pode passar `() => inputRef?.current?.click()` se a dropzone tiver um ref. Decisão do planner.

---

## Mecanismos de Reuso — Resumo Executivo

Esta seção documenta **o que NÃO precisa ser escrito do zero** e de onde importar.

### Exports reutilizados sem modificação

| Módulo | Exports reutilizados | Notas |
|---|---|---|
| `lib/capture/sequence.ts` | `SEQUENCE`, `getResumeSlotIndex`, `getSlotProgressLabel`, `Slot`, `Eye`, `Angle` | Copiar imports verbatim do capture-client |
| `lib/capture/upload.ts` | `uploadWithRetry`, `UploadArgs` | Aceita `Blob` — `File extends Blob`, funciona sem adaptação |
| `lib/capture/validate-image.ts` | `validateImageWithClaude`, `BLOCKING_REASONS`, `isBlockingRejection` | Idêntico — VLM gate sem alteração |
| `lib/capture/post-capture-analysis.ts` | `analyzeCapturedJpeg`, `PostCaptureAnalysis` | Idêntico — cameraDetection pode retornar 'unknown' para fotos de arquivo; não há bloqueio de câmera frontal no upload |
| `lib/capture/storage-path.ts` | `buildOriginalStoragePath` | Path canônico idêntico |
| `lib/capture/quality-scoring.ts` | `QualityLevel`, `levelFromScore`, `LEVEL_BG_CLASS`, `LEVEL_TEXT_CLASS`, `LEVEL_LABEL` | Idêntico |
| `components/capture/CaptureProgress.tsx` | `CaptureProgress` | Importar sem modificação — "N de 6" é neutro |
| `components/capture/AngleIcon.tsx` | `AngleIcon` | Importar sem modificação — SVG neutro |
| `app/actions/readings.ts` | `finalizeReadingAction`, `discardReadingAction`, `saveReadingImagesAction`, `cleanupStaleEmptyReadingsAction` | Neutros de método — reutilizar tal qual |

### Exports reutilizados COM adaptação

| Módulo | Export | Adaptação necessária |
|---|---|---|
| `lib/capture/sequence.ts` | `getSlotInstructionCopy` | Adicionar parâmetro `mode?: 'camera' \| 'upload'` com default `'camera'` |
| `components/capture/CapturePreview.tsx` | `CapturePreview` | Adicionar prop `mode?: 'camera' \| 'upload'` para copy do botão Refazer |
| `components/capture/AngleInterstitial.tsx` | `AngleInterstitial` | Adicionar prop `mode?: 'camera' \| 'upload'` repassada para `getSlotInstructionCopy` |
| `app/actions/readings.ts` | `createReadingAction` | Ler `formData.get('method')` com default `'mobile_camera'` |
| `app/actions/readings.ts` | `getDraftReading` | Adicionar `capture_method` ao select + ao tipo `DraftReading` |

---

## Shared Patterns

### Pattern A: Server Action Boilerplate (CRUD)

**Source:** `apps/web/app/actions/readings.ts` linhas 1-61 (atual)
**Apply to:** extensão de `createReadingAction` + criação de qualquer nova action

```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// SEMPRE getUser() — nunca getSession() no servidor (T-02-06)
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (!user || authError) redirect('/login')
```

### Pattern B: State Machine Client Wizard

**Source:** `apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx` (350 linhas inteiras)
**Apply to:** `upload-client.tsx` — clonar e fazer substituições cirúrgicas

Fases da state machine (idênticas):
```typescript
type Phase = 'instruction' | 'analyzing' | 'previewing' | 'finalizing'
```

Refs (idênticas):
```typescript
const slotAbortRefs = React.useRef<Map<number, AbortController>>(new Map())
const uploadPromisesRef = React.useRef<Map<number, Promise<unknown>>>(new Map())
const finalizingTriggeredRef = React.useRef(false)
```

### Pattern C: Upload em Background com AbortController

**Source:** `apps/web/lib/capture/upload.ts` + `capture-client.tsx` linhas 160-213
**Apply to:** `upload-client.tsx` `executeUpload` — copiar verbatim

```typescript
// Padrão de cancelamento de slot anterior ao refazer:
const previousAbort = slotAbortRefs.current.get(currentSlotIdx)
if (previousAbort) previousAbort.abort()
const ac = new AbortController()
slotAbortRefs.current.set(currentSlotIdx, ac)

// uploadWithRetry aceita signal para AbortController
const uploadP = uploadWithRetry({ ..., signal: ac.signal })
uploadPromisesRef.current.set(currentSlotIdx, uploadP)
```

### Pattern D: useTransition + Server Action + Loader2

**Source:** `apps/web/components/clientes/delete-client-dialog.tsx` linhas 28-68
**Apply to:** `RecoveryBanner.tsx`

```typescript
const [isPending, startTransition] = useTransition()
<Button disabled={isPending} aria-busy={isPending}>
  {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando...</> : 'Ação'}
</Button>
```

### Pattern E: Server Component → Client Wizard Handoff

**Source:** `apps/web/app/(capture)/leituras/nova/capturar/page.tsx` (60 linhas inteiras)
**Apply to:** `upload/page.tsx`

```typescript
// Next.js 15: searchParams como Promise<...>
export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ reading?: string; resume?: string }>
}) {
  const { reading: readingId } = await searchParams
  // RLS implícita — sem .eq('therapist_id', user.id)
  const { data: reading } = await supabase.from('readings').select('...').eq('id', readingId).single()
  if (!reading) redirect('/leituras/nova')
  return <UploadClient {...props} />
}
```

### Pattern F: Lib Pura Utilitária

**Source:** `apps/web/lib/capture/validate-image.ts` (consts exportados + helpers puros)
**Apply to:** `lib/upload/validate-file.ts`, `lib/upload/heic-to-jpeg.ts`

```typescript
// Sem 'use client' / 'use server'
// Named exports (sem default)
// Const exportada em UPPER_SNAKE para valores usados fora
// JSDoc com referência ao CONTEXT D-XX
export const ACCEPTED_MIME_TYPES = new Set([...])
export function validateUploadFile(file: File): FileValidationResult { ... }
```

### Pattern G: Form com Hidden Input para FormData

**Source:** `apps/web/app/(dashboard)/leituras/nova/new-reading-form.tsx` linhas 61-91 (pattern do Select com `name` prop)
**Apply to:** adição de hidden input `method` no `new-reading-form.tsx`

```typescript
// Dentro de <form action={formAction}>:
// Hidden input injeta valor no FormData sem interação do usuário
<input type="hidden" name="method" value={chosenMethod} />

// Para dois submits com valores diferentes:
<button type="submit" name="method" value="desktop_upload">...</button>
// Sobrescreve o hidden input — browser envia o value do botão clicado
```

---

## No Analog Found

| Arquivo | Papel | Razão |
|---|---|---|
| `lib/upload/heic-to-jpeg.ts` | browser transform (WASM/lib) | Primeiro uso de `heic2any`/`libheif-js` no projeto. Planner pesquisa estado atual em 2026 (`heic2any` ~600KB vs `libheif-js` WASM ~700KB) antes de fixar. Pattern de dynamic import segue `IrisDetector.tsx` (Fase 3). |

---

## Metadata

**Escopo de busca de analogs:**
- `apps/web/app/(capture)/leituras/nova/capturar/`
- `apps/web/app/(dashboard)/leituras/nova/`
- `apps/web/app/actions/readings.ts` + `readings.schemas.ts`
- `apps/web/components/capture/*.tsx`
- `apps/web/components/clientes/delete-client-dialog.tsx`
- `apps/web/lib/capture/*.ts`
- `apps/web/hooks/use-mobile.ts`

**Arquivos lidos:** 19 (14 em full, 5 estruturalmente via Glob)
**Analogs fortes:** 7 (Patterns A–G)
**Data de extração:** 2026-05-03
**Phase:** 04-upload-desktop
