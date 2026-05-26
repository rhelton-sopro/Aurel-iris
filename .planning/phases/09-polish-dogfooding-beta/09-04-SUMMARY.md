---
phase: 09-polish-dogfooding-beta
plan: "04"
subsystem: admin-instrumentation
tags: [dogfooding, gate, admin, reports, tdd, onboarding]
dependency_graph:
  requires: []
  provides: [fetchDogfoodingProgress, DogfoodingProgress, DogfoodingWeekRow]
  affects: [apps/web/app/admin/relatorios/page.tsx]
tech_stack:
  added: []
  patterns: [TDD RED/GREEN, supabase-mock chain, vi.useFakeTimers, ISO week bucketing]
key_files:
  created:
    - apps/web/lib/admin/dogfooding.ts
    - apps/web/lib/admin/dogfooding.test.ts
  modified:
    - apps/web/app/admin/relatorios/page.tsx
decisions:
  - "Constantes exportadas (DOGFOODING_START_DATE, WEEKLY_THRESHOLD, CONSECUTIVE_WEEKS_REQUIRED) para reuso direto em page.tsx sem magic numbers"
  - "Streak calculada do final do array ASC — streak mais recente, nao acumulada total"
  - "gateClosedAt aponta para week_start da semana qualifying mais recente (proxy, nao data exata de encerramento)"
  - "Helpers startOfIsoWeek + formatWeekLabel privados — superficie exportada minima"
  - "Emojis removidos do JSX (regra: no-emoji unless explicitly requested)"
metrics:
  duration: "~4 minutos"
  completed: "2026-05-26T14:45:00Z"
  tasks_completed: 2
  files_changed: 3
---

# Phase 09 Plan 04: Dogfooding Gate Instrumentation Summary

**One-liner:** Instrumentacao do gate de dogfooding (ONBOARD-04/D-05) via modulo fetchDogfoodingProgress com ISO-week bucketing, streak de 3 semanas consecutivas, e bloco novo em /admin/relatorios.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Modulo lib/admin/dogfooding.ts + 8 testes TDD | `47fd629` | dogfooding.ts, dogfooding.test.ts |
| 2 | Bloco "Dogfooding gate" em /admin/relatorios | `c75fca9` | relatorios/page.tsx, dogfooding.test.ts |

## What Was Built

### lib/admin/dogfooding.ts

- `fetchDogfoodingProgress(founderUserId: string | null)` — query principal
- Constantes exportadas: `DOGFOODING_START_DATE = '2026-05-15'`, `WEEKLY_THRESHOLD = 3`, `CONSECUTIVE_WEEKS_REQUIRED = 3`
- Tipos exportados: `DogfoodingWeekRow`, `DogfoodingProgress`
- Logica: agrupa readings por semana ISO (segunda-feira), distingue `is_self=false` (reais) vs `is_self=true` (autoexame), calcula streak mais recente, deriva `gateClosedAt`
- Retorno: `{ startDate, weeksElapsed, weeklyRows[], gateClosedAt, consecutiveQualifyingWeeks }`

### dogfooding.test.ts (8 testes, 8/8 GREEN)

| # | Cenario | Cobre |
|---|---------|-------|
| T1 | founderUserId null | early return sem supabase |
| T2 | zero readings | buckets vazios, streak=0 |
| T3 | 3 semanas consecutivas >=3 reais | consecutiveQualifyingWeeks=3, gateClosedAt preenchido |
| T4 | mix autoexame + reais | so is_self=false conta pro qualifies |
| T5 | streak quebrada | reset na quebra, conta streak mais recente apenas |
| T6 | ordering | DESC por week_start confirmado |
| T7 | week_label | regex DD/MM-DD/MM em todos os buckets |
| T8 | edge case start date | semana ISO de 2026-05-15 = segunda 2026-05-11 |

### /admin/relatorios/page.tsx

- Import de `fetchDogfoodingProgress + CONSECUTIVE_WEEKS_REQUIRED + WEEKLY_THRESHOLD`
- `fetchDogfoodingProgress(user.id)` adicionado ao `Promise.all` existente
- Bloco 6 "Dogfooding gate — ONBOARD-04 (Fase 9)" abaixo de "Aproveitamento por dispositivo":
  - Tabela KPIs: data inicio, semanas decorridas, streak X/3, status gate (ABERTO/FECHADO)
  - Tabela historico semanal: semana/reais/autoexame/total/qualifica

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] WEEKLY_THRESHOLD import nao utilizado em assertion**
- **Found during:** Task 2 (lint check)
- **Issue:** WEEKLY_THRESHOLD importado no test mas referenciado so em comentario — lint warning `@typescript-eslint/no-unused-vars`
- **Fix:** T4 usa `WEEKLY_THRESHOLD` como bound na assertion `expect(real_count).toBeLessThan(WEEKLY_THRESHOLD)` — semantica mais rica e elimina warning
- **Files modified:** dogfooding.test.ts
- **Commit:** `c75fca9`

**2. [Rule 2 - UX] Emojis removidos do JSX**
- **Found during:** Task 2 (CLAUDE.md enforcement check)
- **Issue:** Plano usava "🎯 FECHADO" e "⏳ ABERTO" — memoria do projeto e CLAUDE.md proibem emojis sem solicitacao explicita
- **Fix:** Texto simples "FECHADO em DD/MM/YYYY" e "ABERTO"
- **Files modified:** relatorios/page.tsx

**3. [Rule 1 - Bug] Parsing de startDate + gateClosedAt com fuso horario**
- **Found during:** Task 2 (revisao pre-commit)
- **Issue:** `new Date('2026-05-15')` sem sufixo T00:00:00Z interpreta como local timezone em alguns ambientes, podendo retornar data anterior (dd-1) em fuso negativo
- **Fix:** `new Date(dogfooding.startDate + 'T00:00:00Z')` e `new Date(dogfooding.gateClosedAt + 'T00:00:00Z')` — UTC explicito
- **Files modified:** relatorios/page.tsx

## LGPD Audit

Grep em `dogfooding.ts` e `relatorios/page.tsx` (novo JSX): zero ocorrencias de "diagnostico", "tratamento", "cura". Vocabulario utilizado: leituras, clientes reais, autoexame, gate, qualifying, semanas.

## Known Stubs

Nenhum. O bloco exibe dados reais do banco via `fetchDogfoodingProgress` — counts calculados de readings.is_self via JOIN com clients. Se founderUserId for null (nao esperado no contexto do founder gate), tabela mostra zeros corretamente.

## Threat Flags

Nenhuma superficie nova alem da descrita no threat_model do plano:
- Bloco protegido pelo `isFounderEmail` check existente (linha 42-44) + middleware /admin gate
- Query filtra `.eq('therapist_id', founderUserId)` — sem vazamento cross-terapeuta

## Self-Check: PASSED

| Item | Status |
|------|--------|
| apps/web/lib/admin/dogfooding.ts | FOUND |
| apps/web/lib/admin/dogfooding.test.ts | FOUND |
| .planning/phases/09-polish-dogfooding-beta/09-04-SUMMARY.md | FOUND |
| commit 47fd629 | FOUND |
| commit c75fca9 | FOUND |
| 8/8 vitest GREEN | PASSED |
