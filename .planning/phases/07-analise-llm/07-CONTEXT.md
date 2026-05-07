# Phase 7: Análise LLM - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Source:** Founder discuss-phase (4 áreas exploradas, 2 follow-ups locked)

<domain>
## Phase Boundary

Dado um `readings.vision_features` populado pela Fase 5, gerar via Claude Sonnet 4.6 (streaming, pt-BR) um relatório iridológico ancorado em features + RAG (`retrieveRelevantKnowledge` da Fase 6) seguindo as 13 seções e 5 princípios do prompt-base SPEC §6, persistir saída crua + estruturada por seção, permitir edição por seção pelo terapeuta antes de entregar, e capturar **na infra de schema** (sem UI ainda) o conjunto de dados que a Fase 10 (Sistema de Aprendizagem Clínica / "SAC") precisa para destilar heurísticas emergentes.

Concretamente:

- **Geração:** `apps/web/lib/anthropic/analyze.ts` (novo módulo) — carrega `readings.vision_features`, chama `retrieveRelevantKnowledge(features, reportSections)` (assinatura D-R1 já em produção), monta prompt via `apps/web/prompts/system.md` + `apps/web/prompts/feature-injection.md` (templates novos copiados literalmente de SPEC §6), chama Sonnet 4.6 com streaming via `@anthropic-ai/sdk@^0.92.0` (já instalado).
- **Streaming:** Route Handler `apps/web/app/api/readings/[id]/analyze/route.ts` (novo) usando Web Streams API. Persistência incremental no DB (debounce/section-boundary, não por event delta — ver D-S2). Sobrevive a refresh do browser do terapeuta no meio da geração.
- **Persistência:** migration `0007` substitui `readings.ai_report_raw`/`ai_report_edited` por jsonb estruturado `report_generated`/`report_delivered` (canonicos), mantém o contrato LLM-04 via colunas `GENERATED ALWAYS AS (... text concat ...) STORED` que reconstroem `ai_report_raw`/`ai_report_edited` a partir do jsonb. Adiciona campos completos do pré-requisito Fase 10 (D-P1).
- **Editor:** rota `/leituras/[id]/editar` com 13 seções colapsáveis editáveis individualmente (D-U1). Diff computado por seção ao salvar (`edit_diff` jsonb auto-populado).
- **Auditoria pós-geração:** ancoragem de features (≥95% nas seções 2-6) e vocabulário LGPD-06 (`diagnóstico|tratamento|cura`) verificados sobre o output cru. **Falha NÃO bloqueia, NÃO regenera silenciosamente.** Salva com banner de aviso visível no editor e força revisão humana (D-A1, D-A2).
- **Cost guard:** botão "regenerar análise" — máx 3 tentativas por leitura, bloqueado se `report_delivered` já existe. Log estruturado de regenerações por terapeuta/mês; alerta (não bloqueia) acima de 10/mês (D-S4).

**Fora do escopo desta fase:**

- **UI de coleta de feedback L2/L3** (`clinical_feedback` 24h pós-sessão, `exam_notes`). **Schema entra agora na migration 0007** (D-P2), mas a UI/fluxo de captura (lembrete por e-mail Resend, formulário in-app) fica para Fase 9 (polish + dogfooding) — Resend só é puxado lá conforme ONBOARD-02.
- **Treinamento ou descoberta de heurísticas** — toda essa capacidade é Fase 10. Aqui só o terreno (campos persistidos com resolução temporal).
- **Edição de `vision_features`** pelo terapeuta — Fase 5 D-T4 fixa que terapeuta só edita `ai_report_edited`/`report_delivered` (texto), não JSON de features. Mantido.
- **Geração de PDF do relatório** (entregar ao cliente em PDF assinável) — Fase 8 quando o termo de consentimento LGPD-01 também precisa de PDF; reusa pipeline lá.
- **Disparo automático da análise** após webhook da Fase 5 marcar `status='ready'` — terapeuta dispara manualmente clicando "gerar análise" (SC1). Auto-trigger é Fase 9 polish se UAT pedir.
- **Reranking ou ajuste do RAG retrieval** — `retrieveRelevantKnowledge` é contrato fechado da Fase 6 (D-R1, D-N2); planner pode tunar `reportSections` que passa, não a implementação interna.
- **Novos `ReportSection` slugs** — atuais cobertos em `apps/web/lib/rag/types.ts`: `constituicao`, `psicoemocional`, `transgeracional`, `simbolico`, `mensagem_final`, `mental_cognitivo`, `nutricao_carencias`. **Mapeamento 13 seções → slugs RAG: planner decide** (várias seções compartilham slug; ex: seção 5 e 8 ambas usam `psicoemocional` + `simbolico`). Mudança em slugs força mudança em `apps/web/lib/rag/section-queries.ts` (D-R2B "frozen contract").
- **Internacionalização** — output sempre pt-BR (LLM-01, SPEC §6).
- **Multi-mapa simultâneo** (Jensen + Hidalgo + Jausas) — fora por PROJECT.md / SPEC §9.

</domain>

<decisions>
## Implementation Decisions

### Output enforcement (âncora + vocabulário) — D-A*

- **D-A1 (ancoragem `[ancorado em: features.X]` — auditoria pós-geração, banner de aviso, NÃO bloqueia):** Após o stream completar, regex `\[ancorado em: features\.[\w.\[\]]+\]` é executado sobre as seções 2-6 do `report_generated` (que correspondem a Estrutural Física, Sistêmicas, Toxemia, Psicoemocional, Cargas Temporais — as 5 seções clínicas com obrigação de ancoragem em SC2). Se **>5% das afirmações dessas seções não tiverem âncora**, a leitura é salva com `status='ready'` mas com `audit_flags.low_anchor_rate=true` em jsonb dedicado (`audit_metadata`). Editor mostra banner persistente: *"Relatório com baixa ancoragem em features (X% das afirmações) — revise antes de entregar ao cliente."* Terapeuta decide se edita/entrega/descarta. **Não regenera silenciosamente, não bloqueia entrega, transparência total.** Definição de "afirmação": **planner decide** entre (a) sentence-split por `.!?` fora de `[...]`, ou (b) bullet/parágrafo. Recomendação: sentence-split, mais granular e mais defensável.
- **D-A2 (vocabulário LGPD-06 — auditoria pós-geração, banner, NÃO regenera):** Mesmo modelo do D-A1. Regex `/\b(diagnóstico|tratamento|cura)\b/i` (com word-boundary, alinhado ao `apps/web/scripts/audit-vocabulary-db.mjs` D-N6 da Fase 6) sobre o `report_generated` cru. Hits → `audit_flags.forbidden_vocab` em `audit_metadata` listando termos+seções+ocorrências. Banner: *"Termos clinicamente afirmativos detectados — corrija antes de entregar."* Terapeuta corrige na edição; ao salvar, mesmo regex roda sobre `report_delivered` e bloqueia o save com mensagem clara se ainda tiver hit. **Geração não regenera; entrega exige limpo.**
- **D-A3 (audit_metadata jsonb dedicado — separa do report):** Coluna nova `readings.audit_metadata jsonb default '{}'` na migration 0007. Shape:
  ```json
  {
    "low_anchor_rate": false,
    "anchor_rate_pct": 97.3,
    "anchor_rate_per_section": { "2": 100, "3": 95, "4": 100, "5": 92, "6": 89 },
    "forbidden_vocab": [],
    "audited_at": "2026-05-06T18:23:00Z",
    "auditor_version": "v1"
  }
  ```
  Re-auditável em qualquer momento (mesma rotina recalcula). `auditor_version` permite evoluir critério sem reprocessar histórico. Editor consome esse jsonb para renderizar banners.
- **D-A4 (extensão de `pnpm audit:vocabulary` para `lib/anthropic/`):** Plan inclui adicionar `'lib/anthropic'` ao array `DIRS` em `apps/web/scripts/audit-vocabulary.mjs`. Mesmo padrão usado pela Fase 6 D-N6 quando estendeu para `lib/rag/`. Garante que constantes/templates dentro de `lib/anthropic/` (não os prompts em `prompts/system.md`, esses são exceção justificada por conterem a lista de frases proibidas para o LLM evitar) também passem auditoria estática.

### Schema migration 0007 (pré-requisito Fase 10) — D-P*

- **D-P1 (jsonb canônico + GENERATED column para retrocompat LLM-04):** Migration `supabase/migrations/0007_phase_7_analise_llm.sql` faz:
  ```sql
  ALTER TABLE readings
    DROP COLUMN ai_report_raw,
    DROP COLUMN ai_report_edited,
    ADD COLUMN report_generated jsonb,
    ADD COLUMN report_delivered jsonb,
    ADD COLUMN ai_report_raw text GENERATED ALWAYS AS (
      jsonb_concat_sections_pt_br(report_generated)
    ) STORED,
    ADD COLUMN ai_report_edited text GENERATED ALWAYS AS (
      jsonb_concat_sections_pt_br(report_delivered)
    ) STORED;
  ```
  Função `jsonb_concat_sections_pt_br(jsonb) RETURNS text` é IMMUTABLE, criada na mesma migration, faz concat ordenado das chaves `1_constituicao` … `13_mensagem_final` + `encerramento_disclaimer` separadas por `\n\n`. Postgres recalcula `ai_report_raw`/`ai_report_edited` automaticamente quando o jsonb muda. **Zero registros existentes a migrar** (Fase 7 nunca executou; ai_report_raw/edited estão sempre NULL hoje). Contrato LLM-04 atende sem mudar REQUIREMENTS.md (text continua existindo, sintático).
- **D-P2 (campos completos pré-requisito Fase 10/SAC — TODOS na migration 0007):**
  ```sql
  ALTER TABLE readings
    ADD COLUMN report_generated_at timestamptz,    -- timestamp_gerado
    ADD COLUMN report_delivered_at timestamptz,    -- timestamp_entregue (distinto de delivered_at, que é entrega ao cliente — este é o save da edição)
    ADD COLUMN edit_diff jsonb,                    -- computado ao salvar report_delivered (D-U2)
    ADD COLUMN zonas_editadas jsonb,               -- por seção (D-U1)
    ADD COLUMN tipo_edicao text[],                 -- ['adicionado','removido','corrigido','reescrito']
    ADD COLUMN clinical_feedback jsonb,            -- L2 — schema agora, UI Fase 9
    ADD COLUMN exam_notes text,                    -- L3 — schema agora, UI Fase 9
    ADD COLUMN feedback_collected_at timestamptz,  -- preenchido quando L2/L3 forem coletados (Fase 9)
    ADD COLUMN audit_metadata jsonb default '{}',  -- D-A3
    ADD COLUMN regeneration_count int default 0,   -- D-S4 cap em 3
    ADD COLUMN regeneration_log jsonb default '[]'; -- D-S4 telemetria por terapeuta/mês
  ```
  **Resolução temporal importa para o SAC** (founder): `report_generated_at` ≠ `report_delivered_at` ≠ `delivered_at` (entrega final ao cliente). Três timestamps distintos rastreiam latência de revisão (`delivered_at - report_generated_at`) e janela de revisão humana (`report_delivered_at - report_generated_at`).
- **D-P3 (shape canônico do `report_generated`/`report_delivered` jsonb — chaves snake_case por seção):**
  ```json
  {
    "1_constituicao": "<markdown da seção 1>",
    "2_estrutural_fisica": "<...>",
    "3_indicacoes_sistemicas": "<...>",
    "4_toxemia": "<...>",
    "5_psicoemocional": "<...>",
    "6_cargas_temporais": "<...>",
    "7_carencias_nutricionais": "<...>",
    "8_simbolico_espiritual": "<...>",
    "9_cuidados_integrativos": "<...>",
    "10_potenciais_forcas": "<...>",
    "11_afirmacoes_integracao": "<...>",
    "12_sintese_integrativa": "<...>",
    "13_mensagem_final": "<...>",
    "encerramento_disclaimer": "<texto literal SPEC §6>"
  }
  ```
  `encerramento_disclaimer` é **string literal fixa** não gerada pelo LLM — appended programaticamente ao final do stream pelo Route Handler. Garante SC4 (disclaimer literal sempre presente). Cada chave armazena markdown da seção (não plain text — `react-markdown` renderiza no editor).
- **D-P4 (status enum mantido, sem novos valores):** Enum atual `pending|processing|ready|failed|edited` cobre tudo. Fluxo: `ready` (Fase 5 produziu features) → terapeuta clica "gerar análise" → permanece `ready` (não vira `processing` — esse status é reservado pra pipeline Modal Fase 5; análise LLM é stateless do ponto de vista do enum) → ao final do stream, `report_generated` populado e `audit_metadata` preenchido → terapeuta edita/salva → `status='edited'`. Botão "regenerar" é gated por `report_delivered IS NULL AND regeneration_count < 3`.

### Editor UX — D-U*

- **D-U1 (13 seções colapsáveis editáveis individualmente — não textarea único, não só preview):** `apps/web/app/(dashboard)/leituras/[id]/editar/page.tsx` (RSC) carrega `report_generated` + (se existir) `report_delivered`. `editar-client.tsx` renderiza 13 `<details>` colapsáveis (uma por chave do jsonb), cada uma com preview markdown (via biblioteca — recomendação `react-markdown` + `remark-gfm`, planner pesquisa estado da arte 2026; alternativa `@uiw/react-md-editor` que já dá split-view edit/preview embutido). Encerramento disclaimer aparece colapsado/somente-leitura ao final (terapeuta não pode editar — é literal LGPD). Estado local por seção; "salvar" envia diff + jsonb completo via Server Action. **Justificativa do founder:** "zonas_editadas por seção é o sinal mais valioso para o SAC. Diff bruto perde informação clínica."
- **D-U2 (cálculo automático de `edit_diff` ao salvar):** Server Action `saveReportDelivered(readingId, reportDelivered)`:
  1. Carrega `report_generated` atual.
  2. Para cada das 14 chaves (13 + encerramento), compara texto. Se diferente, classifica em `tipo_edicao`:
     - vazio→texto = `adicionado`
     - texto→vazio = `removido`
     - levenshtein/diff < 30% mudança = `corrigido`
     - mudança ≥ 30% = `reescrito`
  3. Persiste `edit_diff` jsonb shape `{ "5_psicoemocional": { "type": "reescrito", "diff_summary": "...", "char_delta": -120 }, ... }`.
  4. Persiste `zonas_editadas` jsonb shape `["5_psicoemocional", "6_cargas_temporais"]` (lista de chaves alteradas) — **redundante com edit_diff** mas facilita queries SQL agregadas para Fase 10 sem desempacotar jsonb completo.
  5. Persiste `tipo_edicao` text[] shape `['reescrito', 'corrigido']` (lista deduplicada de tipos) — **idem, conveniência de query**.
  6. Atualiza `status='edited'`, `report_delivered_at=NOW()`.
  Lib de diff: `diff` npm (Myers). Threshold 30% e categorias são heurística inicial; planner pode refinar. Auditoria de vocabulário (D-A2) roda aqui também — bloqueia save se hit.
- **D-U3 (botão "entregar ao cliente" separado de "salvar edição"):** Salvar = persistir edição (status='edited', `report_delivered_at` carimbado). Entregar = bloquear edição futura (`is_delivered=true`, `delivered_at=NOW()`). Dois cliques distintos. Justificativa: terapeuta pode salvar várias vezes durante revisão; entrega é evento terminal que congela o registro.

### Streaming + cost guards — D-S*

- **D-S1 (Route Handler + Web Streams API, NÃO Server Action streamable):** `apps/web/app/api/readings/[id]/analyze/route.ts` POST. Auth via `createClient` server-side + RLS check em `readings`. Anthropic SDK em modo streaming (`client.messages.stream({...})`). Resposta da Route Handler é `Response(readableStream, { headers: { 'Content-Type': 'text/event-stream' } })` ou plain `text/plain` chunked (planner decide protocolo final — SSE dá retry nativo do browser, plain stream é mais simples). Cliente UI (`apps/web/app/(dashboard)/leituras/[id]/page.tsx` + componente cliente) consome com `fetch` + `ReadableStream.getReader()`. **Razão da escolha:** controle total sobre headers, retry, abort, persistência incremental — Server Action streamable abstrai demais e dificulta o D-S2.
- **D-S2 (persistência incremental — section-boundary, NÃO por delta event):** O LLM emite `### N. Título` ao começar cada seção. Parser no servidor detecta esse boundary (regex `^### (\d{1,2})\.\s+`) e a cada seção concluída faz `UPDATE readings SET report_generated = jsonb_set(report_generated, '{<key>}', to_jsonb($content)) WHERE id = $id`. **14 writes por geração** (13 seções + disclaimer literal appended). Sobrevive a refresh (próximo GET retorna o jsonb parcial; UI renderiza progresso). Não escreve por event delta (~30ms cadência → ~10k writes/análise = absurdo). Encerramento disclaimer escrito sempre por último, após o stream fechar normalmente — se o stream falhar antes do final, `report_generated` fica com seções parciais e `encerramento_disclaimer` ausente; UI detecta isso para oferecer retry sem perder o trabalho parcial.
- **D-S3 (timeout + retry strategy):** Timeout total da Route Handler: 5min (Vercel Fluid Compute permite 300s, alinha). Anthropic SDK retry interno: 2 tentativas em erros transientes (rede, 5xx). Erro persistente → resposta de erro JSON enviada como evento final do stream (cliente UI mostra erro inline + botão "tentar novamente"). Status do reading não muda em falha (continua `ready`); `regeneration_count` só incrementa em sucesso para não punir falha de infra.
- **D-S4 (cap de regeneração + telemetria de abuso):**
  - **Cap por leitura:** botão "regenerar" disabled se `regeneration_count >= 3`. Hard guard no servidor (Route Handler retorna 409 se cliente burlar). Após 3 tentativas insatisfatórias, terapeuta edita manualmente.
  - **Cap pós-entrega:** disabled se `report_delivered IS NOT NULL` (terapeuta já editou e salvou). Hard guard servidor. Editar é diferente de regerar; quem entregou volta a clicar "salvar edição" sobre `report_delivered` existente.
  - **Telemetria de abuso:** cada regeneração apende em `regeneration_log` jsonb `{ timestamp, therapist_id, reading_id, model_version, latency_ms, tokens_in, tokens_out, cost_estimate_usd }`. Query agregada `SELECT therapist_id, count(*) FROM (SELECT jsonb_array_elements(regeneration_log) ...) WHERE timestamp > NOW() - interval '30 days' GROUP BY 1 HAVING count(*) > 10` é a base para alerta. **Não bloqueia automaticamente** (terapeuta pode ter razão legítima); apenas sinaliza para revisão founder. Implementação do alerta (e-mail, Slack, ou só log estruturado) — **planner decide**, recomendação: log estruturado console.warn por enquanto, automação fica para Fase 9 polish.

### L2/L3 feedback collection — D-F*

- **D-F1 (schema agora, UI Fase 9):** Migration 0007 inclui `clinical_feedback jsonb`, `exam_notes text`, `feedback_collected_at timestamptz`. **Nenhuma UI nesta fase.** Justificativa: o pré-requisito da Fase 10 é resolução temporal correta dos dados quando começarem a ser coletados; sem schema posicional, dado é perdido. UI/fluxo (e-mail Resend +24h pós `delivered_at`, formulário in-app) será planejado na Fase 9 (polish + dogfooding) onde Resend já entra por ONBOARD-02 e o founder vai usar em consultas reais semanalmente. **Risco zero de bloqueio na entrega da Fase 7.**
- **D-F2 (campos opcionais e null-safe):** Todos os 3 campos NULL por default. Queries de telemetria filtram `WHERE clinical_feedback IS NOT NULL`. Constraints: nenhuma NOT NULL nessa fase.

### Prompt files & versioning — D-PR*

- **D-PR1 (`apps/web/prompts/system.md` + `feature-injection.md` — copiar literal de SPEC §6):** Conteúdo dos dois arquivos é o markdown literal dentro dos blocos ```markdown da SPEC §6 (linhas 511-660). Sem reescrita, sem refinamento — SPEC é fonte da verdade. Comentário no topo de cada arquivo aponta para `SPEC.md §6` e versiona junto: qualquer mudança aqui exige edit coordenado em SPEC.md (ou ADR explícito que sobreponha). **Razão:** founder já validou linguistic/clinical do SPEC; reescrever introduz risco sem ganho.
- **D-PR2 (frozen contract com `lib/rag/section-queries.ts` D-R2B):** `apps/web/lib/anthropic/analyze.ts` chama `retrieveRelevantKnowledge(features, reportSections)` passando um array fixo `['constituicao', 'psicoemocional', 'transgeracional', 'simbolico', 'mental_cognitivo', 'nutricao_carencias', 'mensagem_final']` (7 slugs já existentes em `lib/rag/types.ts`). **Mapeamento 7 slugs → 13 seções do prompt: planner decide** (e.g., seção 8 "Simbólico Espiritual" usa chunks dos slugs `simbolico` + `psicoemocional`; planner pode adicionar slug novo se gap aparecer). Comentário cross-reference em ambos arquivos para falhar code review se sair de sync. CI gate como teste unitário em `lib/rag/section-queries.test.ts` que importa `lib/anthropic/analyze.ts` e valida que todo slug passado existe no Record do template.

### Telemetria + observabilidade — D-T*

- **D-T1 (log estruturado de geração):** Cada chamada bem-sucedida ao Sonnet emite `console.info({ event: 'llm_generate', reading_id, therapist_id, model_version: 'claude-sonnet-4-6', n_chunks_rag: <count>, latency_ms, tokens_in, tokens_out, cost_estimate_usd, anchor_rate_pct, forbidden_vocab_count, sections_completed: 14 })`. **Sem PII** — sem nome de cliente, sem trecho do relatório. `reading_id` e `therapist_id` são UUID; LGPD-compliant porque a tabela mãe está RLS-protected e os logs ficam em Vercel observability (controle interno).
- **D-T2 (modelo configurável via env var):** `process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'` no Route Handler. Permite trocar para `claude-opus-4-7` em test/staging sem deploy de código. Doc em `.env.example`.

### Claude's Discretion

- **Definição exata de "afirmação"** para cálculo do anchor rate (D-A1) — sentence split vs paragraph vs bullet. Recomendação: sentence-split.
- **Protocolo do stream:** SSE (`text/event-stream`) vs plain text chunked (D-S1). Recomendação: plain text chunked com `Transfer-Encoding: chunked`, mais simples e suficiente para o use case (retry é manual de qualquer forma porque LLM é caro pra reiniciar).
- **Lib de markdown rendering no editor** (D-U1): `react-markdown` + `remark-gfm` vs `@uiw/react-md-editor` vs custom. Recomendação: `react-markdown` + `remark-gfm` para preview, `<textarea>` plain para edit (split view); `@uiw/react-md-editor` é forte mas pesa mais no bundle.
- **Lib de diff** (D-U2): `diff` npm (Myers) vs `fast-diff` vs custom. Recomendação: `diff` npm — battle-tested, suporta line/word/char.
- **Threshold 30%** entre "corrigido" e "reescrito" (D-U2) — heurística inicial; pode iterar com base em dogfooding.
- **Ordem das chamadas** dentro do Route Handler (D-S1): paralelizar `retrieveRelevantKnowledge` com `prepare prompt template` ou serial. Paralelo é grátis (RAG é I/O, prompt prep é CPU). Recomendação: `Promise.all`.
- **Naming exato** dos arquivos novos (`analyze.ts`, `prompts/`, etc.) — siga padrão estabelecido nas Fases 5-6 (`lib/vision/`, `lib/rag/`).
- **Estratégia de cache do prompt-base** (`prompts/system.md` é grande, ~2k tokens, cabe Anthropic prompt caching com TTL 5min). Recomendação: usar `cache_control: { type: 'ephemeral' }` no system prompt — economiza ~$0.20 em regenerações dentro de 5min, alinhado com cost target.
- **Trigger UI** do botão "gerar análise" na página `/leituras/[id]` (RSC ou client component) — planner decide. Recomendação: client component pequeno só para o botão + estado de stream; RSC para o restante da página.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prompt-base (LITERAL — copy without modification)
- `SPEC.md` §6 (linhas 509-660) — System prompt + feature-injection template. Conteúdo dos dois arquivos `apps/web/prompts/*.md` deve ser copy-paste literal do que está aqui. Inclui 5 princípios, 13 seções com regras de ancoragem, encerramento literal (SPEC linhas 622-628), tom de voz Aurel Maat.

### Requisitos da Fase 7
- `.planning/REQUIREMENTS.md` — LLM-01 (analyze.ts skeleton + RAG injection), LLM-02 (5 princípios + 13 seções), LLM-03 (ancoragem + disclaimer), LLM-04 (ai_report_raw/edited persistidos)
- `.planning/ROADMAP.md` — Fase 7 Goal + 5 Success Criteria (linhas 90-98 do ROADMAP)
- `.planning/intel/constraints.md` §"Stack — LLM" + §"Prompt Contract" + §"NFR — Product Positioning Disclaimer" — proibições, estrutura, custo
- `.planning/intel/context.md` §"Topic: Affirmation style and tone" — estilo Aurel Maat para seção 11

### Pré-requisito Fase 10 (Sistema de Aprendizagem Clínica / SAC)
- `.planning/phases/10-aprendizagem-clinica/10-CONTEXT.md` §"Dado mais valioso a capturar — implementar JÁ na Fase 7" — schema dos campos obrigatórios. **Esta fase entrega TODO o schema (D-P2); UI fica para Fase 9.**

### Schema atual + migration target
- `apps/web/types/database.ts` linhas 186-251 — shape atual de `readings` (Row/Insert/Update). Migration 0007 muda este arquivo via `pnpm gen:types`.
- `supabase/migrations/0001_initial_schema.sql` linhas 32-62 — definição original de `readings`, status enum (pending|processing|ready|failed|edited), is_delivered/delivered_at já existentes.
- `supabase/migrations/0005_knowledge_chunks_content_hash_and_source_type.sql` — modelo de migration ALTER TABLE com função IMMUTABLE (referência de estilo para a 0007).
- `supabase/migrations/` — diretório completo (próximo número livre = 0007).

### RAG retrieval (Fase 6 — contrato fechado, NÃO mexer)
- `apps/web/lib/rag/search.ts` — `retrieveRelevantKnowledge(args)` assinatura. Auth strategy padrão `'session'`; analyze.ts deve usar essa.
- `apps/web/lib/rag/types.ts` — `ReportSection` enum (7 slugs) + `KnowledgeChunkRow` (consumir, não mudar).
- `apps/web/lib/rag/section-queries.ts` — D-R2B "frozen contract for Fase 7"; cross-reference com `lib/anthropic/analyze.ts` (D-PR2).
- `.planning/phases/06-rag-ingestao/06-CONTEXT.md` §Retrieval contract D-R1..R6 — semântica do retrieval (cap 30, pesos, latência ≤3s).

### Vision pipeline (Fase 5 — features são input)
- `apps/web/lib/rag/build-queries.ts` linhas 22-37 — `IrisFeaturesForRag` interface (constitution, sectors, findings). Subset documentado, mas para o prompt o LLM recebe o JSON completo de `vision_features` (planner verifica shape canônico).
- `vision-service/data/jensen-map.json` — mapa setorial pt-BR para LLM citar nomes de órgãos por setor (`h7=fígado`, `h9=coração esquerdo`).
- `.planning/phases/05-pipeline-visao-modal/05-CONTEXT.md` §D-T4 — webhook só sobrescreve se status='processing'; protege ai_report_edited tardio (mantém-se válido para report_delivered).

### Padrões de auditoria LGPD reusáveis
- `apps/web/scripts/audit-vocabulary.mjs` — script estático; estender DIRS para `'lib/anthropic'` (D-A4). Pattern atual `/diagnóstico|tratamento|cura/i` (D-A2 endurece para word-boundary `\b...\b`).
- `apps/web/scripts/audit-vocabulary-db.mjs` — auditoria runtime sobre tags_livres dos chunks (referência para auditoria runtime sobre report_generated/delivered).
- `vision-service/scripts/audit_vocabulary.py` — paridade Python (não consumida na Fase 7, mas referência de pattern).

### Standards do projeto
- `apps/web/CLAUDE.md` (se existir) — guidelines pt-BR, vocabulário proibido
- `package.json` (raiz) — scripts `audit:vocabulary*` (existentes); plan adiciona `pnpm rag:spot-check` se planner achar útil para análise (provavelmente não — geração é per-reading, não bulk)
- `apps/web/package.json` — `@anthropic-ai/sdk@^0.92.0` já instalado, `voyageai@^0.2.1`, sem `react-markdown` ainda (planner adiciona se confirmar D-U1 recomendação), sem `diff` (planner adiciona)
- `vercel.json` — região `gru1`, function timeout configuration (verificar se 5min do D-S3 cabe; Fluid Compute default 300s OK)

### Rotas e UI existentes (pattern reference)
- `apps/web/app/(dashboard)/leituras/page.tsx` — lista; planner adiciona link/CTA "ver análise" para readings com `status='ready'|'edited'`
- `apps/web/app/(dashboard)/leituras/nova/upload/upload-client.tsx` — pattern de Server Action + estado client + sonner toast (referência para editar-client.tsx)
- `apps/web/components/readings/StatusBadge.tsx` — badge atual (`pending|processing|ready|failed|edited|rascunho`); planner verifica se cobre estados intermediários do streaming (sugestão: badge "gerando…" cliente-side durante stream, sem persistir status novo)
- `apps/web/app/api/vision/webhook/route.ts` — pattern de Route Handler + Supabase service-role (não usar service-role na analyze; usar session per D-S1)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`apps/web/lib/rag/search.ts` `retrieveRelevantKnowledge`** — chamar como caixa-preta com `auth: 'session'`. Retorna `KnowledgeChunkRow[]` ordenado por score; analyze.ts concatena `chunks.map(c => \`[${c.source_book}, p.${c.page}] ${c.text}\`).join('\\n\\n')` para o `<knowledge>` do feature-injection template.
- **`@anthropic-ai/sdk@^0.92.0`** já instalado em `apps/web/package.json`. Suporta `client.messages.stream({ model, system, messages, max_tokens })` com `cache_control: { type: 'ephemeral' }` no system prompt para prompt caching (TTL 5min — economiza ~90% custo em regenerações dentro da janela).
- **`apps/web/lib/supabase/server.ts` `createClient()`** — server-side Supabase com cookies (RLS aplicado). Usar para load do reading + persistência incremental no Route Handler.
- **Sonner toast (`sonner@^2.0.7`)** — feedback de sucesso/erro de "salvar edição" e "entregar".
- **`apps/web/components/ui/`** — shadcn primitives (Card, Button, Textarea, Badge); `Collapsible` ou `Accordion` ainda não instalados — `pnpm dlx shadcn@latest add accordion` ou `collapsible` como parte do plan UI.
- **`apps/web/components/readings/StatusBadge.tsx`** — extender para variante "gerando…" (cliente-side, não persiste status novo).

### Established Patterns

- **Vocabulário proibido auditado em CI:** padrão das Fases 3+ replicado nesta fase (D-A4); `lib/anthropic/` entra no DIRS. Note: `prompts/system.md` cita as palavras proibidas para o LLM evitar — esse arquivo é exceção justificada e fica fora do scan ou ganha allowlist comment-marker no estilo do D-N6 da Fase 6.
- **Migration ALTER TABLE com função IMMUTABLE:** `0005_knowledge_chunks_content_hash_and_source_type.sql` é o template estilo para a 0007. SQL idempotente quando possível (`ADD COLUMN IF NOT EXISTS` para não-canônicos; o DROP de ai_report_raw/edited e re-ADD GENERATED é one-shot — colocar em transação).
- **Telemetria estruturada `console.info({ event: ... })`** sem PII (D-T1) — mesmo pattern do `lib/rag/search.ts` D-N4.
- **`'use server'` em Server Actions, `import 'server-only'` em libs:** `lib/anthropic/analyze.ts` deve declarar `import 'server-only'` no topo, igual `lib/rag/search.ts`.
- **`ReadingStatus` type em `components/readings/StatusBadge.tsx`** — fonte da verdade do enum no client; coordenar com qualquer mudança em D-P4 (não há mudança).
- **Route Handler com auth gate em todas as actions de reading:** Fase 5 webhook + Fase 6 spot-check seguem o padrão. analyze deve checar (a) user logado, (b) reading.therapist_id === user.id, (c) reading.status === 'ready', (d) reading.report_delivered IS NULL para regeneração, (e) reading.regeneration_count < 3.

### Integration Points

- **Trigger:** botão "gerar análise" em `/leituras/[id]` (page nova ou extensão da page de detalhe que ainda não existe — planner verifica). POST para `/api/readings/[id]/analyze` com Bearer (cookie session). Stream lido pelo cliente; UI re-fetcha ao final do stream para renderizar `report_generated` e `audit_metadata`.
- **Editor:** `/leituras/[id]/editar` (rota nova). RSC carrega reading via Supabase server client. Client component recebe props `reportGenerated`, `reportDelivered`, `auditMetadata`. Server Action `saveReportDelivered` consome no submit.
- **Entrega:** Server Action `markReadingDelivered(readingId)` — flip `is_delivered=true`, `delivered_at=NOW()`. Reusa pattern do `cleanupStaleEmptyReadingsAction` em `app/actions/readings.ts`.
- **Lista de leituras:** `/leituras/page.tsx` — adicionar coluna/CTA "ver/editar análise" para readings com `status IN ('ready','edited')`. StatusBadge já cobre os estados.
- **Webhook da Fase 5** (`/api/vision/webhook/route.ts`): D-T4 (status guard) garante que processing tardio não sobrescreve `report_delivered` (jsonb agora, mas mesma proteção lógica). Verificar/atualizar comentário inline que menciona `ai_report_edited` para mencionar `report_delivered`.

</code_context>

<deferred>
## Deferred Ideas

- **UI de coleta de feedback L2/L3** (`clinical_feedback` 24h pós-sessão via lembrete Resend; formulário in-app de `exam_notes`) — schema entra agora (D-F1), UI vai para **Fase 9** (polish + dogfooding) onde Resend já entra por ONBOARD-02.
- **Geração de PDF do relatório entregue** (assinatura digital, watermark) — **Fase 8** (junto com o termo de consentimento LGPD-01 que já precisa de PDF). Reusa pipeline lá.
- **Auto-trigger da análise** após webhook da Fase 5 marcar `status='ready'` (sem clique do terapeuta) — **Fase 9** se UAT pedir; por ora, dispara manual.
- **Alerta automático** (e-mail/Slack) quando regenerações por terapeuta/mês > 10 — **Fase 9** (D-S4 telemetria fica como log estruturado por enquanto).
- **Análise temporal evolutiva** (comparar relatórios do mesmo cliente ao longo do tempo) — **v2** (PROJECT.md "Fora de escopo").
- **Multi-mapa simultâneo** (Jensen + Hidalgo + Jausas comparativos no mesmo relatório) — **v2** (PROJECT.md "Fora de escopo"; locked-out).
- **Reranking ou ajuste do RAG retrieval** — contrato Fase 6 fechado (D-R1, D-N2); reabrir só se UAT da Fase 7 mostrar ruído sistemático.
- **Edição de `vision_features` pelo terapeuta** (corrigir constituição, marcar lacuna que pipeline não pegou) — fora; **Fase 5 D-T4** mantém edição apenas em report_delivered.
- **HyDE para queries Família B** — deferido na Fase 6 D-N3; reabrir se análises Fase 7 mostrarem gap em seções abstratas (psicoemocional, transgeracional, simbólico).
- **Treinamento de heurísticas / scoring clínico próprio** — **Fase 10**. Aqui só o terreno.
- **Versão automatizada do prompt** (ajustar `prompts/system.md` baseado em diffs aprendidos) — **Fase 10** ("calibra o prompt do Sonnet automaticamente"). Aqui prompt é estático.
- **Scheduled background job** para re-rodar `audit_metadata` em readings antigas com `auditor_version` antiga — sem necessidade no MVP; quando criar v2 do auditor, decidir.
- **Streaming de progresso de seções no editor** (mostrar quais das 13 seções já chegaram em real-time durante a geração) — D-S2 já viabiliza (jsonb parcial é legível); UI rica fica como polish na Fase 9.
- **Naming "SAC" vs "Sistema de Aprendizagem Clínica":** founder usou "SAC" (Sistema de Aprendizado Constante) na discussão; Phase 10 CONTEXT chama "Sistema de Aprendizagem Clínica". Convergir nomenclatura ao iniciar plan-phase 10. Sem ação na Fase 7.

</deferred>

---

*Phase: 07-analise-llm*
*Context gathered: 2026-05-06 via founder discuss-phase (4 áreas + 2 follow-ups; decisões locked em D-A1..A4, D-P1..P4, D-PR1..PR2, D-U1..U3, D-S1..S4, D-F1..F2, D-T1..T2)*
