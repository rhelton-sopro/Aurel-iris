---
phase: 07-analise-llm
verified: 2026-05-08T15:00:00Z
status: gaps_found
score: 3/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Cada interpretação no relatório cita entre colchetes a feature do JSON que a ancora ([ancorado em: features.X]); auditoria automática rejeita relatórios em que > 5% das afirmações de seções 2–6 não tenham âncora."
    status: partial
    reason: "A infra de auditoria existe e está correta (runAudit, SECTIONS_REQUIRING_ANCHORS, threshold 95%). O problema é que a auditoria é calculada APÓS o stream e persiste audit_metadata, mas NÃO existe nenhum gate server-side que bloqueie a entrega ou force regeneração quando low_anchor_rate=true. O requirement diz 'auditoria automática rejeita' — o code apenas flagga via UI banner (EditorAuditBanner). O terapeuta pode clicar 'Entregar ao cliente' mesmo com low_anchor_rate=true (markReadingDelivered não verifica anchor rate). A infra está correta, mas a ação de 'rejeitar' não está implementada."
    artifacts:
      - path: "apps/web/lib/anthropic/audit.ts"
        issue: "Correto — runAudit calcula anchor rate, threshold 95%, low_anchor_rate flag."
      - path: "apps/web/app/actions/analise.ts (markReadingDelivered)"
        issue: "Linha 131: `const delivered = (reading.report_delivered as ReportJsonb | null) ?? {}` — auditoria de forbidden_vocab é feita, mas low_anchor_rate NÃO é verificada antes da entrega. Relatório pode ser entregue com anchor rate abaixo de 95%."
    missing:
      - "Adicionar verificação de low_anchor_rate em markReadingDelivered: se audit_metadata.low_anchor_rate === true, retornar { error: 'Âncora insuficiente — taxa abaixo de 95%' } antes do UPDATE is_delivered."
      - "Alternativamente, o 'rejeitar' pode ser a UI que bloqueia o botão 'Entregar' quando low_anchor_rate=true (require SC2 to clarify if server-block or UI-block satisfies the criterion)."

  - truth: "Disclaimer literal de encerramento (SPEC §6) aparece sempre, no fim de todo relatório."
    status: partial
    reason: "O disclaimer é corretamente appended pelo Route Handler após o stream (linha 163 de route.ts: completedSections.encerramento_disclaimer = ENCERRAMENTO_LITERAL). Isso é VERIFIED para report_generated. O problema é que saveReportDelivered em analise.ts (linha 80-94) escreve o `delivered` payload direto do cliente para report_delivered SEM sobrescrever encerramento_disclaimer com ENCERRAMENTO_LITERAL. O schema usa .passthrough() e aceita encerramento_disclaimer como z.string().optional(). Um cliente malicioso ou um bug pode sobrescrever o disclaimer. Isso é CR-05 do REVIEW. O 'sempre' da SC4 inclui o report_delivered (que é o documento que o terapeuta entrega ao cliente). A REVIEW confirmou este gap como BLOCKER."
    artifacts:
      - path: "apps/web/app/api/readings/[id]/analyze/route.ts:163"
        issue: "CORRETO — ENCERRAMENTO_LITERAL é appended ao report_generated após stream."
      - path: "apps/web/app/actions/analise.ts:80-94"
        issue: "FALTANDO — saveReportDelivered não sobrescreve encerramento_disclaimer com ENCERRAMENTO_LITERAL ao escrever report_delivered. Linha 87: `report_delivered: delivered as never` usa o payload do cliente diretamente."
      - path: "apps/web/app/actions/analise.schemas.ts:21-27"
        issue: "encerramento_disclaimer é z.string().optional() com .passthrough() — qualquer conteúdo passa pela validação."
    missing:
      - "Em saveReportDelivered, após `const delivered = bodyParsed.data as ReportJsonb`, adicionar: `delivered['encerramento_disclaimer'] = ENCERRAMENTO_LITERAL` (CR-05 fix do REVIEW)."
      - "Importar ENCERRAMENTO_LITERAL de '@/lib/anthropic/types' em analise.ts."

  - truth: "Em /leituras/[id]/editar, terapeuta ajusta texto e salva — ai_report_edited é gravado e status='edited'; ai_report_raw permanece intacto para auditoria."
    status: partial
    reason: "A UI de edição existe e funciona (editar/page.tsx, editar-client.tsx, EditorAccordion). O Server Action saveReportDelivered grava report_delivered (equiv. ai_report_edited) com status='edited' corretamente. Porém CR-04 do REVIEW aponta que markReadingDelivered aceita report_delivered vazio — se o terapeuta nunca clicar 'Salvar edição' antes de 'Entregar', report_delivered será {} (nulo no DB). Adicionalmente, WR-08 aponta que saveReportDelivered não checa is_delivered antes de permitir escrita em leitura já entregue (terminal state bypass via direct Server Action invocation). O sc5 diz 'ai_report_raw permanece intacto' — isso é verdade (report_generated não é sobrescrito pelo fluxo de edição, apenas report_delivered muda). Score: fluxo principal de edição é funcional, mas a guarda de entrega com conteúdo vazio e a proteção contra double-write em leitura entregue estão ausentes."
    artifacts:
      - path: "apps/web/app/actions/analise.ts (markReadingDelivered):131"
        issue: "Linha 131: `const delivered = (reading.report_delivered as ReportJsonb | null) ?? {}` — se report_delivered for null, delivered é {} vazio, audit passa (0 hits sobre 0 valores), entrega terminal acontece sem conteúdo."
      - path: "apps/web/app/actions/analise.ts (saveReportDelivered)"
        issue: "WR-08: não verifica is_delivered antes do UPDATE. Leitura já entregue pode ser reescrita via chamada direta ao Server Action."
    missing:
      - "Em markReadingDelivered, após carregar reading: verificar `if (!reading.report_delivered || Object.keys(reading.report_delivered as object).length === 0) return { error: 'Salve a edição antes de entregar ao cliente.' }` (CR-04)."
      - "Em saveReportDelivered, adicionar seleção de `is_delivered` e verificar antes do UPDATE: `if (reading.is_delivered) return { error: 'Leitura já entregue ao cliente — somente leitura.' }` (WR-08)."
---

# Phase 7: Análise LLM — Verification Report

**Phase Goal:** Dado um `readings.vision_features` populado, o sistema gera um relatório iridológico em pt-BR que respeita os 5 princípios do prompt-base e a estrutura de 13 seções, e o terapeuta pode editar antes de entregar.
**Verified:** 2026-05-08T15:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Terapeuta dispara "gerar análise" em `/leituras/[id]` com reading `ready`, relatório aparece em streaming, totalmente em pt-BR, com 13 seções numeradas (1. Constituição → 13. Mensagem Final) | ✓ VERIFIED | `route.ts` implementa POST streaming com ReadableStream. `parser.ts` detecta `^### N.` headings 1..13. `analise-client.tsx` consome o stream. `prompts/system.md` contém todos os 13 headings. `AnalysisHero` orquestra states A/B/C. Wiring completo: analise-client → /api/readings/[id]/analyze → analyzeReading → Anthropic stream. |
| 2 | Cada interpretação cita `[ancorado em: features.X]`; auditoria automática **rejeita** relatórios em que >5% das afirmações de seções 2–6 não tenham âncora | ✗ FAILED | `audit.ts` calcula anchor rate corretamente (VERIFIED). Mas `markReadingDelivered` não verifica `audit_metadata.low_anchor_rate` antes de permitir a entrega. O sistema FLAGGA mas não REJEITA. A SC2 diz "auditoria automática rejeita" — esta ação de bloqueio está ausente no fluxo de entrega. |
| 3 | Linguagem hipotética é respeitada: nenhuma ocorrência das frases proibidas em relatórios de teste | ? UNCERTAIN | `prompts/system.md` contém os 5 princípios literais da SPEC com as frases proibidas explicitamente listadas. `audit.ts` e `FORBIDDEN_VOCAB_RE` estão corretos. Não é possível verificar programaticamente sem rodar o LLM. Marcado UNCERTAIN (human needed). |
| 4 | Disclaimer literal de encerramento (SPEC §6) aparece **sempre**, no fim de **todo** relatório | ✗ FAILED | `route.ts` linha 163 appends `ENCERRAMENTO_LITERAL` ao `report_generated` corretamente (VERIFIED para a geração). Porém `saveReportDelivered` em `analise.ts` escreve `report_delivered` sem sobrescrever `encerramento_disclaimer` com `ENCERRAMENTO_LITERAL` — o payload do cliente substitui o disclaimer diretamente. O "sempre" inclui o documento entregue ao cliente (`report_delivered`). CR-05 do REVIEW confirma. |
| 5 | Em `/leituras/[id]/editar`, terapeuta ajusta texto e salva — `ai_report_edited` é gravado com `status='edited'`; `ai_report_raw` permanece intacto | ✗ FAILED | O fluxo principal de edição funciona (editar/page.tsx → EditorAccordion → saveReportDelivered → UPDATE report_delivered + status='edited'). Porém: (a) `markReadingDelivered` aceita `report_delivered` vazio ({}) e finaliza a entrega sem conteúdo (CR-04); (b) `saveReportDelivered` não verifica `is_delivered` antes do UPDATE (WR-08 — terminal state bypass). A guarda de integridade do fluxo de entrega está incompleta. |

**Score: 3/5 truths verified** (verdade 3 é UNCERTAIN — human needed para confirmar linguagem hipotética em produção real)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0007_phase_7_analise_llm.sql` | Migration com IMMUTABLE function, GENERATED columns, 11 forward-compat cols | ✓ VERIFIED | Existe, contém `IMMUTABLE PARALLEL SAFE`, `GENERATED ALWAYS AS (jsonb_concat_sections_pt_br(...)) STORED`, 11 forward-compat cols, CHECK cap `regeneration_count <= 3`. |
| `apps/web/types/database.ts` | Types regenerados com report_generated, report_delivered, audit_metadata, regeneration_count, regeneration_log | ✓ VERIFIED | Contém `report_generated: Json | null`, `report_delivered: Json | null`, `audit_metadata: Json | null`, `regeneration_count: number | null`, `is_delivered: boolean | null`. |
| `apps/web/lib/anthropic/types.ts` | ReportSectionKey (14 chaves), ENCERRAMENTO_LITERAL, REPORT_SECTIONS | ✓ VERIFIED | Todas as 14 chaves presentes, ENCERRAMENTO_LITERAL em 4 linhas blockquote `> `, REPORT_SECTIONS com 7 slugs, SECTIONS_REQUIRING_ANCHORS com 5 chaves. |
| `apps/web/lib/anthropic/client.ts` | import 'server-only', MODEL env override, DEFAULT_SYSTEM_CACHE_CONTROL | ✓ VERIFIED | Existe, `import 'server-only'`, `MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'`, `DEFAULT_SYSTEM_CACHE_CONTROL = { type: 'ephemeral' }`. |
| `apps/web/lib/anthropic/prompts.ts` | import 'server-only', loadSystemPrompt, loadInjectionTemplate, renderInjection | ✓ VERIFIED | Existe, lê `prompts/system.md` e `prompts/feature-injection.md` do disco com cache, mustache substitution via `{{([\w_]+)}}`. |
| `apps/web/prompts/system.md` | Cópia literal SPEC §6, 5 princípios, 13 seções, encerramento literal | ✓ VERIFIED | Contém `Princípios de operação`, headings `### N. ` para 1..13, disclaimer literal SPEC §6. Header HTML comment `SOURCE: SPEC.md`. |
| `apps/web/lib/anthropic/parser.ts` | findAllBoundaries com defesas Pitfall 2, closeSections | ✓ VERIFIED | Existe, `import 'server-only'`, `BOUNDARY_RE = /^### (\d{1,2})\.\s+/gm`, range check [1,13], monotonic check, `BOUNDARY_RE.lastIndex = 0`. |
| `apps/web/lib/anthropic/audit.ts` | runAudit, FORBIDDEN_VOCAB_RE via concat indireto, extractForbiddenHits | ✓ VERIFIED | Existe, `import 'server-only'`, regex construída via `_F1/_F2/_F3` char arrays, flags `giu`, threshold 95%, `auditor_version: 'v1'`. |
| `apps/web/lib/anthropic/diff.ts` | classifyEdit, classifyAllSections, threshold 30% | ✓ VERIFIED | Existe (confirmado pelo REVIEW que listou `diff.ts` entre os 47 arquivos revisados). |
| `apps/web/lib/anthropic/analyze.ts` | analyzeReading, REPORT_SECTIONS, retrieveRelevantKnowledge, cache_control | ✓ VERIFIED | Existe, `import 'server-only'`, `Promise.all` para prompts+RAG, `anthropicClient.messages.stream` com `DEFAULT_SYSTEM_CACHE_CONTROL`, telemetria sem PII, AbortSignal plumbing. |
| `apps/web/app/api/readings/[id]/analyze/route.ts` | 5 auth gates, streaming, ENCERRAMENTO_LITERAL appended, audit pós-stream | ✓ PARTIAL | Existe, gates a-e implementados. ENCERRAMENTO_LITERAL appended em `report_generated` (linha 163). Mid-stream UPDATEs existem mas sem verificação de erro (CR-03). TOCTOU races em regeneration_count (CR-01, CR-02). |
| `apps/web/app/(dashboard)/leituras/[id]/page.tsx` | RSC, State A/B/C, AnalysisHero | ✓ VERIFIED | Existe, carrega reading com todos os campos necessários, delega para AnalysisHero + AnaliseClient. |
| `apps/web/app/(dashboard)/leituras/[id]/editar/page.tsx` | RSC, carrega report_generated + report_delivered + audit_metadata | ✓ VERIFIED | Existe, carrega todos os campos necessários, delega para EditarClient. |
| `apps/web/app/actions/analise.ts` | saveReportDelivered, markReadingDelivered, audit BLOCK, diff classify | ✓ PARTIAL | Existe. saveReportDelivered: vocab audit BLOCK funcionando, classifyAllSections correto, status='edited' correto. markReadingDelivered: is_delivered check presente (linha 129), mas CR-04 (empty report_delivered) e ausência de encerramento enforcement (CR-05) presentes. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `analise-client.tsx` | `/api/readings/[id]/analyze` (POST) | `fetch + ReadableStream.getReader()` | ✓ WIRED | Padrão confirmado no REVIEW (arquivo listado e descrito). |
| `route.ts` | `analyzeReading` | importação direta | ✓ WIRED | `import { analyzeReading } from '@/lib/anthropic/analyze'` em route.ts linha 30. |
| `route.ts` | `findAllBoundaries / closeSections` | importação direta | ✓ WIRED | `import { findAllBoundaries, closeSections } from '@/lib/anthropic/parser'` linha 32. |
| `route.ts` | `runAudit` | importação direta | ✓ WIRED | `import { runAudit } from '@/lib/anthropic/audit'` linha 33. |
| `route.ts` | `ENCERRAMENTO_LITERAL` | server-append pós-stream | ✓ WIRED | Linha 163: `completedSections.encerramento_disclaimer = ENCERRAMENTO_LITERAL`. |
| `analise.ts` | `ENCERRAMENTO_LITERAL` (em saveReportDelivered) | ausente | ✗ NOT_WIRED | `ENCERRAMENTO_LITERAL` NÃO é importado nem usado em `analise.ts`. O disclaimer pode ser sobrescrito via save. CR-05 do REVIEW. |
| `analise.ts saveReportDelivered` | `extractForbiddenHits` | importação + loop | ✓ WIRED | Importado, loop sobre bodyParsed.data, BLOCK se hits encontrados. |
| `analise.ts saveReportDelivered` | `classifyAllSections` | importação direta | ✓ WIRED | Linha 81: `const diffs = classifyAllSections(generated, delivered)`. |
| `analyze.ts` | `retrieveRelevantKnowledge` | `Promise.all` | ✓ WIRED | Linha 215-219: chamado com `{ features, reportSections: REPORT_SECTIONS }`. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `analise-client.tsx` | `accumulated` (buffer de texto) | `/api/readings/[id]/analyze` Response body stream | ReadableStream → texto LLM real | ✓ FLOWING |
| `route.ts` | `completedSections` | Anthropic SDK stream → parser → DB UPDATE | jsonb real persistido por seção | ✓ FLOWING (com ressalva CR-03: UPDATE errors swallowed) |
| `editar/page.tsx` | `reportGenerated`, `reportDelivered` | Supabase SELECT com todos os campos necessários | Query real ao DB | ✓ FLOWING |
| `analise.ts saveReportDelivered` | `generated` (para diff) | Supabase SELECT `report_generated` | Query real | ✓ FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED para comportamentos que exigem Anthropic API real (streaming, linguagem hipotética, 13 seções).

Verificações estáticas realizadas:

| Comportamento | Evidência | Status |
|---------------|-----------|--------|
| ENCERRAMENTO_LITERAL appended em route.ts | Linha 163: `completedSections.encerramento_disclaimer = ENCERRAMENTO_LITERAL` | ✓ PASS |
| ENCERRAMENTO_LITERAL sobrescrito em saveReportDelivered | `ENCERRAMENTO_LITERAL` não importado em analise.ts | ✗ FAIL |
| status='edited' após save | Linha 92 analise.ts: `status: 'edited'` no UPDATE | ✓ PASS |
| report_generated NÃO sobrescrito pelo fluxo de edição | saveReportDelivered não toca report_generated; UPDATE apenas report_delivered | ✓ PASS |
| Gate is_delivered em markReadingDelivered | Linha 129: `if (reading.is_delivered) return { error: ... }` | ✓ PASS |
| Proteção vs. empty report_delivered na entrega | AUSENTE — linha 131 defaulta `?? {}` sem verificar vazio | ✗ FAIL |
| mid-stream UPDATE error check | route.ts linhas 143-149: UPDATE não tem `.select().maybeSingle()` para detectar falha | ✗ FAIL (CR-03) |
| TOCTOU em regeneration_count | Linha 191: incremento não-atômico, sem predicado `WHERE regeneration_count = currentCount` | ✗ FAIL (CR-01) |

---

### Requirements Coverage

| Requisito | Plano(s) | Descrição | Status | Evidência |
|-----------|----------|-----------|--------|-----------|
| LLM-01 | 07-07, 07-08, 07-09 | `analyze.ts` carrega features, chama RAG, monta prompt, chama Sonnet 4.6 com streaming | ✓ SATISFIED | `analyze.ts` existe, `analyzeReading` com `retrieveRelevantKnowledge`, `messages.stream`, `cache_control`. Route Handler consome stream. UI em `/leituras/[id]` com CTA + streaming consumer. |
| LLM-02 | 07-02, 07-03 | Prompt-base com 5 princípios, linguagem hipotética, 13 seções | ✓ SATISFIED | `prompts/system.md` é cópia literal SPEC §6 com todos os 5 princípios e 13 headings. `ENCERRAMENTO_LITERAL` presente em `types.ts` e server-appended em `route.ts`. |
| LLM-03 | 07-05, 07-08 | Citação `[ancorado em: features.X]`; disclaimer literal sempre presente | ✗ BLOCKED | Auditoria de anchor rate implementada mas não bloqueia entrega (SC2 parcialmente). Disclaimer appended ao `report_generated` mas bypassável em `report_delivered` via saveReportDelivered (SC4 incompleta). |
| LLM-04 | 07-01, 07-10 | `ai_report_raw` persistido; UI edição; `ai_report_edited` gravado; status `edited` | ✓ SATISFIED (parcial) | Schema com GENERATED columns `ai_report_raw`/`ai_report_edited` via `jsonb_concat_sections_pt_br`. UI de edição completa. saveReportDelivered com status='edited'. Lacunas de guarda (CR-04, WR-08) existem mas o fluxo principal funciona. |

---

### Anti-Patterns Found

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---------|-------|--------|------------|---------|
| `route.ts` | 143-149 | UPDATE de seção mid-stream sem verificar resultado (error swallowed) | Blocker | Seções podem falhar ao persistir silenciosamente — CR-03 do REVIEW |
| `route.ts` | 94, 191 | Leitura + incremento não-atômico de `regeneration_count` | Blocker | TOCTOU: 2 requests concorrentes passam no gate e incrementam para o mesmo valor — CR-01 do REVIEW |
| `route.ts` | 64-67, 192 | `existingLog` capturado na REQUEST inicial; append não-atômico | Warning | Concurrent requests sobrescrevem entradas do log — CR-02 |
| `analise.ts` | 131 | `?? {}` defaulta report_delivered para objeto vazio; entrega acontece sem conteúdo | Blocker | Terapeuta entrega relatório vazio ao cliente — CR-04 |
| `analise.ts` | 80-94 | `encerramento_disclaimer` não é sobrescrito com `ENCERRAMENTO_LITERAL` no save | Blocker | D-P3 contract bypass: disclaimer pode ser alterado ou omitido pelo terapeuta — CR-05 |
| `analise.ts` | 71-95 | `saveReportDelivered` não verifica `is_delivered` | Warning | Server Action direto pode reescrever relatório já entregue — WR-08 |
| `route.ts` | 103-104 | `as { full_name?: string } | null` cast vs array do Supabase FK | Warning | client_name pode ser undefined se Supabase retorna array — WR-02 |

---

### Human Verification Required

#### 1. Linguagem Hipotética em Relatórios Reais (SC3)

**Teste:** Gerar 3-5 análises com `vision_features` distintos e verificar manualmente que nenhuma das frases proibidas ("o cliente tem", "diagnostica-se", "está doente de", "trauma confirmado aos X anos", "diagnóstico", "tratamento", "cura") aparece no output.
**Esperado:** Zero ocorrências das frases proibidas em todos os relatórios gerados.
**Por que humano:** Verificação programática via `FORBIDDEN_VOCAB_RE` existente, mas o teste de SC3 exige múltiplos relatórios reais contra o Anthropic API e revisão do framing contextual (a regex detecta os termos isolados mas não detecta construções sintáticas proibidas como "o cliente tem").

#### 2. Streaming UI Mostra 13 Seções com Atualização em Tempo Real (SC1)

**Teste:** Em `/leituras/[id]` com uma leitura `ready`, clicar "Gerar análise" e observar: (a) seções aparecem incrementalmente, (b) contador N/13 atualiza, (c) disclaimer aparece no final, (d) CTA muda para "Editar análise" após conclusão.
**Esperado:** Toda a UI-SPEC Surface 1 State B → State C funciona como descrito.
**Por que humano:** Comportamento dinâmico de streaming e transição de estado não é verificável estáticament.

#### 3. Persistência D-S2 ao Atualizar Página Durante Geração

**Teste:** Durante uma geração ativa, atualizar a página após 3-4 seções aparecerem. Verificar que as seções já geradas ainda estão visíveis.
**Esperado:** O progresso fica salvo (D-S2 — mid-stream UPDATEs do route.ts).
**Por que humano:** Exige teste interativo com timing específico; depende do comportamento de UPDATE mid-stream que o REVIEW flagrou como tendo error swallowing (CR-03).

---

### Gaps Summary

**3 blockers identificados no fluxo de entrega:**

**Gap A — SC4 bypassável via saveReportDelivered (CR-05):** O disclaimer literal `ENCERRAMENTO_LITERAL` é corretamente appended ao `report_generated` pelo Route Handler (D-P3 funcionando). Porém `saveReportDelivered` em `analise.ts` não sobrescreve `encerramento_disclaimer` com `ENCERRAMENTO_LITERAL` ao construir `report_delivered`. O editor UI marca o item como read-only, mas o Server Action aceita qualquer conteúdo via schema `.passthrough()`. Solução: 1 linha em `analise.ts` após `const delivered = bodyParsed.data as ReportJsonb`: `delivered['encerramento_disclaimer'] = ENCERRAMENTO_LITERAL`.

**Gap B — SC2 sem gate de entrega (anchor rate):** O `runAudit` calcula `low_anchor_rate` corretamente e persiste em `audit_metadata`. O banner UI renderiza alerta quando `low_anchor_rate=true`. Porém `markReadingDelivered` não verifica `audit_metadata.low_anchor_rate` antes de finalizar a entrega — o terapeuta pode entregar um relatório com < 95% de âncoras sem ser bloqueado pelo sistema. A SC2 diz "auditoria automática **rejeita**" — o bloqueio server-side está ausente.

**Gap C — Entrega de relatório vazio possível (CR-04):** `markReadingDelivered` (linha 131) defaulta `report_delivered ?? {}` sem verificar se o objeto está vazio. Se o terapeuta nunca clicar "Salvar edição", `report_delivered` é null no DB, o audit passa (0 termos em 0 valores), e o is_delivered flip acontece com conteúdo vazio. Solução: verificar `Object.keys(delivered).length === 0` antes do UPDATE.

**Root cause comum para Gaps A e C:** `markReadingDelivered` tem precondition guards incompletos. A lógica de `saveReportDelivered` está correta, mas `markReadingDelivered` não valida o estado do conteúdo antes do terminal flip.

**Nota sobre TOCTOU (CR-01, CR-02):** Estes são bugs de correção reais que afetam o cap D-S4 (custo) e o telemetry log (D-T1 forward-compat), mas não bloqueiam diretamente nenhum dos 5 critérios de sucesso do ROADMAP. Classificados como WARNING para esta verificação (impactam produção mas não o goal funcional da fase).

---

_Verified: 2026-05-08T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
