---
phase: 08-pagamento-lgpd
plan: 10
subsystem: billing (UI de compra — página /assinatura/comprar + cards)
tags: [billing, ui, asaas, checkout, trial, checkpoint-pending]
checkpoint_resolution: "PENDENTE — Task 3 é checkpoint human-verify BLOQUEANTE. Founder roda UAT visual em preview + click 'Comprar' → Asaas sandbox checkout. Tasks 1-2 (3 arquivos UI) implementadas, tsc+lint limpos, commitadas."
requires:
  - phase: 08-06
    provides: "createChargeAction(sku) → { ok, invoice_url, credit_id, asaas_payment_id }"
  - phase: 08-03
    provides: "credit_packages catálogo (4 SKUs, pricing D-02) + config.ts SSOT"
  - phase: 08-05
    provides: "getTrialState(userId) → TrialState (active/ended/no_trial)"
  - phase: 08-01
    provides: "tabela credit_packages (sku, name, leituras_count, price_brl, badge, display_order, active)"
provides:
  - "/assinatura/comprar — página server SSR (auth gate + 4 SKUs + estado trial)"
  - "PackageCard — client component card de SKU, dispara createChargeAction → redirect Asaas"
  - "PackageGrid — server component, 2 grupos visuais D-21 + TrialCard inline"
affects:
  - "08-11 (UI saldo + arrependimento em /assinatura) — reusa createChargeAction; widget de saldo entra lá, NÃO aqui"
tech-stack:
  added: []
  patterns:
    - "client card + useTransition → server action → window.location.href = invoice_url (redirect pro hosted checkout)"
    - "tokens semânticos neutros (border-border/bg-card/text-muted-foreground/text-ink) + teal SEMPRE explícito por elemento"
    - "cantos rounded-[2px] da marca + botão via <Button> do projeto (uppercase tracking-label herdado)"
    - "TrialCard sintético (fora de credit_packages) renderizado no Grupo 1"
    - "preço SSR'd do DB (display only); createChargeAction re-lê preço do DB (T-08-10-01)"
key-files:
  created:
    - apps/web/components/billing/PackageCard.tsx
    - apps/web/components/billing/PackageGrid.tsx
    - apps/web/app/assinatura/comprar/page.tsx
  modified: []
decisions:
  - "TrialCard inline em PackageGrid.tsx (não arquivo separado) — o plano permitiu; reduz superfície"
  - "Botão de compra via <Button> do projeto em vez de <button> cru (plano) — alinha ao idioma uppercase/tracking-label + cantos quadrados da marca (nota crítica do design system)"
  - "rounded-[2px] em vez de rounded-lg/rounded-md do plano — cantos quase-quadrados são o idioma da marca (globals.css: 'SEM sombras, cantos quadrados')"
  - "Card destacado (com badge) usa border-teal-dark sólida; sem badge usa border-border + hover teal/40"
metrics:
  duration: ~2min (tasks 1-2; Task 3 é checkpoint do founder)
  completed: 2026-05-29
  tasks: "2 de 3 (Task 3 = blocking human-verify checkpoint, pendente do founder)"
  files: 3
  tests: 0
requirements-completed: []  # BILLING-01 só após UAT do founder (Task 3)
---

# Phase 8 Plan 10: UI de compra — /assinatura/comprar Summary

**STATUS: CHECKPOINT-PENDING** — Tasks 1-2 implementadas, tsc+lint limpos, commitadas. Task 3 é checkpoint `human-verify` BLOQUEANTE: o founder roda o UAT visual em preview e clica "Comprar" pra validar o redirect ao Asaas sandbox. Esta sessão NÃO rodou uma compra ao vivo (guardrail).

Página de monetização visível pro terapeuta: 2 grupos visuais (D-21) com 4 cards (D-22), cada um disparando `createChargeAction` (plano 08-06) → redirect pro hosted checkout do Asaas. 3 arquivos UI (1 page server + 2 components), zero novas dependências.

## O que foi entregue

**Task 1 — `components/billing/PackageCard.tsx`** (`f85468e`)
- Client component (`'use client'`) com `useTransition`. `handleBuy()` chama `createChargeAction({ sku })`; em sucesso, `toast.success('Cobrança criada — redirecionando…')` + `window.location.href = r.invoice_url`; em erro, `toast.error(r.error)`.
- Mostra (D-22): nome, contagem de leituras, preço total, preço/un (oculto pra avulsa, count=1), economia em R$ vs avulsa (oculta quando 0), validade 12m, botão Comprar.
- Badge `mais_escolhido` / `melhor_valor` posicionado no topo central.
- Tokens semânticos neutros + teal explícito; botão `<Button>` do projeto com `bg-teal-dark text-white`. `data-testid` em card + botão (`buy-{sku}`) pra UAT/tests.

**Task 2 — `components/billing/PackageGrid.tsx` + `app/assinatura/comprar/page.tsx`** (`3bd8f27`)
- **PackageGrid** (server component): Grupo 1 "Sem compromisso" (TrialCard + Avulsa) em `md:grid-cols-2`; Grupo 2 "Pacotes com economia" (pequeno/médio/grande sorted por leituras_count) em `md:grid-cols-3`. Economia computada via baseline `AVULSA_PRICE = 99.70` (D-02): `(99.70 − preço/un) × leituras_count`.
- **TrialCard** (inline): estado `active` → badge "Gratuito" + leituras restantes + dias; `ended` → "Já utilizado"; `no_trial` → "Não disponível". Plural/singular tratados.
- **page.tsx** (server component): auth gate (`redirect('/login?next=...')`), SSR paralelo de `credit_packages` (active, order display_order) + `getTrialState(user.id)`. Empty-state quando sem pacotes. Bloco "Informações importantes" (PIX/cartão/boleto, 12m, arrependimento 7d com link `/termos#arrependimento`, NF) + `<DisclaimerCopy variant="footer" />`.

## Pricing D-02 (validar no UAT — Task 3)

| SKU | Leituras | Total | Preço/un | Economia total exibida |
|-----|----------|-------|----------|------------------------|
| Avulsa | 1 | R$ 99,70 | — | — |
| Pequeno | 5 | R$ 298,50 | R$ 59,70 | R$ 200,00 |
| Médio | 15 | R$ 745,50 | R$ 49,70 | R$ 750,00 |
| Grande | 30 | R$ 1.191,00 | R$ 39,70 | R$ 1.800,00 |

(Economia = (99,70 − preço/un) × count. Médio = 50,00 × 15 = R$ 750,00.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Design system alignment] Botão `<button>` cru → `<Button>` do projeto + cantos rounded-[2px]**
- **Found during:** Task 1
- **Issue:** O plano usava `<button className="...rounded-md...">` e cards com `rounded-lg`. O idioma da marca (globals.css linha 70: "SEM sombras, cantos quadrados"; Button base usa `rounded-[2px]` + `uppercase tracking-label`) diverge desses cantos arredondados. A nota crítica do prompt exige "match surrounding component idiom".
- **Fix:** Botão de compra agora usa o `<Button>` do projeto (herda uppercase/tracking-label/foco); cards usam `rounded-[2px]`; badges `rounded-[2px]`.
- **Files modified:** apps/web/components/billing/PackageCard.tsx, PackageGrid.tsx
- **Commits:** f85468e, 3bd8f27

**2. [Rule 1 - Bug] Cores `green-*` do TrialCard ativo trocadas por teal da marca**
- **Found during:** Task 2
- **Issue:** O plano usava `border-green-200 bg-green-50 bg-green-700` no TrialCard ativo. Verde solto não é cor de marca (a única cor de acento é teal — globals.css) e violaria a diretriz de tokens semânticos neutros + teal explícito.
- **Fix:** TrialCard ativo usa `border-teal-dark` + badge `bg-teal-dark` (mesmo idioma dos cards destacados). Inativo usa `border-border bg-muted/20`.
- **Files modified:** apps/web/components/billing/PackageGrid.tsx
- **Commit:** 3bd8f27

**Total deviations:** 2 (ambas Rule 1 — alinhamento ao design system / cor de marca). Sem scope creep. A estrutura, props e lógica do plano foram preservadas verbatim; só os tokens visuais foram ajustados pro idioma real do projeto.

## Threat Model Status

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-08-10-01 (Tampering pricing no client) | mitigate | ✓ price_brl SSR'd do credit_packages; createChargeAction re-lê preço do DB (08-06) — client price é display only |
| T-08-10-02 (Spoofing createChargeAction de outro user) | mitigate | ✓ auth.getUser() gate em createChargeAction (08-06) + redirect login na page |
| T-08-10-03 (Info disclosure trial used count) | accept | terapeuta vê próprio data; getTrialState lê só o user.id da sessão |

## Threat Flags

Nenhuma superfície de segurança nova fora do `<threat_model>` do plano. A página não introduz endpoint novo (consome server action existente) nem novo trust boundary.

## Known Stubs

Nenhum stub. A página consome dados reais: `credit_packages` (DB), `getTrialState` (DB) e `createChargeAction` (server action real de 08-06). O empty-state ("Pacotes em atualização") só dispara se a query voltar vazia — comportamento de fallback legítimo, não stub.

## Verification

- **TSC:** `tsc --noEmit` ZERO erros nos 3 arquivos novos (grep por assinatura/comprar|PackageGrid|PackageCard|billing → vazio).
- **Lint:** `eslint --max-warnings 0` nos 3 arquivos → exit 0.
- **Tests:** N/A (plano UI sem testes especificados; cobertura é o UAT visual do founder).
- **NÃO rodado:** compra ao vivo / abertura do invoice_url Asaas — é ação do founder no checkpoint Task 3 (guardrail explícito).

## Checkpoint Pendente (Task 3 — founder)

Founder deve, em preview logado, visitar `/assinatura/comprar` e verificar:
1. 2 grupos com headers "Sem compromisso" e "Pacotes com economia".
2. 4 cards: Trial + Avulsa (grupo 1); Pequeno + Médio + Grande (grupo 2).
3. Badges "Mais escolhido" (Médio) e "Melhor valor" (Grande).
4. Pricing exato: 99,70 / 298,50 / 745,50 / 1.191,00 + economias (Médio = R$ 750,00).
5. Validade 12 meses em cada card.
6. Click "Comprar" → toast "Cobrança criada — redirecionando…" → redirect pra `sandbox.asaas.com`.
7. Mobile (375px) — cards stack verticalmente.
8. Trial nos 3 estados (active/ended/no_trial) renderiza.

**Resume-signal:** "approved" (opcional "+ ajustar X" ou "+ bugs Y/Z pra fix").

## Self-Check: PASSED

- 3 arquivos criados — todos FOUND em disco
- 2 commits FOUND (f85468e, 3bd8f27)
- tsc limpo + scoped lint exit 0 nos 3 arquivos
- Task 3 NÃO executada (correto — checkpoint human-verify bloqueante do founder)
