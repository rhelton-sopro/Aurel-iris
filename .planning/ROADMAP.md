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
- [ ] **Fase 10: Sistema de Aprendizagem Clínica** *(planejada — backlog de longo prazo, executar depois da Fase 9 fechar)* — Captura de diff entre relatório gerado e entregue → descoberta de heurísticas emergentes + scoring clínico próprio + sugestões pré-preenchidas. Transforma o produto de "software de iridologia" em "sistema proprietário de análise iridológica" intransponível. **Pré-requisito de captura de dados embutido na Fase 7** (relatório_gerado, relatório_entregue, zonas_editadas, tipo_edição). Ver `.planning/phases/10-aprendizagem-clinica/10-CONTEXT.md`.

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
  - **Wave 1c** *(depende toda Wave 1 — CONCLUÍDA 2026-05-04)*: [x] 05-10 modal_app orchestration (analyze_iris_endpoint FastAPI POST + run_pipeline T4 GPU worker com per-eye try/except D-F1 + _post_webhook HMAC Stripe convention + _classify_error_summary D-E1 catalog pt-BR + face_landmarker.task pre-baked + supabase removido per D-T6; 10 testes D-X2). **Wave 1 inteira fechada — pipeline Python 100% implementado.**
- **Wave 2** *(Next.js integration — depende Wave 1; subdividida em 2a/2b por dependências internas)*:
  - **Wave 2a** *(05-12/13/14 dependem de 05-11; CONCLUÍDA 2026-05-04)*: [x] 05-11 trigger route + lib/vision/modal-client.ts (state machine 5-saídas: 401/404x3/502/202; D-T5 pre/post-spawn UPDATE; D-T6 TTL 600s; D-E1 rollback; 13 vitest tests)
  - **Wave 2b** *(paralelo — CONCLUÍDA 2026-05-04)*: [x] 05-12 webhook route (HMAC verifyHmacSignature + Zod superRefine + D-T4 status guard + D-F5 atomic UPDATE + revalidatePath; 16 vitest tests), [x] 05-13 finalizeReadingAction integration (closes TODO line 112; trigger fire-and-forget, D-T2 redirect, D-T1 decoupling para soft-warn em fail; 6 novos tests), [x] 05-14 UI StatusBadge (5 variants pt-BR + Rascunho override + tooltip D-F2; 12 tests) + ReprocessButton (POST trigger + router.refresh; 7 tests) + leituras/page.tsx integration. **Wave 2 inteira fechada — pipeline end-to-end wireado (finalize → trigger → Modal → webhook → atomic UPDATE → UI atualiza).**
- **Wave 3** *(CI + audit + smoke — depende Wave 1+2; CONCLUÍDA 2026-05-04)*: [x] 05-15 GH Actions vision-service-tests.yml (Python 3.11 + pytest + LGPD audit gate, paths filter vision-service/**), [x] 05-16 D-E1 error_summary catalog externalizado para vision-service/data/error_summary.json (versioned v0.1.0) + lru_cached loader pipeline/error_summary.py + modal_app.py rewireado (no inline pt-BR literals), [x] 05-17 vision-service/README.md founder smoke procedure (markdown checklist, 244 linhas) + vision-service/.env.example (MODAL_WEBHOOK_SECRET + WEBHOOK_BASE_URL com docs inline). **Wave 3 inteira fechada — Fase 5 código-completa (17/17). Aguardando /gsd-verify-work 5 + founder smoke.**

**Cross-cutting constraints** *(truths repeated across multiple plans — gates verificáveis durante execução):*
- JSON output conforms to SPEC §4.3 schema (validated by Pydantic IrisFeatures) — 05-03, 05-10, 05-12, 05-17
- Webhook handler is idempotent via status guard (D-T4) — 05-12
- All user-facing strings (badges, error_summary, jensen-map zones) pass `pnpm audit:vocabulary` LGPD audit — 05-14, 05-15, 05-16
- Per-eye soft degradation (D-F1) — failed eye is null + asymmetry_note recorded; both-null is the only `failed` path apart from infra errors — 05-09, 05-10, 05-12
- Modal worker uses signed URLs only — no Supabase service role inside Modal container — 05-10, 05-17

### Fase 6: RAG — Ingestão da base de conhecimento
**Mapeamento SPEC:** Fase 5 — RAG ingestão (2–3 dias).
**Goal**: Os PDFs seed (18 PDFs em D:\Projetos\Iridologista\livros\) estão chunked, embedded e indexados em `knowledge_chunks`, prontos para serem recuperados por `retrieveRelevantKnowledge(features, reportSections)`.
**Depends on**: Fase 1 (precisa do `pgvector` e da tabela `knowledge_chunks` com índice HNSW).
**Requirements**: RAG-01, RAG-02, RAG-03, RAG-04
**Success Criteria** (o que deve ser verdade):
  1. `vision-service/scripts/ingest_knowledge.py` rodado uma vez gera chunks com size ~500 tokens (flex 300-700) e overlap 80, respeitando prioridade `chapter → section → paragraph`; tagging de vocabulário acontece em sessão Claude Code separada (D-T1).
  2. `knowledge_chunks` tem registros para 18 livros do acervo (D-S1), com `source_book`, `source_chapter`, `source_page`, `source_type='biblioteca'` e `metadata` (autor, escola, idioma, ano) preenchidos.
  3. Embeddings têm dimensão 1024 (`voyage-3`) e foram inseridos via batches de até 128; custo total ≤ US$ 5 (D-G1) + ≤ US$ 15 Contextual Retrieval (D-N1).
  4. `retrieveRelevantKnowledge(features, reportSections)` retorna até 30 chunks deduplicados (~15k tokens) em ≤ 3s (D-R5; ≤ 2s p95 D-N4 early-warning) com queries Família A (visuais) + B (templates por seção D-R2B), reranking voyage-rerank-2.5 (D-N2 graceful fallback) e pesos D-R4 (clinical_data 1.5×, alta_prioridade 1.1×, dimensoes intersect 1.2×).
  5. Spot-check: para feature simulada `lacuna no setor 7 (fígado)`, os top-5 chunks retornados são reconhecidamente relevantes a fígado/lacuna em obras clássicas (founder UAT em `06-UAT.md`).
**Plans:** 14 plans em 5 waves
- [x] 06-01-PLAN.md — Wave 0 test scaffolding (10 pytest + 4 vitest stubs + synthetic PDF fixture) (Wave 0). **Concluído 2026-05-05** (2 commits `7dd6287` pytest stubs + `f242400` vitest stubs + fixtures; 49 pytest skipped + 32 vitest todos; pytest e vitest exit 0; LGPD audit limpo no fixture; 14 Wave-0 checkboxes flipadas em 06-VALIDATION.md).
- [x] 06-02-PLAN.md — Canonical data: vocabularies.json + jensen-reference.md + section-queries.ts + types.ts (Wave 0). **Concluído 2026-05-05** via founder-gate (3 commits `b4065f1` baseline vocabularies + `a9f42c5` types/section-queries + `f09d0ad` founder edits; vocabularies.json v0.1.1 com 24 sinais e 7 ReportSections incluindo nutricao_carencias; +3 sinais founder-approved (pterigium_pigmentar, nevus, criptas_radiais); test_vocabularies.py 7/7 GREEN com regression guards; 5/5 verification gates passed).
- [x] 06-03-PLAN.md — Deps (voyageai, PyMuPDF, anthropic, etc.) + manifest_assist.py + books_manifest.json (Wave 0). **Concluído 2026-05-05** via founder-gate (3 commits `8859f90` deps + `e256e1e` bootstrap + `0d748c3` founder edits; 8 Python deps pinned + voyageai TS SDK + 4 root rag:* scripts; books_manifest.json v0.1.1 com 18 entries founder-validated, 7 alta_prioridade incluindo #7 Bernard-Jensen-pdf flipped, 2 skip duplicates, 1 pdfplumber override em #8 dictionary, 7 autor fills, 2 ano corrections, 2 escola reclassifications #10 Italiana e #16 Andrews-britânica; pytest baseline 142/46 mantido; audit_vocabulary clean).
- [x] 06-04-PLAN.md — pdf_extractor.py + chunker.py + content_hash canonicalization (Wave 1). **Concluído 2026-05-05** (3 commits `648a2ec` extractor + `da05ed5` chunker + `75f9b09` test flips; 3 módulos Python em `scripts/lib/` + sample_book.pdf regenerado 67→3538 bytes / 0→4 páginas via `_make_sample_pdf.py`; 13 stubs Wave 0 → 20 testes GREEN; content_hash LOCKED em sha256(text.strip().encode('utf-8')) verificado contra digest hardcoded de "hello"; D-C1 honrado 300-700 tokens com overlap 80 dentro de seção e sem overlap entre capítulos; 6 algorithmic refinements aplicados como Rule 1 fixes durante execução; pytest 162/33 era 142/46; audit_vocabulary clean).
- [x] 06-05-PLAN.md — budget.py (VoyageBudgetGuard $5 + ContextualBudgetGuard $15) + embedder.py voyage-3 (Wave 1). **Concluído 2026-05-05** (2 commits `50e00d8` budget + `d1dee9a` embedder; 2 módulos Python em `scripts/lib/` + 3 test files flipados; `EMBEDDING_MODEL='voyage-3'` PINNED em embedder.py com cross-ref RESEARCH Pitfall 4 — TS counterpart owed em 06-09; VoyageBudgetGuard ($5 hardcap, $1/$2/$3/$4 alert ladder, log every 10 chunks); ContextualBudgetGuard ($15 hardcap, 3-token-type accounting Haiku 4.5 + 90% prompt-cache discount); two-clause exception fix `except BudgetExceeded: raise` antes do `except Exception` impede retry sobre budget hits; 15 Wave-0 stubs flipados → 24 testes GREEN (7+7+10); pytest 186/18 era 162/33; audit_vocabulary clean; zero deviations).
- [x] 06-06-PLAN.md — contextualizer.py (D-N1 Anthropic Haiku 4.5) + manifest.py Pydantic loader (Wave 1). **Concluído 2026-05-05** (3 commits `692febf` manifest + `1b9c17f` contextualizer + `3e620e6` vocab sync regression; 2 módulos Python em `scripts/lib/`; situate_chunk lazy-importa anthropic + builds messages com `cache_control={'type':'ephemeral'}` no chapter system block + guard.add com `or 0` defensivo para cache_read_input_tokens=None; BookEntry/BooksManifest Pydantic v2 com `extra='forbid'` + 7 schools + 5 idiomas + 5 extratores Literals + ano range 1900-2100; load_manifest lru_cached retorna 18 books v0.1.1; 10 stubs Wave 0 flipados → 26 testes GREEN (16 books_manifest + 10 contextualizer) + 1 sync regression em test_vocabularies.py (8/8); 2 Rule 2 hardenings (None-safe cached_tokens + jensen-reference⊆vocabularies sync test); pytest 213/8 era 186/18; audit_vocabulary clean; **Wave 1 fechada 6/6 módulos**).
- [x] 06-07-PLAN.md — [BLOCKING] migration 0005 (content_hash + source_type + RPC match_knowledge_chunks) + persister.py (Wave 2). **Concluído 2026-05-05** via founder-gate `supabase db push --linked` (4 commits `1e5a52d` migration + `8f5b15a` persister + `f147cee` test flip + `1a19cab` types regen; migration idempotente DO blocks aplicada limpa; types.ts regenerado expondo Functions.match_knowledge_chunks Args/Returns + content_hash + source_type em Row/Insert/Update; persister.py com get_client env-guarded + eyJ shape check Pitfall 14 + upsert on_conflict='content_hash' ignore_duplicates=True + purge_book delete().eq() D-I2; 4 stubs Wave 0 → 8 testes GREEN; **Stub-API-superseded-by-spec aplicado terceira vez**; pytest 221/4 era 213/8; tsc --noEmit clean para lib/rag/ e types/database.ts; audit_vocabulary clean; zero deviations; **Wave 2 fechada — Wave 3 desbloqueada**).
- [ ] 06-08-PLAN.md — ingest_knowledge.py CLI orchestrator + founder runs full ingest (Wave 3)
- [ ] 06-09-PLAN.md — embed.ts (voyage-3 pinned matching Python) (Wave 3)
- [ ] 06-10-PLAN.md — build-queries.ts (Family A+B) + score-weights.ts (D-R4) (Wave 3)
- [ ] 06-11-PLAN.md — rerank.ts (D-N2 graceful) + search.ts server action (Wave 3)
- [ ] 06-12-PLAN.md — audit:vocabulary extension (scripts/data + lib/rag) + audit-vocabulary-db.mjs (Wave 4)
- [ ] 06-13-PLAN.md — REQUIREMENTS.md + STATE.md updates + rag-spot-check.ts + 06-UAT.md founder gate (Wave 4)
- [ ] 06-14-PLAN.md — vision-service/README.md RAG runbook section (Wave 4)

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

### Fase 10: Sistema de Aprendizagem Clínica *(planejada — pós-Fase 9)*
**Mapeamento SPEC:** N/A (fase pós-MVP, surgida pós-bootstrap como diferencial estratégico de longo prazo).
**Goal**: Construir um sistema de aprendizagem clínica que aprende com cada edição humana do relatório (diff entre gerado e entregue), descobre heurísticas emergentes (correlações features↔achados clínicos não documentados pelo Jensen), cria um scoring clínico próprio (modelo leve treinável incrementalmente) e sugere automaticamente (pré-preenche seções, sinaliza zonas críticas, identifica combinações raras). Transforma o produto de "software de iridologia" em "sistema proprietário de análise iridológica" intransponível.
**Depends on**: Fase 9 fechada **com Estágio 1 (dogfooding) consolidado**. Pré-requisito de captura de dados embutido na Fase 7 (relatório_gerado, relatório_entregue, timestamp_gerado/entregue, zonas_editadas, tipo_edição). **Sem esses campos persistidos desde a Fase 7, cada leitura é uma anotação perdida para sempre.**
**Princípios não-negociáveis:**
  - Simplicidade operacional — invisível ao terapeuta (não deve sentir que está "treinando um modelo")
  - Privacidade by design — anonimização e consentimento explícito (aproveita a infra LGPD da Fase 8)
  - Incremental — funciona com 10 leituras, melhora com 1000
  - Auditável — terapeuta vê "por que o sistema sugeriu X"
  - Reversível — qualquer heurística aprendida pode ser descartada
**Success Criteria** (alvo direcional, refinar no plan-phase):
  1. Após 100+ leituras anotadas com diff, o sistema sugere 1+ heurística emergente que diverge do Jensen e é validada pelo fundador como clinicamente útil.
  2. Pré-preenchimento de relatório reduz tempo médio de edição humana em ≥ 30% após N leituras (N a definir).
  3. Modelo leve (scikit-learn / XGBoost ou similar — planner decide) re-treina sem GPU em ≤ 5 minutos.
  4. Painel de auditoria mostra cada heurística aprendida com contagem de evidências + opção de descarte.
**Plans**: TBD (planejar em /gsd-plan-phase 10 quando Fase 9 fechar)
**Contexto detalhado**: ver `.planning/phases/10-aprendizagem-clinica/10-CONTEXT.md` (criado 2026-05-04 a partir de input do fundador).
**Meta de longo prazo**: primeiro sistema de iridologia baseado em evidências computacionais de câmera de celular em população brasileira contemporânea — divergindo do Jensen onde os dados mostrarem padrões diferentes da teoria clássica.

## Progresso

**Ordem de execução:**
Fases v1 executam em ordem numérica: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Fase 10 (Aprendizagem Clínica) é **post-MVP** — só inicia após Fase 9 fechar com dogfooding consolidado.

| Fase | Plans concluídos | Status | Concluída em |
|-------|------------------|--------|--------------|
| 1. Setup | 6/6 | ✅ Concluída | — |
| 2. Auth + Dashboard básico | 4/4 | ✅ Concluída | — |
| 3. Captura mobile (PWA) | 8/8* | ✅ Concluída via UAT | 2026-05-03 |
| 4. Upload desktop | 7/7 | ✅ Concluída via UAT + gsd-verifier | 2026-05-03 |
| 5. Pipeline de visão (Modal) | 17/17 | Código-completa; aguardando verify-work + founder smoke | — |
| 6. RAG — Ingestão | 7/14 | Em execução (Wave 0 + Wave 1 + Wave 2 ✅ TODAS CONCLUÍDAS — 06-01..06-07 ✅; migração 0005 aplicada na Supabase linked + persister.py implementado; Wave 3 desbloqueada — 06-08 founder-gate ingestion + 06-09/10/11 autonomous TS retrieval) | — |
| 7. Análise LLM | 0/TBD | Não iniciada | — |
| 8. Pagamento + LGPD | 0/TBD | Não iniciada | — |
| 9. Polish + dogfooding + beta | 0/TBD | Não iniciada | — |
| 10. Sistema de Aprendizagem Clínica | 0/TBD | **Backlog (planejada — pós-Fase 9)** | — |

\* **Fase 3 nota**: Plans 03-01 a 03-07 executados normalmente. Plan 03-08 (RecoveryBanner D-12, PWAInstallBanner D-14, listagem rascunhos) teve scope reduzido durante UAT — finalizeReadingAction foi absorvida em fixes pós-execução. RecoveryBanner e PWAInstallBanner deferidos para Fase 9 (polish pré-beta). Captura mobile principal funcional pós-UAT 03 (20 rounds de calibração do gate VLM Claude Haiku 4.5). Único issue conhecido: PWA standalone Android Chrome (instala mas abre com URL bar). Não bloqueia Estágio 1 (dogfood iPhone Safari).
