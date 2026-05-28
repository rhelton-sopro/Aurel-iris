---
phase: 08-pagamento-lgpd
plan: 03
subsystem: billing + auth + audit (shared utilities)
tags: [billing-config, cpf-validation, lgpd-04, audit-log, pure-utilities]
requires: []
provides:
  - "lib/billing/config.ts — single source of truth dos números de billing/trial (D-03/06/11/13)"
  - "lib/auth/cpf.ts — validador CPF módulo-11 puro (cpfDigits/formatCpfBR/isValidCpf)"
  - "lib/audit/events.ts — AuditEventType union + AUDIT_EVENT_TYPES Set canônico"
  - "lib/audit/log.ts — logAuditEvent best-effort emitter (LGPD-04 básico)"
affects:
  - "Plans downstream 04/05/06/07/08/09/11/13 importam destes módulos"
tech-stack:
  added: []
  patterns:
    - "single-source-of-truth constants (espelha lib/beta/config.ts)"
    - "pure validation idiom (espelha lib/profile/fields.ts phoneIsValidBR)"
    - "best-effort try/catch emitter — nunca throwa pra caller"
key-files:
  created:
    - apps/web/lib/billing/config.ts
    - apps/web/lib/auth/cpf.ts
    - apps/web/lib/auth/__tests__/cpf.test.ts
    - apps/web/lib/audit/events.ts
    - apps/web/lib/audit/log.ts
    - apps/web/lib/audit/__tests__/log.test.ts
  modified: []
decisions:
  - "Test fixture leading-zeros CPF corrigido de 00012345672 (checksum inválido) para 00012345601 (válido)"
  - "metadata cast Record<string,unknown> -> Json no boundary do insert (tipo recursivo Supabase)"
metrics:
  duration: ~7min
  completed: 2026-05-28
  tasks: 3
  files: 6
  tests: 12
---

# Phase 8 Plan 03: Utilities compartilhadas (billing config + CPF + audit log) Summary

3 utilities puras reusáveis por todas as Waves 2-5 da Fase 8: constants imutáveis de billing, validador CPF módulo-11 inline (sem dep externa), e emitter de audit log best-effort para LGPD-04 básico.

## What Was Built

**Task 1 — `lib/billing/config.ts`** (`ea1f1af`)
- 5 constants imutáveis (`as const`): `TRIAL_READINGS_MAX=3`, `TRIAL_DAYS=60`, `CREDIT_VALIDITY_DAYS=365`, `RESERVATION_DAYS=7`, `REFUND_WINDOW_DAYS=7`
- 5 date helpers: `addDays`, `trialExpiresAt`, `creditExpiresAt`, `reservationExpiresAt`, `refundWindowEndsAt`
- Arquivo puro (sem `'use server'`/`'server-only'`) — importável de UI client, zod schema e tests

**Task 2 — `lib/auth/cpf.ts` + test** (RED `d3347c1`, GREEN `f7125a0`)
- `cpfDigits` (strip non-dígitos, null-safe), `formatCpfBR` (máscara progressiva), `isValidCpf` (módulo-11 inline)
- Rejeita: length errado, 11 dígitos repetidos, checksum inválido. Aceita: com/sem máscara, leading zeros
- Sem dependência externa (per RESEARCH §Don't Hand-Roll)

**Task 3 — `lib/audit/events.ts` + `lib/audit/log.ts` + test** (RED `95e2968`, GREEN `ec20a06`)
- `events.ts`: `AuditEventType` union (20 tipos: auth/consent/reading/billing/lgpd/admin) + `AUDIT_EVENT_TYPES` Set canônico
- `log.ts`: `logAuditEvent` faz INSERT em `audit_events` via service client (bypass RLS), best-effort — NUNCA throwa pra caller (error path e reject path → `console.warn`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test fixture de CPF com leading zeros tinha checksum inválido**
- **Found during:** Task 2 (pré-execução, validando o algoritmo do plano contra os fixtures)
- **Issue:** O plano asserta `isValidCpf('00012345672') === true`, mas o algoritmo módulo-11 (correto) retorna `false` — o checksum real do prefixo `000123456` é `01`, não `72`.
- **Fix:** Fixture corrigido para `00012345601` (CPF leading-zeros genuinamente válido, derivado pelo próprio algoritmo). O algoritmo do plano permaneceu inalterado.
- **Files modified:** apps/web/lib/auth/__tests__/cpf.test.ts
- **Commit:** d3347c1

**2. [Rule 3 - Blocking] metadata `Record<string, unknown>` não assignável ao tipo `Json` no insert**
- **Found during:** Task 3
- **Issue:** `service.from('audit_events').insert({ metadata: ... })` falhava no tsc (TS2769) porque o tipo `Json` gerado pelo Supabase é recursivo e `Record<string, unknown>` não é estruturalmente assignável.
- **Fix:** Cast `(event.metadata ?? null) as Json` apenas no boundary do insert (import type `Json` de `@/types/database`). A API pública `AuditEventInput.metadata` manteve `Record<string, unknown> | null` para ergonomia do caller.
- **Files modified:** apps/web/lib/audit/log.ts
- **Commit:** ec20a06

## Verification

- **Tests:** 12 vitest GREEN (8 cpf `it` blocks cobrindo 4 describes + 4 audit) — `pnpm vitest run lib/auth/__tests__/cpf.test.ts lib/audit/__tests__/log.test.ts`
- **TSC:** zero erros nos 6 arquivos novos (`tsc --noEmit | grep lib/{audit,auth/cpf,billing}` vazio)
- **Lint:** `eslint` scoped nos 6 arquivos com `--max-warnings 0` → exit 0
- **Zero deps npm novas**

## TDD Gate Compliance

Tasks 2 e 3 seguiram RED→GREEN:
- Task 2: `test(...)` d3347c1 (RED, falha por módulo ausente) → `feat(...)` f7125a0 (GREEN)
- Task 3: `test(...)` 95e2968 (RED) → `feat(...)` ec20a06 (GREEN)
- Refactor: não necessário em nenhuma task.

## Threat Surface

Nenhuma nova superfície fora do `<threat_model>` do plano. `logAuditEvent` usa service-role (bypass RLS) intencionalmente per design (T-08-03-01 accept); `isValidCpf` é função pura sem boundary.

## Self-Check: PASSED

- 6 arquivos FOUND
- 5 commits FOUND (ea1f1af, d3347c1, f7125a0, 95e2968, ec20a06)
- 12 tests GREEN, scoped lint exit 0, tsc limpo nos novos arquivos
