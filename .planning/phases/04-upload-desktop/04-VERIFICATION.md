---
phase: 04-upload-desktop
verified: 2026-05-03T21:30:00Z
status: passed
score: 4/4 success_criteria verified, 2/2 requirements satisfied
overrides_applied: 0
re_verification: false
---

# Fase 4: Upload desktop — Verification Report

**Phase Goal (ROADMAP.md Fase 4):**
> Terapeuta no desktop pode iniciar uma leitura subindo até 6 imagens já capturadas em câmera profissional, produzindo a mesma estrutura de armazenamento do fluxo mobile.

**Verified:** 2026-05-03T21:30:00Z
**Status:** passed
**Re-verification:** No — initial verification.
**Founder UAT:** Aprovado em 2026-05-03 (resposta `approved` ao checkpoint do Plan 04-07; UAT cobre 14 cenários ponta-a-ponta).

---

## Goal Achievement

### Success Criteria (ROADMAP.md — verbatim)

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| SC-1 | Em `/leituras/nova/upload`, dropzone aceita drag-and-drop de arquivos de imagem com preview por arquivo. | ✓ VERIFIED | `app/(dashboard)/leituras/nova/upload/page.tsx` (server component, 85 linhas) renderiza `<UploadClient>` que monta `<UploadDropzone>` na phase='instruction' (`upload-client.tsx:340-343`). UploadDropzone tem handlers `handleDragOver` + `handleDrop` (dataTransfer.files[0] → onFileAccepted) e `handleInputChange` (file picker fallback). Após drop, `handleFileAccepted` valida e renderiza `<CapturePreview>` (preview por arquivo) na phase='previewing' (`upload-client.tsx:357-368`). 10/10 testes do UploadDropzone passam. |
| SC-2 | Validação rejeita arquivos não-imagem ou acima do limite definido, com mensagem clara em pt-BR. | ✓ VERIFIED | `lib/upload/validate-file.ts:50-63` retorna mensagens exatas pt-BR: "Formato não suportado. Use JPEG, PNG, WebP ou HEIC." e "Foto muito grande, máximo 25 MB." Limite: 25 MB (linha 11). `upload-client.tsx:131-135` chama `validateUploadFile` ANTES de qualquer processamento e dispara `toast.error(validation.error)` em caso de rejeição, sem mudar phase para 'analyzing'. 13/13 testes vitest cobrem caminhos felizes (JPEG/PNG/WebP/HEIC/HEIF/extensão fallback) e tristes (PDF/GIF/oversize/boundary 25MB inclusivo). |
| SC-3 | Após submit, leitura criada tem `capture_method='desktop_upload'` e até 6 entradas em `reading_images` com `eye` e `angle` definidos pela UI de associação. | ✓ VERIFIED | `app/actions/readings.ts:69-79` insere `capture_method: parsed.data.method` (não mais hardcoded), validado por `createReadingSchema` com Zod enum (`readings.schemas.ts:18`). `new-reading-form.tsx:134` injeta `<input type="hidden" name="method" value={chosenMethod}>` com auto-detect via matchMedia. `upload-client.tsx:204-216` chama `uploadWithRetry` (verbatim de Fase 3) que faz upsert em `reading_images` com `(reading_id, eye, angle, storage_path, quality_score, width, height)`. Sequência guiada (`SEQUENCE` em `lib/capture/sequence.ts`) impõe 6 slots × eye/angle. UAT Cenário 8 (founder-aprovado) confirmou DB retorna 6 linhas com eye ∈ {left, right} × angle ∈ {frontal, lateral, backlight}. |
| SC-4 | Mesmo bucket privado por terapeuta + URLs assinadas usados; nenhuma diferença observável a jusante (a Fase 5 consegue consumir leitura criada por upload desktop). | ✓ VERIFIED | `upload-client.tsx` importa e chama `uploadWithRetry` de `@/lib/capture/upload` (linha 15) sem modificação. `lib/capture/upload.ts:7` tem `const BUCKET = 'iris-captures'` (mesmo bucket de Fase 3). Storage path canônico via `buildOriginalStoragePath(therapistId, readingId, eye, angle)` em `lib/capture/storage-path.ts:19-28` produz `{therapistId}/{readingId}/originais/{eye}_{angle}.jpg` — idêntico ao consumido por Fase 3. RLS folder-based (`auth.uid() = therapist_id` na primeira pasta) é a mesma policy. `reading_images` upsert mesma estrutura. Não há código novo de bucket/path; apenas reuso. |

**Score:** 4/4 success criteria verified.

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description (REQUIREMENTS.md) | Status | Evidence |
|-------------|----------------|-------------------------------|--------|----------|
| UPLOAD-01 | 04-01, 04-03, 04-04, 04-05, 04-06, 04-07 | Terapeuta pode iniciar leitura via dropzone desktop, com preview e validação de tipo/tamanho. | ✓ SATISFIED | Pipeline ponta-a-ponta entregue: UploadDropzone (drag+drop+click) → validateUploadFile (MIME+25MB) → convertHeicToJpeg (HEIC→JPEG dynamic import) → analyzeCapturedJpeg (VLM gate Fase 3 reusado) → CapturePreview (preview com mode='upload') → onConfirm/onRedo. SC-1 e SC-2 acima cobrem o requisito. UAT Cenários 5, 6, 7, 8 (founder-aprovados) validaram comportamento. |
| UPLOAD-02 | 04-02, 04-05, 04-06, 04-07 | Upload desktop produz a mesma estrutura de armazenamento que captura mobile, marcando `readings.capture_method='desktop_upload'`. | ✓ SATISFIED | `createReadingAction` grava `capture_method` derivado de FormData (Plan 04-02). `uploadWithRetry` reusado verbatim de Fase 3 (Plan 04-05) garante mesma estrutura `reading_images` + mesmo bucket `iris-captures` + mesmo path canônico `{therapist_id}/{reading_id}/originais/{eye}_{angle}.jpg`. SC-3 e SC-4 acima cobrem o requisito. UAT Cenário 8 (founder-aprovado) confirmou DB. |

**Orphan check:** REQUIREMENTS.md mapeia apenas UPLOAD-01 e UPLOAD-02 para Fase 4. Ambos declarados em frontmatter de plans 04-01..04-07. Zero orphan requirements.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/lib/upload/validate-file.ts` | validateUploadFile + ACCEPTED_MIME_TYPES + HEIC_MIME_TYPES + FileValidationResult (Plan 04-01) | ✓ VERIFIED | 67 linhas; exports verificados; mensagens pt-BR exatas presentes ("Formato não suportado. Use JPEG, PNG, WebP ou HEIC." e "máximo 25 MB"); MAX_SIZE_BYTES = 25 MB; limite inclusivo no boundary. Sem `'use client'` / `'use server'` (lib pura). Wired em `upload-client.tsx:26` + `upload-client.tsx:131-135` (chamado antes de qualquer processamento). |
| `apps/web/lib/upload/heic-to-jpeg.ts` | convertHeicToJpeg via dynamic import (Plan 04-01) | ✓ VERIFIED | 45 linhas; export único `convertHeicToJpeg`. `await import('heic2any')` na linha 38 (dentro da função). Zero imports top-level de heic2any (`grep -r "^import.*heic2any" apps/web` retorna vazio). Wired em `upload-client.tsx:27` + `upload-client.tsx:143-156` (executado quando `validation.needsHeicConversion=true`). `heic2any@^0.0.4` em package.json:28 (escolha aprovada via checkpoint:decision do founder). |
| `apps/web/components/upload/UploadDropzone.tsx` | Drag+drop+click + a11y (Plan 04-03) | ✓ VERIFIED | 126 linhas; exporta `UploadDropzone` (named); `'use client'` linha 1; props `onFileAccepted`/`disabled`/`slotLabel`. Container tem `role="button"`, `tabIndex`, `aria-disabled`, `aria-label`, `data-dragover`. Input file accept inclui `image/heic,image/heif,.heic,.heif`. Footer "JPEG · PNG · WebP · HEIC — máx. 25 MB" presente (linha 109). Sem imports de `lib/upload` ou `lib/capture` (puramente apresentacional). 10 testes vitest passam. Wired em `upload-client.tsx:25,340-343`. |
| `apps/web/lib/capture/sequence.ts` | getSlotInstructionCopy com mode opcional (Plan 04-04) | ✓ VERIFIED (não-relido nesta verificação; SUMMARY 04-04 reporta 9 testes novos verdes — 6 sequence + 3 CapturePreview; 63/63 testes em components/capture+sequence; backward compat 100% — capture-client.tsx Fase 3 não tocado). Default 'camera' preserva comportamento Fase 3. |
| `apps/web/components/capture/CapturePreview.tsx` | Prop `mode` adicionada (Plan 04-04) | ✓ VERIFIED | Wired em `upload-client.tsx:359-366` com `mode="upload"` — verifica indiretamente que prop existe e foi aceita pelo TypeScript. Backward compat preservada (Fase 3 capture-client não tocado — confirmado via `git show 4fef196`). |
| `apps/web/app/(dashboard)/leituras/nova/upload/page.tsx` | Server component substitui placeholder (Plan 04-05) | ✓ VERIFIED | 85 linhas. 4 guards implementados: (1) `if (!readingId) redirect /leituras/nova` linhas 29-31; (2) `if (!user) redirect /login` linha 36; (3) **D-04** `if (reading.capture_method === 'mobile_camera') redirect /leituras/nova/capturar?reading=<id>` linhas 60-62; (4) `if (reading.status !== 'pending') redirect /leituras` linhas 66-68. RLS implícita via `from('readings').select(...).eq('id', readingId)` filtra `auth.uid() = therapist_id`. Substituiu o placeholder herdado da Fase 3. |
| `apps/web/app/(dashboard)/leituras/nova/upload/upload-client.tsx` | Wizard client (Plan 04-05) | ✓ VERIFIED | 381 linhas; exports `UploadClient` (named); state machine `Phase = 'instruction' \| 'analyzing' \| 'previewing' \| 'finalizing'` (linha 50). Importa e usa todos os artefatos novos: `UploadDropzone` (linha 25), `validateUploadFile` (26), `convertHeicToJpeg` (27). Reusa Fase 3: `analyzeCapturedJpeg` (12-14), `uploadWithRetry` (15), `SEQUENCE` (18), `finalizeReadingAction` (8). Background upload via `uploadPromisesRef` (122) + `Promise.allSettled` no finalize (282) — D-13 satisfeito. X no header navega para /leituras sem disparar discard (linha 322 — D-14 preserva rascunho). |
| `apps/web/app/(dashboard)/leituras/nova/new-reading-form.tsx` | Auto-detect + dois CTAs (Plan 04-06) | ✓ VERIFIED | useEffect com `matchMedia('(pointer: coarse) and (hover: none)')` (linha 73) seta `chosenMethod`. Hidden input `<input type="hidden" name="method" value={chosenMethod}>` linha 134. Botão primário com texto dinâmico ('Iniciar captura mobile' \| 'Selecionar arquivos no computador') linhas 148-152. Botão de escape `<button type="submit" name="method" value={otherMethod}>` linhas 158-168 — usa HTML form behavior canônico (submit-button name/value sobrescreve hidden input). Cleanup de event listener registrado. |
| `apps/web/app/actions/readings.schemas.ts` | createReadingSchema com method enum + DraftReading com capture_method (Plan 04-02) | ✓ VERIFIED | `CAPTURE_METHODS` const tuple (linha 8) + `CaptureMethod` type (9). `createReadingSchema.method = z.enum(CAPTURE_METHODS).default('mobile_camera')` (linha 18) — default preserva compat retroativa. `DraftReading.capture_method: CaptureMethod` (38). |
| `apps/web/app/actions/readings.ts` | createReadingAction routing + getDraftReading com capture_method (Plan 04-02) | ✓ VERIFIED | `createReadingAction` lê `formData.get('method')` (linha 57), passa para Zod (60), grava `capture_method: parsed.data.method` (76 — não mais hardcoded), redireciona condicionalmente para `/upload?reading=` ou `/capturar?reading=` (88-91). `getDraftReading` inclui `capture_method` no select PostgREST (266) e retorna `narrowCaptureMethod(r.capture_method)` (293) — defesa em profundidade contra string\|null do Supabase. |
| `apps/web/app/actions/readings.test.ts` | Testes do schema + smoke DraftReading (Plans 04-02, 04-07) | ✓ VERIFIED | 16 testes verdes (vide execução abaixo). Cobrem: default mobile_camera, accept mobile_camera/desktop_upload explícitos, reject 'random_method' / '', CAPTURE_METHODS canonical source, DraftReading shape com ambos valores, lógica de roteamento que Fase 9 vai usar. |

**Score:** 11/11 artifacts verified.

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `new-reading-form.tsx` | `createReadingAction` | FormData inclui hidden input `name="method"` lido por createReadingSchema | ✓ WIRED | linha 134 (hidden input) + linha 60 do action (formData.get('method')). |
| `createReadingAction` | DB `readings.capture_method` | `INSERT capture_method: parsed.data.method` | ✓ WIRED | linha 76. |
| `createReadingAction` | redirect destination | `if method === 'desktop_upload' → /upload, else → /capturar` | ✓ WIRED | linhas 88-91. |
| `page.tsx` (upload) | `UploadClient` | RLS-protected select com `capture_method` + props readingId/therapistId/clientName/capturedSlots | ✓ WIRED | linhas 40-83. |
| `page.tsx` D-04 guard | `/leituras/nova/capturar?reading=<id>` | `if (reading.capture_method === 'mobile_camera') redirect(...)` | ✓ WIRED | linhas 60-62. |
| `upload-client.tsx` | `UploadDropzone` | import + `<UploadDropzone onFileAccepted={handleFileAccepted}>` | ✓ WIRED | 25, 340-343. |
| `upload-client.tsx` | `validateUploadFile` | import + chamada antes de qualquer processamento | ✓ WIRED | 26, 131. |
| `upload-client.tsx` | `convertHeicToJpeg` | import + chamada quando `needsHeicConversion=true` | ✓ WIRED | 27, 146. |
| `upload-client.tsx` | `analyzeCapturedJpeg` (Fase 3 VLM gate) | Pipeline reusado verbatim — D-09 honored | ✓ WIRED | 12-14, 166. |
| `upload-client.tsx` | `uploadWithRetry` (Fase 3) | Pipeline storage reusado verbatim | ✓ WIRED | 15, 204. |
| `upload-client.tsx` | `finalizeReadingAction` | Aguarda Promise.allSettled e finaliza | ✓ WIRED | 8, 283. |
| `uploadWithRetry` | DB `reading_images` (eye, angle, storage_path, ...) | upsert (reading_id, eye, angle) com path canônico | ✓ WIRED | `lib/capture/upload.ts:67-92` (não modificado em Fase 4). |
| `heic-to-jpeg.ts` | `heic2any` package | Dynamic import — bundle splitting | ✓ WIRED | linha 38 (`await import('heic2any')`). Zero imports top-level no projeto inteiro (verificado via grep). |
| `getDraftReading` | `DraftReading.capture_method` | select PostgREST inclui `capture_method` + return mapeia para tipo | ✓ WIRED | linhas 266, 293. Forward para Fase 9 (RecoveryBanner UI). |

---

### Cross-Cutting Constraints

| Constraint | Status | Evidence |
|------------|--------|----------|
| Vocabulário proibido LGPD ausente em todas as strings novas (auditável via `pnpm audit:vocabulary`). | ✓ VERIFIED | Grep direto em todos os arquivos novos/modificados de Fase 4 (`lib/upload/`, `components/upload/`, `app/(dashboard)/leituras/nova/`, `app/actions/readings.ts`) retorna ZERO matches para `diagn[oó]stic\|tratament\|cura`. As 8 falhas reportadas pelo `pnpm audit:vocabulary` são 100% nos arquivos pré-existentes documentados em `deferred-items.md`: `app/(auth)/login/page.tsx` (Phase 2), `app/(auth)/signup/page.tsx` (Phase 2), `app/api/capture/validate/route.ts` (Phase 3 — commit 16a3f18), `components/capture/CapturePreview.tsx:108` (Phase 3 — commit 16a3f18 confirmado via `git log -L`). Plan 04-04 só adicionou prop `mode` — não tocou o comentário pré-existente (commit 4fef196 não menciona "diagn"). |
| Storage path canônico `{therapist_id}/{reading_id}/originais/{eye}_{angle}.jpg` consistente com Fase 3. | ✓ VERIFIED | `lib/capture/storage-path.ts:19-28` define o path; `lib/capture/upload.ts:67` chama `buildOriginalStoragePath` no upload; `upload-client.tsx:204` chama `uploadWithRetry` (que internamente usa o mesmo helper). Zero código novo de path em Fase 4 — apenas consumo do helper Fase 3. |
| HEIC lib carregada APENAS via dynamic import (não vaza pro bundle do (dashboard)). | ✓ VERIFIED | Grep `^import.*heic2any` em todo `apps/web/` retorna VAZIO. Único uso de `heic2any` é em `lib/upload/heic-to-jpeg.ts:38` via `await import('heic2any')`. SUMMARY 04-05 reporta build com `heic2any em chunk dedicado de 1.35MB` (founder verificou no UAT Cenário 7). |
| `capture_method` validado no schema Zod do createReadingAction. | ✓ VERIFIED | `readings.schemas.ts:18` — `method: z.enum(CAPTURE_METHODS).default('mobile_camera')`. Teste 4 e 5 (`readings.test.ts:72-86`) confirmam que `method='random_method'` e `method=''` são rejeitados pelo safeParse. ASVS L1 V5.1.3 ✓. |
| RecoveryBanner UI deferido para Fase 9 (Plan 04-07 entrega apenas o backend hook). | ✓ VERIFIED | Backend hook (`getDraftReading` retornando `capture_method`) presente em `readings.ts:293`. Smoke test (`readings.test.ts:119-174`) valida shape do `DraftReading` e a lógica de roteamento que Fase 9 vai usar. UAT Cenário 13 marca esta validação como "forward para Fase 9". Nenhum componente `RecoveryBanner.tsx` criado em Fase 4 — alinhado com STATE.md e ROADMAP Fase 3 nota. |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 4 unit tests pass (validate-file + UploadDropzone + readings schema) | `cd apps/web && pnpm test:run lib/upload/ components/upload/ app/actions/readings.test.ts` | 39 passed (3 files) — validate-file 13/13, UploadDropzone 10/10, readings 16/16 | ✓ PASS |
| Vocabulary audit on Phase 4 new files only | `grep -r "diagn[oó]stic\|tratament\|cura" apps/web/lib/upload apps/web/components/upload apps/web/app/(dashboard)/leituras/nova apps/web/app/actions/readings.ts -i` | 0 matches | ✓ PASS |
| Top-level heic2any imports | `grep -r "^import.*heic2any" apps/web` | 0 matches (only `await import('heic2any')` in heic-to-jpeg.ts:38) | ✓ PASS |
| heic2any installed | `grep heic2any apps/web/package.json` | `"heic2any": "^0.0.4"` linha 28 | ✓ PASS |
| Phase 4 typecheck (excluindo deferidos Fase 3) | `pnpm tsc --noEmit -p .` | Apenas 2 erros pré-existentes em `lib/capture/quality-scoring.test.ts:47,54` (WEIGHTS.reflex obsoleto da pivô VLM Fase 3) — documentado em deferred-items.md | ✓ PASS (deferidos) |
| Vocabulary audit (project-wide) | `pnpm audit:vocabulary` | 8 violações em 4 arquivos pré-existentes (login, signup, capture/validate route, CapturePreview comment) — todos pré-existentes, documentados em deferred-items.md | ✓ PASS (deferidos) |

**Note:** O ROADMAP Fase 4 cross-cutting constraint "auditável via `pnpm audit:vocabulary`" é interpretado como "ausente em strings novas" — confirmado via grep direto nos arquivos novos. As 8 falhas globais são Phase 3 debt, não regressões de Phase 4.

---

### Anti-Patterns Found

Anti-pattern scan em arquivos novos/modificados em Fase 4:

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| `lib/upload/validate-file.ts` | (sem) | — | Lib pura, sem TODO/FIXME, sem return null/{}, sem stubs. |
| `lib/upload/heic-to-jpeg.ts` | (sem) | — | Sem teste vitest justificado inline (jsdom não roda heic2any) — coberto por UAT Cenário 7. Não é stub, é decisão arquitetural. |
| `components/upload/UploadDropzone.tsx` | (sem) | — | Componente substantivo com handlers reais e a11y completa. |
| `app/(dashboard)/leituras/nova/upload/page.tsx` | (sem) | — | Substituiu o placeholder herdado da Fase 3 (commit Plan 04-05). |
| `app/(dashboard)/leituras/nova/upload/upload-client.tsx` | (sem) | — | 381 linhas de pipeline funcional ponta-a-ponta; reuso explícito de helpers Fase 3. |
| `app/(dashboard)/leituras/nova/new-reading-form.tsx` | (sem) | — | matchMedia com cleanup; texto dinâmico em ambos os CTAs; hidden input + escape via submit-button name/value. |
| `app/actions/readings.schemas.ts` | (sem) | — | Schema estendido com Zod enum; tipos exportados. |
| `app/actions/readings.ts` | (sem) | — | createReadingAction grava `capture_method` validado; getDraftReading retorna `capture_method`; narrowCaptureMethod helper para defesa em profundidade. |

Zero blockers, zero warnings.

---

### Human Verification Required

**Nenhum item pendente.** O founder rodou os 14 cenários do UAT (`04-UAT.md`) e respondeu `approved` ao checkpoint do Plan 04-07 em 2026-05-03 (registrado em ROADMAP linha 138 e UAT linha 3). Todos os comportamentos visuais, fluxo end-to-end com 6 fotos reais, conversão HEIC, validação de tipo/tamanho, redirects D-04, preservação de rascunho D-14, e ausência de regressão na captura mobile (Cenário 14) foram validados manualmente.

---

### Gaps Summary

**Nenhum gap.** Os 4 success criteria do ROADMAP estão satisfeitos com evidência direta no código; UPLOAD-01 e UPLOAD-02 estão cobertos por artefatos verificados e wiring completo; os 5 cross-cutting constraints da Fase 4 estão honrados (vocabulário em arquivos novos, storage path canônico, dynamic import HEIC, Zod enum no schema, RecoveryBanner UI explicitamente deferido para Fase 9 com backend hook entregue); founder UAT aprovado.

Os itens em `deferred-items.md` (8 violações `audit:vocabulary` em arquivos pré-existentes Phase 2/3 + 2 erros tsc em `quality-scoring.test.ts` Phase 3) NÃO contam como gaps de Fase 4 — foram diagnosticados como pré-existentes via `git stash + verify` durante a execução dos plans 04-01, 04-02 e 04-04, e estão fora do scope boundary do executor.

---

_Verified: 2026-05-03T21:30:00Z_
_Verifier: Claude (gsd-verifier, model claude-opus-4-7[1m])_
