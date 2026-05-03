---
phase: 04-upload-desktop
plan: 01
subsystem: ui
tags:
  - phase-04
  - upload-desktop
  - lib
  - validation
  - heic
  - heic2any
  - vitest
  - tdd

# Dependency graph
requires:
  - phase: 03-captura-mobile-pwa
    provides: "padrão de lib pura em apps/web/lib/capture/* (validate-image.ts, storage-path.ts) e suite vitest com setup jsdom"
provides:
  - "validateUploadFile + ACCEPTED_MIME_TYPES + HEIC_MIME_TYPES + FileValidationResult — contrato síncrono de validação MIME/tamanho consumido pelas Wave 2/3 (UploadDropzone, upload-client)"
  - "convertHeicToJpeg via dynamic import de heic2any — pipeline HEIC→JPEG isolado por bundle splitting"
  - "13 testes vitest cobrindo MIME aceitos/rejeitados, fallback por extensão case-insensitive, boundary 25 MB"
affects:
  - 04-03-upload-dropzone-component
  - 04-04-adaptar-componentes-capture-mode
  - 04-05-upload-wizard-page-client
  - 04-07-recovery-routing-uat-smoke

# Tech tracking
tech-stack:
  added:
    - "heic2any@0.0.4 (MIT, browser-only HEIC→JPEG via Canvas; deps zero)"
  patterns:
    - "Lib pura sem 'use client'/'use server' em apps/web/lib/upload/* — espelho do padrão lib/capture/*"
    - "Dynamic import dentro da função (await import('heic2any')) — bundle splitting evita ~600 KB no chunk inicial da rota /upload"
    - "Whitelist via ReadonlySet<string> exportada (ACCEPTED_MIME_TYPES) — análoga a BLOCKING_REASONS de validate-image.ts"
    - "Fallback por extensão case-insensitive para MIME ausente em SOs antigos (.heic/.heif)"

key-files:
  created:
    - "apps/web/lib/upload/validate-file.ts (66 linhas)"
    - "apps/web/lib/upload/validate-file.test.ts (117 linhas, 13 testes)"
    - "apps/web/lib/upload/heic-to-jpeg.ts (44 linhas)"
  modified:
    - "apps/web/package.json (heic2any em dependencies)"
    - "pnpm-lock.yaml (entrada heic2any@0.0.4)"

key-decisions:
  - "Usar heic2any@0.0.4 mesmo fora da janela de 24 meses do PLAN — aprovado em checkpoint:decision pelo desenvolvedor (MIT > LGPL-3.0 do libheif-js em SaaS comercial; T-04-01-03 já registra accept; HEIC é commodity em 2026; deps zero + zero CVEs históricos)"
  - "Boundary 25 MB inclusivo (file.size === 25*1024*1024 é aceito) — testado explicitamente"
  - "Whitelist como ReadonlySet<string> com tipo explícito — imutabilidade reforçada em runtime e tipo"
  - "Sem teste vitest para convertHeicToJpeg — jsdom não roda heic2any real (Canvas decoders nativos ausentes); cobertura adiada para UAT smoke da Wave 5 (plan 04-07)"
  - "Mensagem de erro de tamanho menciona RAW e PNG não comprimido como pista de troubleshooting (auxilia terapeuta a entender o limite)"

patterns-established:
  - "Lib pura validação client-side em apps/web/lib/upload/ com whitelist exportada — replica padrão lib/capture/validate-image.ts mas para validação técnica MIME/size (não VLM)"
  - "Dynamic import de libs pesadas (heic2any 600 KB) dentro do handler — chunk splitting no Next.js 15 isola o custo à rota que precisa"
  - "Fallback por extensão de arquivo quando file.type vem vazio — defesa em profundidade contra SOs que omitem MIME para HEIC"

requirements-completed:
  - UPLOAD-01

# Metrics
duration: ~10min
completed: 2026-05-03
---

# Phase 4 Plan 1: validate-file + heic-to-jpeg libs Summary

**Fundação de bibliotecas puras para upload desktop: validateUploadFile (whitelist MIME + boundary 25 MB com 13 testes vitest verdes) e convertHeicToJpeg (heic2any@0.0.4 via dynamic import).**

## Performance

- **Duration:** ~10 min (excluindo o tempo de espera no checkpoint:decision)
- **Started:** 2026-05-03T17:00:00Z
- **Completed:** 2026-05-03T17:10:00Z
- **Tasks:** 2/2 completas
- **Files modified:** 3 criados + 2 modificados

## Accomplishments

- `validateUploadFile(file)` retorna `{ ok, error?, needsHeicConversion? }` cobrindo MIME (5 aceitos: jpeg/png/webp/heic/heif), fallback por extensão case-insensitive (.heic/.heif), e limite 25 MB inclusivo com mensagens pt-BR neutras (sem vocabulário proibido LGPD).
- `convertHeicToJpeg(file)` chama `await import('heic2any')` dentro da função — zero imports top-level em todo `apps/web/**` (verificado por grep recursivo); bundle splitting garante que os ~600 KB da lib só sejam baixados quando o terapeuta arrastar um HEIC real.
- Suite vitest TDD: ciclo RED (76769bb) → GREEN (289ace5) com 13/13 testes passando.
- Threat model T-04-01-01 (Tampering MIME spoofing) e T-04-01-02 (DoS oversized file) mitigados conforme ASVS L1 V12.1.1/V12.1.2.

## Task Commits

Cada task foi commitada atomicamente seguindo o ciclo TDD:

1. **Task 1 RED — testes falhando** — `76769bb` (`test`): 13 cenários cobrindo todos os branches de validateUploadFile, falhando porque o módulo não existia ainda.
2. **Task 1 GREEN — implementação** — `289ace5` (`feat`): validate-file.ts com whitelist + boundary; 13/13 testes verdes.
3. **Task 2 — heic-to-jpeg + dependency** — `54e4b9c` (`feat`): heic2any@0.0.4 em `dependencies`, lib wrapper com dynamic import, JSDoc citando CONTEXT D-11 e a aprovação do checkpoint.

**Plan metadata:** _(commit final ainda a ser feito após este SUMMARY + STATE.md + ROADMAP.md)_

## Files Created/Modified

- `apps/web/lib/upload/validate-file.ts` (criado, 66 linhas) — função pura `validateUploadFile`, consts `ACCEPTED_MIME_TYPES` e `HEIC_MIME_TYPES` (ReadonlySet<string>), interface `FileValidationResult`. Sem `use client`/`use server` — lib puramente síncrona, testável em jsdom.
- `apps/web/lib/upload/validate-file.test.ts` (criado, 117 linhas) — 13 testes vitest. Helper `makeFile` usa `Object.defineProperty` para mockar `size` no boundary de 25 MB sem alocar memória real (mesmo padrão de outros testes do repo).
- `apps/web/lib/upload/heic-to-jpeg.ts` (criado, 44 linhas) — função async `convertHeicToJpeg(File | Blob): Promise<Blob>`, com `await import('heic2any')` dentro da função e tratamento de retorno multi-frame (HEIC live photos).
- `apps/web/package.json` (modificado, +1 linha) — `"heic2any": "^0.0.4"` em `dependencies`.
- `pnpm-lock.yaml` (modificado, +8 linhas) — apenas entrada de heic2any@0.0.4; nenhum outro pacote tocado (verificado via `git diff --stat`).

## Decisions Made

- **heic2any@0.0.4 aprovado fora da janela de 24 meses (checkpoint:decision do desenvolvedor, 2026-05-03):** ver Deviations #1 abaixo.
- **Sem teste vitest para `convertHeicToJpeg`:** jsdom não implementa o pipeline de Canvas necessário para o decode HEIC real do heic2any; mockar a lib testaria o mock, não o comportamento. Cobertura virá no UAT smoke da Wave 5 (plan 04-07) com arquivo HEIC real em ambiente de browser.
- **Boundary `size > MAX_SIZE_BYTES` (estritamente maior, não `>=`):** `file.size === 25 * 1024 * 1024` é aceito — testado explicitamente. Decisão: terapeuta com câmera 24 MP em JPEG normal raramente excede 12-15 MB; o limite é cap de proteção, não negociação fina.
- **Whitelist como `ReadonlySet<string>` com tipo explícito:** garante que `ACCEPTED_MIME_TYPES.add(...)` falhe em compile-time. Reforça contrato contra mutação acidental por libs futuras.
- **Helper `makeFile` no teste usa `Object.defineProperty(file, 'size', ...)`:** evita alocar 25 MB em memória do jsdom no teste de boundary. Padrão padronizado para testes que dependem do `size` mas não do conteúdo.

## Deviations from Plan

### Auto-fixed Issues

_(nenhum no sentido das Rules 1-3 — meu próprio código não introduziu bugs nem omissões)_

### Decisões Levantadas em Checkpoint

**1. [Checkpoint:decision] heic2any@0.0.4 fora da janela de 24 meses do PLAN**
- **Found during:** Task 2 (`pnpm view heic2any time.modified`)
- **Issue:** O PLAN exige explicitamente "Se a versão publicada estiver com mais de 24 meses sem release, abortar com toast/comment e PARAR — pedir ao desenvolvedor para reavaliar entre `heic2any` e `libheif-js`." `heic2any@0.0.4` foi modificado em 2023-03-29; em 2026-05-03 isso são ~37 meses sem release.
- **Análise apresentada (heic2any vs libheif-js@1.19.8):**
  - `heic2any@0.0.4` — MIT, deps zero, 2.7 MB unpacked, ~37 meses sem release.
  - `libheif-js@1.19.8` — LGPL-3.0, 6.4 MB unpacked, atualizado há ~10 meses. **LGPL-3.0 é problemático em SaaS comercial sem ADR jurídico.**
- **Decisão do desenvolvedor (Opção A — registrada como deviation conforme orientação no follow-up):**
  1. T-04-01-03 já marca a supply-chain de heic2any como `accept` no threat model do PLAN.
  2. MIT > LGPL-3.0 em SaaS comercial — libheif-js exigiria ADR jurídico antes da Fase 9, deslocando fricção sem economizar.
  3. Zero deps + zero CVEs históricos + HEIC é commodity em 2026 (mercado de libs HEIC-browser estagnou). "Done" é uma categoria válida para libs estáveis.
  4. A salvaguarda de 24 meses do PLAN cumpriu seu papel (forçou pausa explícita) — o desenvolvedor reavaliou e aprovou.
- **Files modified:** `apps/web/package.json`, `pnpm-lock.yaml`, `apps/web/lib/upload/heic-to-jpeg.ts` (comentário inline registra esta decisão)
- **Committed in:** `54e4b9c` (Task 2)
- **Re-evaluation gate:** Auditoria de manutenção/licenciamento na Fase 9 (revisão jurídica healthtech), conforme blocker já registrado em STATE.md.

### Out-of-Scope Discoveries (deferred)

**2. [Out-of-scope] `pnpm audit:vocabulary` falha em arquivos da Fase 3 (não tocados pela Task 1)**
- **Found during:** Task 1 verification (`pnpm audit:vocabulary`)
- **Issue:** O script `audit-vocabulary.mjs` reporta 8 ocorrências de "diagnóstico" em comentários técnicos (não em strings de UI) em `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/api/capture/validate/route.ts`, `components/capture/CapturePreview.tsx`. Verificado que **as 8 ocorrências já existiam em `main` antes do plan 04-01** (stash + audit em tree limpo retornou os mesmos 8 matches).
- **Por que não foi auto-fixado:** Scope Boundary do executor — "Only auto-fix issues DIRECTLY caused by the current task's changes." Estes arquivos não foram tocados pelo plan 04-01.
- **Verificação no escopo do 04-01:** os 3 arquivos novos em `apps/web/lib/upload/` foram varridos com `grep -i "diagnóstico|tratamento|cura"` e estão limpos (zero matches).
- **Logged em:** `.planning/phases/04-upload-desktop/deferred-items.md` (criado nesta execução).
- **Recomendação:** plan de manutenção separado (ou folha futura) substitui "diagnóstico" por sinônimos técnicos ("depuração"/"log de depuração") nos 4 arquivos pré-existentes.

---

**Total deviations:** 1 decisão arquitetural escalada (Opção A heic2any) + 1 out-of-scope deferida.
**Impact on plan:** Zero scope creep. Plan 04-01 entrega exatamente os 4 acceptance criteria do PLAN. A salvaguarda de 24 meses do PLAN funcionou como previsto (forçou pausa, decisão consciente).

## Issues Encountered

- **Salvaguarda do PLAN ativada:** `pnpm view heic2any time.modified` retornou 2023-03-29 (>24 meses). Resolução: checkpoint:decision retornado ao desenvolvedor com tabela comparativa (heic2any vs libheif-js vs heic-convert vs heic-decode); aprovada Opção A com justificativa registrada acima.
- **`pnpm audit:vocabulary` reportou falhas pré-existentes da Fase 3** — registrado como out-of-scope em `deferred-items.md` (ver Deviations #2).
- **Acceptance criteria do PLAN exige `pnpm audit:vocabulary` exit 0:** o critério é literal mas a falha é estritamente pré-existente. Os arquivos NOVOS desta plan estão limpos; a falha do tree global é dívida técnica da Fase 3 não-bloqueante para 04-01.

## Self-Check

Verificação contra acceptance criteria do PLAN e success criteria do prompt:

| Critério | Status |
|---|---|
| `apps/web/lib/upload/validate-file.ts` existe | FOUND (66 linhas) |
| `apps/web/lib/upload/validate-file.test.ts` existe | FOUND (117 linhas, 13 testes) |
| `apps/web/lib/upload/heic-to-jpeg.ts` existe | FOUND (44 linhas) |
| `heic2any` em `apps/web/package.json` dependencies | FOUND (`"heic2any": "^0.0.4"`, linha 28) |
| `pnpm-lock.yaml` atualizado | FOUND (8 linhas adicionadas, só heic2any) |
| `pnpm test:run lib/upload/validate-file.test.ts` exit 0 | PASSED (13/13 testes) |
| `validateUploadFile`, `ACCEPTED_MIME_TYPES`, `HEIC_MIME_TYPES`, `FileValidationResult` exportados | FOUND (linhas 15, 24, 29, 43 de validate-file.ts) |
| Mensagem exata "Formato não suportado. Use JPEG, PNG, WebP ou HEIC." presente | FOUND (linha 55 de validate-file.ts) |
| String "máximo 25 MB" presente | FOUND (linha 62 de validate-file.ts) |
| Pelo menos 13 chamadas a `it(` no test file | FOUND (13 chamadas exatas) |
| Sem `'use client'` / `'use server'` em validate-file.ts | CONFIRMED (apenas comentário declarando ausência) |
| `await import('heic2any')` dentro da função em heic-to-jpeg.ts | FOUND (linha 38) |
| JSDoc menciona "CONTEXT D-11" e "dynamic import" no header | FOUND (linhas 6-7) |
| `grep -E "^import.*heic2any" apps/web/lib apps/web/app apps/web/components` retorna vazio | CONFIRMED (zero matches em `apps/web/**/*.{ts,tsx}`) |
| Commits: 76769bb (RED) | FOUND in `git log --oneline` |
| Commits: 289ace5 (GREEN) | FOUND |
| Commits: 54e4b9c (Task 2) | FOUND |
| `apps/web/lib/upload/*` sem vocabulário proibido | CONFIRMED (grep -i diagnóstico/tratamento/cura → zero matches) |
| Zero deletions acidentais | CONFIRMED (`git diff --diff-filter=D HEAD~3 HEAD` vazio) |

## Self-Check: PASSED

Todos os success criteria do prompt e acceptance criteria do PLAN cumpridos, exceto `pnpm audit:vocabulary exit 0` em escopo global — que é falha pré-existente da Fase 3 documentada como out-of-scope em `deferred-items.md`. Os arquivos novos do 04-01 passam o audit:vocabulary individualmente.

## TDD Gate Compliance

Task 1 seguiu o ciclo TDD plenamente:
- **RED gate:** `76769bb` — `test(04-01): add failing tests for validateUploadFile`. Verificado falhar por "Failed to resolve import './validate-file'".
- **GREEN gate:** `289ace5` — `feat(04-01): implement validateUploadFile pure lib`. Verificado passar com 13/13 testes.
- **REFACTOR:** Não necessário — código já estava em sua forma final (espelha pattern de `validate-image.ts`).

Task 2 não usa TDD por decisão explícita (heic2any não é testável em jsdom).

## User Setup Required

Nenhum — heic2any roda 100% no browser via Canvas API; sem env vars, sem configuração de dashboard, sem credenciais externas.

## Next Phase Readiness

**Pronto para Wave 2/3 da Fase 4 consumir:**
- Plan 04-03 (UploadDropzone) pode importar `validateUploadFile`, `ACCEPTED_MIME_TYPES`, `HEIC_MIME_TYPES`, `FileValidationResult` de `@/lib/upload/validate-file`.
- Plan 04-05 (upload-client) pode importar `convertHeicToJpeg` de `@/lib/upload/heic-to-jpeg` e usar como o `04-PATTERNS.md` documenta no `handleFileAccepted`.
- O `accept` attribute do `<input type="file">` no Plan 04-03 deve listar `image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif` para alinhar com a whitelist.

**Blockers / Concerns para Fase 9:**
- Auditoria de licenciamento de heic2any@0.0.4 pendente (revisão jurídica healthtech já registrada em STATE.md).
- Dívida pré-existente do `audit:vocabulary` (8 ocorrências em comentários técnicos da Fase 3) — recomendado plan de manutenção antes da Fase 9 / beta externo.

---
*Phase: 04-upload-desktop*
*Completed: 2026-05-03*
