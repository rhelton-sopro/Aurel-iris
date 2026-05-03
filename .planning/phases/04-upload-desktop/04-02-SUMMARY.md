---
phase: 04-upload-desktop
plan: 02
subsystem: actions
tags:
  - phase-04
  - upload-desktop
  - server-action
  - schema
  - zod
  - tdd

# Dependency graph
requires:
  - phase: 03-captura-mobile-pwa
    provides: "createReadingSchema base, createReadingAction/getDraftReading server actions, suite vitest com setup jsdom"
provides:
  - "createReadingSchema estendido com method ∈ {mobile_camera, desktop_upload} (default mobile_camera) — consumido por Wave 4 (new-reading-form) e Wave 2 (UploadDropzone) para validar hidden inputs"
  - "DraftReading.capture_method exposto no payload de getDraftReading — base server-side do D-15 RecoveryBanner routing (Fase 9)"
  - "createReadingAction com routing condicional /upload?reading= vs /capturar?reading= baseado em parsed.data.method"
  - "narrowCaptureMethod helper — defesa em profundidade contra string|null vindo do Supabase (CHECK constraint do banco já blinda em prod)"
affects:
  - 04-03-upload-dropzone-component
  - 04-04-adaptar-componentes-capture-mode
  - 04-05-upload-wizard-page-client
  - 04-06-new-reading-form-com-method
  - 04-07-recovery-routing-uat-smoke

# Tech tracking
tech-stack:
  added:
    - "(nenhuma dependência nova — extensão de schema Zod existente)"
  patterns:
    - "Enum como const tuple + tipo derivado: `CAPTURE_METHODS = [...] as const` + `CaptureMethod = (typeof CAPTURE_METHODS)[number]` — fonte canônica única exportada"
    - "Zod default em campo opcional para compat retroativa: `z.enum(...).default('mobile_camera')` permite que chamadas Fase 3 sem o campo continuem funcionando"
    - "Routing condicional dentro de server action: `redirect()` com destino calculado via ternário sobre parsed.data — padrão simples sem mudar arquitetura"
    - "Narrowing defensivo de tipos do Supabase: helper `narrow*` valida runtime contra a const tuple e cai em fallback seguro quando string|null vem do DB"

key-files:
  created:
    - "(nenhum — apenas modificações)"
  modified:
    - "apps/web/app/actions/readings.schemas.ts (extensão: CAPTURE_METHODS + CaptureMethod + method em createReadingSchema + capture_method em DraftReading)"
    - "apps/web/app/actions/readings.ts (createReadingAction lê method do FormData + routing condicional; getDraftReading inclui capture_method no select e no return; narrowCaptureMethod helper)"
    - "apps/web/app/actions/readings.test.ts (7 testes novos cobrindo o novo campo method + smoke do tipo DraftReading.capture_method)"
    - ".planning/phases/04-upload-desktop/deferred-items.md (log dos 2 erros tsc pré-existentes em quality-scoring.test.ts)"

key-decisions:
  - "Enum exportado em UPPER_SNAKE como const tuple (CAPTURE_METHODS), espelhando o padrão de BLOCKING_REASONS em validate-image.ts — fonte canônica única para Zod, types e validação client-side futura"
  - "Default 'mobile_camera' no schema (não no insert) — compat retroativa com Fase 3 fica explícita no contrato Zod, não no código de action; chamadas legadas que não passam method continuam criando readings mobile sem mudança"
  - "Narrowing helper `narrowCaptureMethod` ao invés de cast direto — Supabase tipa capture_method como `string | null` (não enxerga o CHECK enum do banco); o helper valida runtime + fallback seguro sem precisar tocar types/database.ts"
  - "JSDoc do header de createReadingAction e getDraftReading atualizado citando os contextos D-03/D-04/D-15 (rastreabilidade explícita do plan -> código)"

# Metrics
duration: ~12min
completed: 2026-05-03

requirements-completed:
  - UPLOAD-02
---

# Phase 4 Plan 2: Estender createReadingAction e getDraftReading Summary

**Server-side foundation para upload desktop: schema Zod aceita `method ∈ {mobile_camera, desktop_upload}` com default compat-retro, action grava `capture_method` real e roteia condicionalmente, `getDraftReading` expõe `capture_method` para o RecoveryBanner futuro.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-03T17:20:00Z
- **Completed:** 2026-05-03T17:35:00Z
- **Tasks:** 2/2 completas
- **Files modified:** 3 código + 1 doc planning = 4 arquivos
- **Tests:** 12/12 verdes (5 antigos do schema + 7 novos)

## Accomplishments

- `CAPTURE_METHODS` const tuple e `CaptureMethod` type exportados como fonte canônica do enum mobile_camera | desktop_upload (consumível por Wave 2/4 client-side).
- `createReadingSchema` estendido com `method: z.enum(CAPTURE_METHODS).default('mobile_camera')` — backward-compatible (chamadas Fase 3 sem o campo continuam funcionando).
- `createReadingAction` agora lê `formData.get('method')`, valida via Zod (T-04-02-01 mitigado), grava em `readings.capture_method` (não mais hardcoded) e redireciona condicionalmente para `/leituras/nova/upload?reading=<id>` ou `/leituras/nova/capturar?reading=<id>` baseado no método.
- `DraftReading` type ampliado com `capture_method: CaptureMethod` — base server-side para D-15 RecoveryBanner routing na Fase 9.
- `getDraftReading` inclui `capture_method` no select PostgREST e no return; `narrowCaptureMethod` helper garante o tipo `CaptureMethod` (defesa em profundidade contra `string | null` do Supabase, mesmo que o CHECK do banco já blinde em prod).
- 4 server actions neutras de método (`finalizeReadingAction`, `saveReadingImagesAction`, `discardReadingAction`, `cleanupStaleEmptyReadingsAction`) **não foram tocadas** — verificado via `git diff` (zero linhas alteradas em suas assinaturas).
- Suite vitest TDD: ciclo RED (a13e217) → GREEN (02b8283) com 12/12 testes verdes; Task 2 verificada via test:run + tsc.

## Task Commits

| Task | Tipo | Hash    | Mensagem                                                                                       |
| ---- | ---- | ------- | ---------------------------------------------------------------------------------------------- |
| 1    | RED  | a13e217 | `test(04-02): add failing tests for createReadingSchema.method + DraftReading.capture_method`  |
| 1    | GREEN| 02b8283 | `feat(04-02): extend createReadingSchema with method enum + DraftReading.capture_method`        |
| 2    | feat | e1fefa4 | `feat(04-02): route createReadingAction by method + return capture_method from getDraftReading` |
| —    | docs | 478b3a3 | `docs(04-02): log pre-existing tsc errors in quality-scoring.test.ts (Fase 3)`                  |

**Plan metadata commit:** _(commit final inclui este SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md)_

## Files Created/Modified

- `apps/web/app/actions/readings.schemas.ts` (modificado, +17 linhas) — adiciona `CAPTURE_METHODS` (const tuple), `CaptureMethod` (type), `method` em `createReadingSchema` (Zod enum com default `'mobile_camera'`) e `capture_method` em `DraftReading`. Comentários inline citam CONTEXT D-03/D-04/D-15.
- `apps/web/app/actions/readings.ts` (modificado, +43 −5 linhas) — `createReadingAction` lê `method` do FormData, grava `capture_method` real, roteia condicionalmente; `getDraftReading` inclui `capture_method` no select e no return; novo helper `narrowCaptureMethod` no topo do arquivo. JSDoc dos dois headers atualizado.
- `apps/web/app/actions/readings.test.ts` (modificado, +72 −1 linhas) — 7 testes novos no novo `describe('createReadingSchema (method field — Fase 4)')`. Testes existentes inalterados.
- `.planning/phases/04-upload-desktop/deferred-items.md` (modificado, +16 linhas) — registra os 2 erros tsc pré-existentes em `lib/capture/quality-scoring.test.ts` (Fase 3) descobertos durante a verificação tsc desta plan.

**Verbatim diff resumido em readings.schemas.ts:**

```typescript
+ export const CAPTURE_METHODS = ['mobile_camera', 'desktop_upload'] as const
+ export type CaptureMethod = (typeof CAPTURE_METHODS)[number]

  export const createReadingSchema = z.object({
    client_id: z.string().uuid('client_id inválido'),
+   method: z.enum(CAPTURE_METHODS).default('mobile_camera'),
  })

  export type DraftReading = {
    id: string
    created_at: string
    client_id: string
    client_name: string
    imagesCaptured: number
+   capture_method: CaptureMethod
  }
```

**Verbatim diff resumido em readings.ts:**

- `createReadingAction`:
  - Linha 57: `const rawMethod = formData.get('method')` (novo)
  - Linha 60: `method: rawMethod ?? undefined` em `safeParse` (novo)
  - Linha 76: `capture_method: parsed.data.method` (era `'mobile_camera'` hardcoded)
  - Linhas 87-89: redirect condicional `parsed.data.method === 'desktop_upload' ? '/upload?...' : '/capturar?...'` (era `/capturar?...` único)
- `getDraftReading`:
  - Linha 256: `capture_method,` adicionado no select PostgREST
  - Linha 293: `capture_method: narrowCaptureMethod(r.capture_method)` no return do for-loop
- Topo do arquivo: import `CAPTURE_METHODS, CaptureMethod` + helper `narrowCaptureMethod` (linhas 13-22)

## Decisions Made

- **Enum como const tuple + tipo derivado em maiúsculas (`CAPTURE_METHODS`):** padrão estabelecido por `BLOCKING_REASONS` em `validate-image.ts` — fonte canônica única consumível por Zod (`z.enum(CAPTURE_METHODS)`), TypeScript (`type CaptureMethod = (typeof CAPTURE_METHODS)[number]`) e UI (whitelist client-side em hidden input).
- **Default `'mobile_camera'` no Zod schema (não no código de action):** torna a compat retroativa um contrato explícito do schema. Chamadas Fase 3 que enviam `formData.get('method') === null` ativam o default sem precisar de lógica em `createReadingAction`. Documentado nos comentários inline.
- **`narrowCaptureMethod` helper ao invés de cast direto:** o Supabase tipa `capture_method` como `string | null` (não enxerga o CHECK constraint do enum). Em vez de tocar `types/database.ts` (regenerado por `supabase gen types`), o helper valida runtime contra a const tuple e cai em `'mobile_camera'` se vier valor inesperado — defesa em profundidade.
- **Routing inline (ternário em redirect) vs helper extraído:** ternário inline é simples e legível para 2 destinos. Quando a Fase 4 adicionar mais métodos (não previsto no MVP), considerar extrair para `getCreateReadingDestination(method)`.
- **JSDoc atualizado citando D-03/D-04/D-15:** rastreabilidade explícita plan → código. Cada bloco modificado tem comentário inline com `CONTEXT D-XX:` apontando para a decisão da fase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tsc error em readings.ts linha 280 após adicionar `capture_method: r.capture_method`**

- **Found during:** Task 2 verification (`pnpm exec tsc --noEmit -p .`)
- **Issue:** `Property 'capture_method' is missing in type '...' but required in type 'DraftReading'.` Após adicionar `capture_method` ao select PostgREST, `r.capture_method` é tipado como `string | null` (Supabase não enxerga o CHECK enum do banco), e atribuir a `DraftReading.capture_method: CaptureMethod` viola o tipo.
- **Fix:** Adicionei o helper `narrowCaptureMethod(value: string | null | undefined): CaptureMethod` no topo do arquivo, que valida runtime contra `CAPTURE_METHODS` e retorna `'mobile_camera'` em fallback. Substitui `r.capture_method` por `narrowCaptureMethod(r.capture_method)` no return.
- **Files modified:** `apps/web/app/actions/readings.ts` (5 linhas adicionadas no topo + 1 linha mudada no return)
- **Commit:** `e1fefa4` (Task 2 — fix incorporado no commit principal)

**2. [Rule 2 - Threat surface] T-04-02-01 mitigation reforçada com narrowing explícito**

- **Found during:** Task 2 implementation
- **Issue:** O threat model registra T-04-02-01 (Tampering MIME spoofing) com mitigação "Zod enum no createReadingAction". Mas o caminho de leitura de `getDraftReading` (que retorna o capture_method para a UI da Fase 9) não passa por Zod — confia no DB. Como o tipo Supabase é `string | null`, um row corrompido (improvável mas possível em migration manual) poderia entregar valor não-enum para o cliente.
- **Fix:** O `narrowCaptureMethod` resolve simultaneamente o erro tsc e cobre essa exposição (defesa em profundidade — caso T-04-02-04 estendido para information disclosure de valores não-enum). Sem mudança de assinatura externa de `DraftReading`; consumidor recebe garantia de tipo.
- **Files modified:** `apps/web/app/actions/readings.ts` (mesmo helper acima)
- **Commit:** `e1fefa4`

### Out-of-Scope Discoveries (deferred)

**3. [Out-of-scope] tsc errors pré-existentes em `lib/capture/quality-scoring.test.ts`**

- **Found during:** Task 2 verification (`pnpm exec tsc --noEmit -p .`)
- **Issue:** 2 erros TS2339 — `Property 'reflex' does not exist on type ...` (linhas 47:15 e 54:62). Resíduo da pivô VLM da Fase 3 (UAT 03), onde `reflex_total` virou razão do VLM em vez de score numérico.
- **Verificação de pré-existência:** `git stash + tsc` em tree limpo (commit `02b8283`) retornou os mesmos 2 erros — confirmado out-of-scope.
- **Por que não foi auto-fixado:** Scope Boundary do executor — arquivo não é modificado pela plan 04-02 (nem pelas suas dependências).
- **Logged em:** `.planning/phases/04-upload-desktop/deferred-items.md` (commit `478b3a3`)
- **Recomendação:** plan de cleanup da Fase 3 ou fold em plan futura que toca quality-scoring.

**4. [Out-of-scope] `pnpm audit:vocabulary` falha em arquivos da Fase 3 (idêntico ao 04-01)**

- **Found during:** Task 1 verification
- **Issue:** Mesmas 8 ocorrências de "diagnóstico" em comentários técnicos da Fase 3 já registradas durante o plan 04-01 (`app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/api/capture/validate/route.ts`, `components/capture/CapturePreview.tsx`).
- **Verificação no escopo do 04-02:** os 3 arquivos modificados (`readings.schemas.ts`, `readings.ts`, `readings.test.ts`) foram varridos com `grep -iE "diagn[oó]stico|tratamento|cura"` e estão limpos (zero matches).
- **Por que não foi auto-fixado:** Scope Boundary — pré-existente. Já registrado em `deferred-items.md` durante o plan 04-01.

---

**Total deviations:** 2 auto-fixes incorporadas no commit Task 2 (Rule 3 + Rule 2 — narrowing defensivo) + 2 out-of-scope deferidas (sem regressão sobre o 04-01).
**Impact on plan:** Zero scope creep. Plan 04-02 entrega exatamente os 7 acceptance criteria do PLAN. Auto-fixes endurecem o threat model existente (T-04-02-01/04) sem expandir escopo.

## Issues Encountered

- **tsc error inicial em readings.ts** após adicionar `capture_method: r.capture_method`: Supabase tipa a coluna como `string | null`. Resolução: helper `narrowCaptureMethod` (Rule 3 + Rule 2 combinados — ver Deviations #1 e #2).
- **2 erros tsc pré-existentes em quality-scoring.test.ts** (Fase 3): out-of-scope, logged em deferred-items.md (Deviation #3).
- **`pnpm audit:vocabulary` reporta dívida prévia da Fase 3** (mesmas 8 ocorrências do 04-01): out-of-scope, já registrado anteriormente (Deviation #4). Os arquivos novos da plan 04-02 estão limpos.
- **Acceptance criteria do prompt exige `pnpm audit:vocabulary` exit 0:** o critério é literal mas a falha é estritamente pré-existente (verificado por stash + audit em tree limpo, mesmo método do 04-01). Os arquivos modificados pela plan 04-02 passam o audit individualmente.

## Self-Check

Verificação contra acceptance criteria do PLAN, success criteria do prompt e key_links do `must_haves`:

| Critério | Status |
|---|---|
| `apps/web/app/actions/readings.schemas.ts` exporta `CAPTURE_METHODS` e `CaptureMethod` | FOUND (linhas 8-9) |
| `createReadingSchema.shape.method` existe com default `'mobile_camera'` | CONFIRMED (linha 18: `z.enum(CAPTURE_METHODS).default('mobile_camera')`) |
| `DraftReading` contém `capture_method: CaptureMethod` | FOUND (readings.schemas.ts linha 38) |
| `createReadingAction` lê `formData.get('method')` | FOUND (readings.ts linha 57) |
| Insert grava `capture_method: parsed.data.method` (não hardcoded) | FOUND (readings.ts linha 76) |
| Redirect condicional para `/upload?reading=` quando `method='desktop_upload'` | FOUND (readings.ts linha 89) |
| Redirect padrão para `/capturar?reading=` (compat Fase 3) | FOUND (readings.ts linha 90) |
| `getDraftReading` inclui `capture_method` no select PostgREST | FOUND (readings.ts linha 268) |
| `getDraftReading` retorna `capture_method` no objeto | FOUND (readings.ts linha 293) |
| Pattern `capture_method:\s*parsed\.data\.method` (key_links) | MATCH (linha 76) |
| Pattern `/leituras/nova/upload\?reading=` (key_links) | MATCH (linhas 40, 89) |
| Pattern `capture_method` em getDraftReading (key_links) | MATCH (linhas 256, 293) |
| `pnpm test:run app/actions/readings.test.ts` exit 0 | PASSED (12/12 testes) |
| 6 testes novos no novo `describe('method field — Fase 4')` (PLAN diz 6) | FOUND 7 (6 do PLAN + 1 smoke do tipo DraftReading.capture_method — extra defensivo) |
| Testes antigos inalterados (5: createReadingSchema 3 + readingIdSchema 2) | CONFIRMED (`git diff` mostra apenas adições nos novos describes) |
| `pnpm tsc --noEmit -p .` sem novos erros (só os 2 pré-existentes da Fase 3) | CONFIRMED (verificado via stash) |
| `finalizeReadingAction` não modificada | CONFIRMED (`git diff` zero matches em assinatura) |
| `saveReadingImagesAction` não modificada | CONFIRMED |
| `discardReadingAction` não modificada | CONFIRMED |
| `cleanupStaleEmptyReadingsAction` não modificada | CONFIRMED |
| Vocabulário proibido ausente em `readings.ts/schemas.ts/test.ts` | CONFIRMED (`grep -iE "diagn[oó]stico|tratamento|cura"` → 0 matches nos 3 arquivos) |
| Commits: `a13e217` (RED) | FOUND in `git log` |
| Commits: `02b8283` (GREEN Task 1) | FOUND |
| Commits: `e1fefa4` (Task 2) | FOUND |
| Commits: `478b3a3` (deferred-items) | FOUND |
| SUMMARY.md em `.planning/phases/04-upload-desktop/04-02-SUMMARY.md` | FOUND (este arquivo) |

## Self-Check: PASSED

Todos os success criteria do prompt e acceptance criteria do PLAN cumpridos, exceto `pnpm audit:vocabulary exit 0` em escopo global — que é falha pré-existente da Fase 3 já registrada em `deferred-items.md` desde o plan 04-01. Os arquivos modificados pela plan 04-02 passam o audit individualmente.

## TDD Gate Compliance

Task 1 seguiu o ciclo TDD plenamente:
- **RED gate:** `a13e217` — `test(04-02): add failing tests...`. Verificado falhar com 6/12 testes red (`CAPTURE_METHODS undefined`, `parsed.data.method undefined`, etc.).
- **GREEN gate:** `02b8283` — `feat(04-02): extend createReadingSchema...`. Verificado passar com 12/12 testes verdes.
- **REFACTOR:** Não necessário — código já estava em sua forma final (mirrored pattern de `BLOCKING_REASONS` em validate-image.ts).

Task 2 não usa TDD por decisão explícita do PLAN (action precisa de Supabase mock complexo + redirect-throws — verificação via test:run do schema + tsc + grep audit).

## Threat Flags

Sem novas superfícies de ataque introduzidas. T-04-02-01 (Tampering) reforçado pela mitigação no `getDraftReading` via `narrowCaptureMethod` (defesa em profundidade contra valores não-enum vindos do DB, ainda que improvável).

## User Setup Required

Nenhum — schema do banco já tem `capture_method` enum CHECK desde a Fase 1 (verificado em CONTEXT D-15 specifics: "sem migration nesta fase"). Sem env vars, sem dashboard externo.

## Next Phase Readiness

**Pronto para Wave 2-5 da Fase 4 consumir:**
- Plan 04-03 (UploadDropzone) e Plan 04-06 (new-reading-form) podem importar `CAPTURE_METHODS` e `CaptureMethod` de `@/app/actions/readings.schemas` para validação de hidden inputs.
- Plan 04-05 (upload-client + page.tsx) recebe um reading já com `capture_method='desktop_upload'` se foi criado via `createReadingAction({ method: 'desktop_upload' })` — guard no page.tsx (PATTERNS linha 102) pode confiar no método.
- Plan 04-07 (smoke test do recovery routing) pode verificar `DraftReading.capture_method` no payload de `getDraftReading` (já no contrato).
- Fase 9 (RecoveryBanner) tem o backend hook completo: `getDraftReading()` retorna `capture_method` para rotear `/upload?reading=&resume=true` vs `/capturar?reading=&resume=true`.

**Blockers / Concerns (carry-over):**
- Auditoria de licenciamento de heic2any@0.0.4 pendente (Fase 9, já registrada em STATE.md).
- Dívida pré-existente do `audit:vocabulary` (8 ocorrências em comentários técnicos da Fase 3 — registrada desde 04-01).
- Dívida pré-existente do `tsc` (2 erros em `quality-scoring.test.ts` — registrada agora em deferred-items.md).

---
*Phase: 04-upload-desktop*
*Completed: 2026-05-03*
