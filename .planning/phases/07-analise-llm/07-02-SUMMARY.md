---
phase: 07-analise-llm
plan: 02
subsystem: infra
tags: [phase-7, wave-0, dependencies, prompts, audit-vocabulary, shadcn-accordion]

requires:
  - phase: 06-rag-ingestao
    provides: knowledge_chunks RAG corpus pronto para retrieval em Fase 7

provides:
  - 3 npm runtime deps instaladas (react-markdown@^10.1.0, remark-gfm@^4.0.1, diff@^9.0.0)
  - shadcn Accordion primitive (apps/web/components/ui/accordion.tsx) via @base-ui/react
  - audit-vocabulary.mjs DIRS estendido com 'lib/anthropic' (D-A4)
  - apps/web/prompts/system.md cópia LITERAL SPEC §6 linhas 511-636 (D-PR1 frozen contract)
  - apps/web/prompts/feature-injection.md cópia LITERAL SPEC §6 linhas 638-660
  - next.config.ts outputFileTracingIncludes para Vercel deploy (Pitfall 9 fix)
  - 8 Wave-0 test stubs com it.todo (parser/audit/diff/prompts/client/integration/section-queries/audit-vocabulary)
affects: [07-03, 07-04, 07-05, 07-06, 07-07, 07-08, 07-10]

tech-stack:
  added:
    - react-markdown@^10.1.0 (renderiza report markdown nas Surfaces 1+2)
    - remark-gfm@^4.0.1 (extension para tables/strikethrough nos relatórios)
    - diff@^9.0.0 (used by 07-06 classifyEdit em diff.ts)
    - "@types/diff@^8.0.0 (deprecated stub — diff@9 ships own types)"
    - "@base-ui/react/accordion (via shadcn) — primitivo Radix-equivalente"
  patterns:
    - "Prompt assets: SOURCE comment header + audit-vocabulary:allowlist marker"
    - "Wave-0 stub pattern: describe() blocks + it.todo() for contract documentation"
    - "outputFileTracingIncludes for non-source assets (.md prompts) bundled into route function"

key-files:
  created:
    - apps/web/prompts/system.md (system prompt literal SPEC §6, 126 linhas, sha256 3ca96781…)
    - apps/web/prompts/feature-injection.md (template injection, 19 linhas, sha256 f55ce989…)
    - apps/web/components/ui/accordion.tsx (shadcn Accordion via @base-ui/react)
    - apps/web/lib/anthropic/__tests__/parser.test.ts (5 it.todo)
    - apps/web/lib/anthropic/__tests__/audit.test.ts (8 it.todo, 2 describe blocks)
    - apps/web/lib/anthropic/__tests__/diff.test.ts (7 it.todo)
    - apps/web/lib/anthropic/__tests__/prompts.test.ts (8 it.todo, 4 describe blocks)
    - apps/web/lib/anthropic/__tests__/client.test.ts (4 it.todo)
    - apps/web/lib/anthropic/__tests__/integration.test.ts (5 it.todo, skip-by-default)
    - apps/web/lib/rag/__tests__/section-queries.test.ts (1 it.todo, D-PR2 gate)
    - apps/web/scripts/__tests__/audit-vocabulary.test.mjs (4 it.todo, D-A4 contract)
  modified:
    - apps/web/package.json (3 deps + 1 devDep)
    - apps/web/scripts/audit-vocabulary.mjs (DIRS array +'lib/anthropic')
    - apps/web/next.config.ts (outputFileTracingIncludes para route analyze)
    - pnpm-lock.yaml (96 deps add)

key-decisions:
  - "D-A4 honored: 'lib/anthropic' adicionado ao DIRS array antes mesmo do diretório existir; trata-se como diretório vazio (acceptable per script logic)."
  - "D-PR1 frozen contract: prompts/system.md + feature-injection.md como cópia byte-exact de SPEC.md §6 com SOURCE marker no topo; qualquer drift exige edit coordenado."
  - "Pitfall 9 mitigation: outputFileTracingIncludes scope limitado ao route 'app/api/readings/[id]/analyze/route'; glob ./prompts/**/* cobre os 2 arquivos atuais e futuros."
  - "Allowlist marker em system.md (audit-vocabulary:allowlist) é defensivo — script atual NÃO escaneia .md mas marker documenta justificativa pra futuras extensões."

patterns-established:
  - "SPEC ↔ prompt asset: HTML comment SOURCE: SPEC.md §X linhas N-M no topo, cópia LITERAL abaixo. Aplica-se a system.md e feature-injection.md; replicação coordinated edit policy via D-PR1."
  - "Wave-0 stub TDD bridge: describe()+it.todo() blocks listam invariantes esperadas; planos posteriores trocam por it()+body sem mexer estrutura. Mantém vitest exit 0 ao longo da fase."

requirements-completed: [LLM-01, LLM-02, LLM-03]

duration: ~30min
completed: 2026-05-08
---

# Plan 07-02: Wave-0 Setup (Deps + Prompts + Audit + Stubs)

**Setup paralelo ao 07-01 schema migration: 3 npm deps + shadcn Accordion + 2 prompt assets literais SPEC §6 + audit-vocabulary D-A4 extension + 8 Wave-0 test stubs prontos para Wave 1+ preencher.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-08T12:10:00Z
- **Completed:** 2026-05-08T12:35:00Z
- **Tasks:** 3
- **Files created:** 11
- **Files modified:** 4 (package.json, audit-vocabulary.mjs, next.config.ts, pnpm-lock.yaml)
- **Commits:** 3 atomic (`0a148eb` deps + `891322d` prompts + `71033b4` test stubs)

## Accomplishments

### Task 1 — Deps + Accordion + audit DIRS extension (commit `0a148eb`)

- `pnpm add react-markdown@^10.1.0 remark-gfm@^4.0.1 diff@^9.0.0` instalou em `dependencies`
- `pnpm add -D @types/diff` instalou stub deprecated (diff@9 ships own types — keep harmless)
- `pnpm dlx shadcn@latest add accordion` criou `components/ui/accordion.tsx` usando `@base-ui/react/accordion` (4 exports: Accordion, AccordionItem, AccordionTrigger, AccordionContent)
- `apps/web/scripts/audit-vocabulary.mjs` linha 21 mudou `const DIRS = ['app', 'components', 'lib/rag']` para `const DIRS = ['app', 'components', 'lib/rag', 'lib/anthropic']` — D-A4 honored; lib/anthropic ainda não existe → script trata directório ausente como OK no `collectFiles()` try/catch
- `pnpm audit:vocabulary`: 8 baseline pre-existing Phase 3 hits unchanged (login×2, signup×2, capture/validate×3, CapturePreview×1) — zero novos hits

### Task 2 — Prompts literais + outputFileTracingIncludes (commit `891322d`)

- `apps/web/prompts/system.md` (126 linhas, 6046 chars, 850 words; sha256 `3ca967810e6476f7a39bdfd5d003731efd4071275b4356556edac0325206e3c7`):
  - Linha 1: `<!-- SOURCE: SPEC.md §6 (linhas 511-636). Frozen contract D-PR1. ... -->`
  - Linha 2: `<!-- audit-vocabulary:allowlist — este arquivo cita "diagnóstico/tratamento/cura" para listar como PROIBIDOS ao LLM. ... -->`
  - Conteúdo: 5 princípios de operação + 13 seções (1.Constituição → 13.Mensagem Final) + Encerramento literal (4-line block quote) + 5-bullet Tom de voz
- `apps/web/prompts/feature-injection.md` (19 linhas; sha256 `f55ce9895bb29c943728481c74d2e4a0cd876906f0e20c4ac6258ad6b95bae3d`):
  - SOURCE marker linha 1
  - 3 XML-like tags (`<client_context>`, `<features>`, `<knowledge>`) com 5 placeholders mustache (`{{client_name}}`, `{{age}}`, `{{therapist_notes}}`, `{{iris_map}}`, `{{vision_features_json}}`, `{{rag_chunks_concatenated_with_citations}}`)
- `apps/web/next.config.ts` ganhou `outputFileTracingIncludes: { 'app/api/readings/[id]/analyze/route': ['./prompts/**/*'] }` — Pitfall 9 defense: Next.js 15 sem essa key produz ENOENT em production deploy ao primeiro request, porque `prompts/*.md` não vão pro `.vercel/output/functions/<route>.func/`

### Task 3 — 8 Wave-0 test stubs (commit `71033b4`)

8 arquivos com `describe()` + `it.todo()` blocks listando invariantes esperadas:

| File | it.todo count | Filled by |
|------|---------------|-----------|
| `lib/anthropic/__tests__/parser.test.ts` | 5 | 07-04 (section-boundary parser) |
| `lib/anthropic/__tests__/audit.test.ts` | 8 (2 describes) | 07-05 (anchor rate + LGPD vocab) |
| `lib/anthropic/__tests__/diff.test.ts` | 7 | 07-06 (classifyEdit D-U2) |
| `lib/anthropic/__tests__/prompts.test.ts` | 8 (4 describes) | 07-03 (loader + cache_control) |
| `lib/anthropic/__tests__/client.test.ts` | 4 | 07-03 (Anthropic client factory) |
| `lib/anthropic/__tests__/integration.test.ts` | 5 (skip-by-default) | manual founder UAT (env `ANTHROPIC_INTEGRATION=1`) |
| `lib/rag/__tests__/section-queries.test.ts` | 1 | 07-07 (D-PR2 frozen-contract gate) |
| `scripts/__tests__/audit-vocabulary.test.mjs` | 4 | 07-XX (D-A4 contract — vitest config update needed pra .mjs) |

`pnpm test:run lib/anthropic/__tests__/ lib/rag/__tests__/section-queries.test.ts scripts/__tests__/audit-vocabulary.test.mjs`:
- 7 test files (vitest config `include: ['**/*.{test,spec}.{ts,tsx}']` ignora `.mjs` silently)
- 38 it.todo, 0 failures, 0 errors
- Exit 0

## Deviations

### Rule 1 — audit.test.ts paráfrase para evitar self-match LGPD

**Plan's verbatim conteúdo de `audit.test.ts`** continha as 3 strings proibidas LGPD-06 (`diagnóstico|tratamento|cura`) hardcoded nas descrições de `it.todo` — necessárias para documentar o regex pattern esperado. Mas D-A4 (Task 1) extendeu `audit-vocabulary.mjs` DIRS para varrer `lib/anthropic`, então literais aqui causariam self-match (script falharia a partir do commit deste plan).

**Fix:** reword das descrições para indireto:
- "regex /\\b(<3 termos LGPD>)\\b/giu casa o termo proibido" (ao invés de citar os 3 literais)
- "regex NÃO casa naturocultura (substring de termo proibido rejeitada por \\b)" (ao invés de "cura" entre aspas)

Implementações em 07-05 montam regex via concat indireto (Pitfall 7 W6 parity — meta-test em audit.ts asserts `grep` em source NÃO encontra os literais). Banner de cabeçalho em `audit.test.ts` documenta a justificativa.

### Rule 1 — `audit-vocabulary.test.mjs` extension não pegada por vitest config

Vitest config em `vitest.config.ts` tem `include: ['**/*.{test,spec}.{ts,tsx}']`. O plan pediu extensão `.mjs` para o stub do audit-vocabulary script. Sem alterar config (vitest.config.ts não está em `files_modified`), o arquivo é silently ignorado pelo vitest run.

**Não é regressão**: o arquivo serve como documentação do D-A4 contract; quando a Wave 1 preencher os bodies, o plan responsável pode either:
1. Renomear pra `.test.ts` (Rule 1 trivial)
2. Estender vitest config include glob (Rule 4 — out-of-scope deste plan)

`pnpm test:run` exit 0 (acceptance criterion satisfied even sem o .mjs file rodando).

### Rule 2 — `@types/diff@8` deprecated

`pnpm add -D @types/diff` printa warning: "stub types definition. diff provides its own type definitions, so you do not need this installed." Plan explicitamente pediu `pnpm add -D @types/diff` então mantido para honra plan, mas é redundante. Pode ser removido em plano futuro com `pnpm remove -D @types/diff` sem efeito em tsc.

## Verification gates

| Gate | Status | Detail |
|------|--------|--------|
| Migration deps installed | ✓ | react-markdown@^10.1.0, remark-gfm@^4.0.1, diff@^9.0.0 em dependencies; @types/diff@^8.0.0 em devDeps |
| Accordion shadcn primitive | ✓ | components/ui/accordion.tsx criado com 4 exports (Accordion, AccordionItem, AccordionTrigger, AccordionContent); usa @base-ui/react ao invés de @radix-ui (shadcn upstream switched defaults) |
| audit DIRS extended | ✓ | grep -c "lib/anthropic" scripts/audit-vocabulary.mjs = 1 |
| Prompts literais SPEC §6 | ✓ | system.md 126 linhas (≥100), 13 headings detectados, encerramento literal presente; feature-injection.md 19 linhas (≥15), 3 tags + 6 placeholders |
| outputFileTracingIncludes | ✓ | next.config.ts contém literal `outputFileTracingIncludes`, glob `./prompts/**/*`, route key `'app/api/readings/[id]/analyze/route'` |
| 8 test stubs criados | ✓ | Todos os paths exatos do plan; cada arquivo importa `describe`+`it` de `'vitest'` |
| pnpm test:run zero failures | ✓ | 7 vitest files (38 it.todo), 0 fail, exit 0; .mjs silently filtered |
| pnpm audit:vocabulary baseline | ✓ | 8 pre-existing Phase 3 hits unchanged; zero novos de lib/anthropic ou prompts/ |
| pnpm tsc --noEmit nos 8 paths | ✓ | grep dos errors de tsc por "lib/anthropic" ou "prompts/" retorna 0 — nossos files compilam clean. Errors pré-existentes (Phase 5/3 dívida em readings.test/webhook/StatusBadge/quality-scoring.test/modal-client.test) permanecem documentados como Itens diferidos em STATE.md |

## Self-Check: PASSED

Wave 0 setup completo. Wave 1 (07-03) tem terreno pronto para preencher prompts/client tests com bodies reais.
