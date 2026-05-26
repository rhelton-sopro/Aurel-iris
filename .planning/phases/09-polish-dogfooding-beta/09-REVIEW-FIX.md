---
phase: 09-polish-dogfooding-beta
fixed_at: 2026-05-26
review_path: .planning/phases/09-polish-dogfooding-beta/09-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 09: Code Review Fix Report

**Fixed at:** 2026-05-26
**Source review:** `.planning/phases/09-polish-dogfooding-beta/09-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (1 HIGH + 2 MEDIUM + 3 LOW)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### H-01: `therapistName` não é HTML-escaped no HTML body do e-mail

**Files modified:** `apps/web/lib/notifications/notify-report-ready.ts`
**Commit:** `9e8ffde`
**Applied fix:** Linha 60 — `greeting` agora usa `escapeHtml(therapistName)` em vez de `therapistName` literal.
Consistência com `clientName` que já era escapado na linha 84. Vetor XSS via `profiles.full_name`
(campo editável pelo terapeuta) eliminado.

---

### M-01: `full_name` ausente no SELECT do profile — greeting sempre "Olá" sem nome

**Files modified:** `apps/web/lib/notifications/notify-report-ready.ts`
**Commit:** `4403eea`
**Applied fix:** Desestruturação do `Promise.all` ampliada para capturar `error: profileErr` da query
`maybeSingle()` do profile. Se `profileErr` não é null, emite `console.warn` com o ID do terapeuta
e a mensagem de erro — tornando degradação silenciosa visível nos logs de produção.

---

### M-02: `weeksElapsed` usa `Math.ceil` — inflaciona em ~1 semana no início do dogfooding

**Files modified:** `apps/web/lib/admin/dogfooding.ts`
**Commit:** `dd8e471`
**Applied fix:** `Math.ceil` → `Math.floor` na linha 67. "Semanas decorridas" agora reflete semanas
completas, não arredondadas pra cima. Elimina discrepância entre o contador e a tabela semanal ISO
(que conta apenas semanas onde houve leituras).

---

### L-01: `console.log` para ausência de RESEND_API_KEY

**Files modified:** `apps/web/lib/notifications/notify-report-ready.ts`
**Commit:** `61748d7` (combinado com L-02 e L-03)
**Applied fix:** `console.log` → `console.warn` na linha 36. Ausência de API key em produção é
degradação esperada, não fluxo normal — `warn` dá visibilidade adequada nos logs.

---

### L-02: Duplo import de `buttonVariants` em `onboarding-wizard.tsx`

**Files modified:** `apps/web/components/dashboard/onboarding-wizard.tsx`
**Commit:** `61748d7` (combinado com L-01 e L-03)
**Applied fix:** Dois imports separados do mesmo módulo `@/components/ui/button` (linhas 3-4)
consolidados em um único `import { Button, buttonVariants } from '@/components/ui/button'`.

---

### L-03: `gateClosedAt` mostra `week_start` sem indicar que é início da semana

**Files modified:** `apps/web/app/admin/relatorios/page.tsx`
**Commit:** `61748d7` (combinado com L-01 e L-02)
**Applied fix:** Copy `FECHADO em DD/MM/AAAA` → `FECHADO em DD/MM/AAAA (semana de início)`.
Deixa explícito que a data é o `week_start` (segunda-feira ISO) da última semana qualifying,
não a data exata de encerramento do gate — alinhado com o que o REVIEW.md documentou como
"decisão conhecida" no summary do plan 09-04.

---

## Skipped Issues

Nenhum — todos os 6 findings foram aplicados com sucesso.

---

## Test & Lint Status

**Tests:** 4 test files com failures, todos pre-existing debt:
- `lib/anthropic/__tests__/prompts.test.ts` — 2 failures (snapshot drift, pre-existing, ver memory `feedback_prompts_test_snapshot_drift`)
- `lib/capture/quality-scoring.test.ts` — 3 failures (Phase 3 debt, ver memory `feedback_quality_scoring_test_gate`)
- `lib/pdf/report-print-document.test.tsx` — 1 failure (pre-existing, não relacionado a esta fase)
- Arquivos modificados (`notify-report-ready.test.ts` etc.) — todos passaram

**Lint:** 10 erros em arquivos untracked pré-existentes (`scripts/test-haiku-vs-sonnet-stage1.mts`,
`scripts/run-sonnet-direct.spec.ts`). Nenhum erro nos 4 arquivos modificados nesta fase.

---

_Fixed: 2026-05-26_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
