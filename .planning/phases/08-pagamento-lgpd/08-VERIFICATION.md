# Fase 8 — VERIFICATION

**Verified (estático/automatizado):** 2026-05-29
**Status:** PARTIAL — evidência estática + test suite PASS; pendentes os smokes E2E que exigem ambiente live (founder) e a decisão de cutover prod.

> Este arquivo separa explicitamente o que foi **provado automaticamente/estaticamente** (rodado por agente executor neste working tree) do que **só o founder pode validar** (ambiente live: Vercel preview + Asaas sandbox + Supabase + deploy + decisão go/no-go).
> Marcadores: `[x]` provado agora · `[ ] PENDING-FOUNDER` precisa de ação live do founder · `[~]` parcial.

---

## 1. Resultado automatizado (Task 1) — rodado 2026-05-29

### Test suite (vitest)

- **Total:** 859 passed · 6 failed · 3 skipped · 24 todo (892 specs, 87 arquivos)
- **Arquivos da Fase 8 (18 arquivos):** **TODOS verdes** — 112 passed, 1 skipped (race test integration-gated, by design)
  - `lib/asaas/{client,webhook-auth}.test.ts`
  - `lib/billing/{apply-payment,credits,refund-policy,trial,race(skipped)}.test.ts`
  - `lib/audit/log.test.ts`
  - `lib/consent/{hydrate,sign}.test.ts`
  - `lib/auth/cpf.test.ts` · `lib/gates/billing-gate.test.ts`
  - `lib/notifications/notify-credit-purchase-confirmed.test.ts`
  - `app/api/asaas/webhook/route.test.ts` · `app/api/cron/daily/route.test.ts`
  - `app/actions/billing.test.ts` · `app/actions/termo-gate-integration.test.ts`
  - `app/(auth)/signup/signup-cpf.test.ts`

### Falhas de teste — TODAS pré-existentes, NÃO da Fase 8 (não-bloqueantes)

Confirmado contra baseline `5c4a80a` (tech debt rastreado, ver memória):

| Arquivo | Falhas | Classificação |
|---|---|---|
| `lib/capture/quality-scoring.test.ts` | 3 | Phase 3 debt (`feedback_quality_scoring_test_gate`) |
| `lib/anthropic/__tests__/prompts.test.ts` | 2 | snapshot drift §3/§13 markers (`feedback_prompts_test_snapshot_drift`) |
| `lib/pdf/report-print-document.test.tsx` | 1 | essence-page, pré-existente no baseline |

**Nenhum arquivo da Fase 8 falhou.** Só novas falhas dentro de arquivos Fase 8 seriam bloqueantes — não há.

### Lint

- **Arquivos da Fase 8** (`lib/asaas lib/billing lib/audit lib/consent lib/gates lib/notifications app/api/asaas app/api/cron app/api/consent app/actions/billing.ts`): **0 errors, 0 warnings** (`eslint --max-warnings 0` exit 0).
- **App-wide (`pnpm lint`):** 20 errors + 15 warnings — **TODOS em arquivos pré-existentes/untracked** (lista em `deferred-items.md`): `upload-client.tsx`, `camera-detection.ts`, `modal-client.test.ts`, `save-action.test.ts`, `therapist-invites.test.ts`, `calibration/.../comparar/page.tsx`, `api/capture/validate`, `api/health/db`, `EditorSectionItem.tsx`, + scripts `.mts/.spec.ts` untracked. **Zero em arquivos Fase 8.**
- ⚠️ **Gate de deploy:** o `next build` roda eslint como gate. Esses 20 errors pré-existentes **precisam ser limpos OU `.eslintignore`-ados antes do deploy LIVE** (item consolidado no go-live abaixo).

### tsc --noEmit

- Erros reportados — **TODOS em test files pré-existentes** (`app/actions/readings.test.ts`, `components/readings/ReprocessButton.test.tsx`, `lib/capture/quality-scoring.test.ts`, `lib/vision/modal-client.test.ts`). Confirmado: os 4 existem no baseline `5c4a80a` com **diff = NONE** desde então. Padrão tuple-mock que tsc reclama mas vitest roda. **Zero erros em arquivos-fonte (não-test) da Fase 8.**

---

## 2. Requirements coverage (evidência estática)

> Nota: `REQUIREMENTS.md` lista BILLING/LGPD com texto OBSOLETO (Stripe, DocuSeal, 3 tiers fixos). O `08-CONTEXT.md` substitui: modelo = pacote pré-pago Asaas, termo nativo. Coverage abaixo é contra o CONTEXT.

### BILLING-01 — Pagamento via Asaas (pacote pré-pago)
- [x] `lib/asaas/` client REST tipado (customer/payment/refund), sem SDK (08-02)
- [x] Webhook handler `app/api/asaas/webhook/route.ts` — shared-secret timing-safe + idempotência 2 camadas (event.id PK + 23505 guard) (08-02 + 08-04)
- [x] `applyPaymentEvent` state machine A1=PAYMENT_CONFIRMED (08-04)
- [x] `createChargeAction` + `refundPackageAction` em `app/actions/billing.ts` (08-06)
- [x] `/assinatura/comprar` UI + `PackageGrid` (08-10)
- [x] Emails purchase + refund via Resend (08-12)
- [x] Migrations 0035-0039 + 4 SKUs seedados com pricing locked D-02 (08-01)
- [ ] PENDING-FOUNDER — Smoke PIX sandbox (Cenário A passo 6-8 / deferred-items "Smoke E2E de compra")

### BILLING-02 — Trial (3 leituras OU 60d, first-wins)
- [x] `trial_status` table + `is_in_trial` fn (08-01)
- [x] `evaluateTrial` puro + `getTrialState` (08-05)
- [x] FIFO via `fifo_reserve_credit` RPC + advisory lock (08-01)
- [x] Cron daily encerra trials 60d+ (08-13)
- [ ] PENDING-FOUNDER — Smoke trial exhaust → 3/3 → bloqueio (Cenário A passos 1-5)

### BILLING-03 — Middleware/gates de saldo
- [x] `reserveCreditForReading` em `createReadingAction` (substitui cap beta) (08-07)
- [x] Gate de saldo no fluxo de convite (capture page nasce a reading) (08-07)
- [x] `convertReservationToConsume` na analyze route pós-relatório (08-07)
- [x] `evaluateBilling` puro reusável pela UI (08-07)
- [x] Redirect `/assinatura/comprar` quando sem saldo (08-07 + 08-10)
- [ ] PENDING-FOUNDER — Smoke "Sem saldo" + redirect (Cenário A passos 5,10)

### LGPD-01 — Termo de consentimento biométrico (nativo)
- [x] `consent_terms` seed v1 com SHA-256 + `lib/consent/term-v1.md` (08-08)
- [x] PDF render via Gotenberg `app/api/consent/generate-pdf/route.ts` + `pdf-template.tsx` (08-08)
- [x] `signBiometricTerm` + storage immutable bucket privado (08-08)
- [x] `TermoBiometricoStep` component + footer-audit IP/data BRT/hash (08-08)
- [x] Gate D-19 nos 2 pontos: `createReadingAction` (office_handoff) + fluxo convite remote_link obriga CLIENTE assinar antes de captura (08-15, Decisão A+)
- [ ] PENDING-FOUNDER — Smoke PDF gerado + assinado + bucket immutable (Cenário C; deferred-items "PDF smoke termo")

### LGPD-02 — Privacy page público
- [x] `app/privacidade/page.tsx` estendida com LGPD (08-09)

### LGPD-03 básico — Link deleção via email
- [x] `/privacidade#deletar-dados` + mailto OPERATOR_EMAIL (08-09)
- [ ] PENDING-FOUNDER — criar caixa `suporte@iriscodex.com` + setar `NEXT_PUBLIC_OPERATOR_EMAIL` (deferred-items)

### LGPD-04 básico — Audit log
- [x] `audit_events` table (08-01)
- [x] `logAuditEvent` emitter best-effort (08-03)
- [x] **20 event types** definidos em `lib/audit/events.ts` (auth.login/signup, consent.term_signed/version_changed, credit.* x7, lgpd.deletion_requested, reading.* x4, trial.started/ended, admin.internal_use_used)
- [ ] PENDING-FOUNDER — query DB confirmando ≥1 row por event_type principal (só preenche com tráfego live)

### LGPD-05 — Copy obrigatória 3 superfícies
- [x] `components/legal/DisclaimerCopy.tsx` reusável (08-09)
- [x] Footer global + rodapé relatório PDF + header autenticado (08-09)

### LGPD-06 — Vocabulário proibido
- [x] 3 superfícies novas (privacidade/termos/DisclaimerCopy) com marcador `audit-vocabulary:allowlist` → 0 hits novos (08-09)
- [~] ⚠️ `audit-vocabulary.mjs` JÁ estava VERMELHO no baseline `5c4a80a` — **27 arquivos pré-existentes (Fases 3-7)** com "tratamento/diagnóstico" (RAG metadata, Jensen refs, test fixtures). NÃO causados pela Fase 8. Decisão antes do GA: allowlist por arquivo OU refinar PATTERNS. Tracked em `deferred-items.md` → hardening LGPD-06 (Fase 8.1+).

---

## 3. E2E smoke results (Task 2 — PENDING-FOUNDER)

Os 6 cenários A-F exigem ambiente live (preview Vercel + Asaas sandbox + Supabase + deploy + cron). O agente executor NÃO roda smokes live (guardrail). Founder marca OK/FAIL:

| Cenário | Descrição | Status |
|---|---|---|
| A | Trial → exhaust → buy → reserve → generate → consume | ☐ PENDING-FOUNDER |
| B | Arrependimento 7d (compra Pequeno + refund integral) | ☐ PENDING-FOUNDER |
| C | LGPD-01 termo biométrico (PDF + assinatura + gate) | ☐ PENDING-FOUNDER |
| D | Internal_use bypass (founder gera 5 sem afetar saldo) | ☐ PENDING-FOUNDER |
| E | Cron daily (libera reserva expirada + JSON 4 results) | ☐ PENDING-FOUNDER |
| F | Páginas legais (/privacidade, /termos, deleção, disclaimer) | ☐ PENDING-FOUNDER |

Passos detalhados de cada cenário: ver `08-14-PLAN.md` Task 2.

---

## 4. CHECKLIST CONSOLIDADO GO-LIVE (founder roda em UM lugar)

Tudo que foi diferido pros checkpoints e este plano, consolidado. Ordem sugerida:

### 4.1 Infra / dados (pré-requisito)
- [x] Migration 0039 aplicada LIVE (founder, 2026-05-28)
- [ ] PENDING-FOUNDER — Bucket privado `client-consents` criado + seed termo v1 (consent_terms com sha256) — confirmar se já feito
- [ ] PENDING-FOUNDER — Criar caixa `suporte@iriscodex.com`

### 4.2 Env vars (Vercel)
- [ ] `ASAAS_API_KEY` (sandbox p/ smoke; prod p/ cutover)
- [ ] `ASAAS_API_BASE_URL` (default `https://api.asaas.com/v3`)
- [ ] `ASAAS_WEBHOOK_TOKEN`
- [ ] `ASAAS_CREDIT_EVENT` (opcional; default `PAYMENT_CONFIRMED` — A1)
- [ ] `CRON_SECRET`
- [ ] `NEXT_PUBLIC_OPERATOR_EMAIL` = `suporte@iriscodex.com`
- [x] `RESEND_API_KEY` (já existia) · `RESEND_FROM_EMAIL` (default `Iris Codex <noreply@iriscodex.com>`)
- [x] `GOTENBERG_URL` + `GOTENBERG_BASIC_AUTH` (já existiam)

### 4.3 Painel Asaas
- [ ] Webhook URL (preview p/ sandbox; prod p/ cutover) + token + eventos (PAYMENT_CONFIRMED + PAYMENT_REFUNDED no mínimo)
- [ ] Config NF automática (CNPJ ativo) — relevante p/ decisão de cutover (Task 4)

### 4.4 Build gate (ANTES do deploy LIVE)
- [ ] PENDING-FOUNDER — limpar os 20 lint errors pré-existentes OU `.eslintignore` dos scripts untracked (`next build` falha senão). Lista em `deferred-items.md`.

### 4.5 Smokes (= Cenários A-F do Task 2)
- [ ] Compra (08-06): `createChargeAction({sku:'avulsa'})` → invoice Asaas sandbox R$99,70 → `customer_credits` pending + asaas_payment_id
- [ ] Webhook: pagamento PIX sandbox → PAYMENT_CONFIRMED → credit ativo + email confirmação
- [ ] PDF termo (08-08): POST `/api/consent/generate-pdf` → pdf_url renderiza corpo hidratado + footer (IP/data BRT/SHA-256), A6 (office_handoff E remote_link)
- [ ] Termo gate (08-15): convite bloqueia até cliente assinar (remote_link); `createReadingAction` bloqueia sem termo (office_handoff)
- [ ] UI dados (08-10/11): `/assinatura/comprar` redirect; `/assinatura` com créditos/reservas/refund reais (3 estados trial)
- [ ] Cron (08-13): `curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/daily` → 200 + 4 results; reserva expirada liberada
- [ ] Dedup signup CPF/telefone duplicado → erro humano

### 4.6 Cosmético (não-bloqueante, rodada futura)
- [ ] TYPO "volladas" → "voltadas" em `components/legal/DisclaimerCopy.tsx` (fix único cobre todas as telas)
- [ ] Card trial "Não disponível" → copy mais convidativa · "vs Avulsa" → "Você economiza R$X"

---

## 5. Deferred items (NÃO escopo V1)

- Notification "trial faltando pouco" — UX defer (CONTEXT)
- Add-ons (PDF brandado, white-label, multi-terapeuta, export massa) — fase futura
- LGPD-03 completo (export/delete self-service) — Fase 8.1+
- LGPD-04 completo (dashboard auditoria configurável) — Fase 8.1+
- Validação CPF via API RFB — V1.1+
- Subscription mensal recorrente — V1.1+
- Extensão manual de créditos expirados — caso-a-caso suporte (não-coded)
- Hardening LGPD-06 (allowlist/refino dos 27 arquivos pré-existentes) — Fase 8.1+

## 6. Known limitations / tech debt

- **A1** (PAYMENT_CONFIRMED vs RECEIVED em cartão): default CONFIRMED; override via `ASAAS_CREDIT_EVENT`. Chargeback raro estorna via branch PAYMENT_REFUNDED.
- **PARTIAL_REFUNDED** webhook não decrementa proporcional automático; review manual admin.
- **Race test** (`lib/billing/__tests__/race.test.ts`) skipped por default; rodar manual em sandbox.
- **audit-vocabulary** vermelho no baseline (27 arquivos pré-Fase-8); decidir antes do GA.
- **Build eslint gate** — 20 errors pré-existentes precisam limpeza antes do LIVE.

## 7. Cutover decision (Task 4 — PENDING-FOUNDER)

Founder decide path de go-live prod (ver `08-14-PLAN.md` Task 4):
- ☐ `cutover-now` — Fase 8 100% LIVE (NF config deve estar OK)
- ☐ `wait-nf-config` — configurar NF automática primeiro (~1d atraso)
- ☐ `cutover-without-nf` — cutover SEM NF, emit manual nas primeiras N

## 8. Sign-off

- Founder (smokes A-F OK): __________  data: ______
- Cutover path escolhido: __________  data: ______
- Deploy LIVE: __________  data: ______
- Memória `project_fase_8_payment_provider_asaas` → DELIVERED: __________  data: ______
- ROADMAP Fase 8 [x] + REQUIREMENTS BILLING/LGPD completos: __________  data: ______

---

*Verificação estática/automatizada por agente executor 2026-05-29. Smokes live + cutover = founder.*
