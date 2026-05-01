# Phase 3: Captura mobile (PWA) — Pattern Map

**Mapped:** 2026-05-01
**Files analyzed:** 38 novos + 8 modificados = 46
**Analogs found:** 32 / 38 (84%)

> Mapeamento de cada arquivo novo da Fase 3 para o analog mais próximo já existente em `apps/web/` (Fases 1+2). Cada entrada cita arquivo + linhas para o planner copiar imports, convenções de validação Zod, padrão `'use server'`/`createClient()` e nomenclatura.

---

## File Classification

### Novos arquivos

| Arquivo novo | Papel | Fluxo | Analog mais próximo | Match |
|---|---|---|---|---|
| `supabase/migrations/0004_storage_bucket_iris_captures.sql` | migration | DDL/policies | `supabase/migrations/0001_initial_schema.sql` | role-match (storage policies são novidade — usar pattern de policy de `reading_images`) |
| `apps/web/app/manifest.ts` | config (Next metadata route) | static-config | — (sem analog interno) | none — usar RESEARCH §PWA |
| `apps/web/app/sw.ts` | config (service worker) | event-driven | — | none — usar Serwist boilerplate (RESEARCH) |
| `apps/web/app/(capture)/layout.tsx` | layout | request-response | `app/(auth)/layout.tsx` (layout sem sidebar) | exact (layout minimalista full-screen) |
| `apps/web/app/(capture)/leituras/nova/capturar/page.tsx` | page (server component shell) | request-response | `app/(dashboard)/clientes/[id]/page.tsx` (server query → client component) | exact |
| `apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx` | component (client orchestrator) | streaming + state-machine | `components/clientes/clients-table.tsx` (client component complex state) | role-match |
| `apps/web/app/(dashboard)/leituras/nova/page.tsx` | page (form de seleção) | request-response | `app/(dashboard)/clientes/page.tsx` (server query + Link CTA) + `components/clientes/client-form.tsx` (Form + Select) | exact |
| `apps/web/app/(dashboard)/leituras/nova/upload/page.tsx` | page (placeholder) | static-content | `app/(dashboard)/leituras/page.tsx` (placeholder atual "Em breve") | exact |
| `apps/web/app/actions/readings.ts` | server-action | CRUD | `app/actions/clients.ts` | exact |
| `apps/web/components/capture/CameraView.tsx` | component (browser API wrapper) | streaming | `components/dashboard/dashboard-header.tsx` (`'use client'` + browser API + state) | role-match |
| `apps/web/components/capture/IrisDetector.tsx` | component (lazy-loaded ML) | streaming | — | none — usar `next/dynamic { ssr: false }` (RESEARCH §MediaPipe) |
| `apps/web/components/capture/QualityIndicator.tsx` | component (presentational) | request-response | `components/dashboard/summary-cards.tsx` (props + Tailwind tokens + lucide) | role-match |
| `apps/web/components/capture/CapturePreview.tsx` | component (interactive) | event-driven | `components/clientes/delete-client-dialog.tsx` (`'use client'` + state + transition) | role-match |
| `apps/web/components/capture/AngleIcon.tsx` | component (SVG inline) | static | — | none (asset criado do zero — UI-SPEC §AngleIcon) |
| `apps/web/components/capture/AngleInterstitial.tsx` | component (full-screen) | request-response | `app/(auth)/layout.tsx` (full-screen flex centralizado) + `components/clientes/client-form.tsx` (Button + heading) | role-match |
| `apps/web/components/capture/AngleOverlay.tsx` | component (overlay) | event-driven | `components/dashboard/dashboard-header.tsx` (client + state com auto-dismiss) | role-match |
| `apps/web/components/capture/CameraDeniedScreen.tsx` | component (error state) | static | `components/clientes/clients-table.tsx` linhas 41-53 (empty-state com ícone + heading + body + CTA) | role-match |
| `apps/web/components/capture/PWAInstallBanner.tsx` | component (banner) | event-driven | `components/dashboard/dashboard-header.tsx` (client + browser API + dismiss state) | role-match |
| `apps/web/components/capture/RecoveryBanner.tsx` | component (banner) | request-response | `components/clientes/delete-client-dialog.tsx` (confirm dialog + transition + server action) | role-match |
| `apps/web/components/capture/CaptureProgress.tsx` | component (presentational) | request-response | `components/dashboard/summary-cards.tsx` (props + Tailwind tokens) | role-match |
| `apps/web/components/capture/LiveFeedbackMessage.tsx` | component (presentational) | request-response | `components/dashboard/summary-cards.tsx` (props simples) | partial-match (a11y `aria-live` é novo) |
| `apps/web/hooks/use-camera.ts` | hook (browser API) | streaming | `hooks/use-mobile.ts` | exact (mesmo formato de hook custom) |
| `apps/web/hooks/use-iris-detector.ts` | hook (ML wrapper) | streaming | `hooks/use-mobile.ts` | role-match |
| `apps/web/hooks/use-quality-score.ts` | hook (state-machine) | streaming + state | `hooks/use-mobile.ts` | role-match |
| `apps/web/hooks/use-pwa-install.ts` | hook (browser event) | event-driven | `hooks/use-mobile.ts` (matchMedia listener pattern) | role-match |
| `apps/web/lib/capture/quality-scoring.ts` | lib (pure logic) | transform | `lib/utils.ts` (pure helper module) | partial-match (estrutura de export, mas conteúdo único) |
| `apps/web/lib/capture/laplacian-variance.ts` | lib (pure logic) | transform | `lib/utils.ts` | partial-match |
| `apps/web/lib/capture/exposure.ts` | lib (pure logic) | transform | `lib/utils.ts` | partial-match |
| `apps/web/lib/capture/iris-geometry.ts` | lib (pure logic) | transform | `lib/utils.ts` | partial-match |
| `apps/web/lib/capture/jpeg-compress.ts` | lib (browser API) | transform | `lib/utils.ts` | partial-match |
| `apps/web/lib/capture/storage-path.ts` | lib (pure logic) | transform | `lib/utils.ts` | exact (helper puro) |
| `apps/web/components/ui/progress.tsx` | shadcn block | static | `components/ui/badge.tsx` | exact (boilerplate shadcn — gerado por `pnpm dlx shadcn add`) |
| `apps/web/components/ui/alert.tsx` | shadcn block | static | `components/ui/badge.tsx` | exact |
| `apps/web/components/ui/sonner.tsx` | shadcn block | event-driven | `components/ui/dialog.tsx` | exact |
| `apps/web/public/mediapipe/face_landmarker.task` | asset (binary) | — | — | none |
| `apps/web/public/icons/icon-{192,512,maskable}.png` | asset (binary) | — | — | none |
| `apps/web/vitest.config.ts` | config (test runner) | — | — (não há vitest ainda) | none — usar RESEARCH §Wave 0 |
| `apps/web/tests/setup.ts` | config (test setup) | — | — | none |
| `apps/web/lib/capture/*.test.ts` | test (unit) | — | — | none — primeiro test do projeto |
| `apps/web/hooks/use-quality-score.test.ts` | test (unit) | — | — | none |
| `supabase/tests/storage_cross_therapist_rls.sql` | test (RLS integration) | — | `supabase/tests/cross_therapist_rls.sql` | exact |

### Arquivos modificados

| Arquivo modificado | Mudança | Analog do delta |
|---|---|---|
| `apps/web/package.json` | adicionar deps + scripts | — (edição direta) |
| `apps/web/next.config.ts` | wrap com `withSerwistInit` | RESEARCH §PWA shell |
| `apps/web/app/layout.tsx` | adicionar `appleWebApp`, `viewport`, `applicationName` | edição direta de metadata |
| `apps/web/app/(dashboard)/layout.tsx` | injetar query de rascunho + `<RecoveryBanner>` | pattern de query no layout já presente (linhas 21-30) |
| `apps/web/app/(dashboard)/clientes/[id]/page.tsx` | ativar botão "Nova Leitura" (linhas 70-72 — atualmente disabled) | trocar `<Button disabled>` por `<Link href={`/leituras/nova?cliente=${client.id}`}>` |
| `apps/web/app/(dashboard)/leituras/page.tsx` | substituir placeholder por listagem com filter `status='pending'` | pattern de `app/(dashboard)/clientes/page.tsx` (server query + Table) |
| `apps/web/components/dashboard/app-sidebar.tsx` | possivelmente adicionar item "Nova Leitura" | adicionar entry no array `navItems` (linha 15-19) |
| `apps/web/types/database.ts` | regenerar via `pnpm gen:types` após migration 0004 | comando único, sem pattern |

---

## Pattern Assignments

### `app/actions/readings.ts` (server-action, CRUD)

**Analog:** `apps/web/app/actions/clients.ts` (109 linhas — match exato de papel + fluxo)

**Imports canônicos** (linhas 1-6 — copiar verbatim):
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
```

**Pattern Zod schema** (linhas 8-14 — copiar estrutura):
```typescript
// Zod v4: usar .min(1, msg) não { required_error: msg }
const readingSchema = z.object({
  client_id: z.string().uuid('client_id inválido'),
  capture_method: z.enum(['mobile_camera', 'desktop_upload']),
})
```

**Pattern auth + insert + redirect** (linhas 20-51 — copiar fluxo verbatim, trocar `clients` por `readings`):
```typescript
export async function createReadingAction(
  _prevState: ReadingFormState,
  formData: FormData
): Promise<ReadingFormState> {
  const supabase = await createClient()
  // SEMPRE verificar autenticação no Server Action (não depender só do middleware — T-02-06)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user || authError) {
    redirect('/login')
  }

  const parsed = readingSchema.safeParse({ /* ... */ })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { data: reading, error } = await supabase
    .from('readings')
    .insert({ ...parsed.data, therapist_id: user.id, status: 'pending' })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/leituras')
  redirect(`/leituras/nova/capturar?reading=${reading.id}`)
}
```

**Pattern delete** (linhas 90-109 — copiar para `discardReadingAction`):
```typescript
export async function deleteClientAction(clientId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) redirect('/login')

  // RLS garante que só o dono pode deletar; cascade apaga leituras e imagens
  const { error } = await supabase.from('clients').delete().eq('id', clientId)

  if (error) return { error: error.message }

  revalidatePath('/clientes')
  return {}
}
```

**Convenções a herdar:**
- `_prevState` com `_` quando não usado (lint)
- `redirect('/login')` em vez de throw quando auth falha
- `revalidatePath` antes de `redirect` final
- Comentário "RLS garante que só o dono..." em todo delete
- Type `ReadingFormState` exportado para o client component

**Funções a criar:** `createReadingAction`, `finalizeReadingAction(readingId)`, `discardReadingAction(readingId)`, `getDraftReading()` (query de recovery — D-12).

---

### `app/(capture)/layout.tsx` (layout, request-response)

**Analog:** `apps/web/app/(auth)/layout.tsx` (18 linhas — match exato: layout minimalista sem sidebar)

**Pattern completo** (copiar com adaptação):
```typescript
export default function CaptureLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-[100dvh] bg-black flex flex-col">
      {children}
    </div>
  )
}
```

**Adaptações pela UI-SPEC §Layout:**
- Trocar `bg-background` por `bg-black` (viewfinder full-screen)
- `min-h-screen` → `min-h-[100dvh]` (mobile dynamic viewport)
- Adicionar `viewport` metadata export (`viewport-fit=cover` para safe-area iOS notch)
- Sem footer (UI-SPEC §Viewport — telas auxiliares cuidam disso)
- Não chamar `createClient()` aqui — middleware já protege `/leituras/*` (ver `middleware.ts` linha 7)

---

### `app/(capture)/leituras/nova/capturar/page.tsx` (page server-component, request-response)

**Analog:** `apps/web/app/(dashboard)/clientes/[id]/page.tsx` (77 linhas — match exato: server query + render client component)

**Pattern imports** (linhas 1-6 — copiar):
```typescript
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
```

**Pattern fetch + guard + render** (linhas 15-32 — adaptar):
```typescript
export default async function CapturarPage({
  searchParams,
}: {
  searchParams: Promise<{ reading?: string; resume?: string }>
}) {
  const { reading: readingId } = await searchParams
  if (!readingId) redirect('/leituras/nova')

  const supabase = await createClient()
  const { data: reading, error } = await supabase
    .from('readings')
    .select('*, clients(full_name), reading_images(eye, angle, quality_score)')
    .eq('id', readingId)
    .single()

  if (!reading || error) notFound()

  return <CaptureClient reading={reading} />
}
```

**Convenções a herdar:**
- `params`/`searchParams` como `Promise<...>` (Next.js 15 async params)
- `await params` antes de uso
- `notFound()` em vez de throw quando reading não existe (RLS retorna `null` se não for do terapeuta)
- Server component fino: query + handoff para client component (analog: `[id]/editar/page.tsx`)

---

### `app/(capture)/leituras/nova/capturar/capture-client.tsx` (component, streaming + state-machine)

**Analog:** `apps/web/components/clientes/clients-table.tsx` (122 linhas — role-match: client component complexo com state)

**Pattern imports cabeçalho** (linhas 1-15):
```typescript
'use client'

import { useState } from 'react'
// ... outros hooks de capture
import { Button } from '@/components/ui/button'
// ... componentes shadcn + capture
import type { Database } from '@/types/database'

type Reading = Database['public']['Tables']['readings']['Row']
```

**Convenções a herdar:**
- `'use client'` primeira linha
- `import type { Database }` (linha 15) e tipos derivados `Database['public']['Tables']['x']['Row']`
- State local com `useState` (linha 24-25)
- Sub-componentes filhos importados de `./` ou `@/components/`

**Particularidades a adicionar (sem analog direto):**
- `useEffect` para inicializar `useCamera` + `useIrisDetector`
- `next/dynamic` para `IrisDetector` (lazy-load MediaPipe — RESEARCH §lazy-load)

---

### `app/(dashboard)/leituras/nova/page.tsx` (page com form, request-response)

**Analog 1:** `apps/web/app/(dashboard)/clientes/page.tsx` (26 linhas — H1 + CTA)
**Analog 2:** `apps/web/components/clientes/client-form.tsx` (167 linhas — Form com Select)

**Pattern do header** (clientes/page.tsx linhas 7-25):
```typescript
export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('full_name', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        {/* CTA */}
      </div>
      {/* Componente */}
    </div>
  )
}
```

**Pattern do Select com Form** (client-form.tsx linhas 104-131 — copiar para o select de cliente):
```typescript
<FormField
  control={form.control}
  name="client_id"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Cliente</FormLabel>
      {/* base-ui Select: name prop injeta hidden input no form para FormData */}
      <Select name="client_id" value={field.value ?? null} onValueChange={field.onChange}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o cliente" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {clients.map(c => (
            <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Convenção crítica (linha 110-111):** `Select` do `@base-ui/react` precisa da prop `name` para injetar hidden input no FormData — sem isso o server action não recebe o valor.

**Pattern empty-state** (clients-table.tsx linhas 41-48 — copiar para "sem clientes cadastrados"):
```typescript
{clients.length === 0 ? (
  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
    <p className="text-lg font-medium">Você ainda não tem clientes cadastrados.</p>
    <p className="text-sm text-muted-foreground">Cadastre antes de iniciar uma leitura.</p>
    <Link href="/clientes/novo" className={cn(buttonVariants({ size: 'sm' }))}>
      Cadastrar cliente
    </Link>
  </div>
) : (/* Form */)}
```

---

### `app/(dashboard)/leituras/nova/upload/page.tsx` (page placeholder)

**Analog:** `apps/web/app/(dashboard)/leituras/page.tsx` (13 linhas — exato)

**Pattern verbatim** (copiar e adaptar copy):
```typescript
import { Upload } from 'lucide-react'

export default function UploadPlaceholderPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
      <Upload className="h-16 w-16 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Upload desktop em breve</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        Disponível na Fase 4. Use a captura mobile para registrar imagens agora.
      </p>
    </div>
  )
}
```

---

### `components/capture/CameraView.tsx` (component, streaming)

**Analog:** `apps/web/components/dashboard/dashboard-header.tsx` (73 linhas — role-match: client component + browser API + state)

**Pattern imports** (linhas 1-9):
```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'  // só se precisar
```

**Convenções a herdar:**
- `'use client'` primeira linha (linha 1)
- Browser API isolada em hook ou ref (linha 35-38: `createClient()` chamado dentro do handler, não no top-level)
- Cleanup em `useEffect` returns (criar para cleanup do MediaStream)
- State derivado de browser API (analog linha 27-29: `daysLeft` derivado de `trialEndsAt`)

**Particularidade (sem analog):**
- `<video ref={videoRef} />` controlado por hook `useCamera`
- Estados visuais 6: idle, requesting, denied, streaming, capturing, error (UI-SPEC §CameraView)

---

### `components/capture/IrisDetector.tsx` (component, lazy-loaded ML)

**Analog:** nenhum — primeiro uso de `next/dynamic` no projeto.

**Pattern recomendado pela RESEARCH §MediaPipe lazy-load:**
```typescript
'use client'

// Em capture-client.tsx (não no IrisDetector):
import dynamic from 'next/dynamic'

const IrisDetector = dynamic(() => import('@/components/capture/IrisDetector'), {
  ssr: false,
  loading: () => <div className="text-white">Carregando detector...</div>,
})
```

**No próprio IrisDetector.tsx:** import top-level de `@mediapipe/tasks-vision` (válido pois `next/dynamic` lazy-loadou o módulo inteiro). Não usar dynamic dentro do próprio componente.

---

### `components/capture/QualityIndicator.tsx`, `CaptureProgress.tsx`, `LiveFeedbackMessage.tsx` (componentes presentational)

**Analog:** `apps/web/components/dashboard/summary-cards.tsx` (56 linhas — role-match: presentational com props)

**Pattern imports + interface props** (linhas 1-9):
```typescript
import { Users, FileText, CreditCard } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SummaryCardsProps {
  clientsCount: number
  trialEndsAt: string | null
  subscriptionStatus: string | null
}

export function SummaryCards({ clientsCount, trialEndsAt, subscriptionStatus }: SummaryCardsProps) {
```

**Convenções a herdar:**
- `interface XxxProps` declarado acima do componente
- Named export (`export function`, sem `default`)
- Tailwind tokens via classes (sem CSS-in-JS)
- Lucide icons importados nominalmente

**Adaptação para `QualityIndicator`** (UI-SPEC §QualityIndicator — barra full-width 8px topo):
- Props: `score: number` ou `level: 'ruim' | 'regular' | 'boa' | 'excelente'`
- Mapeamento de cor: `bg-red-500 | bg-amber-400 | bg-emerald-400 | bg-emerald-600` (UI-SPEC §Color tabela qualidade)
- Animação `transition-all duration-300 ease-out`

---

### `components/capture/CapturePreview.tsx`, `RecoveryBanner.tsx` (componentes interactive com transition)

**Analog:** `apps/web/components/clientes/delete-client-dialog.tsx` (74 linhas — role-match: client + state + transition + server action call)

**Pattern imports + transition** (linhas 1-15):
```typescript
'use client'

import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { deleteClientAction } from '@/app/actions/clients'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import type { Database } from '@/types/database'
```

**Pattern handler com transition** (linhas 28-35 — copiar para `discardReading`):
```typescript
function handleDelete() {
  startTransition(async () => {
    const result = await deleteClientAction(client.id)
    if (!result?.error) {
      onOpenChange(false)
    }
  })
}
```

**Pattern Button com aria-busy + spinner** (linhas 56-68):
```typescript
<Button
  variant="destructive"
  onClick={handleDelete}
  disabled={isPending}
  aria-busy={isPending}
>
  {isPending ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Excluindo...
    </>
  ) : (
    'Excluir'
  )}
</Button>
```

**Convenções a herdar:**
- `useTransition` para chamadas de server action (não `useState` + try/catch)
- `aria-busy={isPending}` em todo botão de submit
- `Loader2` da lucide com `animate-spin`
- Texto do botão troca para gerúndio durante pending

---

### `components/capture/CameraDeniedScreen.tsx` (component, error state full-screen)

**Analog:** `apps/web/components/clientes/clients-table.tsx` linhas 41-53 + `app/(dashboard)/leituras/page.tsx` (full-screen empty state)

**Pattern empty/error full-screen** (leituras/page.tsx — copiar estrutura):
```typescript
import { CameraOff } from 'lucide-react'

export function CameraDeniedScreen({ errorType, onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-4 text-center px-6">
      <CameraOff className="h-16 w-16 text-destructive" />
      <h1 className="text-xl font-semibold">
        {errorType === 'NotAllowedError' ? 'Permissão da câmera negada' : 'Câmera não disponível'}
      </h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        Para registrar as imagens da íris, o app precisa de acesso à câmera traseira do seu celular.
      </p>
      {/* Card com instruções por SO + 2 botões empilhados */}
    </div>
  )
}
```

**Variação:** trocar `Eye` por `CameraOff`, `text-muted-foreground` por `text-destructive` no ícone.

---

### `components/capture/AngleInterstitial.tsx` (component, full-screen transition)

**Analog:** `apps/web/app/(auth)/layout.tsx` (18 linhas — full-screen flex centralizado)

**Pattern wrapper full-screen** (linhas 6-10 — adaptar):
```typescript
<div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-4 py-12">
  <div className="w-full max-w-sm">
    {/* AngleIcon 96×96 + Heading + Subtítulo + CTA Button h-12 full-width */}
  </div>
</div>
```

**Convenções a herdar:**
- `min-h-screen` → `min-h-[100dvh]` em mobile
- `flex flex-col items-center justify-center`
- Footer institucional (auth/layout linhas 11-15) — **omitir** aqui (UI-SPEC: foco no CTA)

---

### `components/capture/PWAInstallBanner.tsx`, `AngleOverlay.tsx` (banners com auto-dismiss/event)

**Analog:** `apps/web/components/dashboard/dashboard-header.tsx` linhas 1-9 (`'use client'` + `useRouter` + browser API)

**Pattern imports** (linhas 1-15):
```typescript
'use client'

import { useState, useEffect } from 'react'
import { Share, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
```

**Convenções a herdar:**
- Local state + `useEffect` para event listeners (linha 35-38 do header é mais simples — adicionar cleanup)
- Botão de dismiss com `aria-label` (analog linha 53-56)

---

### `hooks/use-camera.ts`, `use-iris-detector.ts`, `use-quality-score.ts`, `use-pwa-install.ts` (custom hooks)

**Analog:** `apps/web/hooks/use-mobile.ts` (19 linhas — match exato de formato)

**Pattern verbatim** (copiar estrutura):
```typescript
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
```

**Convenções a herdar:**
- `import * as React from "react"` (não `import { useState }`)
- Constantes em UPPER_SNAKE no topo do módulo
- Cleanup explícito no return do `useEffect`
- Named export (sem `default`)
- Hook retorna valor unidimensional ou objeto pequeno (não API gigante)

**Aplicação por hook:**
- `use-camera`: retorna `{ stream, status, error, request, stop }`
- `use-iris-detector`: retorna `{ detect, ready, error }` (lazy-load FaceLandmarker — RESEARCH)
- `use-quality-score`: retorna `{ score, level, isStable }` com state-machine de 400ms (UI-SPEC §janela de estabilidade)
- `use-pwa-install`: listener `beforeinstallprompt` (Android) + detection iOS Safari

---

### `lib/capture/*.ts` (libs puras)

**Analog:** `apps/web/lib/utils.ts` (7 linhas — match parcial: módulo de helpers puros)

**Pattern imports + named export** (verbatim):
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Convenções a herdar:**
- Named exports (sem `default`)
- Função pura, sem side-effects
- Tipo de input/output explícito
- Sem `'use client'` ou `'use server'` (puros)

**Aplicação por lib:**
- `quality-scoring.ts`: `computeOverallScore(checks: QualityCheck): number` + `levelFromScore(score: number): QualityLevel`
- `laplacian-variance.ts`: `laplacianVariance(imageData: ImageData): number` (sharpness)
- `exposure.ts`: `exposureScore(imageData: ImageData): number`
- `iris-geometry.ts`: utilitários para landmarks 468-477 (RESEARCH §índices íris)
- `jpeg-compress.ts`: `compressToJpeg(canvas: HTMLCanvasElement, quality: number, maxSide: number): Promise<Blob>` (D-16)
- `storage-path.ts`: `buildStoragePath(therapistId: string, readingId: string, eye: Eye, angle: Angle): string` (D-storage)

**Test file companion** (vitest): cada `*.ts` com lógica numérica deve ter `*.test.ts` ao lado (RESEARCH §Wave 0). Sem analog interno — usar boilerplate vitest da RESEARCH.

---

### `supabase/migrations/0004_storage_bucket_iris_captures.sql` (migration, DDL + storage policies)

**Analog:** `supabase/migrations/0001_initial_schema.sql` linhas 132-148 (RLS policies para tabelas relacionadas)

**Pattern de policy nested** (linhas 136-144 — adaptar para storage.objects):
```sql
create policy "Terapeutas só veem imagens de suas próprias leituras"
  on reading_images for all
  using (
    exists (
      select 1 from readings
      where readings.id = reading_images.reading_id
        and readings.therapist_id = auth.uid()
    )
  );
```

**Pattern para storage.objects (RESEARCH §Storage policies):**
```sql
-- Cria bucket privado (idempotente)
insert into storage.buckets (id, name, public)
values ('iris-captures', 'iris-captures', false)
on conflict (id) do nothing;

-- Policy: terapeuta só vê pasta com seu uuid no primeiro segmento
create policy "Terapeutas leem suas próprias imagens"
  on storage.objects for select
  using (
    bucket_id = 'iris-captures'
    and auth.uid() = (storage.foldername(name))[1]::uuid
  );

create policy "Terapeutas inserem em sua própria pasta"
  on storage.objects for insert
  with check (
    bucket_id = 'iris-captures'
    and auth.uid() = (storage.foldername(name))[1]::uuid
  );

-- DELETE simétrico
```

**Pattern unique constraint** (não há analog — usar SQL canônico):
```sql
alter table reading_images
  add constraint reading_images_reading_eye_angle_unique
  unique (reading_id, eye, angle);
```

**Convenções a herdar do 0001:**
- Cabeçalho de comentário explicando o que a migration cobre
- `create extension if not exists` quando aplicável (idempotência)
- `on conflict (id) do nothing` para inserts idempotentes
- Comentário inline explicando "NOTA: ... não está no SPEC §3 verbatim. Necessária por..."
- Migration NÃO pode quebrar replays — Phase 1 já provou que isso é hard requirement

---

### `supabase/tests/storage_cross_therapist_rls.sql` (test, RLS integration)

**Analog:** `supabase/tests/cross_therapist_rls.sql` (240 linhas — match exato)

**Pattern verbatim a adaptar:**

**Header + estratégia documentada** (linhas 1-16 — copiar verbatim, ajustar para storage):
```sql
-- supabase/tests/storage_cross_therapist_rls.sql
-- Prova empiricamente que RLS de storage.objects bloqueia leitura cross-terapeuta no DB REMOTO.
-- Roda com: supabase db query --db-url "$SUPABASE_DB_URL" -f supabase/tests/storage_cross_therapist_rls.sql
-- Estratégia (3 níveis de assertion):
--   1) FIXTURE: 2 auth.users dummy + 1 storage.object cada (path therapist_a/r/right_frontal.jpg).
--   2) CONTROL (BYPASSRLS): assert que select count(*) from storage.objects = 2.
--   3) Impersonar terapeuta A via set_config('request.jwt.claims', ...) + role authenticated.
--   4) OWN-DATA: terapeuta A lê próprio arquivo = 1 row.
--   5) CROSS-THERAPIST: terapeuta A lê arquivo de B = 0 rows. Espelho B->A.
--   6) Tudo em BEGIN; ... ROLLBACK; — DB volta ao estado anterior.
```

**Pattern impersonação** (linhas 112-120 — copiar verbatim):
```sql
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
```

**Pattern assertion com `do $$` block** (linhas 122-170 — copiar com ajuste para storage.objects):
```sql
do $$
declare
  cnt_own integer;
  cnt_cross integer;
begin
  select count(*) into cnt_own from storage.objects
    where bucket_id = 'iris-captures'
      and (storage.foldername(name))[1] = '11111111-1111-1111-1111-111111111111';
  if cnt_own <> 1 then
    raise exception 'OWN-DATA FAIL: ...';
  end if;
  -- ... cross-therapist check
end $$;
```

**Cleanup** (linhas 235-239 — copiar verbatim):
```sql
reset role;
rollback;
-- ROLLBACK garante que o teste é destrutivo apenas dentro de sua própria transação.
```

---

### `app/manifest.ts`, `app/sw.ts`, `next.config.ts` modificação (PWA shell)

**Analog:** nenhum interno. Usar boilerplate da RESEARCH.md §PWA shell (Serwist `withSerwistInit`).

**Convenções a respeitar (do projeto):**
- Geist Sans declarado em `app/layout.tsx` (linhas 1-13) — `manifest.ts` não declara fontes, mas `start_url` deve apontar para `/dashboard` (rota protegida — middleware redireciona p/ login se não autenticado)
- `lang: 'pt-BR'` (consistente com `<html lang="pt-BR">` em `layout.tsx` linha 27)
- `theme_color: '#000000'` (UI-SPEC §PWA Manifest)

---

## Shared Patterns

### Pattern 1: Server Action Boilerplate (CRUD)

**Source:** `apps/web/app/actions/clients.ts` linhas 1-51
**Apply to:** `app/actions/readings.ts` (todas as funções)

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

// Zod v4: usar .min(1, msg) não { required_error: msg }
const xxxSchema = z.object({ /* ... */ })

export type XxxFormState = {
  error?: Record<string, string[]> | string | null
}

export async function createXxxAction(_prev: XxxFormState, formData: FormData): Promise<XxxFormState> {
  const supabase = await createClient()
  // SEMPRE verificar autenticação no Server Action (não depender só do middleware — T-02-06)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) redirect('/login')

  const parsed = xxxSchema.safeParse({ /* ... */ })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const { error } = await supabase.from('xxx').insert({ ...parsed.data, therapist_id: user.id })
  if (error) return { error: error.message }

  revalidatePath('/xxx')
  redirect('/xxx')
}
```

**Regras críticas (auditadas no Phase 2):**
- `'use server'` é obrigatório no topo
- Sempre `getUser()` (server-side JWT validation), nunca `getSession()` no servidor (`lib/supabase/middleware.ts` linhas 31-33)
- `redirect('/login')` em vez de throw quando auth falha
- `therapist_id: user.id` em todo insert (RLS exige)
- `revalidatePath` antes de `redirect`

### Pattern 2: Server Component → Client Component Handoff

**Source:** `apps/web/app/(dashboard)/clientes/[id]/page.tsx` (server fetch) + `apps/web/app/(dashboard)/clientes/[id]/editar/page.tsx` (server fetch + bind)
**Apply to:** `app/(capture)/leituras/nova/capturar/page.tsx`, `app/(dashboard)/leituras/nova/page.tsx`

```typescript
// page.tsx (Server)
import { createClient } from '@/lib/supabase/server'
import { ClientChild } from './client-child'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase.from('xxx').select('*').eq('id', id).single()
  if (!data || error) notFound()
  return <ClientChild data={data} />
}
```

**Convenções:**
- `params`/`searchParams` como `Promise<...>` (Next.js 15)
- Fetch com RLS implícita (sem cláusula `therapist_id` — RLS resolve)
- `notFound()` em vez de checar manualmente owner

### Pattern 3: Client Component com Server Action + useTransition

**Source:** `apps/web/components/clientes/delete-client-dialog.tsx` (74 linhas inteiras)
**Apply to:** `RecoveryBanner` (descartar), `CapturePreview` (refazer), todos os componentes que invocam server action

```typescript
'use client'
import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'

const [isPending, startTransition] = useTransition()

function handleAction() {
  startTransition(async () => {
    const result = await someAction(id)
    if (!result?.error) onSuccess()
  })
}

// JSX:
<Button disabled={isPending} aria-busy={isPending}>
  {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...</> : 'Confirmar'}
</Button>
```

### Pattern 4: Custom Hook Skeleton

**Source:** `apps/web/hooks/use-mobile.ts` (19 linhas inteiras)
**Apply to:** `use-camera`, `use-iris-detector`, `use-quality-score`, `use-pwa-install`

```typescript
import * as React from "react"

const SOME_CONSTANT = 768

export function useXxx() {
  const [state, setState] = React.useState<T | undefined>(undefined)

  React.useEffect(() => {
    // setup
    return () => { /* cleanup obrigatório */ }
  }, [])

  return state
}
```

### Pattern 5: RLS-First Schema (migrations)

**Source:** `supabase/migrations/0001_initial_schema.sql`
**Apply to:** `0004_storage_bucket_iris_captures.sql`

- Toda tabela/bucket nova: `enable row level security` + pelo menos 1 policy
- Policy referencia `auth.uid()` (não `current_user`, não JWT raw)
- Comentário documentando origem (SPEC verbatim vs decisão de CONTEXT)
- Idempotente: `if not exists`, `on conflict do nothing`, `drop trigger if exists`

### Pattern 6: Tailwind v4 + base-ui + Form

**Source:** `apps/web/components/clientes/client-form.tsx` linhas 76-167
**Apply to:** todos os formulários (leituras/nova select de cliente, qualquer form futuro)

- `useForm` com `zodResolver(schema)` (linhas 53-61)
- `<Form {...form}><form action={formAction}>` (linhas 76-77 — Next.js form action + react-hook-form coexistem)
- `FormField` + `FormItem` + `FormControl` + `FormMessage` para cada input
- Para `Select` do base-ui: prop `name` é **obrigatória** para FormData chegar no server action (linhas 110-111 — comentário inline crítico)
- Botão submit com `disabled={isPending}` + `aria-busy={isPending}` + `Loader2 animate-spin` (linhas 149-158)

### Pattern 7: Empty/Error States Full-Screen

**Source:** `apps/web/app/(dashboard)/leituras/page.tsx` (13 linhas) + `apps/web/components/clientes/clients-table.tsx` linhas 41-53
**Apply to:** `CameraDeniedScreen`, `upload/page.tsx` (placeholder)

```typescript
<div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
  <Icon className="h-16 w-16 text-muted-foreground" />
  <h1 className="text-xl font-semibold">{title}</h1>
  <p className="text-sm text-muted-foreground max-w-sm">{body}</p>
</div>
```

### Pattern 8: Auth Guard em Layout/Page

**Source:** `apps/web/app/(dashboard)/layout.tsx` linhas 12-19
**Apply to:** `app/(capture)/layout.tsx` (decisão: NÃO duplicar — middleware.ts linha 7 já protege `/leituras/*`); todos os server components que precisam de `user`

```typescript
const supabase = await createClient()
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (!user || authError) redirect('/login')
```

**Decisão arquitetural a herdar:** middleware bloqueia rotas, mas server actions e queries que dependem de `user.id` chamam `getUser()` de novo (defesa em profundidade — comentário T-02-06).

### Pattern 9: Tipos do Supabase

**Source:** `apps/web/components/clientes/client-form.tsx` linhas 29-31, `clients-table.tsx` linhas 15-17
**Apply to:** todo client component que recebe rows do banco

```typescript
import type { Database } from '@/types/database'
type Reading = Database['public']['Tables']['readings']['Row']
type ReadingImageInsert = Database['public']['Tables']['reading_images']['Insert']
```

**Regenerar `types/database.ts`** após migration 0004 via `pnpm gen:types` (script já existe — `package.json` linha 10).

### Pattern 10: Path alias `@/` e nomenclatura de arquivos

**Convenções observadas no codebase:**
- Imports: `@/lib/supabase/server`, `@/components/ui/button`, `@/types/database`, `@/app/actions/xxx` — sempre alias `@/`, nunca relativo profundo
- Server actions: `app/actions/<resource>.ts` (plural, kebab-case se composto)
- Componentes UI shadcn: `components/ui/<name>.tsx` (lowercase)
- Componentes feature: `components/<feature>/<PascalCase>.tsx` (PascalCase para custom — observar `client-form.tsx` (kebab) vs `CameraView.tsx` (Pascal — RESEARCH/UI-SPEC pediu Pascal)). **Inconsistência conhecida**: existing Phase 2 usa kebab (`client-form.tsx`); Phase 3 RESEARCH/UI-SPEC pediu Pascal (`CameraView.tsx`). **Planner deve seguir Pascal para `components/capture/*` por instrução explícita do RESEARCH §Canonical File List.**
- Hooks: `hooks/use-<name>.ts` (kebab-case, prefixo `use-`)
- Libs: `lib/<area>/<name>.ts` (kebab-case)

---

## No Analog Found

Arquivos sem match interno significativo — planner deve usar **RESEARCH.md** como fonte primária:

| Arquivo | Papel | Razão |
|---|---|---|
| `app/manifest.ts` | Next metadata route | Primeiro PWA do projeto — usar UI-SPEC §PWA Manifest verbatim |
| `app/sw.ts` | service worker | Primeiro SW — usar Serwist boilerplate da RESEARCH §PWA shell |
| `components/capture/IrisDetector.tsx` | ML wrapper | Primeiro uso de MediaPipe — RESEARCH §MediaPipe lazy-load + §Iris landmarks (468-477) |
| `components/capture/AngleIcon.tsx` | SVG inline | Asset criado do zero — UI-SPEC §AngleIcon (variantes frontal/lateral/backlight) |
| `lib/capture/jpeg-compress.ts` | Canvas API | Primeiro uso de Canvas/Blob — RESEARCH §D-16 (Canvas.toBlob('image/jpeg', 0.85)) |
| `lib/capture/laplacian-variance.ts`, `exposure.ts`, `iris-geometry.ts`, `quality-scoring.ts` | algoritmos numéricos | Pure math — RESEARCH §QualityCheck + §iris geometry |
| `vitest.config.ts`, `tests/setup.ts`, todos `*.test.ts` | test infra | Primeiro vitest do projeto — RESEARCH §Wave 0 |
| `public/mediapipe/**`, `public/icons/**` | binary assets | Não há analog de asset binary; baixar/gerar conforme RESEARCH/UI-SPEC |

---

## Metadata

**Analog search scope:**
- `apps/web/app/(dashboard)/`, `apps/web/app/(auth)/`, `apps/web/app/actions/`, `apps/web/app/layout.tsx`
- `apps/web/components/{ui,dashboard,clientes}/`
- `apps/web/lib/{supabase,utils.ts}`, `apps/web/hooks/`, `apps/web/middleware.ts`
- `supabase/migrations/000{1,2,3}_*.sql`, `supabase/tests/cross_therapist_rls.sql`
- `apps/web/{package,next.config,types/database}.ts`

**Files scanned:** 21 (10 read in full, 11 listed)
**Strong analogs identified:** 9 (Pattern 1-9)
**Pattern extraction date:** 2026-05-01
**Phase:** 03-captura-mobile-pwa
