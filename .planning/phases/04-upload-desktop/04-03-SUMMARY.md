---
phase: 04-upload-desktop
plan: 03
subsystem: ui
tags:
  - phase-04
  - upload-desktop
  - ui
  - dropzone
  - a11y
  - vitest
  - tdd

# Dependency graph
requires:
  - phase: 04-upload-desktop
    plan: 01
    provides: "validateUploadFile + ACCEPTED_MIME_TYPES + HEIC_MIME_TYPES (lib/upload/validate-file.ts) — contrato consumido pelo caller do dropzone"
  - phase: 03-captura-mobile-pwa
    provides: "padrão de teste de componente (vitest jsdom + @testing-library/react) e padrão de named-export client component em apps/web/components/capture/*"
provides:
  - "UploadDropzone — componente UI puramente apresentacional para captura de UM arquivo via drag-and-drop OU click-to-pick. Caller (Wave 3 upload-client) chama validateUploadFile + convertHeicToJpeg após receber File via callback onFileAccepted."
  - "10 testes vitest cobrindo: render pt-BR, slotLabel, drop, file-picker change, drag-over state, disabled hard-block, aria-disabled, accept attribute MIMEs e extensões"
affects:
  - 04-05-upload-wizard-page-client

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Componente UI client-side com 'use client' + named export (sem default) — espelho do padrão components/capture/*.tsx"
    - "Callback-based component (onFileAccepted: (file: File) => void) — caller decide validação subsequente; defesa em camadas com lib/upload/validate-file.ts (Plan 04-01)"
    - "Suporte a teclado para a11y (Enter/Space → input.click()) + aria-disabled refletindo prop disabled + focus-visible:ring-2 (WCAG AA)"
    - "data-dragover atributo expõe estado isDragOver para asserção em testes (mais semântico que asserção de classe Tailwind)"
    - "input.onClick.stopPropagation evita loop de click→container handler→input.click()→change handler"
    - "input.value='' depois de cada change permite re-selecionar o mesmo arquivo (cenário Refazer)"

key-files:
  created:
    - "apps/web/components/upload/UploadDropzone.tsx (125 linhas)"
    - "apps/web/components/upload/UploadDropzone.test.tsx (109 linhas, 10 testes)"
  modified: []

key-decisions:
  - "Component PURO de UI: zero imports de lib/upload ou lib/capture. Validação MIME/size, conversão HEIC e VLM gate são responsabilidade do caller. Defesa em camadas — facilita teste isolado e reuso futuro."
  - "data-dragover='true|false' como vetor de teste em vez de asserção de classe Tailwind ('border-primary'). Tailwind classes podem mudar por refator de estilo sem quebrar contrato; data-attr é contrato semântico explícito."
  - "tabIndex={disabled ? -1 : 0}: quando desabilitado, o container sai do tab order (consistente com aria-disabled). Outras opções (sempre tabIndex=0 + ignorar Enter) seriam acessíveis mas mais barulhentas."
  - "Não criamos HeicConversionToast.tsx (também listado em 04-PATTERNS): a conversão HEIC fica inline no upload-client (Wave 3) via toast.loading('Convertendo HEIC...') — componente dedicado seria over-engineering para um spinner de 1 segundo."
  - "Suporte a teclado adicionado proativamente (Rule 2 - missing critical accessibility). PLAN frontmatter exige role=button + aria-label, mas componente role=button sem keyboard handler quebra a expectativa WCAG. Threat T-04-03-04 do PLAN cita esse mitigation."
  - "focus-visible:ring-2 adicionado proativamente (Rule 2). Componente keyboard-navegável precisa de focus indicator visível — usuário sem mouse não consegue rastrear posição do cursor sem ele."

requirements-completed: []
requirements-progress:
  - "UPLOAD-01 (parcial): dropzone entregue. Preview integrado com dropzone ainda pendente em 04-05. NÃO marcamos completo aqui — fica para 04-05."

# Metrics
duration: ~5min
completed: 2026-05-03
---

# Phase 4 Plan 3: UploadDropzone Component Summary

**Componente UI puramente apresentacional para captura de UM arquivo (drag-and-drop OU click-to-pick) com 10 testes vitest verdes, a11y completa (role=button, aria-disabled, aria-label, keyboard, focus-visible) e zero acoplamento com libs de validação.**

## Performance

- **Duration:** ~5 min (TDD direto, sem checkpoints)
- **Started:** 2026-05-03T17:55:00Z
- **Completed:** 2026-05-03T18:00:00Z
- **Tasks:** 1/1 completa (TDD: RED → GREEN, sem REFACTOR)
- **Files modified:** 2 criados, 0 modificados

## Accomplishments

- `UploadDropzone` componente cliente (`'use client'`) com named export, aceitando `onFileAccepted: (file: File) => void`, `disabled?: boolean`, `slotLabel?: string`.
- Dois caminhos paralelos chamam o mesmo callback:
  - **Drag-and-drop** nativo: `onDragOver` (preventDefault + setIsDragOver), `onDragLeave`, `onDrop` (e.preventDefault, file = dataTransfer.files[0], early-return em disabled).
  - **Click → file picker**: `onClick` no container dispara `inputRef.current?.click()`; `onChange` do input lê `e.target.files?.[0]`.
- `accept` attribute do input lista todos os 5 MIMEs aceitos pelo Plan 04-01 + 2 extensões fallback: `image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif`.
- A11y completa:
  - `role="button"`, `aria-label` dinâmico ("Área de upload" + slotLabel quando presente), `aria-disabled` reflete prop.
  - `tabIndex={disabled ? -1 : 0}` — desabilitado sai do tab order.
  - `onKeyDown` com early-return em disabled e handler para `Enter`/`Space` (preventDefault + click).
  - `focus-visible:ring-2 ring-primary ring-offset-2` para indicador de foco visível em navegação por teclado.
- Visual feedback:
  - `data-dragover='true|false'` no container — atributo semântico para teste.
  - Classes Tailwind alternam entre `border-primary bg-primary/5` (drag-over), `border-muted-foreground/30 hover:border-muted-foreground/60` (idle), `pointer-events-none opacity-50` (disabled).
- Defesa contra UX glitches:
  - `e.target.value = ''` no input change — permite re-selecionar mesmo arquivo após Refazer.
  - `input.onClick={(e) => e.stopPropagation()}` — evita o handler do container disparar click no input duas vezes (loop de file picker).
- Suite vitest TDD: ciclo RED (`30ff252`) → GREEN (`197dddc`) com 10/10 testes passando em 76ms.
- Zero regressão: `pnpm test:run components/capture/` 23/23 verdes (testes da Fase 3 intactos).
- Threat model T-04-03-01..04 todos mitigados ou aceitos conforme planejado:
  - T-04-03-01 (Tampering): componente delega validação ao caller (Plan 04-01 validateUploadFile).
  - T-04-03-02 (Information Disclosure): aceito (componente client-side puro, sem PII).
  - T-04-03-03 (DoS visual): handleDrop pega apenas `dataTransfer.files[0]` — drop de pasta inteira é silenciosamente truncado.
  - T-04-03-04 (Tampering a11y): keyboard handler + aria-disabled + focus-visible:ring-2.

## Task Commits

1. **Task 1 RED — testes falhando** — `30ff252` (`test(04-03): add failing tests for UploadDropzone component`): 10 cenários cobrindo render pt-BR, slotLabel, drop, file-picker change, drag-over state, disabled hard-block, aria-disabled, accept attribute. Falhou por `Failed to resolve import "./UploadDropzone"`.
2. **Task 1 GREEN — implementação** — `197dddc` (`feat(04-03): implement UploadDropzone component (drag+drop+click+a11y)`): UploadDropzone.tsx com 125 linhas; 10/10 testes verdes em 76ms.

**Plan metadata:** _(commit final ainda a ser feito após este SUMMARY + STATE.md + ROADMAP.md)_

## Files Created/Modified

- `apps/web/components/upload/UploadDropzone.tsx` (criado, 125 linhas) — componente client. Único deps de runtime: `react`, `lucide-react` (Upload icon, já no projeto), `@/lib/utils` (cn helper). Sem imports de `lib/upload/*` ou `lib/capture/*` (verificado: `grep -E "^import.*from '@/lib/(upload|capture)'" components/upload/UploadDropzone.tsx` retorna vazio).
- `apps/web/components/upload/UploadDropzone.test.tsx` (criado, 109 linhas) — 10 testes vitest. Helper `makeFile` aloca `Uint8Array(sizeBytes)` real (1 KB no default) — barato e fiel ao API do `File`.

## Decisions Made

- **Componente puramente apresentacional sem validação interna:** o PLAN diz explicitamente "Componente é PURAMENTE apresentacional: nenhuma validação de MIME ou tamanho acontece aqui (responsabilidade do caller via lib/upload/validate-file)." Mantido fielmente. Caller (Plan 04-05 upload-client) chamará `validateUploadFile(file)` + `convertHeicToJpeg(file)` antes do VLM gate. Esta arquitetura facilita reuso futuro (ex: drop de PDF de termo de consentimento na Fase 8 reusaria o componente com outro caller).
- **`data-dragover` como vetor de teste:** o template do PLAN sugere "data-state ou outline". Escolhido `data-dragover='true|false'` para clareza de teste (`expect(dropzone.dataset.dragover).toBe('true')`). É também um atributo HTML válido (`data-*` é o namespace para custom data attributes), não polui o role/aria.
- **Teste de "no dragover update when disabled"**: adicionado o 10º teste (não estava na lista do PLAN, mas o PLAN menciona behavior em `must_haves.truths` linha 25 "Quando disabled=true, dropzone tem pointer-events-none + opacity-50 e onDragOver não atualiza estado"). É explicitamente testável e documenta o branch `if (!disabled) setIsDragOver(true)`.
- **`onClick={(e) => e.stopPropagation()}` no input:** sem isso, o click no `<input type="file">` (que está hidden mas permanece no DOM) faria bubble para o handler do container, que chamaria `inputRef.current?.click()` de novo — o browser geralmente protege contra isso, mas o `stopPropagation` torna o contrato explícito.
- **`tabIndex={disabled ? -1 : 0}`** em vez de sempre `0`: desabilitado deve sair do tab order. Combina com `aria-disabled` para um contrato a11y correto. Alternativa (sempre `tabIndex=0` + ignorar Enter no handler) seria também acessível mas barulhenta para leitores de tela.
- **`focus-visible:ring-2 ring-primary ring-offset-2`** adicionado proativamente (Rule 2): componente keyboard-navegável sem focus indicator viola WCAG 2.4.7. Adicionado mesmo não estando explícito no template do PLAN.
- **HeicConversionToast NÃO criado:** apesar de listado em `04-PATTERNS.md` como "opcional, decisão de planner", a Wave 3 (upload-client) já planeja usar `toast.loading('Convertendo HEIC...', { id: 'heic-conversion' })` inline. Componente dedicado seria YAGNI até prova em contrário.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical accessibility] Suporte de teclado adicionado**
- **Found during:** Task 1 (GREEN), análise antes de escrever o componente.
- **Issue:** O template do PLAN tem `role="button"` + `tabIndex={0}` mas não inclui `onKeyDown` handler. Componente com `role="button"` e tab-stop sem responder a Enter/Space quebra contrato WCAG (4.1.2 Name/Role/Value + 2.1.1 Keyboard) e desativa o threat mitigation T-04-03-04 que o próprio PLAN registra.
- **Fix:** Adicionado `handleKeyDown` que faz early-return em `disabled` e dispara `inputRef.current?.click()` em `Enter` ou `' '` (Space). Padrão consistente com a expectativa de buttons nativos do HTML.
- **Files modified:** `apps/web/components/upload/UploadDropzone.tsx`
- **Commit:** `197dddc` (incorporado no GREEN, não commit separado).

**2. [Rule 2 - Critical accessibility] Focus indicator visível para teclado**
- **Found during:** Task 1 (GREEN), revisão a11y.
- **Issue:** Container com `cursor-pointer` é click-target desktop, mas o template do PLAN não inclui `focus-visible:ring-*`. Sem focus visible, usuário de teclado não rastreia posição do cursor — viola WCAG 2.4.7.
- **Fix:** Adicionado `focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2` ao container. `focus:outline-none` remove a outline nativa default do navegador (que costuma colidir com o border do dropzone); `focus-visible:ring-*` aplica anel apenas em foco por teclado (não em click).
- **Files modified:** `apps/web/components/upload/UploadDropzone.tsx`
- **Commit:** `197dddc`.

**3. [Rule 2 - Loop guard] input.onClick.stopPropagation**
- **Found during:** Task 1 (GREEN), implementação dos handlers.
- **Issue:** Container tem `onClick={() => !disabled && inputRef.current?.click()}` (programmatic click no input). Quando o file picker abre, o click no `<input type="file">` bubbles para o container, que dispara `inputRef.current?.click()` de novo. Browser geralmente protege contra loop, mas o contrato fica frágil.
- **Fix:** `<input ... onClick={(e) => e.stopPropagation()} />` torna explícito que o click no input não deve propagar.
- **Files modified:** `apps/web/components/upload/UploadDropzone.tsx`
- **Commit:** `197dddc`.

**4. [Rule 2 - tabIndex em disabled] tabIndex={disabled ? -1 : 0}**
- **Found during:** Task 1 (GREEN), revisão de a11y.
- **Issue:** Template do PLAN tem `tabIndex={0}` fixo. Quando `disabled=true`, container deveria sair do tab order — caso contrário, um keyboard user pressiona Tab → chega no container → pressiona Enter → handler tenta abrir file picker mesmo desabilitado. (No nosso caso, `handleKeyDown` já faz early-return em disabled, mas o tab-stop sem ação é experiência ruim.)
- **Fix:** `tabIndex={disabled ? -1 : 0}` — desabilitado sai do tab order, casando com `aria-disabled='true'`.
- **Files modified:** `apps/web/components/upload/UploadDropzone.tsx`
- **Commit:** `197dddc`.

### Out-of-Scope Discoveries (deferred)

**5. [Out-of-scope] `pnpm audit:vocabulary` falha em arquivos da Fase 3 (não tocados pelo Plan 04-03)**
- **Found during:** Task 1 verification (`pnpm audit:vocabulary`).
- **Issue:** Mesmo conjunto de 8 ocorrências documentado em `deferred-items.md` desde Plan 04-01 (login/signup pages, capture validate route, CapturePreview debug overlay). Todas em **comentários técnicos**, nenhuma em strings de UI.
- **Verificação no escopo do 04-03:** o arquivo novo `apps/web/components/upload/UploadDropzone.tsx` foi varrido com `grep -i "diagnóstico|tratamento|cura"` e está limpo (zero matches). O test file também está limpo.
- **Por que não foi auto-fixado:** Scope Boundary do executor — issues out-of-scope (pré-existentes, não causados pelas mudanças do plan corrente) ficam logados, não fixados.
- **Logged em:** `.planning/phases/04-upload-desktop/deferred-items.md` (já existe desde 04-01).
- **Recomendação:** plan de manutenção separado para substituir "diagnóstico"/"Diagnóstico" em comentários por "depuração"/"log de depuração técnica" antes do gate da Fase 9 (revisão jurídica healthtech).

**6. [Out-of-scope] 2 erros tsc em `lib/capture/quality-scoring.test.ts` (Fase 3)**
- **Found during:** Task 1 manual sanity (`pnpm tsc --noEmit -p .`).
- **Issue:** Mesmos erros TS2339 em `WEIGHTS.reflex` documentados em `deferred-items.md` desde Plan 04-02. Pré-existentes ao Plan 04-03 — verificado por `git stash + tsc` no início do 04-02.
- **Por que não foi auto-fixado:** Scope Boundary — arquivo nem mesmo nas dependências deste plan.
- **Logged em:** `.planning/phases/04-upload-desktop/deferred-items.md` (já existe desde 04-02).

### Discrepância de critério de verificação (não-deviation, ajuste de interpretação)

**7. [Critério literal] `grep -c "image/heic\\|image/heif\\|.heic\\|.heif" UploadDropzone.tsx` retorna 1, não 4.**
- **Onde:** Plan 04-03 `<verify>` adicional: "retorna pelo menos 4".
- **Razão:** `grep -c` conta **linhas com matches**, não tokens. Os 4 tokens (`image/heic`, `image/heif`, `.heic`, `.heif`) estão na **mesma linha** do `accept` attribute, então `-c` retorna 1.
- **Verificação semântica equivalente:** Test 9 do `UploadDropzone.test.tsx` faz 5 asserções `expect(accept).toContain(token)` cobrindo todos os 5 MIMEs + 2 extensões — passa. O critério "all of those tokens are in the accept attribute" é satisfeito. A redação `-c >= 4` é um artefato de planning que mediria o mesmo se cada MIME estivesse em uma linha separada.
- **Decisão:** não fragmentar o `accept` em múltiplas linhas só para satisfazer um count literal. A asserção semântica (test 9) é a fonte de verdade.

---

**Total deviations:** 4 auto-fixes Rule 2 (todas a11y/UX hardening) + 2 out-of-scope deferred (pré-existentes em outros plans) + 1 discrepância interpretativa de critério.
**Impact on plan:** Zero scope creep. Plan 04-03 entrega exatamente os acceptance criteria do PLAN, com hardening proativo de a11y proporcional ao threat T-04-03-04 que o próprio PLAN cita.

## Issues Encountered

- **`pnpm audit:vocabulary` reporta falhas pré-existentes da Fase 3** — registrado em `deferred-items.md` desde Plan 04-01 (deviation #5 acima).
- **`pnpm tsc --noEmit` reporta 2 erros pré-existentes em `lib/capture/quality-scoring.test.ts`** — registrado desde Plan 04-02 (deviation #6 acima).
- **Acceptance criteria do PLAN exige `pnpm audit:vocabulary` exit 0:** o critério é literal mas a falha é estritamente pré-existente. Os arquivos NOVOS desta plan estão limpos; a falha do tree global é dívida técnica da Fase 3 não-bloqueante para 04-03 (mesmo padrão dos plans 04-01/04-02).

## Self-Check

Verificação contra acceptance criteria do PLAN e success criteria do prompt:

| Critério | Status |
|---|---|
| `apps/web/components/upload/UploadDropzone.tsx` existe (50+ linhas) | FOUND (125 linhas) |
| `apps/web/components/upload/UploadDropzone.test.tsx` existe | FOUND (109 linhas, 10 testes) |
| Componente é `'use client'` (primeira linha) | CONFIRMED (linha 1) |
| Named export `UploadDropzone` (sem default) | CONFIRMED (`export function UploadDropzone`, linha 41; sem `export default` no arquivo) |
| Props: `onFileAccepted`, `disabled?`, `slotLabel?` | CONFIRMED (interface UploadDropzoneProps linhas 7-16) |
| `role="button"` no container | CONFIRMED (linha 96) |
| `tabIndex` no container | CONFIRMED (linha 97 — `disabled ? -1 : 0`) |
| `aria-disabled` reflete prop | CONFIRMED (linha 98) |
| `aria-label` dinâmico com slotLabel | CONFIRMED (linha 99) |
| `data-dragover` reflete state | CONFIRMED (linha 100 — `'true'\|'false'`) |
| Input file `accept` contém `image/heic` | CONFIRMED (linha 110) |
| Input file `accept` contém `image/heif` | CONFIRMED (linha 110) |
| Input file `accept` contém `image/jpeg` | CONFIRMED (linha 110) |
| Input file `accept` contém `image/png` | CONFIRMED (linha 110) |
| Input file `accept` contém `image/webp` | CONFIRMED (linha 110) |
| Input file `accept` contém `.heic` | CONFIRMED (linha 110) |
| Input file `accept` contém `.heif` | CONFIRMED (linha 110) |
| Footer mostra texto exato "JPEG · PNG · WebP · HEIC — máx. 25 MB" | CONFIRMED (linha 105) |
| Componente NÃO importa de `lib/upload/` | CONFIRMED (`grep -E "^import.*from '@/lib/(upload\|capture)'" UploadDropzone.tsx` retornou vazio, exit 1) |
| Componente NÃO importa de `lib/capture/` | CONFIRMED (mesma verificação) |
| `pnpm test:run components/upload/UploadDropzone.test.tsx` exit 0 | PASSED (10/10 testes em 76ms) |
| Todos os testes da Fase 3 ainda passam | PASSED (`pnpm test:run components/capture/` retorna 23/23 verdes) |
| `pnpm lint components/upload/` exit 0 | PASSED (zero warnings/errors) |
| Suporte de teclado (Enter/Space) | CONFIRMED (handleKeyDown linhas 76-83 + early-return em disabled) |
| Focus indicator visível (focus-visible:ring-2) | CONFIRMED (linha 87 className) |
| Sem `'diagnóstico'`, `'tratamento'`, `'cura'` em UploadDropzone.tsx ou test | CONFIRMED (`grep -i "diagnóstico\|tratamento\|cura" components/upload/` retorna zero matches) |
| Commits TDD: RED (`30ff252`) presente em git log | FOUND (`git log --oneline` mostra `30ff252 test(04-03): add failing tests for UploadDropzone component`) |
| Commits TDD: GREEN (`197dddc`) presente em git log | FOUND (`git log --oneline` mostra `197dddc feat(04-03): implement UploadDropzone component (drag+drop+click+a11y)`) |
| Zero deletions acidentais nos commits | CONFIRMED (`git diff --diff-filter=D HEAD~2 HEAD` vazio) |

## Self-Check: PASSED

Todos os success criteria do prompt e acceptance criteria do PLAN cumpridos, exceto `pnpm audit:vocabulary` exit 0 em escopo global — falha pré-existente da Fase 3 já documentada em `deferred-items.md` desde 04-01. Os arquivos novos do 04-03 passam o audit:vocabulary individualmente.

A discrepância do `grep -c` no critério adicional do `<verify>` é interpretativa (count de linhas vs count de tokens) e a verificação semântica equivalente é satisfeita pelo Test 9.

## TDD Gate Compliance

Task 1 seguiu o ciclo TDD plenamente:
- **RED gate:** `30ff252` — `test(04-03): add failing tests for UploadDropzone component`. Verificado falhar por "Failed to resolve import './UploadDropzone'".
- **GREEN gate:** `197dddc` — `feat(04-03): implement UploadDropzone component (drag+drop+click+a11y)`. Verificado passar com 10/10 testes verdes.
- **REFACTOR:** Não necessário — código já estava em sua forma final (espelha pattern de `components/capture/CapturePreview.tsx` + extensões a11y proativas).

## User Setup Required

Nenhum — componente puro de UI client-side, sem env vars, sem credenciais externas, sem configuração de dashboard. Pronto para Wave 3 (upload-client) consumir.

## Next Phase Readiness

**Pronto para Wave 3 (Plan 04-05) consumir:**
- Plan 04-05 (upload-wizard-page-client) pode importar via `import { UploadDropzone } from '@/components/upload/UploadDropzone'`.
- Pattern do callback handler em `04-PATTERNS.md` (`handleFileAccepted` async function recebendo `File` direto) está alinhado com a interface do componente.
- O `accept` attribute alinha com `validateUploadFile` (Plan 04-01): mesmo conjunto de 5 MIMEs + 2 extensões fallback.

**Notas para Plan 04-05:**
- O componente faz APENAS surface UI; não chama `validateUploadFile`. O caller (upload-client) deve invocar `validateUploadFile(file)` ANTES de qualquer outra coisa, e exibir toast de erro com `validation.error` quando `validation.ok === false`.
- HEIC: o `accept` aceita HEIC mas conversion é responsabilidade do caller. Pattern em `04-PATTERNS.md` mostra `convertHeicToJpeg(file)` dentro do `handleFileAccepted` quando `validation.needsHeicConversion === true`.
- O caller pode passar `disabled` durante o `phase='analyzing'` (state machine do upload-client) para evitar drops concorrentes durante a análise VLM.
- `slotLabel` deve receber a string de `getSlotProgressLabel(slot, slotIndex)` ou `getSlotInstructionCopy(slot, slotIndex, 'upload').heading` para mostrar "Foto 3 de 6 — Olho ESQUERDO · Frente" dentro da dropzone.

**Blockers / Concerns:**
- Nenhum específico ao Plan 04-03. Os blockers gerais da Fase 4 (deferred-items pré-existentes da Fase 3) seguem em STATE.md.

---
*Phase: 04-upload-desktop*
*Completed: 2026-05-03*
