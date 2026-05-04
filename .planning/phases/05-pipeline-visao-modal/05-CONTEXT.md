# Phase 5: Pipeline de visão (Modal) - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Dada uma leitura com 6 imagens já no Storage privado (entregues pela Fase 3 — captura mobile — ou Fase 4 — upload desktop), o pipeline Modal `analyze_iris(reading_id, image_urls)` produz o JSON canônico de features (SPEC §4.3) e o grava em `readings.vision_features` com `status='ready'` (ou `failed` em erro). A leitura transita autonomamente `pending → processing → ready/failed` sem intervenção manual no caminho feliz.

Concretamente:

- **Repositório separado** `vision-service/` (já scaffolded em Fase 1) é onde o pipeline real é implementado. Modal app `aurel-iris-vision`, função `analyze_iris` decorada com `@app.function(image=image, gpu="T4", timeout=120)`. Skeleton já contempla `opencv-python-headless`, `numpy`, `scikit-image`, `mediapipe`, `torch`, `torchvision`, `Pillow`, `supabase` (ver `vision-service/requirements.txt`). Pesos e dados ficam em `vision-service/models/` (vazio hoje) e `vision-service/data/` (a criar).
- **6 etapas na ordem prescrita por SPEC §4.2:** `detect → segment → compose → normalize → enhance → features`. Cada etapa é módulo Python em `vision-service/pipeline/` (skeletons já existem, todos `raise NotImplementedError`). Bibliotecas MVP locked em SPEC §4.4: MediaPipe Face Mesh (detect, indices 468–477 / 473–477), Hough Transform circular OpenCV (segment baseline), heurísticas OpenCV (lacunas/criptas), HSV clustering (cor). U-Net pré-treinada em CASIA-Iris é v1.1, **fora desta fase**.
- **Trigger via rota dedicada** `app/api/readings/[id]/process/route.ts` (a criar). `finalizeReadingAction` (`apps/web/app/actions/readings.ts:98`, hoje com TODO `Fase 5:` na linha 112) chama essa rota internamente após confirmar 6/6 imagens. A rota também é exposta para retry manual (botão `Reprocessar`).
- **Call style:** Modal `.spawn()` (async fire-and-forget). A rota dispara, atualiza `status='processing'` e retorna em <1s. Modal processa em background e POSTa para o webhook quando termina. **Não bloqueia** o Server Action nem a UI.
- **Webhook callback** em `app/api/vision/webhook/route.ts` (a criar). Valida HMAC com `MODAL_WEBHOOK_SECRET` (env já provisionada em `apps/web/.env.example` desde Fase 1), aplica `vision_features` JSON e seta `status='ready'`/`'failed'`, preenche `processed_at`. Idempotência por **status guard** (D-T7).
- **Imagens são entregues ao Modal via signed URLs** geradas pelo Next.js no momento do trigger, com **TTL de 10 minutos** (D-T8). Vision-service usa o `supabase` Python client com a service role NÃO; é apenas um consumidor HTTP das URLs assinadas (sem credenciais Supabase no container Modal).
- **Status visível na listagem `/leituras`:** badge `Processando` (cinza/amarelo) durante `status='processing'`, `Pronto` (verde) em `ready`, `Falhou` (vermelho) com tooltip + botão `Reprocessar` em `failed`. **Sem polling client-side nesta fase** — `revalidatePath('/leituras')` no webhook handler suficiente; terapeuta atualiza navegando.
- **Mapa setorial Jensen** (hour → zonas orgânicas em pt-BR) mora em **JSON asset versionado** `vision-service/data/jensen-map.json`, com chaves separadas para `right` e `left` (assimetria Jensen — coração só no esquerdo, apêndice/válvula ileocecal só no direito, etc.). Fonte autoritativa: **Jensen Vol. 1 (1982 pt-BR)**, mesmo livro indexado em RAG na Fase 6 (D-J3 abaixo aproveita consistência features↔RAG).
- **Soft degradation per-eye** (D-F1): pipeline produz `right_eye`/`left_eye` parciais com `image_quality.composite_score` baixo + `image_quality.warnings: ['<stage>_<reason>']` em vez de hard-fail. Reading só vai para `failed` quando *nenhum* olho consegue produzir block de features mínimo (sem `constitution.primary` em ambos, por exemplo). `asymmetry_notes` carrega flags como `unilateral_analysis_only_right_eye` quando aplicável.
- **Testes por etapa** (ROADMAP exige ≥1 caso de regressão por etapa) rodam em **pytest local CPU + GitHub Actions** sem GPU, sem Modal cloud. Fixtures: ~6–10 fotos de íris consentidas pelo founder (auto-consentimento ou termo escrito de sujeitos), commitadas em `vision-service/tests/fixtures/iris/` com `CONSENT.md` ao lado.
- **Style de assertion:** **híbrido** — structural (shape, ranges válidos, contrato JSON respeitado) + 1 métrica numérica calibrada por fixture (ex: `detect`: IoU >= 0.7 com bbox manual; `features`: `constitution.primary == expected`). Snapshot/golden rejeitado por fragilidade.

**Fora do escopo desta fase:**

- **Tela de detalhe do reading** (`/leituras/[id]`) — Fase 7 (Análise LLM). Aqui só badge na listagem. Stub de `/leituras/[id]` **não** é criado nesta fase.
- **U-Net pré-treinada CASIA-Iris** (segmentação superior) — v1.1, fora do MVP. Hough Transform OpenCV é baseline.
- **CNN própria de detecção de lacunas/criptas** — v2 (depende de banco de casos consentido, ver PROJECT.md tese de moat).
- **`keep_warm` Modal** (container sempre quente) — fora; cold-start de ~10–30s aceito (D-F3). Reavaliar pós-Estágio 2 quando volume justificar.
- **Polling client-side, Supabase Realtime, push notifications** — fora; revalidate via `revalidatePath` é suficiente para dogfooding-first. Live updates ficam para Fase 7 ou polish da Fase 9.
- **RAG retrieval, geração de relatório LLM** — Fase 6 e Fase 7. Aqui só features JSON.
- **LGPD termo de consentimento por cliente** — Fase 8.
- **Auditoria de logs de acesso a Storage** — Fase 8 (LGPD-04).
- **Multi-mapa simultâneo (Jensen + Jausas + Hidalgo)** — v2, locked-out em PROJECT.md.
- **Mapas Jausas e Hidalgo** — v2. Estrutura do JSON asset prevê multi-mapa (chave `map_name='jensen'` na raiz) mas só Jensen é populado.
- **Auto-retry server-side de erros transitórios** — fora; retry é manual via `Reprocessar` (D-T3). Auto-retry, se necessário, é polish futuro.
- **Snapshot/golden tests por etapa** — explicitamente rejeitado por fragilidade; structural+metric híbrido é suficiente.
- **Modal CI integration test** (rodar `analyze_iris` real em GH Actions) — fora; smoke manual antes de `modal deploy`.

</domain>

<decisions>
## Implementation Decisions

### Trigger e fluxo de chamada do Modal

- **D-T1 (rota dedicada + .spawn()):** `analyze_iris` é chamado via `app/api/readings/[id]/process/route.ts` (a criar). `finalizeReadingAction` chama essa rota internamente após persistir 6 imagens; a rota usa Modal `.spawn()` (async fire-and-forget), atualiza `readings.status='processing'` e retorna 202 em <1s. **Mesma rota é alvo do botão `Reprocessar` (D-T3)** — separação clara entre "captura terminou" (`finalizeReadingAction`) e "rodar pipeline" (route handler), facilitando retry e observabilidade.
- **D-T2 (UX pós-finalize: redirect listagem):** Após `finalizeReadingAction` + dispatch da rota, redirect imediato para `/leituras`. Reading aparece com badge `Processando`. Sem polling client-side; quando webhook chega, `revalidatePath('/leituras')` força server-side re-render no próximo navegação. Casa com fluxo real de consultório (terapeuta termina captura, conversa com cliente, depois vê relatório). Live update real-time é opt-in futuro.
- **D-T3 (botão Reprocessar para failed):** Linhas com `status='failed'` na listagem mostram badge vermelho `Falhou` + botão discreto `Reprocessar` que faz POST na mesma rota dedicada. **Sem auto-retry server-side** nesta fase. Habilita fundador, em dogfooding, a recuperar de erro transitório (cold start estourando, timeout de rede, foto borderline) sem refazer captura inteira.
- **D-T4 (status guard como idempotência):** Webhook handler **só aplica payload** se reading atual tem `status='processing'`. Se já é `ready`/`failed`/`edited`, retorna 200 sem fazer nada (Modal pode fazer retry interno). Garante que webhook tardio não sobrescreve `ai_report_edited` da Fase 7.
- **D-T5 (Modal call ID em processing_metadata):** Trigger persiste `modal_call_id` em `readings.vision_features = { processing_metadata: { modal_call_id: '...' } }` ANTES do `.spawn()` retornar. Webhook valida match opcionalmente para defesa em profundidade — se vier de outra execução, loga warning mas aceita (status guard de D-T4 é a barreira primária).
- **D-T6 (signed URL TTL = 10 minutos):** Trigger gera signed URLs Supabase Storage com `expiresIn: 600` segundos. Cobre cold-start Modal (~10–30s) + jitter + retry interno. Janela de exposição LGPD curta — signed URL vazada em log do Modal expira rápido. Pipeline que demora mais que 10min já está em estado degenerado e vai falhar de qualquer jeito.

### Comportamento em falha

- **D-F1 (per-eye soft degradation):** Pipeline continua se ao menos 1 ângulo de cada olho fica processável. Se um olho inteiro falha (3/3 ângulos quebram em `detect` ou `segment`), o block desse olho fica `null` e `asymmetry_notes` registra `unilateral_analysis_only_<right|left>_eye`. **Reading vira `ready`**, não `failed`. Falha real (`status='failed'`) só quando produto não entrega *nada* útil — ambos olhos null, ou erro estrutural irrecuperável (timeout 120s, exceção não-tratada, OOM GPU).
- **D-F2 (UX failed na listagem):** Badge vermelho `Falhou` + tooltip com `processing_metadata.error_summary` (string curta em pt-BR, ex: `Imagens com pouca luz — tente recapturar`, `Tempo limite excedido — tente novamente`, `Olhos não detectados nas fotos`). Botão `Reprocessar` ao lado. **Catálogo curto de error_summary strings** definido nesta fase (3–6 strings) cobre os casos comuns; expansão futura à medida que o pipeline matura. **Vocabulário proibido (LGPD)** auditado: nenhum `diagnóstico`, `tratamento`, `cura` nas strings.
- **D-F3 (cold-start aceito, sem keep_warm):** Container Modal sobe sob demanda quando uma leitura é finalizada. Custo zero quando ninguém está usando — alinhado com PROJECT.md envelope ~$30–80/mês. Em dogfooding (3 leituras/semana), `keep_warm` queimaria orçamento sem benefício. Reavaliar quando volume crescer (Estágio 2 com 10–20 terapeutas concorrentes).
- **D-F4 (idempotência por status guard):** ver D-T4 acima — webhook só age em `status='processing'`. Aplicado consistentemente também ao webhook `failed` (status já é `failed` → no-op).
- **D-F5 (atomicidade do update):** Webhook handler atualiza `readings` em **um único UPDATE** (vision_features + status + processed_at + error_summary [se failed] na mesma transação). Evita estado intermediário onde `vision_features` foi gravado mas `status` ainda é `processing` por falha de rede mid-update.

### Mapa setorial Jensen (asset canônico do produto)

- **D-J1 (JSON asset versionado):** `vision-service/data/jensen-map.json` é a fonte canônica do mapeamento `hour → zones[]`. Lido por `vision-service/pipeline/features.py` (ou helper dedicado `pipeline/iris_maps.py`) para popular `sectors[*].zones`. Comitado no repo, versionado junto com código. **Mudança no mapa exige redeploy do Modal app** — aceitável dado que mapa Jensen é clássico e estável.
- **D-J2 (idioma das zonas em pt-BR):** Strings em português: `fígado`, `vesícula`, `pulmão lóbulo superior`, `tireoide`, `cérebro frontal`, `coração`, etc. LLM da Fase 7 cita literalmente no relatório (pt-BR) sem tradução intermediária. **Auditoria de vocabulário proibido** (LGPD) corre direto sobre o JSON via `pnpm audit:vocabulary` (ou equivalente Python no vision-service). **Consistência forward Fase 6** — chunks RAG em pt-BR usam mesmas strings de zona, viabilizando match feature↔RAG.
- **D-J3 (fonte autoritativa: Jensen Vol. 1 1982 pt-BR):** Mesma edição que será indexada em RAG na Fase 6 (`Jensen Iridologia Vol. 1`). Garante que LLM, ao citar `[ancorado em: features.sectors.7.zones=fígado,vesícula]`, recupera chunks que falam exatamente da mesma decomposição setorial. **Founder valida o mapa** antes de commit (planner gera draft a partir do livro, founder revisa como iridologista em exercício).
- **D-J4 (mapa por olho separado):** JSON estrutura `{map_name: 'jensen', right: {1: ['cérebro frontal'], 7: ['fígado', 'vesícula'], ...}, left: {1: ['cérebro frontal'], 9: ['coração', 'esternônio'], ...}}`. Respeita assimetria de Jensen sem lógica de "exceções" — cada olho é dict completo. Pipeline lê `JENSEN_MAP[eye][hour]` direto. ~2× tamanho do JSON aceito pela clareza.

### Testes por etapa + fixtures

- **D-X1 (founder grava set próprio):** ~6–10 fotos de íris (founder + sujeitos consentidos com termo escrito) capturadas via PWA Fase 3 ou câmera profissional. Cobertura: 3 ângulos × 2 olhos + ≥1 caso de qualidade ruim e ≥1 caso de constituição diferente. Commitadas em `vision-service/tests/fixtures/iris/<eye>_<angle>_<id>.jpg`. Acompanha `vision-service/tests/fixtures/CONSENT.md` documentando self-consent (founder) ou path para termo PDF (sujeitos terceiros, não-commitado).
- **D-X2 (pytest local CPU + GH Actions):** Testes rodam em `pytest vision-service/tests/` usando OpenCV/MediaPipe em CPU. Sem GPU, sem Modal cloud. CI em GitHub Actions com matrix Python 3.11+. **Integration test ponta-a-ponta `analyze_iris`** (que requer Modal cloud) é manual antes de `modal deploy`, **não em CI**. Custo CI = $0.
- **D-X3 (assertion híbrido — structural + 1 metric):** Cada teste de etapa valida shape e ranges sensíveis (`isinstance`, `0 <= score <= 1`, `mask.shape == image.shape[:2]`) **mais** uma métrica numérica calibrada por fixture (ex: `detect`: IoU >= 0.7 com bbox manual anotada na fixture; `features`: `constitution.primary == expected_from_founder`). Anotação manual das fixtures (founder marca `expected_constitution`, `expected_iris_bbox`, `expected_findings_per_sector` em arquivo `vision-service/tests/fixtures/expected.json`) feita uma vez upfront.
- **D-X4 (fixtures commitadas + CONSENT.md):** ~3–5 MB total após downsize para 1024px JPEG q=0.85. Commit direto no git (sem LFS — overhead não vale para 5MB). **Repo segue privado até LGPD review da Fase 8** — qualquer abertura futura passa por revisão jurídica (PROJECT.md `revisão jurídica healthtech`). `.gitattributes` documenta política se necessário.

### Schema do `processing_metadata`

- **D-PM1 (campos mínimos):** Pipeline preenche, no top-level do JSON retornado:
  - `model_version`: string semver `pipeline_<MAJOR>.<MINOR>.<PATCH>` (ex: `pipeline_0.1.0`); incrementa quando lógica de etapa muda materialmente. Versão inicial: `0.1.0`.
  - `processing_time_ms`: tempo total do pipeline (sem cold-start, medido dentro de `analyze_iris`).
  - `modal_call_id`: ID da FunctionCall Modal (para correlação com logs).
  - `stages_timing_ms`: dict `{detect: ..., segment: ..., compose: ..., normalize: ..., enhance: ..., features: ...}` para observabilidade de regressão de performance.
  - `warnings`: lista de strings curtas (`['hough_segment_failed_left_backlight', 'mediapipe_face_not_detected_right_lateral']`) acumuladas por etapa quando ocorrem falhas degradadas (D-F1).
  - `error_summary`: string em pt-BR para UI quando `status='failed'`. Vazia/ausente em `ready`.
- **D-PM2 (atomic write):** webhook escreve `vision_features` jsonb, `status`, `processed_at` em uma única `UPDATE` (D-F5). Sem updates parciais.

### Asymmetry notes

- **D-A1 (vision-service computa):** Após features extraídas para ambos olhos, etapa `features` (ou pós-`features` orquestrado pelo `analyze_iris`) compara `right_eye`/`left_eye` e produz lista de strings em pt-BR snake_case_ish: `lacuna_unilateral_setor_7_direito`, `cor_assimetrica_castanho_direito_azul_esquerdo`, `unilateral_analysis_only_right_eye` (degradação D-F1). LLM da Fase 7 lê e cita literalmente. **Convenção de naming locked nesta fase:** `<feature>_<lado-ou-degradação>_<setor>_<olho>`.
- **D-A2 (lista vazia é estado válido):** `asymmetry_notes: []` quando ambos olhos têm features simétricas — LLM Fase 7 trata como ausência de assimetria, não como erro.

### Catálogo inicial de error_summary (pt-BR, LGPD-compliant)

- **D-E1 (catálogo nesta fase):** strings autoritativas (validador de auditoria de vocabulário proíbe `diagnóstico`/`tratamento`/`cura`):
  - `Imagens com pouca luz — tente recapturar` (image_quality global ruim)
  - `Olhos não detectados nas fotos` (MediaPipe falhou em todas as 6)
  - `Tempo limite excedido — tente novamente` (Modal timeout 120s)
  - `Falha temporária no processamento — tente novamente` (catch-all: exceção não classificada)
  - `Imagens em formato inválido` (Storage retornou erro 4xx)
  - Expansão é polish da Fase 9 ou de hardening pós-dogfooding.

### Claude's Discretion

- **Estrutura interna de `vision-service/pipeline/`** — Claude/planner decide se cria `iris_maps.py`, `quality.py`, helper de signed URL fetch separado, etc. SPEC §4.2 só prescreve as 6 etapas como módulos.
- **Forma exata da assinatura HMAC** — algoritmo (`HMAC-SHA256`), header name (`X-Modal-Signature` recomendado), formato (hex vs base64), timing-safe comparison via `crypto.timingSafeEqual` no handler. Planner pesquisa convenção Modal docs 2026.
- **Estrutura do payload do webhook** — full features JSON (~50KB) inline no body vs `{reading_id, status, modal_call_id, result_ref}` + secondary fetch. Recomendação inicial: full inline (50KB cabe em body POST sem stress); planner pode mudar se Modal best-practice 2026 sugerir outro caminho.
- **Forma exata dos heurísticos OpenCV** para lacunas/criptas — adaptive threshold parameters, morphology kernel size, SPEC §4.4 só diz "threshold adaptativo + morphology". Calibrado contra fixtures do founder (D-X3).
- **HSV clustering exato** para `iris_color` — número de clusters (k-means k=3?), espaço de cor (HSV vs LAB), heurística de classificação (`azul`/`castanho`/`verde-mosaico`/`misto`). Calibrado contra fixtures.
- **Parâmetros do Hough circular** (`HoughCircles`) — minRadius, maxRadius, dp, param1/param2. Calibrado contra fixtures.
- **Implementação do photometric compose** — média ponderada vs decomposição de albedo simples; SPEC §4.2 só diz "3 ângulos → 1 imagem rica". Planner/researcher avalia trade-offs.
- **Formato exato da `daugman_polar`** — resolução do output (256×512 padrão na literatura?), interpolação. Convenção da literatura biométrica.
- **Parâmetros do CLAHE** (`createCLAHE`) — clipLimit, tileGridSize. Defaults OpenCV recomendados como ponto de partida.
- **Naming convention exato dos warnings em `processing_metadata.warnings`** — `<stage>_<reason>_<eye>_<angle>` é proposta; planner refina.
- **Naming convention exato dos `asymmetry_notes`** — proposta em D-A1; planner refina se necessário.
- **Posicionamento do badge `Processando`/`Pronto`/`Falhou` na linha da tabela** — Claude/UI design decide.
- **Tooltip rendering library** (shadcn/ui já tem `tooltip` instalado em Fases anteriores; verificar) — usar componente existente.
- **Ferramenta de anotação manual das fixtures** (`expected.json`) — script Python ad-hoc, ou GUI minimal, ou edit manual JSON; planner decide pelo mais barato.
- **Strategy de logging dentro do Modal worker** — `print()` para Modal Cloud logs (default) ou estruturado (`structlog`); planner avalia.
- **CI matrix exata** — Python 3.11 só, ou 3.11+3.12; planner decide com base em runtime de teste.
- **Componente que renderiza badge na listagem `/leituras`** — provável reuso de `<Badge>` do shadcn já presente; copy em pt-BR.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Especificação fonte
- `SPEC.md` §1 — Stack tecnológico (Modal.com serverless GPU T4, Python/OpenCV, timeout 120s, callback HMAC)
- `SPEC.md` §2 — Estrutura de pastas (`vision-service/`, `app/api/readings/[id]/process/route.ts`, `app/api/vision/webhook/route.ts`, `lib/vision/modal-client.ts`)
- `SPEC.md` §3 — Schema (`readings.vision_features jsonb`, `readings.status` enum `pending|processing|ready|failed|edited`, `readings.processed_at`, `readings.capture_method`)
- `SPEC.md` §4.1 — Validação on-device MediaPipe (já implementada Fase 3 em forma de VLM Haiku 4.5; informação histórica para o planner entender ancoragem original)
- `SPEC.md` §4.2 — Pipeline servidor Modal (skeleton + 6 etapas na ordem `detect → segment → compose → normalize → enhance → features`)
- `SPEC.md` §4.3 — **Estrutura JSON canônica de saída** (CRÍTICO — contrato output do pipeline; per-eye blocks, asymmetry_notes, processing_metadata)
- `SPEC.md` §4.4 — Bibliotecas MVP (MediaPipe, Hough OpenCV, heurísticas OpenCV lacunas/criptas, HSV clustering, U-Net diferida v1.1)
- `SPEC.md` §7 Fase 4 — Roadmap original Pipeline de visão / Modal (5–7 dias)

### Requisitos
- `.planning/REQUIREMENTS.md` — VISION-01 (vision-service repo + Modal app), VISION-02 (6 etapas na ordem com bibliotecas MVP), VISION-03 (JSON estruturado conforme SPEC §4.3), VISION-04 (`triggerVisionPipeline(reading_id)` + webhook HMAC)
- `.planning/ROADMAP.md` Fase 5 — Goal, Depends on (Fases 3+4), 5 Success Criteria

### Projeto e restrições
- `.planning/PROJECT.md` — Restrições LGPD (dado biométrico, bucket privado, vocabulário proibido `diagnóstico`/`tratamento`/`cura`); envelope de custo (~$30–80/mês Modal pay-per-use); decisão "Mapa Jensen como default no MVP; Jausas/Hidalgo deferidos para v2"; tese de moat (CNN própria pós-banco-de-casos é v2)
- `.planning/intel/constraints.md` — `Stack — Vision Pipeline` (Modal+T4+120s+HMAC), `Vision Output Contract` (top-level shape + per-eye shape), `Storage` (bucket privado RLS por terapeuta + signed URLs)
- `.planning/intel/SYNTHESIS.md` — Rastreabilidade SPEC↔REQUIREMENTS↔ROADMAP

### Fontes intelectuais (mapa Jensen)
- **Jensen, Bernard. *Iridologia Vol. 1*** (edição 1982 em português). Fonte autoritativa do `jensen-map.json`. **Mesmo livro indexado em RAG na Fase 6.** Founder valida draft do mapa antes do commit.

### Fases anteriores (CRÍTICO — pré-requisitos diretos)
- `.planning/phases/01-setup/01-CONTEXT.md` — D-05 (Vercel gru1 + Supabase sa-east-1, env Modal já provisionada `MODAL_TOKEN_ID`/`MODAL_TOKEN_SECRET`/`MODAL_WEBHOOK_SECRET` em Fase 1)
- `.planning/phases/03-captura-mobile-pwa/03-CONTEXT.md` — D-storage (path `{therapist_id}/{reading_id}/originais/{eye}_{angle}.jpg`); D-08 (reading row criado com `status='pending'`); pipeline VLM Haiku 4.5 já gata qualidade pré-Modal
- `.planning/phases/04-upload-desktop/04-CONTEXT.md` — D-03 (`capture_method` no schema validado), D-04 (capture_method imutável durante draft), D-15 (recovery banner via `getDraftReading`); contrato de `reading_images` populado por ambas vias

### Código existente (a reusar / estender — DETALHADO em `<code_context>`)
- `vision-service/modal_app.py` — esqueleto com decorator `@app.function(image=image, gpu="T4", timeout=120)` e `analyze_iris` que `raise NotImplementedError`. **Implementação real desta fase.**
- `vision-service/pipeline/{detect,segment,compose,normalize,enhance,features}.py` — 6 stubs `NotImplementedError`. **Implementar nesta fase.**
- `vision-service/pipeline/__init__.py` — `from . import compose, detect, enhance, features, normalize, segment`
- `vision-service/requirements.txt` — bibliotecas MVP já listadas
- `apps/web/app/actions/readings.ts:98` — `finalizeReadingAction` com TODO `Fase 5:` na linha 112 (mudar status + chamar trigger)
- `apps/web/.env.example` — `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`, `MODAL_WEBHOOK_SECRET` (Fase 1+)
- `supabase/migrations/0001_initial_schema.sql` — schema com `readings.vision_features jsonb`, `readings.status`, `readings.processed_at`. **Sem migration nova prevista nesta fase** — schema já cobre tudo.
- `supabase/migrations/0004_storage_bucket_iris_captures.sql` — bucket privado iris-captures + RLS folder-based (auth.uid() = primeiro segmento) — pipeline acessa via signed URLs

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

**Modal skeleton (Fase 1 — esqueleto, implementar agora):**
- `vision-service/modal_app.py` — Modal App `aurel-iris-vision`, função `analyze_iris(reading_id, image_urls)` decorada com `@app.function(image=image, gpu="T4", timeout=120)`. Image já tem `opencv-python-headless`, `numpy`, `scikit-image`, `mediapipe`, `torch`, `torchvision`, `Pillow`, `supabase`. **Implementação real substitui o `raise NotImplementedError`.**
- `vision-service/pipeline/__init__.py` — re-exporta os 6 módulos. Mantido.
- `vision-service/pipeline/{detect,segment,compose,normalize,enhance,features}.py` — 6 stubs com docstring + signature já desenhados (ex: `find_iris(image)`, `iris_mask(image, detection)`, `photometric_combine(segmented_images)`, `daugman_polar(composite_image)`, `clahe(normalized_image)`, `extract_all(enhanced_image, composite_image)`). **Substituir o `raise NotImplementedError` por implementação real.**

**Schema (Fase 1 — sem migration nova nesta fase):**
- `readings.status` enum por convenção `pending|processing|ready|failed|edited` — Fase 5 transita `pending → processing → ready/failed`.
- `readings.vision_features jsonb` — destino do JSON canônico SPEC §4.3.
- `readings.processed_at timestamptz` — preenchido pelo webhook handler.
- `reading_images.eye/angle/storage_path/quality_score/width/height` — input do pipeline (consultado pelo trigger para gerar signed URLs).

**Storage (Fase 3 — sem mudança nesta fase):**
- Bucket `iris-captures` privado por terapeuta (RLS folder-based em `storage.objects`). Pipeline consome via signed URLs **temporárias** (TTL 10min, D-T6).
- `apps/web/lib/capture/storage-path.ts` — `buildOriginalStoragePath(therapistId, readingId, eye, angle)`. **Reusável** no trigger para reconstruir paths e gerar signed URLs.

**Server actions (Fase 3+4 — estender, não recriar):**
- `apps/web/app/actions/readings.ts` — `finalizeReadingAction` (linha 98) com TODO `Fase 5` na linha 112. **Estender:** após validar 6/6 imagens, chamar a nova rota `POST /api/readings/[id]/process` server-side (fetch interno) ou disparar diretamente via `lib/vision/modal-client.ts`. Recomendado: chamar a rota dedicada para uniformidade com retry manual.
- `getDraftReading()`, `discardReadingAction()`, `cleanupStaleEmptyReadingsAction()` — neutros, sem mudança.

**UI components (Fase 2+ — reusáveis para badge na listagem):**
- `apps/web/components/ui/badge.tsx` — shadcn `<Badge>` já adicionado; usar `variant` para diferenciar `Processando`/`Pronto`/`Falhou`.
- `apps/web/components/ui/tooltip.tsx` — provavelmente já adicionado em Fases anteriores; verificar e adicionar via `pnpm dlx shadcn add tooltip` se necessário (no plan).
- `apps/web/components/ui/button.tsx` — para botão `Reprocessar`.
- Listagem `/leituras` (Fase 2 placeholder) — provável tela com `<Table>` shadcn; **estender** para renderizar status badge + Reprocessar.

**Ambiente (Fase 1):**
- `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET` — autenticação CLI/server-side com Modal.
- `MODAL_WEBHOOK_SECRET` — segredo HMAC compartilhado entre Modal worker e webhook handler Next.js.

### Established Patterns

- **Server actions sob `apps/web/app/actions/`** com Zod validation (Fases 2/3/4) — estender `readings.ts` mantendo padrão.
- **API route handlers sob `apps/web/app/api/`** — Fase 5 cria `app/api/readings/[id]/process/route.ts` e `app/api/vision/webhook/route.ts` seguindo convenção Next.js 15 App Router.
- **RLS pattern** — `auth.uid() = therapist_id` em queries de `readings`/`reading_images`. **Webhook handler usa service role** (bypass RLS) porque request vem do Modal, não do terapeuta logado — proteger com HMAC + status guard.
- **Migration policy** — schema atual cobre Fase 5; **nenhuma migration prevista**. Caso surja necessidade (improvável), seguir padrão `supabase/migrations/000X_*.sql`.
- **Vocabulário proibido (LGPD)** — `pnpm audit:vocabulary` (script existente Fase 3+) auditável também sobre `vision-service/data/jensen-map.json` e error_summary strings via grep análogo. **Garantir que CI bloqueia** se nova string violar.
- **Bundle splitting / dynamic import** — não se aplica aqui (vision-service é Python; Next.js não importa Modal SDK no client).
- **Path canônico de Storage** — `{therapist_id}/{reading_id}/originais/{eye}_{angle}.jpg` (Fase 3+4). Trigger reconstrói via `buildOriginalStoragePath` ou consulta direto `reading_images.storage_path`.

### Integration Points

- **Trigger entry point:** `finalizeReadingAction` (Fase 3+4 existente) chama interno `POST /api/readings/[id]/process` após validar 6/6 imagens. Server-side fetch com header de auth interno (cookie de sessão Supabase ou shared secret); planner avalia padrão Next.js 15.
- **Process route handler:** `app/api/readings/[id]/process/route.ts` (criar). Lê reading + imagens, gera signed URLs (TTL 10min), chama `Modal.analyze_iris.spawn(reading_id, image_urls)` via SDK Python ou HTTP, atualiza `readings.status='processing'` + `processing_metadata.modal_call_id`. Retorna 202.
- **Modal SDK access from Next.js:** Decisão do planner — opções: (a) chamar Modal via HTTP endpoint público do Modal app (modal exposes web endpoints), (b) shellout para `modal run` em runtime serverless (ruim), (c) Modal Python SDK em runtime separado. **Recomendação: web endpoint Modal** (`modal serve` expõe HTTPS endpoint do `analyze_iris` callable via fetch). Planner pesquisa Modal docs 2026.
- **Webhook callback:** `app/api/vision/webhook/route.ts` (criar). Body: full features JSON SPEC §4.3 + reading_id + modal_call_id. Header HMAC `X-Modal-Signature` validado contra `MODAL_WEBHOOK_SECRET`. Status guard (D-T4) + atomic UPDATE (D-F5).
- **Listagem `/leituras`:** componente atual estende para mostrar badge + Reprocessar. Reusa `<Badge>` shadcn. Copy pt-BR.
- **vision-service ↔ Storage:** worker consome signed URLs (HTTP GET); não usa Supabase service role no container Modal. Mantém princípio de menor privilégio.
- **vision-service ↔ jensen-map.json:** carrega no boot do container ou lazy no primeiro `extract_all`. Padrão recomendado: lazy + `@functools.lru_cache` no helper.

</code_context>

<specifics>
## Specific Ideas

- **Naming exato dos warnings** (`processing_metadata.warnings`): `<stage>_<reason>_<eye>_<angle>` — ex: `hough_segmentation_failed_left_backlight`, `mediapipe_face_not_detected_right_lateral`. snake_case, en (consistente com nome de etapa). Ajustar se planner achar pt-BR mais útil para LLM Fase 7 — atualmente strings só servem para debug e são lidas pela Fase 7 *opcionalmente*.
- **Convenção `error_summary` em pt-BR LGPD-compliant** (catálogo D-E1): "Imagens com pouca luz — tente recapturar", "Olhos não detectados nas fotos", "Tempo limite excedido — tente novamente", "Falha temporária no processamento — tente novamente", "Imagens em formato inválido". **Validar com `pnpm audit:vocabulary` antes de commit.**
- **Convenção de naming `asymmetry_notes`** (D-A1): pt-BR snake_case-ish. Ex: `lacuna_unilateral_setor_7_direito`, `cor_assimetrica_castanho_direito_azul_esquerdo`, `unilateral_analysis_only_right_eye`, `densidade_fibras_assimetrica`. LLM da Fase 7 cita literalmente — qualquer ajuste de naming impacta prompts.
- **Texto do badge na listagem:** "Processando", "Pronto", "Falhou" — pt-BR direto, sem emoji. Tooltip em failed: render literal de `error_summary`.
- **Botão Reprocessar:** ícone `<RefreshCw>` lucide-react (provavelmente já em uso pelas Fases 2–4). Texto "Reprocessar". Disabled enquanto `status='processing'`.
- **Catálogo de zonas Jensen (pt-BR) — alguns exemplos canônicos para o planner anchorar:**
  - Setor 1 (12h, ambos olhos): `cérebro frontal`, `lobo frontal`
  - Setor 7 (~3h olho direito): `fígado`, `vesícula biliar`
  - Setor 9 (~9h olho esquerdo): `coração`, `esternônio`
  - Setor 6 (~6h ambos): `apêndice` (direito), `intestino delgado` (ambos)
  Founder valida e completa o mapa antes do commit.
- **Modal `keep_warm`:** explicitamente `=0` (default) na decoração. Reavaliar pós-Estágio 2.
- **Signed URL TTL:** literal `expiresIn: 600` (segundos) — alinhado com D-T6.
- **HMAC algoritmo:** `HMAC-SHA256` esperado; header `X-Modal-Signature` (convenção Modal); body raw bytes assinados. Planner valida contra Modal docs 2026.
- **Pydantic schema no vision-service** (opcional mas recomendado): definir `IrisFeatures` Pydantic model que valide output antes de retornar. Bloqueia regressão de contrato. Planner decide implementação.
- **Zod schema no Next.js webhook handler:** validar body antes de gravar `vision_features`. Mesmo padrão de Fase 4 (`createReadingSchema`).
- **Telemetria mínima:** contagem de pipelines bem-sucedidos vs falhados em log estruturado (Modal Cloud logs + Vercel logs). Sem PII. Útil pós-dogfooding para entender taxa de falha real.
- **Modal CLI deploy:** `modal deploy modal_app.py` no `vision-service/` durante setup. Fase 5 documenta esse passo no `vision-service/README.md`.
- **CI badge:** GH Actions workflow `vision-service-tests.yml` na raiz `.github/workflows/`.

</specifics>

<deferred>
## Deferred Ideas

- **Polling client-side / Supabase Realtime / push notifications** para atualização live do status — ficou para Fase 7 ou polish da Fase 9. Nesta fase, `revalidatePath` no webhook + navegação manual é suficiente.
- **Tela de detalhe `/leituras/[id]`** — Fase 7 (Análise LLM). Stub não criado nesta fase.
- **`keep_warm`** Modal — fora; reavaliar pós-Estágio 2 quando volume justificar custo fixo.
- **Auto-retry server-side de erros transitórios** — fora; retry é manual via `Reprocessar`. Auto-retry, se virar dor, é polish futuro (Fase 9 ou hardening pós-dogfooding).
- **U-Net pré-treinada CASIA-Iris** para segmentação superior à Hough Transform — v1.1 (PROJECT.md tese de moat).
- **CNN própria de detecção de lacunas/criptas** — v2 (depende de banco de casos consentido).
- **Multi-mapa simultâneo (Jensen + Jausas + Hidalgo)** — v2, locked-out em PROJECT.md.
- **Mapas Jausas/Hidalgo** — v2. Estrutura do JSON suporta mas só Jensen é populado nesta fase.
- **Modal CI integration test** (rodar `analyze_iris` real em GH Actions com Modal cloud) — fora; smoke manual antes de `modal deploy`.
- **Snapshot/golden tests por etapa** — explicitamente rejeitado por fragilidade (D-X3 escolheu híbrido).
- **Modal volume / artifact storage** para resultados intermediários (mascarações, polar, enhanced) — fora desta fase. Pipeline é pure-function: input URLs → output JSON. Se em Fase 7 ou 9 quisermos exibir mapa setorial visual no `IrisMap.tsx`, esse trabalho precisa de uma fase dedicada (talvez parte da Fase 7 ou polish da 9).
- **Pydantic strict no vision-service** rejeitando outputs incompletos como `failed` — D-F1 (per-eye soft degradation) escolhe permissive; Pydantic vira validador de schema, não gate de qualidade.
- **Zod schema no webhook** rejeitando payload com sectors null — webhook aceita o que o vision-service mandou desde que shape de top-level esteja correto; gate de qualidade é responsabilidade do vision-service, não do receptor.
- **Edição manual de features pelo terapeuta** (corrigir constituição, marcar lacuna que pipeline não pegou) — fora do MVP. Fase 7 só permite editar `ai_report_edited` (texto), não `vision_features`.
- **Banco anonimizado de casos** alimentando treinamento futuro (efeito de rede) — v2 (PROJECT.md tese de moat). Privacy review jurídica obrigatória antes de qualquer feature de coleta.
- **Live preview da pipeline para o terapeuta** ("etapa 3/6: compose...") — over-engineering para 30–90s de processamento; UX async (badge `Processando`) é suficiente.
- **Detecção de heterocromia central / setorial estendida** — pode entrar na Fase 5 (já é parte de `iris_color.central_heterochromia` no JSON SPEC §4.3); algoritmo deixado a critério do planner. Detecção mais sofisticada (heterocromia setorial granular) é v2.
- **Telemetria estruturada com OpenTelemetry / Sentry** — fora; logs Modal Cloud + Vercel logs suficientes para Estágio 1.
- **Versionamento de `model_version` via git commit hash** — alternativa ao semver manual; rejeitado por opacidade ao founder. Semver manual `pipeline_X.Y.Z` é a fonte de verdade; bumps acompanham PRs.
- **Webhook signing para outras direções** (Modal aceitar webhook do Next.js) — não se aplica; trigger é HTTP request convencional, não webhook.

</deferred>

---

*Phase: 05-pipeline-visao-modal*
*Context gathered: 2026-05-04*
