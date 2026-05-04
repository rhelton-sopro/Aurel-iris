# Roadmap: Aurel Iris

## Visão geral

Aurel Iris é entregue em 9 fases que espelham o roadmap canônico do `SPEC.md` §7 ("Roadmap em Fases", Fase 0 → Fase 8). A jornada parte da infraestrutura (contas, schema, Next.js inicializado), constrói o esqueleto do consultório virtual (auth + clientes), abre as duas vias de entrada de imagem (PWA mobile com captura validada on-device + dropzone desktop), entrega o coração do produto (pipeline de visão Modal produzindo o JSON de features), monta a base de conhecimento iridológica indexada (RAG via Voyage + pgvector), produz a leitura propriamente dita (Claude Sonnet 4.6 ancorado em features e RAG) e finalmente fecha as bordas comerciais e legais (Stripe BR + LGPD) antes do polish e do gate de dogfooding pelo próprio fundador.

A métrica de sucesso primária do MVP **não é** o lançamento beta com 10–20 terapeutas — é o uso semanal real do fundador (ele mesmo iridologista em exercício) em clientes verdadeiros sem cair de volta em notas manuais. Beta externo é Estágio 2, condicional ao Estágio 1.

## Fases

**Numeração:**
- Fases inteiras (1, 2, …): trabalho planejado de milestone v1.
- Fases decimais (2.1, 2.2): inserções urgentes (futuras), marcadas como INSERTED.

A numeração das fases v1 segue 1–9 (em vez de 0–8 do SPEC) por convenção da ferramenta de planejamento. O mapeamento Fase v1 ↔ Fase SPEC está explícito em cada bloco.

- [x] **Fase 1: Setup** — Infraestrutura (contas, env vars, Next.js init, migration do schema).
- [x] **Fase 2: Auth + Dashboard básico** — Magic-link auth e CRUD de clientes do terapeuta.
- [x] **Fase 3: Captura mobile (PWA)** — App instalável com captura via câmera nativa + validação Claude Haiku 4.5 VLM. Concluída 2026-05-03.
- [x] **Fase 4: Upload desktop** — Dropzone desktop produzindo a mesma estrutura de leitura. Concluída 2026-05-03 (UAT founder + gsd-verifier passed).
- [ ] **Fase 5: Pipeline de visão (Modal)** — Serviço Modal `analyze_iris` produzindo o JSON canônico de features.
- [ ] **Fase 6: RAG — Ingestão da base de conhecimento** — Corpus iridológico chunked, embedded e indexado em pgvector.
- [ ] **Fase 7: Análise LLM** — Relatório iridológico em pt-BR gerado por Claude Sonnet 4.6 ancorado em features + RAG.
- [ ] **Fase 8: Pagamento + LGPD** — Stripe BR (BRL+PIX) com trial 14d e termo de consentimento + direitos LGPD.
- [ ] **Fase 9: Polish + dogfooding + beta** — Onboarding, e-mail transacional, uso semanal real pelo fundador, depois beta com 10–20 terapeutas.

## Detalhes das fases

### Fase 1: Setup
**Mapeamento SPEC:** Fase 0 — Setup (1–2 dias).
**Goal**: Ambiente operacional pronto — contas conectadas, projeto Next.js 15 deployable, banco Supabase com schema completo (incluindo pgvector e RLS) aplicado.
**Depends on**: Nada (primeira fase).
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-04
**Success Criteria** (o que deve ser verdade):
  1. `npm run dev` levanta o app Next.js localmente; deploy de teste na Vercel responde 200 em `/`.
  2. Índice HNSW em `knowledge_chunks(embedding) vector_cosine_ops` está criado e `vector(1024)` aceita inserts dummy.
  3. Variáveis de ambiente para Supabase, Anthropic, Voyage, Modal, Stripe e Resend estão presentes em `.env.local` e em "Vercel → Environment Variables" (mesmo que vazias para serviços ainda não usados).
  4. Tentativa de leitura cross-terapeuta (com dois `auth.uid()` distintos) é bloqueada por RLS.
**Plans:** 6 plans
- [ ] 01-01-PLAN.md — Repo + Next.js 15 scaffold (apps/web/) com Tailwind + shadcn/ui (Wave 1).
- [ ] 01-02-PLAN.md — vision-service/ Python skeleton (Modal app + pipeline/ stubs) (Wave 1).
- [ ] 01-03-PLAN.md — supabase init + migration 0001 com schema SPEC §3 + link projeto remoto sa-east-1 (Wave 2).
- [ ] 01-04-PLAN.md — [BLOCKING] supabase db push --linked + apps/web/types/database.ts (Wave 3).
- [ ] 01-05-PLAN.md — Teste SQL de RLS cross-terapeuta executado contra remoto (Wave 4).
- [ ] 01-06-PLAN.md — .env.example (11 chaves D-11) + vercel.json gru1 + Vercel deploy preview (Wave 4).

### Fase 2: Auth + Dashboard básico
**Mapeamento SPEC:** Fase 1 — Auth + Dashboard básico (2–3 dias).
**Goal**: Terapeuta consegue criar conta, entrar com magic link, navegar pelo dashboard e gerenciar a própria carteira de clientes.
**Depends on**: Fase 1.
**Requirements**: AUTH-01, AUTH-02, AUTH-03, CLIENT-01, CLIENT-02, CLIENT-03
**Success Criteria** (o que deve ser verdade):
  1. Terapeuta novo recebe magic link no e-mail informado e completa login pela primeira vez.
  2. Após login, sessão persiste em refresh do browser; tentativa de acessar `/dashboard` sem sessão redireciona para `/login`.
  3. Terapeuta cadastra um cliente com nome, data de nascimento, gênero e notas; cliente aparece em `/clientes` apenas para esse terapeuta (RLS verificada com segunda conta).
  4. Terapeuta consegue editar e ver a página de detalhe do cliente, e excluir um cliente apaga o registro respeitando cascade.
  5. Registro em `profiles` do novo terapeuta tem `subscription_status='trial'` e `trial_ends_at` 14 dias à frente.
  6. Cliente Supabase autenticado (server + browser) consegue executar queries no banco; rota smoke `/api/health/db` retorna 200 com `count(*) from clients` da sessão do terapeuta logado.
**Plans:** 4 plans
- [x] 02-01-PLAN.md — Supabase Auth infra: lib/supabase/ clients, middleware.ts, /api/auth/callback, migration 0003 + [BLOCKING] supabase db push --linked, Resend SMTP config, NEXT_PUBLIC_SITE_URL (Wave 1)
- [x] 02-02-PLAN.md — Auth pages: (auth)/layout.tsx, signup/page.tsx, login/page.tsx + shadcn: input label form card toast (Wave 2)
- [x] 02-03-PLAN.md — Dashboard layout: (dashboard)/layout.tsx, app-sidebar.tsx, dashboard-header.tsx, summary-cards.tsx, /dashboard/page.tsx, /leituras/page.tsx + shadcn: sidebar avatar badge dropdown-menu separator (Wave 3)
- [x] 02-04-PLAN.md — CRUD de clientes + smoke test: clients.ts actions, clientes/page.tsx, clients-table.tsx, clientes/novo, clientes/[id], clientes/[id]/editar, delete-client-dialog.tsx, /api/health/db + shadcn: table dialog select textarea skeleton (Wave 4)
**UI hint**: yes

### Fase 3: Captura mobile (PWA)
**Mapeamento SPEC:** Fase 2 — Captura mobile / PWA (4–6 dias).
**Goal**: Terapeuta consegue, no celular, instalar o PWA, abrir o fluxo de nova leitura e capturar 6 imagens (3 ângulos × 2 olhos) com qualidade gated por validação on-device, salvando tudo no bucket privado.
**Depends on**: Fase 2.
**Requirements**: CAPTURE-01, CAPTURE-02, CAPTURE-03, CAPTURE-04, CAPTURE-05, CAPTURE-06
**Success Criteria** (o que deve ser verdade):
  1. PWA instala em iOS Safari e Chrome Android (manifest + service worker funcionais; ícone na home screen).
  2. Tela de captura usa câmera traseira; overlay circular guia o posicionamento do olho.
  3. Feedback ao vivo aparece e muda conforme `QualityCheck` (mensagens tipo "aproxime mais", "muito reflexo", "ótima — capturando"); botão de captura só fica habilitado quando `overallScore >= 0.75`.
  4. Fluxo guiado conduz a sequência exata `right/frontal → right/lateral → right/backlight → left/frontal → left/lateral → left/backlight` com instrução visual entre cada captura.
  5. Ao final do fluxo, há 6 linhas em `reading_images` apontando para arquivos no Storage privado do terapeuta, com `eye`, `angle`, `storage_path`, `quality_score`, `width`, `height` preenchidos.
**Plans:** 8 plans em 8 waves (sequência serial — cada wave depende da anterior)

**Wave 0 — Infra**
- [ ] 03-01-PLAN.md — vitest setup + scripts + migration 0004 (bucket iris-captures + RLS folder + unique constraint reading_images) + types regen + audit:vocabulary + storage_cross_therapist_rls.sql

**Wave 1 — PWA shell** *(blocked on Wave 0)*
- [ ] 03-02-PLAN.md — manifest.ts + Serwist SW + next.config + ícones placeholder + viewport + usePWAInstall hook

**Wave 2 — Entry points** *(blocked on Wave 0)*
- [ ] 03-03-PLAN.md — Server actions readings (create/finalize/discard + getDraftReading) + /leituras/nova select cliente + /leituras/nova/upload placeholder + ativar botão Nova Leitura em /clientes/[id]

**Wave 3 — Camera shell** *(blocked on Wave 2)*
- [ ] 03-04-PLAN.md — (capture) route group + page server-component + capture-client skeleton + useCamera + CameraView + CameraDeniedScreen (D-15)

**Wave 4 — MediaPipe core** *(blocked on Wave 3)*
- [ ] 03-05-PLAN.md — libs (iris-geometry, laplacian, exposure, quality-scoring) + assets em public/mediapipe/ + IrisDetector lazy-load + useIrisDetector + useQualityScore (400ms) + QualityIndicator + LiveFeedbackMessage

**Wave 5 — Sequência guiada** *(blocked on Wave 4)*
- [ ] 03-06-PLAN.md — sequence.ts + AngleIcon + AngleOverlay + AngleInterstitial + CaptureProgress + state machine completa

**Wave 6 — Captura + upload** *(blocked on Wave 5)*
- [ ] 03-07-PLAN.md — Compressão JPEG + storage-path + upload com retry + CapturePreview (2s + tap-to-redo D-09) + sonner toast + integração captura real no capture-client

**Wave 7 — Recovery + finalize** *(blocked on Wave 6)*
- [~] 03-08-PLAN.md — RecoveryBanner (D-12) + listagem /leituras com rascunhos + PWAInstallBanner (D-14) + finalize do reading no 6º slot. **Scope reduzido durante UAT 03 (2026-05-03):** finalize implementada em fixes pós-execução; RecoveryBanner D-12 e PWAInstallBanner D-14 deferidos pra Fase 9 (polish pré-beta).

**Cross-cutting constraints (must_haves presentes em ≥2 plans):**
- Vocabulário proibido LGPD ("diagnóstico", "tratamento", "cura") ausente em todos os arquivos novos (auditável via grep `pnpm audit:vocabulary`).
- Storage path canônico `{therapist_id}/{reading_id}/{eye}_{angle}.jpg` consistente entre RLS folder policy (03-01) e upload (03-07).
- RLS pattern `auth.uid() = therapist_id` em todas as queries de `readings` e `reading_images` (03-03, 03-07, 03-08).
- MediaPipe carregado apenas via `next/dynamic({ ssr: false })` na rota `(capture)` — não vaza para bundle do `(dashboard)` (03-05, verificável em build output).

**UI hint**: yes

### Fase 4: Upload desktop
**Mapeamento SPEC:** Fase 3 — Upload desktop (1–2 dias).
**Goal**: Terapeuta no desktop pode iniciar uma leitura subindo até 6 imagens já capturadas em câmera profissional, produzindo a mesma estrutura de armazenamento do fluxo mobile.
**Depends on**: Fase 3 (depende da estrutura `reading_images` validada em produção via Fase 3, não da PWA em si).
**Requirements**: UPLOAD-01, UPLOAD-02
**Success Criteria** (o que deve ser verdade):
  1. Em `/leituras/nova/upload`, dropzone aceita drag-and-drop de arquivos de imagem com preview por arquivo.
  2. Validação rejeita arquivos não-imagem ou acima do limite definido, com mensagem clara em pt-BR.
  3. Após submit, leitura criada tem `capture_method='desktop_upload'` e até 6 entradas em `reading_images` com `eye` e `angle` definidos pela UI de associação.
  4. Mesmo bucket privado por terapeuta + URLs assinadas usados; nenhuma diferença observável a jusante (a Fase 5 consegue consumir leitura criada por upload desktop).
**Plans:** 7 plans em 5 waves

**Wave 1 — Fundação lib + server action (paralelos)**
- [x] 04-01-PLAN.md — lib/upload/validate-file.ts (MIME + tamanho 25MB) + lib/upload/heic-to-jpeg.ts (dynamic import heic2any) + testes vitest. CONTEXT D-10, D-11, D-12. **Concluído 2026-05-03 (13/13 testes verdes; heic2any@0.0.4 aprovado fora da janela de 24m via checkpoint:decision).**
- [x] 04-02-PLAN.md — readings.schemas.ts e readings.ts: createReadingSchema aceita method enum + getDraftReading retorna capture_method (forward Fase 9). CONTEXT D-03, D-04, D-15. **Concluído 2026-05-03 (12/12 testes verdes; CAPTURE_METHODS const tuple + narrowCaptureMethod helper para defesa em profundidade contra string|null do Supabase).**

**Wave 2 — UI primitives (paralelos)**
- [x] 04-03-PLAN.md — components/upload/UploadDropzone.tsx (drag+drop+click + a11y) + testes vitest. CONTEXT D-05, D-10. **Concluído 2026-05-03 (10/10 testes vitest verdes; a11y completa role=button+tabIndex+aria-disabled+keyboard+focus-visible; componente puramente apresentacional sem imports de lib/upload).**
- [x] 04-04-PLAN.md — adaptar getSlotInstructionCopy + AngleInterstitial + CapturePreview com prop opcional mode ('camera' | 'upload') sem regredir Fase 3. CONTEXT D-05, D-09. **Concluído 2026-05-03 (9 testes novos verdes — 6 sequence + 3 CapturePreview; 63/63 testes em components/capture+sequence; backward compat 100% — capture-client.tsx Fase 3 não tocado; CaptureMode type exportado como fonte única). Wave 2 fechada.**

**Wave 3 — Wizard assembly** *(blocked on Waves 1+2)*
- [x] 04-05-PLAN.md — app/(dashboard)/leituras/nova/upload/page.tsx (server component substitui placeholder) + upload-client.tsx (state machine clone do capture-client + dropzone). CONTEXT D-04, D-05, D-06, D-07, D-09, D-13, D-14. **Concluído 2026-05-03 (page.tsx 85 linhas com 4 guards inc. D-04 redirect; upload-client.tsx 381 linhas reutilizando state machine + analyzeCapturedJpeg + uploadWithRetry verbatim; bundle splitting confirmado — heic2any em chunk dedicado de 1.35MB; 63/63 testes Fase 3 verdes — zero regressão; build /upload First Load 3.4 kB; UPLOAD-01 e UPLOAD-02 entregues).**

**Wave 4 — Entry point** *(blocked on Wave 1)*
- [x] 04-06-PLAN.md — new-reading-form.tsx: auto-detect (matchMedia coarse+hover) + dois CTAs com hidden input method + escape link. CONTEXT D-01, D-02, D-03. **Concluído 2026-05-03 (1 commit feat efb1f08; 73+/10− linhas; useEffect matchMedia com cleanup; texto dinâmico em ambos os CTAs; build /leituras/nova 3.98 kB First Load; 160/160 testes verdes excluindo pré-existente Fase 3; UPLOAD-01 e UPLOAD-02 mantidos completos). Wave 4 fechada.**

**Wave 5 — Recovery hook + UAT** *(blocked on Waves 3+4)*
- [x] 04-07-PLAN.md — smoke test do shape de DraftReading (forward Fase 9 RecoveryBanner) + 04-UAT.md com 14 cenários + checkpoint manual founder. CONTEXT D-15. **Concluído 2026-05-03 (commits 21156b7 test smoke 16/16 verde; a48e792 docs 04-UAT.md 14 cenários; c30222f docs partial SUMMARY; UAT manual aprovado pelo founder via resposta `approved` ao checkpoint:human-verify). Wave 5 fechada — Fase 4 código-completa.**

**Cross-cutting constraints (must_haves presentes em ≥2 plans):**
- Vocabulário proibido LGPD ausente em todas as strings novas (auditável via `pnpm audit:vocabulary`).
- Storage path canônico `{therapist_id}/{reading_id}/originais/{eye}_{angle}.jpg` consistente com Fase 3 (auditável via `grep buildOriginalStoragePath`).
- HEIC lib carregada APENAS via dynamic import (`await import('heic2any')`) — não vaza pro bundle do (dashboard) (auditável via `pnpm build` output).
- capture_method validado no schema Zod do createReadingAction antes de qualquer insert (não aceitar valores fora do enum).
- RecoveryBanner UI deferido pra Fase 9 (Plan 04-07 entrega apenas o backend hook).
**UI hint**: yes

### Fase 5: Pipeline de visão (Modal)
**Mapeamento SPEC:** Fase 4 — Pipeline de visão / Modal (5–7 dias).
**Goal**: Dada uma leitura com 6 imagens, o pipeline Modal produz o JSON canônico de features (SPEC §4.3) e o grava em `readings.vision_features`.
**Depends on**: Fase 3 e Fase 4 (precisa de leituras com imagens populadas).
**Requirements**: VISION-01, VISION-02, VISION-03, VISION-04
**Success Criteria** (o que deve ser verdade):
  1. Endpoint Modal `analyze_iris(reading_id, image_urls)` aceita o contrato de entrada (lista de `{eye, angle, url}`) e roda no GPU T4 dentro de 120s para uma leitura típica de 6 imagens.
  2. As 6 etapas do pipeline (`detect → segment → compose → normalize → enhance → features`) executam na ordem e cada etapa tem teste mínimo (pelo menos um caso de regressão por etapa).
  3. JSON retornado conforma o esquema do SPEC §4.3: `right_eye` e `left_eye` com `constitution`, `iris_color`, `fiber_density`, `collarette`, `pupil`, `sectors[]`, `rings`, `global_signs`, `image_quality`; mais `asymmetry_notes` e `processing_metadata` no topo.
  4. Webhook callback do Modal valida HMAC, atualiza `readings.vision_features`, define `readings.status='ready'` (ou `failed` em erro) e preenche `processed_at`.
  5. Trigger end-to-end: terapeuta finaliza captura/upload → `readings.status` transita `pending → processing → ready` sem intervenção manual; `vision_features` populado.
**Plans**: 17 plans em 4 waves
- **Wave 0** *(test infra + security primitives — paralelo; CONCLUÍDA 2026-05-04)*: [x] 05-01 vision-service test scaffolding (pytest + fixtures + audit script — 10/10 testes verdes), [x] 05-02 apps/web service-role Supabase client + lib/vision/hmac.ts (HmacVerificationResult discriminated union — 19/19 testes verdes). 05-03 (Pydantic schemas) movido para Wave 1 conforme frontmatter.
- **Wave 1** *(pipeline implementation — depende Wave 0; subdividida em 1a/1b/1c por dependências internas)*:
  - **Wave 1a** *(paralelo; depende só de 05-01 — CONCLUÍDA 2026-05-04)*: [x] 05-03 Pydantic IrisFeatures schemas (16 classes, 22 tests), [x] 05-04 detect (MediaPipe FaceLandmarker iris 468–477/473–477, D-X3 hybrid), [x] 05-05 segment (HoughCircles + fallback D-F1, Pitfall 7 closest-to-seed, 10 tests), [x] 05-06 compose (photometric weighted average com ANGLE_WEIGHTS, 10 tests), [x] 05-07 normalize (Daugman polar 64×512 via cv2.remap vetorizado, 10 tests <50ms), [x] 05-08 enhance (CLAHE LAB L-channel, hue preservado, 7 tests). **68/68 pytest verdes em vision-service.**
  - **Wave 1b** *(depende 05-03; bloqueante para 05-10 — CONCLUÍDA 2026-05-04 via founder UAT)*: [x] 05-09 features (extract_all + compute_asymmetry + classify_iris_color via LAB k-means; jensen-map.json pt-BR aprovado pelo founder com 1 fix em right h9 = pulmão/pleura/brônquios/tórax direito; 20 tests incluindo B4 anti-regression)
  - **Wave 1c** *(depende toda Wave 1)*: 05-10 modal_app orchestration (analyze_iris_endpoint + .spawn + _post_webhook com vision_features kwarg + WEBHOOK_BASE_URL)
- **Wave 2** *(Next.js integration — depende Wave 1)*: 05-11 trigger route + lib/vision/modal-client.ts, 05-12 webhook route (HMAC + Zod superRefine + status guard D-T4 + atomic UPDATE D-F5), 05-13 finalizeReadingAction integration (closes Fase 5: TODO line 112), 05-14 UI StatusBadge + ReprocessButton em /leituras
- **Wave 3** *(CI + audit + smoke — depende Wave 1+2)*: 05-15 GH Actions vision-service-tests.yml, 05-16 D-E1 error_summary catalog + extended LGPD audit, 05-17 founder smoke procedure + .env.example finalization

**Cross-cutting constraints** *(truths repeated across multiple plans — gates verificáveis durante execução):*
- JSON output conforms to SPEC §4.3 schema (validated by Pydantic IrisFeatures) — 05-03, 05-10, 05-12, 05-17
- Webhook handler is idempotent via status guard (D-T4) — 05-12
- All user-facing strings (badges, error_summary, jensen-map zones) pass `pnpm audit:vocabulary` LGPD audit — 05-14, 05-15, 05-16
- Per-eye soft degradation (D-F1) — failed eye is null + asymmetry_note recorded; both-null is the only `failed` path apart from infra errors — 05-09, 05-10, 05-12
- Modal worker uses signed URLs only — no Supabase service role inside Modal container — 05-10, 05-17

### Fase 6: RAG — Ingestão da base de conhecimento
**Mapeamento SPEC:** Fase 5 — RAG ingestão (2–3 dias).
**Goal**: Os PDFs seed (Jensen Vol. 1 + Battello Iridologia Clínica) estão chunked, embedded e indexados em `knowledge_chunks`, prontos para serem recuperados por `retrieveRelevantKnowledge`.
**Depends on**: Fase 1 (precisa do `pgvector` e da tabela `knowledge_chunks` com índice HNSW).
**Requirements**: RAG-01, RAG-02, RAG-03, RAG-04
**Success Criteria** (o que deve ser verdade):
  1. `scripts/ingest-knowledge.ts` rodado uma vez gera chunks com size ~500 tokens e overlap 80, respeitando prioridade `chapter → section → paragraph`; cada chunk tem 3–5 tags geradas pelo LLM.
  2. `knowledge_chunks` tem registros para Jensen e Battello, com `source_book`, `source_chapter`, `source_page` e `metadata` (autor, escola, idioma) preenchidos.
  3. Embeddings têm dimensão 1024 e foram inseridos via batches Voyage de até 128 textos sem erro de quota; custo total de indexação inicial ≤ ~US$ 25.
  4. `retrieveRelevantKnowledge(features)` retorna até 30 chunks deduplicados (~15k tokens) em ≤ 3 segundos para uma `vision_features` típica, com queries derivadas de constituição, achados por setor (`findings.length > 0`) e sinais globais.
  5. Spot-check: para uma feature simulada com `lacuna no setor 7 (fígado)`, os top-5 chunks retornados são reconhecidamente relevantes a fígado/lacuna em obras clássicas (validação pelo fundador).
**Plans**: TBD

### Fase 7: Análise LLM
**Mapeamento SPEC:** Fase 6 — Análise LLM (3–5 dias).
**Goal**: Dado um `readings.vision_features` populado, o sistema gera um relatório iridológico em pt-BR que respeita os 5 princípios do prompt-base e a estrutura de 13 seções, e o terapeuta pode editar antes de entregar.
**Depends on**: Fase 5 (features) e Fase 6 (knowledge).
**Requirements**: LLM-01, LLM-02, LLM-03, LLM-04
**Success Criteria** (o que deve ser verdade):
  1. Em `/leituras/[id]`, com a leitura `ready`, o terapeuta dispara "gerar análise" e o relatório aparece em streaming, totalmente em pt-BR, com as 13 seções numeradas (1. Constituição → 13. Mensagem Final).
  2. Cada interpretação no relatório cita entre colchetes a feature do JSON que a ancora (`[ancorado em: features.X]`); auditoria automática rejeita relatórios em que > 5% das afirmações de seções 2–6 não tenham âncora.
  3. Linguagem hipotética é respeitada: nenhuma ocorrência das frases proibidas ("o cliente tem", "diagnostica-se", "está doente de", "trauma confirmado aos X anos", e os termos "diagnóstico", "tratamento", "cura") em 10 relatórios de teste consecutivos sobre features distintas.
  4. Disclaimer literal de encerramento (SPEC §6) aparece sempre, no fim de todo relatório.
  5. Em `/leituras/[id]/editar`, terapeuta ajusta texto e salva — `ai_report_edited` é gravado e `status='edited'`; `ai_report_raw` permanece intacto para auditoria.
**Plans**: TBD
**UI hint**: yes

### Fase 8: Pagamento + LGPD
**Mapeamento SPEC:** Fase 7 — Pagamento + LGPD (3–4 dias).
**Goal**: Terapeuta pode contratar um plano em BRL/PIX após o trial e cumpre os deveres LGPD (termo de consentimento por cliente, exclusão cascateada, logs de acesso, copy obrigatória, vocabulário auditado).
**Depends on**: Fase 7 (faz sentido cobrar quando o produto entrega análise).
**Requirements**: BILLING-01, BILLING-02, BILLING-03, LGPD-01, LGPD-02, LGPD-03, LGPD-04, LGPD-05, LGPD-06
**Success Criteria** (o que deve ser verdade):
  1. Em `/assinatura`, terapeuta escolhe um dos três tiers (Starter R$ 89, Profissional R$ 189, Escola R$ 490) e completa checkout Stripe BR via cartão **ou** PIX; webhook atualiza `profiles.subscription_status` e `subscriptions` em ≤ 1 min.
  2. Após `trial_ends_at` vencer sem assinatura, middleware bloqueia disparo de novas análises (`POST /api/readings/[id]/process` retorna 402/403 com link para `/assinatura`); leituras já geradas continuam visíveis.
  3. Tentativa de criar leitura para cliente sem `consent_signed_at` é bloqueada na UI; fluxo "gerar termo" produz PDF assinável (DocuSeal/Clicksign), e após assinatura `consent_document_url` e `consent_signed_at` são preenchidos.
  4. Botão "deletar dados" na página do cliente, após confirmação explícita, apaga em cascata o cliente, suas leituras, suas imagens (Storage incluso) e o termo de consentimento; auditoria sql confirma 0 órfãos.
  5. Cada GET de imagem em Storage por terapeuta gera linha de log de auditoria; spot-check confirma `reading_image.id`, `therapist_id` e timestamp registrados.
  6. Auditoria de vocabulário (script + revisão manual) confirma ausência de "diagnóstico", "tratamento", "cura" nas superfícies do produto (UI, prompts, relatórios), com exceção de páginas de política que as citam para negá-las; copy obrigatória "ferramenta de apoio à anamnese terapêutica integrativa, não substitui avaliação médica" aparece em landing, cabeçalho do relatório e rodapé legal.
**Plans**: TBD
**UI hint**: yes

### Fase 9: Polish + dogfooding + beta
**Mapeamento SPEC:** Fase 8 — Polish + beta fechado (1 semana).
**Goal**: Aurel Iris é polido o suficiente para o fundador usar em consultas reais semanalmente; e, após esse gate, é distribuído para 5 terapeutas internos seguidos de 10–20 selecionados.
**Depends on**: Fase 8 (precisa de cobrança e LGPD em pé antes de qualquer rollout externo).
**Requirements**: ONBOARD-01, ONBOARD-02, ONBOARD-03, ONBOARD-04, ONBOARD-05
**Success Criteria** (o que deve ser verdade):
  1. Terapeuta novo conclui onboarding em 3 passos (perfil → primeiro cliente → primeira leitura demo) e métricas de onboarding registram conclusão; tempo mediano até primeira leitura real ≤ 30 minutos.
  2. E-mails transacionais via Resend chegam em sandbox e em produção: confirmação de signup, recibo de pagamento Stripe, "leitura pronta" com link assinado, e exportação solicitada.
  3. Página pública de apresentação está no ar com posicionamento LGPD-compliant ("ferramenta de apoio à anamnese...") e nenhum vocabulário proibido.
  4. **Gate de Estágio 1 (dogfooding):** o fundador, terapeuta iridologista em exercício, usou Aurel Iris **semanalmente em pelo menos 3 clientes reais por 3 semanas consecutivas** sem recorrer a notas manuais paralelas; o backlog de ajustes de prompt/UX foi alimentado por essa experiência e os bloqueadores foram resolvidos antes do gate.
  5. **Gate de Estágio 2 (beta externo, só após Estágio 1 fechado):** 5 terapeutas internos completaram pelo menos 1 leitura real cada e deram feedback estruturado; rollout para 10–20 terapeutas selecionados está agendado com checklist de revisão jurídica de healthtech (~R$ 2–4k) executado.
**Plans**: TBD
**UI hint**: yes

## Progresso

**Ordem de execução:**
Fases executam em ordem numérica: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9.

| Fase | Plans concluídos | Status | Concluída em |
|-------|------------------|--------|--------------|
| 1. Setup | 6/6 | ✅ Concluída | — |
| 2. Auth + Dashboard básico | 4/4 | ✅ Concluída | — |
| 3. Captura mobile (PWA) | 8/8* | ✅ Concluída via UAT | 2026-05-03 |
| 4. Upload desktop | 7/7 | ✅ Concluída via UAT + gsd-verifier | 2026-05-03 |
| 5. Pipeline de visão (Modal) | 9/17 | Em execução (Wave 0 ✓ + Wave 1a ✓ + Wave 1b ✓) | — |
| 6. RAG — Ingestão | 0/TBD | Não iniciada | — |
| 7. Análise LLM | 0/TBD | Não iniciada | — |
| 8. Pagamento + LGPD | 0/TBD | Não iniciada | — |
| 9. Polish + dogfooding + beta | 0/TBD | Não iniciada | — |

\* **Fase 3 nota**: Plans 03-01 a 03-07 executados normalmente. Plan 03-08 (RecoveryBanner D-12, PWAInstallBanner D-14, listagem rascunhos) teve scope reduzido durante UAT — finalizeReadingAction foi absorvida em fixes pós-execução. RecoveryBanner e PWAInstallBanner deferidos para Fase 9 (polish pré-beta). Captura mobile principal funcional pós-UAT 03 (20 rounds de calibração do gate VLM Claude Haiku 4.5). Único issue conhecido: PWA standalone Android Chrome (instala mas abre com URL bar). Não bloqueia Estágio 1 (dogfood iPhone Safari).
