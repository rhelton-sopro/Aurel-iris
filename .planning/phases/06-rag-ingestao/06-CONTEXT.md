# Phase 6: RAG — Ingestão da base de conhecimento - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Source:** Founder discuss-phase (10 locked decisions, 18 PDFs already in `D:\Projetos\Iridologista\livros\`)

<domain>
## Phase Boundary

Os 18 PDFs do acervo iridológico do fundador (em `D:\Projetos\Iridologista\livros\`) são extraídos, chunked com critério semântico, embedded via Voyage `voyage-3` e indexados em `knowledge_chunks` (schema estendido nesta fase para suportar `source_type` e metadata controlado). Após a ingestão, `apps/web/lib/rag/search.ts` expõe `retrieveRelevantKnowledge(features, reportSections)` retornando até 30 chunks deduplicados em ≤3s, prontos para o prompt da Fase 7.

Concretamente:

- **Acervo é fechado.** 18 PDFs já adquiridos, nenhuma aquisição planejada para Fase 6. Não há blocker de licenciamento — sourcing está resolvido. Estratégia: bootstrap inicial agora; aprendizado contínuo vem da Fase 10 (sistema de aprendizagem clínica) com `source_type='clinical_data'`. **NOTA:** o blocker "Battello pt-BR availability" no STATE.md é falso positivo — não existe autor de iridologia chamado Battello (confusão com Birello, co-autor de Lo Rito, ou com Cappellin); deve ser **removido**, não fechado como found.
- **Pipeline em duas linguagens:** (a) **Python script standalone** (`vision-service/scripts/ingest_knowledge.py` ou repo separado — planner decide; recomendação: dentro de `vision-service/` reusando ambiente Python já configurado). Faz extração PDF → chunking → tagging (manual via Claude Code) → embedding via Voyage HTTP → insert em Postgres via supabase-py. (b) **TypeScript runtime** (`apps/web/lib/rag/search.ts`) implementa `retrieveRelevantKnowledge(features, reportSections)` consumido pela Fase 7. Voyage SDK no Next.js para embedar a query. Contrato `voyage-3` 1024-dim em ambos os lados.
- **Curadoria + tagging com Claude Code (sessão atual)**, sem chamadas API adicionais. 18 livros cabem em sessão Sonnet 4.6/4.7. Custo zero (já dentro da assinatura). Founder acompanha output e ajusta on-the-fly. Reproduzibilidade da tagging não é prioridade — biblioteca não vai escalar; é manifest de execução manual orientado por checklist.
- **Vocabulário de tags é controlado, não livre** (ver D-T1 a D-T5 abaixo). Quando há dúvida, tag fica `null` em vez de chutar.
- **Schema `knowledge_chunks` é re-decidido nesta fase** (extensão do schema base de Fase 1): adiciona `content_hash` (SHA256 UNIQUE para idempotência) e `source_type` ('biblioteca' | 'clinical_data'). Re-migra com migration nova. RLS pode ficar como está (`knowledge_chunks legível por qualquer autenticado` — SETUP-04).
- **Hardcap de custo:** US$ 5 (não US$ 25 do ROADMAP — corrige down a partir de estimativa real: ~5.000 chunks × ~600 tokens × $0.06/1M ≈ $0.18; teto generoso de US$ 5 cobre re-runs de calibração). Script aborta se `running_total_tokens × $0.06/1M > $5`. Log running total a cada 10 chunks.
- **Retrieval contract aceita DOIS inputs** (não só features): `retrieveRelevantKnowledge(features, reportSections)`. Sem o segundo input, seções do relatório Fase 7 que não têm correspondência direta com achados visuais (Psicoemocional, Transgeracional, Mental/Cognitivo, Simbólico/Espiritual) chegam vazias no Sonnet. Implementar agora, não depois.
- **Forward-compat Fase 10 desde já**: campo `source_type` na tabela viabiliza populá-la com `clinical_data` (chunks de edições humanas) sem mudar o contrato do retrieval. Retrieval pesa `clinical_data` 1.5× quando existir. Fase 10 só começa a popular; Fase 6 entrega a infra preparada.

**Fora do escopo desta fase:**

- **Geração do relatório LLM (Fase 7).** Aqui só o retrieval; o consumidor é a próxima fase.
- **UI de gerenciamento da base de conhecimento** (visualizar chunks, re-tagging humano, descartar chunks ruins). Fase 9 polish ou Fase 10.
- **Re-ranker pós-retrieval** (cross-encoder Voyage rerank-2, etc.). Fora do MVP — top-K=5/query + dedup + cap=30 com pesos é suficiente. Reavaliar se relatórios da Fase 7 mostrarem ruído.
- **Versionamento de chunks por critério novo de chunking.** Re-chunking de um livro = `DELETE WHERE source_book='X'` + re-ingest. Sem snapshot/diff de versões.
- **Multi-mapa simultâneo (Jensen + Jausas + Hidalgo)** no retrieval — herdado do locked-out de PROJECT.md. Tags de `setores_referenciados` usam nomenclatura Jensen.
- **Coleta automática de chunks `clinical_data`** — apenas o **campo** é introduzido nesta fase; a captura efetiva (diff entre `ai_report_raw` e `ai_report_edited`) é implementada na Fase 10.
- **Tradução automática de chunks** (livros em en/it/es para pt-BR). Embedding multilíngue do Voyage cobre cross-lingual retrieval; deixar texto original. Tag `idioma` informa ao LLM de origem.
- **OCR de PDFs escaneados.** PyMuPDF + pdfplumber assumem PDFs com texto extraível. Se algum dos 18 livros for scan-only, marcar como `deferred` ou usar OCR fora do pipeline (manual). Founder valida na Wave 0.
- **`pgvector ivfflat`** — index HNSW já criado em Fase 1 (SETUP-03). Apenas usar.

</domain>

<decisions>
## Implementation Decisions

### PDF sourcing & licensing

- **D-S1 (acervo fechado em `D:\Projetos\Iridologista\livros\`):** 18 PDFs já baixados. Lista atual inclui Bernard Jensen Iridology + Iridology Simplified + Dictionary of Iridology (en); Manual Para La Practica de La Iridologia (es); Iridologia em Defesa da Vida + Iridologia Psicoemocional + IRIDOLOGIA PSICOTERAPEUTICA METODO VETORIAL + Iridiologia Aplicada Prática + Manual de Iridologia + Iridologia mod 03 (pt); What the Eye Reveals (Rayid en) + Iridology a Guide Adam Jackson (en, britânica); Endocrinology and Iridology (en); Iridologia del Profondo - Birello/Lo Rito (it); Congreso Mundial Iridologia Francia 2015 + IridENews5 (es/multi). Bernard Jensen.docx + endocrinology-and-iridology.docx também presentes. **Sem novas aquisições nesta fase.**
- **D-S2 (remover blocker falso "Battello pt-BR"):** STATE.md `Bloqueadores / Preocupações` lista "Corpus RAG seed (Fase 6) depende de obter PDFs de Jensen Vol. 1 e Battello em pt — verificar disponibilidade legal/licenciamento antes de ingerir." **Não existe autor de iridologia chamado Battello.** Foi confusão com Birello (co-autor de Lo Rito, *Iridologia del Profondo*) ou Cappellin. **Remover esse bloqueador do STATE.md como parte desta fase** (não fechar como "found" — registro como "false positive removido").
- **D-S3 (cobertura psicossomática/emocional já no acervo):** A dimensão emocional/psicossomática está coberta por *What the Eye Reveals* (Rayid), *Iridologia Psicoemocional* e *IRIDOLOGIA PSICOTERAPEUTICA METODO VETORIAL*. Sem necessidade de buscar outros livros para essa dimensão.

### Chunking strategy

- **D-C1 (target 500 tokens com flex ±200 para fronteiras semânticas):** Splitter alvo 500 tokens; permite chunks entre **300 e 700 tokens** quando necessário para não cortar tabela no meio, não cortar lista numerada de sinais, não cortar definição de conceito. Overlap fixo de **80 tokens** entre chunks adjacentes (apenas dentro da mesma seção; sem overlap cruzando capítulo/seção).
- **D-C2 (hierarquia capítulo → seção → parágrafo no metadata path):** Cada chunk persiste `chapter`, `section` (string null-able) e `page` (integer null-able quando inferível pelo PDF). Splitter respeita prioridade: nunca quebra entre capítulos, evita quebrar dentro de seção, e dentro de seção quebra preferencialmente em fim de parágrafo.
- **D-C3 (splitter custom Python, não langchain):** Razão: conteúdo iridológico tem estruturas próprias (tabelas de constituição, listas numeradas de sinais, mapas setoriais) que splitters genéricos quebram. Custom dá controle e o volume é pequeno (18 livros, ~5.000 chunks estimados). Implementação: `vision-service/scripts/lib/chunker.py` (ou path equivalente — planner decide naming exato). Tokenização para contagem: `tiktoken` com encoder `cl100k_base` (proxy para Voyage; aceitável para budget enforcement).
- **D-C4 (extração: PyMuPDF primário, pdfplumber fallback):** PyMuPDF (fitz) é primário (rápido, bom em texto corrido). pdfplumber é fallback **opt-in por livro** quando founder identificar problemas de tabela mal extraída. Manifest de livros (D-M1) registra qual extrator usar por livro.

### Tag generation model

- **D-T1 (curadoria + tagging dentro do Claude Code, sem chamadas API — RELAXADO 2026-05-05 para Contextual Retrieval; ver D-N1):** Sessão atual (Sonnet 4.6/4.7) faz a tagging semântica. 18 livros cabem em sessão. Custo zero adicional além da assinatura. Founder acompanha output e ajusta. Reproduzibilidade não é prioridade (biblioteca não escala). **Operacionalmente:** após chunking, script gera `vision-service/scripts/data/chunks_pending_tags.jsonl` (ou parquet); operador (Claude Code em sessão) lê batches e produz `chunks_tagged.jsonl` que vira input do embedding+insert. **EXCEÇÃO (D-N1):** Contextual Retrieval (gerar sentence-de-situação por chunk) PERMITE chamada API programática usando Haiku 4.5 com prompt caching. Vocabulary tagging D-T2..T5 e curadoria semântica continuam exclusivamente em Claude Code session.
- **D-T2 (vocabulário controlado — `constituicao_referenciada`):** valores válidos `[linfatica, biliar, hematogina, mix-biliar, neurogenica, miasmatica]`. Listas múltiplas permitidas (chunk pode discutir "biliar e mix-biliar" simultaneamente). Quando o trecho não menciona constituição, fica `[]` (array vazio, não `null` — facilita filtros SQL `WHERE 'biliar' = ANY(metadata->>'constituicao_referenciada'::text[])`).
- **D-T3 (vocabulário controlado — `setores_referenciados`):** valores `[h1, h2, ..., h12]` (notação relógio Jensen). Tagger PODE adicionar nome anatômico em campo livre `tags_livres` ("h7=fígado", "h9=coração esquerdo") mas o array `setores_referenciados` é estritamente o codigo h{N}. Isso bate com o naming dos sectors no JSON da Fase 5 (`sectors[*].hour`).
- **D-T4 (vocabulário controlado — `sinais_referenciados`):** lista fixa derivada de `vision-service/data/jensen-reference.md` (artefato canônico da Fase 5; se não existir como reference, planner cria a lista canônica nesta fase). Exemplos: `lacuna_aberta`, `lacuna_fechada`, `cripta`, `ponta_lanca`, `raios_solaris`, `anel_tensao`, `anel_psorico`, `arco_senil`, `mancha_pigmentar`, `vascularizacao_anormal`, `colarete_irregular`, `defeito_pupilar`. **Founder valida lista canônica antes de tagging começar** (Wave 0). Quando o trecho menciona sinal não-canônico, vai para `tags_livres`, não inventa entrada nova em `sinais_referenciados`.
- **D-T5 (vocabulário controlado — `dimensoes` e `escola_origem`):** `dimensoes` ∈ `[fisica, psicossomatica, transgeracional, constitucional, energetica, comportamental]` (lista fechada; arrays múltiplos permitidos). `escola_origem` é **string única** ∈ `[Jensen, Rayid, Italiana, Alemã, Brasileira, Espanhola, Andrews-britânica]`. Quando dúvida, escola fica `null`. Mapeamento book → escola pré-definido no manifest (D-M1) para evitar tagger decidir por chunk.
- **D-T6 (regra geral: dúvida → null/[]):** quando tagger (Claude Code) não tem certeza, prefere ausência (`null` para campos string, `[]` para arrays) a chute. Vale para todos os 5 vocabulários acima. Ruído em retrieval é pior que recall reduzido.

### Embedding pipeline

- **D-E1 (Voyage `voyage-3`, batches 128):** modelo `voyage-3` (1024 dim, mesmo dim do `vector(1024)` em `knowledge_chunks` — SETUP-03). Batches de até 128 textos por request. Retry exponencial backoff: 3 tentativas, delays 1s/4s/16s (não exponencial puro — degradação clínica para retry humano se persistir). Em failure persistente, persiste batch failed em `failed_batches.jsonl` para retry manual; não aborta o pipeline inteiro.
- **D-E2 (idempotência via `content_hash` SHA256 UNIQUE):** cada chunk tem `content_hash = sha256(text.strip().encode('utf-8'))`. Antes de embedar, `SELECT 1 FROM knowledge_chunks WHERE content_hash = $1`. Se existe, **pula** (não re-embeda, não re-insere). Aplicado também ao insert: `ON CONFLICT (content_hash) DO NOTHING`. Garante que re-runs do script não duplicam chunks nem queimam orçamento.
- **D-E3 (custo estimado <US$ 2; hardcap US$ 5):** ~5.000 chunks × ~600 tokens = 3M tokens × $0.06/1M ≈ $0.18 esperado. Hardcap defensivo em US$ 5 (D-G1). Log running total a cada 10 chunks (D-G2).

### Retrieval contract

- **D-R1 (assinatura `retrieveRelevantKnowledge(features, reportSections)`):** dois inputs. `features` = `IrisFeatures` JSON (SPEC §4.3, output da Fase 5). `reportSections` = `string[]` (slugs das seções do super prompt da Fase 7 que vão ser geradas — ex: `['constituicao', 'psicoemocional', 'transgeracional', 'simbolico', 'mensagem_final']`). Implementado em `apps/web/lib/rag/search.ts`.
- **D-R2 (composição de queries — duas famílias):**
  - **Família A (achados visuais)** — derivada de `features`:
    - 1 query por constituição primária+secundária presentes
    - 1 query por setor com `findings.length > 0` (templated: "lacuna no setor 7 (fígado, vesícula)")
    - 1 query por `global_signs` ativados (anel de tensão presente, arco senil, etc.)
  - **Família B (seções do super prompt)** — derivada de `reportSections`:
    - 1 query por seção, **combinando constituição encontrada + tema da seção** (ex: "biliar + dimensão psicoemocional", "neurogênica + padrão transgeracional", "linfática + simbolismo da água")
    - Templates moram em `apps/web/lib/rag/section-queries.ts`, **versionado junto com o super prompt da Fase 7** (mudança no super prompt → mudança no template; mantém em par sincronizado).
- **D-R3 (top-K=5 por query, dedup por chunk_id, cap total 30):** cada query retorna top 5 chunks por `<=>` cosine distance. União é **deduplicada por chunk_id** (mesmo chunk vindo de múltiplas queries conta uma vez). Chunks ordenados por melhor distância dentre as queries que o trouxeram. Cap final: 30 chunks (~15k tokens, dentro do envelope do prompt da Fase 7).
- **D-R4 (pesos pós-retrieval):** após retrieval bruto, aplica multiplicadores no score:
  - chunks com `metadata->dimensoes` interseccionando o tema da seção da query: **+20%**
  - chunks de livros marcados `alta_prioridade=true` no manifest: **+10%**
  - chunks com `source_type='clinical_data'` (Fase 10 forward-compat): **+50%** (1.5×)
  - Pesos são multiplicativos sobre o score (1 - cosine_distance). Re-ordenação acontece antes do cap=30.
- **D-R5 (latência ≤3s):** orçamento — embed da query (~200ms × N queries paralelas), `pgvector` HNSW search (~50ms × N queries em paralelo), aggregation (<100ms). N queries esperado: ~5–8 (poucas constituições + 4–6 seções). Paralelização via `Promise.all` no Next.js. **Server action** (não API route) para evitar overhead de fetch interno.
- **D-R6 (interface):** retorna `KnowledgeChunk[]` com `text, source_book, chapter, section, page, metadata, score`. Consumidor (Fase 7) decide formatação para prompt. Não inclui `embedding` nem `content_hash`.

### Persistence — schema `knowledge_chunks`

- **D-P1 (migration adiciona `content_hash` e `source_type`):** Schema base de Fase 1 (SETUP-03) é estendido com migration nova:
  ```sql
  ALTER TABLE knowledge_chunks
    ADD COLUMN content_hash text UNIQUE,
    ADD COLUMN source_type text NOT NULL DEFAULT 'biblioteca'
      CHECK (source_type IN ('biblioteca', 'clinical_data'));
  CREATE INDEX knowledge_chunks_source_type_idx ON knowledge_chunks (source_type);
  CREATE INDEX knowledge_chunks_source_book_idx ON knowledge_chunks (source_book);
  ```
  Numeração da migration: a próxima livre (planner verifica `supabase/migrations/`). HNSW em `embedding` já existe; btree adicional em `source_type` e `source_book` para filtros rápidos.
- **D-P2 (shape final do `metadata` jsonb):**
  ```json
  {
    "autor": "Bernard Jensen",
    "escola": "Jensen",
    "idioma": "pt",
    "ano": 1982,
    "constituicao_referenciada": ["biliar"],
    "setores_referenciados": ["h7"],
    "sinais_referenciados": ["lacuna_aberta"],
    "dimensoes": ["fisica", "constitucional"],
    "tags_livres": ["fígado", "vesícula"]
  }
  ```
  Strings em pt-BR onde aplicável (consistente com jensen-map.json da Fase 5). `idioma` ∈ `[pt, en, it, es, de]`. `ano` é integer (year of publication).
- **D-P3 (HNSW params m=16, ef_construction=64):** Index existente da Fase 1 já cria `vector_cosine_ops`. **Validar params atuais**; se diferentes, ajustar via DROP+CREATE INDEX nesta migration. Defaults razoáveis para 5k–50k chunks. Reavaliar quando passar de 100k.

### Idempotency & re-ingestion

- **D-I1 (idempotência por `content_hash`):** já coberta em D-E2. Re-runs do script são seguros (no-op para chunks já indexados).
- **D-I2 (re-ingestão completa = drop & recreate):** `pnpm rag:purge --book="<source_book>"` (ou equivalente Python `python ingest_knowledge.py --purge --book "X"`) faz `DELETE FROM knowledge_chunks WHERE source_book = $1` + re-ingest. Aceitável porque biblioteca é pequena e custo é US$ 0.18 por re-run completo. **Sem versionamento de chunks** (D-I3).
- **D-I3 (sem versionamento de critério de chunking):** se um livro for re-chunked com critério novo (ex: tabelas extraídas melhor), aplica D-I2 (drop + re-ingest). Versionamento de "esquema de chunk" não é prioridade — dimensão de embedding fixa em 1024 e shape de metadata estável bastam.

### Cost guardrail

- **D-G1 (hardcap US$ 5):** valor escolhido **para baixo** do estimado ($0.18 esperado, ~28× margem). Script aborta se `running_total_tokens × $0.06/1M > $5`. Alerta no console em $1, $2, $3, $4 (logs de progresso). Aborto ergue exception clara com running total e contagem de chunks já embedados (são preservados — idempotência cuida do retry).
- **D-G2 (running total log a cada 10 chunks):** linha estruturada `[ingest] chunk 130/5000 | tokens 78,201 | est_cost $0.0047 | book "Jensen Iridology Vol 1"`. Facilita acompanhamento humano e debug se algum livro disparar contagem fora da norma.

### Forward-compat Fase 10 (clinical_data)

- **D-F1 (`source_type` desde já com 2 valores):** `'biblioteca'` (chunks dos 18 livros, default) e `'clinical_data'` (futuros chunks de edições humanas no dogfooding/beta). Coberto pela CHECK constraint em D-P1.
- **D-F2 (peso 1.5× em retrieval):** ver D-R4. Implementado no `lib/rag/search.ts` agora (multiplicador), mesmo que `clinical_data` não seja populado nesta fase. Quando Fase 10 começar a popular, retrieval responde imediatamente sem mudança de contrato.
- **D-F3 (Fase 6 não popula `clinical_data`):** apenas a infra. Captura efetiva de `relatório_gerado vs entregue` é Fase 10. Esta fase deixa o terreno preparado.

### Advanced Retrieval (Ninja Pass — 2026-05-05)

- **D-N1 (Contextual Retrieval ADOPTED, D-T1 relax escopado):** Antes de embedar cada chunk, prepende uma sentence-de-situação gerada por Claude Haiku 4.5 com prompt caching do capítulo inteiro como contexto. Padrão Anthropic 2024 (35% redução em failure rate top-20, compounded com reranking → 67%). **D-T1 fica relaxada APENAS para este uso programático**; vocabulary tagging D-T2..T5 e curadoria semântica continuam Claude Code session-only. Implementação: `vision-service/scripts/contextualize_chunks.py`, depende de `anthropic` SDK (adicionar ao `requirements.txt`). Chunk final embedado: `[Contexto: <situating-sentence>]\n\n<original chunk>`. **Hardcap dedicado para Contextual Retrieval: US$ 15** (~3× o estimado de $3–9 com Haiku 4.5 + prompt caching, com folga). Idempotência via `content_hash` continua valendo (hash inclui o prefixo de contexto, então re-runs são seguros). Para forward-compat Fase 10, contextual sentence é gravada também em coluna separada `metadata.contextual_sentence` (string, opcional null para `clinical_data` que pode ter outra origem).
- **D-N2 (Reranking voyage-rerank-2.5 ADOPTED — bring forward from `<deferred>`):** Após pgvector top-K (aumentado de 5 para ~10 por query) e dedup, conjunto de candidatos (~50–80 chunks) passa por `voyage-rerank-2.5` que devolve top-30 reordenado. Pesos D-R4 aplicados DEPOIS do rerank (multiplicativos sobre score do reranker). Implementação: `apps/web/lib/rag/rerank.ts`. SDK `voyageai` npm (já necessário para embedar). Modelo padrão `voyage-rerank-2.5`, configurável via env var `VOYAGE_RERANK_MODEL` (`voyage-rerank-2.5-lite` é fallback de custo). **Free tier 200M tokens/conta cobre ~12+ meses de dogfooding.** Latência adicional ~600ms (cabe em D-R5 ≤3s budget). Fallback graceful: se rerank API falha, retorna top-30 cosine puro (não derruba retrieval).
- **D-N3 (HyDE DEFERRED para Fase 9 polish):** HyDE (Hypothetical Document Embedding) para queries Família B foi avaliado mas **deferido**. Razão: latência adicional (+2s) e custo (+$54/mês a 100 terapeutas) apertam o envelope $30–80/mês de PROJECT.md. Reabrir se UAT da Fase 7 mostrar gaps específicos em queries de seções abstratas (psicoemocional, transgeracional, simbólico). Sem código nesta fase.
- **D-N4 (latency budget e performance test gate):** Com adoção D-N1+D-N2 (sem HyDE), latência composta esperada do retrieval: embed (~200ms × N queries em paralelo) → pgvector (~50ms × N) → rerank (~600ms) → weights (~10ms) ≈ **~1.5s end-to-end** com margem confortável sobre D-R5 cap 3s. **Plan inclui performance test gate** que falha se p95 > 2s (early-warning antes do cap real).
- **D-N5 (compound failure-rate reduction esperada):** Anthropic mediu (em 4 domínios): plain RAG → 5.7% failure top-20; Contextual + Reranking → 1.9% (67% redução). Para nosso corpus clínico/iridológico/multilíngue: projeção conservadora 35% redução. **UAT spot-check obrigatório** (Success Criterion 5: lacuna setor 7 → top-5 chunks fígado/lacuna): comparar plain vs +contextual+rerank em 10 queries, founder qualifica.

### Manifest de livros

- **D-M1 (`vision-service/scripts/data/books_manifest.json` ou equivalente):** arquivo único, comitado, lista todos os 18 PDFs com metadata operacional:
  ```json
  {
    "Bernard Jensen Iridology Simplified": {
      "filename": "157928975-Bernard-Jensen-Iridology-Simplified.pdf",
      "autor": "Bernard Jensen",
      "escola": "Jensen",
      "idioma": "en",
      "ano": 1980,
      "alta_prioridade": true,
      "extrator": "pymupdf",
      "skip": false,
      "ocr_required": false,
      "notas": "Texto-base da escola americana — alta prioridade no boost retrieval"
    },
    ...
  }
  ```
  **Founder preenche** (com apoio do tagger Claude Code) na Wave 0 antes de qualquer extração. Decisões `alta_prioridade`, `escola`, `extrator`, `skip` ficam aqui. Manifest é o controle central da operação.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema e infra
- `apps/web/types/database.ts` — tipos gerados; ver shape atual de `knowledge_chunks`
- `supabase/migrations/0001_*.sql` — schema base de Fase 1 (SETUP-03 — `knowledge_chunks`, HNSW, `vector(1024)`)
- `supabase/migrations/` — diretório completo para identificar próximo número de migration livre

### Fase 5 (consumidor downstream do contrato JSON `IrisFeatures`)
- `vision-service/data/jensen-map.json` — mapa setorial canônico Jensen pt-BR (consistência features↔RAG via D-T3 setores `h{N}`)
- `vision-service/pipeline/features.py` — produz `sectors[*].hour`, `sectors[*].zones`, `findings[]` que serão input do retrieval
- `vision-service/data/error_summary.json` — padrão de "catálogo controlado em pt-BR" externalizado (modelo para `books_manifest.json` D-M1)
- `apps/web/lib/vision/hmac.ts` + `apps/web/lib/vision/modal-client.ts` — patterns de integração serviço externo (referência para chamadas Voyage HTTP)
- `.planning/phases/05-pipeline-visao-modal/05-CONTEXT.md` — convenções de naming/auditoria reusadas (vocabulário proibido LGPD, `pnpm audit:vocabulary`)

### Fase 1 (setup do banco)
- `.planning/phases/01-setup/01-03-PLAN.md` — migration original `knowledge_chunks`
- `.planning/phases/01-setup/01-04-PLAN.md` — types regen + push pattern

### Standards do projeto
- `apps/web/CLAUDE.md` (se existir) — guidelines pt-BR, vocabulário proibido
- `vision-service/README.md` — runbook Modal + estrutura de scripts existentes
- `package.json` (raiz e `apps/web/`) — verificar se há script `audit:vocabulary` reutilizável

### Acervo seed
- `D:\Projetos\Iridologista\livros\` — 18 PDFs (lista completa em D-S1)

</canonical_refs>

<specifics>
## Specific Ideas

- **Localização do script de ingestão**: `vision-service/scripts/ingest_knowledge.py` (recomendado — reusa Python env do Modal). Alternativa rejeitada: `apps/web/scripts/ingest-knowledge.ts` (REQUIREMENTS.md sugere TS, mas Python ganha por causa do PyMuPDF/pdfplumber + paridade com vision-service). REQUIREMENTS.md RAG-01 deve ser atualizado se planner escolher Python (não bloqueia execução; é renaming).
- **Naming sugerido das colunas de query templates** (`apps/web/lib/rag/section-queries.ts`):
  ```ts
  export const SECTION_QUERY_TEMPLATES: Record<ReportSection, (features: IrisFeatures) => string[]> = {
    psicoemocional: (f) => [
      `${f.constitution.primary} dimensão psicoemocional`,
      `${f.constitution.primary} padrão emocional reprimido`,
    ],
    transgeracional: (f) => [
      `${f.constitution.primary} herança familiar transgeracional`,
    ],
    // ...
  };
  ```
  Templates canônicos esboçados pelo planner; founder valida com 1 spot-check antes de execute.
- **Catálogo inicial de `sinais_referenciados`** (D-T4) — lista mínima para founder validar:
  - lacuna_aberta, lacuna_fechada, cripta
  - ponta_lanca, raios_solaris
  - anel_tensao, anel_psorico, anel_nervoso, anel_linfatico
  - arco_senil, arco_de_pelo
  - mancha_pigmentar, mancha_psorica, mancha_uremica
  - vascularizacao_anormal
  - colarete_irregular, colarete_dilatado
  - defeito_pupilar, achatamento_pupilar
  - heterocromia_central, heterocromia_setorial
- **Texto de log do hardcap (D-G1)** quando aborta:
  ```
  [ingest] HARD CAP REACHED — $5.00 spent ($5.0123 estimated).
  Indexed 4,832 chunks across 16 books before abort.
  Last book in progress: "Iridologia del Profondo - Birello/Lo Rito" (chunk 4,832 of ~310 estimated).
  Re-run idempotently: chunks already indexed will be skipped via content_hash.
  Increase hardcap by editing INGEST_HARDCAP_USD in vision-service/scripts/ingest_knowledge.py.
  ```
- **Auditoria de vocabulário proibido**: `pnpm audit:vocabulary` (Fase 3+) deve passar **também sobre `metadata.tags_livres`** dos chunks indexados. Pós-ingest, query SQL: `SELECT id, source_book, metadata->'tags_livres' FROM knowledge_chunks WHERE metadata::text ILIKE '%diagnóstico%' OR ...`. Trecho citado de livro pode usar a palavra (livro original cita); **o que é proibido é a tag livre**. Founder revisa hits.
- **Observação sobre PDFs duplicados na lista**: `689712209-iridologia-mod-03.pdf` aparece **2 vezes** com o mesmo nome (uma com `(1)`). Manifest D-M1 deve marcar uma como `skip: true` ou unificar. Founder decide na Wave 0.
- **Observação sobre DOCX**: 2 arquivos `.docx` no acervo (`Bernard-Jensen.docx`, `endocrinology-and-iridology.docx`). PyMuPDF não lê DOCX direto. Manifest D-M1 marca extrator como `python-docx` (lib separada) ou `skip` se o conteúdo já está coberto pelos PDFs equivalentes. Founder decide.
- **Embedding library no Next.js (Voyage SDK)**: `voyageai` npm package (verificar se existe e está estável em 2026; alternativa: chamada direta HTTPS ao endpoint `https://api.voyageai.com/v1/embeddings`). Planner pesquisa estado atual.
- **Embedding library no Python (script de ingestão)**: `voyageai` PyPI package, mesmo SDK base do TS. Confirmação na pesquisa.
- **Telemetria mínima do retrieval**: log estruturado em `console.info({ event: 'rag_retrieve', queries_count, chunks_returned, latency_ms, top_score, bottom_score })`. Sem PII. Útil pós-Fase 7 para entender se retrieval está performando.
- **Spot-check obrigatório (Success Criterion 5)**: feature simulada `lacuna no setor 7 (fígado)` → top-5 chunks devem ser reconhecidamente relevantes a fígado/lacuna em obras clássicas. Founder valida UAT da fase. Se top-5 ruim, calibrar pesos D-R4 ou re-tagging do livro problemático.
- **Quem dispara a ingestão**: comando manual `pnpm rag:ingest` (ou `python ingest_knowledge.py`), não automatizado. Sem CI hook. Founder corre uma vez (Wave de execução), valida spot-check, commit do manifest+migration.

</specifics>

<deferred>
## Deferred Ideas

- ~~**Re-ranker pós-retrieval (cross-encoder, Voyage rerank-2)**~~ — **MOVED IN-SCOPE 2026-05-05 (ver D-N2).** voyage-rerank-2.5 adopted após Ninja Pass research; free tier cobre dogfooding inteiro, +12.70% sobre Cohere v3.5, sinérgico com Contextual Retrieval (D-N1).
- **HyDE (Hypothetical Document Embedding) para queries Família B** — adicionado e deferido em 2026-05-05 (D-N3). Reavaliar se UAT Fase 7 mostrar gaps em seções abstratas.
- **UI de gerenciamento da base** (visualizar/editar/deletar chunks via dashboard) — Fase 9 polish ou Fase 10.
- **Captura efetiva de `clinical_data`** (diff `ai_report_raw` vs `ai_report_edited`) — Fase 10. Aqui só o campo na tabela e o multiplicador no retrieval.
- **OCR para PDFs scan-only** — fora do pipeline. Founder identifica na Wave 0; PDFs problemáticos vão para `skip: true` no manifest e ficam para retomar manualmente.
- **Tradução de chunks en/it/es para pt-BR** — embedding multilíngue do Voyage cobre cross-lingual; deixar texto original.
- **Versionamento de chunks** (snapshot de versões anteriores ao re-chunkar) — sem necessidade enquanto biblioteca é pequena.
- **Multi-mapa simultâneo (Jensen + Jausas + Hidalgo)** — locked-out em PROJECT.md.
- **Telemetria estruturada com OpenTelemetry/Sentry** — Fase 9 polish.
- **Auto-discovery de novos livros adicionados ao diretório** — sem necessidade. Founder adiciona ao manifest manualmente.
- **Tagging automatizado via LLM call API** — explicitamente rejeitado em D-T1 (sessão Claude Code é o operador).
- **Reproduzibilidade da tagging** (mesmo input → mesmo output) — não-prioridade (D-T1). Se Fase 10 precisar disso, re-design lá.
- **Compactação binária do `embedding`** (int8 quantization) — fora; vector(1024) float32 cabe sem stress.
- **Fallback semântico (BM25 + vector hybrid)** — fora do MVP. Vector-only com pesos pós-retrieval é suficiente. Reavaliar se queries com termos raros (nomes de remédios homeopáticos, etc.) falharem em recall.
- **Web scraping de artigos online** (sites Jensen, escolas brasileiras) — fora; acervo fechado por D-S1.

</deferred>

---

*Phase: 06-rag-ingestao*
*Context gathered: 2026-05-04 via founder discuss-phase (10 decisões locked, 18 PDFs catalogados)*
