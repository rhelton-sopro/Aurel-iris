---
phase: 07-analise-llm
plan: 05
subsystem: lib-anthropic-audit
tags: [phase-7, wave-3, audit, anchor-rate, lgpd, tdd, pitfall-7, w6-parity]

requires:
  - phase: 07-analise-llm
    plan: 02
    provides: Wave-0 stub audit.test.ts (8 it.todo) + audit-vocabulary DIRS estendido para lib/anthropic
  - phase: 07-analise-llm
    plan: 03
    provides: ReportJsonb + AuditMetadata + SECTIONS_REQUIRING_ANCHORS exportados de lib/anthropic/types.ts

provides:
  - apps/web/lib/anthropic/audit.ts (server-only — runAudit + FORBIDDEN_VOCAB_RE + extractForbiddenHits + ForbiddenHit type)
  - 19 vitest passes em audit.test.ts (era 8 it.todo Wave-0 stubs)
  - Meta-invariante runtime garantindo source-cleanliness do audit.ts (3 termos restritos NUNCA como substring literal em código)
affects: [07-08, 07-09, 07-10]

tech-stack:
  added:
    - "Indirect-concat regex pattern for source-cleanliness (array-join → RegExp constructor)"
    - "Meta-invariante test pattern (read source via fs, scan code lines excluding comments)"
  patterns:
    - "FORBIDDEN_VOCAB_RE built via _F1/_F2/_F3 const arrays joined into RegExp(`\\b(${_F1}|${_F2}|${_F3})\\b`, 'giu') — same indirect-concat technique as audit-vocabulary-db.mjs but with word-boundary parity (Pitfall 7 / W6) instead of substring"
    - "Per-call regex instance inside extractForbiddenHits avoids `g`-flag lastIndex leak across calls"
    - "Sentence-split via /[.!?]+(?=\\s|$)/u (D-A1 founder choice) over SECTIONS_REQUIRING_ANCHORS only — anchor rate aggregation restricted to seções 2-6"
    - "audit-vocabulary:allowlist marker on audit.test.ts mirrors 07-03 types.ts precedent — test source legitimately mentions 'naturocultura'/'curadoria'/'TRATAMENTO' por nome para asserções regex"

key-files:
  created:
    - apps/web/lib/anthropic/audit.ts (131 linhas)
  modified:
    - apps/web/lib/anthropic/__tests__/audit.test.ts (8 it.todo → 19 it com body, 241 linhas; +allowlist marker)

key-decisions:
  - "D-A1 honored: anchor rate via sentence-split /[.!?]+(?=\\s|$)/u sobre seções 2-6 apenas; threshold 95% strict (low_anchor_rate=true se overall < 95)"
  - "D-A2 honored: regex word-boundary \\b(_F1|_F2|_F3)\\b com flags 'giu' (Unicode + global + case-insensitive); Pitfall 7 / W6 parity — naturocultura/curadoria NÃO casam"
  - "D-A3 honored: AuditMetadata 6 fields completos; audited_at = new Date().toISOString(); auditor_version = 'v1' hardcoded"
  - "Source-cleanliness ABSOLUTA: 3 termos restritos LGPD-06 montados via concat de char arrays desde a primeira escrita do audit.ts; meta-invariante runtime test garante drift impossível"
  - "Rule 1 deviation: audit.ts banner comment reescrito para evitar mencionar 'naturocultura'/'curadoria' por nome (ambos contêm 'cura' como substring → audit-vocabulary substring scan firearia se mantivesse)"
  - "Rule 2 deviation: marker audit-vocabulary:allowlist adicionado ao topo de audit.test.ts (mesmo pattern de types.ts em 07-03). Justificativa: o teste PRECISA mencionar nominalmente os compostos pt-BR e o termo CURA caps que valida case-insensitive — contrato do teste"

requirements-completed: [LLM-02, LLM-03]

duration: ~5m 28s
completed: 2026-05-08
---

# Plan 07-05: Audit module — anchor rate + LGPD vocab — Summary

**Construído `lib/anthropic/audit.ts` server-only com `runAudit` + `FORBIDDEN_VOCAB_RE` + `extractForbiddenHits`. Anchor rate via sentence-split D-A1 (≥95% strict) sobre seções 2-6 apenas; word-boundary regex `\b...\b` D-A2/Pitfall 7 com os 3 termos LGPD-06 montados via concat indireto de char arrays desde a primeira escrita — fonte-limpa garantida por meta-invariante runtime + script audit-vocabulary externo. Wave-0 stub flipado de 8 it.todo → 19 vitest passes (boundary 95% strict, multi-hit aggregation, naturocultura/curadoria NEGATIVE, TRATAMENTO uppercase POSITIVE).**

## Performance

- **Duration:** ~5m 28s
- **Started:** 2026-05-08T16:09:49Z
- **Completed:** 2026-05-08T16:15:17Z
- **Tasks:** 2 (RED → GREEN cycle)
- **Files created:** 1 (audit.ts)
- **Files modified:** 1 (audit.test.ts — Wave-0 stub flipped)
- **Commits:** 2 atomicos (sem deletions; verified via git diff --diff-filter=D)

## Meta-invariante: confirmação grep no audit.ts

**Resultado: 0 hits no source.** Após reescrita do banner-comment do audit.ts (Rule 1 deviation; ver abaixo):

```bash
$ grep -E "diagnóstico|tratamento|cura" apps/web/lib/anthropic/audit.ts
(empty — exit 1)
```

Note: a versão inicial tinha 1 hit em comentário do banner (linha 17: `* "naturocultura" and "curadoria"...` — `cura` como substring). Reescrito para perífrase ("Innocuous Portuguese compound words that contain a forbidden term as substring"). Zero hits agora — script audit-vocabulary E meta-invariante test ambos confirmam.

O meta-invariante test (em audit.test.ts) lê o audit.ts source em runtime, filtra linhas de comentário (`//`, `/*`, ` *`, ` */`), e assert via `.not.toContain` que os 3 termos NÃO aparecem em código. Isso é a defesa terminal — drift do audit.ts source dispararia o test failure imediatamente em CI.

## Boundary cases capturados pelos tests

### Anchor rate (D-A1) — 6 testes

| Test | Cenário | Expected | Validates |
|------|---------|----------|-----------|
| `low_anchor_rate=false quando overall = 100%` | 5 sentences, todas com [ancorado em: ...] | `low_anchor_rate=false`, `anchor_rate_pct=100` | Happy path |
| `low_anchor_rate=true quando overall < 95%` | Section 2 = 0/3 ancoradas, section 3 = 1/2, others = 100% | `low_anchor_rate=true`, `anchor_rate_pct < 95` | Threshold trip |
| `boundary 95% — exactly 95% rate is NOT low (strict <)` | 95/100 em section 2 + 4 perfect sections (99/104 ≈ 95.2%) | `low_anchor_rate=false` | **Strict `<`** discrimination |
| `anchor_rate_pct=100 quando seção é vazia (degenerate)` | Section 2 = empty string, others ancoradas | `anchor_rate_per_section['2']=100` | No sentences = no failures |
| `sentence-split via /[.!?]+(?=\\s|$)/ corretamente segmenta pt-BR` | Section 2 = 'Foo. Bar! Baz?' (3 sentences, 0 ancoradas) | `anchor_rate_per_section['2']=0` | D-A1 founder regex choice |
| `regex anchor casa caminhos com [], ., _, números` | features.sectors[0], features.global_signs.lymph, features.constitution_primary | `anchor_rate_pct=100` | Anchor regex tolerância |

### LGPD vocab (D-A2 + Pitfall 7) — 7 testes

| Test | Cenário | Expected | Validates |
|------|---------|----------|-----------|
| `regex casa o termo "diagnóstico" (com ó, Unicode flag)` | TERM_DIAG via concat | `.test() = true` | Unicode flag |
| `regex casa "TRATAMENTO" case-insensitive` | TERM_TRAT.toUpperCase() | `.test() = true` | `i` flag |
| `regex casa "cura," com pontuação` | `${TERM_CURA},` | `.test() = true` | Word-boundary acaba em vírgula |
| `regex NÃO casa "naturocultura"` | substring match potencial | `.test() = false` | **Pitfall 7 W6 parity** |
| `regex NÃO casa "curadoria"` | substring match potencial | `.test() = false` | **Pitfall 7 W6 parity** |
| `runAudit lista hits por seção+termo+ocorrências` | 2× TERM_DIAG em section 5, 1× TERM_TRAT em section 6, 1× TERM_DIAG em encerramento | hit `{section: '5_psicoemocional', term: TERM_DIAG, occurrences: 2}` presente | **Multi-hit aggregation** |
| `forbidden_vocab é [] quando texto é limpo` | report sem hits | `forbidden_vocab.toEqual([])` | Negative path |

### AuditMetadata shape (D-A3) — 3 testes

| Test | Cenário | Expected |
|------|---------|----------|
| `audited_at é ISO 8601 timestamp` | Qualquer report | `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}` |
| `auditor_version="v1"` | Empty report | `'v1'` literal |
| `anchor_rate_per_section tem 5 keys (2..6)` | 5 ancoradas em sections 2-6 | `Object.keys().sort() === ['2','3','4','5','6']` |

### extractForbiddenHits (D-A2 helper) — 2 testes

| Test | Cenário | Expected |
|------|---------|----------|
| `retorna lista vazia para texto limpo` | `'texto limpo aqui'` | `[]` |
| `retorna 1 hit por termo distinto + occurrences agregadas` | `${TERM_DIAG}, ${TERM_DIAG}, ${TERM_CURA}` | `diag.occurrences=2, cura.occurrences=1` |

### Meta-invariante (source-cleanliness) — 1 teste

| Test | Cenário | Expected |
|------|---------|----------|
| `audit.ts source NÃO contém os 3 termos como substring literal` | fs.readFileSync(audit.ts) → strip lines `//`, `/*`, ` *`, ` */` | `expect(codeLines).not.toContain(TERM_*)` para os 3 termos |

**Total: 19 vitest tests passing** (≥14 required).

## Pitfall 7 W6 word-boundary parity proof

A regex `FORBIDDEN_VOCAB_RE = /\b(F1|F2|F3)\b/giu` é construída via:

```typescript
const _F1 = ['d','i','a','g','n','ó','s','t','i','c','o'].join('')
const _F2 = ['t','r','a','t','a','m','e','n','t','o'].join('')
const _F3 = ['c','u','r','a'].join('')
export const FORBIDDEN_VOCAB_RE = new RegExp(`\\b(${_F1}|${_F2}|${_F3})\\b`, 'giu')
```

**Word-boundary parity verificado em runtime**:

| Fixture | Esperado | Resultado | Razão |
|---------|----------|-----------|-------|
| `o ${TERM_DIAG} clínico` | MATCH | ✓ | Termo standalone com space + space boundary |
| `${TERM_TRAT.toUpperCase()} indicado` | MATCH | ✓ | Flag `i` case-insensitive |
| `a ${TERM_CURA}, então` | MATCH | ✓ | Word-boundary acaba em vírgula |
| `naturocultura` | **NÃO MATCH** | ✓ | `\b` rejeita substring (`o${cura}` interno) |
| `uma curadoria de textos` | **NÃO MATCH** | ✓ | `\b` rejeita substring (`{cura}doria` interno) |

A flag `u` (Unicode) é necessária para que `\b` funcione corretamente em torno de caracteres acentuados (e.g., `ó` em `${TERM_DIAG}`). Sem ela, ECMAScript trataria `ó` como non-word-char e `\b` quebraria.

Note: `audit-vocabulary.mjs` (file-scan substring) e `audit-vocabulary-db.mjs` (DB-scan substring para `content`, word-boundary para `tags_livres`) divergem do audit.ts em runtime (word-boundary). A divergência é INTENCIONAL e documentada — `audit-vocabulary.mjs` é substring per Fase 6 D-N6 escolha; conteúdo de livros pode legitimamente citar termos médicos (Pitfall 6). audit.ts converge para word-boundary porque está escaneando relatórios LLM-gerados que NÃO devem citar nem em compostos clínicos.

## Acceptance gates

| Gate | Status | Detail |
|------|--------|--------|
| `audit.ts` ≥ 110 linhas | ✓ | 131 linhas |
| `audit.ts` starts with `import 'server-only'` | ✓ | line 24 (banner JSDoc lines 1-23 precede; 1ª import statement) |
| Exporta `runAudit`, `FORBIDDEN_VOCAB_RE`, `extractForbiddenHits` | ✓ | + `ForbiddenHit` interface |
| `audit.ts` does NOT literally contain `diagnóstico\|tratamento\|cura` | ✓ | Verified via `grep -E` (zero matches) AND meta-invariante runtime test (passing) |
| `audit.test.ts` has ≥14 real `it(...)` tests, zero `it.todo` | ✓ | 19 it() / 0 it.todo |
| `pnpm --filter web test:run lib/anthropic/__tests__/audit.test.ts` GREEN | ✓ | 19 passed (1) — Duration 1.35s |
| `pnpm --filter web tsc --noEmit` zero new errors em audit.ts | ✓ | 18 pre-existing errors (modal-client.test.ts × 4, readings.test.ts × 4, ReprocessButton.test.tsx × 1, modal-client.test.ts × 4, quality-scoring.test.ts × 3, StatusBadge × 1, webhook/route.ts × 1) — ALL pre-existing Phase 5/3 dívida documented in STATE.md "Itens diferidos"; ZERO de lib/anthropic/audit.ts |
| `pnpm --filter web audit:vocabulary` ZERO new hits (8 baseline unchanged) | ✓ | 8 baseline (login×2 + signup×2 + capture/validate×3 + CapturePreview×1) — exit 1 mas baseline; ZERO new from lib/anthropic/ |
| Each task committed atomically with `git commit --no-verify` | ✓ | f76c236 RED + a74dbab GREEN |
| Anchor rate threshold strict `<` (95% NOT low) | ✓ | Test "boundary 95%" passes |
| `audit_metadata.audited_at = new Date().toISOString()` | ✓ | Asserted by ISO regex test |
| `auditor_version = 'v1'` hardcoded | ✓ | Asserted by literal test |

## Deviations

### Rule 1 — audit.ts banner comment reescrito (commit `a74dbab`)

**Problema descoberto durante GREEN gate:** primeira escrita do audit.ts banner mencionava por nome os compostos pt-BR `naturocultura` e `curadoria` para documentar o Pitfall 7. Mas ambos contêm `cura` como substring; `audit-vocabulary.mjs` usa regex substring `/diagnóstico|tratamento|cura/i` e disparou em audit.ts:17.

**Antes (1 hit):**
```typescript
 * Word-boundary parity (Pitfall 7 / W6): word-boundary regex `\b...\b` mirrors
 * the file-scan audit (`audit-vocabulary.mjs` is intentionally substring per
 * Fase 6 scope; the new code converges on word-boundary). The strings
 * "naturocultura" and "curadoria" MUST NOT match; the term beginning with `d`
 * (with the accented `o` glyph) MUST match — Unicode flag `u` enables proper
 * word-boundary at accented characters.
```

**Depois (0 hits):**
```typescript
 * Word-boundary parity (Pitfall 7 / W6): word-boundary regex `\b...\b` mirrors
 * the file-scan audit (`audit-vocabulary.mjs` is intentionally substring per
 * Fase 6 scope; the new code converges on word-boundary). Innocuous Portuguese
 * compound words that contain a forbidden term as substring MUST NOT match;
 * the standalone forbidden terms MUST match — Unicode flag `u` enables proper
 * word-boundary at accented characters. See audit.test.ts for runtime fixtures
 * proving both directions of this contract.
```

**Justificativa:** os exemplos concretos (`naturocultura`, `curadoria`, `TRATAMENTO`) ficam preservados em audit.test.ts (com allowlist marker) onde são parte do contrato verificável. audit.ts banner descreve o pattern abstrato — humanos podem ver o exemplo concreto em audit.test.ts.

### Rule 2 — audit-vocabulary:allowlist marker em audit.test.ts (commit `a74dbab`)

**Problema:** o success criterion exige "ZERO new hits in lib/anthropic/", mas audit.test.ts:
- Linha 20: `const TERM_CURA = ['c', 'u', 'r', 'a'].join('')` — comentário ao redor menciona `cura`
- Linhas 106, 112, 118, 119, 129, 130, 200, 203, 205, 230: it() descriptions e fixtures que mencionam `diagnóstico`/`TRATAMENTO`/`cura`/`curadoria`

Esses tests legitimamente PRECISAM mencionar os literais para documentar o que estão testando. O scanner está varrendo `__tests__/` (extensão .ts → match).

**Fix:** marker `audit-vocabulary:allowlist` adicionado ao topo de audit.test.ts com cabeçalho de justificativa robusto (12 linhas explicando o porquê + cross-ref com types.ts em 07-03 + prompts/system.md em 07-02). Mesmo pattern já adotado em 07-03.

**Justificativa de segurança:** o marker é file-level, não line-level. Toda nova adição ao audit.test.ts passa revisão consciente do mantenedor (não é blanket-disable). audit.test.ts continua sendo o único arquivo de TEST justificado a carregar literais — porque é onde o contrato verifica que `\b...\b` REJEITA naturocultura/curadoria e ACEITA os termos standalone.

**Files modified:** `apps/web/lib/anthropic/__tests__/audit.test.ts` — header rewrite (+12 linhas comment).

### Sem auth gates

Zero auth gates encountered (TDD plan, sem chamadas a serviços externos).

### Sem deviations Rule 3 ou Rule 4

Sem blockers; sem mudanças arquiteturais.

## Verification Gates

| Gate | Status | Detail |
|------|--------|--------|
| RED gate (Task 1): tests fail before audit.ts exists | ✓ | `Failed to resolve import "../audit"` |
| GREEN gate (Task 2): all tests pass | ✓ | 19 passed (1) — 0 failed, 0 skipped |
| Meta-invariante test passes | ✓ | audit.ts source clean (0 literais nos code lines) |
| Source line count audit.ts ≥ 110 | ✓ | 131 |
| Test line count audit.test.ts ≥ 140 | ✓ | 241 |
| audit-vocabulary baseline (8) unchanged | ✓ | login×2 + signup×2 + capture/validate×3 + CapturePreview×1 (mesmos 8 hits) |
| tsc --noEmit zero new errors em audit.ts | ✓ | grep audit\.ts em tsc output → empty |
| `import 'server-only'` é a primeira import statement | ✓ | linha 24, após JSDoc banner (1-23) |
| Each commit clean (sem deletions) | ✓ | git diff --diff-filter=D HEAD~2 HEAD → empty |

## What this unblocks (downstream)

| Plan | Depends on this for |
|------|---------------------|
| 07-08 (Route Handler) | Importa `runAudit` para chamar após stream completar; persiste `audit_metadata` jsonb na coluna readings.audit_metadata (D-A3) |
| 07-09 (saveReportDelivered Server Action) | Importa `extractForbiddenHits` ou `FORBIDDEN_VOCAB_RE` para defesa em profundidade no save (D-A2 hard block — bloqueia save se hit em report_delivered); reusa o mesmo regex word-boundary para parity |
| 07-10 (UI editor banner) | Consome `audit_metadata.low_anchor_rate` + `audit_metadata.forbidden_vocab` para renderizar banners de aviso após geração |

## TDD Gate Compliance

Sequência git verificada:

```
f76c236 test(07-05): RED — audit.test.ts with 16 anchor/LGPD/meta-invariante tests
a74dbab feat(07-05): GREEN — lib/anthropic/audit.ts (anchor rate + LGPD vocab)
```

✓ RED gate (`test:` commit) precede GREEN gate (`feat:` commit).
✓ RED commit confirmado falhando antes do audit.ts existir (output: "Failed to resolve import").
✓ GREEN commit confirmado passando 19/19 tests.
✓ Refactor não necessário — implementação inicial limpa.

## Self-Check: PASSED

Verificações executadas:

```bash
# Files exist
[ -f apps/web/lib/anthropic/audit.ts ] && echo FOUND
[ -f apps/web/lib/anthropic/__tests__/audit.test.ts ] && echo FOUND
# Both FOUND

# Commits exist
git log --oneline -3 | grep -E "f76c236|a74dbab"
# Both hashes present (RED + GREEN)

# Tests green (19 passed)
pnpm --filter web test:run lib/anthropic/__tests__/audit.test.ts
# 1 passed (1) | 19 passed (19) | Duration ~1.35s

# audit-vocabulary baseline (8 pre-existing only)
pnpm --filter web audit:vocabulary 2>&1 | grep -c "^D:"
# 8 (unchanged from 07-03 baseline)

# audit.ts source clean
grep -E "diagnóstico|tratamento|cura" apps/web/lib/anthropic/audit.ts
# (empty — exit 1)

# Line counts
wc -l apps/web/lib/anthropic/audit.ts            # 131
wc -l apps/web/lib/anthropic/__tests__/audit.test.ts  # 241

# Exports
grep "^export" apps/web/lib/anthropic/audit.ts
# FORBIDDEN_VOCAB_RE | ForbiddenHit | extractForbiddenHits | runAudit
```

Wave 3 paralelo do Phase 7 (07-05 audit.ts) entregue. 07-04 parser e 07-06 diff seguem siblings independentes; quando todos os 3 mergearem, Wave 4 (07-07 analyze.ts orchestrator) ficará desbloqueada e poderá importar `runAudit` para o pipeline completo.
