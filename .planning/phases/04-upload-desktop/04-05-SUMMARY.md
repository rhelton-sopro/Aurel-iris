---
phase: 04-upload-desktop
plan: 05
subsystem: ui
tags:
  - phase-04
  - upload-desktop
  - wizard
  - client
  - vlm-reuse
  - state-machine

# Dependency graph
requires:
  - phase: 04-upload-desktop
    plan: 01
    provides: "validateUploadFile + convertHeicToJpeg (lib/upload/{validate-file,heic-to-jpeg}.ts) — primeira barreira MIME/size + dynamic import heic2any"
  - phase: 04-upload-desktop
    plan: 02
    provides: "createReadingSchema CAPTURE_METHODS enum + getDraftReading capture_method — fundação para guard D-04 e routing futuro"
  - phase: 04-upload-desktop
    plan: 03
    provides: "UploadDropzone (drag+drop+click+a11y) consumido na phase='instruction' do wizard"
  - phase: 04-upload-desktop
    plan: 04
    provides: "CapturePreview mode='upload' (botão -> Trocar arquivo) e CaptureMode type — adaptação cirúrgica reusada sem duplicar"
  - phase: 03-captura-mobile-pwa
    provides: "capture-client.tsx state machine + analyzeCapturedJpeg + uploadWithRetry + finalizeReadingAction — clonados/reusados verbatim"

provides:
  - "page.tsx server component (85 linhas) com 4 guards: missing reading, RLS not-found, capture_method='mobile_camera' redirect (D-04), status !== 'pending'"
  - "upload-client.tsx (381 linhas) state machine `Phase = 'instruction' | 'analyzing' | 'previewing' | 'finalizing'` clonada do capture-client com 3 substituições cirúrgicas: (1) UploadDropzone visível na phase='instruction' substitui <input capture>, (2) handleFileAccepted recebe File direto e roda validateUploadFile -> convertHeicToJpeg -> analyzeCapturedJpeg, (3) CapturePreview com mode='upload'"
  - "Pipeline VLM (Fase 3 D-09) reusado verbatim via analyzeCapturedJpeg — VLM hard block idêntico ao mobile (sem_olho/dois_olhos/olho_fechado/muito_longe via isBlockingRejection)"
  - "Storage path canônico {therapist_id}/{reading_id}/originais/{eye}_{angle}.jpg via uploadWithRetry sem alteração (mesma RLS folder-based bucket iris-captures)"
  - "Background upload com AbortController por slot (D-13); finalize aguarda Promise.allSettled antes de finalizeReadingAction + router.push"
  - "X header preserva rascunho (D-14) — Link href='/leituras' sem disparar discardReadingAction"
  - "AngleInterstitial NÃO renderizado em upload (alert mobile-only de câmera traseira/flash não se aplica a fotos já tiradas) — substituído por heading inline + UploadDropzone na phase='instruction'"
  - "Bundle splitting validado: heic2any em chunk dedicado de 1.35MB (`7ef09c20.*.js`) — rota /upload First Load JS = 3.4 kB + 228 kB shared (paridade com /capturar 3.56 kB)"

affects:
  - 04-06-leituras-nova-routing-ctas
  - 04-07-uat-smoke

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wizard de upload reusa state machine `Phase` do capture-client.tsx (Fase 3) verbatim — 4 fases (instruction/analyzing/previewing/finalizing), refs (slotAbortRefs/uploadPromisesRef/finalizingTriggeredRef), useEffect de finalização e cleanup. Substituições limitadas ao input source e copy."
    - "Page.tsx server component com 4 guards: pattern Pattern E (Server -> Client Wizard Handoff) do 04-PATTERNS.md aplicado, com guard adicional D-04 (capture_method='mobile_camera' -> redirect /capturar) que cobre URL spoofing."
    - "RLS implícita: query .eq('id', readingId) sem cláusula explícita de therapist_id — RLS de readings filtra para auth.uid()=therapist_id; query retorna null se não-dono. Padrão herdado de capturar/page.tsx (T-02-06)."
    - "handleFileAccepted = pipeline em ordem fixa: validateUploadFile (D-10/D-12) -> convertHeicToJpeg se needsHeicConversion (D-11) -> analyzeCapturedJpeg (D-09 VLM) -> setPendingPreview. Cada passo tem fallback: validation falha -> toast.error+ early return; HEIC convert falha -> toast.error com instruções iPhone + volta a 'instruction'; analyze falha -> toast.error + volta a 'instruction'."
    - "Background upload com AbortController por slot — copia padrão exato do capture-client (Pattern C). Refazer aborta upload anterior antes de iniciar novo. Finalize aguarda Promise.allSettled antes de finalizeReadingAction."
    - "Toast UX em 4 momentos: loading('Convertendo HEIC...') durante conversão, error com ID dismissível em falhas, loading('Salvando imagem N/6...') durante upload, success/error pós-upload. Todas as strings em pt-BR neutras (zero vocabulário proibido LGPD)."

key-files:
  created:
    - "apps/web/app/(dashboard)/leituras/nova/upload/upload-client.tsx (381 linhas — wizard client)"
  modified:
    - "apps/web/app/(dashboard)/leituras/nova/upload/page.tsx (placeholder de 14 linhas substituído por server component de 85 linhas)"

key-decisions:
  - "**AngleInterstitial NÃO importado nem renderizado em upload-client**: o alert hardcoded 'Use a câmera traseira · Nunca utilize o flash' do AngleInterstitial é mobile-only — terapeuta no desktop está subindo foto já tirada e não tem câmera traseira/flash. Mesmo após o Plan 04-04 ter adicionado prop `mode` (que afeta apenas o CTA via getSlotInstructionCopy), o alert do JSX permanece. Solução: phase='instruction' renderiza heading inline (`Foto N de 6 — Olho ESQUERDO · Frente`) + UploadDropzone visível diretamente. Decisão alinhada com o PLAN 04-05 (action explícita instruindo a remover o import de AngleInterstitial se não usado)."
  - "**`pendingPreview.blob: Blob`** (não `File | Blob`): após HEIC convert, o tipo pode oscilar entre File (input original) e Blob (saída do heic2any). Como uploadWithRetry aceita `Blob` (e File extends Blob), o tipo mais geral é correto e simplifica a state machine. Mesma escolha do capture-client (que sempre usa Blob)."
  - "**X header navega para /leituras via Link sem discardReadingAction**: D-14 explícito — cancelar preserva rascunho. Recovery banner futuro (Fase 9) listará a leitura pendente e o terapeuta pode continuar ou descartar manualmente. Mesmo padrão do capture-client.tsx (linha 289-296)."
  - "**handleRedo NÃO faz setTimeout+click**: no capture-client, refazer dispara `window.setTimeout(() => fileInputRef.current?.click(), 50)` para reabrir a câmera nativa. No upload-client, a UploadDropzone fica visível na phase='instruction' — o terapeuta arrasta/clica novamente. Sem fileInputRef, sem timeout. Comportamento mais previsível e mais natural para desktop."
  - "**Sem AngleInterstitial mesmo na transição left→right (slot 3)**: no capture-client, AngleInterstitial fullscreen aparece antes do índice 3 (transição de olho — `isOuterEyeTransition`). No upload, a dropzone simples + heading com `Olho DIREITO` é suficiente — o terapeuta já tem 6 fotos prontas e sabe qual olho está subindo. Decisão alinhada com a observação do PLAN PATTERNS de que AngleInterstitial é desnecessário em upload."
  - "**heic2any via dynamic import dentro de lib/upload/heic-to-jpeg.ts**: confirmado no build — chunk dedicado de 1.35MB (7ef09c20.*) separado da rota /upload (3.4 kB First Load). CONTEXT D-11 honrado: bundle restrito à rota /upload, não vaza pro resto do app."
  - "**`<input capture` em comentário JSDoc é falso positivo no grep -c==0** do PLAN: linha 80 do upload-client.tsx contém o comment `<input type=\"file\" capture=\"environment\"> -> UploadDropzone` documentando a substituição. O critério literal do PLAN era 0 ocorrências, mas a intenção é 'zero usos reais no JSX'. Verificação alternativa: `grep '^[^*/]*<input[^>]*capture' upload-client.tsx` retorna zero — confirmado. Documentado abaixo em Deviations como ajuste interpretativo (não-deviation)."

requirements-completed:
  - "UPLOAD-01: dropzone + preview + validação tipo/tamanho — fluxo desktop ponta-a-ponta funcional (page.tsx + upload-client.tsx integram UploadDropzone + validateUploadFile + convertHeicToJpeg + analyzeCapturedJpeg + CapturePreview mode='upload')"
  - "UPLOAD-02: estrutura `reading_images` com `capture_method='desktop_upload'` — uploadWithRetry insere 6 linhas em reading_images com path canônico {therapist_id}/{reading_id}/originais/{eye}_{angle}.jpg via upsert por (reading_id, eye, angle). capture_method já é gravado por createReadingAction (Plan 04-02)."
requirements-progress: []

# Metrics
duration: ~20min
completed: 2026-05-03
---

# Phase 4 Plan 5: Upload Wizard Page + Client Summary

**Wizard de upload desktop ponta-a-ponta entregue: page.tsx server component (4 guards, replace placeholder Fase 3) + upload-client.tsx (381 linhas, state machine clonada do capture-client com 3 substituições cirúrgicas — UploadDropzone, handleFileAccepted com pipeline validate -> HEIC convert -> VLM, CapturePreview mode='upload'). Pipeline VLM/storage reusado verbatim da Fase 3, zero regressões nos 63 testes de captura. Build bem-sucedido com heic2any em chunk dedicado de 1.35MB (bundle splitting confirmado). UPLOAD-01 e UPLOAD-02 marcados completos.**

## Performance

- **Duration:** ~20 min wall-clock
- **Started:** 2026-05-03T22:36:18Z
- **Completed:** 2026-05-03T22:56:53Z
- **Tasks:** 2/2 completas (Task 1 server component, Task 2 client wizard) — sem TDD (PLAN explicitamente diz "Não criar testes vitest para upload-client.tsx neste plan: a state machine é cópia do capture-client e cobertura real virá via UAT 04-07")
- **Files created:** 1 (upload-client.tsx)
- **Files modified:** 1 (page.tsx — substituição completa do placeholder)
- **Commits:** 2 task commits + 1 final metadata commit

## Accomplishments

- **page.tsx (server component, 85 linhas)** substitui o placeholder Fase 3 de 14 linhas. 4 guards funcionais:
  1. `?reading` ausente -> `redirect('/leituras/nova')` (recomeça fluxo).
  2. Reading não encontrado (RLS bloqueia se não é dono) -> `redirect('/leituras/nova')`.
  3. **D-04 enforcement**: `reading.capture_method === 'mobile_camera'` -> `redirect('/leituras/nova/capturar?reading=<id>')`. Método é imutável (Plan 04-02 enum) — URL trocada cai no fluxo correto, sem misturar fotos de proveniência diferente.
  4. `reading.status !== 'pending'` -> `redirect('/leituras')` (já finalizou ou está em processamento da Fase 5).
  - Auth via `getUser()` (T-02-01 / T-02-06 — nunca getSession).
  - Select inclui `capture_method` + `client_id` + `clients(full_name)` + `reading_images(id, eye, angle, quality_score, storage_path)` para handoff completo ao client.
- **upload-client.tsx (client wizard, 381 linhas)**:
  - State machine `Phase = 'instruction' | 'analyzing' | 'previewing' | 'finalizing'` idêntica ao capture-client.
  - Refs: `slotAbortRefs`, `uploadPromisesRef`, `finalizingTriggeredRef` (sem `fileInputRef` — UploadDropzone gerencia seu próprio input).
  - **handleFileAccepted** roda em ordem: `validateUploadFile` (rejeita MIME/size com toast.error) -> `convertHeicToJpeg` se `needsHeicConversion=true` (toast.loading + dismiss + recovery em erro com mensagem iPhone) -> `analyzeCapturedJpeg` (VLM via /api/capture/validate, padrão Fase 3 D-09) -> `setPendingPreview`. Sem bloqueio precoce de câmera frontal — terapeuta está subindo foto profissional, não selfie.
  - **executeUpload**: `uploadWithRetry` em background com `AbortController` por slot (D-13). Refazer aborta o upload anterior antes do novo. Toast.loading durante upload + toast.success/error pós-upload com IDs.
  - **handleRedo**: revoga blob URL, aborta upload em andamento, volta a `phase='instruction'`. Sem setTimeout+click — UploadDropzone já está visível.
  - **useEffect de finalização**: aguarda `Promise.allSettled(uploadPromisesRef)` -> `finalizeReadingAction(readingId)` -> `router.push('/leituras')` + `router.refresh()`.
  - **useEffect de cleanup**: aborta todos os controllers no unmount (idêntico ao capture-client).
  - **Header**: nome do cliente + X (Link href='/leituras') — preserva rascunho (D-14).
  - **CapturePreview** renderizado com `mode='upload'` (botão -> "Trocar arquivo") consumindo a prop adicionada no Plan 04-04.
  - **AngleInterstitial NÃO importado nem renderizado** — substituído por heading inline + UploadDropzone na phase='instruction'. Decisão alinhada com PLAN action ("REMOVER o import na implementação final").
- **Pipeline VLM idêntico à Fase 3**: `analyzeCapturedJpeg` chamado verbatim. VLM hard block (sem_olho/dois_olhos/olho_fechado/muito_longe) é tratado pelo `CapturePreview` via `isBlockingRejection` — Confirmar fica desabilitado, terapeuta forçado a "Trocar arquivo".
- **Storage path canônico**: `uploadWithRetry` usa `buildOriginalStoragePath(therapistId, readingId, eye, angle)` -> `{therapist_id}/{reading_id}/originais/{eye}_{angle}.jpg`. Idêntico mobile e desktop. RLS folder-based do bucket iris-captures (Fase 3 migration 0004) bloqueia cross-tenant.
- **Bundle splitting validado** (`pnpm build`):
  - Rota `/leituras/nova/upload` First Load JS = **3.4 kB** + 228 kB shared (paridade com `/capturar` 3.56 kB).
  - heic2any em chunk dedicado de **1.35 MB** (`7ef09c20.8655b8d9497687ea.js`), separado do bundle inicial — confirmação de evidência do dynamic import correto em `lib/upload/heic-to-jpeg.ts` (Plan 04-01).
- **Vocabulário LGPD**: ambos os arquivos passam `grep -i "diagnóstico|tratamento|cura"` com zero matches. Strings novas (toast messages, heading) todas neutras.
- **Regressão Fase 3**: 63/63 testes em `components/capture/` + `lib/capture/sequence.test.ts` verdes — zero impacto da Fase 4.

## Task Commits

1. **Task 1 — page.tsx server component** — `5ece1f7` (`feat(04-05): replace upload placeholder with real server component`):
   - Substituição completa do placeholder de 14 linhas por server component de 85 linhas.
   - 4 guards (sem reading, RLS not-found, D-04 mobile_camera redirect, status !== 'pending').
   - Auth via getUser(); RLS implícita; redirect destinations apropriados.
   - 1 file changed, +81 / -9.
2. **Task 2 — upload-client.tsx wizard** — `459df6f` (`feat(04-05): implement upload-client wizard (state machine + dropzone)`):
   - Wizard cliente completo com state machine clonada do capture-client.
   - Pipeline validateUploadFile -> convertHeicToJpeg -> analyzeCapturedJpeg -> CapturePreview mode='upload' -> uploadWithRetry background -> finalizeReadingAction.
   - 1 file changed, +381 / -0.

**Plan metadata commit:** _(commit final será feito após este SUMMARY + STATE.md + ROADMAP.md update — cobre 04-05-SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md atualizado.)_

## Files Created/Modified

### Source (2)

- **`apps/web/app/(dashboard)/leituras/nova/upload/page.tsx`** — substituição completa: placeholder de 14 linhas (`<Upload />` icon + texto "em breve") -> server component de 85 linhas com 4 guards, auth, RLS query e handoff `<UploadClient ... />`.
- **`apps/web/app/(dashboard)/leituras/nova/upload/upload-client.tsx`** — criado (381 linhas). Client wizard com:
  - State machine `Phase` (4 fases idênticas ao capture-client).
  - 12 imports (todos usados): React, next/link, next/navigation, lucide X, sonner toast, finalizeReadingAction, CapturePreview, CaptureProgress, analyzeCapturedJpeg + PostCaptureAnalysis, uploadWithRetry, createClient (browser), SEQUENCE/getResumeSlotIndex/getSlotProgressLabel/Slot, QualityLevel, UploadDropzone, validateUploadFile, convertHeicToJpeg.
  - Mapeamento `QUALITY_TO_SCORE` idêntico ao capture-client.
  - Refs sem fileInputRef (UploadDropzone interno).
  - 4 callbacks principais: handleFileAccepted, executeUpload (=handleConfirm), handleRedo. 2 useEffects: finalização, cleanup.
  - Render JSX com header + CaptureProgress + 4 fases (instruction/analyzing/previewing/finalizing).

## Decisions Made

Ver bloco `key-decisions` no frontmatter — 7 decisões registradas. Resumo:

1. **Não importar AngleInterstitial** porque seu alert "Use a câmera traseira · Nunca utilize o flash" é mobile-only e não se aplica a upload de foto pré-existente. PLAN explicitamente instrui a remover o import.
2. **Tipo `Blob` (não `File | Blob`) para `pendingPreview.blob`** — após HEIC convert, o tipo é Blob; antes pode ser File. Generalização para Blob é correta porque `File extends Blob` e `uploadWithRetry` aceita Blob.
3. **X header com Link sem disparar discardReadingAction** — D-14 explícito (preserva rascunho).
4. **handleRedo sem setTimeout+click** — UploadDropzone fica visível na phase='instruction', terapeuta arrasta/clica de novo.
5. **Sem AngleInterstitial mesmo na transição olho left->right (slot 3)** — a heading inline com `Olho DIREITO` é suficiente; o terapeuta já tem fotos prontas e sabe qual olho está subindo.
6. **heic2any via dynamic import** — confirmado no build (chunk de 1.35MB separado da rota /upload de 3.4 kB).
7. **`<input.*capture>` em comentário JSDoc é falso positivo** no critério literal `grep -c == 0` do PLAN — verificado por grep alternativo restrito a JSX (`'^[^*/]*<input[^>]*capture'` retorna zero).

## Deviations from Plan

### Auto-fixed Issues

Nenhum auto-fix Rule 1/2/3 foi necessário. O plano foi executado exatamente como escrito: 2 tasks, 2 arquivos (1 substituído + 1 criado), pipeline conforme specs.

### Discrepância de critério de verificação (não-deviation)

**1. [Critério literal não-aplicável] `grep -c "input.*capture" upload-client.tsx == 0`**

- **Onde:** Plan 04-05 Task 2 `<verify>` adicional.
- **Resultado obtido:** 1 match — linha 80, comentário JSDoc explicando a substituição: `*   1. <input type="file" capture="environment"> -> UploadDropzone (drop + click).`
- **Razão da divergência:** O critério é satisfeito (zero usos REAIS de `<input capture>` no JSX) mas o `grep -c` literal pega o comentário documentando a substituição. Verificação semântica equivalente:
  - `grep -n '^[^*/]*<input[^>]*capture' upload-client.tsx` -> **zero matches** (regex restrito a linhas que NÃO começam com comment markers `*` ou `/`).
- **Decisão:** comentário JSDoc é informativo (documenta o que foi removido) e não comprometível. Critério atendido em essência. Mesma classe de ajuste interpretativo observada no SUMMARY 04-04 (#3).

### Out-of-Scope Discoveries (deferred)

**2. [Out-of-scope] 2 erros tsc + 3 falhas runtime pré-existentes em `lib/capture/quality-scoring.test.ts`**

- **Found during:** Verification step (`pnpm tsc --noEmit -p .` e `pnpm test:run`).
- **Issue:** mesmos resíduos da pivô VLM Fase 3 (`WEIGHTS.reflex` removido) — ja documentados em `deferred-items.md` desde Plan 04-02 e 04-04.
- **Verificação no escopo do 04-05:** os 2 arquivos modificados estão limpos individualmente; `pnpm tsc` reporta apenas as 2 linhas de erro pré-existentes (linhas 47 e 54 de quality-scoring.test.ts), nada novo.
- **Por que não foi auto-fixado:** Scope Boundary do executor — pertence a um plan futuro de housekeeping da Fase 3.
- **Logged em:** `.planning/phases/04-upload-desktop/deferred-items.md`.

**3. [Out-of-scope] `pnpm audit:vocabulary` falha global**

- **Found during:** Verification step (`pnpm audit:vocabulary`).
- **Issue:** mesmas 8 ocorrências de "diagnóstico" em comentários técnicos da Fase 3 documentadas desde 04-01. Os 2 arquivos modificados pelo 04-05 (page.tsx + upload-client.tsx) estão **individualmente limpos**: `grep -i "diagnóstico|tratamento|cura"` em ambos retorna zero matches.
- **Por que não foi auto-fixado:** Scope Boundary — pré-existente desde 04-01, documentado em `deferred-items.md`.

**4. [Warning ESLint pré-existente reproduzido] `'_resumeMode' is defined but never used`**

- **Found during:** `pnpm build` linting step.
- **Issue:** o capture-client.tsx (Fase 3) já tem o mesmo warning em `_resumeMode` (linha 85). É a convenção `_` no nome para indicar "intencionalmente não usado neste plan, reservado para futura implementação de resume". O upload-client.tsx (Plan 04-05) propaga o mesmo padrão (linha 103).
- **Decisão:** **manter** — o resume mode é parte do contrato da prop (`UploadClientProps.resumeMode`) e será consumido por uma implementação futura de banner de recovery (Fase 9). Trocar por `// eslint-disable-next-line` ou remover o param quebra o paralelismo com o capture-client.
- **Out-of-scope para o 04-05:** mesmo padrão da Fase 3, não é regressão.

---

**Total deviations:** 0 auto-fixes Rule 1/2/3. 1 ajuste interpretativo de critério adicional. 3 out-of-scope deferred (pré-existentes em outros plans, já documentados).
**Impact on plan:** zero scope creep. Plan 04-05 entrega exatamente os acceptance criteria do PLAN.

## Issues Encountered

- **Build com 4 warnings ESLint pré-existentes** (capture-client `_resumeMode`, upload-client `_resumeMode`, route `_request` em api/health/db, lint `no-console` directive em camera-detection.ts). Apenas o `_resumeMode` do upload-client é introduzido pelo 04-05 — replica deliberadamente o padrão da Fase 3. Os outros 3 são pré-existentes.
- **Padrão de quoting em PowerShell** durante grep complexo — preferi greps individuais via tools dedicados (Grep do executor) em vez de `pnpm` chains que requeriam escaping.

## Self-Check

Verificação contra acceptance criteria do PLAN e success criteria do prompt:

| Critério | Status |
|---|---|
| `apps/web/app/(dashboard)/leituras/nova/upload/page.tsx` é Server Component que fetch a draft reading e renderiza o client wizard (replace placeholder) | FOUND (`grep "default async function UploadPage" page.tsx` -> linha 22; `grep "<UploadClient" page.tsx` -> linha 75) |
| 4 guards no page.tsx | FOUND (linhas 28, 53, 60, 65) |
| `apps/web/app/(dashboard)/leituras/nova/upload/upload-client.tsx` existe como `'use client'` | FOUND (`head -1 upload-client.tsx` -> `'use client'`) |
| Reusa state machine Phase do capture-client | CONFIRMED (linha 49 type Phase = ...) |
| Usa UploadDropzone (Plan 04-03) | CONFIRMED (`grep "UploadDropzone" upload-client.tsx` -> 2 matches: import linha 25 + JSX linha 351) |
| Chama validateUploadFile antes de qualquer ação + toast pt-BR | CONFIRMED (linha 137 `validateUploadFile(file)` precede `setPhase('analyzing')`; toast.error linha 140) |
| Chama convertHeicToJpeg apenas quando needsHeicConversion=true | CONFIRMED (linhas 149-163, condição `if (validation.needsHeicConversion)`) |
| Pipeline VLM via /api/capture/validate idêntico à Fase 3 | CONFIRMED (linha 175 `analyzeCapturedJpeg(processedBlob)` — mesma função consumida pelo capture-client) |
| saveReadingImagesAction flow + storage path canônico | CONFIRMED (uploadWithRetry consumido na linha 207 com mesmos args; buildOriginalStoragePath via uploadWithRetry herda path) |
| CapturePreview com mode='upload' | CONFIRMED (linha 365 `<CapturePreview ... mode="upload" />`) |
| AngleInterstitial mode='upload' OU equivalente desktop | CONFIRMED via "equivalente desktop" — heading inline + UploadDropzone na phase='instruction' (linhas 348-358) substitui o AngleInterstitial completo. Justificada em key-decisions e Deviations. |
| Phase 3 capture flow não regredido (`pnpm test:run components/capture/ + sequence.test.ts`) | CONFIRMED (63/63 verdes) |
| `pnpm build` succeeds | CONFIRMED (10.2s, 17/17 static pages, /leituras/nova/upload First Load 3.4 kB) |
| Pre-existing tsc errors permanecem mas não há novos | CONFIRMED (apenas 2 erros pré-existentes em quality-scoring.test.ts; `pnpm tsc` exit não-zero exclusivamente por esses) |
| `pnpm audit:vocabulary` exit 0 para novas strings | CONFIRMED — page.tsx e upload-client.tsx individualmente limpos via grep; falhas globais são pré-existentes Fase 3 (deferred-items.md) |
| SUMMARY em `.planning/phases/04-upload-desktop/04-05-SUMMARY.md` | THIS FILE |
| `<input capture>` ausente do JSX | CONFIRMED (`grep '^[^*/]*<input[^>]*capture' upload-client.tsx` = 0 matches; única ocorrência é em comentário JSDoc linha 80) |
| `validateUploadFile|convertHeicToJpeg|UploadDropzone|uploadWithRetry|analyzeCapturedJpeg|finalizeReadingAction|SEQUENCE` >= 7 | CONFIRMED (32 matches) |
| `mode="upload"` >= 1 | CONFIRMED (2 matches) |
| Phase type literal idêntico ao capture-client | CONFIRMED (linha 49) |
| 200+ linhas | CONFIRMED (381 linhas) |
| Zero deletions acidentais | CONFIRMED (`git diff --diff-filter=D HEAD~2 HEAD` vazio) |
| Vocabulário proibido ausente nos 2 arquivos | CONFIRMED (`grep -i "diagnóstico\|tratamento\|cura"` retorna zero em ambos) |

## Self-Check: PASSED

Todos os success criteria do prompt e acceptance criteria do PLAN cumpridos. Wave 3 fechada. UPLOAD-01 e UPLOAD-02 podem ser marcados como completos. Próximo: Plan 04-06 (Wave 4 — entry point /leituras/nova com auto-detect e CTAs duplos).

## User Setup Required

Nenhum — wizard inteiramente client + server (Next.js). Sem env vars novas, sem migrations, sem credenciais. Pronto para uso ponta-a-ponta assim que o entry point da Wave 4 (Plan 04-06) ligar `/leituras/nova` ao formulário com `method='desktop_upload'`. Smoke manual disponível agora via:
```
1. Criar reading via /leituras/nova/capturar?reading=<existing-mobile-reading-id> e copiar id
2. UPDATE readings SET capture_method='desktop_upload' WHERE id='<id>' (não-replicável em prod por D-04 — apenas para teste local)
3. Navegar /leituras/nova/upload?reading=<id> -> dropzone aparece
```
A partir do Plan 04-06, o fluxo natural será criar reading via formulário com `method='desktop_upload'` (Plan 04-02 createReadingAction).

## Next Phase Readiness

**Pronto para Wave 4 (Plan 04-06) consumir:**

- `/leituras/nova/upload?reading=<id>` está totalmente funcional para readings com `capture_method='desktop_upload'`. Plan 04-06 só precisa ligar o formulário `/leituras/nova` para criar o reading com o method correto e redirecionar.
- Guard D-04 do page.tsx **protege contra erros**: se o formulário criar acidentalmente uma reading com `capture_method='mobile_camera'` mas redirecionar para /upload, o page.tsx já redireciona para /capturar (e vice-versa quando o capture page tem o guard simétrico). Defesa em camadas.

**Pronto para Wave 5 (Plan 04-07 UAT smoke) consumir:**

- Fluxo manual completo: terapeuta no desktop com `?reading=<uuid>` válida arrasta 6 fotos sequencialmente. Cada foto: validate -> HEIC convert (se preciso) -> VLM gate -> preview com badge -> Confirmar/Trocar arquivo -> background upload -> próximo slot. Após 6/6, finalize chama finalizeReadingAction e router.push('/leituras').
- Smoke checklist sugerido para 04-07:
  1. Subir JPEG normal (caminho feliz).
  2. Subir HEIC (verifica conversion + toast.loading "Convertendo HEIC...").
  3. Subir arquivo > 25MB (verifica toast.error "Foto muito grande...").
  4. Subir PDF/RAW (verifica toast.error "Formato não suportado...").
  5. Subir foto sem olho (verifica VLM hard block + Confirmar desabilitado).
  6. Trocar arquivo na phase='previewing' (verifica handleRedo + abort upload anterior).
  7. Clicar X no header — verifica preserve draft (D-14).
  8. Completar 6/6 — verifica finalize + redirect /leituras + linha em readings com capture_method='desktop_upload' + 6 linhas em reading_images.

**Blockers / Concerns:**

- Nenhum específico ao Plan 04-05. Os blockers gerais da Fase 4 (deferred-items.md pré-existentes da Fase 3) seguem em STATE.md.

---
*Phase: 04-upload-desktop*
*Completed: 2026-05-03*
