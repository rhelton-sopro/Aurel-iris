---
phase: 08-pagamento-lgpd
plan: 11
subsystem: billing (UI /assinatura — saldo + reservas + arrependimento)
tags: [billing, ui, credits, reservations, refund, cdc, lgpd, checkpoint-pending]
checkpoint_resolution: "PENDENTE — Task 4 é blocking human-verify (Founder UAT em preview Vercel). Tasks 1-3 implementadas, TS+lint limpos, testes billing green. NENHUM refund/cancel live foi rodado nesta sessão (guardrail). Resume-signal do founder: 'approved' ou descrição de issues."
requires:
  - phase: 08-05
    provides: "listActiveReservations (RLS) + cancelReservation (ownership) + getTrialState + ActiveReservation/TrialState types"
  - phase: 08-06
    provides: "refundPackageAction + computeRefundValue + RefundPolicy/RefundPackageResult types"
  - phase: 08-10
    provides: "idioma de componente billing (PackageCard) — tokens semânticos neutros + teal explícito + rounded-[2px] + <Button>; /assinatura/comprar page idiom"
provides:
  - "/assinatura — server component que SSR saldo + trial + reservados + processos + pacotes"
  - "CreditsBalanceWidget — card de saldo (trial state + disponível/reservado/total + CTA)"
  - "ReservationsList — lista 'Processos em andamento' com TTL relativo + cancelar"
  - "RefundPackageButton — modal arrependimento CDC 7d (computeRefundValue display-only)"
  - "cancelReservationAction — wrapper 'use server' do cancelReservation"
affects:
  - "08-12 (email confirmação pós-webhook + email expiração) — não depende deste plano diretamente"
  - "08-13 (cron daily release/expire) — libera reservas que aqui também são canceláveis manualmente"
tech-stack:
  added: []
  patterns:
    - "Server component agrega data (Promise.all) + delega UI a widgets puros"
    - "Client computation DISPLAY-ONLY; server re-computa (computeRefundValue em refundPackageAction)"
    - "buttonVariants() + <Link> em vez de <Button asChild> (Button do projeto é base-ui sem Slot)"
    - "Embed Supabase customer_credits → credit_packages com cast `as unknown as CreditRow[]`"
    - "use-server hygiene: billing-extras.ts só exporta função async"
key-files:
  created:
    - apps/web/app/actions/billing-extras.ts
    - apps/web/components/billing/CreditsBalanceWidget.tsx
    - apps/web/components/billing/ReservationsList.tsx
    - apps/web/components/billing/RefundPackageButton.tsx
    - apps/web/app/assinatura/page.tsx
  modified: []
decisions:
  - "cancelReservationAction OMITE `import 'server-only'` que o plano sugeria: 'use server' já é o boundary marker correto de um action file; server-only é redundante/conflitante ali"
  - "Botões via <Button>/buttonVariants do projeto (não <button> cru do plano) pra herdar idioma uppercase tracking-label rounded-[2px] da marca (consistência 08-10)"
  - "Tokens do plano (rounded-lg, bg-green-50, text-teal-dark hardcoded) substituídos por semânticos neutros + teal/destructive explícito por elemento (memory feedback_design_tokens_semantic_neutral)"
  - "RefundPackageButton trigger usa variant=link cor #B23A2B (destructive) em vez de amber-700 — paleta da marca"
metrics:
  duration: ~3min (tasks 1-3; Task 4 = checkpoint do founder)
  completed: 2026-05-29
  tasks: "3 de 4 (Task 4 = blocking human-verify checkpoint, pendente do founder)"
  files: 5
  tests: 0 # plano não previu testes novos; suite billing existente revalidada (52 green)
requirements-completed: []  # BILLING-02/03 só após Founder UAT (Task 4)
---

# Phase 8 Plan 11: UI /assinatura — saldo + reservas + arrependimento Summary

**STATUS: CHECKPOINT-PENDING** — Tasks 1-3 implementadas, commitadas, TS+lint limpos, suite billing revalidada (52 green). Task 4 é um checkpoint `human-verify` BLOQUEANTE: o founder faz a UAT visual+funcional em preview Vercel (cancelar reserva libera saldo; modal refund processa via Asaas sandbox; mobile responsive). Esta sessão NÃO rodou nenhum refund/cancel live (guardrail explícito).

A página `/assinatura` substitui o placeholder anterior e entrega o "dashboard D-11": saldo total + trial state + reservados + lista de processos em andamento (com TTL e cancelar) + lista de pacotes (com botão de arrependimento CDC 7d quando elegível).

## O que foi entregue

**Task 1 — `app/actions/billing-extras.ts` — cancelReservationAction** (`60bfe77`)
- Wrapper 'use server' fino: session gate (`auth.getUser()`) + validação de readingId → `cancelReservation(readingId, user.id)` (08-05) → mapeia `reason` (unauthorized/not_found/db_error) pra mensagem humana → `revalidatePath('/assinatura')` + `/dashboard`.
- Ownership (T-08-11-01) é garantido a jusante em `cancelReservation` (SELECT .eq('user_id') antes do RPC). Só exporta função async (use-server hygiene).

**Task 2 — 3 widgets** (`8a30f4e`)
- **CreditsBalanceWidget** (server): card teal-bordered com bloco trial (se `status==='active'`) + grid disponível/reservado/total + contagem de pacotes + CTA `Comprar mais`/`Comprar créditos` via `buttonVariants() + <Link>`.
- **ReservationsList** (client): empty-state amigável; senão lista divide-y com `Leitura {id8}…`, reservado/expira (TTL relativo em dias/horas), fonte (trial/crédito) + botão Cancelar (`useTransition` + `confirm()` + toast). Cards stack vertical em mobile (`sm:` breakpoint).
- **RefundPackageButton** (client): renderiza só se `computeRefundValue().eligible` (display-only, T-08-11-03 — server re-computa); modal mostra valor total/proporcional + aviso de prazo; confirmar → `refundPackageAction({ credit_id })` → toast.

**Task 3 — `app/assinatura/page.tsx`** (`a68d7d8`)
- Server component: `Promise.all([customer_credits (RLS, active/pending), getTrialState, listActiveReservations])`. Agrega `totalRemaining`/`totalReserved` só de credits `active`. Pacotes `pending` mostram "Aguardando pagamento"; `active` mostram disponíveis/expira + RefundPackageButton. `DisclaimerCopy variant="footer"` (LGPD-05).

## API/UI Surface

```
/assinatura                                    → dashboard completo D-11
CreditsBalanceWidget({trialState, totalRemaining, totalReserved, packagesCount})
ReservationsList({reservations: ActiveReservation[]})
RefundPackageButton({creditId, purchaseDate, priceBrl, leiturasPurchased, leiturasRemaining, leiturasReserved, status})
cancelReservationAction(readingId) → { ok, error? }
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `import 'server-only'` redundante/conflitante em action file**
- **Found during:** Task 1
- **Issue:** O plano sugeria `'use server'` + `import 'server-only'` juntos. Em um arquivo de server action, `'use server'` já é o boundary marker; somar `server-only` é redundante e pode conflitar com a semântica de module-graph guarding.
- **Fix:** Omitido `import 'server-only'`. Mantido só `'use server'`.
- **Files modified:** apps/web/app/actions/billing-extras.ts
- **Commit:** 60bfe77

**2. [Rule 3 - Blocking] `<Button asChild>` não existe no projeto**
- **Found during:** Task 2
- **Issue:** O Button do projeto é um wrapper de `@base-ui/react/button` sem Slot/asChild (só exporta `Button` + `buttonVariants`). O CTA do widget precisava ser um `<Link>` estilizado como botão.
- **Fix:** Usado `buttonVariants({ className: 'w-full' })` aplicado a `<Link>` — padrão idiomático sem asChild.
- **Files modified:** apps/web/components/billing/CreditsBalanceWidget.tsx
- **Commit:** 8a30f4e

### Adaptações de design (não-bug, alinhamento com idioma 08-10)

- Tokens do plano (`rounded-lg`, `bg-green-50`, `border-green-200`, `text-teal-dark` hardcoded em CTA, `bg-amber-600` no confirm) → substituídos por semânticos NEUTROS + teal/destructive EXPLÍCITO por elemento (memory `feedback_design_tokens_semantic_neutral`).
- Botões `<button>` crus do plano → `<Button>`/`buttonVariants` do projeto (idioma uppercase tracking-label `rounded-[2px]`).
- Trigger de refund: cor da marca `#B23A2B` (destructive) em vez de `amber-700`.
- Estes não alteram comportamento/contrato — só estética, exigida pela nota do plano ("match existing component idiom").

**Total deviations:** 2 (Rule 3) + adaptações de design. Sem scope creep — comportamento idêntico ao plano.

## Verification

- **TSC:** `tsc --noEmit` sem erros nos 5 arquivos novos.
- **Lint:** `eslint --max-warnings 0` scoped nos 5 arquivos → exit 0.
- **Tests:** suite billing existente revalidada — 52 passed, 1 skipped (race integration). Plano não previu testes novos (componentes de UI sem lógica testável isolada além do que 08-05/06 já cobrem).
- **NÃO rodado:** refund/cancel live (Task 4 = checkpoint do founder; guardrail explícito proibia ação destrutiva).

## Threat Model Status

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-08-11-01 (Tampering — cancela reserva de outro user) | mitigate | ✓ cancelReservation faz SELECT .eq('user_id') antes do RPC (08-05) + cancelReservationAction reafirma sessão |
| T-08-11-02 (Info Disclosure — listActiveReservations vaza credit_id) | mitigate | ✓ session client (RLS) em listActiveReservations (08-05) |
| T-08-11-03 (Tampering — client computeRefundValue diverge do server) | mitigate | ✓ refundPackageAction RE-computa server-side (08-06); client é display-only |

## Threat Flags

Nenhuma superfície de segurança nova fora do `<threat_model>` do plano. /assinatura é leitura RLS + duas actions já existentes (cancel wrapper + refund de 08-06).

## Known Stubs

Nenhum stub de dados/UI. Todos os widgets consomem queries/actions reais (customer_credits via RLS, getTrialState, listActiveReservations, refundPackageAction). Pacotes `pending` exibidos com label "Aguardando pagamento" não são stub — é o estado correto até o webhook PAYMENT_CONFIRMED (08-04) ativar os créditos.

## Checkpoint Pendente (Task 4 — founder)

Founder deve em preview Vercel: (1) login; (2) visitar /assinatura; (3) testar estados — sem créditos + trial active / pacote ativo com arrependimento <7d / reserva ativa com TTL; (4) clicar Cancelar → confirm → toast "Crédito liberado" → reserva some + saldo +1; (5) modal refund → valor calculado → confirmar → toast + status 'refunded' pós-refresh; (6) mobile 375px stack vertical. Resume-signal: "approved" ou descrição de issues.

## Next Phase Readiness

- /assinatura LIVE (pós-aprovação founder); 3 widgets reusáveis estabelecidos.
- cancelReservationAction wrapper disponível pro dashboard reutilizar.
- Próximo plano 12: email de confirmação pós-webhook + email de expiração. Plano 13: cron daily (release reservas expiradas + expire credits 12m + emails 30d/7d/day-of).

## Self-Check: PASSED

- 5 arquivos criados — todos FOUND em disco.
- 3 commits FOUND (60bfe77, 8a30f4e, a68d7d8).
- TSC limpo nos 5; scoped lint exit 0; suite billing 52 green / 1 skipped.
- Nenhum refund/cancel live rodado (guardrail respeitado).
