---
phase: 07-analise-llm
verified: 2026-05-08T19:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "Guarda C (SC2): markReadingDelivered agora verifica audit_metadata.low_anchor_rate — fail-closed quando null"
    - "Guarda B (SC4/CR-05): saveReportDelivered sobrescreve encerramento_disclaimer com ENCERRAMENTO_LITERAL server-side"
    - "Guarda D (CR-04): markReadingDelivered bloqueia entrega quando report_delivered é null ou {}"
    - "Guarda A (WR-08): saveReportDelivered verifica is_delivered antes do UPDATE"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Em /leituras/[id] com leitura ready, clicar 'Gerar análise' e observar: (a) seções aparecem incrementalmente, (b) contador N/13 atualiza, (c) disclaimer aparece no final, (d) CTA muda para 'Editar análise' após conclusão."
    expected: "Toda a UI-SPEC Surface 1 State B → State C funciona como descrito. Streaming fluído com 13 seções em pt-BR."
    why_human: "Comportamento dinâmico de streaming e transição de estado não é verificável estaticamente. Exige API Anthropic real."
  - test: "Gerar 3-5 análises com vision_features distintos e verificar manualmente que nenhuma das frases proibidas ('o cliente tem', 'diagnostica-se', 'está doente de', 'trauma confirmado aos X anos', 'diagnóstico', 'tratamento', 'cura') aparece no output."
    expected: "Zero ocorrências das frases proibidas em todos os relatórios gerados (SC3)."
    why_human: "Verificação programática via FORBIDDEN_VOCAB_RE existe, mas o teste de SC3 exige múltiplos relatórios reais contra a Anthropic API e revisão do framing contextual."
  - test: "Durante uma geração ativa, atualizar a página após 3-4 seções aparecerem. Verificar que as seções já geradas ainda estão visíveis."
    expected: "O progresso fica salvo — D-S2 (mid-stream UPDATEs do route.ts funcionando)."
    why_human: "Exige teste interativo com timing específico."
---

# Phase 7: Análise LLM — Verification Report (Re-verificação)

**Phase Goal:** Dado um `readings.vision_features` populado, o sistema gera um relatório iridológico em pt-BR que respeita os 5 princípios do prompt-base e a estrutura de 13 seções, e o terapeuta pode editar antes de entregar.
**Verified:** 2026-05-08T19:00:00Z
**Status:** human_needed
**Re-verification:** Sim — após fechamento dos 3 gaps (07-12-PLAN.md, commits fb87092 + 4257a90 + 0697967, merge 941d96f)

---

## Gaps Fechados (em relação a 07-VERIFICATION anterior)

| Gap | Descrição | Status Anterior | Status Atual |
|-----|-----------|-----------------|--------------|
| Gap A (WR-08) | saveReportDelivered bloqueava escrita em leitura já entregue | FAILED | CLOSED |
| Gap B (SC4/CR-05) | saveReportDelivered sobrescrevia encerramento_disclaimer com ENCERRAMENTO_LITERAL | FAILED | CLOSED |
| Gap C (SC2) | markReadingDelivered verificava low_anchor_rate + fail-closed em audit null | FAILED | CLOSED |
| Gap D (CR-04) | markReadingDelivered bloqueava entrega de report_delivered vazio/null | FAILED | CLOSED |

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidência |
|---|-------|--------|-----------|
| 1 | Terapeuta dispara "gerar análise" em `/leituras/[id]` com reading `ready`, relatório aparece em streaming, totalmente em pt-BR, com 13 seções numeradas (1. Constituição → 13. Mensagem Final) | ✓ VERIFIED | `route.ts` implementa POST streaming com ReadableStream. `parser.ts` detecta `^### N.` headings 1..13. `analise-client.tsx` consome o stream. `prompts/system.md` contém todos os 13 headings. `AnalysisHero` orquestra states A/B/C. Wiring completo verificado na verificação inicial — nenhuma regressão detectada (commits fb87092 + 4257a90 tocaram somente `analise.ts` e o arquivo de testes). |
| 2 | Cada interpretação cita `[ancorado em: features.X]`; auditoria automática **rejeita** relatórios em que >5% das afirmações de seções 2–6 não tenham âncora | ✓ VERIFIED | `audit.ts` calcula anchor rate (VERIFIED na verificação inicial). **NOVO:** `markReadingDelivered` (linha 141-147 de `analise.ts`) agora verifica `audit_metadata.low_anchor_rate` com fail-closed em `audit === null`: se `!audit` → retorna `'Auditoria de ancoragem ausente ou pendente...'`; se `audit.low_anchor_rate !== false` → retorna `'Âncora insuficiente...'`. O UPDATE em `is_delivered` não é alcançado. Teste #7 e #8 do `save-action.test.ts` validam os dois branches — 9 GREEN confirmados via `vitest run`. |
| 3 | Linguagem hipotética é respeitada: nenhuma ocorrência das frases proibidas em relatórios de teste | ? UNCERTAIN | `prompts/system.md` contém os 5 princípios literais da SPEC com frases proibidas explicitamente listadas. `audit.ts` com `FORBIDDEN_VOCAB_RE` está correto. Não é possível verificar programaticamente sem rodar o LLM em produção. Marcado UNCERTAIN (human needed) — idêntico à verificação anterior. |
| 4 | Disclaimer literal de encerramento (SPEC §6) aparece **sempre**, no fim de **todo** relatório | ✓ VERIFIED | Duas proteções agora ativas: (1) `route.ts` linha 163 appends `ENCERRAMENTO_LITERAL` ao `report_generated` após stream (VERIFIED na verificação inicial — não regredido); (2) **NOVO:** `saveReportDelivered` linha 83 de `analise.ts`: `delivered.encerramento_disclaimer = ENCERRAMENTO_LITERAL` sobrescreve qualquer payload do cliente ANTES do UPDATE em `report_delivered`. Teste #2 do `save-action.test.ts` valida byte-exact via `toBe(ENCERRAMENTO_LITERAL)`. Key link `analise.ts → types.ts via ENCERRAMENTO_LITERAL` agora WIRED (linha 30: `import { ENCERRAMENTO_LITERAL } from '@/lib/anthropic/types'`). |
| 5 | Em `/leituras/[id]/editar`, terapeuta ajusta texto e salva — `ai_report_edited` é gravado com `status='edited'`; `ai_report_raw` permanece intacto | ✓ VERIFIED | O fluxo principal de edição continua funcionando (verificado na verificação inicial — não regredido). **NOVOS guards ativos:** (a) Guarda D (linha 135-138): `markReadingDelivered` bloqueia se `report_delivered` é null ou `{}` (testes #5 e #6 GREEN); (b) Guarda A (linha 79): `saveReportDelivered` retorna error se `is_delivered === true`, protegendo leituras já entregues de reescrita (teste #1 GREEN). `report_generated` permanece intocado pelo fluxo de edição (saveReportDelivered não toca `report_generated`). |

**Score: 5/5 truths verificadas** (truth 3 é UNCERTAIN — human needed para confirmar linguagem hipotética em produção real — por design, não é gap corrigível por código)

---

### Required Artifacts

| Artifact | Esperado | Status | Detalhes |
|----------|----------|--------|---------|
| `apps/web/app/actions/analise.ts` | 4 guardas server-side novos + imports ENCERRAMENTO_LITERAL + AuditMetadata | ✓ VERIFIED | Linha 30: `import { ENCERRAMENTO_LITERAL }`. Linha 31: `import type { AuditMetadata, ReportJsonb }`. Linha 74: `is_delivered` no select de saveReportDelivered. Linha 79: Guarda A. Linha 83: Guarda B. Linha 127: `audit_metadata` no select de markReadingDelivered. Linhas 135-138: Guarda D. Linhas 140-147: Guarda C. 172 linhas total. |
| `apps/web/app/(dashboard)/leituras/[id]/editar/__tests__/save-action.test.ts` | 9 testes GREEN cobrindo 4 guardas | ✓ VERIFIED | 9 testes ativos (`it(`) + 3 `it.todo` com justificativas. `vitest run` confirma 9 passed, 0 failed. `ENCERRAMENTO_LITERAL` importado e comparado byte-exact (linha 158: `toBe(ENCERRAMENTO_LITERAL)`). |
| `apps/web/lib/anthropic/types.ts` | ENCERRAMENTO_LITERAL export, AuditMetadata interface | ✓ VERIFIED (sem mudança) | Linha 122-125: `ENCERRAMENTO_LITERAL` como template literal 4-line blockquote. Linha 66-73: `AuditMetadata` com `low_anchor_rate: boolean`. |
| `apps/web/app/api/readings/[id]/analyze/route.ts` | ENCERRAMENTO_LITERAL appended após stream (SC1/SC4 para report_generated) | ✓ VERIFIED (sem mudança) | Linha 163: `completedSections.encerramento_disclaimer = ENCERRAMENTO_LITERAL`. Não tocado pelos commits de gap closure. |

Todos os outros artifacts verificados na verificação inicial permanecem sem regressão (07-12 tocou apenas `analise.ts` e `save-action.test.ts`).

---

### Key Link Verification

| De | Para | Via | Status | Detalhes |
|----|------|-----|--------|---------|
| `analise.ts` | `apps/web/lib/anthropic/types.ts` | `import { ENCERRAMENTO_LITERAL } from '@/lib/anthropic/types'` | ✓ WIRED | Linha 30 — NOVO (era NOT_WIRED na verificação anterior). Resolveu CR-05. |
| `analise.ts` | `apps/web/lib/anthropic/types.ts` | `import type { AuditMetadata, ReportJsonb }` | ✓ WIRED | Linha 31 — AuditMetadata adicionado. |
| `analise-client.tsx` | `/api/readings/[id]/analyze` (POST) | `fetch + ReadableStream.getReader()` | ✓ WIRED | Não regredido — confirmado na verificação inicial. |
| `route.ts` | `ENCERRAMENTO_LITERAL` | server-append pós-stream linha 163 | ✓ WIRED | Não regredido — confirmado via grep. |
| `analise.ts saveReportDelivered` | `ENCERRAMENTO_LITERAL` | overwrite linha 83 | ✓ WIRED | NOVO — era NOT_WIRED. |
| `analise.ts saveReportDelivered` | `extractForbiddenHits` | importação + loop | ✓ WIRED | Não regredido. |
| `analise.ts markReadingDelivered` | `AuditMetadata` (cast + gate) | linha 141-147 | ✓ WIRED | NOVO. |
| `save-action.test.ts` | `saveReportDelivered, markReadingDelivered` | `import from '@/app/actions/analise'` linha 51 | ✓ WIRED | NOVO. |

---

### Data-Flow Trace (Level 4)

| Artifact | Variável | Fonte | Dados Reais | Status |
|----------|----------|-------|-------------|--------|
| `analise-client.tsx` | `accumulated` (buffer de texto) | `/api/readings/[id]/analyze` Response body stream | ReadableStream → texto LLM real | ✓ FLOWING (não regredido) |
| `route.ts` | `completedSections` | Anthropic SDK stream → parser → DB UPDATE | jsonb real persistido por seção | ✓ FLOWING (não regredido) |
| `editar/page.tsx` | `reportGenerated`, `reportDelivered` | Supabase SELECT com todos os campos necessários | Query real ao DB | ✓ FLOWING (não regredido) |
| `analise.ts saveReportDelivered` | `delivered` → `report_delivered` | bodyParsed.data + ENCERRAMENTO_LITERAL overwrite | Payload do cliente com disclaimer forçado | ✓ FLOWING (MELHORADO: disclaimer agora sempre presente) |

---

### Behavioral Spot-Checks

| Comportamento | Evidência / Comando | Status |
|---------------|---------------------|--------|
| Guarda A — saveReportDelivered bloqueia is_delivered=true | `analise.ts:79` + teste #1 `save-action.test.ts` GREEN | ✓ PASS |
| Guarda B — encerramento_disclaimer sobrescrito com ENCERRAMENTO_LITERAL | `analise.ts:83` + teste #2 byte-exact `toBe(ENCERRAMENTO_LITERAL)` GREEN | ✓ PASS |
| Guarda C — markReadingDelivered bloqueia low_anchor_rate=true | `analise.ts:142-147` + teste #7 GREEN | ✓ PASS |
| Guarda C — fail-closed quando audit_metadata é null | `analise.ts:143-144` + teste #8 GREEN | ✓ PASS |
| Guarda D — markReadingDelivered bloqueia report_delivered null | `analise.ts:136-138` + teste #5 GREEN | ✓ PASS |
| Guarda D — markReadingDelivered bloqueia report_delivered {} | `analise.ts:136-138` + teste #6 GREEN | ✓ PASS |
| Happy path — flip is_delivered=true com todos os gates passando | teste #9 GREEN: update chamado com `{ is_delivered: true, delivered_at: ... }` | ✓ PASS |
| ENCERRAMENTO_LITERAL appended em route.ts (SC1/SC4 para report_generated) | `route.ts:163` — não regredido | ✓ PASS |
| status='edited' após save | `analise.ts:94` — não regredido | ✓ PASS |
| report_generated NÃO sobrescrito pelo fluxo de edição | saveReportDelivered não toca report_generated — confirmado | ✓ PASS |
| Testes GREEN totais | `vitest run` — 9 passed (save-action), 405 passed geral, 3 failed (quality-scoring pré-existentes, fora de escopo fase 7) | ✓ PASS |

---

### Requirements Coverage

| Requisito | Plano(s) | Descrição | Status | Evidência |
|-----------|----------|-----------|--------|-----------|
| LLM-01 | 07-07, 07-08, 07-09 | `analyze.ts` carrega features, chama RAG, monta prompt, chama Sonnet 4.6 com streaming | ✓ SATISFIED | `analyze.ts` existe, `analyzeReading` com `retrieveRelevantKnowledge`, `messages.stream`, `cache_control`. Route Handler consome stream. UI em `/leituras/[id]` com CTA + streaming consumer. |
| LLM-02 | 07-02, 07-03 | Prompt-base com 5 princípios, linguagem hipotética, 13 seções | ✓ SATISFIED | `prompts/system.md` é cópia literal SPEC §6 com todos os 5 princípios e 13 headings. `ENCERRAMENTO_LITERAL` presente em `types.ts` e server-appended em `route.ts:163`. |
| LLM-03 | 07-05, 07-08 | Citação `[ancorado em: features.X]`; disclaimer literal sempre presente | ✓ SATISFIED | Auditoria de anchor rate implementada e agora BLOQUEIA entrega via `markReadingDelivered` (Guarda C). Disclaimer appended ao `report_generated` (route.ts) E sobrescrito em `report_delivered` (analise.ts Guarda B). Ambas as superfícies protegidas. |
| LLM-04 | 07-01, 07-10 | `ai_report_raw` persistido; UI edição; `ai_report_edited` gravado; status `edited` | ✓ SATISFIED | Schema com GENERATED columns. UI de edição completa. `saveReportDelivered` com `status='edited'`. Guards de integridade (Guarda A + Guarda D) fecham as lacunas CR-04 e WR-08. |

---

### Anti-Patterns Found

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---------|-------|--------|------------|---------|
| `route.ts` | 143-149 | UPDATE de seção mid-stream sem verificar resultado (error swallowed) | Warning | Seções podem falhar ao persistir silenciosamente — CR-03 do REVIEW. Não bloqueia nenhum SC do ROADMAP. |
| `route.ts` | 94, 191 | Leitura + incremento não-atômico de `regeneration_count` | Warning | TOCTOU: 2 requests concorrentes passam no gate — CR-01. Não bloqueia SCs. |
| `route.ts` | 64-67, 192 | `existingLog` capturado na REQUEST inicial; append não-atômico | Info | Concurrent requests sobrescrevem entradas do log — CR-02. |
| `route.ts` | 103-104 | `as { full_name?: string } | null` cast vs array do Supabase FK | Info | client_name pode ser undefined se Supabase retorna array — WR-02. |

**Nota:** Os 4 anti-patterns acima são pré-existentes (documentados na verificação inicial) e não afetam diretamente nenhum dos 5 critérios de sucesso do ROADMAP. Classificados como Warning/Info para consciência, não como blockers da fase.

Os 4 anti-patterns que eram Blockers na verificação anterior (CR-04, CR-05, WR-08 + SC2) foram **todos fechados** pelo plan 07-12.

---

### Human Verification Required

#### 1. Streaming UI com 13 Seções em Tempo Real (SC1)

**Teste:** Em `/leituras/[id]` com uma leitura `ready`, clicar "Gerar análise" e observar: (a) seções aparecem incrementalmente, (b) contador N/13 atualiza, (c) disclaimer aparece no final, (d) CTA muda para "Editar análise" após conclusão.
**Esperado:** Toda a UI-SPEC Surface 1 State B → State C funciona como descrito.
**Por que humano:** Comportamento dinâmico de streaming e transição de estado não é verificável estaticamente. Exige API Anthropic real.

#### 2. Linguagem Hipotética em Relatórios Reais (SC3)

**Teste:** Gerar 3-5 análises com `vision_features` distintos e verificar manualmente que nenhuma das frases proibidas ("o cliente tem", "diagnostica-se", "está doente de", "trauma confirmado aos X anos", "diagnóstico", "tratamento", "cura") aparece no output.
**Esperado:** Zero ocorrências das frases proibidas em todos os relatórios gerados.
**Por que humano:** Verificação programática via `FORBIDDEN_VOCAB_RE` existente, mas o teste de SC3 exige múltiplos relatórios reais contra a Anthropic API e revisão do framing contextual.

#### 3. Persistência D-S2 ao Atualizar Página Durante Geração

**Teste:** Durante uma geração ativa, atualizar a página após 3-4 seções aparecerem. Verificar que as seções já geradas ainda estão visíveis.
**Esperado:** O progresso fica salvo (D-S2 — mid-stream UPDATEs do route.ts).
**Por que humano:** Exige teste interativo com timing específico; depende do comportamento de UPDATE mid-stream que o REVIEW flagrou como tendo error swallowing (CR-03).

---

### Resumo da Re-verificação

**Todos os 3 gaps que bloqueavam a fase foram fechados pelo plan 07-12:**

- **Gap B → FECHADO (SC4/CR-05):** `saveReportDelivered` linha 83 agora sobrescreve `encerramento_disclaimer` com `ENCERRAMENTO_LITERAL` server-side antes de qualquer UPDATE. Validado byte-exact por teste #2 GREEN. Key link `analise.ts → ENCERRAMENTO_LITERAL` agora WIRED.

- **Gap A → FECHADO (SC2):** `markReadingDelivered` linhas 141-147 agora verificam `audit_metadata.low_anchor_rate` com fail-closed em `audit === null`. Dois branches distintos retornam `{ error }` antes do UPDATE em `is_delivered`. Validado por testes #7 (low=true) e #8 (null) GREEN.

- **Gap C → FECHADO (CR-04 + WR-08):** `markReadingDelivered` linhas 135-138 bloqueiam entrega quando `report_delivered` é null ou `{}`. `saveReportDelivered` linha 79 bloqueia escrita em leituras já entregues. Validado por testes #5, #6, #1 GREEN.

**Status pós-fechamento:** 5/5 truths verificadas. Truth 3 (SC3 — linguagem hipotética) permanece UNCERTAIN por design — requer verificação humana com API real. Status: `human_needed` (não `passed`) porque os 3 itens de verificação humana existem.

---

_Verified: 2026-05-08T19:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: após gap closure plan 07-12 (commits fb87092 + 4257a90 + 0697967, merge 941d96f)_
