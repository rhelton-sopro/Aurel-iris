---
phase: 07-analise-llm
plan: 07
subsystem: lib-anthropic
tags: [phase-7, wave-4, analyze, orchestrator, streaming, server-only, D-PR1, D-PR2, D-T1]

requires:
  - phase: 07-analise-llm
    plan: 03
    provides: client.ts (anthropicClient, MODEL, DEFAULT_SYSTEM_CACHE_CONTROL, MAX_OUTPUT_TOKENS, estimateCostUsd) + prompts.ts (loadSystemPrompt, loadInjectionTemplate, renderInjection) + types.ts (REPORT_SECTIONS 7-slug array, ReportJsonb)
  - phase: 07-analise-llm
    plan: 04
    provides: parser.ts (parseSections, findAllBoundaries, closeSections) for Route Handler buffer parsing
  - phase: 07-analise-llm
    plan: 05
    provides: audit.ts (runAudit, FORBIDDEN_VOCAB_RE) for D-A1 anchor rate + D-N6 vocab audit
  - phase: 07-analise-llm
    plan: 06
    provides: diff.ts (classifyEdit, classifyAllSections) for D-U2 edit classification
  - phase: 06-rag-ingestao
    plan: 11
    provides: search.ts retrieveRelevantKnowledge (frozen Fase 6 contract D-R1)

provides:
  - apps/web/lib/anthropic/analyze.ts (analyzeReading orchestrator — 174 linhas, server-only)
  - apps/web/lib/rag/__tests__/section-queries.test.ts (D-PR2 CI gate — 4 testes GREEN, era 1 it.todo)

affects: [07-08]

tech-stack:
  added: []
  patterns:
    - "Promise.all([loadSystemPrompt(), loadInjectionTemplate(), retrieveRelevantKnowledge()]) — prompts carregados de FS (module-cache) + RAG retrieval em paralelo antes de abrir stream"
    - "anthropicClient.messages.stream() returning AsyncStream<MessageStreamEvent> — toTextStream() async generator filters content_block_delta/text_delta events"
    - "finalize() awaits llmStream.finalMessage() after stream loop completes — caller pattern: for await (delta of result.stream) { buffer += delta } then await result.finalize()"
    - "AbortSignal wired via signal.addEventListener('abort', () => llmStream.controller.abort()) — Route Handler 07-08 passes request.signal"
    - "concatChunksForKnowledge: [source_book, p.N] text format with \\n\\n separator — citation-aware RAG chunk injection"

key-files:
  created:
    - apps/web/lib/anthropic/analyze.ts (174 linhas — analyzeReading, AnalyzeArgs, AnalyzeResult, AnalyzeFinalization, concatChunksForKnowledge)
  modified:
    - apps/web/lib/rag/__tests__/section-queries.test.ts (46 linhas — 1 it.todo → 4 real tests GREEN)

key-decisions:
  - "Auth gate is NOT in analyze.ts — Route Handler 07-08 validates session + ownership + status + regen-cap BEFORE calling analyzeReading. analyze.ts can be called from admin scripts too."
  - "AbortSignal plumbing: signal passed as optional arg, wired to llmStream.controller.abort() on abort event. Route Handler passes request.signal to enable user tab-close stream cancellation (T-7-COST mitigation)."
  - "0 RAG chunks behavior: continua com rag_chunks_concatenated_with_citations = '' (empty string). renderInjection substitui o placeholder por string vazia — Sonnet pivota para conhecimento generalista per SPEC §6 Princípio 3. No throw, no warning. Compatible com integration smoke."
  - "toTextStream() yields string deltas (not Uint8Array). Route Handler 07-08 wraps in TextEncoder for Web ReadableStream (RESEARCH §Pattern 2). analyze.ts stays pure — no HTTP primitives."
  - "finalize() called after stream exhausted. Timing: startedAt captured at analyzeReading() call, latency_ms = Date.now() - startedAt at finalize() time — includes RAG + prompt build + full stream."
  - "renderInjection 6 vars: client_name (clientName arg), age (clientAge.toString() or ''), therapist_notes (therapistNotes ?? ''), iris_map (irisMap ?? 'jensen'), vision_features_json (JSON.stringify(visionFeatures, null, 2)), rag_chunks_concatenated_with_citations (concatChunksForKnowledge(ragChunks))."

requirements-completed: [LLM-01, LLM-02, LLM-03]

duration: ~6 min
completed: 2026-05-08T16:39:00Z
---

# Phase 7 Plan 07: analyze.ts orchestrator + D-PR2 CI gate — Summary

**Server-only `analyzeReading()` orchestrator: parallel prompt-load + RAG retrieval via Fase 6 `retrieveRelevantKnowledge`, mustache injection com 6 vars, Anthropic stream com `cache_control: ephemeral`, AbortSignal plumbing, D-T1 telemetria sem PII. D-PR2 CI gate em `section-queries.test.ts` (Wave-0 stub → 4 testes GREEN) garante que REPORT_SECTIONS ⊆ SECTION_QUERY_TEMPLATES nunca deriva silenciosamente.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-08T16:33:00Z
- **Completed:** 2026-05-08T16:39:00Z
- **Tasks:** 2 (Task 1 analyze.ts + Task 2 D-PR2 test)
- **Files created:** 1 (`analyze.ts`, 174 linhas)
- **Files modified:** 1 (`section-queries.test.ts`, 1 it.todo → 4 real tests)
- **Commits:** 2 atômicos

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `4eb0a5b` | feat | author lib/anthropic/analyze.ts orchestrator (174 linhas) |
| `dfa96aa` | test | flip section-queries.test.ts to D-PR2 CI gate (4 tests GREEN) |

## Tasks Summary

### Task 1: lib/anthropic/analyze.ts (feat)

`analyzeReading(args: AnalyzeArgs): Promise<AnalyzeResult>` — único entry point para LLM streaming de Fase 7.

**Composition flow:**
1. `Promise.all([loadSystemPrompt(), loadInjectionTemplate(), retrieveRelevantKnowledge({ features, reportSections: REPORT_SECTIONS })])` — prompts de FS + RAG Fase 6 em paralelo
2. `renderInjection(template, { client_name, age, therapist_notes, iris_map, vision_features_json, rag_chunks_concatenated_with_citations })` — mustache 6 vars
3. `anthropicClient.messages.stream({ model, max_tokens, system: [{ type: 'text', text, cache_control: DEFAULT_SYSTEM_CACHE_CONTROL }], messages: [{ role: 'user', content }] })`
4. AbortSignal wiring: `signal.addEventListener('abort', () => llmStream.controller.abort())`
5. Returns `{ stream: toTextStream(), finalize }` — Route Handler consumes stream, then awaits finalize()

**Telemetria D-T1 (sem PII):** `console.info({ event: 'llm_generate', reading_id, therapist_id, model_version, n_chunks_rag, latency_ms, tokens_in, tokens_out, cache_creation_input_tokens, cache_read_input_tokens, cost_estimate_usd })`

**Verification gates:**
- `pnpm tsc --noEmit` — zero erros novos para analyze.ts
- `pnpm audit:vocabulary` — 8 pre-existing hits (baseline Phase 3), zero hits em lib/anthropic/analyze.ts
- Node check: 11/11 acceptance criteria OK (server-only, retrieveRelevantKnowledge, REPORT_SECTIONS, cache_control, console.info sem PII, AbortSignal, mustache vars)

### Task 2: lib/rag/__tests__/section-queries.test.ts (test)

D-PR2 frozen contract CI gate. Wave-0 stub (1 `it.todo`) substituído por 4 testes reais:

1. `every slug REPORT_SECTIONS passes is a key in SECTION_QUERY_TEMPLATES` — set diff == []
2. `REPORT_SECTIONS tem exatamente 7 slugs (Fase 6 D-R2B contract)` — length === 7
3. `SECTION_QUERY_TEMPLATES tem >= 7 keys (pode adicionar mais sem quebrar)` — extensível
4. `cada template em SECTION_QUERY_TEMPLATES retorna array com >= 1 query string` — cada slug chamado com `{ constitution: { primary: 'linfática' } }` retorna `string[]` não-vazio

**Result:** 4 passed, 0 failed (verified via main project node_modules — worktree has no node_modules).

## renderInjection vars — Como cada uma é populada

| Var | Source | Notas |
|-----|--------|-------|
| `client_name` | `args.clientName` | Injetado em prompt, NUNCA logado (D-T1) |
| `age` | `args.clientAge != null ? String(args.clientAge) : ''` | Empty string se null — Sonnet ignora placeholder vazio |
| `therapist_notes` | `args.therapistNotes ?? ''` | Null-safe, NUNCA logado (D-T1) |
| `iris_map` | `args.irisMap ?? 'jensen'` | Default Jensen (PROJECT.md mapa default MVP) |
| `vision_features_json` | `JSON.stringify(args.visionFeatures, null, 2)` | Server-generated JSON, code-fenced pela feature-injection.md template |
| `rag_chunks_concatenated_with_citations` | `concatChunksForKnowledge(ragChunks)` | Format: `[book, p.N] text` separados por `\n\n` |

## AbortSignal decision

AbortSignal aceito como integration smoke (não testado com mock em test file).

**Rationale:**
- `analyzeReading` não tem test file próprio (plano é integration-only via 07-integration.test.ts com `ANTHROPIC_INTEGRATION=1`)
- AbortSignal behavior requer stream real para testar meaningfully — mock de `llmStream.controller.abort()` apenas valida plumbing está conectado, não valida que stream para
- Route Handler 07-08 wiring com `request.signal` é integration smoke real
- Plumbing correto: `signal.addEventListener('abort', () => { try { llmStream.controller.abort() } catch {} })`

## Comportamento com 0 chunks RAG

Se `retrieveRelevantKnowledge` retorna `[]` (zero chunks):
- `concatChunksForKnowledge([])` → `''` (empty string)
- `renderInjection` substitui `{{rag_chunks_concatenated_with_citations}}` por `''`
- Sonnet recebe `<knowledge></knowledge>` vazio (dependendo do template feature-injection.md)
- **Comportamento:** Sonnet pivota para conhecimento generalista per SPEC §6 Princípio 3 — não inventa sinais (Princípio 2), mas pode fornecer interpretação constitucional genérica
- **Sem throw, sem warning** — zero chunks é estado válido em ambiente de desenvolvimento sem chunks indexados. Route Handler 07-08 pode adicionar log warn se desejado (fora do escopo de analyze.ts)

## Threat Coverage

| Threat ID | Status |
|-----------|--------|
| T-7-INJECTION | Mitigated: vision_features injetado como `JSON.stringify` (code-fenced); mustache regex `[\w_]+` no-injection |
| T-7-LGPD | Mitigated: telemetria omite clientName + therapistNotes — apenas UUIDs logados |
| T-7-COST | Mitigated: AbortSignal plumbing em `llmStream.controller.abort()` |
| T-7-DRIFT | Mitigated: D-PR2 CI gate 4 testes — FAIL loud se REPORT_SECTIONS ≠ SECTION_QUERY_TEMPLATES keys |
| T-7-CACHE | Mitigated: `cache_control: DEFAULT_SYSTEM_CACHE_CONTROL` no system block |

## Deviations from Plan

None — plan executed exactly as written. `analyze.ts` content matches plan verbatim. Test content matches plan verbatim.

## Known Stubs

None — analyze.ts is fully wired. All 6 mustache vars populated from args. RAG and prompts use real module-level implementations (Fase 6 + 07-03 frozen contracts).

## Self-Check: PASSED

- `apps/web/lib/anthropic/analyze.ts` — FOUND (174 linhas)
- `apps/web/lib/rag/__tests__/section-queries.test.ts` — FOUND (46 linhas, 4 real tests)
- Commit `4eb0a5b` — FOUND in git log
- Commit `dfa96aa` — FOUND in git log
- TSC: zero erros novos para analyze.ts
- Vocabulary audit: zero new hits
- Test D-PR2: 4 passed, 0 failed
