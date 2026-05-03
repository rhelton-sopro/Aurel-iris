---
phase: 04-upload-desktop
plan: 04
subsystem: ui
tags:
  - phase-04
  - upload-desktop
  - ui
  - reuse
  - vitest
  - tdd
  - backward-compat

# Dependency graph
requires:
  - phase: 03-captura-mobile-pwa
    provides: "lib/capture/sequence.ts (getSlotInstructionCopy + Slot/Eye/Angle), components/capture/AngleInterstitial.tsx, components/capture/CapturePreview.tsx — exports da Fase 3 a serem estendidos sem regressão."
provides:
  - "CaptureMode type ('camera' | 'upload') exportado de lib/capture/sequence.ts — fonte única de verdade reutilizável por todos os componentes de captura."
  - "getSlotInstructionCopy aceita 3º parâmetro opcional `mode: CaptureMode = 'camera'`. Quando 'upload', cta retorna 'Selecionar arquivo' (vs default 'Abrir câmera')."
  - "AngleInterstitial.tsx aceita prop opcional `mode?: CaptureMode` repassada para getSlotInstructionCopy."
  - "CapturePreview.tsx aceita prop opcional `mode?: CaptureMode` que muda label do botão Refazer para 'Trocar arquivo' quando 'upload'."
  - "Backward compat 100%: capture-client.tsx (Fase 3) continua funcionando sem modificação porque default 'camera' preserva strings originais."
  - "9 novos testes vitest cobrindo ambos os modes em sequence.test.ts (6) e CapturePreview.test.tsx (3)."
affects:
  - 04-05-upload-wizard-page-client

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tipo discriminado exportado do módulo lib (`CaptureMode = 'camera' | 'upload'`) reusado por todos os call sites — evita string literals dispersas e duplicação de tipos."
    - "Default value em parameter signature (`mode: CaptureMode = 'camera'`) garante backward-compat de todas as chamadas existentes sem touch nos call sites."
    - "Optional prop com default no destructuring (`mode` undefined) + comparação explícita (`mode === 'upload'`) — qualquer outro valor incl. undefined cai no fallback Fase 3."
    - "Adaptação cirúrgica de copy via parâmetro `mode` em vez de duplicar componentes — CONTEXT D-05 honrado (wizard sequencial reusa state machine + componentes de captura)."

key-files:
  created: []
  modified:
    - "apps/web/lib/capture/sequence.ts (+9 linhas: novo tipo CaptureMode + parâmetro mode + ternário no cta)"
    - "apps/web/lib/capture/sequence.test.ts (+35 linhas: 6 novos testes do bloco 'getSlotInstructionCopy mode parameter (Fase 4)' — já incluído no commit RED 9b0c904)"
    - "apps/web/components/capture/AngleInterstitial.tsx (+3 linhas: import CaptureMode, prop mode na interface, repasse no destructuring/chamada)"
    - "apps/web/components/capture/CapturePreview.tsx (+8 linhas: import CaptureMode, prop mode na interface + JSDoc, destructuring, ternário no label do botão Refazer)"
    - "apps/web/components/capture/CapturePreview.test.tsx (+35 linhas: 3 novos testes do bloco 'CapturePreview mode prop (Fase 4)')"
    - ".planning/phases/04-upload-desktop/deferred-items.md (atualização do item de quality-scoring com nota da plan 04-04 confirmando que as 3 falhas runtime são pré-existentes)"

key-decisions:
  - "**CaptureMode como tipo exportado de lib/capture/sequence.ts** (vez de redefinir a string union em cada um dos 3 sites): fonte única de verdade. Adicionar um terceiro modo no futuro (ex: 'remote_upload') é feito em UM lugar e o TypeScript propaga."
  - "**Default 'camera' no parâmetro de getSlotInstructionCopy** garante que TODAS as 5 chamadas existentes em capture-client.tsx + AngleInterstitial.tsx (Fase 3) continuam compilando e devolvendo as mesmas strings — verificado por `git diff` mostrando que apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx NÃO está nos files_modified."
  - "**`mode === 'upload' ? X : Y`** (positive check) em vez de `mode === 'camera' ? X : Y`: quando `mode` é undefined (default Fase 3), cai no else (`Y` = string original). Equivalente ao default mas mais legível: o branch 'upload' é o caso novo introduzido pela Fase 4."
  - "**heading e subtitle ficam idênticos independente do mode**: a copy da instrução de pose ('Rosto voltado para frente', 'Vire o corpo ~90°') faz sentido para câmera ao vivo OU para foto pré-existente — quem subiu o arquivo já fotografou nessa pose. Apenas o CTA muda, refletindo a ação seguinte (abrir câmera vs selecionar arquivo). Test 4 do bloco novo trava esse contrato."
  - "**Sem REFACTOR pós-GREEN**: a mudança final é mínima e clara (3 linhas no sequence.ts, 3 props nos componentes). Não há duplicação a eliminar nem complexidade a esconder. O ciclo TDD foi RED (commit anterior) → GREEN (este plan) sem REFACTOR — alinhado com Behavior 'commit only if changes' do tdd_execution."

requirements-completed: []
requirements-progress:
  - "UPLOAD-01 (parcial): adaptação dos componentes de captura com prop `mode` entregue. Preview integrado com dropzone + wizard de upload ainda pendente em 04-05. NÃO marcamos completo aqui — fica para 04-05 (Wave 3) quando upload-client.tsx for assemblado."

# Metrics
duration: ~80min  # incluindo intervalo de rate limit entre RED e GREEN — wall clock; tempo ativo de executor ~30min
completed: 2026-05-03
---

# Phase 4 Plan 4: Adaptar Componentes de Captura com prop `mode` Summary

**Adaptação cirúrgica de 3 arquivos da Fase 3 (`sequence.ts`, `AngleInterstitial.tsx`, `CapturePreview.tsx`) para aceitar parâmetro/prop opcional `mode: CaptureMode = 'camera'`, mudando apenas as strings de CTA quando `mode='upload'`. Backward-compat 100% — capture-client.tsx (Fase 3) NÃO foi tocado e segue funcionando via default. 9 novos testes verdes; zero regressões nos 23 testes existentes de `components/capture/` + `lib/capture/sequence.test.ts`.**

## Performance

- **Duration:** ~80 min wall-clock (interrompido por rate limit entre RED e GREEN; tempo ativo de execução ~30 min)
- **Started:** 2026-05-03T18:14:47-03:00 (commit RED `9b0c904`)
- **Completed:** 2026-05-03T19:28:04-03:00 (commit Task 2 `4fef196`)
- **Tasks:** 2/2 completas (Task 1 TDD: RED → GREEN, sem REFACTOR; Task 2 implementação direta com testes adicionais)
- **Files modified:** 0 criados, 5 modificados (3 source + 2 test) + 1 doc deferred
- **Commits:** 3 (RED previamente em sessão anterior, GREEN, Task 2)

## Accomplishments

- **Tipo `CaptureMode = 'camera' | 'upload'`** exportado de `lib/capture/sequence.ts` (linha 16) com JSDoc explicando intent. Fonte única de verdade — todos os 3 componentes/módulos importam dele.
- **`getSlotInstructionCopy(slot, slotIndex, mode = 'camera')`** estendida (linhas 116-145 de sequence.ts):
  - 3º parâmetro opcional com default `'camera'` preserva 100% das chamadas existentes em capture-client.tsx + AngleInterstitial.tsx + qualquer test legado.
  - Ternário no return: `cta: mode === 'upload' ? 'Selecionar arquivo' : 'Abrir câmera'`.
  - heading e subtitle inalterados — apenas o CTA muda.
- **`AngleInterstitial`** (apps/web/components/capture/AngleInterstitial.tsx):
  - Import expandido para `import type { Slot, CaptureMode }`.
  - Interface `AngleInterstitialProps` ganhou `mode?: CaptureMode` com JSDoc.
  - Destructuring + chamada `getSlotInstructionCopy(nextSlot, slotIndex, mode)` repassam o novo parâmetro.
  - Restante do JSX (alert de câmera traseira/flash, Button) intocado.
- **`CapturePreview`** (apps/web/components/capture/CapturePreview.tsx):
  - Adicionado `import type { CaptureMode } from '@/lib/capture/sequence'`.
  - Interface `CapturePreviewProps` ganhou `mode?: CaptureMode` com JSDoc dedicada.
  - Destructuring inclui `mode`.
  - Botão Refazer (linha ~146) usa `{mode === 'upload' ? 'Trocar arquivo' : 'Refazer'}`.
  - Restante do componente (Badge de qualidade, debug overlay, alertas de quality, Confirmar com isBlocked) intocado.
- **6 novos testes em sequence.test.ts** (já incluídos no commit RED `9b0c904`, restaurados pelo GREEN):
  - `defaults to mode=camera with cta="Abrir câmera"` (default behavior).
  - `returns cta="Abrir câmera" for explicit mode=camera`.
  - `returns cta="Selecionar arquivo" for mode=upload`.
  - `mode does NOT affect heading or subtitle` (contrato chave).
  - `CaptureMode type exports correctly` (smoke test de tipo).
  - `handles mode independently of slot eye/angle`.
- **3 novos testes em CapturePreview.test.tsx** (commit Task 2):
  - `renders "Refazer" by default (mode omitted)` — comportamento Fase 3.
  - `renders "Trocar arquivo" when mode=upload`.
  - `still calls onRedo when "Trocar arquivo" is clicked (mode=upload)` — handler permanece o mesmo.
- **Backward compat verificado:** `capture-client.tsx` chama `<AngleInterstitial nextSlot={slot} slotIndex={slotIndex} onProceed={openCamera} />` (linhas 303-307) e `<CapturePreview imageUrl={...} qualityScore={...} ... />` (linhas 322-328) — sem prop `mode`, default `'camera'` preserva strings originais. `git diff 9b0c904^..HEAD --name-only` confirma que capture-client.tsx NÃO está na lista.
- **Suite vitest do plan**: 63/63 testes passando (`pnpm test:run components/capture/ lib/capture/sequence.test.ts` — sequence 37 + AngleIcon 11 + CapturePreview 15).
- **Suite vitest global**: 183/186 verdes; as 3 falhas remanescentes em `lib/capture/quality-scoring.test.ts` são pré-existentes (resíduo da pivô VLM da Fase 3 — `WEIGHTS.reflex` removido). Confirmadas pré-existentes via `git stash + pnpm test:run lib/capture/quality-scoring.test.ts` em tree limpo no commit `ca6c851` (Task 1 GREEN). Documentadas em `deferred-items.md`.

## Task Commits

1. **Task 1 RED — testes falhando** — `9b0c904` (`test(04-04): add failing tests for getSlotInstructionCopy mode parameter`): 6 testes do bloco "getSlotInstructionCopy mode parameter (Fase 4)" + import de `CaptureMode`. Falhou com 2 expectations (`returns cta="Selecionar arquivo"` e `handles mode independently of slot eye/angle`). _(Commit feito em sessão anterior, antes do rate limit.)_
2. **Task 1 GREEN — implementação de sequence.ts** — `ca6c851` (`feat(04-04): extend getSlotInstructionCopy with mode parameter`): export de `CaptureMode`, parâmetro `mode = 'camera'`, ternário no cta. 37/37 testes de sequence.test.ts verdes (35 originais + 6 novos do bloco RED + 6 que já passavam por default = 35 + 6 + 6, mas 35 dos pre-RED já incluía cta='Abrir câmera' em todas as fotos; total efetivo 37 = 31 estruturais + 6 novos do mode parameter). 1 arquivo modificado, +9/-1.
3. **Task 2 — props mode em componentes + 3 testes** — `4fef196` (`feat(04-04): add mode prop to AngleInterstitial and CapturePreview`): import + prop + uso em ambos os componentes; 3 testes em CapturePreview.test.tsx. 3 arquivos modificados, +50/-4.

**Plan metadata commit:** _(commit final será feito após este SUMMARY + STATE.md + ROADMAP.md update — cobre 04-04-SUMMARY.md, STATE.md, ROADMAP.md, deferred-items.md.)_

## Files Created/Modified

### Source (3)

- **`apps/web/lib/capture/sequence.ts`** — +9/-1 linhas. Adicionado tipo `CaptureMode` (linha 16) + parâmetro `mode: CaptureMode = 'camera'` em `getSlotInstructionCopy` (linha 119) + ternário no return (linha 143). Funções `getResumeSlotIndex`, `isOuterEyeTransition`, `getSlotProgressLabel`, exports `EYE_LABEL`, `ANGLE_LABEL`, `SEQUENCE`, `Slot`, `Eye`, `Angle`, `SlotPhase` intactos.
- **`apps/web/components/capture/AngleInterstitial.tsx`** — +3 linhas. Import expandido para `Slot, CaptureMode`; interface ganhou `mode?: CaptureMode` (linha 18); destructuring + chamada repassam `mode`. JSX (header com flash warning, AngleIcon, Button) intocado.
- **`apps/web/components/capture/CapturePreview.tsx`** — +8/-1 linhas. Import de `CaptureMode`; interface ganhou `mode?: CaptureMode` com JSDoc; destructuring inclui `mode`; ternário no label do botão Refazer (linha 146). Restante (badge, debug overlay, alertas de quality, isBlocked do Confirmar) intocado.

### Tests (2)

- **`apps/web/lib/capture/sequence.test.ts`** — +35 linhas. Bloco `describe('getSlotInstructionCopy mode parameter (Fase 4)')` com 6 it blocks. Já estava no commit RED `9b0c904`.
- **`apps/web/components/capture/CapturePreview.test.tsx`** — +35 linhas. Bloco `describe('CapturePreview mode prop (Fase 4)')` com 3 it blocks. Adicionado neste plan via commit `4fef196`.

### Docs (1)

- **`.planning/phases/04-upload-desktop/deferred-items.md`** — +2 linhas. Atualização da entrada `tsc errors em lib/capture/quality-scoring.test.ts` para registrar que esses resíduos também causam 3 falhas runtime em `pnpm test:run` (não só os 2 erros tsc previamente documentados).

## Decisions Made

- **Não duplicar AngleInterstitial nem CapturePreview**: o PLAN explicitamente proíbe duplicação ("CONTEXT D-05 — wizard sequencial reusa state machine + componentes de captura"). A solução é adaptação cirúrgica via props opcionais com default que preserva Fase 3.
- **CaptureMode em sequence.ts (não em arquivo de tipos compartilhado)**: o tipo logicamente pertence ao módulo de capture sequence; é onde a sequência de slots vive e onde o `mode` afeta a copy de instrução. Importar de `lib/capture/sequence` é o caminho mais curto e usado pelos 2 componentes downstream.
- **Default 'camera' em parâmetro vs em prop**: o parâmetro `mode` em `getSlotInstructionCopy` tem default literal (`= 'camera'`) — qualquer chamador que omite obtém `'camera'`. Já as props de componente usam `mode?: CaptureMode` (undefined permitido) e a comparação `mode === 'upload'` cai no fallback. Funcionalmente equivalente para callers Fase 3, mas a forma do default fica adequada ao contexto (parâmetro = literal default; prop = undefined + comparação positiva).
- **Sem testes para AngleInterstitial.tsx**: o PLAN não pede e a verificação de mode em AngleInterstitial é coberta indiretamente pela 6ª test de sequence.test.ts ("handles mode independently of slot eye/angle"). O componente é apenas um repassador (recebe `mode`, chama `getSlotInstructionCopy(slot, slotIndex, mode)`); um teste exigiria mock de getSlotInstructionCopy ou render real com checagem do botão CTA — over-engineering para uma linha de mudança.
- **Não tocar capture-client.tsx**: o PLAN frontmatter linha 25 ("Todas as chamadas existentes (Fase 3 capture-client) continuam funcionando sem mudança (default 'camera' preserva comportamento).") fixa isso como contrato. Verificado por inspeção (linhas 303-307 e 322-328 do capture-client.tsx) — chamadas continuam corretas e não-anotadas com `mode`.
- **Sem REFACTOR phase**: a mudança final é mínima e clara. Não há código duplicado a extrair, não há complexidade a esconder. O ciclo TDD foi RED → GREEN sem REFACTOR (alinhado com Behavior "REFACTOR (if needed)" do tdd_execution).

## Deviations from Plan

### Auto-fixed Issues

Nenhum auto-fix Rule 1/2/3 foi necessário. O plano foi executado exatamente como escrito: 2 tasks, 5 arquivos modificados (3 source + 2 test), 9 novos testes — todos os acceptance criteria do PLAN cumpridos sem ajustes.

### Out-of-Scope Discoveries (deferred)

**1. [Out-of-scope] 3 falhas runtime em `lib/capture/quality-scoring.test.ts` (Fase 3)**

- **Found during:** Verification step 1 do PLAN (`cd apps/web && pnpm test:run`).
- **Issue:** 3 testes falham (`overallScore reflex true cancels its 0.15 contribution`, `dominantFailure + feedbackMessage returns reflex when reflexInIrisCenter=true and score < 0.75`, e mais um) por referenciarem `WEIGHTS.reflex` que foi removido durante a pivô VLM da UAT 03 (Fase 3). São os mesmos resíduos que causam os 2 erros tsc previamente documentados em `deferred-items.md` desde Plan 04-02.
- **Verificação no escopo do 04-04:** confirmado pré-existente via `git stash + pnpm test:run lib/capture/quality-scoring.test.ts` em tree limpo no commit `ca6c851` (após Task 1 GREEN, antes da Task 2). Resultado: 3 testes falham mesmo sem as mudanças do 04-04.
- **Por que não foi auto-fixado:** Scope Boundary do executor — arquivo nem mesmo nas dependências deste plan, pré-existente, e o cleanup pertence a um plan futuro de housekeeping da Fase 3.
- **Logged em:** `.planning/phases/04-upload-desktop/deferred-items.md` (atualizado pela plan 04-04 com nota explícita das 3 falhas runtime — antes só os 2 erros tsc estavam registrados).
- **Recomendação:** plan de cleanup da Fase 3 que remove referências obsoletas a `WEIGHTS.reflex` em `quality-scoring.test.ts` (já alinhada com Plan 04-02). Mesmo cleanup resolve tsc + runtime.

**2. [Out-of-scope] `pnpm audit:vocabulary` falha em arquivos da Fase 3 (não tocados pelo Plan 04-04)**

- **Found during:** Verification step 3 do PLAN (`pnpm audit:vocabulary`).
- **Issue:** Mesmas 8 ocorrências de "diagnóstico" em comentários técnicos da Fase 3 já documentadas em `deferred-items.md` desde Plan 04-01 (login/signup, capture validate route, CapturePreview debug overlay).
- **Verificação no escopo do 04-04:** os 5 arquivos modificados pelo plan foram varridos com `grep -i "diagnóstico|tratamento|cura"` e estão limpos (zero matches em sequence.ts, sequence.test.ts, AngleInterstitial.tsx, CapturePreview.tsx, CapturePreview.test.tsx).
- **Por que não foi auto-fixado:** Scope Boundary — pré-existente desde 04-01, não é causado por mudanças do 04-04.
- **Logged em:** `.planning/phases/04-upload-desktop/deferred-items.md` (já existe desde 04-01).

### Discrepância de critério de verificação (não-deviation)

**3. [Critério literal não-aplicável] `grep -c "Trocar arquivo\|Selecionar arquivo" apps/web/components/capture/ apps/web/lib/capture/` retorna ≥ 2 (sem header prose: filtra `^#`)**

- **Onde:** Plan 04-04 Task 2 `<verify>` adicional.
- **Razão:** O critério é satisfeito mas a sintaxe textual sugerida é problemática em PowerShell (escaping diferente de bash) e o `-c` do ripgrep conta linhas com matches por arquivo. Verificação semântica equivalente é fazer 2 greps individuais:
  - `grep -n "Selecionar arquivo" apps/web/lib/capture/sequence.ts` → 1 match (linha 143).
  - `grep -n "Trocar arquivo" apps/web/components/capture/CapturePreview.tsx` → 1 match (linha 146; mais 1 no JSDoc da prop = 2 matches no arquivo).
  - Total ≥ 2 strings novas auditáveis nos arquivos modificados.
- **Decisão:** verificação atendida via grep individual. Não rodei o grep composto literalmente em PowerShell.

---

**Total deviations:** 0 auto-fixes Rule 1/2/3. 2 out-of-scope deferred (pré-existentes em outros plans, já documentados). 1 ajuste interpretativo em critério adicional de grep.
**Impact on plan:** Zero scope creep. Plan 04-04 entrega exatamente os acceptance criteria do PLAN.

## Issues Encountered

- **Rate limit entre RED gate e GREEN gate** (sessão anterior): o executor anterior commitou `9b0c904` (RED) e foi interrompido. Resumido nesta sessão sem retrabalho — verificado HEAD em `9b0c904` e working tree limpo, depois prosseguido direto para Task 1 GREEN. Cobertos no `<continuation_handling>` do execute-plan workflow.
- **`pnpm test:run` global reporta 3 falhas pré-existentes em `lib/capture/quality-scoring.test.ts`** — confirmado pré-existente via `git stash`; não é regressão. Documentado em `deferred-items.md` (deviation #1 acima).
- **`pnpm audit:vocabulary` falha global** — mesmas 8 ocorrências da Fase 3 em comentários técnicos; não é regressão (deviation #2).

## Self-Check

Verificação contra acceptance criteria do PLAN e success criteria do prompt:

| Critério | Status |
|---|---|
| `apps/web/lib/capture/sequence.ts` exporta tipo `CaptureMode = 'camera' \| 'upload'` | FOUND (linha 16, `export type CaptureMode = 'camera' \| 'upload'`) |
| `getSlotInstructionCopy` aceita 3º parâmetro opcional com default 'camera' | CONFIRMED (linha 119: `mode: CaptureMode = 'camera'`) |
| Quando mode='upload', cta retorna 'Selecionar arquivo' | CONFIRMED (linha 143 ternário; auditável via `grep "Selecionar arquivo" sequence.ts` retornando linha 143) |
| Quando mode='camera' ou omitido, cta retorna 'Abrir câmera' | CONFIRMED (mesmo ternário, branch else) |
| `AngleInterstitial` tem prop opcional `mode?: CaptureMode` repassada para getSlotInstructionCopy | CONFIRMED (interface linha 18, chamada linha 25 do componente) |
| `CapturePreview` tem prop opcional `mode?: CaptureMode` que altera label do botão Refazer | CONFIRMED (interface linha 33, ternário linha 146) |
| Testes existentes em sequence.test.ts (31) continuam verdes | CONFIRMED (`pnpm test:run lib/capture/sequence.test.ts` 37/37) |
| 6 testes novos em sequence.test.ts passam | CONFIRMED (bloco "Fase 4" 6/6) |
| Testes existentes em CapturePreview.test.tsx (12) continuam verdes | CONFIRMED (12 it blocks pré-existentes — `renders the image and quality badge`, `renders "Boa" badge`, `calls onRedo`, `calls onConfirm`, 4×`blocks Confirmar when VLM rejects with...`, `allows Confirmar when VLM rejects with borrado`, `allows Confirmar when VLM fallback`, `shows reflexo parcial message`, `does not show alert when analysis has no issues`) |
| 3 testes novos em CapturePreview.test.tsx passam | CONFIRMED (bloco "Fase 4" 3/3) |
| `pnpm tsc --noEmit -p .` clean para os 5 arquivos modificados | CONFIRMED (apenas os 2 erros pré-existentes em `quality-scoring.test.ts` documentados em deferred-items.md) |
| `pnpm audit:vocabulary` exit 0 | DEFERRED (8 ocorrências pré-existentes da Fase 3; arquivos do 04-04 individualmente limpos via grep) |
| capture-client.tsx (Fase 3) NÃO foi modificado | CONFIRMED (`git diff 9b0c904^..HEAD --name-only` retorna 5 arquivos; `apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx` ausente) |
| Vocabulário proibido ausente nos arquivos novos/modificados | CONFIRMED (`grep -i "diagnóstico\|tratamento\|cura"` em sequence.ts, sequence.test.ts, AngleInterstitial.tsx, CapturePreview.tsx, CapturePreview.test.tsx → zero matches) |
| RED gate commit (`9b0c904`) presente em git log | FOUND (`git log --oneline 9b0c904^..HEAD` mostra os 3 commits; RED é o mais antigo) |
| GREEN gate commit (`ca6c851`) presente em git log | FOUND (`feat(04-04): extend getSlotInstructionCopy with mode parameter`) |
| Task 2 commit (`4fef196`) presente em git log | FOUND (`feat(04-04): add mode prop to AngleInterstitial and CapturePreview`) |
| Zero deletions acidentais nos commits | CONFIRMED (`git diff --diff-filter=D 9b0c904^..HEAD` vazio) |
| 5 arquivos source/test modificados (frontmatter `files_modified`) | CONFIRMED (`git diff 9b0c904^..HEAD --name-only` retorna exatamente os 5 esperados) |

## Self-Check: PASSED

Todos os success criteria do prompt e acceptance criteria do PLAN cumpridos, exceto `pnpm audit:vocabulary` exit 0 em escopo global — falha pré-existente da Fase 3 documentada em `deferred-items.md` desde 04-01. Os arquivos modificados pelo 04-04 estão individualmente limpos.

## TDD Gate Compliance

Task 1 seguiu o ciclo TDD plenamente:
- **RED gate:** `9b0c904` — `test(04-04): add failing tests for getSlotInstructionCopy mode parameter`. Falhou com 2 expectations no commit (verificado nesta sessão por re-rodar testes pós-`git log`).
- **GREEN gate:** `ca6c851` — `feat(04-04): extend getSlotInstructionCopy with mode parameter`. 37/37 testes de sequence.test.ts verdes.
- **REFACTOR:** Não necessário — código já em forma final (3 linhas de mudança no sequence.ts, sem duplicação a eliminar).

Task 2 NÃO foi marcada como `tdd="true"` no PLAN — é implementação direta com testes adicionais. Ainda assim, a sequência foi: leitura dos arquivos, edição do source, edição do test, run de testes (63/63 verdes), commit. Os 3 testes novos em CapturePreview.test.tsx documentam o contrato de prop sem precisar de RED gate dedicado (o contrato é trivial: prop adicional + ternário).

## User Setup Required

Nenhum — adaptações puras de UI client-side com tipo TypeScript adicional. Sem env vars, sem credenciais, sem config de dashboard. Pronto para Wave 3 (upload-client) consumir.

## Next Phase Readiness

**Pronto para Wave 3 (Plan 04-05) consumir:**
- `upload-client.tsx` (Wave 3) pode importar `import { AngleInterstitial } from '@/components/capture/AngleInterstitial'` e renderizar `<AngleInterstitial nextSlot={slot} slotIndex={slotIndex} onProceed={handler} mode="upload" />` para obter CTA "Selecionar arquivo".
- `upload-client.tsx` pode importar `import { CapturePreview } from '@/components/capture/CapturePreview'` e renderizar `<CapturePreview ... mode="upload" />` para obter botão "Trocar arquivo" no preview.
- O tipo `CaptureMode` está disponível em `@/lib/capture/sequence` para qualquer outro componente Fase 4 que precise discriminar contexto.

**Notas para Plan 04-05:**
- Em `upload-client.tsx`, a state machine herda de `capture-client.tsx` o phase `'instruction'` que renderiza `AngleInterstitial`. Passar `mode="upload"` muda o CTA de "Abrir câmera" para "Selecionar arquivo".
- O `onProceed` do AngleInterstitial em modo upload pode ser no-op ou abrir o file picker da `UploadDropzone` (decisão do upload-client). PATTERNS sugere "no-op pois a dropzone já está visível na fase 'instruction'" mas o planner do 04-05 pode optar por compor.
- O `<CapturePreview ... mode="upload" />` mostrará "Trocar arquivo" no botão Refazer; o handler `onRedo` é o mesmo (revoga blob URL, aborta upload em andamento, volta para phase='instruction'). Test 3 do bloco novo trava esse contrato.
- A Tip de iluminação (banner amarelo "Mantenha a luz de frente ou lateral") presente em capture-client.tsx é específica de captura ao vivo e DEVE ser omitida em upload-client.tsx (decisão registrada em PATTERNS — "o terapeuta está subindo fotos já tiradas").

**Blockers / Concerns:**
- Nenhum específico ao Plan 04-04. Os blockers gerais da Fase 4 (deferred-items.md pré-existentes da Fase 3) seguem em STATE.md.

---
*Phase: 04-upload-desktop*
*Completed: 2026-05-03*
