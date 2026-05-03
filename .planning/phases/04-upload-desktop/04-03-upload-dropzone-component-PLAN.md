---
phase: 04-upload-desktop
plan: 03
type: execute
wave: 2
depends_on: []
files_modified:
  - apps/web/components/upload/UploadDropzone.tsx
  - apps/web/components/upload/UploadDropzone.test.tsx
autonomous: true
requirements:
  - UPLOAD-01

tags:
  - phase-04
  - upload-desktop
  - ui
  - dropzone

must_haves:
  truths:
    - "UploadDropzone aceita drag-and-drop de arquivo único (handleDrop chama onFileAccepted com dataTransfer.files[0])."
    - "UploadDropzone aceita click → file picker (input type=file hidden + onClick programático no input)."
    - "Estado isDragOver muda visualmente entre 'idle' e 'dragover' (classe `border-primary` aplicada quando dragover)."
    - "Quando disabled=true, dropzone tem pointer-events-none + opacity-50 e onDragOver não atualiza estado."
    - "Input file aceita extensões/MIMEs corretos: image/jpeg, image/png, image/webp, image/heic, image/heif, .heic, .heif (D-10 + D-11)."
    - "Texto pt-BR 'Arraste e solte ou selecione arquivo' visível, sem vocabulário proibido LGPD."
    - "Footer mostra 'JPEG · PNG · WebP · HEIC — máx. 25 MB' (espelha CONTEXT D-10/D-12)."
  artifacts:
    - path: "apps/web/components/upload/UploadDropzone.tsx"
      provides: "UploadDropzone component (drag-and-drop + click-to-pick)"
      exports: ["UploadDropzone"]
      min_lines: 50
    - path: "apps/web/components/upload/UploadDropzone.test.tsx"
      provides: "Cobertura: render, drag-over state, drop, click-to-pick, disabled"
      contains: "describe('UploadDropzone'"
  key_links:
    - from: "apps/web/components/upload/UploadDropzone.tsx"
      to: "onFileAccepted callback"
      via: "Both onDrop (e.dataTransfer.files[0]) and onChange (e.target.files[0]) chamam onFileAccepted"
      pattern: "onFileAccepted\\("
    - from: "apps/web/components/upload/UploadDropzone.tsx"
      to: "Input file accept attribute"
      via: "accept='image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif'"
      pattern: "image/heic"
---

<objective>
Criar `components/upload/UploadDropzone.tsx` — componente de UI puramente apresentacional para captura de um único arquivo de imagem, suportando dois caminhos:
1. **Drag-and-drop** (drop nativo do navegador) — handlers `onDragOver`, `onDragLeave`, `onDrop` no container.
2. **Click → file picker** (input HTML hidden) — `onClick` no container dispara `inputRef.click()`.

Ambos os caminhos chamam o mesmo callback `onFileAccepted(file: File)` — o consumidor (upload-client em Wave 3) decide o que fazer com o arquivo (validar via `validateUploadFile`, converter HEIC se necessário, mandar pro VLM).

Purpose: Componente de UI isolado, testável, sem nenhuma lógica de validação/upload (responsabilidade do caller). Facilita Wave 3 (upload-client) ter uma superfície clean de "recebi arquivo, agora processo". Honra UPLOAD-01 (dropzone + preview — preview vem do reuso de CapturePreview no Wave 3).

Implementa CONTEXT D-05 (wizard sequencial — dropzone única por slot) e parte de D-10 (aceita exatamente os MIMEs/extensões definidos).

Output: 1 componente client-side + 1 suite de testes (jsdom + @testing-library/react).
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

# Pattern de componentes de captura (named exports, classes Tailwind, a11y)
@apps/web/components/capture/AngleInterstitial.tsx
@apps/web/components/capture/CaptureProgress.tsx
@apps/web/components/capture/CapturePreview.tsx

# Pattern de teste de componente com @testing-library/react + fireEvent
@apps/web/components/capture/CapturePreview.test.tsx

# Padrão de cn() helper
@apps/web/lib/utils.ts

# Pattern de event listeners (matchMedia → addEventListener + cleanup)
@apps/web/hooks/use-mobile.ts

<interfaces>
<!-- Interface obrigatória do componente, derivada do uso em upload-client (Wave 3): -->

```typescript
export interface UploadDropzoneProps {
  /** Callback chamado com o File aceito. Caller faz validação subsequente. */
  onFileAccepted: (file: File) => void
  /** Desabilita interação durante 'analyzing' phase do wizard. */
  disabled?: boolean
  /** Instrução do slot atual exibida dentro da dropzone (ex: 'Foto 1 de 6 — Olho ESQUERDO · Frente'). */
  slotLabel?: string
}

export function UploadDropzone(props: UploadDropzoneProps): JSX.Element
```

<!-- Pattern de componente de captura (extraído de CaptureProgress.tsx — copiar padrão): -->

```typescript
'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'
// named export, sem default
export function CaptureProgress({ ... }: Props) {
  return <div role="..." aria-label="..." className={cn(...)}>...</div>
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Criar UploadDropzone.tsx + UploadDropzone.test.tsx</name>
  <read_first>
    - apps/web/components/capture/AngleInterstitial.tsx (pattern de full-screen + Button CTA + a11y)
    - apps/web/components/capture/CapturePreview.tsx (pattern de role/aria-label, classes Tailwind condicionais)
    - apps/web/components/capture/CapturePreview.test.tsx (pattern de teste vitest com fireEvent.drop e fireEvent.change)
    - apps/web/hooks/use-mobile.ts (pattern de event handler + cleanup)
    - apps/web/lib/utils.ts (cn helper)
    - .planning/phases/04-upload-desktop/04-PATTERNS.md seção `components/upload/UploadDropzone.tsx` (template completo de pseudo-código)
    - .planning/phases/04-upload-desktop/04-CONTEXT.md seção D-10, D-11 (MIMEs aceitos)
  </read_first>
  <files>
    apps/web/components/upload/UploadDropzone.tsx,
    apps/web/components/upload/UploadDropzone.test.tsx
  </files>
  <behavior>
    Test 1: Renderiza com texto pt-BR "Arraste e solte" visível
    Test 2: Renderiza footer "JPEG · PNG · WebP · HEIC — máx. 25 MB"
    Test 3: Renderiza com `slotLabel="Foto 1 de 6"` mostra a string no DOM
    Test 4: Click no container dispara click no input hidden (não diretamente testável, mas onChange handler funciona com fireEvent.change)
    Test 5: fireEvent.change no input com `{ target: { files: [mockFile] } }` chama onFileAccepted(mockFile)
    Test 6: fireEvent.drop no container com `{ dataTransfer: { files: [mockFile] } }` chama onFileAccepted(mockFile)
    Test 7: fireEvent.dragOver no container atualiza visual (assertão via classe ou aria — ex: data-state ou outline)
    Test 8: Quando disabled=true, fireEvent.drop NÃO chama onFileAccepted (early return no handler)
    Test 9: Quando disabled=true, container tem aria-disabled OR pointer-events-none class
    Test 10: input file tem accept attribute contendo "image/heic" e "image/jpeg"
    Test 11: input file tem accept attribute contendo ".heic" e ".heif" (extensão fallback)
  </behavior>
  <action>
Criar `apps/web/components/upload/UploadDropzone.tsx` seguindo o template em **04-PATTERNS.md seção `components/upload/UploadDropzone.tsx`**, com este conteúdo (verbatim com micro-ajustes para clareza):

```typescript
'use client'

import * as React from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface UploadDropzoneProps {
  /** Callback chamado com o File aceito. Caller decide validação subsequente. */
  onFileAccepted: (file: File) => void
  /** Desabilita drop e click (ex: phase='analyzing' do upload-client). */
  disabled?: boolean
  /** Texto opcional exibido dentro da dropzone (ex: 'Foto 1 de 6 — Olho ESQUERDO · Frente'). */
  slotLabel?: string
}

/**
 * Dropzone para captura de UM arquivo de imagem.
 *
 * Dois caminhos paralelos chamam o mesmo callback onFileAccepted:
 *  - Drag-and-drop nativo do navegador (handleDrop).
 *  - Click no container → input file picker (handleInputChange).
 *
 * Componente é PURAMENTE apresentacional: nenhuma validação de MIME ou tamanho
 * acontece aqui (responsabilidade do caller via lib/upload/validate-file).
 *
 * CONTEXT D-10: aceita JPEG/PNG/WebP/HEIC/HEIF (MIME + extensão).
 * CONTEXT D-11: HEIC entra como input — caller chama convertHeicToJpeg após validar.
 */
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
    e.target.value = '' // permitir re-selecionar o mesmo arquivo após Refazer
    if (file) onFileAccepted(file)
  }
  const handleContainerClick = () => {
    if (!disabled) inputRef.current?.click()
  }
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      inputRef.current?.click()
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleContainerClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 transition-colors cursor-pointer',
        isDragOver
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/30 hover:border-muted-foreground/60',
        disabled && 'pointer-events-none opacity-50',
      )}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={`Área de upload${slotLabel ? ` — ${slotLabel}` : ''}`}
      data-dragover={isDragOver ? 'true' : 'false'}
    >
      <Upload className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <div className="text-center space-y-1">
        {slotLabel && <p className="text-sm font-medium">{slotLabel}</p>}
        <p className="text-sm text-muted-foreground">
          Arraste e solte ou{' '}
          <span className="text-primary underline">selecione arquivo</span>
        </p>
        <p className="text-xs text-muted-foreground/70">
          JPEG · PNG · WebP · HEIC — máx. 25 MB
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
        // onClick.stopPropagation evita o handler do container disparar duplo
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
```

Criar `apps/web/components/upload/UploadDropzone.test.tsx` com a estrutura de `CapturePreview.test.tsx` (mesmo style):

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UploadDropzone } from './UploadDropzone'

function makeFile(name = 'photo.jpg', type = 'image/jpeg', sizeBytes = 1024) {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

describe('UploadDropzone', () => {
  it('renders pt-BR drop instructions', () => {
    render(<UploadDropzone onFileAccepted={vi.fn()} />)
    expect(screen.getByText(/Arraste e solte/)).toBeInTheDocument()
    expect(screen.getByText(/selecione arquivo/)).toBeInTheDocument()
  })

  it('renders the format hint footer', () => {
    render(<UploadDropzone onFileAccepted={vi.fn()} />)
    expect(screen.getByText(/JPEG · PNG · WebP · HEIC — máx. 25 MB/)).toBeInTheDocument()
  })

  it('renders slotLabel when provided', () => {
    render(<UploadDropzone onFileAccepted={vi.fn()} slotLabel="Foto 1 de 6 — Olho ESQUERDO" />)
    expect(screen.getByText(/Foto 1 de 6/)).toBeInTheDocument()
  })

  it('calls onFileAccepted when a file is dropped', () => {
    const onFileAccepted = vi.fn()
    const { container } = render(<UploadDropzone onFileAccepted={onFileAccepted} />)
    const dropzone = container.querySelector('[role="button"]') as HTMLElement
    const file = makeFile()
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
    expect(onFileAccepted).toHaveBeenCalledWith(file)
  })

  it('calls onFileAccepted when a file is chosen via input', () => {
    const onFileAccepted = vi.fn()
    const { container } = render(<UploadDropzone onFileAccepted={onFileAccepted} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = makeFile()
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    fireEvent.change(input)
    expect(onFileAccepted).toHaveBeenCalledWith(file)
  })

  it('updates data-dragover attribute on dragOver / dragLeave', () => {
    const { container } = render(<UploadDropzone onFileAccepted={vi.fn()} />)
    const dropzone = container.querySelector('[role="button"]') as HTMLElement
    expect(dropzone.dataset.dragover).toBe('false')
    fireEvent.dragOver(dropzone)
    expect(dropzone.dataset.dragover).toBe('true')
    fireEvent.dragLeave(dropzone)
    expect(dropzone.dataset.dragover).toBe('false')
  })

  it('does NOT call onFileAccepted when disabled and file is dropped', () => {
    const onFileAccepted = vi.fn()
    const { container } = render(<UploadDropzone onFileAccepted={onFileAccepted} disabled />)
    const dropzone = container.querySelector('[role="button"]') as HTMLElement
    fireEvent.drop(dropzone, { dataTransfer: { files: [makeFile()] } })
    expect(onFileAccepted).not.toHaveBeenCalled()
  })

  it('sets aria-disabled when disabled', () => {
    const { container } = render(<UploadDropzone onFileAccepted={vi.fn()} disabled />)
    const dropzone = container.querySelector('[role="button"]') as HTMLElement
    expect(dropzone.getAttribute('aria-disabled')).toBe('true')
  })

  it('input file accept attribute includes HEIC MIMEs and extensions', () => {
    const { container } = render(<UploadDropzone onFileAccepted={vi.fn()} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const accept = input.getAttribute('accept') ?? ''
    expect(accept).toContain('image/heic')
    expect(accept).toContain('image/heif')
    expect(accept).toContain('image/jpeg')
    expect(accept).toContain('.heic')
    expect(accept).toContain('.heif')
  })
})
```

**Notas críticas:**
- Vocabulário proibido LGPD ('diagnóstico', 'tratamento', 'cura'): ZERO ocorrências em `.tsx` e `.test.tsx`. As strings "Arraste e solte", "selecione arquivo", "JPEG · PNG · WebP · HEIC — máx. 25 MB" são neutras.
- Named export only (sem `export default`).
- 'use client' obrigatório (componente usa hooks e event handlers).
- a11y: `role="button"`, `tabIndex`, `aria-disabled`, `aria-label`. Suporte de teclado (Enter/Space) ativo quando não disabled.
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:run components/upload/UploadDropzone.test.tsx</automated>
    Comando deve sair com exit code 0 e mostrar 9 testes passando.

    Adicionalmente:
    - `cd apps/web && pnpm audit:vocabulary` — exit 0 (verifica componente novo).
    - `grep -c "image/heic\\|image/heif\\|.heic\\|.heif" apps/web/components/upload/UploadDropzone.tsx` retorna pelo menos 4.
    - `grep -c "Arraste e solte" apps/web/components/upload/UploadDropzone.tsx` retorna 1.
  </verify>
  <acceptance_criteria>
    - File `apps/web/components/upload/UploadDropzone.tsx` existe com 50+ linhas.
    - Export `UploadDropzone` (named, não default).
    - Diretiva `'use client'` na primeira linha.
    - Componente aceita props `onFileAccepted: (file: File) => void`, `disabled?: boolean`, `slotLabel?: string`.
    - Container tem `role="button"`, `tabIndex`, `aria-disabled`, `aria-label`, `data-dragover`.
    - Input file tem `accept` contendo `image/heic`, `image/heif`, `image/jpeg`, `.heic`, `.heif`.
    - Footer mostra texto exato "JPEG · PNG · WebP · HEIC — máx. 25 MB" (auditável via grep).
    - 9 testes vitest passam.
    - `pnpm audit:vocabulary` exit 0.
  </acceptance_criteria>
  <done>
    Dropzone component pronto para Wave 3 (upload-client) consumir. Lógica de drag-and-drop + click-to-pick funcionando. Testes cobrem todos os caminhos (drop, click→input change, disabled, dragover state, accept MIMEs).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser drag-and-drop API → UploadDropzone | dataTransfer.files pode conter qualquer arquivo (incluindo executáveis se browser permitir drop fora de inputs com accept). |
| File picker → UploadDropzone | Input com `accept` é dica para o browser, não enforcement. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-03-01 | Tampering | UploadDropzone | mitigate | Dropzone NÃO valida o arquivo — repassa pro caller (upload-client) que chama `validateUploadFile` (Plan 04-01). Defesa em camadas: este componente é apenas a superfície. ASVS L1 V12.1.1 (validação) é responsabilidade do caller. |
| T-04-03-02 | Information Disclosure | UploadDropzone | accept | Componente é client-side puro, sem PII. Sem riscos de IO/log. |
| T-04-03-03 | Denial of Service (visual) | UploadDropzone | mitigate | Browser pode entregar arquivos múltiplos via drag (ex: pasta inteira). Handler usa `e.dataTransfer.files[0]` — apenas o primeiro entra; resto é ignorado silenciosamente. UX consistente com wizard sequencial (1 foto por slot — D-05). |
| T-04-03-04 | Tampering (a11y) | UploadDropzone | mitigate | Suporte de teclado (Enter/Space → click) garante que usuário não-mouse pode usar. `aria-disabled` reflete estado disabled de forma acessível. ASVS L1 não cobre a11y diretamente, mas é boa prática WCAG AA. |
</threat_model>

<verification>
1. `cd apps/web && pnpm test:run components/upload/` — todos os testes passam.
2. `cd apps/web && pnpm audit:vocabulary` — exit 0.
3. Manual sanity (executor pode rodar): `cd apps/web && pnpm tsc --noEmit -p .` — sem erros de tipo no projeto.
</verification>

<success_criteria>
- 9 testes verdes em `UploadDropzone.test.tsx`.
- Componente exposta a Wave 3 (upload-client) via `import { UploadDropzone } from '@/components/upload/UploadDropzone'`.
- Sem vocabulário proibido.
- Suporte completo de a11y (keyboard + ARIA).
</success_criteria>

<output>
Após completar, criar `.planning/phases/04-upload-desktop/04-03-SUMMARY.md` documentando:
- Caminho do arquivo criado.
- Lista de testes vitest passados.
- Confirmação de a11y (role, tabIndex, aria-disabled, aria-label, keyboard handler).
- Confirmação de que componente NÃO importa nada de `lib/upload/` ou `lib/capture/` (puro de UI).
</output>
