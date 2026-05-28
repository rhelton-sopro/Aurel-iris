---
phase: 08-pagamento-lgpd
plan: 07
subsystem: billing (wiring do credit ledger nos fluxos de produto — credit gate)
tags: [billing, credits, reservations, gate, readings, invites, analyze-route, lgpd-audit]
requires:
  - phase: 08-05
    provides: "lib/billing/credits.ts (reserveCreditForReading + convertReservationToConsume) + lib/billing/trial.ts (TrialState)"
  - phase: 08-03
    provides: "lib/audit/log.ts (logAuditEvent) + audit event admin.internal_use_used"
  - phase: 08-01
    provides: "fifo_reserve_credit RPC + tabelas credit_reservations/customer_credits/trial_status"
provides:
  - "lib/gates/billing-gate.ts — evaluateBilling (pure) + BillingGate union + BillingSnapshot (reusável por UI 08-10/08-11)"
  - "credit gate vivo nos 3 fluxos D-10: createReadingAction, fluxo de convite (capture page), analyze route"
affects:
  - "08-10/08-11 UI de saldo/compra (importa evaluateBilling pra decidir o que mostrar)"
  - "08-15 termo gate de LGPD-01 (wave 5) — empilha NESTES mesmos pontos de bloqueio (saldo + termo)"
tech-stack:
  added: []
  patterns:
    - "pure gate composition (lib/gates/profile-completeness style) — zero DB, unit-testável"
    - "reading row criada PRIMEIRO, reservation atrelada via reading_id, rollback (delete) se reserve falha (atomicidade soft)"
    - "convert idempotente no analyze route — regenerate NÃO redebita (reservation já 'converted' → already:true)"
    - "internal_use bypass via fifo_reserve_credit (source='internal') + audit admin.internal_use_used simétrico em todos os entry points"
key-files:
  created:
    - apps/web/lib/gates/billing-gate.ts
    - apps/web/lib/gates/__tests__/billing-gate.test.ts
  modified:
    - apps/web/app/actions/readings.ts
    - apps/web/app/convite/[token]/capturar/page.tsx
    - apps/web/app/api/readings/[id]/analyze/route.ts
decisions:
  - "Gate de convite NÃO ficou em invites.ts/createInviteTokenAction — ficou na capture page (convite/[token]/capturar). Razão: o convite não cria reading na criação do token; a reading nasce lazy quando o cliente abre o link. Como reserveCreditForReading exige reading_id, este é o único ponto onde a reserva pode ser atrelada."
  - "Regenerate não redebita: convertReservationToConsume é idempotente (reservation já 'converted' → already:true)."
  - "lib/beta/config.ts mantido em disco (delete-consumers-first); removido só dos imports de readings.ts."
metrics:
  duration: ~14min
  completed: 2026-05-28
  tasks: 4
  files: 5
  tests: 5
requirements-completed: []
---

# Phase 8 Plan 07: Credit gate nos fluxos de produto Summary

Wire do credit ledger (08-05) nos 3 fluxos D-10: o saldo passa a importar pro produto. `createReadingAction` substitui o cap beta por `reserveCreditForReading`; o fluxo de convite ganha gate de saldo no ponto onde a reading nasce (capture page); a analyze route converte a reservation em débito firme após o relatório gerar. Plus um gate puro `evaluateBilling` pra a UI reusar a regra de precedência sem duplicar. Escopo é o CREDIT gate apenas — o termo/LGPD gate (D-19) é o plano 08-15 (wave 5).

## What Was Built

**Task 1 — `lib/gates/billing-gate.ts` + test** (`8230790`)
- `evaluateBilling(snap)` puro → union `BillingGate`; precedência internal (D-09) > trial active (D-06) > crédito (D-04) > no_balance (D-07)
- `BillingSnapshot` interface; zero imports DB; reusável por UI E server actions
- 5 testes GREEN (internal bypass, trial source, credit source, no_balance trial-ended, no_balance no_trial)

**Task 2 — `createReadingAction` usa reserveCreditForReading** (`600b903`)
- Removido o gate `BETA_READING_CAP`/`beta_readings_used` (count query) + bypass `isFounderEmail`
- Reading criada PRIMEIRO; `reserveCreditForReading(user.id, reading.id)` depois; rollback (delete) se reserve falha
- `no_balance` → erro humano com link `/assinatura/comprar`; `db_error` → mensagem genérica
- `source==='internal'` → `logAuditEvent('admin.internal_use_used')` (founder/admin via fifo bypass)

**Task 3 — gate de saldo no fluxo de convite** (`4c31aa8`)
- Decisão: gate na **capture page** (`convite/[token]/capturar/page.tsx`), NÃO em `invites.ts` — ver Deviations
- `reserveCreditForReading(token.therapist_id, readingId)` só na criação NOVA da reading (resume de pending já tem reservation)
- `no_balance` → mensagem humana pro cliente ("avise o terapeuta"); `source==='internal'` → audit simétrico
- Cobre D-10 #1 (saldo antes de usar link remoto) + #2 (antes de capturar)

**Task 4 — analyze route converte reservation** (`feea1ca`)
- `convertReservationToConsume(readingId)` após o UPDATE `report_generated` de sucesso, antes dos revalidatePath
- Idempotente: regenerate/internal_use/race → `not_found`/`already` tratados como no-op; **regenerate NÃO redebita**
- NUNCA bloqueia entrega do relatório por falha de consume (ledger defensivo, produto é o relatório); audit `credit.consumed` emitido dentro do helper (não duplicado)

## Onde cada gate vive (D-10)

| Momento D-10 | Local | Função |
|--------------|-------|--------|
| #1 saldo antes do link remoto | coberto por #2 (convite não cria reading na criação do token) | — |
| #2 antes de iniciar captura | `app/convite/[token]/capturar/page.tsx` (criação lazy da reading) | `reserveCreditForReading` |
| #2 captura authed (terapeuta) / nova leitura | `app/actions/readings.ts:createReadingAction` | `reserveCreditForReading` |
| #3 antes de gerar relatório → conversão | `app/api/readings/[id]/analyze/route.ts` | `convertReservationToConsume` |

`evaluateBilling` (pure) disponível em `lib/gates/billing-gate.ts` pra UI (08-10/08-11) decidir o que exibir sem duplicar a regra.

## Deviations from Plan

### Decisão de arquitetura obrigatória (prevista no plano, Task 3)

**Gate de convite ficou na capture page, não em `invites.ts`.**
- **Por quê:** Inspeção do código real (per instrução explícita da Task 3) revelou que `createInviteTokenAction` NÃO cria reading — só gera o token. A reading nasce lazy em `app/convite/[token]/capturar/page.tsx` quando o cliente abre o link (criação ou retomada de pending). Além disso, o schema de `readings` (migration 0001) NÃO tem coluna `source_kind` nem status `pending_capture` (são free-text `pending | processing | ready | failed | edited`) — o exemplo do plano que inseria esses valores não casava com o schema.
- **Decisão:** Como `reserveCreditForReading` exige `reading_id`, o único ponto onde a reserva pode ser atrelada é onde a reading nasce → capture page. Isso cobre tanto D-10 #1 (sem saldo do terapeuta, o link não é utilizável) quanto #2 (a captura é bloqueada). `invites.ts` permaneceu intocado — criar token de convite é grátis; o crédito é reservado quando a captura efetivamente começa (modelo de custo mais correto: link nunca usado não queima crédito).
- **Reserva só na criação NOVA:** o branch de retomada de reading pending já tem reservation atrelada; re-reservar duplicaria o débito.

### Auto-fixed Issues

Nenhum bug/blocker auto-corrigido fora da decisão acima. Os 3 hot paths foram editados cirurgicamente; fluxos existentes preservados.

**Total deviations:** 1 decisão de arquitetura (prevista e documentada pelo próprio plano).

## Verification

- **Tests:** 5 novos GREEN (billing-gate). Suite billing+gates completa: 57 passed, 1 skipped (race integration-gated). `readings.test.ts` (finalizeReadingAction) 22/22 GREEN — sem regressão.
- **Lint:** `eslint --max-warnings 0` nos 5 arquivos modificados/criados → exit 0
- **TSC:** zero erros nos arquivos modificados (`readings.ts`, capture page, analyze route, billing-gate). Erros pré-existentes em `*.test.ts`/`*.test.tsx` (tuple/RequestInit/quality-scoring/reflex) são tech-debt anterior, fora de escopo.
- **Grep:** `reserveCreditForReading` em readings.ts (3) + capture page (3); `convertReservationToConsume` em analyze route (3)
- **Zero deps npm novas**

## Threat Surface

Mitigações do `<threat_model>` aplicadas:
- T-08-07-01 (tampering — reading sem gate): gate vive em createReadingAction + capture page (service-role, sem caminho público de INSERT direto) + analyze route consume
- T-08-07-02 (info disclosure): mensagens de no_balance são product-grade, não técnicas
- T-08-07-03 (invite cria reserva sem cliente terminar): reservation expira em 7d via cron (08-13); crédito volta. Aqui só reservamos na criação nova.
- T-08-07-04 (rollback falha → DB poluído): rollback delete best-effort; race window pequeno; cron de cleanup futuro

Nenhuma superfície de segurança nova fora do threat model do plano.

## Known Stubs

Nenhum. Todos os pontos consomem as funções reais de 08-05 (RPC/tabelas de 08-01); sem dados hardcoded nem UI placeholder. `evaluateBilling` é pure helper aguardando consumo da UI (08-10/08-11) — não é stub (lógica completa + testada).

## Next Phase Readiness

- 08-10/08-11 (UI saldo/compra) podem importar `evaluateBilling` de `lib/gates/billing-gate.ts`
- 08-15 (termo gate LGPD-01, wave 5) empilha nos MESMOS pontos de bloqueio: createReadingAction + capture page checam saldo E termo
- BILLING-02 fica completo quando 08-15 (termo) terminar; este plano entrega o credit gate

## Self-Check: PASSED

- 5 arquivos verificados em disco (2 criados + 3 modificados) — todos FOUND
- 4 commits verificados no git log (8230790, 600b903, 4c31aa8, feea1ca) — todos FOUND
- 5 tests GREEN; scoped lint exit 0; tsc limpo nos arquivos modificados
