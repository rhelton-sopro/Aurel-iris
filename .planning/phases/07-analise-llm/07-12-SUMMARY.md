---
phase: 07-analise-llm
plan: 12
subsystem: server-actions
tags: [server-actions, lgpd, audit, terminal-state, gap-closure]
dependency_graph:
  requires:
    - apps/web/lib/anthropic/types.ts (ENCERRAMENTO_LITERAL + AuditMetadata)
    - apps/web/lib/anthropic/audit.ts (extractForbiddenHits — pré-existente)
    - apps/web/app/actions/analise.schemas.ts (reportDeliveredSchema .passthrough() — pré-existente)
  provides:
    - apps/web/app/actions/analise.ts (4 guardas server-side novos)
    - apps/web/app/(dashboard)/leituras/[id]/editar/__tests__/save-action.test.ts (9 testes GREEN)
  affects:
    - Gap A (SC4/CR-05): disclaimer overwrite em saveReportDelivered — FECHADO
    - Gap B (SC2): low_anchor_rate gate em markReadingDelivered — FECHADO
    - Gap C (CR-04/WR-08): empty-content gate + terminal-state gate — FECHADO
tech_stack:
  added: []
  patterns:
    - fail-closed gate em AuditMetadata null (SC2)
    - server-side overwrite de campo read-only (ENCERRAMENTO_LITERAL D-P3)
    - vi.hoisted + parametric mock factory (test pattern)
key_files:
  created: []
  modified:
    - apps/web/app/actions/analise.ts
    - apps/web/app/(dashboard)/leituras/[id]/editar/__tests__/save-action.test.ts
decisions:
  - "Fail-closed para audit_metadata null: se nenhuma auditoria foi rodada, a entrega é bloqueada com mensagem 'Auditoria ausente ou pendente', não silenciosamente permitida."
  - "ENCERRAMENTO_LITERAL sobrescrito server-side após parse zod, antes do UPDATE — cliente não consegue alterar ou omitir (D-P3 enforcement)."
  - "Guarda D verifica Object.keys(delivered).length === 0 explicitamente — remove ?? {} que silenciava o vazio."
metrics:
  duration: "~25 minutos"
  completed: "2026-05-08"
  tasks_completed: 2
  files_modified: 2
---

# Phase 7 Plan 12: Gap Closure — 4 Server-Side Guards Summary

**One-liner:** 4 guardas server-side em analise.ts fecham SC2 (anchor rate), SC4 (disclaimer literal), CR-04 (conteúdo vazio) e WR-08 (terminal state), com 9 testes GREEN validando cada guard.

---

## Objective

Fechar os 3 gaps identificados em `07-VERIFICATION.md` (status: gaps_found, score 3/5). Todos os gaps tinham raiz comum: `markReadingDelivered` e `saveReportDelivered` aceitavam ações que violavam contratos da fase. Este plan adiciona 4 guardas localizados (~20 linhas líquidas) sem migrations, novos arquivos ou dependências.

---

## Tasks Executadas

### Task 1: Patch analise.ts — 4 guardas server-side

**Arquivo:** `apps/web/app/actions/analise.ts`
**Commit:** `fb87092`

**Guardas adicionados (com line ranges no arquivo patcheado):**

| Guarda | Função | Linha (aprox) | Gap fechado |
|--------|--------|---------------|-------------|
| A — terminal-state gate | `saveReportDelivered` | L79 | WR-08 |
| B — ENCERRAMENTO_LITERAL overwrite | `saveReportDelivered` | L83 | SC4 / CR-05 |
| C — audit_metadata fail-closed | `markReadingDelivered` | L140-147 | SC2 |
| D — empty-content gate | `markReadingDelivered` | L134-138 | CR-04 |

**Imports adicionados:**
- `import { ENCERRAMENTO_LITERAL } from '@/lib/anthropic/types'` (valor)
- `import type { AuditMetadata, ReportJsonb } from '@/lib/anthropic/types'` (tipo, agora inclui `AuditMetadata`)
- `is_delivered` adicionado ao select de `saveReportDelivered`
- `audit_metadata` adicionado ao select de `markReadingDelivered`

**Mensagens de erro novas (pt-BR, alinhadas com tom existente):**
- Guarda A: `'Leitura já entregue ao cliente — somente leitura.'`
- Guarda C (low): `'Âncora insuficiente — taxa de ancoragem abaixo de 95% nas seções clínicas. Edite e re-salve antes de entregar.'`
- Guarda C (null): `'Auditoria de ancoragem ausente ou pendente. Re-salve o relatório para re-rodar a auditoria.'`
- Guarda D: `'Salve a edição antes de entregar ao cliente.'`

**Verificações pós-patch:**
- `pnpm tsc --noEmit` — zero erros em `actions/analise.ts`
- `pnpm audit:vocabulary` — vazio (nenhuma violação LGPD no arquivo modificado)

---

### Task 2: Flip save-action.test.ts it.todos para 9 testes GREEN

**Arquivo:** `apps/web/app/(dashboard)/leituras/[id]/editar/__tests__/save-action.test.ts`
**Commit:** `4257a90`

**Suite substituída:** 11 `it.todo` Wave-0 → 9 testes ativos + 3 `it.todo` com justificativa

**9 testes GREEN:**

Em `describe('saveReportDelivered (D-A2 + WR-08 + CR-05)')`:
1. BLOCK quando is_delivered=true (WR-08 terminal-state gate)
2. overrides encerramento_disclaimer com ENCERRAMENTO_LITERAL (CR-05 SC4 D-P3)
3. BLOCK save com vocab proibido (D-A2 — regression após patch)
4. redirects to /login quando user é null

Em `describe('markReadingDelivered (CR-04 + SC2 + WR-08-existing)')`:
5. BLOCK quando report_delivered é null (CR-04 empty-content gate)
6. BLOCK quando report_delivered é objeto vazio {} (CR-04)
7. BLOCK quando audit_metadata.low_anchor_rate=true (SC2 gate)
8. BLOCK quando audit_metadata é null — fail-closed (SC2 missing audit)
9. happy path — flip is_delivered=true quando todos os gates passam

**3 it.todo restantes (com justificativa):**
- `classifyAllSections é chamado com (report_generated, delivered)` — TODO: integration test em 07-UAT
- `audit_metadata atualizado com runAudit(delivered) pós-save` — TODO: integration test em 07-UAT
- `revalidatePath chamado para 3 paths` — TODO: requires elaborate mock surface

**Mock pattern:** espelha `readings.test.ts` verbatim (vi.mock + factory parametrizável `createMockSupabase`)

**Verificações:**
- `npx vitest run save-action.test.ts` → exit 0, 9 passed, 3 todo
- `pnpm tsc --noEmit` — zero erros em `save-action.test.ts`
- `pnpm audit:vocabulary` — vazio (`// audit-vocabulary:allowlist` marker presente no topo)
- `ENCERRAMENTO_LITERAL` importado e comparado byte-exact via `toBe(ENCERRAMENTO_LITERAL)`

---

## Deviations from Plan

None — plano executado exatamente como especificado.

---

## Verification Status Preview

| Gap | Status Anterior | Status Após Este Plan |
|-----|-----------------|----------------------|
| Gap A — SC4 bypassável (CR-05) | FAILED | FIXED: `delivered.encerramento_disclaimer = ENCERRAMENTO_LITERAL` (L83) |
| Gap B — SC2 sem gate de entrega | FAILED | FIXED: fail-closed em audit_metadata null/low_anchor_rate (L140-147) |
| Gap C — entrega de relatório vazio | FAILED | FIXED: Object.keys check antes do flip terminal (L134-138) + WR-08 (L79) |

**Próximo passo:** `/gsd-verify-work 7` para re-verificar e fechar a fase (esperado: gaps_found → passed, 5/5 truths verificadas, exceto SC3 UNCERTAIN que permanece UNCERTAIN por design — requer verificação humana com API real).

---

## Known Stubs

Nenhum. Todos os guards são lógica de produção real, sem dados hardcoded ou placeholders.

---

## Threat Flags

Nenhuma nova superfície de segurança introduzida. As 4 guardas REDUZEM superfície de ataque (T-7-12-01 a T-7-12-04 do threat model do plano).

---

## Self-Check: PASSED

Verificações realizadas:

```
[FOUND] apps/web/app/actions/analise.ts — contém 4 guardas + ENCERRAMENTO_LITERAL import
[FOUND] apps/web/app/(dashboard)/leituras/[id]/editar/__tests__/save-action.test.ts — 9 testes ativos
[FOUND] commit fb87092 — feat(07-12): 4 server-side guards in analise.ts
[FOUND] commit 4257a90 — test(07-12): 9 GREEN tests for 4 server-side guards
[PASS]  pnpm tsc --noEmit — zero erros nos 2 arquivos modificados
[PASS]  npx vitest run save-action.test.ts — 9 passed, 3 todo, 0 failed
[PASS]  pnpm audit:vocabulary — zero violações nos 2 arquivos modificados
```
