---
phase: 04-upload-desktop
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/lib/upload/validate-file.ts
  - apps/web/lib/upload/validate-file.test.ts
  - apps/web/lib/upload/heic-to-jpeg.ts
  - apps/web/package.json
autonomous: true
requirements:
  - UPLOAD-01

tags:
  - phase-04
  - upload-desktop
  - lib
  - validation
  - heic

must_haves:
  truths:
    - "validateUploadFile aceita JPEG, PNG, WebP e HEIC/HEIF (por MIME ou extensão)."
    - "validateUploadFile rejeita formatos fora da whitelist com a mensagem pt-BR exata 'Formato não suportado. Use JPEG, PNG, WebP ou HEIC.'"
    - "validateUploadFile rejeita arquivos > 25 MB com mensagem pt-BR contendo 'máximo 25 MB'."
    - "validateUploadFile.needsHeicConversion=true quando MIME ∈ {image/heic,image/heif} OU extensão .heic/.heif."
    - "convertHeicToJpeg só carrega heic2any via dynamic import (await import('heic2any')) — não import top-level."
    - "Vocabulário proibido LGPD ('diagnóstico', 'tratamento', 'cura') ausente em todas as strings novas (auditável via `pnpm audit:vocabulary`)."
  artifacts:
    - path: "apps/web/lib/upload/validate-file.ts"
      provides: "validateUploadFile + ACCEPTED_MIME_TYPES + HEIC_MIME_TYPES + FileValidationResult"
      exports: ["validateUploadFile", "ACCEPTED_MIME_TYPES", "HEIC_MIME_TYPES"]
      min_lines: 40
    - path: "apps/web/lib/upload/validate-file.test.ts"
      provides: "Cobertura de MIME aceito, MIME rejeitado, tamanho limite, fallback de extensão HEIC"
      contains: "describe('validateUploadFile'"
    - path: "apps/web/lib/upload/heic-to-jpeg.ts"
      provides: "convertHeicToJpeg via dynamic import"
      exports: ["convertHeicToJpeg"]
      contains: "await import('heic2any')"
    - path: "apps/web/package.json"
      provides: "heic2any instalado como dependency"
      contains: "heic2any"
  key_links:
    - from: "apps/web/lib/upload/validate-file.ts"
      to: "FileValidationResult.needsHeicConversion"
      via: "Caller (upload-client) decide chamar convertHeicToJpeg quando true"
      pattern: "needsHeicConversion"
    - from: "apps/web/lib/upload/heic-to-jpeg.ts"
      to: "heic2any package"
      via: "Dynamic import — bundle splitting"
      pattern: "await import\\(['\"]heic2any['\"]\\)"
---

<objective>
Criar a fundação de bibliotecas puras para o upload desktop:
1. `validate-file.ts` — validação client-side síncrona de MIME e tamanho (CONTEXT D-10, D-12). Whitelist explícita: JPEG/PNG/WebP/HEIC/HEIF. Limite 25 MB. Mensagens em pt-BR sem vocabulário proibido.
2. `heic-to-jpeg.ts` — conversor HEIC → JPEG via dynamic import de `heic2any` (CONTEXT D-11). O dynamic import garante que o bundle da lib HEIC só seja baixado quando o terapeuta efetivamente arrasta um arquivo HEIC.
3. Testes vitest cobrindo todos os caminhos felizes e tristes de `validate-file`.

Purpose: Estabelecer o contrato de validação ANTES da UI consumi-lo (Wave 1) — assim Wave 2 (UploadDropzone) e Wave 3 (upload-client) recebem uma API estável e testada. A escolha de `heic2any` (sob "Claude's Discretion" em CONTEXT D-11) é honrada aqui com justificativa documentada inline.

Output: Lib modules + suite de testes vitest + dependência `heic2any` adicionada ao `apps/web/package.json`.
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

# Padrão de lib pura (named exports, sem 'use client'/'use server', JSDoc com referência D-XX)
@apps/web/lib/capture/validate-image.ts
@apps/web/lib/capture/storage-path.ts

# Padrão de teste vitest puro (descritivo, fazendo input → output assertion)
@apps/web/lib/capture/storage-path.test.ts

# Vitest config (ambiente jsdom, paths @/...)
@apps/web/vitest.config.ts

<interfaces>
<!-- Tipos extraídos do codebase pra que o executor não precise explorar. -->

From apps/web/lib/capture/validate-image.ts (pattern de lib pura com const exportada):
```typescript
export const BLOCKING_REASONS: readonly string[] = [
  'sem_olho',
  'dois_olhos',
  'olho_fechado',
  'muito_longe',
]

export interface ValidationResult {
  quality: QualityLevel
  reason: ValidationReason | string
  source: 'vlm' | 'fallback'
  error?: string
}
```

From apps/web/lib/capture/storage-path.ts (pattern de função pura com validação de input):
```typescript
export function buildOriginalStoragePath(
  therapistId: string,
  readingId: string,
  eye: Eye,
  angle: Angle,
): string
```

NOVO em validate-file.ts (especificado neste plan):
```typescript
export interface FileValidationResult {
  ok: boolean
  error?: string
  needsHeicConversion?: boolean
}
export function validateUploadFile(file: File): FileValidationResult
export const ACCEPTED_MIME_TYPES: ReadonlySet<string>
export const HEIC_MIME_TYPES: ReadonlySet<string>
```

NOVO em heic-to-jpeg.ts (especificado neste plan):
```typescript
export function convertHeicToJpeg(file: File | Blob): Promise<Blob>
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Criar lib/upload/validate-file.ts + testes vitest</name>
  <read_first>
    - apps/web/lib/capture/validate-image.ts (linhas 1-57 — pattern de const exportada + helper puro)
    - apps/web/lib/capture/storage-path.ts (pattern de função pura com validação de input)
    - apps/web/lib/capture/storage-path.test.ts (pattern de teste vitest puro)
    - .planning/phases/04-upload-desktop/04-CONTEXT.md seções D-10, D-12 (limites exatos)
    - .planning/phases/04-upload-desktop/04-PATTERNS.md seção `lib/upload/validate-file.ts` (template literal completo)
  </read_first>
  <files>
    apps/web/lib/upload/validate-file.ts,
    apps/web/lib/upload/validate-file.test.ts
  </files>
  <behavior>
    Test 1: validateUploadFile aceita File com type='image/jpeg' size=1MB → { ok: true, needsHeicConversion: false }
    Test 2: validateUploadFile aceita File com type='image/png' → { ok: true }
    Test 3: validateUploadFile aceita File com type='image/webp' → { ok: true }
    Test 4: validateUploadFile aceita File com type='image/heic' → { ok: true, needsHeicConversion: true }
    Test 5: validateUploadFile aceita File com type='image/heif' → { ok: true, needsHeicConversion: true }
    Test 6: validateUploadFile aceita File com type='' mas name='photo.heic' (fallback por extensão) → { ok: true, needsHeicConversion: true }
    Test 7: validateUploadFile aceita File com type='' mas name='photo.HEIF' (case-insensitive) → { ok: true, needsHeicConversion: true }
    Test 8: validateUploadFile rejeita File com type='image/gif' → { ok: false, error: 'Formato não suportado. Use JPEG, PNG, WebP ou HEIC.' }
    Test 9: validateUploadFile rejeita File com type='application/pdf' → { ok: false, error contém 'Formato não suportado' }
    Test 10: validateUploadFile rejeita File com size = 25 * 1024 * 1024 + 1 → { ok: false, error contém 'máximo 25 MB' }
    Test 11: validateUploadFile aceita File com size exatamente 25 * 1024 * 1024 → { ok: true } (limite inclusivo no boundary)
    Test 12: ACCEPTED_MIME_TYPES contém 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
    Test 13: HEIC_MIME_TYPES contém 'image/heic' e 'image/heif' apenas
  </behavior>
  <action>
Criar `apps/web/lib/upload/validate-file.ts` com **conteúdo exato seguindo o template em 04-PATTERNS.md** (seção "lib/upload/validate-file.ts"). Especificações concretas:

```typescript
// apps/web/lib/upload/validate-file.ts
// Sem 'use client' / 'use server' — lib pura (roda no browser, sem IO).
// CONTEXT D-10 (validação técnica mínima MIME + tamanho).
// CONTEXT D-12 (limite 25 MB por foto).

const MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25MB — CONTEXT D-12

/** MIMEs aceitos diretamente (sem conversão). HEIC/HEIF são aceitos como input
 *  mas passam por convertHeicToJpeg antes de chegar no VLM. */
export const ACCEPTED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

/** MIMEs que requerem conversão client-side antes de qualquer processamento. */
export const HEIC_MIME_TYPES: ReadonlySet<string> = new Set(['image/heic', 'image/heif'])

export interface FileValidationResult {
  ok: boolean
  error?: string
  needsHeicConversion?: boolean
}

/**
 * Valida MIME type e tamanho do arquivo antes de qualquer processamento.
 * Puro e síncrono — sem IO. Mensagens pt-BR neutras (sem vocabulário proibido LGPD).
 *
 * Fallback por extensão: alguns SOs (Windows < 11, macOS antigos) omitem MIME
 * para .heic. Sempre comparar extensão também.
 */
export function validateUploadFile(file: File): FileValidationResult {
  const mime = file.type.toLowerCase()
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

Criar `apps/web/lib/upload/validate-file.test.ts` cobrindo os 13 cenários listados em `<behavior>`. Use `new File([new Uint8Array(N)], 'name.ext', { type: '...' })` para construir o input. Para o teste de tamanho exato, use `new Blob([new Uint8Array(MAX_SIZE_BYTES)])` envolto em File com a mesma referência (não exceder memória — pode mockar `size` via `Object.defineProperty` se preferir; veja `lib/capture/upload.test.ts` para referência de mock de Blob).

Vocabulário proibido: NUNCA usar 'diagnóstico', 'tratamento' ou 'cura' nas mensagens de erro nem nos comentários.
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:run lib/upload/validate-file.test.ts</automated>
    Comando deve sair com exit code 0 e mostrar 13 testes passando.

    Também executar:
    - `cd apps/web && pnpm audit:vocabulary` — exit 0 (sem vocabulário proibido).
    - `grep -n "validateUploadFile\\|ACCEPTED_MIME_TYPES\\|HEIC_MIME_TYPES" apps/web/lib/upload/validate-file.ts` deve listar pelo menos 4 ocorrências (1 const, 1 const, 1 function, 1 interface).
  </verify>
  <acceptance_criteria>
    - File `apps/web/lib/upload/validate-file.ts` existe com pelo menos 40 linhas.
    - Exports verificáveis via grep: `validateUploadFile`, `ACCEPTED_MIME_TYPES`, `HEIC_MIME_TYPES`, `FileValidationResult`.
    - Mensagem exata "Formato não suportado. Use JPEG, PNG, WebP ou HEIC." presente no arquivo (auditável via grep).
    - String "máximo 25 MB" presente no arquivo (auditável via grep).
    - File `apps/web/lib/upload/validate-file.test.ts` existe e contém ao menos 13 chamadas a `it(`.
    - `pnpm test:run lib/upload/validate-file.test.ts` exit 0.
    - `pnpm audit:vocabulary` exit 0.
    - Nenhum import de `'use client'` ou `'use server'` no validate-file.ts (lib pura).
  </acceptance_criteria>
  <done>
    Validação MIME + tamanho funcionando, 13 testes passando, sem vocabulário proibido, exports prontos para Wave 2/3 consumirem.
  </done>
</task>

<task type="auto">
  <name>Task 2: Instalar heic2any + criar lib/upload/heic-to-jpeg.ts com dynamic import</name>
  <read_first>
    - apps/web/lib/capture/jpeg-compress.ts (pattern de função async com Blob I/O — referência da analog em 04-PATTERNS.md)
    - apps/web/components/capture/AngleIcon.tsx ou similar para confirmar pattern de imports
    - apps/web/package.json (verificar dependencies atuais antes de adicionar heic2any)
    - .planning/phases/04-upload-desktop/04-CONTEXT.md D-11 (HEIC convert client-side, dynamic import obrigatório)
    - .planning/phases/04-upload-desktop/04-PATTERNS.md seção `lib/upload/heic-to-jpeg.ts`
  </read_first>
  <files>
    apps/web/lib/upload/heic-to-jpeg.ts,
    apps/web/package.json
  </files>
  <action>
1. **Instalar heic2any** (escolha do planner sob CONTEXT D-11 "Claude's Discretion": heic2any é mais maduro, simpler API, MIT, ainda mantido — verificar último publish antes de instalar via `npm view heic2any time.modified` no diretório `apps/web`):
```bash
cd apps/web && pnpm add heic2any
```
Se a versão publicada estiver com mais de 24 meses sem release, abortar com toast/comment e PARAR — pedir ao desenvolvedor para reavaliar entre `heic2any` e `libheif-js`. Caso contrário, prosseguir.

2. **Criar `apps/web/lib/upload/heic-to-jpeg.ts`** com este conteúdo exato:

```typescript
// apps/web/lib/upload/heic-to-jpeg.ts
// Sem 'use client' / 'use server' — lib pura (roda só no browser via import dinâmico
// dentro de upload-client). NÃO tem import top-level de 'heic2any' — bundle splitting
// garante que a lib (~600KB) só é baixada quando o terapeuta arrasta um HEIC real.
//
// CONTEXT D-11: conversão client-side; bundle restrito à rota /upload via
// dynamic import — não vaza pro resto do app.

/**
 * Converte HEIC/HEIF para JPEG via dynamic import de heic2any.
 * Chamado APENAS quando file.type === 'image/heic' || 'image/heif' (validateUploadFile
 * sinaliza needsHeicConversion=true).
 *
 * Throws: lança Error com mensagem amigável pt-BR — caller (upload-client) faz
 * toast.error com o `.message` ou usa fallback genérico.
 */
export async function convertHeicToJpeg(file: File | Blob): Promise<Blob> {
  // Dynamic import — só carrega heic2any quando necessário
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = await import('heic2any') as any
  const heic2any = mod.default ?? mod
  const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
  // heic2any pode retornar Blob | Blob[] (multi-frame HEIC)
  return Array.isArray(result) ? result[0] : result
}
```

3. **Não criar teste vitest para heic-to-jpeg.ts** nesta tarefa (jsdom não consegue rodar heic2any sem ambiente real de browser; testaremos via UAT smoke no Wave 5). Adicionar comentário inline explicando porque não há teste unitário.

Notas obrigatórias:
- O `await import('heic2any')` DEVE estar dentro da função, NUNCA no top-level. Caso contrário, vaza pro bundle inicial — viola D-11.
- Não export do `heic2any` em si — só a função wrapper.
- Vocabulário proibido: nenhuma mensagem nova; só nomes técnicos.
  </action>
  <verify>
    <automated>cd apps/web && grep -c "^import.*heic2any" lib/upload/heic-to-jpeg.ts | grep -q "^0$" && echo OK</automated>
    O grep deve retornar 0 (zero imports top-level de heic2any).

    Adicionalmente:
    - `cd apps/web && pnpm view heic2any version` (que está instalado).
    - `cd apps/web && grep -n "await import\\(.heic2any" lib/upload/heic-to-jpeg.ts` deve retornar pelo menos 1 linha (dynamic import dentro da função).
    - `cd apps/web && cat package.json | grep -q '"heic2any"' && echo OK` (presente em dependencies).
  </verify>
  <acceptance_criteria>
    - `apps/web/package.json` lista `heic2any` em `dependencies`.
    - `apps/web/lib/upload/heic-to-jpeg.ts` exporta `convertHeicToJpeg`.
    - Arquivo NÃO contém `import heic2any from` ou `import { ... } from 'heic2any'` no top-level (auditável via `grep -E "^import.*from ['\"]heic2any['\"]" lib/upload/heic-to-jpeg.ts` retorna vazio).
    - Arquivo CONTÉM `await import('heic2any')` dentro de `convertHeicToJpeg` (auditável via grep).
    - JSDoc menciona "CONTEXT D-11" e "dynamic import" no header do arquivo.
  </acceptance_criteria>
  <done>
    heic2any instalado, conversor wrapper criado com dynamic import garantido, sem vazamento pro bundle inicial.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser file picker → validate-file.ts | terapeuta pode injetar arquivo arbitrário via drag-and-drop; MIME do navegador é dica, não verdade. |
| validate-file.ts → heic2any (dynamic import) | execução de código WASM/JS de terceiros no contexto do browser do terapeuta. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-01-01 | Tampering | validate-file.ts | mitigate | MIME spoofing via extensão (terapeuta renomeia .exe para .jpg): defesa em camadas — esta lib é primeira barreira (UX); o pipeline VLM (Wave 3) e o Storage policy (Fase 1 RLS) são barreiras subsequentes. ASVS L1 V12.1.1: file size limited to 25MB ✓. ASVS V12.1.2: file type whitelisted ✓. |
| T-04-01-02 | Denial of Service | validate-file.ts | mitigate | Oversized file (>25MB) bloqueado client-side antes de qualquer upload. Limite documentado em D-12. ASVS L1 V12.1.1 ✓. |
| T-04-01-03 | Tampering | heic-to-jpeg.ts | accept | Supply-chain de heic2any (npm). Mitigação: dynamic import isolado na rota /upload (raio de impacto reduzido); pinned version no package.json; revisão manual antes de commit. Aceito porque alternativa (libheif-js WASM) tem o mesmo risco e maintainership similar. ASVS L1 V14.2.1: dependency tracked ✓. |
| T-04-01-04 | Information Disclosure | heic-to-jpeg.ts | mitigate | Conversão acontece 100% client-side; arquivo HEIC original nunca toca servidor antes da conversão JPEG. Sem PII em logs (só nomes técnicos no console.error). |
| T-04-01-05 | Denial of Service | heic-to-jpeg.ts | accept | Conversão HEIC pode consumir memória (~10x tamanho do arquivo durante decode). Limite de 25MB no input cap o blast radius (~250MB peak). Aceito — terapeutas usam laptops com 8GB+ RAM. |
</threat_model>

<verification>
1. Rodar `cd apps/web && pnpm test:run lib/upload/` — todos os testes passando.
2. Rodar `cd apps/web && pnpm audit:vocabulary` — exit 0.
3. Build check (não obrigatório, mas se rápido): `cd apps/web && pnpm build` — verificar nas ASCII trees do build que `heic2any` aparece SOMENTE em chunks dinâmicos (não no chunk principal de `(dashboard)/leituras`).
4. Imports auditáveis via grep:
   - `grep -rE "^import.*heic2any" apps/web/lib apps/web/app apps/web/components` retorna VAZIO (nenhum import top-level).
   - `grep -rn "validateUploadFile" apps/web/lib/upload/` retorna pelo menos 1 declaração + 1 export.
</verification>

<success_criteria>
- 13 testes vitest passando em `validate-file.test.ts`.
- `validateUploadFile`, `convertHeicToJpeg`, `ACCEPTED_MIME_TYPES`, `HEIC_MIME_TYPES`, `FileValidationResult` todos exportados.
- `heic2any` em `apps/web/package.json` dependencies.
- Mensagens pt-BR sem vocabulário proibido (audit:vocabulary verde).
- Nenhum import top-level de `heic2any` em todo o projeto.
</success_criteria>

<output>
Após completar, criar `.planning/phases/04-upload-desktop/04-01-SUMMARY.md` documentando:
- Versão exata do heic2any instalado e data do último release verificada.
- Conteúdo do arquivo validate-file.ts (cite linhas-chave).
- Lista de testes que passaram (13 cenários).
- Decisão final entre heic2any vs libheif-js (justificativa).
</output>
