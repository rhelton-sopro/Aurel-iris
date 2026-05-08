---
phase: 07-analise-llm
plan: 04
subsystem: lib-anthropic
tags: [phase-7, wave-3, parser, streaming, tdd, regex, pitfall-2]

requires:
  - phase: 07-analise-llm
    plan: 03
    provides: NumberedSectionKey type + SECTION_KEY_BY_NUMBER lookup table 13 entries (lib/anthropic/types.ts)

provides:
  - apps/web/lib/anthropic/parser.ts (findAllBoundaries + closeSections, server-only)
  - 13 testes vitest GREEN cobrindo Pitfall 2 + closeSections (era 5 it.todo na Wave-0)
affects: [07-07, 07-08]

tech-stack:
  added:
    - "BOUNDARY_RE: /^### (\\d{1,2})\\.\\s+/gm — line-start anchor + integer-only"
  patterns:
    - "lastIndex reset no inicio de cada findAllBoundaries() — invariante anti-leak entre chamadas"
    - "Strict monotonia (number === lastNumber + 1) com seed lastNumber=0 — primeiro boundary precisa ser N=1"
    - "Range filter ANTES da monotonia — `if (number < 1 || number > 13) continue` short-circuit"
    - "closeSections puro: indexa boundaries[i] e boundaries[i+1] (ou buffer.length); trim do slice"

key-files:
  created:
    - apps/web/lib/anthropic/parser.ts (80 linhas)
  modified:
    - apps/web/lib/anthropic/__tests__/parser.test.ts (5 it.todo → 13 it com body, 131 linhas)

key-decisions:
  - "D-S2 honored: parser opera sobre buffer ACUMULADO (não delta event), single-pass O(N) — Route Handler 07-08 vai chamar a cada delta sobre o buffer completo"
  - "Pitfall 2 honored com 3 defesas independentes: range [1,13] + strict monotonia (lastNumber+1) + line-start anchor (`^` em /m mode)"
  - "Rule 1 deviation: plan body Test 4 (rejeita 14) expectava resultado [13] em buffer `### 13. ... ### 14. ...` — incompatível com strict monotonia que rejeita 13 quando lastNumber=0. Test ajustado para isolar branch range: buffer pré-popula 1..13 sequencial e depois introduz 14 como out-of-range, expectativa final [1..13]."
  - "headingEndIdx semantics: index APÓS o \\n da linha do heading (start do corpo). Útil para 07-08 enquadrar o body content sem prefixo `### N. Título\\n`. closeSections usa startIdx (não headingEndIdx) para preservar o título no content (consistente com expectativa do editor)."

requirements-completed: [LLM-01, LLM-03]

duration: ~4 min
completed: 2026-05-08
---

# Plan 07-04: Section-boundary parser TDD — Summary

**Parser determinístico de boundaries `^### N. ` sobre buffer acumulado, server-only, com 3 defesas explicitas contra Pitfall 2 (range [1,13], strict monotonia lastNumber+1, line-start anchor /m mode). Wave-0 stub (5 it.todo) flipado para 13 testes GREEN. Bloco fundacional para D-S2 incremental persistence (consumido por 07-08 Route Handler) e jsonb assembly final via closeSections.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-08T16:18:20Z
- **Completed:** 2026-05-08T16:21:47Z
- **Tasks:** 2 (TDD: 1 RED + 1 GREEN com Rule 1 fix inline)
- **Files created:** 1 (parser.ts)
- **Files modified:** 1 (parser.test.ts flipado de Wave-0 stub)
- **Commits:** 2 atômicos (RED `73a7904`, GREEN `5073be1`)

## Invariantes do parser e cobertura por test

| Invariante | Branch / Codepath | Test que cobre |
|------------|-------------------|----------------|
| Boundary single em buffer simples retorna 1 match com number=1, key='1_constituicao', startIdx=0 | happy path | "detecta single boundary em buffer simples" |
| Boundaries sequenciais 1..3 produzem 3 matches em ordem | monotonia satisfeita | "detecta 3 boundaries sequenciais 1, 2, 3" |
| `### 0.` rejeitado por out-of-range (number < 1) | `if (number < 1 \|\| number > 13) continue` | "rejeita number=0" |
| `### 14.` rejeitado por out-of-range (number > 13) | `if (number < 1 \|\| number > 13) continue` | "rejeita number=14" (com seed monotonia 1..13) |
| Boundary não-monotônica skipped (`### 5.` após `### 1.` rejeitado, depois `### 2.` aceito) | `if (number !== lastNumber + 1) continue` | "rejeita boundary não-monotônica crescente" |
| Pseudo-heading inline em corpo NÃO dispara (e.g., `### 7.5 Detalhe`, `Tabela 4.`) | `^` multiline anchor + `\\d{1,2}\\.\\s+` (rejeita decimal) + falta de prefix `### ` | "ignora pseudo-heading inline em corpo" |
| 13 boundaries sequenciais (happy path full report) aceita todas | monotonia 1..13 em sequência | "aceita 13 boundaries 1..13 sequenciais" |
| Buffer sem boundaries retorna [] | while loop não entra | "retorna lista vazia para buffer sem boundaries" |
| Regex global state não vaza entre chamadas | `BOUNDARY_RE.lastIndex = 0` no início | "regex global state não vaza entre chamadas" |
| `## ` ou `#### ` NÃO match (precisa exatamente 3 hashes) | regex literal `### ` (não `[#]+`) | "aceita '## ' ou '#### ' como NÃO boundary" |
| `closeSections` slice entre boundaries adjacentes, trimmed | for loop `boundaries[i+1]?.startIdx ?? buffer.length` | "produz lista de ClosedSection com conteúdo trimmed" |
| Última seção captura resto do buffer | `i+1` undefined → `buffer.length` | "última seção captura o resto do buffer" |
| `closeSections([], buf)` retorna [] | for loop não entra | "retorna lista vazia se boundaries está vazio" |

**Total: 13 testes GREEN cobrindo todas as 13 invariantes acima.**

## Comportamento em casos não-cobertos por test

### LLM emite seção 7 sem ter visto 6 (drift parcial)

`findAllBoundaries(buffer)` percorre na ordem de match. Quando encontra `### 7. ...` com `lastNumber=5` (porque 6 foi pulado), rejeita silenciosamente (continue). Resultado: `[1, 2, 3, 4, 5]`. Seção 7 só seria aceita se um `### 6.` aparecer ANTES dela no buffer.

**Implicação para 07-08:** se LLM dropar uma seção do meio, a persistência incremental para na seção anterior à drop. UI 07-10 detecta `Object.keys(report_generated).length < 14` e oferece Continue/Retry (Pitfall 3 mitigation, alinhado com D-S3 retry strategy).

### Stream emite mesmo número duplicado (`### 5. ... ### 5. `)

Segundo `### 5.` rejeitado por monotonia (5 !== 5+1=6). Resultado: primeira ocorrência aceita, segunda ignorada. Garante idempotência sobre buffer parcial — se chunk re-emitir um heading que já foi processado, jsonb não é sobrescrito.

### Heading com whitespace anômalo (`###  1.` com 2 espaços)

Regex usa `### ` literal (1 espaço) seguido de `\\d{1,2}` — `###  1.` (2 espaços) NÃO match. Ajustar regex para `###\\s+` se observarmos drift em UAT seria 1-line change; por enquanto SPEC §6 explicita 1-espaço como standard e LLM respeita.

### Heading em última linha sem `\\n` final (`### 13. Final`)

`buffer.indexOf('\\n', matchEnd)` retorna -1; código define `headingEndIdx = matchEnd` (sem +1). Test 1 exercita esse caso indiretamente (`'### 1. Constituição\\nFoo bar baz.'` — heading tem \\n após mas Test 1 não verifica headingEndIdx). closeSections não usa headingEndIdx, então comportamento é safe.

## Considerações de uso em modo streaming (07-08 Route Handler)

D-S2 chama `findAllBoundaries(buffer)` a cada **delta event** sobre o buffer **acumulado**. Padrão esperado de uso:

```typescript
// Pseudo-código esperado em 07-08
let buffer = ''
let lastWrittenSection = 0

for await (const chunk of stream) {
  buffer += chunk.delta.text ?? ''
  const boundaries = findAllBoundaries(buffer)
  // Quando uma NOVA boundary é detectada (boundaries.length > lastWrittenSection),
  // a seção ANTERIOR (boundaries[lastWrittenSection - 1]) está completa.
  // Slice content entre boundaries[lastWrittenSection - 1].startIdx e
  // boundaries[lastWrittenSection].startIdx, persiste via jsonb_set.
  if (boundaries.length > lastWrittenSection && lastWrittenSection > 0) {
    const finishedBoundary = boundaries[lastWrittenSection - 1]
    const nextBoundary = boundaries[lastWrittenSection]
    const content = buffer.slice(finishedBoundary.startIdx, nextBoundary.startIdx).trim()
    await persistSection(readingId, finishedBoundary.key, content)
  }
  lastWrittenSection = boundaries.length
}

// Pós-stream: closeSections para fechar a última seção (que não tem boundary depois)
const finalBoundaries = findAllBoundaries(buffer)
const closed = closeSections(finalBoundaries, buffer)
// closed[finalBoundaries.length - 1] é a seção 13; persistir + appendar ENCERRAMENTO_LITERAL
```

### Performance

- **`findAllBoundaries`:** O(N) por call — `BOUNDARY_RE.exec` percorre o buffer linearmente. N cresce monotonamente durante o stream (até ~30k chars de output total para um relatório completo). Custo per-delta: <1ms para buffers <50k chars (regex dotnet em V8 é fast).
- **Total calls durante um stream:** ~1k chunks (Anthropic delta cadence ~30ms, output ~30s). 1k × <1ms = <1s overhead total — negligível.
- **Custo memory:** stateless module-scope (apenas o regex compilado). `lastIndex` é per-call reset, sem leak.
- **Trade-off vs incremental scan:** poderíamos manter cursor `lastScanIdx` e só escanear `buffer.slice(lastScanIdx)`. Não fazemos porque (a) findAllBoundaries é puro/idempotente — fácil de testar, e (b) re-scan completo garante que nenhuma boundary anterior foi "perdida" por bug de buffer. Custo é dominado pelo I/O do DB UPDATE, não pelo regex.

## Self-Check: PASSED

```bash
# Files exist
[ -f apps/web/lib/anthropic/parser.ts ] && echo FOUND
[ -f apps/web/lib/anthropic/__tests__/parser.test.ts ] && echo FOUND

# Commits exist
git log --oneline -5 | grep -E "73a7904|5073be1"
# Both hashes present

# Tests green
pnpm --filter web test:run lib/anthropic/__tests__/parser.test.ts
# Test Files  1 passed (1)
# Tests       13 passed (13)

# tsc clean (no new errors in lib/anthropic/)
pnpm --filter web tsc --noEmit | grep "lib/anthropic"
# (empty)

# audit:vocabulary baseline (8 pre-existing only)
pnpm --filter web audit:vocabulary | grep "lib/anthropic"
# (empty)
```

## What this unblocks (downstream)

| Plan | Depends on this for |
|------|---------------------|
| 07-07 | `analyze.ts` orchestrator vai compor `findAllBoundaries` + `closeSections` em `runAnalyze(readingId)` (post-stream assembly do final `report_generated` jsonb antes de persistir) |
| 07-08 | Route Handler `app/api/readings/[id]/analyze/route.ts` chama `findAllBoundaries(buffer)` a cada delta para detectar transições de seção e persistir incrementalmente via `jsonb_set` (D-S2). closeSections fecha a última seção pós-stream. |

## Deviations from Plan

### Rule 1 — Test 4 (rejeita number=14) incompatível com invariante de strict monotonia

**Found during:** Task 2 (GREEN run) — 12/13 testes passaram, "rejeita number=14" falhou com `expected [] to have a length of 1 but got +0`.

**Issue:** O plan body especificou Test 4 verbatim com buffer `'### 13. Mensagem\\nFim.\\n### 14. Bibliografia\\nDrift.'` esperando resultado de length 1 com `number=13`. Mas a invariante de strict monotonia (`number === lastNumber + 1`, com seed `lastNumber=0`) rejeita `### 13.` quando é o primeiro match no buffer (13 ≠ 0+1=1). Test 4 entrava em conflito direto com Test 5 ("rejeita boundary não-monotônica") que valida exatamente esse mecanismo.

**Análise:** RESEARCH.md linhas 706 + 877-907 (Code Example) explicitam strict monotonia como spec do parser; o conflito existe apenas no plan body (verbatim repetido em PLAN linha 156). Implementação do parser segue spec — o test que estava errado.

**Fix:** Refatorar Test 4 para isolar exclusivamente o branch de range. Buffer pré-popula 1..13 sequencial (satisfaz monotonia), depois introduz `### 14. Bibliografia` como out-of-range. Esperado: length=13 (todas as sequenciais aceitas, 14 rejeitada por range).

```diff
-    const buf = '### 13. Mensagem\\nFim.\\n### 14. Bibliografia\\nDrift.'
-    expect(result).toHaveLength(1)
-    expect(result[0].number).toBe(13)
+    const head = Array.from({ length: 13 }, (_, i) => `### ${i + 1}. Seção ${i + 1}\\nConteúdo.`).join('\\n')
+    const buf = `${head}\\n### 14. Bibliografia\\nDrift fora do range.`
+    expect(result).toHaveLength(13)
+    expect(result.map((b) => b.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
```

**Files modified:** `apps/web/lib/anthropic/__tests__/parser.test.ts` (Test 4 buffer + assertion).
**Commit:** incluído em `5073be1` (GREEN).

## Verification Gates

| Gate | Status | Detail |
|------|--------|--------|
| `parser.ts` ≥ 80 linhas | ✓ | 80 linhas exatas (atinge mínimo) |
| `parser.ts` declara `import 'server-only'` | ✓ | linha 13 |
| `parser.ts` exporta `findAllBoundaries` | ✓ | linha 35 |
| `parser.ts` exporta `closeSections` | ✓ | linha 71 |
| `parser.ts` exporta `BoundaryMatch` interface | ✓ | linha 19 |
| `parser.ts` exporta `ClosedSection` interface | ✓ | linha 56 |
| `parser.ts` consome `SECTION_KEY_BY_NUMBER` de `./types` | ✓ | linha 14 |
| `BOUNDARY_RE = /^### (\\d{1,2})\\.\\s+/gm` | ✓ | linha 16 (multiline + global flags) |
| `findAllBoundaries` reset `lastIndex = 0` no início | ✓ | linha 36 |
| `findAllBoundaries` filtra `number < 1 \|\| number > 13` | ✓ | linha 42 |
| `findAllBoundaries` filtra `number !== lastNumber + 1` | ✓ | linha 43 |
| `closeSections` slice startIdx → next.startIdx (ou buffer.length) | ✓ | linhas 75-77 |
| `closeSections` trim no resultado | ✓ | linha 77 |
| `parser.test.ts` ≥ 12 chamadas `it(` | ✓ | 13 it (era 5 it.todo) |
| `parser.test.ts` cobre Pitfall 2 out-of-range (0 e 14) | ✓ | Tests 3, 4 |
| `parser.test.ts` cobre non-monotonic | ✓ | Test 5 |
| `parser.test.ts` cobre false positive em corpo (decimal + Tabela) | ✓ | Test 6 |
| `parser.test.ts` cobre hash count != 3 | ✓ | Test 10 |
| `parser.test.ts` cobre regex global state non-leak | ✓ | Test 9 |
| `parser.test.ts` cobre 13 sequenciais happy path | ✓ | Test 7 |
| `parser.test.ts` cobre closeSections (3 cases) | ✓ | Tests 11, 12, 13 |
| Test gate `pnpm test:run parser.test.ts` exit 0 | ✓ | 13 passed (1 file) |
| `pnpm tsc --noEmit` zero novos erros em lib/anthropic/parser.ts | ✓ | grep "lib/anthropic" → empty |
| `pnpm audit:vocabulary` zero novos hits em lib/anthropic/ | ✓ | baseline 8 pre-existing Phase 3 hits unchanged |

Wave 3 do Phase 7 (07-04) entregue. Parser determinístico pronto para ser consumido pelo orchestrator analyze.ts (07-07) e pelo Route Handler streaming (07-08).
