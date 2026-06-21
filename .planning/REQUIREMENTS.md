# Requisitos: Aurel Iris

**Definidos em:** 2026-04-30
**Valor central:** Cada cliente atendido produz um JSON de features genuinamente diferente, e por isso cada relatório é genuinamente diferente. Pipeline de visão objetivo + LLM ancorado em RAG é o coração do produto.

> **Origem:** estes requisitos foram derivados do `SPEC.md` (especificação técnica do MVP) e dos 21 *constraints* sintetizados em `.planning/intel/constraints.md`. O synthesizer marcou os candidatos REQ-* como "inferred from SPEC, non-authoritative" porque nenhum PRD foi ingerido. Esta REQUIREMENTS.md formaliza essa lista como v1 de Aurel Iris, ratificada pelo fundador para fins de execução do roadmap. Promoção para ADR pode ocorrer em qualquer fase.

## Requisitos v1

Requisitos para o release inicial. Cada um mapeia para exatamente uma fase do roadmap.

### Setup (Fase 1 — Setup)

- [x] **SETUP-01**: Projeto Next.js 15 (App Router) inicializado com TypeScript, Tailwind e shadcn/ui, deployable na Vercel.
- [x] **SETUP-02**: Contas e variáveis de ambiente configuradas para Vercel, Supabase, Stripe Brasil, Modal, Anthropic, Voyage AI e Resend.
- [x] **SETUP-03**: Schema do banco aplicado via migration no Supabase Postgres com `pgvector`, incluindo tabelas `profiles`, `clients`, `readings`, `reading_images`, `knowledge_chunks`, `subscriptions`, índices mandatórios e índice HNSW em `knowledge_chunks(embedding) vector_cosine_ops`.
- [x] **SETUP-04**: RLS habilitada nas tabelas sensíveis (`profiles`, `clients`, `readings`, `reading_images`, `subscriptions`) com políticas-base "terapeutas só veem seus próprios dados" e `knowledge_chunks` legível por qualquer autenticado.

### Autenticação (Fase 2 — Auth + Dashboard básico)

- [ ] **AUTH-01**: Terapeuta pode se cadastrar via Supabase Auth com e-mail + magic link.
- [ ] **AUTH-02**: Sessão autenticada persiste via middleware Next.js, com redirect para login em rotas protegidas.
- [ ] **AUTH-03**: Terapeuta autenticado tem registro em `profiles` com `subscription_status='trial'` e `trial_ends_at = now() + 14 days` por default.

### Clientes (Fase 2 — Auth + Dashboard básico)

- [ ] **CLIENT-01**: Terapeuta pode criar, listar, editar e ver detalhes dos próprios clientes (CRUD), respeitando RLS.
- [ ] **CLIENT-02**: Cadastro de cliente captura `full_name`, `birth_date`, `gender` e `notes`; suporta posterior associação de termo de consentimento LGPD.
- [ ] **CLIENT-03**: Layout do dashboard com navegação básica entre `/dashboard`, `/clientes` e `/leituras`.

### Captura mobile / PWA (Fase 3 — Captura mobile)

- [ ] **CAPTURE-01**: Aplicação é instalável como PWA (manifest + service worker) em iOS Safari e Chrome Android.
- [ ] **CAPTURE-02**: Tela de captura usa `getUserMedia` com câmera traseira e overlay circular guiado.
- [ ] **CAPTURE-03**: `IrisDetector` (wrapper MediaPipe `FaceLandmarker`, índices 468–477 olho direito / 473–477 olho esquerdo) valida cada frame em tempo real produzindo `QualityCheck` com `irisDetected`, `irisCenteredness`, `irisDistanceOk`, `sharpness` (variância Laplaciana > 100), `exposure`, `reflexInIrisCenter`, `eyelidOcclusion` e `overallScore`.
- [ ] **CAPTURE-04**: Captura é gated — só permitida quando `overallScore >= 0.75`; UI dá feedback ao vivo ("aproxime mais", "muito reflexo", "ótima — capturando").
- [ ] **CAPTURE-05**: Fluxo guiado conduz 6 capturas (3 ângulos `frontal | lateral | backlight` × 2 olhos `left | right`) com instruções visuais entre cada.
- [ ] **CAPTURE-06**: Imagens são comprimidas e enviadas para Supabase Storage em bucket privado por terapeuta, com URLs assinadas para consumo posterior pelo pipeline.

### Upload desktop (Fase 4 — Upload desktop)

- [x] **UPLOAD-01**: Terapeuta pode iniciar leitura via dropzone desktop, com preview e validação de tipo/tamanho.
- [x] **UPLOAD-02**: Upload desktop produz a mesma estrutura de armazenamento (`reading_images` com `eye`, `angle`, `storage_path`) que captura mobile, marcando `readings.capture_method='desktop_upload'`.

### Pipeline de visão (Fase 5 — Pipeline de visão / Modal)

- [ ] **VISION-01**: Repositório `vision-service` separado com Modal app (`@app.function(image=image, gpu="T4", timeout=120)`) expondo `analyze_iris(reading_id, image_urls)`.
- [ ] **VISION-02**: Pipeline executa, na ordem, `detect → segment → compose → normalize → enhance → features` usando MediaPipe (detecção), Hough circular OpenCV (segmentação baseline), heurísticas OpenCV para lacunas/criptas e clustering HSV para cor.
- [ ] **VISION-03**: Pipeline retorna JSON estruturado conforme contrato (SPEC §4.3): por olho, `constitution`, `iris_color`, `fiber_density`, `collarette`, `pupil`, `sectors[]`, `rings`, `global_signs`, `image_quality`; mais `asymmetry_notes[]` e `processing_metadata`.
- [ ] **VISION-04**: Next.js dispara `triggerVisionPipeline(reading_id)` que chama Modal e atualiza `readings.status` para `processing`; callback webhook em `app/api/vision/webhook/route.ts` valida HMAC e grava `readings.vision_features` (jsonb) com `status='ready'`.

### Base de conhecimento / RAG (Fase 6 — RAG ingestão)

- [ ] **RAG-01**: Script `vision-service/scripts/ingest_knowledge.py` extrai texto de PDFs/DOCX (PyMuPDF + pdfplumber + docx2txt), aplica chunking semântico custom Python (target 500 tokens flex 300–700, overlap 80, prioridade `chapter → section → paragraph`) e prepara metadata para tagging via Claude Code session (D-T1) — o script NÃO gera tags automáticas; vocabulary tagging é etapa pós-ingest D-T1..T5.
- [ ] **RAG-02**: Embeddings gerados via Voyage AI `voyage-3` em batches ≤ 128, dimensão 1024; insert em massa em `knowledge_chunks` com `source_book`, `source_chapter`, `source_page`, `metadata`.
- [ ] **RAG-03**: Corpus seed indexado: 18 PDFs/DOCX do acervo do fundador em `D:\Projetos\Iridologista\livros\` (D-S1) — Jensen, Rayid, escola Italiana (Lo Rito + Birello), escola Brasileira, Espanhola, Andrews-britânica, etc. Manifest comitado em `vision-service/scripts/data/books_manifest.json`.
- [ ] **RAG-04**: `apps/web/lib/rag/search.ts` expõe server action `retrieveRelevantKnowledge(features, reportSections)` (D-R1) que monta duas famílias de queries (A: features → constituição + setores com findings + sinais globais; B: reportSections × constituição via templates em `section-queries.ts`); busca top-K=10 por query via RPC `match_knowledge_chunks` (HNSW ef_search=100), deduplica por id, aplica reranking voyage-rerank-2.5 (D-N2 graceful fallback) + pesos D-R4 (clinical_data 1.5×, alta_prioridade 1.1×, dimensoes intersect 1.2×), cap final 30 chunks (~15k tokens). Latência p95 ≤ 2s (D-N4 early-warning), p99 ≤ 3s (D-R5 cap).

### Análise LLM (Fase 7 — Análise LLM)

- [ ] **LLM-01**: `lib/anthropic/analyze.ts` carrega features do reading, chama `retrieveRelevantKnowledge`, monta prompt com `prompts/system.md` + template `prompts/feature-injection.md` (`<client_context>`, `<features>`, `<knowledge>`) e chama Claude Sonnet 4.6 com streaming em pt-BR.
- [ ] **LLM-02**: Prompt-base impõe os 5 princípios de operação (sem diagnóstico, sem sinais inventados, prioridade ao RAG injetado, linguagem hipotética obrigatória com banco de frases proibidas, framing temporal-trauma como hipótese para anamnese) e produz relatório com as 13 seções numeradas (Constituição → Mensagem Final).
- [ ] **LLM-03**: Toda interpretação cita entre colchetes a feature do JSON que a ancora (`[ancorado em: features.X]`); o disclaimer literal de encerramento (SPEC §6) aparece em todo relatório gerado.
- [ ] **LLM-04**: Resposta crua é persistida em `readings.ai_report_raw`; UI de visualização renderiza markdown, e UI de edição grava ajustes do terapeuta em `readings.ai_report_edited` (status passa a `edited` quando salvo).

### Pagamento (Fase 8 — Pagamento + LGPD)

- [x] **BILLING-01**: Stripe Checkout BR com PIX habilitado, BRL, três tiers: Starter (R$ 89/mês, 20 análises), Profissional (R$ 189/mês, ilimitado), Escola (R$ 490/mês, white-label leve / contato).
- [x] **BILLING-02**: Trial de 14 dias automático no signup; webhook `app/api/stripe/webhook/route.ts` atualiza `profiles.subscription_status` e a tabela `subscriptions` (com `stripe_subscription_id` único, `plan`, `status`, `current_period_end`).
- [x] **BILLING-03**: Middleware bloqueia disparo de novas análises quando `trial_ends_at` venceu sem assinatura ativa; UX direciona para `/assinatura`.

### LGPD e conformidade (Fase 8 — Pagamento + LGPD)

- [x] **LGPD-01**: Geração de termo de consentimento em PDF por cliente (nome do cliente, terapeuta, escopo de uso, prazo de retenção); assinatura digital via DocuSeal ou Clicksign; URL persistida em `clients.consent_document_url` e timestamp em `clients.consent_signed_at`.
- [ ] **LGPD-02**: Bloqueio de criação de leitura para clientes sem `consent_signed_at` preenchido.
- [ ] **LGPD-03**: Botão "deletar dados" cascateia exclusão de todas as leituras, imagens e termos do cliente, com confirmação explícita.
- [x] **LGPD-04**: Logs de acesso a imagens (quem leu, quando, qual `reading_image.id`) persistidos para auditoria.
- [ ] **LGPD-05**: Páginas públicas de privacidade, termos de uso e política de retenção publicadas; copy obrigatória "ferramenta de apoio à anamnese terapêutica integrativa, não substitui avaliação médica" presente em landing, cabeçalho do relatório e rodapé legal.
- [ ] **LGPD-06**: Auditoria de vocabulário em UI, prompts e relatórios gerados confirma ausência das palavras proibidas "diagnóstico", "tratamento", "cura" em superfícies do produto (com exceção de páginas de política que as citam para negá-las).

### Onboarding e e-mail / Polish (Fase 9 — Polish + dogfooding)

- [x] **ONBOARD-01**: Onboarding em 3 passos para terapeuta novo (perfil → primeiro cliente → primeira leitura demo) com instrumentação que indica conclusão.
- [x] **ONBOARD-02**: E-mail transacional via Resend para confirmação de signup, recibo de pagamento, "leitura pronta" e exportações.
- [ ] **ONBOARD-03**: Página pública de apresentação do produto com posicionamento LGPD-compliant.
- [~] **ONBOARD-04**: Fundador (terapeuta em exercício) usa Aurel Iris **semanalmente em clientes reais** por pelo menos 3 semanas consecutivas sem recorrer a notas manuais paralelas; ajustes em prompt, UX e features dirigidos por esse uso real.
- [ ] **ONBOARD-05**: Após gate de dogfooding fechado, beta privado com 5 terapeutas internos seguido de 10–20 terapeutas selecionados (SPEC §7 Fase 8).

## Requisitos v1.1 — Motor de Conteúdo (Instagram)

Milestone v1.1. Transformar a fila de aprovação do painel `/admin/painel` num
motor que publica conteúdo no Instagram de ponta a ponta e fecha o loop de
aprendizado. Infra existente: tabela `social_posts` (migration 0045) com máquina
de estados `pendente→aprovado→agendado→publicado→reprovado`, `scheduled_at`,
`media` (carrossel/reel/post). Publicação via API oficial do Meta (Instagram
Content Publishing API), sem App Review (conta própria do founder, dev mode).

### Publicação Instagram (IGPUB — prioridade)

- [ ] **IGPUB-01**: Conta IG Professional (Business/Creator) conectada via **Instagram API with Instagram Login** (`graph.instagram.com`; ~~Página FB~~ SEM Página do Facebook obrigatória; dev mode com a conta do founder como Instagram Tester) — token de longa duração (~60d) + IG Business Account ID em `app_settings`/env Vercel, com validação/health-check da conexão.
- [ ] **IGPUB-02**: Cron no Vercel varre posts `agendado` com `scheduled_at` vencido e dispara a publicação de forma idempotente (não republica um post já publicado).
- [x] **IGPUB-03**: Publicar carrossel multi-imagem lendo as slides das URLs públicas (container por slide → container do carrossel → media_publish).
- [x] **IGPUB-04**: Publicar reel (vídeo 9:16, H.264) lendo o MP4 da URL pública (container de vídeo → poll de status → media_publish).
- [x] **IGPUB-05**: Caption + hashtags enviadas junto com o post no momento da publicação.
- [x] **IGPUB-06**: Pós-publicação, marcar `publicado` gravando o permalink/ID do post no IG; em falha, manter o post fora de `publicado` e expor o erro (motivo) no painel para reenfileiramento.

### Cockpit do painel (COCKPIT)

- [ ] **COCKPIT-01**: Terapeuta/founder agenda um post aprovado definindo `scheduled_at` na régua de composição do feed (tom/assunto/formato), consolidando o fluxo aprovar → agendar.
- [ ] **COCKPIT-02**: Ver a fila de agendados como linha do tempo/régua do feed, na ordem de publicação.
- [ ] **COCKPIT-03**: Ver no painel o status de publicação de cada post (publicado + link pro post no IG, ou erro + motivo) e reenfileirar em caso de falha.

### Loop de dados (DATA)

- [ ] **DATA-01**: Puxar automaticamente métricas do post publicado via Insights API do Meta (saves, alcance, alcance de não-seguidores, watch-time para reel) — requer permissão `instagram_manage_insights`.
- [ ] **DATA-02**: Exibir as métricas no painel por post e agregadas por linha editorial.
- [ ] **DATA-03**: Sinal de aprendizado → pauta: agregar o que performou por formato/linha editorial para orientar a próxima leva de conteúdo.

## Requisitos v2

Diferidos para release futuro. Rastreados, mas fora do roadmap atual. Origem: SPEC §9.

### Análise temporal e multi-mapa

- **EVOLV-01**: Comparação de leituras do mesmo cliente ao longo do tempo (curva evolutiva).
- **MULTIMAP-01**: Visualização simultânea de Jensen + Jausas + Hidalgo no mesmo relatório.

### Plataforma

- **WHITELBL-01**: White-label para escolas de iridologia (branding por tenant).
- **EDU-01**: "Modo formação" — estudantes consomem casos com quizzes.
- **API-01**: API pública para terapeutas integrarem com sites próprios.
- **FHIR-01**: Integração FHIR / prontuário eletrônico.

### Dados / IA

- **CASEBANK-01**: Banco anonimizado de casos com consentimento (efeito de rede).
- **CNN-01**: Treinamento de CNN própria em CASIA-Iris + casebank para detecção de lacunas/criptas (substitui heurísticas OpenCV do MVP).

## Fora de escopo

Excluídos explicitamente. Documentado para evitar reintrodução.

| Feature | Motivo |
|---------|--------|
| Diagnóstico clínico ou linguagem afirmativa | Proibido por LGPD (categoria sensível) e por posicionamento de produto. Linha vermelha permanente, não diferida. |
| Conta de paciente / cliente final | Modelo é B2B: terapeuta é o usuário. Pacientes recebem relatório pelo terapeuta. |
| App nativo iOS/Android | PWA cobre captura mobile com `getUserMedia` + MediaPipe; custo de manutenção nativa não justifica. |
| Vision-only ou LLM-only | Pipeline de duas camadas é o moat (SPEC §4.3). Qualquer simplificação destrói defensibilidade. |
| Sinais não detectados pelo pipeline interpretados pelo LLM | Princípio 2 do prompt: o LLM não inventa sinais. Quebra esse princípio = quebra produto. |
| Vocabulário proibido ("diagnóstico", "tratamento", "cura") em UI/relatório | LGPD + posicionamento. Vide LGPD-06. |

## Rastreabilidade

| Requisito | Fase | Status |
|-----------|------|--------|
| SETUP-01 | Fase 1 | Completo |
| SETUP-02 | Fase 1 | Completo |
| SETUP-03 | Fase 1 | Completo |
| SETUP-04 | Fase 1 | Completo |
| AUTH-01 | Fase 2 | Pendente |
| AUTH-02 | Fase 2 | Pendente |
| AUTH-03 | Fase 2 | Pendente |
| CLIENT-01 | Fase 2 | Pendente |
| CLIENT-02 | Fase 2 | Pendente |
| CLIENT-03 | Fase 2 | Pendente |
| CAPTURE-01 | Fase 3 | Pendente |
| CAPTURE-02 | Fase 3 | Pendente |
| CAPTURE-03 | Fase 3 | Pendente |
| CAPTURE-04 | Fase 3 | Pendente |
| CAPTURE-05 | Fase 3 | Pendente |
| CAPTURE-06 | Fase 3 | Pendente |
| UPLOAD-01 | Fase 4 | ✅ Completo (Plan 04-05, 2026-05-03) — page.tsx server component (4 guards inc. D-04) + upload-client.tsx (state machine + UploadDropzone + validateUploadFile + convertHeicToJpeg + analyzeCapturedJpeg VLM gate + CapturePreview mode='upload'); pipeline ponta-a-ponta com preview e validação MIME/size 25MB |
| UPLOAD-02 | Fase 4 | ✅ Completo (Plan 04-05, 2026-05-03) — uploadWithRetry (Fase 3) consumido verbatim insere 6 linhas em `reading_images` com path canônico `{therapist_id}/{reading_id}/originais/{eye}_{angle}.jpg` via upsert (reading_id, eye, angle); `capture_method='desktop_upload'` gravado por createReadingAction (Plan 04-02) |
| VISION-01 | Fase 5 | Pendente |
| VISION-02 | Fase 5 | Pendente |
| VISION-03 | Fase 5 | Pendente |
| VISION-04 | Fase 5 | Pendente |
| RAG-01 | Fase 6 | Pendente |
| RAG-02 | Fase 6 | Pendente |
| RAG-03 | Fase 6 | Pendente |
| RAG-04 | Fase 6 | Pendente |
| LLM-01 | Fase 7 | Pendente |
| LLM-02 | Fase 7 | Pendente |
| LLM-03 | Fase 7 | Pendente |
| LLM-04 | Fase 7 | Pendente |
| BILLING-01 | Fase 8 | Pendente |
| BILLING-02 | Fase 8 | Pendente |
| BILLING-03 | Fase 8 | Pendente |
| LGPD-01 | Fase 8 | Pendente |
| LGPD-02 | Fase 8 | Pendente |
| LGPD-03 | Fase 8 | Pendente |
| LGPD-04 | Fase 8 | Pendente |
| LGPD-05 | Fase 8 | Pendente |
| LGPD-06 | Fase 8 | Pendente |
| ONBOARD-01 | Fase 9 | ✅ Completo (Plan 09-02, 2026-05-26) — wizard inline na dashboard com 3 steps + skipable + state-derived; smoke E2E honor-system PASS pós-Fase 11.1 LIVE (13 vitest GREEN); smoke real diferido pra Fase 11 11-04 (1ª terapeuta convidada) |
| ONBOARD-02 | Fase 9 | ✅ Completo (Plans 09-03 + Fase 11 11-01, 2026-05-26) — magic-link auth (11-01) + e-mail "leitura pronta" idempotente (09-03); smoke E2E honor-system PASS pós-Fase 11.1 LIVE (12 vitest GREEN + LGPD audit + idempotência DB); smoke real diferido pra Fase 11 11-04 |
| ONBOARD-03 | Fase 9 | ⏸️ Deferred V1.1+ (decisão founder 2026-05-26, ref 09-CONTEXT.md D-01) — landing page pública sem necessidade enquanto launch v1 = B2B convite |
| ONBOARD-04 | Fase 9 | 🚧 In progress (Plan 09-04, instrumentation entregue) — founder usa diariamente desde 2026-05-15; gate fecha quando 3 semanas consecutivas ≥3 leituras/sem em clientes reais; declaração final em memory `project_dogfooding_gate_status` |
| ONBOARD-05 | Fase 9 | ⏸️ Deferred V1.1+ (decisão founder 2026-05-26) — beta 10-20 depende de Fase 8 Stripe + ONBOARD-03 landing |

**Milestone v1.1 - Motor de Conteudo:**

| Requisito | Fase | Status |
|-----------|------|--------|
| IGPUB-01 | Fase 12 | Pendente |
| IGPUB-02 | Fase 12 | Pendente |
| IGPUB-03 | Fase 12 | Pendente |
| IGPUB-04 | Fase 12 | Pendente |
| IGPUB-05 | Fase 12 | Pendente |
| IGPUB-06 | Fase 12 | Concluido (12-03 grava permalink/erro; 12-04 expoe erro no /admin pra reenfileirar) |
| COCKPIT-01 | Fase 13 | Pendente |
| COCKPIT-02 | Fase 13 | Pendente |
| COCKPIT-03 | Fase 13 | Pendente |
| DATA-01 | Fase 14 | Pendente |
| DATA-02 | Fase 14 | Pendente |
| DATA-03 | Fase 14 | Pendente |

**Cobertura:**
- Requisitos v1 totais: 43
- Mapeados em fases: 43
- Não mapeados: 0 OK

**Cobertura v1.1 - Motor de Conteudo:**
- Requisitos v1.1 totais: 12 (IGPUB 6 + COCKPIT 3 + DATA 3)
- Mapeados em fases: 12 (Fase 12: 6, Fase 13: 3, Fase 14: 3)
- Nao mapeados: 0 OK

---
*Requisitos definidos: 2026-04-30*
*Última atualização: 2026-04-30 após bootstrap inicial a partir do SPEC.md*
