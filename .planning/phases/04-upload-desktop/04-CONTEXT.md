# Phase 4: Upload desktop - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Terapeuta no desktop pode iniciar uma leitura subindo até 6 imagens já capturadas em câmera profissional, produzindo a mesma estrutura de armazenamento do fluxo mobile. Concretamente:

- **Rota canônica:** `/leituras/nova/upload?reading=[id]` (placeholder atual em `app/(dashboard)/leituras/nova/upload/page.tsx` é substituído pela tela real).
- **Entrada via `/leituras/nova`:** auto-detecta mobile/desktop e roteia, com link de escape em ambos os lados ("Tenho fotos prontas, quero subir" no mobile, "Quero usar a câmera" no desktop).
- **Wizard sequencial paralelo ao mobile:** mesma máquina `SEQUENCE` da Fase 3 (`left/frontal → left/lateral → left/backlight → right/frontal → right/lateral → right/backlight`), mesmas instruções de `getSlotInstructionCopy`, mesma `AngleInterstitial` na transição de olho. A diferença é a fonte do JPEG: dropzone client-side em vez de `<input capture="environment">`.
- **Validação VLM Haiku 4.5:** cada foto subida é validada via `/api/capture/validate` (já existente da Fase 3) com hard block em `BLOCKING_REASONS` (`sem_olho`, `dois_olhos`, `olho_fechado`, `muito_longe`). UX igual ao `CapturePreview` do mobile: badge de qualidade + botão "Refazer" obrigatório quando há razão bloqueante.
- **Upload em background:** `uploadWithRetry` + `AbortController` por slot reutilizados; terapeuta avança pro próximo slot enquanto upload do anterior roda em background.
- **Validação técnica client-side:** MIME type ∈ {`image/jpeg`, `image/png`, `image/webp`} + tamanho ≤ 25MB por foto. HEIC (export padrão iPhone) é convertido client-side pra JPEG antes do upload. Sem dimensão mínima/máxima — VLM gate cobre qualidade visual.
- **Reading row criado ao iniciar fluxo** (antes da 1ª foto) com `status='pending'` e `capture_method='desktop_upload'`. Mesmo padrão D-08 da Fase 3.
- **Storage path canônico** `{therapist_id}/{reading_id}/originais/{eye}_{angle}.jpg` — idêntico à Fase 3.
- **Persistência:** `saveReadingImagesAction` já existente faz upsert em `(reading_id, eye, angle)`, suporta refazer slot. 6 linhas em `reading_images` com `eye`, `angle`, `storage_path`, `quality_score`, `width`, `height`. `quality_score` é derivado do `quality` do VLM via `QUALITY_TO_SCORE` (mesma tabela do `capture-client`).
- **Recovery banner** (D-12 da Fase 3) cobre desktop: `getDraftReading` retorna pending readings independente de método; banner roteia por `capture_method` (`mobile_camera` → `/capturar?reading=`, `desktop_upload` → `/upload?reading=`).
- **Cancelar preserva rascunho** (D-13 da Fase 3): X no header do wizard volta pra `/leituras` mantendo reading com `status='pending'`. Hard delete só via "Descartar" no banner de recovery.

**Fora do escopo desta fase:**
- Pipeline de visão Modal — Fase 5; aqui só captura + storage.
- Crop iridológico client-side — segue convenção da Fase 3: JPEG original (mesmo que pesado) vai pro Storage, crop é responsabilidade da Fase 5.
- LGPD termo de consentimento por cliente — Fase 8.
- Listagem completa de leituras com filtros — Fase 7/9.
- Multi-foto por ângulo (selecionar a melhor de 3) — diferido (ver Fase 3 deferred).
- Detecção de device sofisticada (User-Agent parsing rico, fingerprinting) — heurística simples (matchMedia `(pointer: coarse)` ou `(hover: none)`) é suficiente.
- Bulk upload em massa com associação posterior por VLM — wizard sequencial foi escolhido explicitamente; bulk fica deferido.
- App nativo desktop — explicit out-of-scope global (PROJECT.md).

</domain>

<decisions>
## Implementation Decisions

### Entry point + detecção de device

- **D-01 (auto-detect com link de escape):** Em `/leituras/nova`, após selecionar cliente, o roteamento padrão é por device (matchMedia `(pointer: coarse) and (hover: none)` indica mobile; senão desktop). Mas **link de escape** é sempre visível:
  - Mobile (default → captura): link "Tenho fotos prontas — subir do computador" leva pra `/leituras/nova/upload?reading=[id]`.
  - Desktop (default → upload): link "Quero usar a câmera" leva pra `/leituras/nova/capturar?reading=[id]`.
  Justificativa: terapeuta no iPad ou em laptop com webcam pode querer qualquer método; sem dead-end.

- **D-02 (CTA único em `/clientes/[id]`):** O botão "Nova leitura" já existente continua único e aponta pra `/leituras/nova?cliente=[id]`. Não vira dropdown. A escolha de método (auto-detect + escape) acontece na tela seguinte. Justificativa: fluxo unificado, menos branches no `/clientes/[id]`.

- **D-03 (capture_method na criação):** `createReadingAction` recebe um param `method: 'mobile_camera' | 'desktop_upload'` e grava direto. Reading nasce com `capture_method` correto. **Mudança no schema da action:** assinatura existente é `createReadingAction(prevState, formData)` com FormData lendo `client_id`; aceitar também um campo `method` no FormData ou derivar da rota é decisão do planner. Sugestão: `method` no FormData via hidden input controlado pela tela `/leituras/nova`.

- **D-04 (método fixo no reading):** Uma vez criado, `capture_method` é imutável durante o draft. Pra trocar de método, terapeuta descarta o reading e cria novo. Justificativa: simplicidade > flexibilidade; trocar de método com fotos parciais já subidas geraria estados inconsistentes (mistura de imagens com proveniência diferente).

### UX da associação eye/angle

- **D-05 (wizard sequencial):** Tela `/leituras/nova/upload` reusa o **mesmo state machine do `capture-client`** mobile (Fase 3). Para cada slot da `SEQUENCE`:
  1. `AngleInterstitial` (ou variante inline) mostra "Foto N de 6 — Olho ESQUERDO Frontal" com `getSlotInstructionCopy`.
  2. Dropzone única (drag-and-drop OU botão "Selecionar arquivo") aceita 1 foto.
  3. Análise VLM (D-09 abaixo).
  4. `CapturePreview` mostra preview + badge de qualidade + "Confirmar" / "Refazer".
  5. Confirmar → upload em background (D-13) + avança slot.
  Justificativa: máximo reuso de código (sequence.ts, AngleInterstitial, CapturePreview) e consistência conceitual entre fluxos.

- **D-06 (sempre 6 obrigatórias):** Finalize só dispara em 6/6 capturas, igual mobile. Reading_images tem 6 linhas. Pipeline Modal (Fase 5) recebe input completo. Justificativa: contrato uniforme com Fase 5; reduz casos especiais.

- **D-07 (refazer via upsert):** Em qualquer slot já preenchido (na navegação interna do wizard ou no preview), o terapeuta pode "Refazer" — abre dropzone novamente, sobe nova foto, `upsert` em `(reading_id, eye, angle)` sobrescreve linha de DB e arquivo de Storage. Mesmo padrão do tap-to-redo (Fase 3 D-09).

### VLM gate + validação

- **D-09 (VLM hard block igual mobile):** Cada foto subida é validada via `validateImageWithClaude(blob)` (lib/capture/validate-image.ts). Comportamento idêntico ao `capture-client`:
  - `quality` retorna `ruim/regular/boa/excelente`; mapeia pra `quality_score` via `QUALITY_TO_SCORE`.
  - `reason ∈ BLOCKING_REASONS` (sem_olho, dois_olhos, olho_fechado, muito_longe) → botão "Confirmar" desabilitado, terapeuta forçado a "Refazer".
  - Fallback graceful (timeout/erro de rede) → assume `boa` + `source='fallback'` (já implementado).
  - Custo: ~$0.005/leitura (6 × $0.0008) — aceito (PROJECT.md já contempla custo VLM).

- **D-10 (validação técnica mínima):** Antes de chamar VLM, valida client-side:
  - **MIME type ∈ {`image/jpeg`, `image/png`, `image/webp`}** — outros formatos rejeitados com toast em pt-BR ("Formato não suportado. Use JPEG, PNG ou WebP.").
  - **Tamanho ≤ 25MB** (D-12 abaixo).
  - **Sem dimensão mínima/máxima** — VLM cobre qualidade visual; thumbnails muito pequenos serão pegos por `muito_longe` ou `borrado`.
  - **Sem downsize automático** — JPEG original vai pro Storage (consistente com decisão da Fase 3 de não recomprimir; pipeline Modal precisa do detalhe).

- **D-11 (HEIC convert client-side):** Se MIME type for `image/heic` ou `image/heif`, converte pra JPEG no browser via lib (sugestão: `heic2any` ou `libheif-js`; planner avalia bundle size). A conversão é transparente — terapeuta arrasta `.heic` e o sistema mostra preview JPEG pronto. Bundle fica restrito à rota `/upload` via dynamic import (não vaza pro resto do app).

- **D-12 (limite 25MB por foto):** Validação client-side rejeita arquivos > 25MB com toast "Foto muito grande, máximo 25MB. Verifique o formato (RAW e PNG não comprimido podem exceder o limite)." Cobre câmeras 24–40MP em JPEG normal. Limite total da leitura: ~150MB (6 × 25MB) — aceitável pra 4G/wifi de consultório.

### UX do upload

- **D-13 (upload imediato em background):** Reusa `uploadWithRetry` + `AbortController` por slot do `lib/capture/upload.ts`. Confirmar slot N dispara upload em paralelo, terapeuta já avança pra slot N+1 (instrução visível, próximo dropzone). Promise do upload é tracked em `uploadPromisesRef` igual ao `capture-client`. Falha de upload é toastada ao terapeuta sem bloquear avanço; finalize espera todas as promises.

- **D-14 (cancelar preserva rascunho):** Botão X no header do wizard chama `router.push('/leituras')` sem destruir o reading. Reading fica com `status='pending'` e count(reading_images) < 6 — banner de recovery (D-12 da Fase 3) aparece na próxima visita. Hard delete só via "Descartar" no banner. Mesmo comportamento do mobile (D-13 da Fase 3).

- **D-15 (recovery banner cobre desktop):** O banner já existente lê `getDraftReading()` (que não distingue método). No banner, o link "Continuar" inspeciona `capture_method` do reading retornado e roteia:
  - `'mobile_camera'` → `/leituras/nova/capturar?reading=[id]&resume=true`
  - `'desktop_upload'` → `/leituras/nova/upload?reading=[id]&resume=true`
  Justificativa: zero mudança no banner core, só ajuste de roteamento; getDraftReading já retorna o método junto.

### Claude's Discretion

- **Forma exata da heurística de detecção mobile/desktop** — `matchMedia('(pointer: coarse)')`, `(hover: none)`, ou User-Agent simples. Planner escolhe; ambos resolvem.
- **Componente exato da dropzone** — `react-dropzone`, custom com `onDrop`/`onDragOver`, ou `<input type="file">` estilizado. Decisão do planner com base em bundle/UX.
- **Lib de conversão HEIC** — `heic2any` (~600KB) vs `libheif-js` (~700KB) vs alternativa atual (avaliar maintainership). Planner pesquisa.
- **Loading state da conversão HEIC** — toast "Convertendo HEIC..." vs spinner inline; ambos OK desde que comuniquem ao terapeuta.
- **Estilo do badge de qualidade no preview desktop** — pode ser idêntico ao mobile ou adaptado pra layout desktop maior; consistência > simetria visual.
- **Posicionamento exato do link de escape** em `/leituras/nova` — embaixo do CTA principal, link discreto; texto pode ser ajustado em UI review.
- **Tratamento de drag-and-drop em mobile** — mobile rara mas fallback pra `<input type="file">` é suficiente.
- **Componentes a criar:** `app/(dashboard)/leituras/nova/upload/upload-client.tsx` (wizard client component), `components/upload/UploadDropzone.tsx`, `components/upload/HeicConversionToast.tsx` (se necessário). Planner refina nomes/estrutura.
- **Reuso de `(capture)` route group** — desktop pode viver em `(dashboard)` (sidebar mantida — terapeuta no laptop tem espaço) ou migrar pra `(capture)` pra full-screen. Sugestão: manter em `(dashboard)` pra facilitar navegação cross-leituras.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Especificação fonte
- `SPEC.md` §1 — Stack tecnológico (Supabase Storage, Next.js 15, Anthropic Haiku 4.5)
- `SPEC.md` §2 — Estrutura de pastas (`app/(dashboard)/leituras/nova/upload/page.tsx`, `components/upload/`)
- `SPEC.md` §3 — Schema (`readings.capture_method` enum inclui `desktop_upload`; `reading_images` com `eye`, `angle`, `storage_path`, `quality_score`, `width`, `height`)
- `SPEC.md` §7 Fase 3 — Roadmap original de Upload desktop (1–2 dias)

### Requisitos
- `.planning/REQUIREMENTS.md` — UPLOAD-01 (dropzone + preview + validação), UPLOAD-02 (mesma estrutura `reading_images` que mobile)
- `.planning/ROADMAP.md` Fase 4 — Goal, Depends on (Fase 3), Success Criteria (4 itens)

### Projeto e restrições
- `.planning/PROJECT.md` — Restrições LGPD (bucket privado, dados biométricos em sa-east-1, vocabulário proibido)
- `.planning/intel/constraints.md` — 21 constraints; especialmente schema, RLS folder-based de Storage, Storage signed URLs

### Fases anteriores (CRÍTICO — paralelo direto)
- `.planning/phases/03-captura-mobile-pwa/03-CONTEXT.md` — TODO o contexto da Fase 3 é referência canônica. Em particular:
  - **D-08** (reading row criado ao iniciar com `status='pending'`) — replicado aqui com `capture_method='desktop_upload'`
  - **D-storage** (path `{therapist_id}/{reading_id}/originais/{eye}_{angle}.jpg`) — idêntico
  - **D-09** (preview passivo + tap-to-refazer + upload em background) — wizard desktop reusa
  - **D-12** (banner de recovery automático) — cobre desktop, roteia por capture_method
  - **D-13** (cancelar preserva rascunho) — replicado aqui
  - **D-15** (placeholder de upload em /leituras/nova/upload) — substituído nesta fase
- `.planning/phases/02-auth-dashboard-basico/02-CONTEXT.md` — D-13 (botão "Nova leitura" em /clientes/[id]) — D-02 mantém esse fluxo único

### Código existente (a reusar — DETALHADO em `<code_context>`)
- `apps/web/lib/capture/upload.ts` — `uploadWithRetry`, `uploadCaptureImage`, `UploadArgs` interface
- `apps/web/lib/capture/validate-image.ts` — `validateImageWithClaude`, `BLOCKING_REASONS`, `isVlmRejection`
- `apps/web/lib/capture/sequence.ts` — `SEQUENCE`, `getResumeSlotIndex`, `getSlotInstructionCopy`, `Slot`
- `apps/web/lib/capture/storage-path.ts` — `buildOriginalStoragePath`
- `apps/web/lib/capture/quality-scoring.ts` — `QualityLevel`, `levelFromScore`
- `apps/web/lib/capture/post-capture-analysis.ts` — pipeline `analyzeCapturedJpeg`
- `apps/web/components/capture/CapturePreview.tsx` — preview + badge + Confirmar/Refazer
- `apps/web/components/capture/AngleInterstitial.tsx` — tela full-screen entre slots
- `apps/web/components/capture/CaptureProgress.tsx` — indicador "N de 6"
- `apps/web/app/actions/readings.ts` — `createReadingAction`, `finalizeReadingAction`, `saveReadingImagesAction`, `discardReadingAction`, `getDraftReading`, `cleanupStaleEmptyReadingsAction`
- `apps/web/app/api/capture/validate/route.ts` — endpoint VLM (sem mudança nesta fase)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

**Pipeline VLM (Fase 3 — usado idêntico):**
- `lib/capture/validate-image.ts` — `validateImageWithClaude(blob)` retorna `{quality, reason, source}`. `BLOCKING_REASONS` exportado é a mesma lista de razões bloqueantes do mobile. Não precisa wrapper novo; usar direto.
- `app/api/capture/validate/route.ts` — endpoint server-side já configurado, com `ANTHROPIC_API_KEY` fora do bundle. Sem mudança nesta fase.

**Upload + Storage (Fase 3 — usado idêntico):**
- `lib/capture/upload.ts` — `uploadWithRetry({ supabase, blob, width, height, therapistId, readingId, eye, angle, qualityScore, signal })`. Retry exponencial 2 tentativas, AbortController por slot, upsert em `reading_images`. Reusar tal qual.
- `lib/capture/storage-path.ts` — `buildOriginalStoragePath(therapistId, readingId, eye, angle)` — same path no mobile e desktop.

**State machine + sequence (Fase 3 — reusada):**
- `lib/capture/sequence.ts` — `SEQUENCE` (6 slots), `Slot`, `Eye`, `Angle`, `getResumeSlotIndex`, `getSlotInstructionCopy`, `isOuterEyeTransition`. Wizard desktop usa as mesmas funções.

**UI components (Fase 3 — reusados):**
- `components/capture/CapturePreview.tsx` — preview + badge VLM + Confirmar/Refazer. Importar e usar (pode precisar renomear ou aceitar prop pra adaptar copy "câmera" → "arquivo" se houver string específica).
- `components/capture/AngleInterstitial.tsx` — full-screen entre slots; copy de `getSlotInstructionCopy` já neutra (não fala "câmera"), só verificar se "Abrir câmera" do CTA precisa virar "Selecionar arquivo" no contexto desktop.
- `components/capture/CaptureProgress.tsx` — "N de 6" (neutro, reusável).
- `components/capture/AngleIcon.tsx` — SVG do olho + seta (neutro, reusável).

**Server actions (já existem):**
- `createReadingAction(prevState, formData)` — **precisa estender:** aceitar `method` no FormData (atualmente fixo em `'mobile_camera'` no `.insert(...)`). Sugestão: ler `formData.get('method')` e default pra `'mobile_camera'` (preserva chamada atual do mobile).
- `saveReadingImagesAction(readingId, images[])` — já faz upsert; reusável tal qual.
- `finalizeReadingAction(readingId)` — neutro, reusável.
- `discardReadingAction(readingId)` — neutro, reusável.
- `getDraftReading()` — retorna pending reading sem distinção de método; banner de recovery lê `capture_method` retornado pra rotear.
- `cleanupStaleEmptyReadingsAction()` — neutro, GC de pendings com 0 imagens > 1h, cobre desktop também.

**shadcn/ui já adicionado:**
- `dialog`, `card`, `badge`, `button`, `progress`, `alert`, `dropdown-menu`, `select`, `input`, `label`, `form`, `toast` (sonner) — todos relevantes pro upload disponíveis.

### Established Patterns

- **Server actions sob `app/actions/`** com Zod validation (Fase 2/3) — manter padrão; `createReadingAction` já valida `client_id`, estender pra validar `method`.
- **`(dashboard)/` layout** mantém sidebar — wizard desktop fica em `(dashboard)` (não migra pra `(capture)`) porque desktop tem espaço pra sidebar e facilita navegação cross-leituras. **Decisão sob Claude's Discretion.**
- **Wizard pattern** do `capture-client.tsx` (state machine `Phase = 'instruction' | 'analyzing' | 'previewing' | 'finalizing'`) é template direto pro `upload-client.tsx`.
- **RLS folder-based** em `iris-captures` bucket — `{therapist_id}/...` no path; auth.uid() valida primeiro segmento. Desktop usa o mesmo path → RLS herdada sem migration.
- **VLM fallback graceful** — `source='fallback'` em timeout/erro de rede; UX mostra badge "boa" mas não bloqueia. Reusar comportamento.
- **Hidden input pra capture_method** — pattern de FormData inputs no `new-reading-form.tsx` (Fase 2 D-13/CRUD clientes); replicar com `<input type="hidden" name="method" value={chosenMethod} />`.
- **Auto-detect device** — usar `useEffect` + `window.matchMedia('(pointer: coarse) and (hover: none)')` ou similar. Mobile-first defaults com escape em ambos os lados.

### Integration Points

- **Entry point 1:** `/leituras/nova` (existe — tela atual seleciona cliente). **Mudança:** após seleção de cliente, em vez de submit direto, mostra dois CTAs (auto-detected default + escape). Cada CTA submete `createReadingAction` com `method` apropriado. Redireciona pra `/capturar` ou `/upload`.
- **Entry point 2:** `/clientes/[id]` (botão "Nova leitura" — existe). **Sem mudança:** continua linkando pra `/leituras/nova?cliente=[id]`.
- **Tela principal:** `app/(dashboard)/leituras/nova/upload/page.tsx` (placeholder atual, **substituir**) — server component que lê `?reading=[id]` da query, valida ownership via Supabase, monta props pro `<UploadClient>`.
- **Wizard client:** `app/(dashboard)/leituras/nova/upload/upload-client.tsx` (a criar) — análogo a `capture-client.tsx` mas com dropzone em vez de `<input capture>`. Reusa SEQUENCE/AngleInterstitial/CapturePreview.
- **Server action `createReadingAction`:** estender pra aceitar `method` ∈ {mobile_camera, desktop_upload}. Default mantém compat retroativa com chamada atual do mobile.
- **Recovery banner:** já existe (Fase 3 D-12). **Mudança:** ler `capture_method` do `getDraftReading()` e ajustar URL do CTA "Continuar" (`/capturar` vs `/upload`).
- **HEIC conversion:** novo módulo `lib/upload/heic-to-jpeg.ts` (a criar) com dynamic import da lib escolhida; chamado antes de `validateImageWithClaude`.
- **Validação técnica:** novo módulo `lib/upload/validate-file.ts` (a criar) com `validateUploadFile(file): { ok: boolean, error?: string }` cobrindo MIME e tamanho.

</code_context>

<specifics>
## Specific Ideas

- **Texto do link de escape mobile:** "Tenho fotos prontas — subir do computador" ou similar; copy final em UI review.
- **Texto do link de escape desktop:** "Quero usar a câmera deste dispositivo" — útil pra terapeuta em iPad/laptop com webcam.
- **Heurística de detecção:** `window.matchMedia('(pointer: coarse) and (hover: none)').matches` é mais robusto que User-Agent (cobre iPad em modo desktop, dispositivos novos). Avaliar com teste em iPad real durante o planning/UAT.
- **Lib HEIC:** `heic2any` é mais maduro mas larger; `libheif-js` é WASM e menor. Planner pesquisa estado atual em 2026 antes de fixar.
- **Bundle de HEIC:** carregar via `await import('heic2any')` ou similar dentro do handler de drop, não no top-level do client component — preserva tamanho do bundle inicial da página /upload.
- **`new-reading-form.tsx` mudanças:** o form atual só tem o select de cliente. Pra D-01 (auto-detect + escape), o CTA "Iniciar leitura" vira dois botões (ou um botão + link discreto), com hidden input `method` controlado pelo state local.
- **`CapturePreview` adaptação:** verificar string "câmera" / "captura" em copy de Refazer; pode precisar prop `mode: 'camera' | 'upload'` que muda copy ("Refazer captura" → "Trocar arquivo"). Decisão do planner.
- **Vocabulário proibido (PROJECT.md):** nenhuma string nova nesta fase pode usar "diagnóstico", "tratamento", "cura". Mensagens de validação ("Formato não suportado", "Foto muito grande", "Olho não detectado, troque a foto") são neutras. Validar copy em UI review.
- **Mensagem de HEIC:** se a conversão falhar (corrupção, formato exótico), fallback é toast "Não consegui converter este HEIC. Exporte como JPEG do iPhone (Configurações → Câmera → Formatos → Mais Compatível) ou tente outra foto."
- **Telemetria:** considerar logar `method`, `format` (jpeg/png/webp/heic), `originalSizeBytes` por foto subida (sem PII) pra entender qual perfil de fotografia o terapeuta usa. Útil pra ajustar limites e suporte. Implementação opcional, planner decide.
- **Reading creation com method:** se for ADR-track formal de schema, capture_method já é enum no banco com valor `'desktop_upload'` pré-existente — sem migration nesta fase.

</specifics>

<deferred>
## Deferred Ideas

- **Bulk upload com associação posterior** (drop em massa + dropdowns/drag-to-slots) — wizard sequencial foi escolhido; bulk fica para uma versão futura se houver feedback dogfooding indicando atrito.
- **Auto-detect olho via VLM** (Haiku 4.5 já distingue olhos) — nice-to-have pra reduzir cliques se mudarmos pra bulk. Diferido junto com bulk acima.
- **Upload em chunks / resumível** (TUS, multipart) — não necessário pra 25MB JPEGs em rede de consultório. Reavaliar se subir o limite ou se 4G se mostrar gargalo.
- **HEIC server-side via sharp** — alternativa ao client-side. Diferido a menos que bundle client se mostre proibitivo (>1MB extra).
- **Multi-foto por ângulo (3 frames, melhor é selecionado)** — diferido na Fase 3, segue diferido aqui pelo mesmo motivo.
- **Galeria histórica de fotos do terapeuta** — fora do MVP.
- **EXIF metadata persistido** (ex: data/hora original da foto) — não é necessário pra Fase 5 e pode levantar questões LGPD adicionais. Reavaliar pós-Estágio 1.
- **Compressão WebP automática** — JPEG mantém compatibilidade total; ganho de WebP é marginal pra 25MB e adiciona complexidade.
- **Drag-and-drop de pasta inteira** — wizard sequencial faz 1 foto por slot, não cabe.
- **Página dedicada de upload por slot via mobile (galeria)** — nice-to-have; diferido.

</deferred>

---

*Phase: 04-upload-desktop*
*Context gathered: 2026-05-03*
