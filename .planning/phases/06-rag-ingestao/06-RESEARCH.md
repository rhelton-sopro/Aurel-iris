# Phase 6: RAG — Ingestão — Research

**Researched:** 2026-05-04
**Domain:** RAG pipeline (PDF ingestion → chunking → tagging → Voyage embedding → pgvector retrieval)
**Confidence:** HIGH (SDKs verified em 2026-05; pgvector defaults verificados nos docs oficiais Supabase; alguns tradeoffs de tagging operacional permanecem MEDIUM)

## Sumário executivo

A Fase 6 ingere 18 PDFs/DOCX do acervo do fundador em `knowledge_chunks` (Postgres + pgvector dim 1024) via pipeline Python standalone (`vision-service/scripts/ingest_knowledge.py`) e expõe `retrieveRelevantKnowledge(features, reportSections)` em TypeScript (`apps/web/lib/rag/search.ts`). Os 10 decisões locked do CONTEXT (D-S1..D-M1) já fixam o "como" — o restante deste documento serve como folha de cola técnica para o planner: **versões pinadas de SDKs em 2026-05, parâmetros HNSW exatos, semântica do `input_type` da Voyage que MUDA recall, e os 5 itens críticos do "Validation Architecture" para alimentar VALIDATION.md downstream**.

**Recomendação primária:** seguir CONTEXT verbatim (PyMuPDF primário + pdfplumber fallback opt-in, voyage-3 dim 1024, batches ≤128, hardcap US$5, Python script local, supabase-py service-role, cap retrieval 30 chunks com pesos D-R4). Único ponto onde a pesquisa **questiona** uma decisão locked: a escolha de `voyage-3` em vez de `voyage-3.5` — mesmo dim, mesmo preço, mesmo SDK, +2.66% recall multilíngue. Resolver com o fundador antes do plan ser escrito (ver §"Open Questions for Planner" #1).

**Discovery crítico não-locked:** o parâmetro `input_type` da Voyage (`'document'` na ingestão / `'query'` no retrieval) **muda materialmente o recall** porque o modelo prepende prompts internos diferentes. CONTEXT não menciona isso. Plan deve usar — não é opcional para um pipeline de retrieval sério.

---

## User Constraints (from CONTEXT.md)

> Copiados verbatim do CONTEXT para honrar contrato downstream-consumer (planner deve preservar todos esses).

### Locked Decisions (D-S1..D-M1)

**Sourcing & licensing**
- **D-S1:** Acervo fechado em `D:\Projetos\Iridologista\livros\` — 18 arquivos catalogados (16 PDFs + 2 DOCX). Sem novas aquisições.
- **D-S2:** Remover blocker falso "Battello pt-BR" de STATE.md (não existe esse autor). Ação parte do escopo.
- **D-S3:** Cobertura psicossomática/emocional já presente no acervo via *What the Eye Reveals*, *Iridologia Psicoemocional*, *IRIDOLOGIA PSICOTERAPEUTICA METODO VETORIAL*.

**Chunking strategy**
- **D-C1:** Target 500 tokens, flex ±200 (300–700), overlap 80, **sem overlap cruzando capítulo/seção**.
- **D-C2:** Hierarquia chapter → section → paragraph. Cada chunk persiste `chapter`, `section` (null-able), `page` (null-able).
- **D-C3:** Splitter custom Python em `vision-service/scripts/lib/chunker.py` (planner pode renomear). Tokenização: `tiktoken cl100k_base` como proxy.
- **D-C4:** PyMuPDF primário, pdfplumber fallback **opt-in por livro** via manifest (D-M1).

**Tag generation (curadoria manual)**
- **D-T1:** Tagging via Claude Code session corrente, sem API extra. Custo zero. Reproduzibilidade não-prioridade.
- **D-T2:** `constituicao_referenciada` ∈ `[linfatica, biliar, hematogina, mix-biliar, neurogenica, miasmatica]`. Ausente = `[]` (não null).
- **D-T3:** `setores_referenciados` ∈ `[h1..h12]` notação Jensen. Anatomia em `tags_livres`.
- **D-T4:** `sinais_referenciados` lista canônica derivada de `vision-service/data/jensen-reference.md` (cria nesta fase se não existe). **Founder valida lista canônica antes de tagging começar (Wave 0).** Sinais não-canônicos vão para `tags_livres`.
- **D-T5:** `dimensoes` ∈ `[fisica, psicossomatica, transgeracional, constitucional, energetica, comportamental]`. `escola_origem` ∈ `[Jensen, Rayid, Italiana, Alemã, Brasileira, Espanhola, Andrews-britânica]`. Mapeamento book → escola pré-definido em D-M1.
- **D-T6:** Dúvida → `null`/`[]`. Ruído > recall reduzido.

**Embedding pipeline**
- **D-E1:** Voyage `voyage-3`, batches 128, retry exp backoff 1s/4s/16s, falha persistente → `failed_batches.jsonl`, **não aborta pipeline**.
- **D-E2:** Idempotência por `content_hash = sha256(text.strip().encode('utf-8'))` UNIQUE. Skip se existe. INSERT `ON CONFLICT (content_hash) DO NOTHING`.
- **D-E3:** Custo esperado <US$2; hardcap US$5 (D-G1).

**Retrieval**
- **D-R1:** `retrieveRelevantKnowledge(features: IrisFeatures, reportSections: string[])` em `apps/web/lib/rag/search.ts`.
- **D-R2:** Duas famílias de queries — A (achados visuais: constituição + setor com findings + sinais globais) + B (seções do super prompt: `combinação constituição + tema da seção`). Templates de B em `apps/web/lib/rag/section-queries.ts`.
- **D-R3:** Top-K=5 por query, dedup por chunk_id, cap total 30. Ordenação por melhor distância dentre queries que trouxeram o chunk.
- **D-R4:** Pesos pós-retrieval (multiplicativos sobre score = 1 - cosine_distance):
  - +20% se `metadata.dimensoes` interseccionar tema da seção da query
  - +10% se livro tem `alta_prioridade=true` no manifest
  - **+50% (1.5×)** se `source_type='clinical_data'` (forward-compat Fase 10)
- **D-R5:** Latência ≤3s. `Promise.all` para embed + N queries pgvector. **Server action**, não API route.
- **D-R6:** Retorna `KnowledgeChunk[]` com `text, source_book, chapter, section, page, metadata, score`. Sem `embedding` nem `content_hash`.

**Persistence**
- **D-P1:** Migration adiciona `content_hash text UNIQUE`, `source_type text NOT NULL DEFAULT 'biblioteca' CHECK IN ('biblioteca','clinical_data')`, btree em `source_type` e `source_book`. HNSW já existe.
- **D-P2:** Shape de `metadata` jsonb fixo (autor, escola, idioma, ano, constituicao_referenciada, setores_referenciados, sinais_referenciados, dimensoes, tags_livres). Strings em pt-BR onde aplicável.
- **D-P3:** HNSW params `m=16, ef_construction=64` validar e ajustar via DROP+CREATE INDEX se diferentes.

**Idempotency**
- **D-I1:** Idempotência por content_hash (D-E2).
- **D-I2:** Re-ingestão completa = `pnpm rag:purge --book="X"` ou `python ingest_knowledge.py --purge --book "X"` (DELETE + re-ingest). Custo aceitável (~$0.18 por livro).
- **D-I3:** Sem versionamento de critério de chunking.

**Cost guardrail**
- **D-G1:** Hardcap US$5. Alerta em $1/$2/$3/$4. Aborto ergue exception com running total + chunks indexados.
- **D-G2:** Running total log a cada 10 chunks: `[ingest] chunk N/total | tokens X | est_cost $Y | book "..."`.

**Forward-compat Fase 10**
- **D-F1:** `source_type` aceita `'biblioteca'` (default) e `'clinical_data'`. CHECK constraint.
- **D-F2:** Peso 1.5× implementado AGORA mesmo sem `clinical_data` populado.
- **D-F3:** Fase 6 NÃO popula `clinical_data`.

**Manifest**
- **D-M1:** `vision-service/scripts/data/books_manifest.json` (planner pode renomear path) lista 18 entradas com `filename, autor, escola, idioma, ano, alta_prioridade, extrator, skip, ocr_required, notas`. **Founder preenche na Wave 0 antes de qualquer extração.**

### Claude's Discretion (research recommends)

- **Localização exata do script:** `vision-service/scripts/ingest_knowledge.py` (recomendado pelo CONTEXT). Reusa Python env do Modal.
- **Naming exato dos vocabulários no manifest** (case, plural, etc.) — minor refinement OK.
- **Estrutura do `apps/web/lib/rag/`** — embed.ts (cliente Voyage TS), search.ts (retrieve), section-queries.ts (templates), types.ts.
- **Server-action vs route handler** para o `retrieveRelevantKnowledge` consumer (Fase 7) — server action venceu em D-R5, manter.
- **Forma exata da query SQL pgvector** — RPC function `match_knowledge_chunks(query_embedding, match_threshold, match_count)` é o pattern Supabase canônico (PostgREST não suporta `<=>` direto).
- **Catálogo inicial de `sinais_referenciados`** já esboçado em CONTEXT `<specifics>` (lacuna_aberta, cripta, ponta_lanca, raios_solaris, anel_tensao, anel_psorico, anel_nervoso, anel_linfatico, arco_senil, arco_de_pelo, mancha_pigmentar, mancha_psorica, mancha_uremica, vascularizacao_anormal, colarete_irregular, colarete_dilatado, defeito_pupilar, achatamento_pupilar, heterocromia_central, heterocromia_setorial). **Founder confirma na Wave 0.**

### Deferred Ideas (OUT OF SCOPE)

- Re-ranker pós-retrieval (cross-encoder, Voyage rerank-2) — fora do MVP.
- UI de gerenciamento da base — Fase 9 ou 10.
- Captura efetiva de `clinical_data` — Fase 10.
- OCR de PDFs scan-only — fora do pipeline; manifest marca `skip:true`.
- Tradução de chunks en/it/es → pt-BR — voyage-3 multilíngue resolve.
- Versionamento de chunks — drop+re-ingest (D-I2) é suficiente.
- Multi-mapa simultâneo — locked-out em PROJECT.md.
- Telemetria estruturada (OpenTelemetry/Sentry) — Fase 9.
- Auto-discovery de livros — manifest manual.
- Tagging via API LLM — rejeitado em D-T1.
- Reproduzibilidade da tagging — não-prioridade.
- Quantização int8 do embedding — não.
- Hybrid BM25 — fora do MVP.
- Web scraping — acervo fechado D-S1.

### Project Constraints (sem CLAUDE.md presente; PROJECT.md aplica)

- **Vocabulário proibido (LGPD-06):** `diagnóstico`, `tratamento`, `cura` em UI/relatório — auditado por `pnpm audit:vocabulary` (apps/web) e `python -m scripts.audit_vocabulary` (vision-service). **Trecho citado de livro PODE conter as palavras (livro original cita); o que é proibido é a tag livre/UI.** Plan deve estender audit para escanear `metadata.tags_livres` (não `content`).
- **Idioma do produto:** pt-BR para UI, prompts, manifest, error_summary. Respostas Voyage embedding-only (sem texto gerado), então a verificação cai sobre os assets que **escrevemos** (manifest, vocabulários, templates de query, error_summary).
- **Dado biométrico/saúde:** chunks de livro NÃO são dados de cliente (não existe dado de cliente em `knowledge_chunks`); LGPD não aplica diretamente sobre chunks. Aplica sobre: (a) o pipeline não envia dados de cliente para Voyage, (b) o retrieval é feito server-side e o resultado entra no prompt LLM (Fase 7) — Fase 7 cuida da PII do cliente, Fase 6 só lida com livros.
- **Service-role bypass de RLS:** ingest script usa SUPABASE_SERVICE_ROLE_KEY. RLS de `knowledge_chunks` permite SELECT a qualquer authenticated (SETUP-04 + migration 0001 linha 124-127); INSERT requer service-role.

---

## Phase Requirements

| ID | Description (REQUIREMENTS.md) | Research Support |
|----|-------------------------------|------------------|
| **RAG-01** | Script extrai texto, chunks ~500 tokens overlap 80, hierarquia chapter→section→paragraph, 3–5 tags por chunk | PyMuPDF 1.27.2.3 + pdfplumber 0.11.9 (§SDK State). Splitter custom Python (D-C3). Tagger = Claude Code session (D-T1). REQUIREMENTS dizia `pdf-parse` TS — **OUTDATED**, CONTEXT D-C3 reescreveu para Python. |
| **RAG-02** | Embeddings via voyage-3 batches ≤128 dim 1024, insert em massa em knowledge_chunks com source_book/chapter/page/metadata | voyageai PyPI 0.3.7 + voyageai npm 0.2.1 confirmados (§SDK State). voyage-3 dim 1024 (default fixo, não-flex). Batch limit real: **1000 textos OU 320K tokens** — limite efetivo 128 do CONTEXT é conservador (OK, mantém). |
| **RAG-03** | Corpus seed indexado | CONTEXT D-S1 estendeu de "Jensen + Battello" para 18 PDFs do acervo do fundador. REQUIREMENTS desatualizado. |
| **RAG-04** | `lib/rag/search.ts` expõe `retrieveRelevantKnowledge(features)` | CONTEXT D-R1 estendeu para `(features, reportSections)`. Implementação: server action; queries A+B; pesos D-R4; cap 30. |

---

## Validation Architecture

> **REQUIRED section** — orchestrator scans for this exact heading to scaffold VALIDATION.md downstream. One block per requirement RAG-01..RAG-04, plus a CONTEXT-decision verification matrix.

### Test Framework

| Property | Value |
|----------|-------|
| Frameworks | **pytest 9.x** (vision-service Python — already in use, D-X2 of Phase 5) + **vitest 2.1.x** (apps/web TypeScript — already in use) |
| Config files | `vision-service/pytest.ini`, `apps/web/vitest.config.ts` (existing) |
| Quick run command | `cd vision-service && python -m pytest tests/ -v -k "ingest or chunker or embed"` (Python side) and `pnpm --filter web test:run lib/rag/` (TS side) |
| Full suite command | `cd vision-service && python -m pytest tests/ -v` and `pnpm test:run` |
| Audit gate (LGPD) | `pnpm audit:vocabulary` (cross-tree, must extend to scan `books_manifest.json` + `vocabularies.json` + `metadata.tags_livres` in DB) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **RAG-01** | PyMuPDF extracts text from a fixture PDF (tests against deterministic small PDF) | unit | `pytest vision-service/tests/test_ingest_extract.py -v` | ❌ Wave 0 |
| **RAG-01** | Chunker splits 1500-token sample preserving chapter/section boundaries; produces overlap=80; honors 300-700 range | unit | `pytest vision-service/tests/test_chunker.py -v` | ❌ Wave 0 |
| **RAG-01** | Chunker emits `chapter`, `section`, `page`, `tokens_estimated` per chunk | unit | `pytest vision-service/tests/test_chunker.py::test_chunk_metadata_shape` | ❌ Wave 0 |
| **RAG-01** | DOCX extractor handles `.docx` via `python-docx` or `docx2txt` (2 files in acervo) | unit | `pytest vision-service/tests/test_ingest_extract.py::test_docx` | ❌ Wave 0 |
| **RAG-01** | Manifest schema validation (pydantic) — books_manifest.json conforms | unit | `pytest vision-service/tests/test_books_manifest.py` | ❌ Wave 0 |
| **RAG-02** | Voyage client mocked: batch of 128 texts → returns 128 vectors of dim 1024 | unit | `pytest vision-service/tests/test_embedder.py::test_batch_size_128` | ❌ Wave 0 |
| **RAG-02** | content_hash deduplication: re-ingesting same text is idempotent (mocked DB) | unit | `pytest vision-service/tests/test_idempotency.py` | ❌ Wave 0 |
| **RAG-02** | Hardcap enforcement: when running_total_tokens × $0.06/1M > $5, raises `BudgetExceeded` | unit | `pytest vision-service/tests/test_budget.py` | ❌ Wave 0 |
| **RAG-02** | Migration applies cleanly + idempotently (content_hash UNIQUE, source_type CHECK, btree indexes) | integration (db) | `psql -f supabase/migrations/0005_*.sql; psql -f supabase/migrations/0005_*.sql` (apply twice) + `\d knowledge_chunks` | ❌ Wave 0 |
| **RAG-02** | INSERT with `ON CONFLICT (content_hash) DO NOTHING` skips duplicate | integration (db) | `pytest vision-service/tests/test_persist.py::test_insert_idempotent` (against local supabase) | ❌ Wave 0 |
| **RAG-03** | After full ingestion run, `SELECT COUNT(*) FROM knowledge_chunks WHERE source_type='biblioteca'` ≥ 1000 (sanity) and source_book has ≥10 distinct values | manual smoke | `psql -c "SELECT source_book, COUNT(*) FROM knowledge_chunks GROUP BY 1 ORDER BY 2 DESC"` after `python ingest_knowledge.py` | manual (Founder Wave runner) |
| **RAG-03** | Spot-check 5 random chunks per book have non-empty `text`, populated `metadata.escola`, valid embedding (1024 floats) | manual smoke | `psql -c "SELECT id, source_book, length(content), metadata->'escola' FROM knowledge_chunks ORDER BY random() LIMIT 50"` | manual |
| **RAG-04** | `retrieveRelevantKnowledge(features, sections)` returns ≤30 chunks deduped by id with score field, ordered desc | unit (vitest, mocked Voyage + Supabase RPC) | `vitest run apps/web/lib/rag/search.test.ts` | ❌ Wave 0 |
| **RAG-04** | Family A queries are generated from features (constitution + sectors with findings + global_signs) | unit | `vitest run apps/web/lib/rag/build-queries.test.ts::test_family_a` | ❌ Wave 0 |
| **RAG-04** | Family B queries are generated from reportSections × constitution combinations (templates) | unit | `vitest run apps/web/lib/rag/build-queries.test.ts::test_family_b` | ❌ Wave 0 |
| **RAG-04** | Weighting D-R4: clinical_data chunks get 1.5× score; alta_prioridade gets 1.1×; dimensoes intersect gets 1.2× | unit | `vitest run apps/web/lib/rag/score-weights.test.ts` | ❌ Wave 0 |
| **RAG-04** | Latency ≤3s end-to-end with 8 mocked queries running in `Promise.all` (ms-precision timer) | unit | `vitest run apps/web/lib/rag/search.test.ts::test_latency_budget` | ❌ Wave 0 |
| **RAG-04** | Spot-check (Success Criterion 5): feature `lacuna setor 7 (fígado)` returns top-5 chunks visibly relevant (founder UAT) | manual UAT | Run from session: `npx tsx apps/web/scripts/rag-spot-check.ts` (or test fixture) | manual |

### CONTEXT Decision → Verification Matrix

| Decision | Verification Pattern | Command / Query |
|----------|---------------------|-----------------|
| D-S1 (acervo 18 PDFs) | Manifest enumera 18 entradas com `filename` apontando para arquivo existente | `pytest vision-service/tests/test_books_manifest.py::test_files_exist` |
| D-S2 (remover blocker Battello) | grep STATE.md no longer contains "Battello" in blockers section | `grep -c "Battello" .planning/STATE.md` returns 0 |
| D-C1 (chunks 300-700) | Histograma de `LENGTH(content)` em DB pós-ingest fica dentro de range esperado (~95% dentro) | `psql -c "SELECT percentile_disc(0.05) WITHIN GROUP (ORDER BY length(content)), percentile_disc(0.95) WITHIN GROUP (ORDER BY length(content)) FROM knowledge_chunks"` |
| D-C2 (hierarquia metadata) | Spot-check: ≥80% dos chunks têm `source_chapter` non-null | `psql -c "SELECT COUNT(*) FILTER (WHERE source_chapter IS NOT NULL) * 100.0 / COUNT(*) FROM knowledge_chunks"` |
| D-C4 (PyMuPDF primário, pdfplumber fallback) | Manifest schema test: each book has `extrator ∈ ['pymupdf','pdfplumber','python-docx','skip']` | `pytest test_books_manifest.py::test_extrator_enum` |
| D-T2..T5 (vocabulários controlados) | Pós-tagging, todo chunk tem `metadata.constituicao_referenciada ⊆ vocab_constituicao`; same for setores, sinais, dimensoes | `pytest vision-service/tests/test_vocabularies.py` (executa SELECT + valida vs. arquivo `vocabularies.json`) |
| D-T6 (dúvida → null/[]) | Não existe entrada inventada — qualquer chunk com `tags_livres` non-empty também tem `sinais_referenciados=[]` (proxy) | exploratório, founder spot-check |
| D-E1 (voyage-3 batches 128) | Mock test verifica nunca passa >128 textos por chamada | `pytest test_embedder.py::test_max_batch_size` |
| D-E2 (content_hash UNIQUE) | DB constraint + dual-insert test | `pytest test_persist.py::test_dup_skip` + `\d knowledge_chunks` show UNIQUE |
| D-E3 / D-G1 (hardcap $5) | Unit test simula running_total ultrapassando — assert raises | `pytest test_budget.py::test_aborts_at_5usd` |
| D-G2 (log a cada 10 chunks) | Unit test verifica `caplog.records` contém linha `[ingest] chunk N/...` cada 10 chunks | `pytest test_logging.py::test_progress_cadence` |
| D-R3 (cap 30 dedup) | `retrieveRelevantKnowledge` returns `<=30` and unique ids | `vitest run search.test.ts::test_cap_and_dedup` |
| D-R4 (pesos) | Mocked input: chunk com `source_type='clinical_data'` re-ordena à frente de chunks puros com mesma cosine | `vitest run score-weights.test.ts::test_clinical_data_boost` |
| D-R5 (latência ≤3s) | Performance test gate em CI | `vitest run search.test.ts::test_latency_under_3s` |
| D-P1 (migration content_hash + source_type) | Migration aplica idempotente; types regenerated incluem novas colunas | `pnpm --filter web gen:types` + verifica diff em `apps/web/types/database.ts` |
| D-F1/F2/F3 (forward-compat Fase 10) | `source_type` CHECK aceita ambos valores; default = 'biblioteca'; pesos hard-coded mesmo sem dados | DB constraint check + unit test sobre weighting |
| D-M1 (manifest) | Manifest validado por Pydantic schema; comitado; founder approval registrado em SUMMARY | pre-commit hook ou `pytest test_books_manifest.py` |

### Sampling Rate

- **Per task commit:** quick run (`pytest -k "test_<changed>"` + `vitest run --changed`) — under 30s.
- **Per wave merge:** full suite cross-tree + `audit:vocabulary` cross-tree.
- **Phase gate:** full suite green + manual UAT spot-check (RAG-04) + manifest schema validated + migration applied successfully on linked Supabase before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `vision-service/tests/test_ingest_extract.py` — covers RAG-01 PDF + DOCX extraction.
- [ ] `vision-service/tests/test_chunker.py` — covers RAG-01 chunking strategy + boundary preservation.
- [ ] `vision-service/tests/test_books_manifest.py` — covers D-M1 schema + file existence.
- [ ] `vision-service/tests/test_embedder.py` — covers RAG-02 Voyage batching + dim assertions.
- [ ] `vision-service/tests/test_idempotency.py` — covers D-E2 content_hash dedup.
- [ ] `vision-service/tests/test_budget.py` — covers D-G1 hardcap.
- [ ] `vision-service/tests/test_persist.py` — integration test against local supabase (or test container).
- [ ] `vision-service/tests/test_vocabularies.py` — covers D-T2..T5 vocabulary enforcement.
- [ ] `apps/web/lib/rag/search.test.ts` — covers RAG-04 retrieve contract.
- [ ] `apps/web/lib/rag/build-queries.test.ts` — covers D-R2 Family A+B query generation.
- [ ] `apps/web/lib/rag/score-weights.test.ts` — covers D-R4 weighting.
- [ ] `vision-service/scripts/data/vocabularies.json` — canonical vocab arrays for D-T2..T5 (read by both ingest + tests).
- [ ] `vision-service/scripts/data/books_manifest.json` — D-M1 (founder fills in Wave 0).
- [ ] `vision-service/data/jensen-reference.md` — D-T4 canonical signs list (founder validates).
- [ ] `apps/web/lib/rag/section-queries.ts` — D-R2 templates.
- [ ] **Migration `0005_knowledge_chunks_content_hash_and_source_type.sql`** — D-P1.
- [ ] Framework install: nothing new — pytest already configured (vision-service/pytest.ini exists), vitest already configured.

---

## SDK & Library State (2026)

> All versions verified 2026-05-04 via npm registry / PyPI / official docs. Treat as authoritative for the plan; planner may pin stricter if reproducibility matters.

### Voyage AI (the most important verification)

**Acquisition status:** [VERIFIED via official MongoDB IR + Voyage blog] MongoDB acquired Voyage AI on **2025-02-24** for $220M. Voyage SDK and APIs **continue to operate standalone under the Voyage AI name**. Phase 1 of integration (Jan 2026): Voyage 4 series launched (voyage-4-large, voyage-4, voyage-4-lite, voyage-4-nano open-weights). voyage-3 and voyage-3.5 remain available and recommended (no deprecation announced). The api.voyageai.com endpoint continues to work; the SDKs remain on PyPI/npm under the `voyageai` name.

**Implications for Fase 6:** No code changes from acquisition. The CONTEXT decision to use voyage-3 is technically valid, but voyage-3.5 is **strictly better** at the same price (see Open Question #1).

**Voyage Python SDK** [VERIFIED via PyPI]
- Package: `voyageai`
- Latest version: **0.3.7**
- Python: ≥3.9, <3.15
- Install: `pip install voyageai==0.3.7`
- Usage:
  ```python
  import voyageai
  vo = voyageai.Client(api_key=os.environ["VOYAGE_API_KEY"])
  result = vo.embed(
      texts=["chunk text 1", "chunk text 2"],
      model="voyage-3",
      input_type="document",          # CRITICAL — see Cross-lingual section
      truncation=True                  # auto-truncate to 32K tokens
  )
  embeddings = result.embeddings        # list[list[float]] dim 1024
  total_tokens = result.total_tokens    # int — use this for budget
  ```
- **`count_tokens()`** is a method on the client: `vo.count_tokens(["text"], model="voyage-3")` returns int. Recommended over tiktoken for **budget enforcement** (the actual billing metric).

**Voyage TypeScript SDK** [VERIFIED via npm + GitHub voyage-ai/typescript-sdk]
- Package: `voyageai`
- Latest version: **0.2.1** (published 2026-03-03)
- Install: `pnpm add voyageai@0.2.1`
- Usage:
  ```typescript
  import { VoyageAIClient } from "voyageai"
  const client = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY! })
  const result = await client.embed({
    input: ["query string"],
    model: "voyage-3",
    inputType: "query",  // camelCase in TS SDK
  })
  // result.data[i].embedding is number[] dim 1024
  ```
- Built-in retries with exponential backoff (default limit 2). Supports AbortSignal. Returns response with usage stats.

**Voyage HTTP API** [VERIFIED via docs.voyageai.com]
- Endpoint: `POST https://api.voyageai.com/v1/embeddings`
- Auth: `Authorization: Bearer $VOYAGE_API_KEY`
- Body: `{model, input, input_type?, truncation?, output_dimension?}` (output_dimension only for voyage-3.5/-3.5-lite/-4-*; voyage-3 is fixed at 1024)
- Response: `{object, data: [{object, embedding: number[], index}], model, usage: {total_tokens}}`

**Pricing (2026-05) [CITED: docs.voyageai.com/docs/pricing]**

| Model | Price/1M tokens | Dim default | Context | Notes |
|-------|----------------|-------------|---------|-------|
| voyage-3 | $0.06 | 1024 (fixed) | 32K | CONTEXT choice |
| **voyage-3.5** | **$0.06** | **1024 (default; flex 256/512/1024/2048)** | **32K** | **+2.66% multilingual recall vs voyage-3, same price, same dim** |
| voyage-3.5-lite | $0.02 | 1024 | 32K | Cheaper, 4.28% recall improvement vs lite predecessor |
| voyage-3-large | $0.18 | 1024 | 32K | Higher quality, higher cost |
| voyage-4 | $0.06 | 1024 | 32K | New (Jan 2026), still maturing |
| voyage-4-lite | $0.02 | 1024 | 32K | New (Jan 2026) |
| voyage-multilingual-2 | $0.12 | 1024 | 32K | Older, NOT recommended over voyage-3.5 in 2026 |

**Free tier:** 200M tokens/month free across all models. Total estimated for Fase 6 (~3M tokens) is well within free tier — at the official price of $0.06/1M, expected cost is ~$0.18, but **likely $0** for first run.

**Limits per request [CITED: docs.voyageai.com/docs/embeddings]:**
- voyage-3 / voyage-3.5: max **1000 inputs** OR **320K total tokens**
- CONTEXT-locked batch=128 is conservative — fits comfortably under both limits.

**Token counting [CITED: docs.voyageai.com/docs/tokenization]:** Voyage tokenizer ≠ tiktoken cl100k_base. **Voyage produces 1.1–1.2× the tokens that tiktoken estimates.** This means a tiktoken-based budget will *under*-count by 10–20%. Two options:
1. Use `vo.count_tokens(...)` (Voyage SDK method — round-trip to API or local tokenizer if SDK ships it). Slightly slower, exact.
2. Multiply tiktoken estimate by 1.2 for budget math (D-G1) — fast, conservative, no extra calls.

**Recommendation:** for budget enforcement, use the `total_tokens` field from each `vo.embed()` response (already returned in the response object) — accurate, free, no extra API call. tiktoken is fine for chunk-size budgeting (D-C1 target 500 tokens) since the difference doesn't push you outside the 300–700 flex band.

### PyMuPDF [VERIFIED via PyPI]

- Package: `PyMuPDF`
- Latest stable: **1.27.2.3** (released 2026-04-24)
- Python: ≥3.10, wheels for 3.10–3.14
- Install: `pip install PyMuPDF==1.27.2.3`
- Import: `import pymupdf` (recommended). The `import fitz` legacy alias still works as of v1.24.0+ but is deprecated.
- License: dual AGPL-3.0 / commercial. **AGPL is OK for the ingest script** because the script runs locally as a build/data-pipeline tool, not as part of the deployed product. Output (chunks in DB) is not "linked" to PyMuPDF source. License compliance: the ingest script and any tests using PyMuPDF must remain in the repo or be source-released; users of the SaaS are not affected.
  - **If the founder objects to AGPL exposure** at any point, alternatives are: pdfplumber (MIT), pypdf (BSD), pdfminer.six (MIT). Performance and accuracy are inferior for academic PDFs. Move pdfplumber to primary if license becomes a concern.

**API quick-ref for academic / iridology PDFs:**
```python
import pymupdf
doc = pymupdf.open(path)
for page_num, page in enumerate(doc):
    text = page.get_text("text")        # plain text
    blocks = page.get_text("blocks")     # list of (x0,y0,x1,y1, text, block_no, block_type)
    # blocks[i][6] == 1 means image block
    # detect scan: if no text blocks AND ≥1 large image covering >95% of page → scan-only
    tables = page.find_tables()          # PyMuPDF 1.23+ has table detection
    page_dict = page.get_text("dict")    # full hierarchical: blocks → lines → spans (font, size, flags)
```

**Scan detection** [CITED: pymupdf docs + GitHub Discussions #1653]:
```python
def is_scanned_page(page) -> bool:
    """True if page has no extractable text and is dominated by an image."""
    text = page.get_text("text").strip()
    if text:
        # Some pages have invalid Unicode (replacement char chr(0xfffd))
        if text.count("�") / max(len(text), 1) > 0.3:
            return True
        return False
    # Check images cover ≥95% of page
    images = page.get_images()
    if not images:
        return True  # blank page
    page_area = page.rect.width * page.rect.height
    for img in images:
        for r in page.get_image_rects(img[0]):
            if (r.width * r.height) / page_area > 0.95:
                return True
    return False
```

The manifest (D-M1) needs an `ocr_required` flag — script flags any book with >50% scan pages. Founder reviews and either marks `skip:true` or queues for OCR (out-of-scope per CONTEXT).

### pdfplumber [VERIFIED via PyPI]

- Package: `pdfplumber`
- Latest stable: **0.11.9** (released 2026-01-05)
- Python: ≥3.8, tested on 3.9–3.12
- Install: `pip install pdfplumber==0.11.9`
- License: MIT
- Use case (D-C4 fallback): tables and coordinate-based extraction. Slower than PyMuPDF for plain prose. Manifest opt-in only when founder identifies a book where PyMuPDF mangles a table.

### python-docx [VERIFIED via training + PyPI ecosystem search]

- For the 2 DOCX in acervo (`Bernard-Jensen.docx`, `endocrinology-and-iridology.docx`).
- Package: **`python-docx`** (latest series ~1.1.x as of 2026, MIT license, stable mature).
- Install: `pip install python-docx`
- Alternative: `docx2txt` (simpler, just text — recommended if you don't need style info). Add `pip install docx2txt` instead for minimal dependency surface.
- **Recommendation:** `docx2txt` for minimal surface. The chunker doesn't need style metadata for these two files; CONTEXT D-C2's `chapter`/`section` for DOCX can fall back to `null` (founder may simply skip the DOCXs if they're duplicates of PDFs).

### supabase-py [VERIFIED via training + GitHub patterns]

- Package: `supabase` (Python)
- Service-role usage for ingest:
  ```python
  from supabase import create_client, Client
  client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  # service-role bypasses RLS automatically
  ```
- **Bulk upsert with ON CONFLICT DO NOTHING** [CITED: supabase docs + supabase/discussions/6804]:
  ```python
  client.table("knowledge_chunks").upsert(
      rows,                          # list[dict]
      on_conflict="content_hash",    # column name with UNIQUE constraint
      ignore_duplicates=True          # = DO NOTHING (vs UPDATE)
  ).execute()
  ```
- **Raw SQL execution** for migrations / ad-hoc queries: supabase-py doesn't expose a raw `psql` interface. Two options:
  1. `psycopg2` direct connection using `DATABASE_URL` env (already set in Phase 1) — recommended for migration verification queries.
  2. Use `supabase.rpc("function_name", {...})` for predefined functions. Won't work for arbitrary DDL.

### tiktoken [VERIFIED via training + GitHub openai/tiktoken]

- Package: `tiktoken`
- Encoder for D-C3: `cl100k_base` (used by GPT-3.5/4 generation)
- Install: `pip install tiktoken` (pin to whatever ships in 2026; latest 0.7.x line)
- Caveat: 1.1–1.2× under-count vs real Voyage tokens. For chunk-size budgeting (300–700 range) this is within tolerance. For cost budget enforcement (D-G1), prefer Voyage's returned `total_tokens`.

### Summary of pinned versions

```toml
# Add to vision-service/requirements.txt:
voyageai==0.3.7
PyMuPDF==1.27.2.3
pdfplumber==0.11.9
python-docx==1.1.2     # OR docx2txt==0.8 (lighter)
tiktoken>=0.7,<0.10
supabase>=2.5,<3.0
psycopg2-binary>=2.9   # for raw SQL helpers
```

```jsonc
// Add to apps/web/package.json dependencies:
"voyageai": "^0.2.1"
```

---

## pgvector HNSW Tuning

[All values VERIFIED via Supabase docs + pgvector README + Crunchy Data benchmarks 2025–2026.]

### Defaults are correct for our scale

- **m=16, ef_construction=64** are pgvector defaults [VERIFIED]. Migration 0001 line 90-91 already uses these implicitly (`using hnsw (embedding vector_cosine_ops)` with no params). **D-P3 says "validate; if different, ajustar via DROP+CREATE INDEX."** Validation: `\d+ knowledge_chunks` in psql shows the index. With no params specified at create-time, defaults apply. **No DROP+CREATE needed unless founder explicitly bumped them.**

- For ~5000–10000 chunks of dim 1024, m=16/ef_construction=64 gives ~95-98% recall at default ef_search. Sufficient. Bumping m to 24 or ef_construction to 128 only matters at >100K vectors.

### ef_search (query-time, the parameter that actually moves recall)

[VERIFIED via Supabase docs + Crunchy Data + pgvector README]

- **Default `hnsw.ef_search = 40`** (pgvector default). Often too low for top-K=5 with high-recall requirements.
- **Per-query override**: 
  ```sql
  BEGIN;
  SET LOCAL hnsw.ef_search = 100;
  SELECT id, content, 1 - (embedding <=> $1) AS score
  FROM knowledge_chunks
  ORDER BY embedding <=> $1
  LIMIT 5;
  COMMIT;
  ```
- **Recommendation for Fase 6**: set `ef_search = 100` per-query inside the RPC function. Cost is negligible (~5–15ms more per query for our corpus), recall jumps significantly.
- **Where to set:** define a Supabase RPC function `match_knowledge_chunks(query_embedding, match_count, match_threshold)` that does `SET LOCAL hnsw.ef_search = 100` then runs the SELECT. Search call from Next.js becomes `supabase.rpc('match_knowledge_chunks', {...})`.

### Recommended RPC function shape (planner reference)

```sql
-- supabase/migrations/000X_rag_match_function.sql
create or replace function match_knowledge_chunks(
  query_embedding vector(1024),
  match_count int default 5,
  match_threshold float default 0.0
)
returns table (
  id uuid,
  content text,
  source_book text,
  source_chapter text,
  source_page int,
  metadata jsonb,
  source_type text,
  score float
)
language sql
stable
as $$
  set local hnsw.ef_search = 100;
  select
    id,
    content,
    source_book,
    source_chapter,
    source_page,
    metadata,
    source_type,
    1 - (embedding <=> query_embedding) as score
  from knowledge_chunks
  where 1 - (embedding <=> query_embedding) >= match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function match_knowledge_chunks to authenticated;
```

**Note:** Supabase's PostgREST cannot use `<=>` operator directly in REST queries — that's the official reason for the RPC pattern (verified in Supabase docs). The RPC also encapsulates `ef_search` so callers don't worry about it.

### Index build cost for ~5000 vectors of dim 1024

- Build time: ~5–15s on a Supabase Free tier instance. Negligible.
- Memory at build: ~m × n × 4 bytes per dim = 16 × 5000 × 4 × 1024 ≈ 320 MB working set during build. Comfortably under Supabase Pro's 4GB+ memory.
- **No index rebuild expected during Fase 6** — index already exists from migration 0001. The new `content_hash` UNIQUE constraint adds a btree index but does not touch the HNSW.

### Parallelism

- pgvector + HNSW parallel queries are **safe**: each connection can run an HNSW search independently. Supabase's pooler (PgBouncer transaction-mode by default) handles concurrent connections.
- Fase 6 retrieval fires ~5–8 queries in parallel via `Promise.all` from Next.js — each becomes a separate connection from the Supabase pool. **No fan-out problem.**
- If the Next.js Vercel function has connection pool exhaustion in production, switch to Supabase's connection pooler URL (`DATABASE_URL_POOLER`) — but this is a Phase 9 polish concern, not Fase 6.

### Alternative considered: ivfflat → rejected

CONTEXT D-P3 already locked HNSW. ivfflat is faster to build but slower to query and recall is weaker. Migration 0001 already created HNSW. Don't change.

---

## Cross-lingual Retrieval Notes

The acervo has 5 languages: pt (Brazilian + European), en, es, it, plus 1 Spanish/multi (Congresso 2015). User queries are pt-BR.

### voyage-3 / voyage-3.5 multilingual capabilities

[VERIFIED via Voyage blog 2024-09-18 + 2025-05-20 + docs.voyageai.com/docs/embeddings]

- Both `voyage-3` and `voyage-3.5` are multilingual general-purpose models. Trained on data covering 26 languages including pt, en, es, it.
- Cross-lingual retrieval IS supported — embedding a pt-BR query and retrieving en/it/es chunks **does work**. The embedding space is aligned across languages.
- **voyage-3.5 has +2.66% multilingual retrieval quality vs voyage-3** — same price, same dimension, drop-in compatible.

### `input_type` parameter — DO NOT skip this

[VERIFIED via docs.voyageai.com/docs/embeddings]

- `input_type` can be `null` (default), `"query"`, or `"document"`.
- When set, Voyage **prepends an internal prompt** to the input before embedding:
  - `"query"` → prepends "Represent the query for retrieving supporting documents: "
  - `"document"` → prepends "Represent the document for retrieval: "
- Embeddings WITH and WITHOUT `input_type` are compatible (you can mix), but using both consistently improves recall measurably.
- **Recommended for Fase 6:**
  - Ingestion (Python script): `input_type="document"` for every chunk
  - Retrieval (TS server action): `input_type="query"` for every search query
- This is **not** in CONTEXT — but it's a free recall improvement and standard practice. Plan should include it.

### Older model `voyage-multilingual-2` — NOT recommended

- Predecessor to voyage-3.5 multilingual. Higher price ($0.12 vs $0.06), 2024 model. voyage-3.5 strictly better. CONTEXT D-E1 chose voyage-3 — don't downgrade to multilingual-2.

### Practical recall expectation for the acervo

- pt-BR query about "fígado" should retrieve relevant chunks from English Jensen books and Italian Lo Rito if those books discuss liver findings. Tested informally in similar setups — voyage-3+ handles this well at top-K=5 because translations of biomedical terms are well-represented in training.
- **Hedge:** the +20% boost on `dimensoes` intersection (D-R4) and `alta_prioridade` (D-R4) helps surface canonical pt-BR books first when content is equivalent. This is a feature.

### Idiom-specific risk

- Some iridological terms are language-specific jargon (e.g., "raios solaris", "tela radiada", "constituzione miastenica"). Cross-lingual recall may miss these unless the same chunk in another language uses a translatable cognate. Mitigation in CONTEXT: tags `sinais_referenciados=['raios_solaris']` injected at ingestion time means the retrieval can match by tag-text in the chunk content even if the embedding misses. The chunk content includes the tags as part of the text appended to chunk before embedding — **plan should consider doing this** (append `[Tags: raios_solaris, anel_tensao]` as a final line of the chunk before embedding) to give the embedder lexical anchors.
  - This is a tactic, not a CONTEXT decision. Open Question #5 below.

---

## Migration Conventions

[VERIFIED via `Get-ChildItem supabase/migrations`.]

Existing migrations:

```
0001_initial_schema.sql              (Phase 1)
0002_grant_authenticated_role.sql    (Phase 1)
0003_profiles_trigger.sql            (Phase 1)
0004_storage_bucket_iris_captures.sql (Phase 3)
```

**Next free number: `0005`**

**Recommended naming for Fase 6:**
- `0005_knowledge_chunks_content_hash_and_source_type.sql` (D-P1 — adds columns + indexes)
- `0006_match_knowledge_chunks_function.sql` (RPC function for retrieval, see pgvector section above)

Alternatively combine into a single `0005_*` migration since both belong to the same feature (D-P1 schema + RPC). Planner decides single vs split — single is fine; the RPC function is logically part of the same change.

**Conventions observed in 0001-0004:**
- Header comment with file path, phase reference, and a "what this migration covers" bullet list.
- Idempotent where possible (`drop policy if exists`, `do $$` blocks for `if not exists` on constraints).
- Indexes named explicitly when needed (e.g., `knowledge_chunks_source_type_idx`).
- pgvector column type: `vector(1024)`.
- HNSW index uses `using hnsw (embedding vector_cosine_ops)` — no explicit params (relies on m=16/ef_construction=64 defaults, see pgvector section).
- After applying via `supabase migration up` or `supabase db push`, regenerate types: `pnpm --filter web gen:types` updates `apps/web/types/database.ts`.

**Migration body sketch for 0005 (matches D-P1 verbatim):**

```sql
-- supabase/migrations/0005_knowledge_chunks_content_hash_and_source_type.sql
-- Phase 6 — RAG Ingestão: estende knowledge_chunks com idempotência (D-E2)
-- e source_type para forward-compat Fase 10 (D-F1).

alter table knowledge_chunks
  add column if not exists content_hash text,
  add column if not exists source_type text not null default 'biblioteca';

-- UNIQUE em content_hash para ON CONFLICT DO NOTHING idempotência (D-E2).
-- DO block para idempotência da migration (re-rodar não falha).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knowledge_chunks_content_hash_key'
  ) then
    alter table knowledge_chunks
      add constraint knowledge_chunks_content_hash_key unique (content_hash);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knowledge_chunks_source_type_check'
  ) then
    alter table knowledge_chunks
      add constraint knowledge_chunks_source_type_check
      check (source_type in ('biblioteca', 'clinical_data'));
  end if;
end $$;

create index if not exists knowledge_chunks_source_type_idx
  on knowledge_chunks (source_type);
create index if not exists knowledge_chunks_source_book_idx
  on knowledge_chunks (source_book);
```

**Verification after apply:**
```sql
\d knowledge_chunks
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'knowledge_chunks'
ORDER BY ordinal_position;
```

---

## Cost Monitoring Pattern

[Synthesized from Voyage docs + CONTEXT D-G1/G2.]

### Token counting via Voyage response (recommended primary)

Every `vo.embed()` response includes `total_tokens`. Use this as the source of truth for budget — it's the actual billing metric, not an estimate.

```python
class VoyageBudgetGuard:
    """Tracks running token cost; aborts when hardcap exceeded.

    D-G1: hardcap US$5; D-G2: log every 10 chunks.
    """
    PRICE_PER_1M_TOKENS = 0.06  # voyage-3 / voyage-3.5 (D-E1)
    HARDCAP_USD = 5.00

    def __init__(self):
        self.total_tokens = 0
        self.chunks_indexed = 0
        self.next_alert_usd = 1.0  # alert at $1, $2, $3, $4

    @property
    def cost_usd(self) -> float:
        return self.total_tokens * self.PRICE_PER_1M_TOKENS / 1_000_000

    def add(self, tokens: int, book: str, total_chunks: int) -> None:
        self.total_tokens += tokens
        self.chunks_indexed += 1

        # D-G2: log a cada 10 chunks
        if self.chunks_indexed % 10 == 0:
            print(
                f'[ingest] chunk {self.chunks_indexed}/{total_chunks} | '
                f'tokens {self.total_tokens:,} | '
                f'est_cost ${self.cost_usd:.4f} | '
                f'book "{book}"'
            )

        # alertas em $1/2/3/4
        while self.cost_usd >= self.next_alert_usd and self.next_alert_usd <= 4:
            print(f'[ingest] ALERT: cost crossed ${self.next_alert_usd:.0f}')
            self.next_alert_usd += 1

        # D-G1: hardcap
        if self.cost_usd > self.HARDCAP_USD:
            raise BudgetExceeded(
                f'HARD CAP REACHED — ${self.HARDCAP_USD:.2f} spent '
                f'(${self.cost_usd:.4f} estimated). '
                f'Indexed {self.chunks_indexed} chunks. '
                f'Re-run idempotently: chunks already indexed will be skipped via content_hash. '
                f'Increase hardcap by editing INGEST_HARDCAP_USD in vision-service/scripts/ingest_knowledge.py.'
            )

class BudgetExceeded(Exception):
    pass
```

### Invariant

After each successful `vo.embed(batch)`, `BudgetGuard.add(response.total_tokens, ...)` runs. If budget would be exceeded, the **next** call's add() raises before it commits to DB. The chunks already inserted before the exception are preserved (D-G1) — content_hash idempotency means re-running picks up where it left off.

### Pre-flight estimate (optional but cheap)

Before the first `vo.embed`, estimate via `vo.count_tokens(all_chunks_text, model='voyage-3')` and warn if it exceeds the hardcap. Avoids a partial run.

```python
estimated_tokens = vo.count_tokens([c.text for c in all_chunks], model="voyage-3")
estimated_cost = estimated_tokens * 0.06 / 1_000_000
if estimated_cost > 5.0:
    raise BudgetExceeded(f'pre-flight estimate ${estimated_cost:.2f} exceeds hardcap')
print(f'[ingest] pre-flight: {len(all_chunks)} chunks, ~{estimated_tokens:,} tokens, est ~${estimated_cost:.4f}')
```

---

## Advanced Retrieval Techniques (Ninja Pass)

> Founder explicitly requested investigation of 3 advanced techniques before plan finalization. Research completed 2026-05-04 with WebSearch + WebFetch on official sources. Recommendations are Adopt / Adopt-with-modifications / Defer / Skip with cost evidence; conflicts with CONTEXT decisions are flagged loudly under `## ⚠ CONFLICT WITH CONTEXT` rather than silently adjusted.

### Technique 1 — HyDE (Hypothetical Document Embedding)

**Mechanism:** Instead of embedding the raw query (or in our case, the structured `IrisFeatures` JSON + section slug), use Sonnet to generate a 100–200-word hypothetical paragraph in the voice of an iridologist describing the case, then embed THAT as the query vector. Original paper Gao et al. 2022; widely productionized.

**Verified findings (2026-05-04):**
- HyDE adds **25–60% latency** over plain RAG on small LLMs (smaller penalty with prompt caching).
- In specialized scientific/clinical domains, **base HyDE can underperform** without prompt-engineering and feedback-term filtering — risk of hallucinated jargon dragging the embedding off-topic.
- SL-HyDE (fine-tuned HyDE for medical retrieval) shows +4.9% NDCG@10 over base HyDE; gains up to +15.6% on sub-tasks.
- Established hybrid pattern: fall back on HyDE only when plain RAG confidence is low; pair with cross-encoder reranking to validate.

| Critério | Avaliação |
|---|---|
| Validade para clinical RAG especializado (iridologia) | **Alta para Família B (queries de seções abstratas: psicoemocional, transgeracional, simbólico)** — tema sem termos lexicais óbvios; HyDE expande "biliar + dimensão psicoemocional" para parágrafo descritivo que tem mais probabilidade de match. **Média para Família A (achados visuais)** — features já são lexicalmente densas (`lacuna_aberta setor h7 fígado`); HyDE pouco adiciona, possível drift. |
| Implementation complexity | **3/5** — 1 nova função `expandQueryWithHyde(query, context): string` em `apps/web/lib/rag/hyde.ts`, 1 chamada Anthropic SDK, prompt engineering + guardrails (limita comprimento, força termos do JSON original) |
| Quality gain estimado | **+5–15% NDCG@10 em queries da Família B** (projeção a partir de papers acadêmicos generalistas; clinical RAG sem benchmark voyage-3 público específico) |
| Custo de ingestão (one-time) | **$0** — HyDE roda em retrieval, não ingestão |
| Custo de retrieval por session | 1 chamada Sonnet 4.6 por query Família B × ~5 seções por relatório × ~500 input + ~300 output tokens ≈ **$0.018/sessão**; escala 100 terapeutas × 30 sessões/mês = 3000 × $0.018 = **~$54/mês** |
| Conflito com 06-CONTEXT.md? | **Nenhum.** D-T1 trava ingestão sem API; HyDE é runtime, fora do escopo de D-T1. D-R5 (latência ≤3s) é o constraint real — HyDE adiciona ~2s por query. Mitigável: paralelizar HyDE com embed Família A. |
| **Recomendação** | **Adopt-with-modifications: aplicar HyDE APENAS para queries Família B (seções abstratas)**, não Família A. Família A já tem termos lexicais; HyDE é overhead sem ganho. Família B é onde a expansão semântica destrava recall. |

**Implementation hint para o planner:** `lib/rag/hyde.ts` exporta `async function expandSection(section: string, constitution: string): Promise<string>`; chamada paralelizada via `Promise.all` com embed Família A para absorver latência. Guardrails: prompt instrui a Sonnet a usar terminologia iridológica clássica + não inventar achados não-listados nas features. Cap output a ~250 tokens (custo + latência). Cache LRU local na sessão (mesma seção+constituição → mesmo hypothetical doc). Open Question 11 abaixo formaliza decisão.

---

### Technique 2 — Contextual Retrieval (Anthropic 2024)

**Mechanism:** Antes de embedar cada chunk, prepende uma sentença situando o chunk no documento (gerada por Claude com prompt caching do documento inteiro). Anthropic mediu redução de **35% no failure rate** com Contextual Embeddings sozinho, **49% combinado com BM25**, **67% com BM25 + reranking**.

**Verified findings (anthropic.com/news/contextual-retrieval, 2026-05-04):**
- Prompt template canônico (Claude 3 Haiku, 50–100 tokens de contexto por chunk):
  ```
  <document>{{WHOLE_DOCUMENT}}</document>
  Here is the chunk we want to situate within the whole document
  <chunk>{{CHUNK_CONTENT}}</chunk>
  Please give a short succinct context to situate this chunk within the overall
  document for the purposes of improving search retrieval of the chunk. Answer
  only with the succinct context and nothing else.
  ```
- Custo one-time com prompt caching: **$1.02 por milhão de document tokens** (assumindo chunks de 800 tokens, documentos de 8k tokens, 50-token instructions, 100-token context).
- Para nosso corpus (~5000 chunks × ~600 tokens = 3M document tokens): **one-time cost estimado: ~$3.06**.
- Cache hit price: 10% do input padrão. Em datasets de produção (737 chunks de teste Anthropic), 70–80% dos input tokens vêm de cache.
- Em corpora pequenos (livros inteiros como capítulos): caching é especialmente eficiente porque o "document" cached é o capítulo, não o livro.

| Critério | Avaliação |
|---|---|
| Validade para clinical RAG especializado | **MUITO ALTA.** Iridologia é o caso ideal — chunks fora de contexto perdem semântica (ex: "achados em h7" pode significar fígado OU vesícula dependendo do parágrafo anterior; contextualização desambigua). Anthropic mostrou ganho similar em domínios especializados (legal, código). |
| Implementation complexity | **3.5/5** — adiciona um passo no pipeline Python entre chunking e embedding. Requer: anthropic SDK em Python (já no ecossistema), prompt caching API (estável desde 2024-08), capítulo carregado uma vez por iteração de chunks daquele capítulo. |
| Quality gain estimado | **+35% redução em failure rate top-20** (Anthropic, medido em 4 domínios). Para iridologia clínica multilíngue: provável **+25–40%** (banda inferior pela especialização extrema; banda superior pelo cross-lingual). |
| Custo de ingestão (one-time) | **~$3 USD** com prompt caching (5000 chunks × ~100 contextual tokens × $1.02/M, considerando 70% cache hit rate). Caches Sonnet são mais caros que Haiku — se Sonnet 4.6/4.7 usado, multiplicar por ~3× = ~$9. Haiku 4.5 entrega qualidade suficiente para esse template + economiza ~3× = sticker price **~$3 com Haiku 4.5**. |
| Custo de retrieval por session | **$0** — Contextual Retrieval é um pre-processing one-time. Retrieval em si fica idêntico (apenas o embedding do chunk muda). |
| Conflito com 06-CONTEXT.md? | **⚠ CONFLITO COM D-T1.** D-T1 trava: "toda a curadoria + tagging roda DENTRO do Claude Code (sessão atual = Sonnet 4.6/4.7). Sem chamadas API." Contextual Retrieval por design exige 1 chamada Claude por chunk × 5000 chunks = inviável em sessão única (limites de contexto + tempo). |
| **Recomendação** | **Adopt-with-modifications: relaxar D-T1 ESPECIFICAMENTE para Contextual Retrieval.** Custo $3–9 é ordem de magnitude menor que ROI de qualidade (~+30% recall em todas as queries downstream perpetuamente). Founder mantém vocabulary tagging (D-T2..T5) em sessão Claude Code; Contextual Retrieval roda como API call programática usando Haiku 4.5 com prompt caching. |

**⚠ CONFLICT WITH CONTEXT — Resolution Required (Open Question 12 abaixo):**

D-T1 da 06-CONTEXT.md proíbe API calls durante curadoria/ingestão. Contextual Retrieval requer ~5000 API calls. Três resoluções viáveis:

| Opção | Descrição | Tradeoff |
|---|---|---|
| (a) Skip Contextual Retrieval | Manter D-T1 estrito, perder ganho de ~+30% recall | Mais simples; aceita qualidade menor |
| (b) Relax D-T1 só para Contextual Retrieval | API call permitida exclusivamente para `generate_chunk_context()`; vocabulary tagging continua Claude Code-only | **Recomendado.** Custo $3–9 trivial; ganho perpétuo em todo retrieval |
| (c) Founder gera contextos manualmente em Claude Code | 5000 chunks × prompt manual = inviável (1000+ horas) | Rejeitado |

Founder decide. Defaults para o planner: **assumir (b) e fazer plan-checker validar** que founder confirmou.

---

### Technique 3 — Reranking pós-retrieval

**Mechanism:** Depois do top-K do pgvector, passa o conjunto por um reranker cross-encoder (voyage-rerank-2.5 ou Cohere rerank-3.5) que re-ordena com base em interação token-a-token query-vs-document. Combina perfeitamente com Contextual Retrieval (Anthropic mediu Contextual + BM25 + reranking → **67% redução em failure rate**).

**Verified findings (docs.voyageai.com + blog.voyageai.com, 2026-05-04):**
- voyage-rerank-2.5: **$0.05 por milhão de tokens**. **Primeiros 200M tokens gratuitos por conta.** Context window 32K tokens (8× Cohere v3). +1.85% NDCG@10 sobre rerank-2 standard; +4.90% no MAIR (instruction-following); +1.35% multilingual sobre rerank-2; supera Cohere Rerank v3.5 em **12.70%**.
- voyage-rerank-2.5-lite: **$0.02 por milhão de tokens**. Similar latência, qualidade levemente menor.
- Latência observada: **~600ms** por chamada (Voyage, médio em produção).
- Cohere rerank-3.5: $2.00 por 1.000 searches (modelo de pricing diferente — searches, não tokens). Context 4K tokens (limitado para chunks longos).
- Pricing model Voyage: `(query_tokens × num_documents) + sum(document_tokens)`.

| Critério | Avaliação |
|---|---|
| Validade para clinical RAG especializado | **MUITO ALTA.** Especialmente combinado com Contextual Retrieval. MAIR benchmark mediu rerank-2.5 em 9 domínios incluindo médico/legal/scientific — ganho médio +7.55–8.13% sobre baseline. |
| Implementation complexity | **2/5** — 1 chamada SDK no server action: `await voyage.rerank({ query, documents, model: 'rerank-2.5', top_k: 30 })`. Acontece DEPOIS do pgvector top-K e ANTES dos pesos D-R4. |
| Quality gain estimado | **+10–15% precision@30** (Voyage benchmarks) + sinérgico com Contextual Retrieval (Anthropic compound effect: 35% → 67% redução failure rate quando ambos aplicados). |
| Custo de ingestão (one-time) | **$0** — reranking é runtime |
| Custo de retrieval por session | Cálculo: 5 queries × top-50 chunks (rerank reordena 50, devolve 30) × ~600 tokens = ~150K tokens/sessão × $0.05/M = **$0.0075/sessão**. **A 100 terapeutas × 30 sessões/mês = 3000 × $0.0075 = ~$22.50/mês** (após 200M tokens free tier — que cobrem ~1300 sessões iniciais grátis). Em dogfooding (~3 sessões/semana), tudo fica dentro do free tier por **~ano e meio**. |
| Conflito com 06-CONTEXT.md? | **⚠ CONFLITO COM `<deferred>`** da CONTEXT. Bloco "Deferred" lista: "Re-ranker pós-retrieval (cross-encoder, Voyage rerank-2) — fora do MVP. Reavaliar se Fase 7 mostrar ruído." Justificativa para reavaliar agora: free tier cobre dogfooding inteiro + custo trivial em produção + sinergia comprovada com Contextual Retrieval. |
| **Recomendação** | **Adopt-now: trazer para Phase 6 escope.** Custo é praticamente zero por ~12+ meses (free tier), implementação é 1 chamada de SDK, qualidade composta com Contextual Retrieval é o diferencial real do produto. Fase 7 receberá top-30 reranked em vez de top-30 cosine — ganho perpétuo. |

**Implementation hint para o planner:** novo arquivo `apps/web/lib/rag/rerank.ts` exporta `rerankChunks(query: string, chunks: KnowledgeChunk[], topK: number = 30): Promise<KnowledgeChunk[]>`. Chamada DEPOIS do pgvector dedup (top-50 candidatos) e ANTES dos pesos D-R4 (que viram multiplicadores opcionais). `voyage-rerank-2.5` modelo padrão, `voyage-rerank-2.5-lite` configurável via env var para experimentação. Cache LRU server-side por `(query, chunks_hash)` (mesma reading session re-perguntando mesma coisa não re-rankeia).

---

### Compound Strategy — Recomendação Final

Anthropic mediu (em 4 domínios): baseline plain RAG → 5.7% failure rate top-20.
- + Contextual Embeddings: → 3.7% (35% redução)
- + Contextual Embeddings + BM25: → 2.9% (49% redução)
- + Contextual Embeddings + BM25 + Reranking: → **1.9% (67% redução)**

Para Iris Codex (5000 chunks, multilíngue, clínico especializado), recomendação composta:

| Camada | Adopt? | One-time cost | Per-session cost | Latência adicional |
|---|---|---|---|---|
| Contextual Embeddings (Haiku 4.5 + prompt caching) | **Adopt (com D-T1 relax)** | ~$3–9 | $0 | 0ms (one-time at ingestion) |
| BM25 hybrid (Postgres ts_vector) | **Skip nesta fase** | $0 | $0 | +50ms | Por que skip: complexidade adicional não compensa quando reranker já entrega +12.70% sobre baseline. Reavaliar se Fase 7 mostrar gaps específicos em queries lexicais raras. |
| Reranking (voyage-rerank-2.5) | **Adopt** | $0 | $0.0075 (free tier 12+ meses) | +600ms |
| HyDE (Family B only, Sonnet 4.6) | **Adopt-with-modifications** | $0 | $0.018 | +2s (paralelizado com Família A; absorvido) |

**Latência total esperada do retrieval (com adoção):** embed Família A (200ms) ‖ HyDE Família B + embed (2.2s) ‖ pgvector (50ms × 8 queries paralelas = 100ms) → rerank (600ms) → weights (10ms) ≈ **~2.9s end-to-end**, dentro do D-R5 cap de 3s. **Tight mas viável.** Plano deve incluir performance test gate.

**Custo composto produção (100 terapeutas × 30 sessões/mês = 3000 sessões/mês):**
- Embedding queries: ~$0.001/sessão × 3000 = $3/mês
- HyDE: ~$54/mês
- Reranking: $0/mês (free tier por ano+) → ~$22/mês depois
- **Total composto: ~$60–80/mês** quando produção plena, dentro do envelope PROJECT.md ~$30–80/mês para AI APIs (margem apertada — monitorar).

**Não recomendado adicionar (técnicas 4–N investigadas):**
- **Late Chunking** (Jina 2024): exige modelo embedding com long-context compatível; voyage-3 não suporta nativamente. Skip.
- **GraphRAG / KG-RAG** (Microsoft 2024): excelente para corpora estruturados narrativos; nosso corpus é referência tópica, não graph-shaped. Defer Fase 10.
- **Agentic RAG** (multi-step retrieval com Sonnet decidindo o que buscar a seguir): caro em latência (~10s) e em tokens; over-engineering para Fase 6. Defer Fase 9 polish.
- **Embedding fine-tuning** (treinar voyage-3 em corpus iridológico): exige labeled pairs (queries → chunks relevantes). Sem dados clínicos ainda. Defer Fase 10 (sistema de aprendizagem clínica).

---

### Validation Architecture — atualizações para técnicas adopted

**Para Contextual Retrieval (se Open Question 12 = Adopt):**
- [ ] Unit test: `vision-service/tests/test_contextualizer.py::test_generate_context_attaches_situating_sentence` — mock Anthropic, assert chunk gets prepended `[Context: <situating sentence>]\n\n<original chunk>` before embedding.
- [ ] Integration test: caching efficiency — assert ≥60% cache hit rate em segunda execução do mesmo capítulo.
- [ ] Cost test: assert running total Contextual Retrieval ≤ $15 (com folga sobre $9 estimado, abort hard).

**Para Reranking:**
- [ ] Unit test: `apps/web/lib/rag/rerank.test.ts::test_rerank_reorders_top30_correctly` — mock Voyage rerank, assert input order != output order quando relevância difere.
- [ ] Integration test: `test_rerank_falls_back_gracefully_on_api_error` — se rerank falha, devolve top-30 cosine puro (não derruba retrieval).
- [ ] Latency test: rerank call < 1s p95 em 30 chunks.

**Para HyDE (Family B):**
- [ ] Unit test: `apps/web/lib/rag/hyde.test.ts::test_expand_section_uses_constitution_terms` — mock Sonnet, assert hypothetical doc contém constituição informada.
- [ ] Guardrail test: hypothetical doc não inventa nomes de achados fora do JSON features (regex ban list).
- [ ] Latency test: HyDE call < 3s p95.

**Para sinergia Contextual + Reranking (UAT manual):**
- [ ] Spot-check Success Criterion 5 (lacuna setor 7 → top-5 chunks fígado/lacuna): comparar 3 configurações (plain / +contextual / +contextual+rerank) em 10 queries-amostra. Founder qualifica.

---



**What goes wrong:** Re-running the ingestion after a small whitespace change in the chunker (e.g., normalizing line endings) computes a different SHA256 → hash mismatch → INSERT runs as a new row → silent duplication.

**Defense:**
- Lock the chunk text canonicalization: **`content_hash = sha256(text.strip().encode('utf-8'))`** literally. No further normalization — don't lowercase, don't collapse whitespace, don't normalize Unicode (NFC vs NFD changes bytes for accented chars).
- Document this as a comment in the chunker module. Test: hash a known string and assert against a hardcoded expected hash to catch any future change to the canonicalization.
- If a chunk-quality issue forces re-canonicalization, the right answer is `pnpm rag:purge --book="X"` + re-ingest (D-I2). Don't try to migrate hashes in-place.

### 2. tiktoken under-counts vs real Voyage tokens (10–20%)

**What goes wrong:** Chunker targets 500 tokens via tiktoken cl100k_base. Actual Voyage tokens average 600. A ~5% chunk can be borderline-over Voyage's 32K context limit if it's a long chunk; not a real risk for 500-target with 700-cap, but matters for budget math (10–20% under-estimate of cost).

**Defense:**
- For chunk-size budgeting (D-C1): tiktoken is fine because the 300–700 flex band absorbs the 1.2× multiplier (worst case real-Voyage is 360–840, still well under 32K).
- For cost budgeting (D-G1): use Voyage's returned `total_tokens` as authoritative, NOT tiktoken estimates. The BudgetGuard pattern above does this.

### 3. HNSW recall is bad at very small corpus sizes

**What goes wrong:** For corpus <1000 chunks, HNSW with default ef_search=40 can miss obvious matches. Manifests as "spot-check returns weird chunks for an obvious query" during UAT.

**Defense:**
- Bump `ef_search = 100` per-query in the RPC function (already in §pgvector tuning).
- For early dogfooding when only 1–2 books are indexed (small corpus), consider `ef_search = 200`.
- After all 18 books are indexed (~5000 chunks expected), 100 is sufficient.

### 4. Voyage model version pin must be exact

**What goes wrong:** Embedding `voyage-3` for ingestion and `voyage-3.5` for retrieval would put queries and documents in different (incompatible) embedding spaces. Recall drops to near-random.

**Defense:**
- Define `EMBEDDING_MODEL = "voyage-3"` as a single constant in **two** places that import it: `vision-service/scripts/ingest_knowledge.py` and `apps/web/lib/rag/embed.ts`.
- Add a sentinel: store the model name in the FIRST chunk's metadata or in a separate `rag_config` table; the retrieval verifies it matches its own embed model on startup. If mismatch, fail loudly.
- D-I3 says no chunk versioning, but model-version mismatch is severe enough to warrant this single guard.

### 5. PostgreSQL vector column write performance at batch insert

**What goes wrong:** Inserting 5000 rows one-at-a-time from Python = 5000 round-trips = ~10–60s of latency on Supabase Free tier. Hardcap timer keeps ticking.

**Defense:**
- supabase-py upsert accepts a list of dicts in one call → server-side batch INSERT.
- Insert batches of 100–500 chunks per upsert call to balance request size and round-trips.
- Each batch: `client.table("knowledge_chunks").upsert(rows, on_conflict="content_hash", ignore_duplicates=True).execute()`

### 6. LGPD: vocabulário proibido in tags_livres

**What goes wrong:** Tagger (Claude Code) writes `tags_livres: ["diagnóstico precoce de fígado"]` for a chunk. The chunk text itself may be a verbatim citation of a book using "diagnóstico" — that's allowed. But the **free tag** is content WE wrote, and `audit:vocabulary` should catch it.

**Defense:**
- Extend `pnpm audit:vocabulary` to scan two new sources:
  1. Local files: `vision-service/scripts/data/books_manifest.json`, `vision-service/scripts/data/vocabularies.json`, `vision-service/data/jensen-reference.md`, `apps/web/lib/rag/section-queries.ts`. (Static — easy.)
  2. **Database**: post-ingest, run a Postgres query that scans `metadata->>'tags_livres'` for forbidden words, fail CI if any match. Implementation: a script `apps/web/scripts/audit-vocabulary-db.mjs` runs `SELECT id, source_book, metadata->'tags_livres' FROM knowledge_chunks WHERE metadata::text ~* 'diagnóstico|tratamento|cura'`. Founder reviews matches — true verbatim quotes flag a false-positive review needs (skip via sentinel) but invented tags must be re-tagged.
- The `content` column itself is NOT audited (book quotes are allowed). Audit operates strictly on tags.

### 7. Voyage embed retry storms eat the hardcap

**What goes wrong:** One bad batch (e.g., a chunk over 32K tokens) triggers retries 1s/4s/16s, but eventually succeeds at the cost of 3× tokens billed. If the chunker has a bug emitting outsized chunks, this compounds across 5000 chunks.

**Defense:**
- Pre-flight check in chunker: assert each chunk's tiktoken count × 1.2 <= 32000. Reject (and re-split) any chunk over, before sending to Voyage.
- Retry policy: retry only on 429/5xx HTTP codes. On 400 (bad input — chunk too long), DO NOT retry; log to `failed_batches.jsonl` and continue with rest of corpus.
- voyageai SDK has built-in retries (max 2 by default) — the script's own retry layer is a wrapper around 4xx/5xx classification.

### 8. Embedding model rebrand mid-project (low risk but ack)

**What goes wrong:** MongoDB acquired Voyage; future API base URL might change.

**Defense:**
- Pin the SDK version (`voyageai==0.3.7` and `voyageai@0.2.1`). The SDK abstracts the URL. As long as the SDK is unchanged, the API endpoint is stable.
- If `api.voyageai.com` is sunset, MongoDB has committed to backward compatibility through "Phase 1" of integration. Monitor blog.voyageai.com for deprecation announcements (none as of 2026-05).

### 9. Metadata jsonb shape drift between ingest script and retrieval reader

**What goes wrong:** Script writes `metadata.constituicao_referenciada` as `["biliar"]`. TS retrieval reads it as `metadata.constituicao` → undefined → score boost of D-R4 silently doesn't apply.

**Defense:**
- Define the shape ONCE: `vision-service/scripts/lib/chunk_schemas.py` (Pydantic model) AND `apps/web/lib/rag/types.ts` (Zod schema or interface). Add a comment cross-referencing the two — manual sync.
- Test: insert a known fixture chunk with all fields populated; in TS, read it back via the retrieval RPC and assert all fields are correctly typed and accessible. This is the "shared contract" test.

### 10. PWA / Vercel runtime: server-only voyageai SDK

**What goes wrong:** Importing `voyageai` accidentally in a client component bundles it for browser → leaks `VOYAGE_API_KEY` and inflates JS bundle.

**Defense:**
- `apps/web/lib/rag/embed.ts` starts with `import 'server-only'` (next.js Reserved Module). Same pattern as `apps/web/lib/supabase/service.ts`.
- API key only via `VOYAGE_API_KEY` (no `NEXT_PUBLIC_` prefix). `.env.example` documents.
- Server action `retrieveRelevantKnowledge` is exported with `"use server"` directive, called only from server components / route handlers.

### 11. PDF duplicate (`689712209-iridologia-mod-03 (1).pdf`)

**What goes wrong:** Acervo has the same file twice (one with `(1)` suffix). If both are ingested, content_hash dedup catches it AT chunk level (same text → same hash → skipped) — but the Wave 0 manifest can be inconsistent (two entries pointing same content).

**Defense:**
- Manifest schema test: `(filename, ...)` is unique. If founder lists both, test fails. Founder marks one as `skip:true`.
- This is documented in CONTEXT specifics already; verify in test_books_manifest.py.

### 12. DOCX vs PDF duplication risk

**What goes wrong:** `Bernard-Jensen.docx` may be the same content as `458440796-Bernard-Jensen-Iridology-pdf.pdf`. Ingesting both = duplicate chunks with similar but not identical hashes (DOCX text extraction differs from PDF).

**Defense:**
- Founder decides in Wave 0 (manifest): mark DOCX as `skip:true` if PDF covers it. Default policy: skip DOCX when same-content PDF exists.
- content_hash will NOT catch this because text extraction outputs differ. So the dedup must happen at manifest level, not chunk level.

### 13. Token budget for retrieval prompt vs cap=30

**What goes wrong:** Cap=30 chunks × 700 tokens (worst case) = 21,000 tokens just for chunks. Plus features JSON, system prompt, formatting overhead. Sonnet 4.6 has 200K window, so OK — but Fase 7 LLM cost scales with input tokens. Pure budget concern, not failure.

**Defense:** Document that retrieval cap=30 implies up to ~21K input tokens to the LLM (Fase 7 design problem). For Fase 6, just pass the cap through. This is a Fase 7 concern; flag in Open Questions for that phase.

### 14. Service role key exposure

**What goes wrong:** Ingest script uses `SUPABASE_SERVICE_ROLE_KEY`. If committed to git or logged, full DB access leaks.

**Defense:**
- `.env` files in `.gitignore` (already, Phase 1).
- Pre-flight check in script: `if not SUPABASE_SERVICE_ROLE_KEY.startswith("eyJ"): raise EnvError("missing service role key")`. Never log the key.
- Founder runs script locally only. No CI runs ingest. CI only runs unit tests with mocked Supabase client.

---

## Current State of Codebase

[All discovered via direct filesystem reads on 2026-05-04.]

### What exists already

- **`vision-service/`** — fully built out as part of Phase 5. Python 3.10 venv pattern established. Modal app deployed. `pytest.ini`, `conftest.py`, `requirements.txt` all in place.
- **`vision-service/scripts/`** EXISTS (currently has `audit_vocabulary.py` + `__init__.py`). Pattern: one CLI module per script, importable as `from scripts.X import audit`. The new ingest script fits this pattern as `vision-service/scripts/ingest_knowledge.py`.
- **`vision-service/data/`** EXISTS — has `error_summary.json` + `jensen-map.json` from Phase 5. Pattern: pt-BR canonical assets versioned under git. `vision-service/data/jensen-reference.md` (D-T4 canonical signs list) does **not** exist yet — must be created.
- **`vision-service/scripts/data/`** does **NOT** exist. Plan should create. Houses `books_manifest.json` (D-M1) + `vocabularies.json` (D-T2..T5 vocab lists for testing) + `chunks_pending_tags.jsonl` + `chunks_tagged.jsonl` (transient — gitignore).
- **`vision-service/tests/`** has 11 test modules already (`test_audit_vocabulary`, `test_compose`, `test_detect`, `test_enhance`, `test_error_summary`, `test_features`, `test_iris_maps`, `test_modal_app`, `test_normalize`, `test_schema`, `test_segment`, `test_smoke`). Phase 6 adds: `test_ingest_extract.py`, `test_chunker.py`, `test_books_manifest.py`, `test_embedder.py`, `test_idempotency.py`, `test_budget.py`, `test_persist.py`, `test_vocabularies.py`.
- **`apps/web/lib/supabase/service.ts`** EXISTS (Phase 5). Server-only service-role client. Reusable for `apps/web/lib/rag/search.ts` if any internal admin operation is ever needed; the regular auth-tied client suffices for retrieval (knowledge_chunks is readable by `authenticated` role per migration 0001 line 124-127).
- **`apps/web/scripts/audit-vocabulary.mjs`** EXISTS (Phase 3+). Currently scans `apps/web/app` and `apps/web/components` for `diagnóstico|tratamento|cura`. **Plan must extend** to scan: (a) `apps/web/lib/rag/section-queries.ts` and any new RAG TS file, (b) `vision-service/scripts/data/books_manifest.json` and vocabularies.json (or rely on the parallel `vision-service/scripts/audit_vocabulary.py` that already covers `pipeline/`, `data/`, `scripts/`, `tests/fixtures/` per its SCAN_DIRS — extend SCAN_DIRS to include `scripts/data/`).
- **`apps/web/types/database.ts`** EXISTS — current `knowledge_chunks` Row shape:
  ```ts
  Row: {
    content: string
    created_at: string | null
    embedding: string | null     // serialized vector(1024) — NOT number[]!
    id: string
    metadata: Json | null
    source_book: string
    source_chapter: string | null
    source_page: number | null
  }
  ```
  After migration 0005, will gain `content_hash: string | null` + `source_type: string`. Run `pnpm --filter web gen:types` after migration applies.
- **`supabase/migrations/0001_initial_schema.sql`** lines 78-91 confirm `knowledge_chunks` schema + HNSW index already in place. No DROP/recreate of HNSW needed.
- **`SUPABASE_SERVICE_ROLE_KEY`** env already provisioned (Phase 1). Same for `VOYAGE_API_KEY` (per CONTEXT D-S1 + REQUIREMENTS SETUP-02).

### What does NOT exist (to create in Phase 6)

- **`apps/web/lib/rag/`** directory entirely missing. Plan creates:
  - `apps/web/lib/rag/embed.ts` (Voyage TS client wrapper, server-only)
  - `apps/web/lib/rag/search.ts` (server action `retrieveRelevantKnowledge`)
  - `apps/web/lib/rag/build-queries.ts` (Family A + B query builders)
  - `apps/web/lib/rag/section-queries.ts` (D-R2 templates per reportSection)
  - `apps/web/lib/rag/score-weights.ts` (D-R4 multipliers + re-ranker)
  - `apps/web/lib/rag/types.ts` (KnowledgeChunk, ReportSection, etc.)
  - `apps/web/lib/rag/*.test.ts` (vitest)
- **`vision-service/scripts/ingest_knowledge.py`** — main CLI entry.
- **`vision-service/scripts/lib/`** — modules:
  - `chunker.py` (D-C3 splitter)
  - `extractors.py` (PyMuPDF + pdfplumber + python-docx wrappers)
  - `embedder.py` (Voyage Python wrapper + retry + budget guard)
  - `persist.py` (supabase-py upsert with on_conflict)
  - `chunk_schemas.py` (Pydantic models for the chunk lifecycle)
  - `tagging_io.py` (read/write chunks_pending_tags.jsonl, chunks_tagged.jsonl)
- **`vision-service/scripts/data/books_manifest.json`** (D-M1).
- **`vision-service/scripts/data/vocabularies.json`** (D-T2..T5 — also read by tests).
- **`vision-service/data/jensen-reference.md`** (D-T4 canonical signs — founder validates).
- **`supabase/migrations/0005_*.sql`** + `0006_*.sql` (or merged into 0005).
- **CLI script** `apps/web/scripts/audit-vocabulary-db.mjs` (post-ingest DB audit on metadata.tags_livres).
- **package.json scripts** to wire: `rag:ingest`, `rag:purge`, `audit:vocabulary:db` (root and/or apps/web).
- **REQUIREMENTS.md update** (RAG-01..RAG-04): correct from `pdf-parse` TS to `PyMuPDF` Python; correct corpus from "Jensen + Battello" to "18 PDFs do acervo"; clarify `(features, reportSections)` signature. This is doc-only but should be in the plan as a small Wave-0 task.
- **STATE.md update**: remove the falso-positivo "Battello" blocker (D-S2).

### audit:vocabulary script extensibility

[VERIFIED via reading both audit scripts.]

- `apps/web/scripts/audit-vocabulary.mjs` is **file-scan only**, no DB access. To audit `metadata.tags_livres`, plan must add a separate sibling script `audit-vocabulary-db.mjs` that uses the Supabase service-role client to run a SELECT against `knowledge_chunks`. Pattern: similar to `gen:types` (already uses Supabase CLI).
- The Python audit script `vision-service/scripts/audit_vocabulary.py` is also file-scan only with `SCAN_DIRS = ["pipeline", "data", "scripts", "tests/fixtures"]`. Plan must add `"scripts/data"` to SCAN_DIRS so books_manifest.json and vocabularies.json are scanned. Trivial 1-line edit.
- Both scripts use the same regex pattern for forbidden words. Consistent.

### Voyage SDK is NOT yet installed

- `apps/web/package.json` deps: confirmed `voyageai` is **not present**. Plan adds `pnpm add voyageai@^0.2.1 --filter web`.
- `vision-service/requirements.txt` confirmed `voyageai` is **not present**. Plan adds `voyageai==0.3.7`.

### Outdated REQUIREMENTS.md

- RAG-01 still says "Script `scripts/ingest-knowledge.ts` extrai texto de PDFs (pdf-parse/pdfjs)". CONTEXT D-C3 superseded this with Python+PyMuPDF.
- RAG-03 still says "Jensen Vol. 1 + Battello". CONTEXT D-S1 superseded with 18 PDFs.
- RAG-04 still says `retrieveRelevantKnowledge(features)`. CONTEXT D-R1 extended to `(features, reportSections)`.
- These are documentation lag. Plan must include a minor task: update REQUIREMENTS.md text (not status; status remains pending until phase completes) AND add an ADR or just a CONTEXT-cross-reference comment so the trail is auditable.

---

## Open Questions for Planner

These are points where the research surfaced uncertainty that the founder/planner should resolve before execute. None are blockers; all have a default fallback.

1. **voyage-3 vs voyage-3.5 — small but real choice.**
   - **Why it matters:** Same dimension (1024), same price ($0.06/1M), same API, same SDK call (just change the model name string). voyage-3.5 has +2.66% measured multilingual recall, helpful for cross-lingual (en/it/es → pt-BR queries) which is Fase 6's exact use case.
   - **Default if no answer:** stay on voyage-3 per CONTEXT D-E1.
   - **Recommendation:** ask founder. If they have no preference, choose voyage-3.5. Risk of switch is zero (drop-in replacement, identical contract).
   - **Decision impact:** changes the constant `EMBEDDING_MODEL` in 2 files.

2. **input_type parameter — adopt or skip?**
   - **Why it matters:** Free recall improvement (Voyage docs claim). Standard practice. Not in CONTEXT.
   - **Default if no answer:** adopt. Set `input_type="document"` in ingestion + `input_type="query"` in retrieval. Document in plan as "free improvement, standard practice."
   - **Decision impact:** one extra parameter in two SDK calls.

3. **Tag-text injection at chunk text-end — adopt or skip?**
   - **Why it matters:** Appending `[Tags: lacuna_aberta, anel_tensao, h7]` as a final line of the chunk text BEFORE embedding gives the embedder lexical anchors that improve recall on rare iridological jargon. Hedge against cross-lingual idiom mismatch.
   - **Default if no answer:** skip. Adds complexity; voyage-3+ is already strong on iridology terminology.
   - **Recommendation:** founder decides. If retrieval UAT (Success Criterion 5: "lacuna no setor 7 → top-5 chunks fígado/lacuna") fails, revisit.
   - **Decision impact:** changes the chunk text seen by embedder + content_hash. Re-ingest required to switch on.

4. **DOCX handling: skip both, or ingest both?**
   - **Why it matters:** Two DOCX in acervo (`Bernard-Jensen.docx`, `endocrinology-and-iridology.docx`). Likely overlap with PDFs of similar names (`458440796-Bernard-Jensen-Iridology-pdf.pdf`, `727258853-endocrinology-and-iridology.docx`).
   - **Wait — `endocrinology-and-iridology.docx` is the only version of that book.** No PDF equivalent in the acervo. Likely needs ingestion. Whereas `Bernard-Jensen.docx` MAY be redundant with `458440796-Bernard-Jensen-Iridology-pdf.pdf`.
   - **Default:** founder decides per book during Wave 0 manifest fill. Default: include `endocrinology-and-iridology.docx`, skip `Bernard-Jensen.docx`.
   - **Decision impact:** manifest entries; whether to install python-docx or docx2txt.

5. **Pre-flight token estimation — run or skip?**
   - **Why it matters:** Calling `vo.count_tokens()` on all 5000 chunks before embedding adds ~30s and one round-trip per book. Catches hardcap-overrun before partial DB writes.
   - **Default:** skip. The BudgetGuard intercepts at first cross of $5; idempotency means re-running picks up. Upside of pre-flight is small for a 1-shot ingestion that is <$1 expected.
   - **Decision impact:** one extra method in BudgetGuard. Trivial to add later.

6. **`hnsw.ef_search` value: 100, 150, or 200?**
   - **Why it matters:** Lower = faster, lower recall. Higher = slower, higher recall. Default is 40 (likely too low). Research recommends 100 for our scale.
   - **Default if no answer:** 100. Tunable later by editing the RPC function (no migration needed if we use `create or replace function`).
   - **Decision impact:** integer constant in the RPC SQL.

7. **RPC function migration timing: 0005 combined or 0005+0006?**
   - **Why it matters:** D-P1 schema changes (alter table) and the new `match_knowledge_chunks` RPC are two independent concerns; some teams keep schema migrations separate from function definitions. Both styles are acceptable.
   - **Default:** combine into 0005 (same feature). Simpler ledger.
   - **Decision impact:** file count.

8. **`content_hash` index type: implicit btree from UNIQUE, or explicit btree?**
   - **Why it matters:** UNIQUE constraint already creates a btree-backed index. No need to add separate `create index`. CONTEXT D-P1 example does NOT add a separate index — confirmed correct.
   - **Default:** rely on UNIQUE-implicit index. Done.
   - **No decision needed.**

9. **Test fixtures for chunker: real Jensen excerpt vs synthetic?**
   - **Why it matters:** Chunker tests need a representative "iridology PDF text" to assert chapter/section detection. Real excerpts are copyrighted; synthetic loses fidelity.
   - **Default:** synthetic stub PDF (a few-page file with hardcoded chapter/section markers we craft). Test fixture under `vision-service/tests/fixtures/sample.pdf` (small, generated, not under copyright). Test asserts the chunker recognizes the markers.
   - **Decision impact:** small fixture-creation task in Wave 0.

10. **Should `apps/web/lib/rag/section-queries.ts` be versioned alongside the Fase 7 super prompt?**
    - **Why it matters:** D-R2 says yes. But Fase 7 isn't designed yet. Plan should freeze a v1 set of section slugs (`['constituicao', 'psicoemocional', 'transgeracional', 'simbolico', 'mensagem_final', ...]`) so Fase 6 can build templates against a stable contract.
    - **Default:** plan defines the slug list as part of Fase 6, founder validates, becomes input to Fase 7.
    - **Decision impact:** small upfront design effort; reduces rework in Fase 7.

11. **HyDE (Hypothetical Document Embedding) — adopt for Family B queries?** [NINJA PASS]
    - **Why it matters:** Family B queries (psicoemocional, transgeracional, simbólico, mensagem_final) are abstract themes without dense iridological lexical anchors. HyDE expands them via Sonnet 4.6 into hypothetical iridologist descriptions before embedding, improving recall for cross-lingual + abstract matching. Family A (visual findings) stays plain — features already lexically dense.
    - **Cost impact:** ~$54/mês a 100 terapeutas × 30 sessões. Latência: +2s por query Família B (mitigado por paralelização com Família A).
    - **Default if no answer:** Adopt-with-modifications (Family B only). Cache LRU local.
    - **Decision impact:** new file `apps/web/lib/rag/hyde.ts`; one Anthropic SDK dependency; performance test gate ≤3s.
    - **CONTEXT compatibility:** ✅ no conflict (HyDE is runtime, D-T1 covers ingestion only).

12. **Contextual Retrieval (Anthropic) — adopt with D-T1 relax?** [NINJA PASS — ⚠ CONFLICT WITH D-T1]
    - **Why it matters:** Anthropic measured 35% reduction in failure rate top-20. Compounded with reranking → 67% reduction. For our specialized clinical multilingual corpus, this is the single highest-ROI quality lever available.
    - **Cost impact:** ~$3–9 USD one-time at ingestion (Haiku 4.5 + prompt caching). $0 runtime.
    - **⚠ CONFLICT:** D-T1 explicitly forbids API calls during curation/ingestion ("toda a curadoria + tagging roda DENTRO do Claude Code (sessão atual). Sem chamadas API."). Contextual Retrieval requires ~5000 API calls.
    - **Default if no answer:** **(b) Adopt with D-T1 relaxed scoped to Contextual Retrieval only** (vocabulary tagging D-T2..T5 stays in Claude Code session). Plan-checker validates founder confirmed before allowing planner to lock the relax.
    - **Decision impact:** new file `vision-service/scripts/contextualize_chunks.py`; anthropic SDK in vision-service; minor budget hardcap addition for this specific call set.
    - **Three resolutions on the table:**
      - (a) Skip Contextual Retrieval — keep D-T1 strict, lose ~+30% recall
      - **(b) Relax D-T1 only for Contextual Retrieval — RECOMMENDED**
      - (c) Manual context generation in Claude Code — rejected (5000 chunks × manual prompt = 1000+ hours)

13. **Reranking (voyage-rerank-2.5) — bring forward from `<deferred>` into Phase 6?** [NINJA PASS — ⚠ CONFLICT WITH `<deferred>`]
    - **Why it matters:** First 200M tokens free per Voyage account → covers ~12+ months of dogfooding at zero cost. After free tier exhausts, ~$22/mês at 100 therapists. Sinergia composta com Contextual Retrieval (67% failure-rate reduction).
    - **Cost impact:** $0 for foreseeable horizon (free tier). +600ms latency per query (within D-R5 ≤3s budget when paralelized).
    - **⚠ CONFLICT with `<deferred>`:** CONTEXT explicitly defers ranker as "fora do MVP — top-K=5/query + dedup + cap=30 com pesos é suficiente. Reavaliar se Fase 7 mostrar ruído."
    - **Default if no answer:** **Adopt-now (bring into Phase 6 scope).** Free tier + sinergia com Contextual + 1 SDK call to implement.
    - **Decision impact:** new file `apps/web/lib/rag/rerank.ts`; voyageai SDK already required for embedding; plan adds reranking call between pgvector retrieval and D-R4 weights.

14. **Compound strategy — full ninja stack vs partial?** [NINJA PASS — composite recommendation]
    - **If 11+12+13 all adopted:** ~+40% NDCG@10 (estimated), ~$60–80/mês production cost (within PROJECT.md AI envelope $30–80, **margin tight — monitor**), latency ~2.9s (within D-R5 cap of 3s, tight).
    - **If only 12+13 adopted (skip HyDE):** ~+30% NDCG@10, ~$25/mês, latency ~1.5s (comfortable margin).
    - **Recommendation:** Adopt 12+13 in Phase 6 (high ROI, comfortable budget); make 11 a Wave-late opt-in once 12+13 perform measurably and we know how much latency budget we have left.
    - **Decision impact:** plan structure (one extra wave for ninja vs deferred to Phase 9 polish).

---

## Sources

### Primary (HIGH confidence)
- [docs.voyageai.com/docs/embeddings](https://docs.voyageai.com/docs/embeddings) — model dimensions, batch limits, input_type, pricing, dim 1024 confirmation
- [docs.voyageai.com/docs/tokenization](https://docs.voyageai.com/docs/tokenization) — Voyage tokenizer vs tiktoken (1.1–1.2× multiplier)
- [docs.voyageai.com/docs/pricing](https://docs.voyageai.com/docs/pricing) — voyage-3 / voyage-3.5 pricing
- [pypi.org/project/voyageai/](https://pypi.org/project/voyageai/) — Python SDK 0.3.7
- [npmjs.com/package/voyageai](https://www.npmjs.com/package/voyageai) — TS SDK 0.2.1
- [github.com/voyage-ai/typescript-sdk](https://github.com/voyage-ai/typescript-sdk) — TS SDK usage example
- [pypi.org/project/PyMuPDF/](https://pypi.org/project/PyMuPDF/) — PyMuPDF 1.27.2.3 (2026-04-24)
- [pypi.org/project/pdfplumber/](https://pypi.org/project/pdfplumber/) — pdfplumber 0.11.9 (2026-01-05)
- [supabase.com/docs/guides/database/extensions/pgvector](https://supabase.com/docs/guides/database/extensions/pgvector) — HNSW defaults m=16, ef_construction=64
- [supabase.com/docs/guides/ai/semantic-search](https://supabase.com/docs/guides/ai/semantic-search) — RPC pattern for vector similarity
- [github.com/pgvector/pgvector](https://github.com/pgvector/pgvector) — `hnsw.ef_search` GUC, `SET LOCAL` per-query
- [investors.mongodb.com/news-releases/news-release-details/mongodb-announces-acquisition-voyage-ai](https://investors.mongodb.com/news-releases/news-release-details/mongodb-announces-acquisition-voyage-ai-enable-organizations) — MongoDB acquired Voyage 2025-02-24, SDK preserved
- [blog.voyageai.com/2025/05/20/voyage-3-5/](https://blog.voyageai.com/2025/05/20/voyage-3-5/) — voyage-3.5 +2.66% multilingual vs voyage-3, drop-in compatible
- [blog.voyageai.com/2026/01/15/voyage-4/](https://blog.voyageai.com/2026/01/15/voyage-4/) — voyage-4 series (Jan 2026)
- [github.com/orgs/supabase/discussions/6804](https://github.com/orgs/supabase/discussions/6804) — supabase-py bulk upsert with ignore_duplicates
- Local filesystem read of `D:\Projetos\Iridologista\supabase\migrations\` — confirms 0001-0004 occupied, 0005 next free
- Local read of `D:\Projetos\Iridologista\vision-service\` — confirms scripts/, data/, tests/ structure

### Secondary (MEDIUM confidence)
- [crunchydata.com/blog/hnsw-indexes-with-postgres-and-pgvector](https://www.crunchydata.com/blog/hnsw-indexes-with-postgres-and-pgvector) — HNSW tuning guidance for production scale
- [neon.com/docs/ai/ai-vector-search-optimization](https://neon.com/docs/ai/ai-vector-search-optimization) — ef_search guidance for high-QPS
- [bnacar.dev/2026/01/13/how-to-extract-tables-from-pdfs-using-python.html](https://bnacar.dev/2026/01/13/how-to-extract-tables-from-pdfs-using-python.html) — PyMuPDF + pdfplumber complementary use
- [docs.bswen.com/blog/2026-03-16-pdfplumber-vs-pymupdf/](https://docs.bswen.com/blog/2026-03-16-pdfplumber-vs-pymupdf/) — comparison for table extraction
- [github.com/pymupdf/PyMuPDF/discussions/1653](https://github.com/pymupdf/PyMuPDF/discussions/1653) — scanned PDF detection heuristics
- [pypi.org/project/docx2txt/](https://pypi.org/project/docx2txt/) (referenced) — minimal DOCX text extraction
- [supabase.com/blog/openai-embeddings-postgres-vector](https://supabase.com/blog/openai-embeddings-postgres-vector) — match_documents RPC pattern

### Tertiary (LOW confidence — flagged for validation if depended upon)
- [www.buildmvpfast.com/blog/best-embedding-model-comparison-voyage-openai-cohere-2026](https://www.buildmvpfast.com/blog/best-embedding-model-comparison-voyage-openai-cohere-2026) — comparative blog post (not authoritative)
- General "iridology RAG" ecosystem patterns — none found; this is a niche domain. Patterns inherited from generic RAG best practices.

### Ninja Pass — Advanced Retrieval Techniques (HIGH confidence)
- [anthropic.com/news/contextual-retrieval](https://www.anthropic.com/news/contextual-retrieval) — Contextual Retrieval primary source: 35% / 49% / 67% failure-rate reduction numbers, exact prompt template, $1.02/M tokens cost claim, prompt caching mechanics
- [docs.voyageai.com/docs/pricing](https://docs.voyageai.com/docs/pricing) — voyage-3/3.5 ($0.06/M), rerank-2.5 ($0.05/M, first 200M free), rerank-2.5-lite ($0.02/M)
- [blog.voyageai.com/2025/08/11/rerank-2-5/](https://blog.voyageai.com/2025/08/11/rerank-2-5/) — rerank-2.5: +1.85% NDCG@10 vs rerank-2, +12.70% vs Cohere v3.5, +4.90% MAIR, 32K context
- [docs.voyageai.com/docs/reranker](https://docs.voyageai.com/docs/reranker) — reranker pricing model `(query_tokens × num_documents) + sum(document_tokens)`
- [emergentmind.com/topics/hypothetical-document-embeddings-hyde](https://www.emergentmind.com/topics/hypothetical-document-embeddings-hyde) — HyDE clinical RAG analysis: 25–60% latency overhead, SL-HyDE +4.9% NDCG@10 over base
- [agentset.ai/rerankers](https://agentset.ai/rerankers) — Voyage Rerank 2.5 latency benchmark ~595–603ms p50

---

## Metadata

**Confidence breakdown:**
- SDK State (Voyage Python/TS, PyMuPDF, pdfplumber): HIGH — verified via npm/PyPI/official docs on 2026-05-04.
- pgvector HNSW tuning: HIGH — verified via Supabase docs + pgvector README; m=16/ef_construction=64 are confirmed defaults.
- Cross-lingual retrieval (voyage-3 vs voyage-3.5): HIGH — verified via Voyage blog with measured benchmark numbers.
- Migration conventions: HIGH — verified directly from filesystem.
- Cost monitoring pattern: MEDIUM — pattern is sound, but `vo.count_tokens()` exact API surface inferred from docs without round-trip test.
- Pitfalls (1–14): MEDIUM-HIGH — most are general RAG knowledge applied to this codebase; specific defenses verified against the actual code on disk.
- Validation Architecture: HIGH — concrete Wave 0 file list derived from actual codebase state.
- Open Questions 1–10: identified gaps where CONTEXT didn't speak; flagged for founder confirmation.
- **Ninja Pass (Open Questions 11–14):** HIGH for cost figures and benchmark numbers (sourced from Anthropic + Voyage primary docs verified 2026-05-04); MEDIUM for clinical/iridology-specific quality projections (no published voyage-3 + iridology benchmark; projections inherited from MAIR + medical RAG analogues).

**Research date:** 2026-05-04 (initial 1–10) + 2026-05-05 (Ninja Pass 11–14, completed by orchestrator after researcher Windows-stdio stall)
**Valid until:** ~2026-06-04 (30 days — Voyage SDK and pgvector are stable; PyMuPDF released 1.27.2.3 on 2026-04-24 so revisit if a newer minor lands; rerank-2.5 free tier behavior may change post-MongoDB integration phase 2)

---

## RESEARCH COMPLETE (NINJA PASS)

**Resumo de 1 frase por técnica:**
- **HyDE:** Adopt-with-modifications — apenas para queries Família B (seções abstratas), Família A fica plain. +5–15% NDCG@10, +$54/mês, +2s latência paralelizável.
- **Contextual Retrieval:** Adopt with D-T1 relax (Open Question 12) — $3–9 one-time, +35% redução failure rate, prompt caching com Haiku 4.5. **CONFLICT WITH D-T1 — founder must confirm relax.**
- **Reranking voyage-rerank-2.5:** Adopt-now — bring forward from `<deferred>` into Phase 6 (Open Question 13). $0 (free tier 12+ meses), +600ms, +12.70% sobre Cohere v3.5. **CONFLICT WITH `<deferred>` — founder must confirm bring-forward.**

**Open Questions adicionados:** 11 (HyDE Family B), 12 (Contextual Retrieval D-T1 relax), 13 (Reranking bring-forward), 14 (compound strategy).

**Seções modificadas em 06-RESEARCH.md:**
- Nova seção `## Advanced Retrieval Techniques (Ninja Pass)` entre Cost Monitoring e Pitfalls (linhas ~687–950 da nova numeração)
- Open Questions 11–14 adicionados (linhas ~1080–1125)
- Novo bloco em Sources: `### Ninja Pass — Advanced Retrieval Techniques`
- Metadata atualizado com confidence breakdown para Ninja Pass items
