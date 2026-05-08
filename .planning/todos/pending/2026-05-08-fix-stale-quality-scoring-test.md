---
created: 2026-05-08
title: Realinhar quality-scoring.test.ts com keys atuais de WEIGHTS
area: testing
files:
  - apps/web/lib/capture/quality-scoring.test.ts:49,54,110
  - apps/web/lib/capture/quality-scoring.ts:57
---

## Problem

Detectado pelo post-merge test gate da Wave 4 (Phase 7, plan 07-07) em 2026-05-08. 3 testes falham em `lib/capture/quality-scoring.test.ts`:

1. `overallScore > weights individual values` — `WEIGHTS.reflex + WEIGHTS.occlusion` retorna NaN
2. `overallScore > reflex true cancels its 0.15 contribution` — mesma raiz
3. `dominantFailure + feedbackMessage > returns reflex when reflexInIrisCenter=true and score < 0.75` — score 0.7999 não é menor que 0.75

Causa raiz: o teste referencia `WEIGHTS.reflex` mas o constante `WEIGHTS` em `quality-scoring.ts:57` exporta apenas `centeredness, distance, sharpness, exposure, occlusion`. A chave `reflex` foi removida ou renomeada nos commits Phase 3 (`2e222ba` fix(03-06) e `8c1ce9d` fix(03-05)) mas os testes ficaram stale.

Sem relação alguma com Phase 7 — é dívida de teste de Phase 3 que passou despercebida no verifier original.

## Solution

Inspecionar a refatoração que removeu `WEIGHTS.reflex`:
- Se `reflex` virou outro mecanismo (e.g. multiplicador 0/1 sobre `overallScore` em vez de peso aditivo), reescrever os 3 cases para refletir a aritmética nova
- Confirmar que o behavior testado (peso ~0.15 do reflex) ainda existe em algum lugar — caso contrário o teste de regressão já não vale e deve ser deletado
- Rodar `pnpm --filter web test:run lib/capture/quality-scoring.test.ts` até GREEN

Commit como `fix(quality-scoring): align test with current WEIGHTS keys`.
