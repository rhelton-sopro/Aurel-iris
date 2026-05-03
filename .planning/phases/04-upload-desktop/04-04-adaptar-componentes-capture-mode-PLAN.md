---
phase: 04-upload-desktop
plan: 04
type: execute
wave: 2
depends_on: []
files_modified:
  - apps/web/lib/capture/sequence.ts
  - apps/web/lib/capture/sequence.test.ts
  - apps/web/components/capture/AngleInterstitial.tsx
  - apps/web/components/capture/CapturePreview.tsx
  - apps/web/components/capture/CapturePreview.test.tsx
autonomous: true
requirements:
  - UPLOAD-01

tags:
  - phase-04
  - upload-desktop
  - ui
  - reuse

must_haves:
  truths:
    - "getSlotInstructionCopy aceita parâmetro opcional `mode: 'camera' | 'upload'` com default 'camera' (preserva chamadas Fase 3)."
    - "Quando mode='upload', getSlotInstructionCopy retorna cta='Selecionar arquivo' (em vez de 'Abrir câmera')."
    - "AngleInterstitial aceita prop opcional `mode` repassada para getSlotInstructionCopy."
    - "CapturePreview aceita prop opcional `mode: 'camera' | 'upload'` que muda o texto do botão Refazer para 'Trocar arquivo' quando 'upload'."
    - "Todas as chamadas existentes (Fase 3 capture-client) continuam funcionando sem mudança (default 'camera' preserva comportamento)."
    - "Vocabulário proibido LGPD ausente."
  artifacts:
    - path: "apps/web/lib/capture/sequence.ts"
      provides: "getSlotInstructionCopy com parâmetro mode"
      contains: "mode: 'camera' | 'upload'"
    - path: "apps/web/components/capture/AngleInterstitial.tsx"
      provides: "AngleInterstitial com prop mode"
      contains: "mode?: 'camera' | 'upload'"
    - path: "apps/web/components/capture/CapturePreview.tsx"
      provides: "CapturePreview com prop mode (afeta texto botão Refazer)"
      contains: "mode === 'upload' ? 'Trocar arquivo'"
  key_links:
    - from: "apps/web/lib/capture/sequence.ts"
      to: "AngleInterstitial copy.cta"
      via: "AngleInterstitial passa mode → getSlotInstructionCopy → cta string"
      pattern: "getSlotInstructionCopy\\(.*,.*mode"
    - from: "apps/web/components/capture/CapturePreview.tsx"
      to: "Refazer button label"
      via: "Conditional rendering on mode prop"
      pattern: "Trocar arquivo"
---

<objective>
Adaptar três componentes/módulos da Fase 3 para suportar o contexto desktop sem duplicação de código:

1. **`lib/capture/sequence.ts`** — `getSlotInstructionCopy(slot, slotIndex, mode?: 'camera' | 'upload')`. Default 'camera' preserva chamadas existentes. Quando 'upload', troca CTA "Abrir câmera" por "Selecionar arquivo".

2. **`components/capture/AngleInterstitial.tsx`** — adicionar prop opcional `mode?: 'camera' | 'upload'` repassada para `getSlotInstructionCopy`.

3. **`components/capture/CapturePreview.tsx`** — adicionar prop opcional `mode?: 'camera' | 'upload'`. Quando 'upload', botão Refazer mostra "Trocar arquivo" em vez de "Refazer".

Purpose: Honra CONTEXT D-05 (wizard sequencial reusa state machine + componentes de captura) com adaptação cirúrgica de copy. Sem duplicar componentes — o upload-client em Wave 3 importa AngleInterstitial e CapturePreview com prop `mode="upload"`. Wave 3 não fica preso lendo JSX existente para copiar.

Implementa CONTEXT D-05 (reuso) e parte de D-09 (preview com badge VLM — apenas adaptação de copy).

Output: 3 arquivos modificados + 1 teste novo + testes existentes ainda verdes (regression-free).

**CRITICAL:** Toda mudança é BACKWARD-COMPATIBLE. Capture-client (Fase 3) NÃO é tocado neste plan e continua funcionando. Verificável via `pnpm test:run` no projeto inteiro após as mudanças.
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

# Arquivos a modificar (LER PRIMEIRO antes de editar)
@apps/web/lib/capture/sequence.ts
@apps/web/components/capture/AngleInterstitial.tsx
@apps/web/components/capture/CapturePreview.tsx
@apps/web/components/capture/CapturePreview.test.tsx
@apps/web/lib/capture/sequence.test.ts

# Capture-client é o consumidor existente (NÃO modificar — apenas confirmar que continua funcionando)
@apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx

<interfaces>
<!-- Estado atual da interface (LER PRIMEIRO): -->

```typescript
// sequence.ts (atual):
export function getSlotInstructionCopy(
  slot: Slot,
  slotIndex: number,
): { heading: string; subtitle: string; cta: string }

// AngleInterstitial.tsx (atual):
interface AngleInterstitialProps {
  nextSlot: Slot
  slotIndex: number
  onProceed: () => void
}

// CapturePreview.tsx (atual):
interface CapturePreviewProps {
  imageUrl: string
  qualityScore: number
  onRedo: () => void
  onConfirm: () => void
  analysis?: PostCaptureAnalysis | null
}
```

```typescript
// Estado DESEJADO após este plan:

export function getSlotInstructionCopy(
  slot: Slot,
  slotIndex: number,
  mode?: 'camera' | 'upload',  // ADICIONADO, default 'camera'
): { heading: string; subtitle: string; cta: string }

interface AngleInterstitialProps {
  nextSlot: Slot
  slotIndex: number
  onProceed: () => void
  mode?: 'camera' | 'upload'  // ADICIONADO
}

interface CapturePreviewProps {
  imageUrl: string
  qualityScore: number
  onRedo: () => void
  onConfirm: () => void
  analysis?: PostCaptureAnalysis | null
  mode?: 'camera' | 'upload'  // ADICIONADO — afeta texto do botão Refazer
}
```

<!-- Tipo CaptureMode reusável (decisão deste plan): exportar de sequence.ts pra evitar redefinir nos 3 sites: -->
```typescript
export type CaptureMode = 'camera' | 'upload'
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Estender getSlotInstructionCopy com parâmetro mode</name>
  <read_first>
    - apps/web/lib/capture/sequence.ts (arquivo inteiro — 138 linhas)
    - apps/web/lib/capture/sequence.test.ts (pattern de testes existentes)
    - .planning/phases/04-upload-desktop/04-PATTERNS.md seção "lib/capture/sequence.ts (modificar)"
  </read_first>
  <files>
    apps/web/lib/capture/sequence.ts,
    apps/web/lib/capture/sequence.test.ts
  </files>
  <behavior>
    Test 1 (existente — não quebrar): getSlotInstructionCopy({eye:'left', angle:'frontal'}, 0) retorna cta='Abrir câmera' (default mode='camera')
    Test 2 (novo): getSlotInstructionCopy({eye:'left', angle:'frontal'}, 0, 'camera') retorna cta='Abrir câmera'
    Test 3 (novo): getSlotInstructionCopy({eye:'left', angle:'frontal'}, 0, 'upload') retorna cta='Selecionar arquivo'
    Test 4 (novo): getSlotInstructionCopy({eye:'right', angle:'lateral'}, 4, 'upload') retorna cta='Selecionar arquivo' (mode independente do slot)
    Test 5 (novo): heading e subtitle são IDÊNTICOS independente do mode (copy do slot é neutra; apenas cta muda)
    Test 6 (novo): CaptureMode export exists (smoke test de tipo via const c: CaptureMode = 'upload')
  </behavior>
  <action>
Editar `apps/web/lib/capture/sequence.ts`:

1. **Adicionar export do tipo `CaptureMode`** logo após os exports existentes de tipo (após `Eye`, `Angle`):

```typescript
/**
 * Modo de captura: 'camera' (Fase 3 — getUserMedia/<input capture>) ou
 * 'upload' (Fase 4 — dropzone client-side). Afeta apenas a copy de UI;
 * a SEQUENCE e os identificadores de slot são idênticos.
 */
export type CaptureMode = 'camera' | 'upload'
```

2. **Modificar `getSlotInstructionCopy`** para aceitar parâmetro opcional:

```typescript
export function getSlotInstructionCopy(
  slot: Slot,
  slotIndex: number,
  mode: CaptureMode = 'camera',  // CONTEXT D-05: reusa state machine, adapta cta
): { heading: string; subtitle: string; cta: string } {
  const eyeUpper = slot.eye === 'left' ? 'ESQUERDO' : 'DIREITO'

  let subtitle: string
  let angleLabel: string
  switch (slot.angle) {
    case 'frontal':
      angleLabel = 'Frente'
      subtitle = `Rosto voltado para frente, olho ${eyeUpper} aberto. Luz de frente ou lateral — nunca atrás.`
      break
    case 'lateral':
      angleLabel = 'Direita'
      subtitle = 'Vire o corpo ~90° para a direita, mantendo o olho aberto e a câmera frontal ao olho.'
      break
    case 'backlight':
      angleLabel = 'Esquerda'
      subtitle = 'Vire o corpo ~90° para a esquerda, mantendo o olho aberto e a câmera frontal ao olho.'
      break
  }

  return {
    heading: `Foto ${slotIndex + 1} de ${SEQUENCE.length} — Olho ${eyeUpper} · ${angleLabel}`,
    subtitle,
    cta: mode === 'upload' ? 'Selecionar arquivo' : 'Abrir câmera',
  }
}
```

**NÃO mexer em outras funções** (`getResumeSlotIndex`, `isOuterEyeTransition`, `getSlotProgressLabel`).

3. **Adicionar testes** ao `sequence.test.ts` (apend, não substituir os existentes):

```typescript
import { getSlotInstructionCopy, type CaptureMode } from './sequence'

describe('getSlotInstructionCopy mode parameter (Fase 4)', () => {
  const slot = { eye: 'left' as const, angle: 'frontal' as const }

  it('defaults to mode=camera with cta="Abrir câmera"', () => {
    const copy = getSlotInstructionCopy(slot, 0)
    expect(copy.cta).toBe('Abrir câmera')
  })

  it('returns cta="Abrir câmera" for explicit mode=camera', () => {
    const copy = getSlotInstructionCopy(slot, 0, 'camera')
    expect(copy.cta).toBe('Abrir câmera')
  })

  it('returns cta="Selecionar arquivo" for mode=upload', () => {
    const copy = getSlotInstructionCopy(slot, 0, 'upload')
    expect(copy.cta).toBe('Selecionar arquivo')
  })

  it('mode does NOT affect heading or subtitle', () => {
    const camera = getSlotInstructionCopy(slot, 0, 'camera')
    const upload = getSlotInstructionCopy(slot, 0, 'upload')
    expect(camera.heading).toBe(upload.heading)
    expect(camera.subtitle).toBe(upload.subtitle)
  })

  it('CaptureMode type exports correctly', () => {
    const m: CaptureMode = 'upload'
    expect(m).toBe('upload')
  })

  it('handles mode independently of slot eye/angle', () => {
    const right = getSlotInstructionCopy({ eye: 'right', angle: 'lateral' }, 4, 'upload')
    expect(right.cta).toBe('Selecionar arquivo')
  })
})
```
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:run lib/capture/sequence.test.ts</automated>
    Testes existentes + 6 novos = todos passando.

    Adicionalmente:
    - `grep -n "CaptureMode\\|mode: CaptureMode" apps/web/lib/capture/sequence.ts` retorna pelo menos 2 matches.
    - `grep -n "Selecionar arquivo" apps/web/lib/capture/sequence.ts` retorna 1 match.
  </verify>
  <acceptance_criteria>
    - `apps/web/lib/capture/sequence.ts` exporta tipo `CaptureMode = 'camera' | 'upload'`.
    - `getSlotInstructionCopy` aceita 3º parâmetro opcional com default 'camera'.
    - Quando mode='upload', cta retorna 'Selecionar arquivo' (auditável via grep).
    - Quando mode='camera' ou omitido, cta retorna 'Abrir câmera' (compat retroativa Fase 3).
    - Testes existentes em sequence.test.ts continuam verdes.
    - 6 testes novos passam.
    - Vocabulário proibido ausente.
  </acceptance_criteria>
  <done>
    sequence.ts retro-compatível, novo tipo `CaptureMode` exportado para reuso pelos componentes nas próximas tasks deste plan.
  </done>
</task>

<task type="auto">
  <name>Task 2: Adicionar prop mode em AngleInterstitial e CapturePreview + testes adicionais em CapturePreview</name>
  <read_first>
    - apps/web/components/capture/AngleInterstitial.tsx (arquivo inteiro)
    - apps/web/components/capture/CapturePreview.tsx (arquivo inteiro — ~163 linhas)
    - apps/web/components/capture/CapturePreview.test.tsx (pattern de testes)
    - .planning/phases/04-upload-desktop/04-PATTERNS.md seções de AngleInterstitial e CapturePreview
    - apps/web/lib/capture/sequence.ts (após Task 1 — para importar CaptureMode)
  </read_first>
  <files>
    apps/web/components/capture/AngleInterstitial.tsx,
    apps/web/components/capture/CapturePreview.tsx,
    apps/web/components/capture/CapturePreview.test.tsx
  </files>
  <action>
### Modificação 1: `AngleInterstitial.tsx`

Atualizar imports para incluir `CaptureMode`:

```typescript
import { getSlotInstructionCopy, type CaptureMode } from '@/lib/capture/sequence'
```

Modificar interface props:

```typescript
interface AngleInterstitialProps {
  nextSlot: Slot
  slotIndex: number
  onProceed: () => void
  /** Modo de captura — afeta apenas a copy do CTA. Default 'camera' (Fase 3). */
  mode?: CaptureMode
}
```

Modificar destructuring + chamada de getSlotInstructionCopy:

```typescript
export function AngleInterstitial({ nextSlot, slotIndex, onProceed, mode }: AngleInterstitialProps) {
  const copy = getSlotInstructionCopy(nextSlot, slotIndex, mode)
  // ... resto do componente IDÊNTICO ao atual
```

**NÃO mudar nada mais no componente.** O resto do JSX (heading, subtitle, alert de câmera traseira/flash, Button) fica como está. O alert "Use a câmera traseira · Nunca utilize o flash" é específico do mobile mas NÃO incomoda no contexto desktop — Wave 3 (upload-client) decidirá se renderiza AngleInterstitial ou um header simplificado. Isto é decisão do upload-client, não deste plan.

### Modificação 2: `CapturePreview.tsx`

Atualizar imports:

```typescript
import type { CaptureMode } from '@/lib/capture/sequence'
```

Modificar interface props:

```typescript
interface CapturePreviewProps {
  imageUrl: string
  qualityScore: number
  onRedo: () => void
  onConfirm: () => void
  analysis?: PostCaptureAnalysis | null
  /** Modo de captura. Quando 'upload', botão Refazer mostra "Trocar arquivo".
      Default 'camera' preserva comportamento Fase 3. */
  mode?: CaptureMode
}
```

Adicionar `mode` ao destructuring:

```typescript
export function CapturePreview({
  imageUrl,
  qualityScore,
  onRedo,
  onConfirm,
  analysis,
  mode,  // ADICIONADO
}: CapturePreviewProps) {
```

Localizar o botão Refazer (atualmente linha ~141-146):

```typescript
<Button
  onClick={onRedo}
  variant="secondary"
  className="flex-1 h-11 text-sm font-semibold"
>
  Refazer
</Button>
```

Substituir por:

```typescript
<Button
  onClick={onRedo}
  variant="secondary"
  className="flex-1 h-11 text-sm font-semibold"
>
  {mode === 'upload' ? 'Trocar arquivo' : 'Refazer'}
</Button>
```

**NÃO mudar nada mais.** Badge, debug overlay, alertas, botão Confirmar — tudo idêntico.

### Modificação 3: Adicionar 2 testes em `CapturePreview.test.tsx`

Apend após os testes existentes:

```typescript
describe('CapturePreview mode prop (Fase 4)', () => {
  it('renders "Refazer" by default (mode omitted)', () => {
    render(
      <CapturePreview imageUrl="blob:test" qualityScore={0.85} onRedo={vi.fn()} onConfirm={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: 'Refazer' })).toBeInTheDocument()
  })

  it('renders "Trocar arquivo" when mode=upload', () => {
    render(
      <CapturePreview
        imageUrl="blob:test"
        qualityScore={0.85}
        onRedo={vi.fn()}
        onConfirm={vi.fn()}
        mode="upload"
      />
    )
    expect(screen.getByRole('button', { name: 'Trocar arquivo' })).toBeInTheDocument()
  })

  it('still calls onRedo when "Trocar arquivo" is clicked (mode=upload)', () => {
    const onRedo = vi.fn()
    render(
      <CapturePreview
        imageUrl="blob:test"
        qualityScore={0.85}
        onRedo={onRedo}
        onConfirm={vi.fn()}
        mode="upload"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Trocar arquivo' }))
    expect(onRedo).toHaveBeenCalled()
  })
})
```

**NÃO modificar testes existentes** — os 5+ testes atuais em CapturePreview.test.tsx continuam relevantes (verifica modo default).

### Verificar não-regressão em capture-client (consumidor existente)

Capture-client em `app/(capture)/leituras/nova/capturar/capture-client.tsx` usa AngleInterstitial e CapturePreview SEM passar `mode`. O default 'camera' garante que comportamento Fase 3 está preservado. Não modificar capture-client.tsx neste plan.

**Vocabulário proibido**: não introduzir 'diagnóstico', 'tratamento' ou 'cura'. As strings novas ('Trocar arquivo', 'Selecionar arquivo') são neutras.
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:run components/capture/ lib/capture/sequence.test.ts</automated>
    Todos os testes existentes + 6 novos em sequence.test.ts + 3 novos em CapturePreview.test.tsx passam.

    Adicionalmente:
    - `cd apps/web && pnpm tsc --noEmit -p .` exit 0 (compatibilidade de tipos com capture-client preservada).
    - `grep -n "mode === 'upload'" apps/web/components/capture/CapturePreview.tsx` retorna 1 linha.
    - `grep -n "Trocar arquivo" apps/web/components/capture/CapturePreview.tsx` retorna 1 linha.
    - `grep -n "mode\\?: CaptureMode" apps/web/components/capture/AngleInterstitial.tsx` retorna 1 linha.
    - `grep -c "Trocar arquivo\\|Selecionar arquivo" apps/web/components/capture/ apps/web/lib/capture/` retorna ≥ 2 (sem header prose: filtra `^#`).
  </verify>
  <acceptance_criteria>
    - `AngleInterstitial` aceita prop opcional `mode?: CaptureMode` e repassa pro `getSlotInstructionCopy`.
    - `CapturePreview` aceita prop opcional `mode?: CaptureMode` e altera texto do botão Refazer baseado nele.
    - Testes existentes em CapturePreview.test.tsx (5+) continuam passando.
    - 3 testes novos em CapturePreview.test.tsx passam.
    - 6 testes novos em sequence.test.ts passam.
    - `pnpm tsc --noEmit -p .` exit 0 (sem regressão de tipos no capture-client).
    - `pnpm audit:vocabulary` exit 0.
    - capture-client.tsx (Fase 3) NÃO foi modificado.
  </acceptance_criteria>
  <done>
    AngleInterstitial e CapturePreview prontos para uso pelo upload-client (Wave 3) com `mode="upload"`. Capture-client (Fase 3) inalterado e funcional via default mode='camera'.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| AngleInterstitial / CapturePreview props (caller-controlled mode) | mode é prop interna controlada pelo wizard pai; sem entrada de usuário direta. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-04-01 | Tampering | sequence.ts / components | accept | mode é prop tipada (`CaptureMode`); mismatch causa TS error em compile-time. Sem entrada de usuário. Sem risco runtime. |
| T-04-04-02 | Information Disclosure | n/a | accept | Apenas adaptação de copy. Sem novos canais de IO/log. |
| T-04-04-03 | Repudiation | n/a | accept | Sem mudança em logs ou auditoria. capture_method continua sendo gravado em `readings.capture_method` (Plan 04-02). |
</threat_model>

<verification>
1. `cd apps/web && pnpm test:run` — TODOS os testes do projeto passam (regression check de Fase 3).
2. `cd apps/web && pnpm tsc --noEmit -p .` exit 0.
3. `cd apps/web && pnpm audit:vocabulary` exit 0.
4. Manual sanity: capture-client.tsx (Fase 3) NÃO aparece em git diff (apenas os 5 arquivos listados em files_modified).
</verification>

<success_criteria>
- 3 arquivos source modificados, 2 arquivos teste modificados.
- 9+ testes novos verdes (6 em sequence + 3 em CapturePreview).
- Testes existentes (Fase 3) ainda verdes — zero regressões.
- Tipos compilam globalmente.
- Capture-client.tsx inalterado.
</success_criteria>

<output>
Após completar, criar `.planning/phases/04-upload-desktop/04-04-SUMMARY.md` documentando:
- Diff resumido em sequence.ts, AngleInterstitial.tsx, CapturePreview.tsx.
- Confirmação de que `pnpm tsc --noEmit` está limpo.
- Confirmação de que capture-client.tsx (Fase 3) NÃO foi modificado.
- Lista de testes adicionados (com nomes dos `it` blocks).
</output>
