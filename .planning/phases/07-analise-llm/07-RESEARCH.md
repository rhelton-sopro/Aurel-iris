# Phase 7: Análise LLM - Research

**Researched:** 2026-05-08
**Domain:** LLM streaming generation (Anthropic SDK) + Next.js 15 Route Handler streaming + section-boundary jsonb persistence + per-section markdown editor with diff classification
**Confidence:** HIGH (verified Anthropic API + Next.js docs + project files; CONTEXT.md decisions already locked by founder)

## Summary

Fase 7 transforma `readings.vision_features` (Fase 5) + chunks RAG (Fase 6 frozen contract) em relatório iridológico de 13 seções via Claude Sonnet 4.6 com streaming, persiste em `report_generated`/`report_delivered` jsonb (migration 0007 substitui as colunas text antigas mantendo retrocompat via `GENERATED ALWAYS AS … STORED`), executa auditoria pós-geração não-bloqueante (anchor rate ≥95% nas seções 2-6 + vocabulário LGPD-06), e expõe editor de 13 seções colapsáveis com cálculo automático de `edit_diff` ao salvar. Schema da Fase 10 (SAC) entra junto, sem UI.

A camada server reusa contratos consolidados: `lib/rag/search.ts` (D-PR2 frozen — fase 6), `lib/supabase/server.ts` (session auth), prompt files são copy-paste literal do SPEC.md §6 linhas 511-660 (D-PR1, sem reescrita). A camada cliente herda o design system shadcn (UI-SPEC v1 aprovado 6/6 PASS, Accordion novo + reusos de Card/Button/Alert/Progress/Skeleton/Textarea/Dialog/Tooltip/Sonner).

Streaming usa o helper `client.messages.stream({...})` do `@anthropic-ai/sdk@^0.92.0` (já instalado) com `cache_control: { type: 'ephemeral' }` no system block — 90% de redução de custo dentro da janela de 5min, baseline de 2048+ tokens (system.md tem ~2k). Section-boundary parsing por regex `/^### (\d{1,2})\.\s+/m` sobre buffer acumulado, com 14 writes por geração (13 seções + disclaimer literal appendado pelo servidor, não pelo LLM).

**Primary recommendation:** Implementar como Route Handler `app/api/readings/[id]/analyze/route.ts` retornando `Response(readableStream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked', 'X-Content-Type-Options': 'nosniff' } })`, com `export const runtime = 'nodejs'` e `export const maxDuration = 300`. Streaming server lê eventos do SDK Anthropic via `for await ... of stream`, encoda chunks de texto via `TextEncoder`, mantém buffer `accumulated += delta` e a cada vez que detecta `^### N. ` faz `UPDATE readings SET report_generated = jsonb_set(...)` na seção anterior completada. Cliente usa `fetch()` + `ReadableStream.getReader()` para renderizar progress (UI-SPEC State B). Migration 0007 cria função SQL `jsonb_concat_sections_pt_br(jsonb)` IMMUTABLE + duas colunas GENERATED STORED. Editor RSC + client component com shadcn Accordion 13 itens; Server Action `saveReportDelivered` roda diff via `diff@9` (`diffWords` em paralelo por seção, char-delta-pct para classificação 30%) e auditoria LGPD que **bloqueia** o save em caso de hit (D-A2).

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Output enforcement (D-A1..A4):**
- Auditoria pós-geração **não-bloqueante** para anchor rate (≥95% nas seções 2-6) e vocabulário LGPD-06 (`\b(diagnóstico|tratamento|cura)\b`). Falha → banner persistente no editor + `audit_metadata.low_anchor_rate=true` ou `audit_metadata.forbidden_vocab=[...]`. **Não regenera silenciosamente, não bloqueia entrega.**
- Vocabulário LGPD ao **salvar edição** (D-A2): mesma regex sobre `report_delivered` **bloqueia** o save com mensagem clara. Geração não-bloqueia; edição/entrega exige limpo.
- `audit_metadata` jsonb dedicado (`{low_anchor_rate, anchor_rate_pct, anchor_rate_per_section, forbidden_vocab[], audited_at, auditor_version}`); coluna re-auditável a qualquer momento.
- `pnpm audit:vocabulary` script (`apps/web/scripts/audit-vocabulary.mjs`) ganha `'lib/anthropic'` no array `DIRS`. `prompts/system.md` é exceção justificada (cita as palavras proibidas para o LLM evitar) — fica fora ou ganha allowlist comment.

**Schema migration 0007 (D-P1..P4):**
- `ALTER TABLE readings DROP ai_report_raw, DROP ai_report_edited, ADD report_generated jsonb, ADD report_delivered jsonb, ADD ai_report_raw text GENERATED ALWAYS AS (jsonb_concat_sections_pt_br(report_generated)) STORED, ADD ai_report_edited text GENERATED ALWAYS AS (jsonb_concat_sections_pt_br(report_delivered)) STORED;`
- Função `jsonb_concat_sections_pt_br(jsonb) RETURNS text` IMMUTABLE faz concat ordenado de chaves `1_constituicao`…`13_mensagem_final` + `encerramento_disclaimer` separadas por `\n\n`.
- Pré-requisito Fase 10 entra na mesma migration: `report_generated_at`, `report_delivered_at`, `edit_diff`, `zonas_editadas`, `tipo_edicao`, `clinical_feedback`, `exam_notes`, `feedback_collected_at`, `audit_metadata`, `regeneration_count`, `regeneration_log`.
- Shape canônico jsonb: chaves `1_constituicao`…`13_mensagem_final` + `encerramento_disclaimer` (string literal SPEC §6 linhas 622-628, appendada programaticamente após stream fechar — não gerada pelo LLM).
- Status enum **inalterado** (`pending|processing|ready|failed|edited`). Geração não vira `processing` (esse status é Fase 5). Botão "regenerar" gated por `report_delivered IS NULL AND regeneration_count < 3`.

**Editor UX (D-U1..U3):**
- 13 seções colapsáveis editáveis individualmente (Accordion shadcn — UI-SPEC já aprovou). Encerramento aparece colapsado/somente-leitura.
- Server Action `saveReportDelivered`: classifica cada chave em `adicionado` (vazio→texto), `removido` (texto→vazio), `corrigido` (<30% mudança), `reescrito` (≥30%). Persiste `edit_diff` jsonb + `zonas_editadas` jsonb + `tipo_edicao` text[].
- Lib de diff: `diff` npm (Myers).
- Botões "salvar edição" e "entregar ao cliente" são **distintos** (D-U3). Salvar = `status='edited'`, `report_delivered_at=NOW()`. Entregar = `is_delivered=true`, `delivered_at=NOW()`, congela registro.

**Streaming + cost guards (D-S1..S4):**
- Route Handler `app/api/readings/[id]/analyze/route.ts` POST + Web Streams API. **NÃO Server Action streamable.**
- Auth via `createClient` server-side + RLS check em `readings`. Anthropic SDK em modo streaming.
- Persistência incremental por **section-boundary** (regex `^### (\d{1,2})\.\s+`), **NÃO por delta event**. 14 writes por geração.
- Disclaimer literal appendado pelo Route Handler ao fim do stream (encerramento garantido SC4).
- Timeout total 5min (`maxDuration = 300`). Anthropic SDK retry interno = 2.
- Cap regeneração: `regeneration_count >= 3` → 409. `report_delivered IS NOT NULL` → 409. Telemetria por terapeuta/mês em `regeneration_log` jsonb (alerta >10/mês = log estruturado nesta fase; automação é Fase 9).

**Prompt files (D-PR1, D-PR2):**
- `apps/web/prompts/system.md` + `apps/web/prompts/feature-injection.md` são **copy-paste literal** de SPEC.md §6 linhas 511-660. Sem reescrita. Comentário no topo aponta para SPEC.md §6.
- Frozen contract com `lib/rag/section-queries.ts` (D-R2B): `analyze.ts` chama `retrieveRelevantKnowledge({features, reportSections})` passando array fixo dos 7 slugs existentes em `lib/rag/types.ts`. Mapeamento 7 slugs → 13 seções **planner decide** (várias seções compartilham slug). Mudança em slugs força mudança em ambos arquivos. CI gate: teste em `lib/rag/section-queries.test.ts` valida que todo slug passado existe no Record.

**Telemetria (D-T1, D-T2):**
- `console.info({ event: 'llm_generate', reading_id, therapist_id, model_version, n_chunks_rag, latency_ms, tokens_in, tokens_out, cost_estimate_usd, anchor_rate_pct, forbidden_vocab_count, sections_completed: 14 })`. Sem PII (sem nome de cliente, sem trecho do relatório).
- Modelo via `process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'`. Doc em `.env.example`.

### Claude's Discretion

1. **Definição exata de "afirmação"** para anchor rate: sentence-split (recomendação CONTEXT) vs paragraph vs bullet. → **Recomendação reforçada**: sentence-split via `text.split(/[.!?]+(?=\s|$)/)` filtrando vazios; mais granular, mais defensável, e sentenças em pt-BR são unidades de afirmação clínica.
2. **Protocolo de stream**: SSE vs plain text chunked. → **Recomendação CONTEXT**: plain `text/plain; charset=utf-8` com `Transfer-Encoding: chunked` + `Cache-Control: no-cache, no-transform` + `X-Content-Type-Options: nosniff`. SSE adiciona overhead de framing (`data: ...\n\n`) sem retry nativo útil aqui.
3. **Lib de markdown**: `react-markdown@10` + `remark-gfm@4` (preview pane only) + `<Textarea>` plain (edit). UI-SPEC já bloqueou esse caminho.
4. **Lib de diff**: `diff@9` (Myers, `diffWords` para texto pt-BR — quebra em palavras + pontuação). 0 deps. ESM + CJS. TS types incluídos.
5. **Cache strategy**: `cache_control: { type: 'ephemeral' }` no system block. TTL 5min default.
6. **Section-boundary parsing**: regex `^### (\d{1,2})\.\s+` em modo `m` (multiline) sobre `accumulated` (não delta). Em cada match nova seção, fecha a anterior, faz `jsonb_set` da chave correspondente, atualiza ponteiro.
7. **Streaming API**: `client.messages.stream({...})` com `for await (const event of stream)` + verificação `event.type === 'content_block_delta'` para extrair `delta.text`.
8. **Web Streams + Next.js 15**: padrão `Response(new ReadableStream({ async start(controller) { ... } }))` com `controller.enqueue(encoder.encode(...))` confirmado pela docs Next.js 15.
9. **Vercel Fluid Compute**: streaming é first-class no `nodejs` runtime; `maxDuration` Pro plan = 800s, default 300s — 300s suficiente.
10. **Markdown editor UX**: Vertical stack (Textarea acima, preview abaixo) por Accordion item. UI-SPEC já lockou.
11. **GENERATED ALWAYS AS STORED + IMMUTABLE function**: Postgres 14+ suporta; Supabase corre Postgres 15. Função IMMUTABLE marca o bloco como ok-for-generated. Custo: write na coluna jsonb dispara recálculo do text — barato ao volume MVP.
12. **Function impl**: `SELECT string_agg(value, E'\n\n' ORDER BY key) FROM jsonb_each_text(report_generated)` ordenado por key prefix numérico (`1_`…`13_` ordenam corretamente lexicograficamente sem padding zero, EXCETO `13_` < `2_`; **planner deve usar zero-padded `01_`…`13_` OU custom ORDER BY numérico**). → **Recomendação**: ORDER BY com cast: `ORDER BY (regexp_match(key, '^(\d+)_'))[1]::int NULLS LAST, key`. NULLS LAST garante `encerramento_disclaimer` vai por último.
13. **Validation Architecture**: ver seção dedicada abaixo.

### Deferred Ideas (OUT OF SCOPE)

- UI de coleta L2/L3 (`clinical_feedback`, `exam_notes`) — schema entra agora, UI Fase 9.
- Geração de PDF do relatório — Fase 8 (junto com termo LGPD-01).
- Auto-trigger da análise pós-Fase 5 — Fase 9 polish se UAT pedir.
- Alerta automático regenerações>10/mês — Fase 9 (D-S4 telemetria fica como log estruturado).
- Análise temporal evolutiva — v2 (PROJECT.md fora de escopo).
- Multi-mapa simultâneo — v2 locked-out.
- Reranking ou ajuste do RAG retrieval — contrato Fase 6 fechado (D-R1, D-N2).
- Edição de `vision_features` pelo terapeuta — Fase 5 D-T4 fixa: edição só em report_delivered.
- HyDE para queries Família B — deferido na Fase 6 D-N3.
- Treinamento de heurísticas — Fase 10.
- Versão automatizada do prompt — Fase 10.
- Scheduled background re-audit — sem necessidade no MVP.
- Streaming de progresso de seções no editor (real-time) — D-S2 viabiliza, UI rica é Fase 9 polish.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **LLM-01** | `lib/anthropic/analyze.ts` carrega features, chama `retrieveRelevantKnowledge`, monta prompt com `prompts/system.md` + `prompts/feature-injection.md` (`<client_context>`, `<features>`, `<knowledge>`) e chama Claude Sonnet 4.6 com streaming em pt-BR | Anthropic SDK `client.messages.stream({...})` (HIGH); `lib/rag/search.ts` frozen Fase 6 (HIGH); SPEC §6 linhas 638-660 contém o template literal feature-injection (HIGH); `'claude-sonnet-4-6'` é o ID API correto verificado em platform.claude.com/docs/models (HIGH) |
| **LLM-02** | Prompt-base impõe os 5 princípios + 13 seções numeradas (Constituição → Mensagem Final) | SPEC §6 linhas 511-636 lista 5 princípios (linhas 521-545) + 13 seções (linhas 558-620). D-PR1 manda copy-paste literal — sem reescrita (HIGH) |
| **LLM-03** | Toda interpretação cita `[ancorado em: features.X]`; disclaimer literal de encerramento (SPEC §6) aparece em todo relatório | Encerramento literal SPEC linhas 622-628 (HIGH); disclaimer **appendado pelo servidor** após stream fechar — D-S2 garante presença mesmo com falha tardia (MEDIUM); auditoria pós-geração D-A1 valida regex `\[ancorado em: features\.[\w.\[\]]+\]` em seções 2-6 (HIGH) |
| **LLM-04** | Resposta crua persistida em `readings.ai_report_raw`; UI de edição grava em `readings.ai_report_edited`; status passa a `edited` quando salvo | D-P1 mantém contrato sintático via `GENERATED ALWAYS AS … STORED` columns reconstruindo text a partir do jsonb canônico; D-U2 Server Action `saveReportDelivered` carimba `status='edited'` (HIGH) |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Trigger CTA "gerar análise" + listening do stream | Browser (client component) | — | Estado efêmero da UI durante stream (progress bar, sections checklist); pequeno componente client em `/leituras/[id]` |
| Auth check + RLS (Supabase session) | Frontend Server (Route Handler) | — | `createClient` lê cookies; rejeita anônimos antes de chamar Anthropic |
| RAG retrieval (`retrieveRelevantKnowledge`) | Frontend Server | — | Server-only (`import 'server-only'`); usa session-bound Supabase client; já implementado Fase 6 |
| LLM call (Anthropic Sonnet 4.6 streaming) | Frontend Server (Route Handler) | — | API key no servidor; chamada via `@anthropic-ai/sdk@^0.92.0`; **NUNCA** Browser (CONTEXT.md proíbe `dangerouslyAllowBrowser`) |
| Section-boundary parsing + persistência incremental | Frontend Server | Database (jsonb_set) | Parser detecta `^### N. ` em buffer acumulado; cada match dispara UPDATE com `jsonb_set` |
| Encerramento disclaimer append | Frontend Server | — | String literal SPEC §6 — não vem do LLM. Servidor escreve `report_generated.encerramento_disclaimer` após stream completar |
| Audit pós-geração (anchor rate + LGPD vocab) | Frontend Server | — | Roda sobre `report_generated` cru após stream fechar; persiste `audit_metadata` jsonb; renderiza banners no editor RSC |
| Editor 13 seções (display + edit) | Browser (client component) | Frontend Server (RSC) | RSC carrega jsonb props; client component renderiza Accordion + Textarea + preview markdown |
| Markdown rendering (preview pane) | Browser | — | `react-markdown` + `remark-gfm` server-renderable mas livre para client; UI-SPEC manda para preview pane only |
| Diff classification | Frontend Server (Server Action) | — | `diff@9` é server-only (Node.js Crypto-free, mas mantém server-only por convenção e pra reduzir bundle) |
| Audit LGPD ao salvar edição | Frontend Server (Server Action) | — | Bloqueia save com erro se hit |
| Markar entregue ao cliente | Frontend Server (Server Action) | Database | Single UPDATE: `is_delivered=true`, `delivered_at=NOW()` |
| Regeneration counter + telemetry | Frontend Server | Database | `regeneration_count` increment + `regeneration_log` append; hard-guard server-side em 3 |
| Listing CTA "ver/editar análise" | Frontend Server (RSC) | — | Estende `/leituras/page.tsx` com link condicional baseado em `status IN ('ready', 'edited')` + `report_generated IS NOT NULL` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | `^0.92.0` (project-pinned; latest registry = 0.95.1) `[VERIFIED: npm view 2026-05-08]` | Streaming messages API + prompt caching `cache_control` | Já instalado; CONTEXT D-PR2 manda usar este SDK; `client.messages.stream({...})` é o helper recomendado pelos docs Anthropic `[CITED: platform.claude.com/docs/api/sdks/typescript]` |
| `react-markdown` | `^10.1.0` `[VERIFIED: npm view 2026-05-08, published 2024]` | Render markdown preview no editor de seções | UI-SPEC v1 aprovado bloqueou essa lib; ~30KB gzip; React 19 compat (peer dep `@types/hast`/`mdast` v3/v4 OK) |
| `remark-gfm` | `^4.0.1` `[VERIFIED: npm view 2026-05-08]` | GFM tables, strikethrough, autolinks (citações `[ancorado em: features.X]` renderizam como `<code>`) | UI-SPEC bloqueou; ~15KB gzip; mesma família remark/unified que react-markdown@10 |
| `diff` | `^9.0.0` `[VERIFIED: npm view 2026-05-08, published há 3 semanas]` | Server-side per-section diff classification (D-U2) | Battle-tested (10+ anos); zero deps; ESM+CJS; TS types incluídos desde v8; `diffWords` ideal para texto pt-BR (quebra em palavras + pontuação) `[CITED: github.com/kpdecker/jsdiff README]` |

**Modelo Claude:** `'claude-sonnet-4-6'` é o ID API alias **e** ID literal — formato dateless, snapshot pinned (não evergreen). $3/MTok input, $15/MTok output, 1M context, 64k max output, knowledge cutoff Aug 2025. `[CITED: platform.claude.com/docs/about-claude/models]`

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@radix-ui/react-accordion` | (transitive via `pnpm dlx shadcn@latest add accordion`) | Accordion primitive para 13 seções colapsáveis | UI-SPEC manda; `pnpm dlx shadcn@latest add accordion` |
| `sonner` | `^2.0.7` (já instalado) | Toasts: "Análise gerada", "Edição salva", "Não foi possível salvar (vocab)" | Pattern Fase 4-6 estabelecido |
| `zod` | `4.4.1` (já instalado) | Schema validation no Server Action `saveReportDelivered` (jsonb shape canônico) | Pattern Fase 5-6 |
| `@supabase/ssr` | `0.10.2` (já instalado) | `createClient` server-side com cookies + RLS | `lib/supabase/server.ts` existing |
| Existing: `lib/rag/search.ts`, `lib/rag/types.ts`, `lib/rag/section-queries.ts` | frozen Fase 6 | RAG retrieval | D-PR2 frozen contract; consumir como caixa-preta |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain text chunked | SSE (`text/event-stream`) | SSE dá retry nativo do browser e EventSource API, MAS LLM caro pra reiniciar (retry manual via UI já é o pattern); SSE adiciona overhead de framing `data: ...\n\n`. **CONTEXT recomenda chunked**, esta pesquisa concorda |
| `react-markdown` + `<Textarea>` | `@uiw/react-md-editor` (split-view embutido) | Pesa mais bundle (~80KB), depende de `@uiw/react-markdown-preview` + `codemirror`; UI-SPEC já decidiu contra |
| `diff@9` `diffWords` | `fast-diff` ou `diff-match-patch` | `fast-diff` é menor mas só char-level; `diff-match-patch` é Google legado, sem TS types modernos; `diff@9` ganha por TS-native + ESM/CJS dual + manutenção ativa |
| Section-boundary regex | LLM streaming `tool_use` com schema jsonb | Sonnet seguirá `### N.` por estar no system prompt SPEC §6; tool_use força mudar prompt e perde fidelidade ao prompt validado pelo founder |
| Server Action streamable (Next.js 15+) | `Response(stream)` Route Handler | Server Action streamable abstrai demais, dificulta D-S2 incremental persistence + abort. CONTEXT D-S1 já rejeitou |

**Installation:**
```bash
cd apps/web
pnpm add react-markdown@^10 remark-gfm@^4 diff@^9
pnpm add -D @types/diff   # NOTE: types ship com diff@9, mas testar — se redundante remover
pnpm dlx shadcn@latest add accordion
```

**Version verification (npm registry, 2026-05-08):**
- `@anthropic-ai/sdk@0.95.1` (project pinned to ^0.92.0; OK — minor bump compatible)
- `react-markdown@10.1.0` (latest)
- `remark-gfm@4.0.1` (latest)
- `diff@9.0.0` (published há ~3 semanas, latest)

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Browser (terapeuta on /leituras/[id])                                       │
│                                                                              │
│  [Gerar análise] click → fetch('/api/readings/[id]/analyze', POST)          │
│                          ↓                                                   │
│         ReadableStream.getReader() → renders progress bar (sections N/13)   │
│                                                                              │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ HTTP POST (auth cookie)
                               ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ Frontend Server: Route Handler                                               │
│ app/api/readings/[id]/analyze/route.ts (runtime: nodejs, maxDuration: 300)  │
│                                                                              │
│  ┌─ 1. Auth gate ─────────────────────┐                                     │
│  │  createClient() + auth.getUser()   │                                     │
│  │  + RLS reading.therapist_id check  │                                     │
│  │  + status='ready' check            │                                     │
│  │  + report_delivered IS NULL        │                                     │
│  │  + regeneration_count < 3          │                                     │
│  └────────────────┬───────────────────┘                                     │
│                   ↓                                                          │
│  ┌─ 2. Prepare prompt (parallel via Promise.all) ──────────────────────┐    │
│  │  • Load reading.vision_features                                      │    │
│  │  • Read prompts/system.md + prompts/feature-injection.md (FS read)   │    │
│  │  • retrieveRelevantKnowledge({features, reportSections}) ────┐       │    │
│  │     ↓ (frozen Fase 6 — D-PR2)                                ↓       │    │
│  │  ┌──── lib/rag/search.ts ────────────────────────────────────┐ │     │    │
│  │  │ buildFamilyA + buildFamilyB → embedTexts (Voyage) →       │ │     │    │
│  │  │ match_knowledge_chunks RPC → dedup → rerank → weights →   │ │     │    │
│  │  │ cap 30 → KnowledgeChunkRow[] (≤15k tokens)                 │ │     │    │
│  │  └────────────────────────────────────────────────────────────┘ │     │    │
│  │  • Concat chunks for <knowledge> block                          │       │    │
│  │  • Inject features JSON + client_context into feature-injection │       │    │
│  └─────────────────────────────────────────────┬────────────────────┘     │    │
│                                                  ↓                          │    │
│  ┌─ 3. Anthropic stream ──────────────────────────────────────────────┐    │
│  │  client.messages.stream({                                          │    │
│  │    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',     │    │
│  │    max_tokens: 16000,  // ~13 sections × ~1k tokens cada          │    │
│  │    system: [{                                                      │    │
│  │      type: 'text',                                                 │    │
│  │      text: <system.md content>,                                   │    │
│  │      cache_control: { type: 'ephemeral' }   // 5min TTL            │    │
│  │    }],                                                             │    │
│  │    messages: [{ role: 'user', content: <feature-injection> }]      │    │
│  │  })                                                                │    │
│  └────────────────────┬───────────────────────────────────────────────┘    │
│                       ↓ for await event                                     │
│  ┌─ 4. Section-boundary parser + dual write ────────────────────────────┐  │
│  │  let buffer = ''                                                      │  │
│  │  let currentSectionKey: '1_constituicao' | … | null = null           │  │
│  │  for await (event of stream):                                         │  │
│  │    if (event.type === 'content_block_delta') {                        │  │
│  │      const text = event.delta.text                                    │  │
│  │      buffer += text                                                   │  │
│  │      // Stream chunk to client (UI progress)                          │  │
│  │      controller.enqueue(encoder.encode(text))                         │  │
│  │      // Detect ALL ### N. boundaries in buffer (regex `^### (\d{1,2})\.\s+`m)
│  │      // Each new boundary closes previous section + writes jsonb_set  │  │
│  │      // 14 writes total (13 sections + disclaimer literal at end)     │  │
│  │    }                                                                  │  │
│  └─────────────────────┬─────────────────────────────────────────────────┘  │
│                        ↓                                                     │
│  ┌─ 5. Post-stream finalization ────────────────────────────────────────┐  │
│  │  • UPDATE readings SET                                                │  │
│  │      report_generated = jsonb_set(report_generated,                   │  │
│  │                                    '{encerramento_disclaimer}',       │  │
│  │                                    to_jsonb($literal_disclaimer)),    │  │
│  │      report_generated_at = NOW(),                                     │  │
│  │      regeneration_count = regeneration_count + 1,                     │  │
│  │      regeneration_log = regeneration_log || jsonb_build_object(...)   │  │
│  │    WHERE id = $reading_id                                             │  │
│  │  • Audit anchor rate (sections 2-6) + forbidden vocab                 │  │
│  │  • UPDATE readings SET audit_metadata = $audit_jsonb                  │  │
│  │  • console.info({ event: 'llm_generate', ... })                       │  │
│  │  • controller.close()                                                 │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Response(stream, {                                                          │
│    headers: { 'Content-Type': 'text/plain; charset=utf-8',                   │
│              'Cache-Control': 'no-cache, no-transform',                     │
│              'X-Content-Type-Options': 'nosniff' }                          │
│  })                                                                          │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ Database (Supabase Postgres)                                                 │
│                                                                              │
│  readings table (after migration 0007):                                      │
│  • report_generated jsonb           ← 14 incremental writes                  │
│  • report_delivered jsonb           ← Server Action saveReportDelivered     │
│  • ai_report_raw text GENERATED ALWAYS AS (                                  │
│      jsonb_concat_sections_pt_br(report_generated)) STORED                   │
│  • ai_report_edited text GENERATED ALWAYS AS (                               │
│      jsonb_concat_sections_pt_br(report_delivered)) STORED                   │
│  • audit_metadata jsonb (anchor_rate_pct, forbidden_vocab[], …)              │
│  • edit_diff jsonb, zonas_editadas jsonb, tipo_edicao text[]                 │
│  • clinical_feedback jsonb, exam_notes text (Fase 9 UI)                      │
│  • regeneration_count int, regeneration_log jsonb                            │
│  • report_generated_at, report_delivered_at, feedback_collected_at timestamptz
│                                                                              │
│  Function: jsonb_concat_sections_pt_br(jsonb) RETURNS text IMMUTABLE         │
│    SELECT string_agg(value, E'\n\n' ORDER BY                                 │
│      (regexp_match(key, '^(\d+)_'))[1]::int NULLS LAST, key)                 │
│    FROM jsonb_each_text(input)                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

────────────────────────────────────────────────────────────────────────────────

Editor flow (separate user navigation):

Browser /leituras/[id]/editar
  ↓
Frontend Server (RSC: editar/page.tsx)
  ↓ Loads reading via createClient (RLS), props: reportGenerated, reportDelivered, auditMetadata
  ↓
Browser (editar-client.tsx)
  • shadcn Accordion 13 items (D-U1)
  • Banner if audit_metadata.low_anchor_rate || forbidden_vocab.length>0 (D-A1, D-A2)
  • [Salvar edição] → Server Action saveReportDelivered:
    1. Validate jsonb shape via zod
    2. Run audit:vocabulary regex on each value — BLOCK save with toast if hit (D-A2)
    3. For each key: diffWords(generated[key], delivered[key]) → classify by char-delta-pct
    4. UPDATE: report_delivered, edit_diff, zonas_editadas, tipo_edicao, status='edited', report_delivered_at=NOW()
  • [Entregar ao cliente] → Dialog confirm → Server Action markReadingDelivered:
    1. Re-run audit on report_delivered (defense-in-depth)
    2. UPDATE: is_delivered=true, delivered_at=NOW()
```

### Recommended Project Structure

```
apps/web/
├── app/
│   ├── api/
│   │   └── readings/
│   │       └── [id]/
│   │           └── analyze/
│   │               └── route.ts              # NEW — Phase 7 Route Handler streaming
│   ├── (dashboard)/
│   │   └── leituras/
│   │       ├── page.tsx                      # MODIFIED — add CTA "ver/editar análise"
│   │       └── [id]/
│   │           ├── page.tsx                  # NEW — RSC reading detail (CTA Gerar/Regerar)
│   │           ├── analise-client.tsx        # NEW — client component for trigger + stream listening
│   │           └── editar/
│   │               ├── page.tsx              # NEW — RSC editor RSC
│   │               └── editar-client.tsx     # NEW — client component (Accordion + Textareas)
│   └── actions/
│       └── readings.ts                       # MODIFIED — add saveReportDelivered, markReadingDelivered, triggerAnalysis (optional wrapper)
├── lib/
│   ├── anthropic/                            # NEW directory (D-A4 audit:vocabulary scan target)
│   │   ├── client.ts                         # NEW — Anthropic client factory + 'server-only'
│   │   ├── analyze.ts                        # NEW — main orchestration: load reading + RAG + stream
│   │   ├── prompts.ts                        # NEW — read system.md + feature-injection.md, do template substitution
│   │   ├── parser.ts                         # NEW — section-boundary regex + jsonb_set helper
│   │   ├── audit.ts                          # NEW — anchor rate calc + forbidden vocab regex
│   │   ├── diff.ts                           # NEW — diff classification (adicionado/removido/corrigido/reescrito)
│   │   └── types.ts                          # NEW — ReportSectionKey, ReportJsonb, AuditMetadata, RegenerationLogEntry
│   └── rag/                                  # FROZEN Fase 6 — não tocar
├── prompts/                                  # NEW directory
│   ├── system.md                             # NEW — copy literal SPEC §6 lines 511-636
│   └── feature-injection.md                  # NEW — copy literal SPEC §6 lines 640-660
├── components/
│   └── readings/
│       ├── AnalysisCTA.tsx                   # NEW — "Gerar análise" / "Regenerar (n/3)" button group
│       ├── AnalysisStream.tsx                # NEW — streaming progress bar + 13-section checklist
│       ├── AnalysisHero.tsx                  # NEW — hero card states A/B/C (UI-SPEC §Surface 1)
│       ├── EditorAccordion.tsx               # NEW — 13 collapsible sections + disclaimer (UI-SPEC §Surface 2)
│       ├── EditorSectionItem.tsx             # NEW — single section with Textarea + preview
│       ├── EditorAuditBanner.tsx             # NEW — D-A1 + D-A2 banners
│       └── DeliverDialog.tsx                 # NEW — confirmation Dialog for "entregar ao cliente"
├── scripts/
│   └── audit-vocabulary.mjs                  # MODIFIED — add 'lib/anthropic' to DIRS array
├── types/
│   └── database.ts                           # REGENERATED via `pnpm gen:types` after migration applied
└── tests/
    └── lib/
        ├── anthropic/
        │   ├── parser.test.ts                # NEW — section-boundary regex robustness
        │   ├── audit.test.ts                 # NEW — anchor rate + LGPD vocab edge cases
        │   ├── diff.test.ts                  # NEW — classify boundaries (29% vs 30% vs 31%)
        │   └── prompts.test.ts               # NEW — template substitution + literal disclaimer
        └── rag/
            └── section-queries.test.ts       # NEW — D-PR2 CI gate: every slug passed by analyze.ts exists in template Record

supabase/migrations/
└── 0007_phase_7_analise_llm.sql              # NEW — DROP/ADD columns + IMMUTABLE function
```

### Pattern 1: Anthropic Streaming with Prompt Caching

**What:** Use the `messages.stream` helper (not raw `messages.create({stream:true})`), enabling `.on('text')` callbacks AND async iteration. Cache system block to amortize cost over regenerations.
**When to use:** All LLM calls in this phase. Same pattern in Fase 6 for D-N1 Contextual Retrieval (Anthropic Haiku 4.5 cache_control ephemeral).

```typescript
// Source: platform.claude.com/docs/api/sdks/typescript + platform.claude.com/docs/build-with-claude/prompt-caching
// File: apps/web/lib/anthropic/analyze.ts
import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const stream = client.messages.stream({
  model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
  max_tokens: 16000,
  system: [
    {
      type: 'text',
      text: systemPromptContent,        // ~2k tokens — passes 2048 cache threshold
      cache_control: { type: 'ephemeral' }   // 5min default TTL → 90% cost reduction within window
    }
  ],
  messages: [
    {
      role: 'user',
      content: featureInjectionRendered   // <client_context> + <features> + <knowledge>
    }
  ]
})

// Async iteration for delta events:
for await (const event of stream) {
  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    const text = event.delta.text
    // Forward to client + accumulate for section-boundary detection
  }
}

// After loop, get usage stats for telemetry:
const final = await stream.finalMessage()
console.info({
  event: 'llm_generate',
  model: final.model,
  tokens_in: final.usage.input_tokens,
  cache_creation: final.usage.cache_creation_input_tokens,
  cache_read: final.usage.cache_read_input_tokens,
  tokens_out: final.usage.output_tokens,
  cost_estimate_usd: estimateCost(final.usage),  // see audit.ts helper
})
```

**Key facts (verified):**
- Threshold mínimo Sonnet 4.6 para cache: **2048 tokens** `[CITED: platform.claude.com/docs/build-with-claude/prompt-caching]`
- Cache write 5-min: $3.75/MTok (1.25× input price)
- Cache read: $0.30/MTok (0.1× input price)
- `cache_creation_input_tokens` + `cache_read_input_tokens` aparecem em `final.usage`
- `messages.stream({...})` retorna helper com `.on('text')`, `.on('message')`, `.on('error')`, `.finalMessage()`, `.finalText()`, e é também async-iterável dos eventos.
- Abort: `stream.controller.abort()` ou `break` no `for await`.

### Pattern 2: Next.js 15 Route Handler streaming with Web Streams API

**What:** Return a `Response(ReadableStream)` from a POST Route Handler. Anthropic events flow into the stream's controller, encoded as text chunks; the same handler also performs DB writes server-side at section boundaries.
**When to use:** Streaming LLM responses in production. Verified pattern from Next.js 15.5 docs (project is Next 15.5.15 per `package.json`).

```typescript
// Source: nextjs.org/docs/app/api-reference/file-conventions/route (Next.js 15.5)
// File: apps/web/app/api/readings/[id]/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'        // Anthropic SDK works on edge too, but nodejs gives full Node primitives + 300s default
export const maxDuration = 300         // Vercel Pro Fluid Compute supports up to 800s; 300s is default and enough

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: readingId } = await params

  // 1. Auth + RLS gates (sync, fast)
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (!user || authErr) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { data: reading, error: readErr } = await supabase
    .from('readings')
    .select('id, therapist_id, status, vision_features, report_delivered, regeneration_count')
    .eq('id', readingId)
    .maybeSingle()

  if (readErr || !reading) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (reading.therapist_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (reading.status !== 'ready') return NextResponse.json({ error: 'Reading not ready' }, { status: 409 })
  if (reading.report_delivered !== null) return NextResponse.json({ error: 'Already delivered' }, { status: 409 })
  if ((reading.regeneration_count ?? 0) >= 3) return NextResponse.json({ error: 'Regeneration limit reached' }, { status: 409 })

  // 2. Build stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // a. Prepare prompt + RAG (parallel)
        const [chunks, systemPrompt, injectionTemplate] = await Promise.all([
          retrieveRelevantKnowledge({ features: reading.vision_features, reportSections: REPORT_SECTIONS }),
          loadSystemPrompt(),       // FS read of prompts/system.md (cached in module scope)
          loadInjectionTemplate(),  // FS read of prompts/feature-injection.md
        ])

        const userContent = renderInjection(injectionTemplate, {
          client_context: { ... },
          vision_features_json: JSON.stringify(reading.vision_features, null, 2),
          rag_chunks: chunks.map(c => `[${c.source_book}, p.${c.page ?? '?'}] ${c.text}`).join('\n\n'),
        })

        // b. Anthropic stream
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const llmStream = anthropic.messages.stream({
          model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
          max_tokens: 16000,
          system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: userContent }],
        })

        // c. Section-boundary parser + DB writes
        let buffer = ''
        let currentSection: { key: string; startIdx: number } | null = null
        const completedSections: Record<string, string> = {}

        for await (const event of llmStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text
            buffer += text
            controller.enqueue(encoder.encode(text))   // Forward to client

            // Detect new section boundaries
            const newBoundary = findNewBoundary(buffer, currentSection?.startIdx ?? 0)
            if (newBoundary) {
              // Close previous section
              if (currentSection) {
                const sectionText = buffer.slice(currentSection.startIdx, newBoundary.startIdx).trim()
                completedSections[currentSection.key] = sectionText
                await supabase
                  .from('readings')
                  .update({ report_generated: { ...completedSections } })   // Or use rpc('jsonb_set_section', ...) helper
                  .eq('id', readingId)
              }
              currentSection = { key: SECTION_KEY_BY_NUMBER[newBoundary.number], startIdx: newBoundary.startIdx }
            }
          }
        }

        // d. Close last section (no further boundary) + append disclaimer
        if (currentSection) {
          completedSections[currentSection.key] = buffer.slice(currentSection.startIdx).trim()
        }
        completedSections.encerramento_disclaimer = ENCERRAMENTO_LITERAL   // SPEC §6 lines 622-628

        // e. Final UPDATE: full jsonb + audit + counters
        const audit = runAudit(completedSections)
        await supabase.from('readings').update({
          report_generated: completedSections,
          report_generated_at: new Date().toISOString(),
          regeneration_count: (reading.regeneration_count ?? 0) + 1,
          regeneration_log: appendLogEntry(reading.regeneration_log, await llmStream.finalMessage()),
          audit_metadata: audit,
        }).eq('id', readingId)

        controller.close()
      } catch (err) {
        console.error('[analyze]', err)
        // Send error message inline so client sees the cause without TCP-reset noise
        controller.enqueue(encoder.encode(`\n\n[erro]: ${(err as Error).message ?? 'desconhecido'}`))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
```

**Verified facts:**
- `runtime = 'nodejs'` é default; Anthropic SDK suporta edge mas nodejs é mais simples para Supabase service patterns. `[CITED: nextjs.org/docs/app/api-reference/file-conventions/route-segment-config]`
- `maxDuration = 300` é default Hobby+Pro; Pro pode ir até 800s. Stream é first-class no nodejs runtime. `[CITED: vercel.com/docs/functions/limitations]`
- `params` agora é `Promise<{...}>` desde Next.js 15.0.0-RC. **Importante para route signature.**
- Edge runtime tem requisito de "começar a enviar resposta em 25s" — **NÃO usar edge** porque o RAG retrieval pode levar 1-3s antes do primeiro chunk LLM começar.

### Pattern 3: PostgreSQL GENERATED column with IMMUTABLE function

**What:** Two text columns are auto-derived from jsonb columns via a custom IMMUTABLE function. Avoids application-level concat duplication.
**When to use:** When LLM-04 contract requires `ai_report_raw text` to keep existing semantically while moving to canonical jsonb.

```sql
-- Source: postgresql.org/docs/15/sql-createtable.html#SQL-CREATETABLE-PARMS-GENERATED
-- Cross-ref: supabase/migrations/0005_knowledge_chunks_content_hash_and_source_type.sql (style template)
-- File: supabase/migrations/0007_phase_7_analise_llm.sql

-- 1) IMMUTABLE function ordering keys numerically (handles 1_, 2_, …, 13_ + encerramento_disclaimer)
create or replace function jsonb_concat_sections_pt_br(input jsonb)
  returns text
  language sql
  immutable
  parallel safe
as $$
  select string_agg(value::text, E'\n\n' order by
    coalesce((regexp_match(key, '^(\d+)_'))[1]::int, 99),  -- numeric prefix wins; 99 sorts encerramento last
    key
  )
  from jsonb_each_text(input);
$$;

-- 2) Atomic schema rebuild (zero existing rows have ai_report_raw populated — confirmed CONTEXT D-P1)
alter table readings
  drop column if exists ai_report_raw,
  drop column if exists ai_report_edited;

alter table readings
  add column report_generated jsonb,
  add column report_delivered jsonb,
  add column ai_report_raw text generated always as (jsonb_concat_sections_pt_br(report_generated)) stored,
  add column ai_report_edited text generated always as (jsonb_concat_sections_pt_br(report_delivered)) stored,
  add column report_generated_at timestamptz,
  add column report_delivered_at timestamptz,
  add column edit_diff jsonb,
  add column zonas_editadas jsonb,
  add column tipo_edicao text[],
  add column clinical_feedback jsonb,
  add column exam_notes text,
  add column feedback_collected_at timestamptz,
  add column audit_metadata jsonb default '{}'::jsonb,
  add column regeneration_count int default 0,
  add column regeneration_log jsonb default '[]'::jsonb;
```

**Verified facts:**
- `GENERATED ALWAYS AS (...) STORED` requires the expression to be `IMMUTABLE` (PG15+ enforces). Marking the function `immutable parallel safe` is mandatory.
- **CONTEXT D-P1 affirms zero existing readings have `ai_report_raw`/`ai_report_edited` populated** — Fase 7 has never executed. So the DROP+ADD is safe one-shot, no data migration needed.
- Encerramento disclaimer key `encerramento_disclaimer` (no numeric prefix). Regex returns NULL → coalesced to 99 → always last.
- After migration: `pnpm gen:types` regenerates `apps/web/types/database.ts` exposing the new columns.

### Pattern 4: diff classification with `diff@9` `diffWords`

**What:** For each section, compute word-level diff and derive a percentage of changed tokens to classify into `corrigido` (<30%) vs `reescrito` (≥30%).
**When to use:** Server Action `saveReportDelivered`.

```typescript
// Source: github.com/kpdecker/jsdiff README — Change[] objects
// File: apps/web/lib/anthropic/diff.ts
import { diffWords, type Change } from 'diff'
import type { ReportSectionKey, EditTipo } from './types'

export function classifyEdit(generated: string, delivered: string): {
  type: EditTipo
  diff_summary: string
  char_delta: number
  changed_pct: number
} {
  const trimGen = generated.trim()
  const trimDel = delivered.trim()

  if (trimGen === trimDel) return { type: 'none', diff_summary: '', char_delta: 0, changed_pct: 0 }
  if (trimGen === '' && trimDel !== '') return { type: 'adicionado', diff_summary: 'novo conteúdo', char_delta: trimDel.length, changed_pct: 100 }
  if (trimGen !== '' && trimDel === '') return { type: 'removido', diff_summary: 'conteúdo removido', char_delta: -trimGen.length, changed_pct: 100 }

  const changes: Change[] = diffWords(trimGen, trimDel)
  const totalTokens = changes.reduce((sum, c) => sum + (c.count ?? 0), 0)
  const changedTokens = changes
    .filter((c) => c.added || c.removed)
    .reduce((sum, c) => sum + (c.count ?? 0), 0)
  const changedPct = totalTokens === 0 ? 0 : Math.round((changedTokens / totalTokens) * 100)

  return {
    type: changedPct >= 30 ? 'reescrito' : 'corrigido',
    diff_summary: summarize(changes),     // top 3 added or removed phrases for telemetry
    char_delta: trimDel.length - trimGen.length,
    changed_pct: changedPct,
  }
}
```

**Verified facts:**
- `diffWords` quebra em palavras + pontuação preservando whitespace mas ignorando-o no compare. Adequado para texto pt-BR. `[CITED: github.com/kpdecker/jsdiff]`
- Each `Change` has `value: string`, `added: boolean`, `removed: boolean`, `count: number` (token count). Common parts have both flags `false`.
- Threshold 30% é heurística inicial CONTEXT D-U2; pode iterar com base em dogfooding.

### Anti-Patterns to Avoid

- **Server Action streamable em vez de Route Handler:** founder rejeitou D-S1; Server Action streamable abstrai demais e dificulta D-S2 incremental persistence.
- **Single textarea em vez de 13 seções colapsáveis:** founder rejeitou D-U1.
- **Per-delta DB writes:** ~30ms cadência → ~10k writes/análise. Founder rejeitou D-S2 — só section-boundary.
- **Auto-regeneração em audit failure:** D-A1, D-A2 são informativos. Banner sim, regen automática NÃO.
- **`service-role` key em `analyze.ts`:** Use session per D-S1. Service-role só permitido em Route Handlers que já têm gate por mecanismo separado (ex: webhook HMAC).
- **Edição de `vision_features` pelo terapeuta:** Fase 5 D-T4 fixa que terapeuta só edita `report_delivered` (texto), não JSON.
- **Reranking RAG retrieval no analyze.ts:** Fase 6 D-R1/D-N2 frozen — `retrieveRelevantKnowledge` é caixa preta.
- **`dangerouslyAllowBrowser: true` no Anthropic client:** API key seria exposta. SDK avisa. Sempre server-side.
- **`stream: true` em vez de `messages.stream({...})`:** o helper dá `.finalMessage()`, `.finalText()`, abort controller. Async iteration funciona em ambos, mas o helper acumula a mensagem final automaticamente.
- **Edge runtime com RAG retrieval pré-stream:** edge tem TTFB de 25s; RAG cold-start + Voyage embed pode estourar isso. Use `nodejs`.
- **`### N. ` regex sobre delta event individual:** delta events são micro-tokens (single char ou poucos chars). Match precisa ocorrer sobre buffer **acumulado**. Confirmar com testes.
- **String literal com quebras de linha em SQL function:** `string_agg(... ORDER BY ...)` com função IMMUTABLE não pode usar `SET LOCAL` (ver Fase 6 D-N1 fix em migration 0006). Manter PURO SELECT.
- **Disclaimer gerado pelo LLM:** SC4 exige presença literal — risco do Sonnet parafrasear. **Servidor appenda string literal, não confia no LLM** (D-P3).
- **Ordering dos keys jsonb com prefixos sem padding:** `'2_'` < `'13_'` lexicograficamente! Use o cast numeric `(regexp_match(key, '^(\d+)_'))[1]::int`. Sem isso, ai_report_raw fica com seção 2 depois da 13.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming HTTP in Next.js | Custom EventEmitter + manual chunking | `Response(new ReadableStream({...}))` Web Streams API | Native; flushes incrementally on Vercel Fluid Compute; no overhead vs SSE for plain text |
| LLM streaming consumption | Manual SSE parser on raw Anthropic API | `client.messages.stream({...})` helper | Handles `event:` framing, deltas, content blocks, finalMessage assembly |
| Prompt caching | Custom in-memory cache of system prompt | `cache_control: { type: 'ephemeral' }` | Anthropic-side cache; 90% read discount; transparent to your code |
| Markdown rendering | Regex-based HTML conversion | `react-markdown` + `remark-gfm` | Handles GFM, security (no HTML injection by default), heading hierarchy |
| Diff between texts | Naive char comparison or string distance | `diff@9` `diffWords` | Myers algorithm, battle-tested 10+ years, TS types, ESM+CJS, zero deps |
| jsonb concat to text | Application-level concat | `GENERATED ALWAYS AS … STORED` + IMMUTABLE function | DB enforces invariant; recompute is automatic; LLM-04 contract preserved without app code duplication |
| Section-boundary detection | LLM tool_use schema | Regex `^### (\d{1,2})\.\s+`m on accumulated buffer | Sonnet emits `### N. Título` deterministically when system prompt asks; tool_use forces prompt rewrite (D-PR1 forbids) |
| Auth + RLS for routes | Manual JWT decode | `createClient` from `@/lib/supabase/server` + `auth.getUser()` | Pattern Fase 5-6; cookie-bound; RLS auto-enforced |
| Cost telemetry | Manual token counting | `final.usage` from SDK + Sonnet 4.6 pricing constants | SDK reports `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` |
| Word-boundary regex for LGPD | Custom Unicode-safe matcher | `/\b(diagnóstico\|tratamento\|cura)\b/iu` | Already used in `audit-vocabulary.mjs` and `audit-vocabulary-db.mjs`; W6 word-boundary parity (Fase 6 D-N6) |

**Key insight:** This phase is mostly orchestration of established libs and contracts (`lib/rag/search.ts`, Anthropic SDK, Web Streams, react-markdown, diff). Hand-rolling **anything** in the streaming path or the diff path or the markdown rendering path would re-introduce known-solved bugs. The only project-specific code is: (1) section-boundary parser, (2) audit metadata calculator, (3) prompt template renderer with mustache-style `{{}}` substitution, (4) the IMMUTABLE SQL function.

## Common Pitfalls

### Pitfall 1: Section ordering of jsonb keys assumes lexicographic ordering works for `1_`…`13_`

**What goes wrong:** `string_agg(value, E'\n\n' ORDER BY key)` orders keys lexicographically, which puts `'13_mensagem_final'` BEFORE `'2_estrutural_fisica'` because `'1' < '2'` char-wise. Result: `ai_report_raw` text column has section order `1, 10, 11, 12, 13, 2, 3, …` — broken contract.

**Why it happens:** Postgres `string_agg` with text ordering is alphabetical. The intuition that `'1_'…'13_'` "just works" is wrong without zero-padding (`01_`…`13_`) OR explicit numeric cast.

**How to avoid:** ORDER BY with explicit numeric cast: `ORDER BY (regexp_match(key, '^(\d+)_'))[1]::int NULLS LAST, key`. NULLS LAST ensures `encerramento_disclaimer` (no numeric prefix) sorts last.

**Warning signs:** A spot test of `SELECT ai_report_raw FROM readings WHERE id = X` returns text with sections `1, 10, 11, …, 2, 3` instead of `1, 2, …, 13, encerramento`.

### Pitfall 2: Section-boundary regex matches false positives in body text

**What goes wrong:** Sonnet writes `### 1. Constituição` as a heading (intended), but might also write inline `### 7.5 Detalhe técnico` or list `1. Item` or even legitimately reference `Tabela 4. de exemplo` somewhere in body. Regex `/^### (\d{1,2})\.\s+/m` MATCHES MULTILINE-MODE on every `### N.` at line start.

**Why it happens:** Multiline mode `m` makes `^` match start of every line, not just start of buffer. Sonnet may quote SPEC §6 sections inside body or write `### 14. Bibliografia` (out-of-spec).

**How to avoid:**
1. Strict regex: `/^### (\d{1,2})\.\s+/gm` AND validate the captured number is `1..13` AND the captured number is **strictly increasing** (Sonnet emits sections in order). Reject false positives where number went backward or jumped >1.
2. Constrain to top-level heading: `### ` exactly (3 hashes, not `## ` or `#### `). System prompt SPEC §6 uses exactly 3 hashes.
3. Buffer entire match and the `\n` after it — only commit a section closure when next boundary is detected, ensuring partial matches don't trigger.

**Warning signs:** Test fixture with body containing `### 7. Carências` (real heading) followed later by accidental string `### 4.5` in middle of paragraph causes parser to write to key `4_toxemia` overwriting real content.

### Pitfall 3: Disclaimer literal appendado pelo servidor lost when stream errors mid-flight

**What goes wrong:** Stream errors after section 8 emitted. Server catches error in `controller.enqueue(error message)`, but **never reaches the disclaimer-append code path**. `report_generated.encerramento_disclaimer` stays NULL.

**Why it happens:** Disclaimer is appended in the success path only. Catch block does `controller.close()` without finalizing the jsonb.

**How to avoid:**
1. **Don't write disclaimer on error** — D-S2 contract says "stream incomplete" is a recoverable state (UI shows partial + offers Continue/Retry).
2. UI checks: if `Object.keys(report_generated).length < 14 || !report_generated.encerramento_disclaimer`, render incomplete-state warning chip and `Continuar geração` CTA (UI-SPEC §Streaming Visual Cue confirms this).
3. **Don't increment `regeneration_count` on error** (D-S3): infrastructure failures shouldn't punish the user.

**Warning signs:** Spot test killing the function mid-stream and verifying the editor renders State C with "Geração incompleta — 7/13 seções" + Continue CTA.

### Pitfall 4: Cache_control `cache_creation_input_tokens` is 0 — caching silently disabled

**What goes wrong:** First call writes the cache (`cache_creation_input_tokens > 0`); subsequent calls within 5min should show `cache_read_input_tokens > 0` and `cache_creation_input_tokens = 0`. If both stay 0, the prompt was below the 2048-token threshold for Sonnet 4.6 and caching was skipped silently.

**Why it happens:** SPEC §6 system prompt looks long but in token count may dip near 2048. Whitespace trimming or template flexibility may push it under. Sonnet 4.6 enforces 2048-token minimum — no error returned, just no caching.

**How to avoid:**
1. Token-count the rendered system prompt at module load. If `< 2200` (margin), log a WARN.
2. In tests, assert `final.usage.cache_creation_input_tokens > 0` on first call (the test feeds a fresh API key OR clears the cache somehow — challenging in unit tests; do this in an integration smoke).
3. Telemetry log includes `cache_creation_input_tokens` and `cache_read_input_tokens` so production monitoring can detect cache-not-working.

**Warning signs:** Cost-per-regeneration stays the same across 2-3 regenerations within 5min — should drop ~90% on second+ calls.

`[CITED: platform.claude.com/docs/build-with-claude/prompt-caching]`

### Pitfall 5: `params` is a Promise in Next.js 15 Route Handlers

**What goes wrong:** `function POST(request, { params: { id } }) { ... }` — TypeScript error: `id is not a string, it's a Promise<{id: string}>` (`v15.0.0-RC` migrated `context.params` from object to Promise).

**Why it happens:** Next.js 15 made route segment context async to prepare for streaming RSC. `params` must be `await`ed.

**How to avoid:** `async function POST(request, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; ... }`. Codemod available `npx @next/codemod 15-route-handlers .`.

**Warning signs:** TS errors after `pnpm dev`; route accepts requests but `id` is `[object Promise]`.

`[CITED: nextjs.org/docs/app/api-reference/file-conventions/route Version History]`

### Pitfall 6: Edge runtime can't return RAG-pre-stream responses

**What goes wrong:** `export const runtime = 'edge'` — Edge requires response to start within 25s. RAG retrieval (Voyage embed + RPC + rerank) can take 1-3s in cold-start. Worst-case combined cold-starts > 5s before first token → user sees blank screen, but well within 25s. **However**, edge functions also lack the `@/lib/supabase/server` SSR helpers' full Node API.

**Why it happens:** Edge runtime is Web-API-only; some Supabase SSR helpers use cookies/headers via Node primitives. Project pattern in Fase 5/6 is `runtime = 'nodejs'`.

**How to avoid:** Use `runtime = 'nodejs'`. Project precedent set in `app/api/vision/webhook/route.ts` (Fase 5).

**Warning signs:** Build error or runtime crash on `createClient()` import; or "Edge function exceeded 25s TTFB" on Vercel logs.

`[CITED: vercel.com/docs/functions/limitations#max-duration]`

### Pitfall 7: Word-boundary regex differs across audit scripts

**What goes wrong:** `audit-vocabulary.mjs` (file scan) uses `/diagnóstico|tratamento|cura/i` (substring), but `audit-vocabulary-db.mjs` and `vision-service/scripts/audit_vocabulary.py` use `\b...\b` (W6 word-boundary). Audit on `report_generated` jsonb might use yet another regex. Inconsistency = a hit in DB doesn't match a hit in source files.

**Why it happens:** Three independent audits evolved at different times. Fase 6 Plan 06-12 standardized DB on word-boundary; file-scan still uses substring.

**How to avoid:** New audit code in `lib/anthropic/audit.ts` MUST use `/\b(diagnóstico|tratamento|cura)\b/iu` (word-boundary + Unicode flag). Same regex applied to `report_generated` and `report_delivered`. Add a unit test that documents the parity invariant.

**Warning signs:** A chunk passes file audit but fails DB audit, or vice versa. Stress test: text "naturocultura" matches substring `cura` in old regex → false positive in old `audit-vocabulary.mjs`.

`[CITED: apps/web/scripts/audit-vocabulary-db.mjs lines 14-16, vision-service Plan 06-12]`

### Pitfall 8: Anthropic SDK 4xx error shape doesn't include `_request_id` on streaming errors

**What goes wrong:** When the LLM returns a 400 (e.g., context window overflow), the `messages.stream({...})` throws an `Anthropic.APIError`. `err.status` works, `err._request_id` may not be populated for stream-init failures (only for completed responses).

**Why it happens:** Stream init that 400s before any SSE frame opens has no `_request_id` cookie yet.

**How to avoid:** Log `err.status`, `err.message`, `err.name`, AND inspect `err.headers?.get('request-id')` as a fallback. For abort: check `err.name === 'AbortError'`.

**Warning signs:** Stream errors like "context overflow" come through with empty request_id, harder to file Anthropic support tickets.

`[CITED: platform.claude.com/docs/api/sdks/typescript "Handling errors"]`

### Pitfall 9: prompts/system.md committed but read at runtime → bundler quirk

**What goes wrong:** Reading `apps/web/prompts/system.md` via `fs.readFile` at module init works in dev but Next.js bundler doesn't trace markdown files into the function bundle by default. Production deploy fails: `ENOENT: no such file or directory, open 'prompts/system.md'`.

**Why it happens:** Next.js needs `outputFileTracingIncludes` or explicit `import` of asset to trace.

**How to avoid:** Two options:
1. **Recommended**: Use `next.config.ts` to add `outputFileTracingIncludes: { 'app/api/readings/[id]/analyze/route': ['./prompts/**/*'] }`. Then `fs.readFile(path.join(process.cwd(), 'prompts/system.md'), 'utf8')`.
2. Or: import as text via webpack `?raw` loader — `import systemPrompt from '@/prompts/system.md?raw'` — but Next 15 doesn't ship that loader by default and adding webpack config is not ideal in Turbopack era.

**Warning signs:** `pnpm build` succeeds locally; `vercel deploy` fails on first request with ENOENT.

`[VERIFIED: similar pattern documented Next.js docs for `outputFileTracingIncludes`]`

### Pitfall 10: Server Action `saveReportDelivered` breaks if zod schema doesn't allow unknown keys

**What goes wrong:** zod `.strict()` rejects extra keys; if Sonnet emits a 14th heading or test fixture includes a typo key, save fails silently with "Invalid body".

**Why it happens:** Defensive zod is good for server actions but the jsonb shape may evolve.

**How to avoid:** zod `.passthrough()` for the report jsonb — accept any key but validate the canonical 13+1 are strings. Combined with `audit-vocabulary` static check, extra keys are tolerable.

**Warning signs:** "Invalid body" toast in editor on save with no clear UI hint about which key.

## Code Examples

### Audit anchor rate (sentence-split for "afirmação")

```typescript
// File: apps/web/lib/anthropic/audit.ts
// Decision: D-A1 — sentence-split per founder + planner recommendation
import type { ReportJsonb, AuditMetadata } from './types'

const SECTIONS_REQUIRING_ANCHORS: Array<keyof ReportJsonb> = [
  '2_estrutural_fisica',
  '3_indicacoes_sistemicas',
  '4_toxemia',
  '5_psicoemocional',
  '6_cargas_temporais',
]

const ANCHOR_RE = /\[ancorado em: features\.[\w.\[\]]+\]/g
const FORBIDDEN_RE = /\b(diagnóstico|tratamento|cura)\b/giu  // W6 word-boundary parity

export function runAudit(report: ReportJsonb): AuditMetadata {
  const anchorPerSection: Record<string, number> = {}
  let totalSentences = 0
  let totalAnchored = 0

  for (const key of SECTIONS_REQUIRING_ANCHORS) {
    const text = report[key] ?? ''
    // sentence-split: end-punctuation followed by whitespace or end-of-string
    const sentences = text.split(/[.!?]+(?=\s|$)/u).map(s => s.trim()).filter(Boolean)
    const anchored = sentences.filter(s => ANCHOR_RE.test(s)).length
    ANCHOR_RE.lastIndex = 0  // reset regex global state
    anchorPerSection[key.split('_')[0]] = sentences.length === 0 ? 100 : Math.round((anchored / sentences.length) * 100)
    totalSentences += sentences.length
    totalAnchored += anchored
  }

  const overallPct = totalSentences === 0 ? 100 : Math.round((totalAnchored / totalSentences) * 100)

  // Forbidden vocab scan over ALL report keys (not just sections 2-6)
  const forbiddenHits: Array<{ section: string; term: string; occurrences: number }> = []
  for (const [key, text] of Object.entries(report)) {
    if (typeof text !== 'string') continue
    const matches = [...text.matchAll(FORBIDDEN_RE)]
    if (matches.length > 0) {
      const counts = new Map<string, number>()
      for (const m of matches) counts.set(m[0].toLowerCase(), (counts.get(m[0].toLowerCase()) ?? 0) + 1)
      for (const [term, occurrences] of counts) {
        forbiddenHits.push({ section: key, term, occurrences })
      }
    }
  }

  return {
    low_anchor_rate: overallPct < 95,
    anchor_rate_pct: overallPct,
    anchor_rate_per_section: anchorPerSection,
    forbidden_vocab: forbiddenHits,
    audited_at: new Date().toISOString(),
    auditor_version: 'v1',
  }
}
```

### Section-boundary parser (handles incremental buffer)

```typescript
// File: apps/web/lib/anthropic/parser.ts
// Pitfall 2: strict ordering + numeric range validation
const BOUNDARY_RE = /^### (\d{1,2})\.\s+/gm

export interface BoundaryMatch {
  number: number
  startIdx: number       // index in buffer where '### N.' begins (just after \n or buffer start)
  headingEndIdx: number  // index after '### N. \n' line (start of section body)
}

export function findAllBoundaries(buffer: string): BoundaryMatch[] {
  BOUNDARY_RE.lastIndex = 0
  const matches: BoundaryMatch[] = []
  let m: RegExpExecArray | null
  let lastNumber = 0
  while ((m = BOUNDARY_RE.exec(buffer)) !== null) {
    const number = parseInt(m[1]!, 10)
    if (number < 1 || number > 13) continue        // Pitfall 2 — out of range
    if (number !== lastNumber + 1) continue        // Pitfall 2 — strictly increasing only
    lastNumber = number
    const lineEnd = buffer.indexOf('\n', m.index + m[0].length)
    matches.push({
      number,
      startIdx: m.index,
      headingEndIdx: lineEnd === -1 ? m.index + m[0].length : lineEnd + 1,
    })
  }
  return matches
}
```

### Markdown preview integration

```tsx
// Source: react-markdown@10 README + remark-gfm@4 README
// File: apps/web/components/readings/EditorSectionItem.tsx (excerpt)
'use client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function PreviewPane({ markdown }: { markdown: string }) {
  return (
    <div className="prose prose-sm prose-neutral max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Citations [ancorado em: features.X] are emitted as plain text by Sonnet,
          // not as <code>. Optional: post-process via a custom remark plugin to wrap
          // them in <code> for visual distinction (UI-SPEC §Typography). Defer to
          // polish — initial impl renders plain text with brackets visible.
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `messages.create({ stream: true })` returning AsyncIterable | `messages.stream({...})` helper with `.on()` callbacks AND async iteration | SDK ~0.30+ | Helper provides `.finalMessage()`, `.finalText()`, abort controller; cleaner than raw iterator |
| `cache_control: { type: 'ephemeral' }` 5-min only | Optional `ttl: '1h'` for 1-hour cache | API late-2024 / Sonnet 4.5+ | 1h cache useful when regen window > 5min; trade 2× write cost for longer hit window. **Not needed Fase 7** (5min default suffices because 3-regen-cap means reads happen close together OR not at all) |
| `claude-sonnet-4-5-20250929` snapshot | `claude-sonnet-4-6` (dateless format, still pinned snapshot) | Sonnet 4.6 release | Use new format; project default; alias = literal ID since 4.6 |
| Next.js 14 sync `params` | Next.js 15+ async `params: Promise<{...}>` | Next.js 15.0.0-RC | Codemod available; required for typing |
| pdfplumber-style HTML parsing of PDFs | Already irrelevant for this phase (RAG ingestion done in Fase 6) | — | — |
| Custom markdown parser per app | `react-markdown` + plugins (`remark-gfm`, `rehype-sanitize`) | Years stable | Use react-markdown; never roll own |
| Vercel Edge for streaming | Fluid Compute on Node.js for streaming (300s default, 800s Pro) | Vercel 2024 | Node.js gets all streaming Edge had + 12× max duration; Edge still useful for global low-latency reads |

**Deprecated/outdated:**
- `claude-sonnet-4-20250514` (Sonnet 4 base) — deprecated, retires June 15 2026. Project uses 4.6, no migration risk.
- Next.js Pages Router API routes with `bodyParser` — replaced by App Router Route Handlers (already adopted).
- `@anthropic-ai/sdk` versions < 0.50 lacked prompt caching API — project on 0.92, fine.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `claude-sonnet-4-6` (dateless format) is the alias used by the Anthropic API for both ID and "alias" columns. `[VERIFIED: platform.claude.com/docs/about-claude/models]` — confirmed not assumed | — | — (verified) |
| A2 | SPEC.md §6 system prompt body (linhas 511-636) is ~2000-2200 tokens; safely above 2048-token cache threshold for Sonnet 4.6. **Not directly measured** — derived from SPEC line count + heuristic | Pattern 1 / Pitfall 4 | If actually < 2048, prompt caching silently disabled → cost target ~$0.30/regen unmet. **Mitigation:** token-count at module init + WARN log; integration smoke verifies `cache_creation_input_tokens > 0` on first call |
| A3 | Founder's recommendation of sentence-split (vs paragraph/bullet) for "afirmação" definition is uncontested at planning time | Pattern audit / Claude's Discretion #1 | If founder later prefers paragraph, audit re-runs over historic data with new auditor_version (D-A3 supports re-audit) |
| A4 | The `ENCERRAMENTO_LITERAL` constant in `lib/anthropic/types.ts` exactly matches SPEC §6 lines 622-628 (4-line markdown blockquote starting with "Esta leitura iridológica…"). Planner / executor must copy-paste from SPEC | Pattern 1 step 5 | If not matched literally, SC4 fails ("disclaimer literal de encerramento aparece sempre"). **Mitigation:** unit test in `prompts.test.ts` that asserts `ENCERRAMENTO_LITERAL === <expected SPEC text>` (executor copies expected text from SPEC) |
| A5 | Sonnet 4.6 emits `### N. Título` deterministically when system prompt SPEC §6 directs structure with 13 heading lines. **Not directly measured pre-impl** | Pitfall 2 / Pattern 2 | If Sonnet drifts to `## N.` or omits numbering, parser misses boundaries. **Mitigation:** integration smoke (founder UAT) generates 3-5 reports; verify all 13 headings detected; if drift, prompt-engineer to enforce strictly (D-PR1 may need amendment via ADR) |
| A6 | Outputting all 13 sections + disclaimer fits in `max_tokens=16000` for typical features (per CONTEXT 30-60s latency target). **Not measured** | Pattern 1 | If max_tokens exhausted mid-section, stream truncates; partial save D-S2 mitigates but UX shows incomplete. **Mitigation:** start with 16000; if dogfooding shows truncation, raise to 20000 (Sonnet 4.6 max_output is 64k) |
| A7 | `outputFileTracingIncludes` config in `next.config.ts` is the canonical way to ship `prompts/*.md` files into the deployed bundle | Pitfall 9 | If wrong, prod deploy 500s on `ENOENT`. **Mitigation:** test pre-deploy with `vercel build --debug` locally |
| A8 | Project Plans Pro on Vercel; 800s `maxDuration` available. **Not verified — defaults to Hobby if not** | Pattern 2 | If Hobby, 300s cap; 5-min should still suffice for normal generation. No mitigation needed if 300s holds |
| A9 | `regeneration_log` jsonb append via `||` operator is atomic in Postgres. **Verified Postgres docs** but not in this project context | Pattern 2 step 5 | If race conditions exist between concurrent regenerations on same reading (unlikely — same therapist clicking twice within 30s), log entries may interleave. **Mitigation:** application-level lock via `regeneration_count` increment guard |

## Open Questions

1. **Token count of `prompts/system.md` after literal copy from SPEC**
   - What we know: SPEC §6 is ~125 lines; 5 principles + 13 sections + closing + tone sub-sections.
   - What's unclear: exact token count when rendered (Voyage tokenizer differs from Anthropic; Anthropic publishes a tokenizer but it's not commonly used pre-call).
   - Recommendation: planner adds a Wave-0 task that token-counts via `npx anthropic-tokenizer-cli` (or runs a `client.messages.countTokens` if available in SDK 0.92) and asserts `>= 2200`. If under, expand the file with allowed boilerplate (e.g., extra examples) or flag to founder.

2. **Whether `regeneration_log` should be **jsonb array** or a **separate table**?**
   - What we know: D-S4 explicitly says jsonb append. D-P2 schema confirms `regeneration_log jsonb default '[]'`.
   - What's unclear: At >100 regenerations across all readings for one therapist, jsonb scans for monthly aggregation become expensive.
   - Recommendation: planner ships jsonb in 0007 (per CONTEXT). If Fase 9 polish reveals slow query, migrate to dedicated `regeneration_events` table. Don't preempt.

3. **How to handle Sonnet emitting 14 sections by mistake?**
   - What we know: System prompt only enumerates 13. SPEC §6 is unambiguous.
   - What's unclear: Sonnet may add an extra section or split section 12-13 into multiple.
   - Recommendation: parser caps at 13 (validates `number <= 13` per Pitfall 2). Anything past 13 ignored, logged as drift warning. Founder dogfooding will flag if persistent.

4. **Edge case: client refresh during stream — does old fetch keep the function alive?**
   - What we know: Fetch on browser side aborts the request when page navigates; the controller on server side detects via `request.signal.aborted` (when reading `request` per usual pattern). However, `messages.stream({...})` continues until completion or error unless explicitly aborted.
   - What's unclear: If user closes tab mid-stream, does the function continue running for full max_tokens (wasting cost)? Or does Vercel terminate?
   - Recommendation: Pass `request.signal` to the Anthropic stream's underlying `AbortController.signal` if supported (verify in SDK), OR poll `request.signal.aborted` in the for-await loop. Check via 1-line test. Default to letting it run (cost is bounded by max_tokens=$0.25).

5. **Cost budget verification**
   - What we know: Sonnet 4.6 = $3 input / $15 output / $0.30 cache read. Cache write $3.75. NFR target ~$0.30/análise CONTEXT.md "constraints" L241.
   - What's unclear: Real per-analysis cost. Estimated: system prompt 2.2k tokens × $3.75/MTok = $0.008 (cache write, first call) OR × $0.30/MTok = $0.0007 (cache read, subsequent). User content ~3k tokens × $3 = $0.009. Output 8k tokens × $15 = $0.12. Total: $0.13/análise (cached path).
   - Recommendation: validate with first 5 dogfood runs; founder feature-flags Opus 4.7 ($5/$25) only if quality demands.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@anthropic-ai/sdk` | LLM streaming | ✓ | `^0.92.0` (latest registry 0.95.1) | — |
| `voyageai` | RAG (Fase 6 frozen) | ✓ | `^0.2.1` | — |
| `@supabase/ssr` + `@supabase/supabase-js` | Auth + DB | ✓ | `0.10.2` / `2.105.1` | — |
| `react-markdown` | Editor preview | ✗ — to install | `^10.1.0` | None (UI-SPEC bloqueou) |
| `remark-gfm` | Editor preview GFM | ✗ — to install | `^4.0.1` | None |
| `diff` | Server diff classification | ✗ — to install | `^9.0.0` | None |
| `@radix-ui/react-accordion` | Editor accordion | ✗ — install via `pnpm dlx shadcn@latest add accordion` | (transitive) | None |
| Supabase CLI for migration | DB schema | (founder verifies) | latest | Manual SQL via Studio |
| `pnpm gen:types` script | Types regen | ✓ existing in package.json | — | — |
| Anthropic API key (`ANTHROPIC_API_KEY`) env var | Runtime | (founder confirms in Vercel) | — | None — phase blocks without key |
| Vercel Pro plan (for 800s maxDuration if needed) | Streaming Route Handler | A8 assumed Pro; Hobby 300s suffices | — | 300s default works for current feature scope |
| Postgres 14+ (for `GENERATED ALWAYS AS … STORED`) | Migration 0007 | ✓ Supabase = PG15 | 15.x | — |
| `vision-service/` Python (Fase 5) | Trigger features availability | ✓ already complete | — | — |
| `lib/rag/search.ts` (Fase 6 frozen) | RAG retrieval | ✓ in production | — | — |

**Missing dependencies with no fallback:**
- None — all 4 npm packages install cleanly in Wave 1; `ANTHROPIC_API_KEY` is operational concern for founder.

**Missing dependencies with fallback:**
- Vercel Pro 800s maxDuration: project may be on Hobby (300s default) — 300s is sufficient for current spec; A8 documents the assumption.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 (project default per `apps/web/package.json`) |
| Config file | `apps/web/vitest.config.ts` (existing) |
| Quick run command | `pnpm --filter web test:run` |
| Full suite command | `pnpm --filter web test:run` |
| Audit-vocab static | `pnpm --filter web audit:vocabulary` |
| Audit-vocab DB | `pnpm audit:vocabulary:db` (root, env-guarded) |
| Type generation gate | `pnpm --filter web gen:types && tsc -p apps/web --noEmit` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LLM-01 | `analyze.ts` orchestrates load + RAG + stream | unit (mocked Anthropic + RAG) | `pnpm test:run apps/web/tests/lib/anthropic/analyze.test.ts` | ❌ Wave 0 |
| LLM-01 | Server reads `system.md` + `feature-injection.md` from `prompts/` and renders mustache substitutions correctly | unit | `pnpm test:run apps/web/tests/lib/anthropic/prompts.test.ts` | ❌ Wave 0 |
| LLM-01 | `retrieveRelevantKnowledge` is invoked with the exact 7-slug array (D-PR2 frozen contract) | unit (mock RAG) | (same file) | ❌ Wave 0 |
| LLM-02 | Prompt content matches SPEC §6 lines 511-636 verbatim (5 principles + 13 sections) | unit (file-content snapshot, NOT LLM behavior) | `pnpm test:run apps/web/tests/prompts/literal.test.ts` | ❌ Wave 0 |
| LLM-02 | 5-principle behavior in real generation (linguistic correctness, no fabricated signs, RAG-priority) | manual UAT | Founder uses `/leituras/[id]` flow on 3-5 real readings; documented in `07-UAT.md` | ❌ Wave 4 |
| LLM-03 | Encerramento literal appended after stream completes (success path) | integration (mocked Anthropic) | `pnpm test:run apps/web/tests/api/analyze-route.test.ts` | ❌ Wave 0 |
| LLM-03 | Anchor rate audit detects ≥95% threshold correctly | unit | `pnpm test:run apps/web/tests/lib/anthropic/audit.test.ts` | ❌ Wave 0 |
| LLM-03 | Forbidden vocab regex with `\b...\b` parity catches `diagnóstico`/`tratamento`/`cura` and ignores `naturocultura` | unit | (same file) | ❌ Wave 0 |
| LLM-04 | Migration 0007 applied: `report_generated`, `report_delivered`, `ai_report_raw` (GENERATED), `ai_report_edited` (GENERATED), `audit_metadata`, `regeneration_count`, etc. | smoke (post-migration query) | `pnpm --filter web gen:types && tsc -p apps/web --noEmit` (would fail if columns missing) | ❌ Wave 0 |
| LLM-04 | `jsonb_concat_sections_pt_br` orders keys numerically (1, 2, …, 13, encerramento), NOT lexicographically | smoke (SQL test in 06-style) | Manual SQL test or pgTAP — recommend committing in `supabase/tests/0007_*.sql` | ❌ Wave 0 |
| LLM-04 | `saveReportDelivered` persists `report_delivered`, computes `edit_diff` + `zonas_editadas` + `tipo_edicao`, sets `status='edited'` | unit (mock supabase) | `pnpm test:run apps/web/tests/lib/anthropic/diff.test.ts` + `apps/web/tests/actions/readings.test.ts` | ❌ Wave 0 |
| LLM-04 | `saveReportDelivered` BLOCKS save when forbidden vocab present in `report_delivered` | unit | (same files) | ❌ Wave 0 |
| LLM-04 | `markReadingDelivered` Server Action sets `is_delivered=true`, `delivered_at=NOW()`, freezes editing | unit + integration | (same files) | ❌ Wave 0 |
| D-A1 | Banner D-A1 renders when `audit_metadata.low_anchor_rate=true` | unit (RTL) | `pnpm test:run apps/web/tests/components/EditorAuditBanner.test.tsx` | ❌ Wave 0 |
| D-A2 | Banner D-A2 renders when `audit_metadata.forbidden_vocab.length > 0` | unit (RTL) | (same file) | ❌ Wave 0 |
| D-A4 | `audit:vocabulary` includes `lib/anthropic/` | static script run | `pnpm --filter web audit:vocabulary` (now scans new dir) | ✓ existing script |
| D-S1 | Route Handler returns `text/plain; charset=utf-8` with chunked transfer | integration | `pnpm test:run apps/web/tests/api/analyze-route.test.ts` | ❌ Wave 0 |
| D-S1 | Auth gate rejects unauthenticated (401), wrong therapist (403), wrong status (409), already-delivered (409), regen-cap (409) | unit | (same file) | ❌ Wave 0 |
| D-S2 | Section-boundary parser writes 14 jsonb_set updates over a complete stream (mocked) | unit | `pnpm test:run apps/web/tests/lib/anthropic/parser.test.ts` | ❌ Wave 0 |
| D-S2 | Stream interrupted mid-section: `report_generated` has partial keys, `encerramento_disclaimer` absent | unit | (same file) | ❌ Wave 0 |
| D-S2 | Section ordering: parser handles `### 7.5` mid-body without false-positive triggering boundary | unit | (same file) | ❌ Wave 0 |
| D-S4 | After `regeneration_count >= 3`, Route Handler returns 409 | integration | (same file) | ❌ Wave 0 |
| D-S4 | After `report_delivered IS NOT NULL`, Route Handler returns 409 | integration | (same file) | ❌ Wave 0 |
| D-S4 | `regeneration_log` appends correctly with `{timestamp, therapist_id, reading_id, model, latency_ms, tokens_in, tokens_out, cost_estimate_usd}` | unit | (same file) | ❌ Wave 0 |
| D-PR2 | Test asserts `analyze.ts` passes 7-slug array; every slug exists in `SECTION_QUERY_TEMPLATES` Record | unit | `pnpm test:run apps/web/tests/lib/rag/section-queries.test.ts` | ❌ Wave 0 |
| D-U1 | Editor renders 13 Accordion items + 1 read-only encerramento item | unit (RTL) | `pnpm test:run apps/web/tests/components/EditorAccordion.test.tsx` | ❌ Wave 0 |
| D-U2 | Diff classification: `adicionado`, `removido`, `corrigido` (28%), `reescrito` (32%) all correctly classified | unit | `pnpm test:run apps/web/tests/lib/anthropic/diff.test.ts` (boundary cases at 29/30/31%) | ❌ Wave 0 |
| D-U3 | Two distinct buttons; Deliver opens Dialog confirm before mutation | unit (RTL) | `pnpm test:run apps/web/tests/components/DeliverDialog.test.tsx` | ❌ Wave 0 |
| Pitfall 1 | SQL function orders `1, 2, …, 13, encerramento`, NOT lexicographic | smoke SQL | Recommended: `supabase/tests/0007_jsonb_concat_order.sql` with `INSERT … VALUES (jsonb_build_object('13_x','c', '2_y','b', '1_z','a', 'encerramento_disclaimer','d'))` and assert output starts with `'a'`. **High-value defensive test.** | ❌ Wave 0 |
| Pitfall 4 | Cache hit verification (`cache_read_input_tokens > 0` on second call within 5min) | manual smoke | Founder runs 2 generations on same reading within 5min; checks server console.info logs | ❌ Wave 4 (manual UAT) |
| Pitfall 7 | Word-boundary regex parity test: `/\b...\b/iu` matches `diagnóstico` but not `naturocultura` | unit | (audit.test.ts) | ❌ Wave 0 |
| Pitfall 9 | Production smoke: prompts/*.md present in deployed bundle | manual deploy verify | Vercel preview deploy, hit `/api/readings/[id]/analyze` POST, verify no `ENOENT` | ❌ Wave 4 |

### Sampling Rate

- **Per task commit:** `pnpm --filter web test:run --changed` (only files affected by the change)
- **Per wave merge:** `pnpm --filter web test:run` + `pnpm --filter web audit:vocabulary` + `tsc -p apps/web --noEmit`
- **Phase gate (`/gsd-verify-work 7`):** Full suite + audit:vocabulary + audit:vocabulary:db + LGPD literal-grep over `lib/anthropic/`, `app/api/readings/[id]/analyze/`, `app/(dashboard)/leituras/[id]/`, `prompts/*.md` (allowlist comment), `supabase/migrations/0007_*.sql` + manual founder UAT (≥3 real readings, capturing anchor rate, forbidden vocab hit rate, latency, cost-per-call) documented in `07-UAT.md`.

### Wave 0 Gaps

- [ ] `apps/web/tests/lib/anthropic/parser.test.ts` — section-boundary regex robustness (4-5 cases including out-of-range, non-monotonic, false positive in body, multiline mode)
- [ ] `apps/web/tests/lib/anthropic/audit.test.ts` — anchor rate calculation + forbidden vocab `\b...\b` parity (5-6 cases: 100% anchored, 0% anchored, edge case of 95% boundary, naturocultura false-positive prevention, multi-occurrence counting)
- [ ] `apps/web/tests/lib/anthropic/diff.test.ts` — classify boundaries 29% vs 30% vs 31%; adicionado/removido edges (8-10 cases)
- [ ] `apps/web/tests/lib/anthropic/prompts.test.ts` — file content matches SPEC literal + mustache substitution + ENCERRAMENTO_LITERAL invariant (5 cases)
- [ ] `apps/web/tests/lib/anthropic/analyze.test.ts` — orchestration with mocked Anthropic.messages.stream + mocked retrieveRelevantKnowledge (3-4 cases: happy path, RAG empty, LLM error, abort)
- [ ] `apps/web/tests/api/analyze-route.test.ts` — auth gates + status guards + cap guards + Response shape (8-10 cases)
- [ ] `apps/web/tests/actions/readings.test.ts` — saveReportDelivered (5-6 cases including LGPD block) + markReadingDelivered (2 cases)
- [ ] `apps/web/tests/components/EditorAccordion.test.tsx` — 13 items + encerramento read-only + edited indicator + char count (4-5 cases)
- [ ] `apps/web/tests/components/EditorAuditBanner.test.tsx` — D-A1 + D-A2 banner conditions (4 cases)
- [ ] `apps/web/tests/components/DeliverDialog.test.tsx` — Dialog confirm flow + cancel (2-3 cases)
- [ ] `apps/web/tests/components/AnalysisHero.test.tsx` — 3 states A/B/C + transitions (4-5 cases)
- [ ] `apps/web/tests/lib/rag/section-queries.test.ts` — D-PR2 CI gate: every slug used by `analyze.ts` exists in `SECTION_QUERY_TEMPLATES` (1 test importing both)
- [ ] `apps/web/tests/prompts/literal.test.ts` — system.md and feature-injection.md byte-equal expected SPEC §6 excerpts (2 cases)
- [ ] `supabase/tests/0007_jsonb_concat_order.sql` (or pgTAP equivalent in CI) — section-ordering invariant of `jsonb_concat_sections_pt_br`
- [ ] Vitest config: ensure `vitest.config.ts` does NOT exclude `apps/web/tests/api/` and `apps/web/tests/actions/` (verify after Wave 0)

## Security Domain

### Applicable ASVS Categories

ASVS Level 1 enforced per `.planning/config.json` (`security_asvs_level: 1`, `security_block_on: 'high'`).

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth session via `createClient`/`auth.getUser()` — pattern Fase 5/6 |
| V3 Session Management | yes | Same as above; cookie-bound; no new session logic |
| V4 Access Control | yes | RLS on `readings` (auth.uid() = therapist_id); Route Handler also explicit `reading.therapist_id !== user.id → 403`; status guards (status='ready', report_delivered IS NULL, regeneration_count<3) |
| V5 Input Validation | yes | zod schema validation in Server Action `saveReportDelivered` + Route Handler params (id is uuid). Markdown rendered via `react-markdown` which sanitizes HTML by default (no raw HTML pass-through) |
| V6 Cryptography | partial | No new crypto in this phase. API key in env var only. **No webhook HMAC** since this phase has no inbound webhooks (LLM call is outbound, response is on the same connection) |
| V7 Error Handling | yes | Errors surface as inline stream message (not raw stack); `console.error` for ops; no PII in logs (telemetry strips client name, includes only UUIDs) |
| V8 Data Protection | yes | LGPD vocabulary audit (D-A2 / D-A4); audit_metadata stores forbidden_vocab terms — itself NOT exposed in copy except in banner via `{term_list}` runtime substitution; no PII in `console.info` events |
| V9 Communication | yes | HTTPS enforced via Vercel; no new external endpoints; Anthropic API call is HTTPS by default in SDK |
| V10 Malicious Code | yes | npm packages: react-markdown@10 (well-known, audited), remark-gfm@4 (same), diff@9 (BSD, kpdecker zero-deps). No third-party shadcn registries; no third-party fetch from untrusted origins |
| V11 Business Logic | yes | Regeneration cap = 3 hard-guarded; report_delivered congelado; `is_delivered=true` is terminal; D-A2 vocab gate on save AND deliver (defense-in-depth) |
| V13 API and Web Service | yes | Route Handler runtime nodejs; CSRF: cookies + same-origin; no CORS config; rate limiting deferred to Vercel/Cloudflare layer |

### Known Threat Patterns for `apps/web` (Next.js 15 + Supabase + Anthropic API + jsonb)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Markdown HTML/JS injection in editor preview | Tampering / Information Disclosure | `react-markdown` defaults to text-only nodes; HTML disallowed without explicit `rehype-raw` plugin (we don't add). XSS impossible from rendered content. |
| LGPD-06 forbidden vocab leaking to client | Information Disclosure / Compliance | Static audit `pnpm audit:vocabulary` + DB audit `pnpm audit:vocabulary:db` + runtime audit on save (D-A2 BLOCKING) + runtime audit on deliver (defense-in-depth) |
| API key exposure to browser | Information Disclosure | `import 'server-only'` at top of `lib/anthropic/*` files; Anthropic SDK warns on `dangerouslyAllowBrowser` (default false) |
| Cross-therapist data access via `/api/readings/[id]/analyze` | Elevation of Privilege | Auth gate: `reading.therapist_id === user.id` (line-by-line check) + RLS row filter |
| Regeneration abuse (cost) | Repudiation / DoS | Hard cap 3 per reading + telemetry alerts at 10/month per therapist |
| Stream replay/MITM | Tampering | HTTPS enforced; no separate webhook signature needed (response is same connection) |
| Stale `report_generated` overwrite by late stream | Tampering / Race | UPDATE …WHERE id = $1 AND regeneration_count = $current — optimistic lock; or simply "last write wins" since cap=3 makes races unlikely |
| Disclaimer omission via prompt injection | Compliance | Disclaimer appended programmatically by server (D-P3), not generated by LLM — prompt injection cannot remove it |
| Markdown rendering DoS via malicious payload (bombs) | DoS | `react-markdown` is bounded by total markdown size; max_tokens=16000 caps input |
| jsonb injection via Server Action | Injection | zod schema with strict shape on save + parameterized query via Supabase client (no raw SQL with user input) |
| Path traversal reading prompts/*.md | Information Disclosure | Hardcoded path `path.join(process.cwd(), 'prompts/system.md')` — no user input |

## Project Constraints (from CLAUDE.md)

**No `./CLAUDE.md` or `apps/web/CLAUDE.md` exists** as of 2026-05-08 (verified via `ls D:\Projetos\Iridologista\CLAUDE.md` → no such file; same for apps/web). Project rules are aggregated in:

- `.planning/REQUIREMENTS.md` (LGPD-06 forbidden vocab, pt-BR output)
- `.planning/intel/constraints.md` (stack, prompt contract, NFR disclaimer)
- `.planning/intel/context.md` (Aurel Maat tone for affirmations)
- `.planning/STATE.md` (history; not re-read here for size)
- `.planning/config.json` (security_enforcement: true, ASVS L1, block_on: high; nyquist_validation: true; commit_docs: true)

Project-wide actionable directives (extracted across files):

- **pt-BR everywhere user-facing.** Code/tests/docs may be EN.
- **Forbidden vocabulary** in UI, prompts, reports: `diagnóstico`, `tratamento`, `cura`. Audit via `pnpm audit:vocabulary` (file scan, substring), `pnpm audit:vocabulary:db` (DB tags_livres, word-boundary). Phase 7 hardens to word-boundary in runtime audit (D-A2). System prompt allowed to cite the words as a list-of-banned (planner adds allowlist comment marker if scanner doesn't already exclude `prompts/`).
- **No `service-role` key in user-facing routes.** `analyze.ts` uses session per D-S1.
- **`import 'server-only'`** at top of `lib/*` files that handle secrets or RLS.
- **No `dangerouslyAllowBrowser` true** on Anthropic client.
- **Database changes via migration only** (`supabase/migrations/NNNN_name.sql`); types regen via `pnpm gen:types`.
- **No commits with secrets** (.env, credentials.json) — `.env.example` only.
- **Reading edits limited to `report_delivered`** — Fase 5 D-T4 forbids editing `vision_features` post-pipeline.
- **`commit_docs: true`** — research and plan docs are committed automatically.
- **`security_enforcement: true`, `security_block_on: 'high'`** — secure-phase agent will block phase close on HIGH severity findings.
- **`nyquist_validation: true`** — VALIDATION.md gate enforced.
- **`ui_safety_gate: true`** — third-party shadcn registries gate-checked. Phase 7 stays on official registry (Accordion).
- **`code_review: true, depth: standard`** — code-review agent runs on phase close.

## Sources

### Primary (HIGH confidence)

- `D:\Projetos\Iridologista\SPEC.md` §6 (lines 509-660) — system prompt + feature-injection template (literal source)
- `D:\Projetos\Iridologista\.planning\phases\07-analise-llm\07-CONTEXT.md` — founder discuss-phase decisions D-A1..A4, D-P1..P4, D-PR1..PR2, D-U1..U3, D-S1..S4, D-F1..F2, D-T1..T2
- `D:\Projetos\Iridologista\.planning\phases\07-analise-llm\07-UI-SPEC.md` — UI design contract approved 6/6 PASS
- `D:\Projetos\Iridologista\apps\web\lib\rag\search.ts` — `retrieveRelevantKnowledge` signature, frozen Fase 6 (lines 111-217)
- `D:\Projetos\Iridologista\apps\web\lib\rag\types.ts` — `ReportSection` enum (7 slugs)
- `D:\Projetos\Iridologista\apps\web\lib\rag\section-queries.ts` — D-R2B frozen, 7-slug Record
- `D:\Projetos\Iridologista\apps\web\package.json` — `@anthropic-ai/sdk@^0.92.0` confirmed
- `D:\Projetos\Iridologista\supabase\migrations\0005_*.sql` — style template for migration 0007
- `D:\Projetos\Iridologista\apps\web\scripts\audit-vocabulary.mjs` — DIRS array (line 21) — extension target D-A4
- `D:\Projetos\Iridologista\apps\web\scripts\audit-vocabulary-db.mjs` — W6 word-boundary regex pattern
- `D:\Projetos\Iridologista\apps\web\app\api\vision\webhook\route.ts` — Route Handler pattern (Fase 5)
- `D:\Projetos\Iridologista\.planning\REQUIREMENTS.md` — LLM-01..LLM-04 (lines 60-64)
- `D:\Projetos\Iridologista\.planning\ROADMAP.md` — Phase 7 goal + 5 success criteria (lines 205-217)
- `D:\Projetos\Iridologista\.planning\intel\constraints.md` — Stack LLM, Prompt Contract, NFR disclaimer
- `D:\Projetos\Iridologista\.planning\phases\10-aprendizagem-clinica\10-CONTEXT.md` — Pre-requisite schema for SAC (D-P2)
- `D:\Projetos\Iridologista\.planning\phases\06-rag-ingestao\06-CONTEXT.md` — RAG retrieval contract D-R1..R6
- `D:\Projetos\Iridologista\.planning\phases\05-pipeline-visao-modal\05-CONTEXT.md` — D-T4 status guard
- `https://platform.claude.com/docs/en/api/sdks/typescript` — Anthropic SDK TypeScript streaming API + error handling
- `https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching` — `cache_control: { type: 'ephemeral' }` API shape, 2048-token threshold for Sonnet 4.6, cache write/read pricing, response usage shape
- `https://platform.claude.com/docs/en/docs/about-claude/models` — `claude-sonnet-4-6` model ID, $3/$15 MTok pricing, 1M context, 64k max output, dateless format
- `https://nextjs.org/docs/app/api-reference/file-conventions/route` — Streaming Route Handler pattern, `params` Promise migration
- `https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config` — `runtime`, `maxDuration` config
- `https://vercel.com/docs/functions/limitations` — Fluid Compute max duration: 300s default, 800s Pro; Edge 25s TTFB constraint
- `https://github.com/kpdecker/jsdiff` — `diff@9` API, Change[] shape

### Secondary (MEDIUM confidence)

- `npm view @anthropic-ai/sdk version` (registry verified 2026-05-08, latest 0.95.1)
- `npm view react-markdown version` (10.1.0 latest)
- `npm view remark-gfm version` (4.0.1 latest)
- `npm view diff version` (9.0.0 latest, 3 weeks ago)
- Vercel `streaming` doc page (limited info; cross-verified with `limitations` doc which has the duration table)

### Tertiary (LOW confidence)

- None for the locked decisions in CONTEXT.md (founder + UI-SPEC checker validated)
- Sentence-split as canonical "afirmação" definition for anchor rate is a recommendation, not industry standard — labeled `[ASSUMED]` (A3)
- Production behavior of `outputFileTracingIncludes` for `.md` assets in Next.js 15 is a documented pattern but not in this project's history — labeled `[ASSUMED]` (A7)

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — every package version verified via `npm view` 2026-05-08; SDK behavior verified against official platform.claude.com docs; UI-SPEC v1 already approved by gsd-ui-checker
- Architecture: **HIGH** — pattern of Route Handler + Web Streams + section-boundary parsing is decomposable into established Next.js 15 + Anthropic SDK primitives; all component boundaries match UI-SPEC and existing project conventions (Fase 5 webhook, Fase 6 search.ts)
- Pitfalls: **HIGH-MEDIUM** — Pitfall 1 (key ordering), 5 (params Promise), 7 (regex parity) are concrete and verified against project code; Pitfall 2 (false positives) and 4 (cache silent fail) are anticipated but require integration smoke to confirm rate; Pitfall 9 (Next.js asset tracing) is assumed pattern from docs

**Research date:** 2026-05-08
**Valid until:** 2026-05-22 (14 days — Anthropic ships SDK updates roughly every 2 weeks; verify SDK version + caching API shape if planner waits longer)
