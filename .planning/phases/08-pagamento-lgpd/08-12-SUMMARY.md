---
phase: 08-pagamento-lgpd
plan: 12
subsystem: notifications
tags: [resend, email, transactional, billing, best-effort, lgpd-adjacent]

requires:
  - "08-04: applyPaymentEvent branch activated (wire do email de compra)"
  - "08-06: refundPackageAction (wire do email de reembolso)"
  - "memory project_resend_domain_unverified_launch_gate: domínio iriscodex.com verificado no Resend"

provides:
  - "notifyCreditPurchaseConfirmed(input) — email confirmação de compra"
  - "notifyCreditExpiring(input) — email aviso de expiração (30/7/0d)"
  - "notifyRefundProcessed(input) — email recibo de reembolso"

affects:
  - "08-13 (cron daily) — vai chamar notifyCreditExpiring nas 3 janelas"
  - "08-14 (smoke validação) — founder paga em sandbox → confirma email chega"

tech-stack:
  added: []
  patterns:
    - "Resend via fetch direto (sem SDK) — espelha notify-therapist-capture-complete.ts"
    - "Best-effort fire-and-forget: void (async ...)().catch() pra não bloquear webhook/action"
    - "escapeHtml em todos os campos user-controlled (T-08-12-03)"
    - "Email vem de auth.admin.getUserById (webhook sem sessão) / user.email (action) — profiles NÃO tem coluna email"

key-files:
  created:
    - "apps/web/lib/notifications/notify-credit-purchase-confirmed.ts"
    - "apps/web/lib/notifications/notify-credit-expiring.ts"
    - "apps/web/lib/notifications/notify-refund-processed.ts"
    - "apps/web/lib/notifications/__tests__/notify-credit-purchase-confirmed.test.ts"
  modified:
    - "apps/web/lib/billing/apply-payment.ts"
    - "apps/web/app/actions/billing.ts"

decisions:
  - "Email obtido via auth.admin.getUserById no webhook (profiles sem coluna email — plano usava profiles!inner(email) que falharia)"
  - "refundPackageAction select ganhou credit_packages(name) pro template do recibo"
  - "Emails de billing ON por padrão (sem toggle) — billing-critical, ao contrário do 'leitura pronta' desativado globalmente"

requirements-completed: [BILLING-01]

metrics:
  duration: ~4min
  completed: 2026-05-29
  tasks: 3
  files: 6
  tests: 5
---

# Phase 08 Plan 12: Emails transacionais (Resend) — COMPLETO

**3 emails transacionais via Resend (compra confirmada / expiração 30-7-0d / reembolso) + wire fire-and-forget no webhook handler (compra) e na refundPackageAction (reembolso). Padrão best-effort: falha de email NUNCA bloqueia o caminho crítico de crédito. 5 testes vitest green; apply-payment (9) + webhook route (6) + billing action (10) seguem green.**

## O que foi entregue

- **notify-credit-purchase-confirmed.ts** — `notifyCreditPurchaseConfirmed({ userEmail, userName?, packageName, leituras, valueBrl, expiresAt })`. Subject "Iris Codex — sua compra foi confirmada". Template pt-BR HTML (tabela pacote/leituras/valor/validade + CTA painel) + text fallback. Sem RESEND_API_KEY → log + return; HTTP/fetch fail → log + return; nunca lança.
- **notify-credit-expiring.ts** — `notifyCreditExpiring({ ..., leiturasRemaining, daysOut: 30|7|0 })`. SUBJECT_MAP + URGENCY_MAP por janela; aviso de não-reembolso de expirados (D-03/D-04); CTA "começar leitura". Consumido pelo cron do plano 08-13.
- **notify-refund-processed.ts** — `notifyRefundProcessed({ ..., refundValueBrl, kind: 'total'|'partial', leiturasRefunded })`. Recibo de arrependimento 7d (D-13); SLA de crédito (PIX ≤1 dia útil / cartão ≤5 dias úteis).
- **Wire compra (apply-payment.ts):** dentro do branch `activated`, após `logAuditEvent` e antes do `return`, IIFE async fire-and-forget busca email (auth) + full_name (profiles) + name/price_brl (credit_packages) e dispara o email. `void (...)().catch()` garante webhook return imediato.
- **Wire reembolso (billing.ts):** após `logAuditEvent('credit.refunded')`, mesma IIFE fire-and-forget. Select de `credit` ganhou `credit_packages(name)`.

## Padrão best-effort (T-08-12-04)

Webhook está no caminho crítico de creditar saldo; refund action muta estado pago. Ambos os disparos usam `void (async () => { ... })().catch(err => console.warn(...))`:
- **Sem await** → o handler/action retorna sem esperar o Resend.
- **`.catch` no nível externo** → qualquer rejeição (sem chave, HTTP 5xx, timeout, getUserById falho) é absorvida e logada como non-fatal.
- O próprio helper já é internamente best-effort (try/catch + early return), então há dupla proteção.

## Funções/exports

`notifyCreditPurchaseConfirmed` + `NotifyPurchaseInput` · `notifyCreditExpiring` + `NotifyExpiringInput` + `ExpiryWindow` · `notifyRefundProcessed` + `NotifyRefundInput`

## Task Commits

1. **Task 1 RED: test notify-credit-purchase-confirmed** — `6d991be` (test) — 5 testes failing (módulo ausente)
2. **Task 1 GREEN: notify-credit-purchase-confirmed.ts** — `ce3ea2e` (feat) — 5/5 green
3. **Task 2: notify-credit-expiring + notify-refund-processed** — `10941cd` (feat)
4. **Task 3: wire compra (webhook) + reembolso (action)** — `cc86bfa` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plano usava `profiles!inner(email, full_name)` mas profiles NÃO tem coluna email**
- **Found during:** Task 3 (wire apply-payment)
- **Issue:** O snippet do plano selecionava `profiles!inner(email, full_name)` no enriched query. A tabela `profiles` (types/database.ts:693) não tem coluna `email` — o select retornaria erro/null e o email nunca seria resolvido. Memory `feedback_supabase_rls_no_auth_users` também proíbe query direta em auth.users.
- **Fix:** Email obtido via `service.auth.admin.getUserById(credit.user_id)` (mesmo pattern de notify-therapist-capture-complete.ts). `full_name` continua vindo de `profiles`. Na refundPackageAction o email vem de `user.email` (já em escopo via sessão).
- **Files modified:** `apps/web/lib/billing/apply-payment.ts`, `apps/web/app/actions/billing.ts`
- **Commit:** cc86bfa

**2. [Rule 3 - Blocking] refundPackageAction select não trazia o nome do pacote**
- **Found during:** Task 3
- **Issue:** O snippet do email de refund lia `credit.credit_packages.name`, mas o select existente do `credit` só trazia `credit_packages(price_brl)`. `name` seria undefined.
- **Fix:** Adicionado `name` ao nested select: `credit_packages(name, price_brl)`.
- **Files modified:** `apps/web/app/actions/billing.ts`
- **Commit:** cc86bfa

**Total:** 2 auto-fixes (1 Rule 1, 1 Rule 3). Sem scope creep — tests de notify-credit-expiring e notify-refund-processed omitidos conforme o plano explicita (pattern idêntico ao testado; smoke manual cobre no 08-14).

## TDD Gate Compliance

Task 1 seguiu RED→GREEN: commit `test(...)` (`6d991be`, falhou por módulo ausente) seguido de `feat(...)` (`ce3ea2e`, 5/5 green). RED falhou pela razão correta (import inexistente), não por passar inesperadamente.

## Threat Model Status

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-08-12-01 (valor pago em transit) | accept | TLS default do Resend; conteúdo é o que o terapeuta já vê |
| T-08-12-02 (spoofing email Iris Codex) | mitigate | ✓ SPF+DKIM via domínio verificado (from=noreply@iriscodex.com) |
| T-08-12-03 (XSS via userName/packageName no HTML) | mitigate | ✓ escapeHtml em todos os campos user-controlled nos 3 helpers |
| T-08-12-04 (webhook bloqueia em timeout de email) | mitigate | ✓ void (async)().catch fire-and-forget; webhook return imediato |

## Threat Flags

Nenhum surface novo fora do threat_model do plano.

## Known Stubs

Nenhum — 3 helpers completos; templates pt-BR finais; wires funcionais. `notifyCreditExpiring` ainda não tem caller (esperado: cron do plano 08-13 vai chamá-lo).

## Verification

- 5/5 testes notify-credit-purchase-confirmed green
- 9/9 apply-payment + 6/6 webhook route + 10/10 billing action seguem green (regressão zero)
- `tsc --noEmit` sem erros nos 6 arquivos do plano
- `eslint --max-warnings 0` exit 0 nos 6 arquivos (scoped)
- greps: notifyCreditPurchaseConfirmed em apply-payment.ts (2) · notifyRefundProcessed em billing.ts (2)
- nenhuma deleção de arquivo nos 5 commits
- zero deps npm novas

## Deferred Issues (out-of-scope)

`pnpm lint` no app inteiro continua com errors/warnings **fora dos 6 arquivos deste plano** (catalogado em deferred-items.md desde 08-02). Gate `next build` precisa ser resolvido antes do deploy LIVE da Fase 8.

## Next Phase Readiness

- 3 helpers prontos. `notifyCreditPurchaseConfirmed` + `notifyRefundProcessed` já wired e LIVE após deploy.
- Plano **08-13** (cron daily) deve chamar `notifyCreditExpiring({ daysOut })` ao detectar pacotes a 30/7/0 dias do vencimento.
- Plano **08-14** (smoke) — founder paga em sandbox → confirma email de compra chega (validação manual).

## Self-Check: PASSED

- 6 arquivos verificados em disco (4 created + 2 modified) — todos FOUND
- 5 commits verificados no git log (6d991be, ce3ea2e, 10941cd, cc86bfa) — todos FOUND
- 5/5 vitest GREEN + suites adjacentes green + eslint scoped exit 0
