# Phase 3: Captura mobile (PWA) - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Terapeuta consegue, no celular, instalar o PWA, abrir o fluxo de nova leitura e capturar 6 imagens (3 ângulos × 2 olhos) com qualidade gated por validação on-device via MediaPipe Face Mesh, salvando tudo no bucket privado Supabase Storage com `reading_id` rastreável desde o início.

Concretamente:
- **PWA instalável** em iOS Safari e Chrome Android (manifest + service worker; ícone na home screen).
- **Rota canônica:** `/leituras/nova/capturar` com dois pontos de entrada (botão em `/clientes/[id]` e rota global `/leituras/nova` com seleção de cliente).
- **Câmera traseira** via `getUserMedia({ facingMode: 'environment' })`.
- **Validação on-device** com MediaPipe Face Mesh: `QualityCheck` (irisDetected, irisCenteredness, irisDistanceOk, sharpness, exposure, reflexInIrisCenter, eyelidOcclusion) compõe `overallScore`.
- **Auto-captura** quando qualidade entra em "Boa" (`overallScore ≥ 0.75`).
- **Indicador visual de qualidade em 4 níveis** (Ruim / Regular / Boa / Excelente).
- **Sequência guiada:** `right/frontal → right/lateral → right/backlight → left/frontal → left/lateral → left/backlight`, com instruções híbridas (interstitial entre olhos, overlay inline entre ângulos).
- **Preview passivo** de 2s pós-captura com tap-to-refazer.
- **Reading row criado ao iniciar** (`status='pending'`), permitindo recovery.
- **Banner automático de recovery** ao reabrir com leitura incompleta no banco.
- **Compressão JPEG 0.85 + max 2048px** antes do upload (~500KB/foto).
- **Upload para bucket privado** Supabase Storage com path `{therapist_id}/{reading_id}/{eye}_{angle}.jpg`.
- **Persistência:** 6 linhas em `reading_images` com `eye`, `angle`, `storage_path`, `quality_score`, `width`, `height`.

**Fora do escopo desta fase:**
- Pipeline de visão (Modal) — Fase 5; o que entra aqui é só captura + storage.
- Upload desktop (dropzone) — Fase 4. A tela de erro de "câmera negada" tem botão "Continuar via upload desktop" que aponta para `/leituras/nova/upload` (placeholder em Fase 3, real em Fase 4).
- Visualização do relatório / análise LLM — Fase 7. Mas `quality_score` é persistido por foto agora, para ser exibido no relatório quando a Fase 7 chegar.
- Pagamento + LGPD termo de consentimento — Fase 8. Captura funciona sem termo nesta fase (gate de termo só na Fase 8).
- Service worker offline-first — apenas o esqueleto PWA (manifest + SW mínimo) entra; cache offline rico é polish (Fase 9).

</domain>

<decisions>
## Implementation Decisions

### Fluxo de entrada e criação do reading

- **D-01 (entrada dual):** O fluxo de captura tem **dois pontos de entrada**:
  - `/clientes/[id]` → botão "Nova Leitura" (cliente já no contexto, fluxo rápido)
  - `/leituras/nova` → rota global com dropdown de seleção de cliente
  Ambos convergem para `/leituras/nova/capturar?reading=[id]` após criar o `readings` row.

- **D-08 (criação do reading):** O registro `readings` é **criado ao iniciar o fluxo**, antes da 1ª foto, com `status='pending'` e `capture_method='mobile_camera'`. Justificativas:
  - `reading_id` vira parte do `storage_path` (ver D-storage abaixo) desde a 1ª imagem.
  - Habilita recovery server-side (D-12) — se o usuário abandona, o registro persiste.
  - Reflete o `status` enum do schema (SPEC §3): `pending → processing → ready/failed/edited`.

- **D-storage (path convention):** `{therapist_id}/{reading_id}/{eye}_{angle}.jpg`. Ex: `abc-123/xyz-789/right_frontal.jpg`. Bucket privado por terapeuta com RLS herdada da Fase 1.

### Captura e validação on-device

- **D-02 (auto-capture):** **Modo de captura é automático.** Quando `overallScore` atinge "Boa" (≥0.75) e mantém estável por ~300-500ms, a foto é capturada automaticamente. **Sobrescreve** a redação literal do ROADMAP Fase 3 success criteria #3 ("botão de captura só fica habilitado quando overallScore >= 0.75") e resolve a ambiguidade do SPEC §4.1 ("ótima — capturando") em favor de captura automática. Sem botão manual de captura na UI.

- **D-06 (reflexo especular como sinal suave):** `reflexInIrisCenter` é **uma das contribuições** ao `overallScore`, não um hard gate isolado. Aparece no feedback live ("muito reflexo, gire a cabeça") quando dominante na perda de score, mas não bloqueia captura sozinho. Contribuição relativa fica a critério do planner/researcher (sugestão: peso ~0.15-0.20 dentro do `overallScore`).

- **D-07 (limiares de qualidade — 4 níveis):**
  | Nível | Faixa | Comportamento |
  |---|---|---|
  | Ruim | `score < 0.40` | Feedback negativo dominante, sem captura |
  | Regular | `0.40 ≤ score < 0.75` | Feedback de ajuste, sem captura |
  | Boa | `0.75 ≤ score < 0.90` | **Auto-captura dispara** após estabilidade |
  | Excelente | `score ≥ 0.90` | Auto-captura imediata, badge "Excelente" |

### UX de qualidade e persistência

- **D-03 (UI dos 4 níveis):** Indicador visual no viewfinder mostra o nível atual em tempo real (cor + label: vermelho/Ruim, amarelo/Regular, verde-claro/Boa, verde-escuro/Excelente). Posicionamento e estilo final ficam a critério do planner; sugestão: chip ou barra horizontal no topo do viewfinder.

- **D-04 (persistência):** `quality_score` (float numérico) salvo em `reading_images.quality_score` por foto. **Sem schema change** — coluna já existe no SPEC §3. Label dos 4 níveis é **derivado client-side** dos limiares D-07 (sem coluna nova).

- **D-05 (forward Fase 7):** Badge de qualidade será exibido no relatório final (UI da Fase 7). Esta fase só garante a persistência do `quality_score`; renderização do badge fica para a Fase 7.

### Pós-captura

- **D-09 (preview passivo):** Após captura bem-sucedida:
  1. Foto aparece em **preview passivo de ~2s** com label de qualidade.
  2. Tap na foto → reseta o slot atual e volta para o viewfinder do mesmo `(eye, angle)` para refazer.
  3. Sem tap → upload em background + transição para o próximo `(eye, angle)`.
  4. Upload **não bloqueia** o avanço — telemetria visual de upload em background no canto da tela.

### Instruções entre ângulos

- **D-10 (híbrido):** Estratégia de instrução varia por tipo de transição:
  - **Entre ângulos do mesmo olho** (frontal→lateral, lateral→backlight): **overlay inline** no viewfinder. Câmera continua ativa, banner de instrução aparece no topo/rodapé por ~2-3s, depois minimiza para chip discreto.
  - **Transição de olho** (3ª captura → 4ª, ou seja, `right/backlight → left/frontal`): **tela interstitial dedicada** — câmera para, full-screen com diagrama do novo olho + texto "Vamos para o olho esquerdo" + botão "Pronto, vou capturar".

- **D-11 (conteúdo da instrução):** **Ícone vetorial SVG** do olho com seta indicando o ângulo. Sem fotos/ilustrações externas (sem dependência de asset gráfico real). Variantes:
  - Frontal: olho de frente + seta direta (↓)
  - Lateral: olho de frente + seta lateral (↗ ou ↖)
  - Backlight: olho com indicador de luz por trás (☼ atrás do contorno)
  Implementação como componente React SVG inline em `components/capture/AngleIcon.tsx` (criar).

### Recovery e abandono

- **D-12 (banner automático de recovery):** Ao reabrir o app (PWA ou navegador) com **leitura incompleta** (`status='pending'` AND `count(reading_images) < 6`), o sistema mostra **banner automático** no topo do dashboard ou em `/leituras`:
  > "Você tem uma leitura incompleta de [Nome do Cliente]. Continuar?"
  CTAs: `Continuar` (vai para `/leituras/nova/capturar?reading=[id]&resume=true`) | `Descartar` (apaga reading + imagens parciais com confirmação).
  Justificativa: terapeuta não vai lembrar; o app precisa lembrar por ele.

- **D-13 (cancelar mantém rascunho):** Botão "Cancelar leitura" durante o fluxo de captura **sai do fluxo mas preserva** o reading parcial como rascunho. Sem hard delete por engano. O rascunho fica visível em:
  - Banner automático de recovery (D-12) ao reabrir.
  - Listagem `/leituras` com badge "Em andamento" (forward — UI da listagem em fase futura, mas a query precisa filtrar status corretamente).
  Hard delete só via CTA explícito "Descartar" no banner de recovery (D-12) ou via página do reading.

### PWA e edge cases

- **D-14 (PWA install — banner proativo):** Antes da 1ª captura, o app mostra **banner proativo recomendando** instalar como PWA. Estratégia:
  - **Android Chrome:** usa `beforeinstallprompt` para prompt nativo do browser, disparado pelo CTA do banner.
  - **iOS Safari:** banner com instruções visuais ("Toque em ⎙ → 'Adicionar à Tela de Início'") já que iOS não expõe API de instalação.
  - Banner é **dismissable** — não força. Recomendação forte mas não bloqueante.
  - Mostrado **apenas antes da 1ª captura** (não em todas as visitas) para evitar nag.
  - LocalStorage flag `pwa_install_banner_dismissed_at` para suprimir após dismiss explícito (TTL ~7 dias).

- **D-15 (câmera negada — tela de erro com fallback):** Se `getUserMedia` rejeitar (permissão negada, browser sem suporte, ou `NotFoundError`):
  - **Tela de erro dedicada** com:
    - Diagnóstico claro do problema ("Câmera não disponível" / "Permissão negada").
    - Instruções **passo a passo** de como reabilitar a permissão (iOS Safari, Chrome Android, Chrome Desktop).
    - Botão "Continuar via upload desktop" → link para `/leituras/nova/upload`.
  - **Em Fase 3, `/leituras/nova/upload` é placeholder** ("Upload desktop em breve — disponível em [Fase 4]"). O botão fica funcional automaticamente quando a Fase 4 implementa a página real, sem refactor.

### Compressão e upload

- **D-16 (compressão pré-upload):** Cada foto é comprimida client-side antes do upload:
  - Formato: **JPEG quality 0.85**.
  - Resolução: **max 2048px** no maior lado (mantém aspect ratio).
  - Tamanho-alvo: **~500KB por foto** (~3MB por leitura completa de 6 imagens).
  - Justificativa: 4G brasileiro torna 18MB+ por leitura inaceitável; 0.85 + 2048px preserva detalhe suficiente para o pipeline de visão (Fase 5) — validação final no spike da Fase 5.
  - Implementação sugerida: `Canvas.toBlob('image/jpeg', 0.85)` após resize via canvas.

### Claude's Discretion

- **Posicionamento exato e estilo do indicador de qualidade** (chip top-right, barra full-width topo, etc.) — desde que respeite os 4 níveis com mapeamento de cor.
- **Animação de transição** entre `(eye, angle)` — fade, slide, ou cut direto.
- **Janela de estabilidade** para auto-captura (sugestão: 300-500ms de score consistente em "Boa+", mas planner pode ajustar com base em testes).
- **Forma exata do banner de recovery** (modal blocking vs banner dismissable inline) — desde que apareça automaticamente.
- **Estratégia de service worker** para a Fase 3 — manifest é mandatório; SW pode ser mínimo (instalabilidade only) sem cache offline rico (deferido para Fase 9 polish).
- **Telemetria de upload** (toast, spinner inline, progress bar) — desde que não bloqueie avanço para o próximo ângulo.
- **Componente `AngleIcon.tsx`** — formato exato do SVG fica a critério do executor; basta ser legível em mobile.
- **Tratamento de erro de upload** (retry automático, fila local, fallback) — sugestão: retry 2x com backoff, depois marca foto com `upload_failed=true` (campo a adicionar via metadata se necessário) e permite retry manual no preview.
- **Hooks customizados** (ex: `useCamera`, `useQualityScore`, `useReadingDraft`) — organização interna fica a critério do planner.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Especificação fonte
- `SPEC.md` §1 — Stack tecnológico (getUserMedia + MediaPipe Face Mesh, Supabase Storage com bucket privado)
- `SPEC.md` §2 — Estrutura de pastas (`leituras/nova/capturar/page.tsx`, `components/capture/CameraView.tsx`, `components/capture/IrisDetector.tsx`)
- `SPEC.md` §3 — Schema do banco (`readings.capture_method`, `readings.status`, `reading_images` com `eye`, `angle`, `storage_path`, `quality_score`, `width`, `height`)
- `SPEC.md` §4.1 — Validação on-device com `QualityCheck` (irisDetected, irisCenteredness, irisDistanceOk, sharpness, exposure, reflexInIrisCenter, eyelidOcclusion → overallScore)
- `SPEC.md` §7 Fase 2 — Roadmap original de Captura mobile (4-6 dias)

### Requisitos
- `.planning/REQUIREMENTS.md` — CAPTURE-01, CAPTURE-02, CAPTURE-03, CAPTURE-04, CAPTURE-05, CAPTURE-06
- `.planning/ROADMAP.md` Fase 3 — Goal, Depends on (Fase 2), Success Criteria (5 itens)

### Projeto e restrições
- `.planning/PROJECT.md` — Restrições LGPD (bucket privado, dados biométricos em sa-east-1), métrica de sucesso dogfooding-first
- `.planning/intel/constraints.md` — 21 constraints sintetizadas; especialmente seções de schema, RLS e protocols (Storage signed URLs)

### Fases anteriores
- `.planning/phases/01-setup/01-CONTEXT.md` — D-05 (Vercel gru1 + Supabase sa-east-1), D-12 (RLS policies), D-13 (teste cross-terapeuta), D-08 (migrations versionadas em `supabase/migrations/`)
- `.planning/phases/02-auth-dashboard-basico/02-CONTEXT.md` — D-09 (sidebar), D-13 (`/clientes/[id]` é o ponto onde o botão "Nova Leitura" vive), código existente em `app/(dashboard)/clientes/[id]/page.tsx` e `app/(dashboard)/leituras/page.tsx`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `apps/web/components/ui/*` — shadcn/ui componentes adicionados na Fase 2: `button`, `card`, `input`, `label`, `form`, `toast`, `sidebar`, `avatar`, `badge`, `dropdown-menu`, `separator`, `table`, `dialog`, `select`, `textarea`, `skeleton`. **Reutilizáveis na Fase 3:**
  - `dialog` — confirmação de descartar rascunho (D-13/D-12), modal de erro de câmera (D-15)
  - `button` — todos os CTAs do fluxo
  - `card` — preview passivo (D-09), tela interstitial entre olhos (D-10)
  - `badge` — label dos 4 níveis de qualidade (D-03), indicador "Em andamento" no recovery
  - `toast` — telemetria de upload em background (D-09)
  - `skeleton` — estados intermediários de carregamento
- `apps/web/lib/supabase/client.ts`, `server.ts`, `middleware.ts` — clients criados na Fase 2; reutilizar para queries de `readings` e `reading_images`. Para upload ao Storage, usar o client browser.
- `apps/web/lib/utils.ts` — `cn()` helper (tailwind-merge + clsx)
- `apps/web/types/database.ts` — tipos gerados do Supabase incluem `readings`, `reading_images`, `clients`, `profiles`. Usar `Database['public']['Tables']['readings']['Insert']` para criar reading e `['reading_images']['Insert']` para inserir cada imagem.
- `apps/web/app/actions/clients.ts` — server actions de Fase 2 (CRUD clientes); padrão para criar `app/actions/readings.ts` (criar reading, finalizar reading, descartar reading) na mesma convenção.
- `apps/web/app/(dashboard)/clientes/[id]/page.tsx` — botão "Nova Leitura" já presente (Fase 2 D-08); precisa ser ativado para apontar para `/leituras/nova/capturar?cliente=[id]` ou criar reading inline.
- `apps/web/app/(dashboard)/leituras/page.tsx` — listagem de leituras (Fase 2); precisa receber filtro de `status='pending'` para mostrar rascunhos com badge "Em andamento" (forward — banner de recovery D-12 referencia esta listagem).

### Established Patterns

- **Server actions sob `app/actions/`** com Zod validation (Fase 2) — replicar para `readings.ts`.
- **`(dashboard)/` layout** com sidebar fixa (Fase 2 D-09) — fluxo de captura **sai** do `(dashboard)` layout (sem sidebar) para usar tela cheia em mobile. Considerar `app/(capture)/leituras/nova/capturar/page.tsx` como route group separado, OU usar o mesmo layout com `<Sidebar>` condicionalmente oculta.
- **RLS pattern** (Fase 1 D-12, Fase 2 verificada) — `auth.uid() = therapist_id` em todas as queries. `readings.therapist_id` deve ser preenchido via `auth.uid()` no insert.
- **Migrations versionadas** em `supabase/migrations/` — qualquer ajuste de schema (improvável nesta fase) entra como nova migration. **Schema atual já cobre Fase 3** — sem migration necessária.
- **Storage policies RLS** — bucket precisa ter policies de `INSERT/SELECT/DELETE` por `auth.uid() = (storage.foldername(name))[1]::uuid`. Verificar se já está aplicado na Fase 1 ou criar migration de policies de Storage nesta fase.

### Integration Points

- **Entry point 1:** `app/(dashboard)/clientes/[id]/page.tsx` — botão "Nova Leitura" (já existe, ativar nesta fase).
- **Entry point 2:** `app/(dashboard)/leituras/nova/page.tsx` — **a criar** (pega `clientId` opcional via query param, mostra dropdown de seleção de cliente, cria reading row, redireciona para `/leituras/nova/capturar?reading=[id]`).
- **Capture page:** `app/(capture)/leituras/nova/capturar/page.tsx` ou `app/(dashboard)/leituras/nova/capturar/page.tsx` — **a criar**, fluxo principal.
- **Upload fallback (D-15):** `app/(dashboard)/leituras/nova/upload/page.tsx` — placeholder em Fase 3, real em Fase 4.
- **Server actions:** `app/actions/readings.ts` — `createReading(clientId)`, `finalizeReading(readingId)`, `discardReading(readingId)`, `resumeReading(readingId)` (queries para detectar rascunho).
- **Storage upload:** browser → Supabase Storage bucket privado direto (ou via server action com signed URL — decisão do planner).
- **Componentes a criar:**
  - `components/capture/CameraView.tsx` — getUserMedia wrapper, gerencia stream
  - `components/capture/IrisDetector.tsx` — MediaPipe Face Mesh integração
  - `components/capture/QualityIndicator.tsx` — UI dos 4 níveis (D-03)
  - `components/capture/CapturePreview.tsx` — preview passivo 2s + tap-to-refazer (D-09)
  - `components/capture/AngleIcon.tsx` — SVG do olho + seta (D-11)
  - `components/capture/AngleInterstitial.tsx` — tela full-screen entre olhos (D-10)
  - `components/capture/AngleOverlay.tsx` — overlay inline entre ângulos (D-10)
  - `components/capture/CameraDeniedScreen.tsx` — fallback D-15
  - `components/capture/PWAInstallBanner.tsx` — banner D-14
  - `components/capture/RecoveryBanner.tsx` — banner D-12 (pode viver em `components/dashboard/` se for global no dashboard)

</code_context>

<specifics>
## Specific Ideas

- **MediaPipe Face Mesh:** usar `@mediapipe/tasks-vision` (citado verbatim no SPEC §4.1). Bundle size é considerável (~3-5MB) — researcher deve avaliar lazy-load só na rota de captura, não no app inteiro.
- **Indices de íris no MediaPipe:** SPEC §4.1 cita "468-477 (olho direito) e 473-477 (olho esquerdo)" — usar como referência canônica para extração de landmarks.
- **Câmera traseira:** `getUserMedia({ video: { facingMode: { exact: 'environment' } } })` — exact pra evitar fallback para frontal silencioso.
- **PWA install banner em iOS:** texto literal sugerido — "Para instalar: toque em ⎙ na barra do Safari → 'Adicionar à Tela de Início'". Validar wording final com o fundador antes de produção.
- **Vocabulário proibido (PROJECT.md):** nenhuma string nesta fase pode usar "diagnóstico", "tratamento", "cura". Mensagens de feedback live ("ótima — capturando", "aproxime mais", "muito reflexo") são neutras e estão alinhadas. Validar copy em UI review.
- **Recovery — dedupe de banner:** se o terapeuta dispensar o banner de recovery N vezes, considerar suprimir. Default: mostrar sempre até o rascunho ser completado ou descartado explicitamente. Reavaliar com base em uso real.
- **Telemetria de qualidade:** considerar logar (sem PII) o histograma de `overallScore` por captura para entender em que faixa o terapeuta consegue fotos boas. Útil para tunar limiares (D-07) com base em uso real. Implementação opcional, planner decide.

</specifics>

<deferred>
## Deferred Ideas

- **Service worker offline-first com cache rico** — Fase 9 (Polish). Nesta fase, SW mínimo apenas para instalabilidade.
- **Tema visual / identidade Aurel Iris** (cor base, modo dark, tipografia) — Fase 9. shadcn defaults zinc/slate continuam suficientes.
- **Listagem completa `/leituras` com filtros, busca, paginação** — Fase 7 (quando houver volume real) ou polish em Fase 9. Nesta fase, basta exibir rascunhos com badge "Em andamento" (forward para D-12).
- **Termo de consentimento LGPD por cliente antes de capturar** — Fase 8. Esta fase **não bloqueia** captura por falta de termo; gate de termo entra na Fase 8.
- **Logs de auditoria de acesso a Storage** — Fase 8 (LGPD-05). Nesta fase, RLS é suficiente; auditoria estruturada vem depois.
- **Upload em chunks / resumível** — não necessário para 500KB JPEGs. Reavaliar se algum dia o limite subir.
- **Detecção de heterocromia ou anomalias na captura** — não é função desta fase; o pipeline de visão (Fase 5) extrai features. Captura só garante qualidade de imagem.
- **Modo "captura assistida" remota** (terapeuta vê tela de outro dispositivo) — fora do MVP.
- **Multi-foto por ângulo** (3 frames por ângulo, melhor é selecionado) — interessante para qualidade mas adiciona complexidade. Reavaliar pós-dogfooding (Estágio 1).
- **Edição de metadata da leitura** (data da consulta, notas) — pode ser feito no detalhe do reading em fase futura. Por ora, reading é criado vazio com `created_at` automático.
- **Compressão WebP** — melhor compressão que JPEG mas suporte iOS Safari ainda inconsistente em alguns devices antigos. JPEG 0.85 (D-16) é o seguro. Reavaliar quando WebP for universal.

</deferred>

---

*Phase: 03-captura-mobile-pwa*
*Context gathered: 2026-05-01*
