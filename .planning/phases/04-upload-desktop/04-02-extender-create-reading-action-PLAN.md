---
phase: 04-upload-desktop
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/app/actions/readings.schemas.ts
  - apps/web/app/actions/readings.ts
  - apps/web/app/actions/readings.test.ts
autonomous: true
requirements:
  - UPLOAD-02

tags:
  - phase-04
  - upload-desktop
  - server-action
  - schema

must_haves:
  truths:
    - "createReadingSchema aceita campo 'method' enum ∈ {'mobile_camera', 'desktop_upload'} com default 'mobile_camera' (compat retroativa)."
    - "createReadingAction lê formData.get('method') e grava em readings.capture_method (não mais hardcoded)."
    - "createReadingAction redireciona para /leituras/nova/upload?reading=[id] quando method='desktop_upload'."
    - "createReadingAction redireciona para /leituras/nova/capturar?reading=[id] quando method='mobile_camera' (preserva comportamento Fase 3)."
    - "getDraftReading retorna capture_method no DraftReading (necessário para D-15 routing do recovery banner)."
    - "Schema rejeita method='qualquer-outro-valor' com erro Zod (defesa em profundidade contra D-04)."
    - "Vocabulário proibido LGPD ('diagnóstico', 'tratamento', 'cura') ausente."
  artifacts:
    - path: "apps/web/app/actions/readings.schemas.ts"
      provides: "createReadingSchema estendido com method + DraftReading com capture_method"
      contains: "method: z.enum"
    - path: "apps/web/app/actions/readings.ts"
      provides: "createReadingAction com routing por method + getDraftReading com capture_method"
      contains: "capture_method: parsed.data.method"
    - path: "apps/web/app/actions/readings.test.ts"
      provides: "Testes de schema cobrindo method enum + default + reject"
      contains: "method"
  key_links:
    - from: "apps/web/app/actions/readings.ts"
      to: "readings.capture_method (Postgres column)"
      via: "INSERT capture_method: parsed.data.method"
      pattern: "capture_method:\\s*parsed\\.data\\.method"
    - from: "apps/web/app/actions/readings.ts (createReadingAction)"
      to: "redirect destination"
      via: "if method === 'desktop_upload' → /upload, else → /capturar"
      pattern: "/leituras/nova/upload\\?reading="
    - from: "apps/web/app/actions/readings.ts (getDraftReading)"
      to: "DraftReading.capture_method"
      via: "select inclui capture_method + helper retorna no objeto"
      pattern: "capture_method"
---

<objective>
Estender o módulo de server actions de readings para suportar o novo método de captura `'desktop_upload'`:

1. **`readings.schemas.ts`** — adicionar `method` ao `createReadingSchema` (enum com default 'mobile_camera') e adicionar `capture_method` ao tipo `DraftReading`.
2. **`readings.ts`** — `createReadingAction` lê `method` do FormData (mantém compat: chamadas Fase 3 sem o campo continuam funcionando via default), grava em `readings.capture_method`, e redireciona para a rota correta baseada no método. `getDraftReading` retorna `capture_method` no payload (consumido pelo RecoveryBanner em Wave 5).
3. **`readings.test.ts`** — adicionar testes de schema para o novo campo `method`.

Purpose: Honra CONTEXT D-03 (`capture_method` na criação) e D-04 (método imutável no draft) sem quebrar o fluxo mobile existente. É a fundação server-side que UPLOAD-02 exige (estrutura `reading_images` com `capture_method='desktop_upload'`).

Output: Server actions estendidos + testes verdes + tipo `DraftReading` ampliado para Wave 5 consumir.

Implementa CONTEXT D-03, D-04, D-15 (parte server-side do recovery routing).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-upload-desktop/04-CONTEXT.md
@.planning/phases/04-upload-desktop/04-PATTERNS.md

# Arquivos a modificar (leitura obrigatória antes de editar)
@apps/web/app/actions/readings.ts
@apps/web/app/actions/readings.schemas.ts
@apps/web/app/actions/readings.test.ts

<interfaces>
<!-- Schema atual de readings.schemas.ts (LER PRIMEIRO antes de editar): -->

```typescript
// ANTES (atual):
export const createReadingSchema = z.object({
  client_id: z.string().uuid('client_id inválido'),
})

export type DraftReading = {
  id: string
  created_at: string
  client_id: string
  client_name: string
  imagesCaptured: number
}
```

```typescript
// DEPOIS (este plan):
export const createReadingSchema = z.object({
  client_id: z.string().uuid('client_id inválido'),
  method: z.enum(['mobile_camera', 'desktop_upload']).default('mobile_camera'),
})

export type DraftReading = {
  id: string
  created_at: string
  client_id: string
  client_name: string
  imagesCaptured: number
  capture_method: 'mobile_camera' | 'desktop_upload'
}
```

<!-- Tipos do banco (já existentes — não modificar): -->
From apps/web/types/database.ts:
- Database['public']['Tables']['readings']['Row'].capture_method é 'mobile_camera' | 'desktop_upload' (enum DB já cobre — sem migration nesta fase, confirmado em CONTEXT D-15 specifics).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Estender createReadingSchema + DraftReading em readings.schemas.ts</name>
  <read_first>
    - apps/web/app/actions/readings.schemas.ts (arquivo inteiro — ~22 linhas)
    - apps/web/app/actions/readings.test.ts (arquivo inteiro — ver pattern de testes Zod)
    - .planning/phases/04-upload-desktop/04-CONTEXT.md D-03, D-04
  </read_first>
  <files>
    apps/web/app/actions/readings.schemas.ts,
    apps/web/app/actions/readings.test.ts
  </files>
  <behavior>
    Test 1: createReadingSchema aceita { client_id: VALID_UUID } sem method → success, parsed.data.method === 'mobile_camera' (default)
    Test 2: createReadingSchema aceita { client_id: VALID_UUID, method: 'mobile_camera' } → success, parsed.data.method === 'mobile_camera'
    Test 3: createReadingSchema aceita { client_id: VALID_UUID, method: 'desktop_upload' } → success, parsed.data.method === 'desktop_upload'
    Test 4: createReadingSchema rejeita { client_id: VALID_UUID, method: 'random_method' } → success === false
    Test 5: createReadingSchema rejeita { client_id: VALID_UUID, method: '' } → success === false
    Test 6: TypeScript: DraftReading tem campo capture_method que é 'mobile_camera' | 'desktop_upload' (verificável via tipos exportados — testar com `const d: DraftReading = { ..., capture_method: 'desktop_upload' }`)
  </behavior>
  <action>
1. Editar `apps/web/app/actions/readings.schemas.ts`:

```typescript
import { z } from 'zod'

// CAPTURE_METHODS: enum único exportado pra reuso (UI pode importar pra validar
// hidden inputs antes do submit). CONTEXT D-03/D-04.
export const CAPTURE_METHODS = ['mobile_camera', 'desktop_upload'] as const
export type CaptureMethod = (typeof CAPTURE_METHODS)[number]

export const createReadingSchema = z.object({
  client_id: z.string().uuid('client_id inválido'),
  // CONTEXT D-03: método vem do FormData (hidden input em new-reading-form.tsx).
  // Default 'mobile_camera' preserva compat retroativa com chamadas Fase 3 que
  // não enviam o campo. Imutabilidade no draft (D-04) é responsabilidade do
  // page.tsx do upload (guard se reading.capture_method === 'mobile_camera' →
  // redirect /capturar) — não do schema.
  method: z.enum(CAPTURE_METHODS).default('mobile_camera'),
})

export const readingIdSchema = z.object({
  reading_id: z.string().uuid('reading_id inválido'),
})

export type ReadingFormState = {
  error?: Record<string, string[]> | string | null
  readingId?: string
}

export type DraftReading = {
  id: string
  created_at: string
  client_id: string
  client_name: string
  imagesCaptured: number
  // CONTEXT D-15: RecoveryBanner roteia por método para /upload vs /capturar.
  capture_method: CaptureMethod
}
```

2. Adicionar testes ao `apps/web/app/actions/readings.test.ts` (apend ao arquivo existente, não substituir os testes do `readingIdSchema`):

```typescript
// (manter os testes existentes intactos — apenas adicionar ao final)

import { CAPTURE_METHODS, type CaptureMethod } from './readings.schemas'

describe('createReadingSchema (method field — Fase 4)', () => {
  it('uses default method=mobile_camera when omitted', () => {
    const r = createReadingSchema.safeParse({ client_id: VALID_CLIENT_UUID })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.method).toBe('mobile_camera')
  })

  it('accepts method=mobile_camera explicitly', () => {
    const r = createReadingSchema.safeParse({ client_id: VALID_CLIENT_UUID, method: 'mobile_camera' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.method).toBe('mobile_camera')
  })

  it('accepts method=desktop_upload', () => {
    const r = createReadingSchema.safeParse({ client_id: VALID_CLIENT_UUID, method: 'desktop_upload' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.method).toBe('desktop_upload')
  })

  it('rejects invalid method values', () => {
    const r = createReadingSchema.safeParse({ client_id: VALID_CLIENT_UUID, method: 'random_method' })
    expect(r.success).toBe(false)
  })

  it('rejects empty string method', () => {
    const r = createReadingSchema.safeParse({ client_id: VALID_CLIENT_UUID, method: '' })
    expect(r.success).toBe(false)
  })

  it('CAPTURE_METHODS is the canonical enum source', () => {
    expect(CAPTURE_METHODS).toEqual(['mobile_camera', 'desktop_upload'])
    // Type assertion smoke test (compiler-time check):
    const m: CaptureMethod = 'desktop_upload'
    expect(m).toBe('desktop_upload')
  })
})
```
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:run app/actions/readings.test.ts</automated>
    Comando deve sair com exit code 0 e mostrar todos os testes existentes + 6 novos passando.

    Adicionalmente:
    - `grep -n "CAPTURE_METHODS\\|method: z.enum" apps/web/app/actions/readings.schemas.ts` deve retornar 2+ matches.
    - `grep -n "capture_method:" apps/web/app/actions/readings.schemas.ts` deve retornar 1 match (no DraftReading type).
  </verify>
  <acceptance_criteria>
    - `apps/web/app/actions/readings.schemas.ts` exporta `CAPTURE_METHODS` (const tuple) e `CaptureMethod` (type).
    - `createReadingSchema.shape.method` existe com default 'mobile_camera' (validável via `createReadingSchema.parse({ client_id: VALID_UUID }).method === 'mobile_camera'`).
    - `DraftReading` tipo contém campo `capture_method: 'mobile_camera' | 'desktop_upload'`.
    - Os 6 testes novos passam + os testes antigos (3+2 = 5) continuam passando = 11+ testes total no arquivo.
    - `pnpm test:run app/actions/readings.test.ts` exit 0.
  </acceptance_criteria>
  <done>
    Schema estendido, DraftReading aumentado, testes verdes. Wave 2 (UploadDropzone) e Wave 4 (new-reading-form) podem importar `CAPTURE_METHODS` para validação client-side; Wave 5 (RecoveryBanner) consome `DraftReading.capture_method`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Atualizar createReadingAction + getDraftReading em readings.ts</name>
  <read_first>
    - apps/web/app/actions/readings.ts (arquivo inteiro — ~260 linhas)
    - apps/web/app/actions/readings.schemas.ts (após Task 1 deste plan — schema novo)
    - .planning/phases/04-upload-desktop/04-CONTEXT.md D-03, D-04, D-15
    - .planning/phases/04-upload-desktop/04-PATTERNS.md seção `app/actions/readings.ts` (template completo)
  </read_first>
  <files>
    apps/web/app/actions/readings.ts
  </files>
  <action>
**Modificações cirúrgicas no arquivo existente** (NÃO reescrever; manter `finalizeReadingAction`, `saveReadingImagesAction`, `discardReadingAction`, `cleanupStaleEmptyReadingsAction` intactos):

### Modificação 1: createReadingAction — ler `method` do FormData e routing condicional

Localizar o bloco atual (linhas ~34-61):

```typescript
const parsed = createReadingSchema.safeParse({
  client_id: formData.get('client_id'),
})
if (!parsed.success) {
  return { error: parsed.error.flatten().fieldErrors }
}

const { data: reading, error } = await supabase
  .from('readings')
  .insert({
    client_id: parsed.data.client_id,
    therapist_id: user.id,
    status: 'pending',
    capture_method: 'mobile_camera',  // ← LINHA A MUDAR
  })
  .select('id')
  .single()

if (error) {
  return { error: error.message }
}

revalidatePath('/leituras')
redirect(`/leituras/nova/capturar?reading=${reading.id}`)  // ← LINHA A MUDAR
```

Substituir por:

```typescript
const parsed = createReadingSchema.safeParse({
  client_id: formData.get('client_id'),
  // CONTEXT D-03: method vem do FormData. Default 'mobile_camera' (no schema)
  // preserva compat retroativa: chamadas Fase 3 que não passam o campo continuam
  // criando reading mobile sem mudança no client.
  method: formData.get('method') ?? undefined,
})
if (!parsed.success) {
  return { error: parsed.error.flatten().fieldErrors }
}

const { data: reading, error } = await supabase
  .from('readings')
  .insert({
    client_id: parsed.data.client_id,
    therapist_id: user.id,
    status: 'pending',
    capture_method: parsed.data.method,  // CONTEXT D-03: método vem do schema
  })
  .select('id')
  .single()

if (error) {
  return { error: error.message }
}

revalidatePath('/leituras')
// CONTEXT D-03: routing por método. Usuário no desktop vai pra /upload;
// usuário no mobile (default) vai pra /capturar. Ambos com ?reading=<id>.
const destination = parsed.data.method === 'desktop_upload'
  ? `/leituras/nova/upload?reading=${reading.id}`
  : `/leituras/nova/capturar?reading=${reading.id}`
redirect(destination)
```

**Cuidado com o JSDoc do header**: atualizar a frase "redireciona para /leituras/nova/capturar?reading=<id>" para mencionar que agora também suporta upload desktop.

### Modificação 2: getDraftReading — incluir capture_method no select e no retorno

Localizar bloco atual (linhas ~228-258):

```typescript
const { data: pending } = await supabase
  .from('readings')
  .select(`
    id,
    created_at,
    client_id,
    client:clients(full_name),
    reading_images(count)
  `)
  ...
```

Adicionar `capture_method` ao select:

```typescript
const { data: pending } = await supabase
  .from('readings')
  .select(`
    id,
    created_at,
    client_id,
    capture_method,
    client:clients(full_name),
    reading_images(count)
  `)
  .eq('therapist_id', user.id)
  .eq('status', 'pending')
  .order('created_at', { ascending: false })
  .limit(5)
```

E no return statement do for loop:

```typescript
return {
  id: r.id,
  created_at: r.created_at ?? '',
  client_id: r.client_id,
  client_name: clientObj?.full_name ?? 'Cliente',
  imagesCaptured: captured,
  // CONTEXT D-15: RecoveryBanner usa capture_method para rotear para
  // /upload?reading=<id>&resume=true vs /capturar?reading=<id>&resume=true.
  capture_method: r.capture_method,
}
```

Atualizar o JSDoc do header de `getDraftReading` para mencionar que retorna capture_method (D-15).

### Modificação 3: Não mudar finalizeReadingAction, saveReadingImagesAction, discardReadingAction, cleanupStaleEmptyReadingsAction

Esses 4 são neutros de método (já funcionam para qualquer reading independente de capture_method). O `discardReadingAction` apaga storage paths via `select('storage_path')` que cobre tanto upload quanto captura — sem mudança.

### Atualizar o re-export do tipo

A linha:
```typescript
export type { ReadingFormState, DraftReading } from './readings.schemas'
```
não precisa mudar (re-export já cobre o tipo ampliado).
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:run app/actions/readings.test.ts && pnpm tsc --noEmit -p .</automated>
    `pnpm test:run` exit 0 (testes verdes) + `pnpm tsc --noEmit` exit 0 (sem erros de tipo no projeto).

    Adicionalmente:
    - `grep -n "capture_method: parsed.data.method" apps/web/app/actions/readings.ts` retorna pelo menos 1 linha.
    - `grep -n "/leituras/nova/upload?reading=" apps/web/app/actions/readings.ts` retorna pelo menos 1 linha.
    - `grep -n "capture_method," apps/web/app/actions/readings.ts` retorna pelo menos 2 linhas (uma no select, uma no return).
    - `pnpm audit:vocabulary` exit 0.
  </verify>
  <acceptance_criteria>
    - `createReadingAction` lê `formData.get('method')` (auditável: `grep -n "formData.get\\(.method." apps/web/app/actions/readings.ts`).
    - `createReadingAction` redireciona condicionalmente para `/upload?reading=` ou `/capturar?reading=` baseado em `parsed.data.method` (auditável via grep).
    - O insert grava `capture_method: parsed.data.method` (não mais `'mobile_camera'` hardcoded).
    - `getDraftReading` inclui `capture_method` no select PostgREST (auditável: o select string contém a palavra `capture_method`).
    - O return de `getDraftReading` inclui `capture_method: r.capture_method` no objeto retornado.
    - `pnpm tsc --noEmit -p .` no apps/web exit 0 (compatibilidade de tipos com chamadores Fase 3 mantida via default).
    - `pnpm test:run app/actions/readings.test.ts` exit 0.
    - Vocabulário proibido ausente.
  </acceptance_criteria>
  <done>
    createReadingAction agora suporta os 2 métodos com routing correto. getDraftReading expõe capture_method para Wave 5 consumir. Compat retroativa preservada (Fase 3 mobile flow inalterado quando method não é enviado, via schema default).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → createReadingAction (FormData) | Cliente envia `method` via hidden input; pode ser tampered via DevTools antes do submit. |
| createReadingAction → readings.capture_method (Postgres) | Valor escrito vai pra coluna enum DB que pipeline Fase 5 lê. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-02-01 | Tampering | createReadingAction | mitigate | `method` validado por Zod enum (`z.enum(['mobile_camera', 'desktop_upload'])`); valor fora da whitelist faz `safeParse` falhar e retorna error sem inserir. ASVS L1 V5.1.3: input validation on server side ✓. |
| T-04-02-02 | Spoofing | createReadingAction | mitigate | `therapist_id: user.id` definido server-side a partir de `getUser()` (não confiável de FormData). RLS de `clients` impede inserir reading apontando pra client de outro terapeuta (T-02-06 mantido). ASVS L1 V4.1.1: access control enforced server-side ✓. |
| T-04-02-03 | Tampering | createReadingAction | accept | Terapeuta pode "trocar de método" via curl forjando method='desktop_upload' mesmo no mobile. Aceito porque: (a) terapeuta só pode tampered com seu próprio reading via RLS, (b) escolher método errado afeta apenas a UX dele mesmo, (c) D-04 garante que uma vez criado o reading não muda — page.tsx do upload tem guard que redireciona se capture_method='mobile_camera' (a ser implementado em Wave 3). |
| T-04-02-04 | Information Disclosure | getDraftReading | mitigate | Query usa `.eq('therapist_id', user.id)` + RLS — terapeuta nunca vê draft de outro. capture_method retornado é metadado próprio. ASVS L1 V4.2.1: object-level authorization ✓. |
</threat_model>

<verification>
1. `cd apps/web && pnpm test:run app/actions/` — todos os testes do diretório passam.
2. `cd apps/web && pnpm tsc --noEmit -p .` — sem erros de tipos no projeto inteiro (validar que o tipo ampliado `DraftReading` não quebra nenhum consumidor antigo; deve ser backward-compatible já que só adiciona um campo opcional do ponto de vista do consumer — TS treats enlargement as compatible se consumers não usam exact types).
3. Audit de vocabulário: `cd apps/web && pnpm audit:vocabulary` exit 0.
4. Smoke run mental: Submeter `new-reading-form` da Fase 3 SEM o hidden input `method` → schema usa default `'mobile_camera'` → reading criada idêntica à Fase 3. Sem regressão.
</verification>

<success_criteria>
- Schema estendido sem quebrar chamadas existentes.
- `createReadingAction` graba `capture_method` corretamente e redireciona condicionalmente.
- `getDraftReading` retorna `capture_method` no DraftReading.
- 6 testes novos + 5 antigos = 11+ testes verdes em `readings.test.ts`.
- Compatibilidade TS preservada em todo o projeto (`tsc --noEmit` exit 0).
- Audit de vocabulário verde.
</success_criteria>

<output>
Após completar, criar `.planning/phases/04-upload-desktop/04-02-SUMMARY.md` documentando:
- Diff resumido em readings.schemas.ts (campos adicionados).
- Diff resumido em readings.ts (linhas mudadas em createReadingAction e getDraftReading).
- Resultado do `pnpm tsc --noEmit` (sem erros).
- Confirmação de que finalizeReadingAction, saveReadingImagesAction, discardReadingAction NÃO foram modificados (auditoria pelo SUMMARY).
</output>
