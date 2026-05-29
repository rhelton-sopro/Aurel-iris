---
phase: 08-pagamento-lgpd
plan: 09
subsystem: legal
tags: [lgpd, privacy, terms, disclaimer, react, nextjs, audit-vocabulary]

# Dependency graph
requires:
  - phase: 08-03
    provides: pricing D-02 + validade 12m + arrependimento 7d (CONTEXT)
  - phase: 07.4
    provides: audit-vocabulary.mjs + forbidden-terms.json + report-print-document PDF
provides:
  - "DisclaimerCopy component (DISCLAIMER_TEXT + DISCLAIMER_COMPACT) reusável em 3 superfícies"
  - "/privacidade com seção #deletar-dados (LGPD-03 básico via mailto pré-formatado)"
  - "/termos com pricing D-02 + arrependimento 7d (CDC art. 49) em destaque (D-14)"
  - "OPERATOR_EMAIL via NEXT_PUBLIC_OPERATOR_EMAIL (env var + placeholder fallback)"
  - "audit-vocabulary:allowlist marker nas páginas legais"
affects: [08-10, billing-ui, lgpd-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Copy obrigatória single-source-of-truth: DISCLAIMER_TEXT/DISCLAIMER_COMPACT exportados de DisclaimerCopy.tsx, consumidos pelo PDF route + layout + header + páginas legais"
    - "OPERATOR_EMAIL via env var com placeholder fallback (decisão final em checkpoint)"

key-files:
  created:
    - apps/web/components/legal/DisclaimerCopy.tsx
    - apps/web/app/__tests__/legal.test.ts
  modified:
    - apps/web/app/privacidade/page.tsx
    - apps/web/app/termos/page.tsx
    - apps/web/app/(dashboard)/layout.tsx
    - apps/web/components/dashboard/dashboard-header.tsx
    - apps/web/app/api/readings/[id]/pdf/route.tsx

key-decisions:
  - "Páginas legais JÁ existiam robustas (Fase 11/anteriores) — EXTEND não recriar; honrar tokens de design existentes (text-ink/text-mist/tracking-label), NÃO os tokens do plano (text-muted-foreground/teal-dark)"
  - "OPERATOR_EMAIL via NEXT_PUBLIC_OPERATOR_EMAIL com placeholder rhelton@gmail.com — founder decide valor final no Task 5"
  - "audit-vocabulary JÁ red no baseline (27 arquivos pré-existentes) — allowlist só nas páginas deste plano; resto out-of-scope"

patterns-established:
  - "DisclaimerCopy: 3 variantes (footer/inline/compact) + 2 string exports pra consumo server-only (PDF route)"
  - "Páginas legais que citam vocab clínico/LGPD lícito → marcador audit-vocabulary:allowlist no topo"

requirements-completed: [LGPD-02, LGPD-03, LGPD-05, LGPD-06]

# Metrics
duration: ~30min
completed: 2026-05-28
---

# Phase 8 Plan 09: Páginas Legais LGPD + Copy Obrigatória Summary

**DisclaimerCopy reusável (não-médico) em 3 superfícies + /privacidade com link de exclusão LGPD-03 via mailto + /termos com pricing D-02 e arrependimento 7d em destaque — TASKS 1-4 COMPLETAS, PARADO no checkpoint Task 5 (founder verifica copy + decide OPERATOR_EMAIL).**

> **STATUS: CHECKPOINT-PENDING.** Tasks 1-4 entregues e commitadas. Task 5 é um
> checkpoint `human-verify` blocking — aguarda o founder revisar a copy legal e
> decidir o valor de OPERATOR_EMAIL. Ver seção "Checkpoint Pendente" abaixo.

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-28 (sessão sequencial, main working tree)
- **Tasks:** 4 de 5 (Task 5 = checkpoint blocking, não executável por agente)
- **Files modified:** 5 modificados + 2 criados

## Accomplishments
- `DisclaimerCopy.tsx` — componente RSC com `DISCLAIMER_TEXT` (parágrafo completo) + `DISCLAIMER_COMPACT` (1 linha), single source of truth. Reforça enquadramento não-médico (apoio à anamnese terapêutica integrativa, padrões emocionais/comportamentais + estilo de vida) per diretriz governante.
- Wired em 3 superfícies: rodapé do PDF (fallback do route handler), rodapé passivo do layout autenticado, reforço ativo no header (md+).
- `/privacidade` ganhou seção `#deletar-dados` (LGPD-03 básico) com botão `mailto:` pré-formatado (subject + body modelo) + SLA 15 dias + disclaimer inline.
- `/termos` ganhou box de pricing D-02 exato (99,70 / 298,50 / 745,50 / 1.191,00) + box de arrependimento 7d (CDC art. 49, reembolso integral/proporcional).
- `legal.test.ts` — 5 testes GREEN cobrindo todas as âncoras canônicas.
- Marcador `audit-vocabulary:allowlist` nas páginas legais (uso lícito de "tratamento de dados" LGPD + vocab clínico citado pra negar).

## Task Commits

1. **Task 1: DisclaimerCopy + 3 surfaces** - `45218a7` (feat)
2. **Task 2: /privacidade exclusão LGPD-03** - `3b67733` (feat)
3. **Task 3: /termos pricing D-02 + arrependimento** - `d66ce23` (feat)
4. **Task 4: legal.test.ts + allowlist marker** - `ba20609` (test)

_(Task 5 = checkpoint blocking — sem commit; metadata commit final inclui SUMMARY + ROADMAP.)_

## Files Created/Modified
- `apps/web/components/legal/DisclaimerCopy.tsx` (criado) — copy obrigatória LGPD-05, 3 variantes + 2 string exports
- `apps/web/app/__tests__/legal.test.ts` (criado) — 5 testes de regressão das páginas legais
- `apps/web/app/privacidade/page.tsx` (mod) — seção #deletar-dados + mailto + OPERATOR_EMAIL + disclaimer inline + allowlist marker
- `apps/web/app/termos/page.tsx` (mod) — pricing D-02 box + arrependimento box + OPERATOR_EMAIL + disclaimer inline + allowlist marker
- `apps/web/app/(dashboard)/layout.tsx` (mod) — Surface 2: rodapé via DisclaimerCopy (substituiu copy hardcoded)
- `apps/web/components/dashboard/dashboard-header.tsx` (mod) — Surface 3: reforço ativo compact (md+)
- `apps/web/app/api/readings/[id]/pdf/route.tsx` (mod) — Surface 1: fallback do rodapé ancorado em DISCLAIMER_COMPACT

## Decisions Made
- **Páginas legais já existiam robustas** (criadas em fases anteriores, com 11 seções LGPD, SLA 15d, subprocessadores, papel operador/controlador). Decisão: EXTEND, não recriar — honrando os tokens de design reais do projeto (`text-ink`, `text-mist`, `tracking-display`, `tracking-label`) em vez dos tokens genéricos do plano (`text-muted-foreground`, `teal-dark`, footer `bg-muted/30`). Alinha com memory `feedback_design_tokens_semantic_neutral` + `feedback_tailwind_prose_inert`.
- **Surface 2 já tinha a copy hardcoded** no layout — substituída por `DisclaimerCopy variant="compact"` (single source of truth, visual idêntico).
- **OPERATOR_EMAIL** via `process.env.NEXT_PUBLIC_OPERATOR_EMAIL` com placeholder `rhelton@gmail.com`; os 3 pontos de contato (item 1 + exclusão privacidade, item 11 termos) usam a mesma constante — decisão do founder no Task 5 propaga pra todos.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Paths/tokens do plano divergiam da realidade do código**
- **Found during:** Tasks 1-3
- **Issue:** O plano assumiu páginas a criar do zero com tokens `text-muted-foreground`/`teal-dark` e footer hardcoded ausente; na realidade `/privacidade` e `/termos` já existiam completas, o layout já tinha a copy, e o projeto usa tokens semânticos próprios (prose-* inerte).
- **Fix:** Estendi as páginas existentes preservando estrutura/tokens; substituí a copy hardcoded do layout pelo componente; usei `app/__tests__/legal.test.ts` (não `app/(public)/__tests__/` — esse route group não existe) com paths relativos corretos.
- **Files modified:** todos os arquivos do plano + `app/__tests__/legal.test.ts`
- **Verification:** tsc limpo nos arquivos novos; 5/5 testes GREEN; lint exit 0.
- **Committed in:** `45218a7`, `3b67733`, `d66ce23`, `ba20609`

**2. [Rule 2 - Missing Critical] Surface 1 (PDF) — ancorar fallback na copy canônica**
- **Found during:** Task 1
- **Issue:** O rodapé do PDF derivava o disclaimer de `encerramento_disclaimer` (por-relatório) com fallback string solto, sem garantia de copy obrigatória.
- **Fix:** Fallback de `disclaimerFooterLine` passou a usar `DISCLAIMER_COMPACT` importado do componente — single source of truth garantido no artefato final.
- **Files modified:** `apps/web/app/api/readings/[id]/pdf/route.tsx`
- **Verification:** tsc limpo; import string de .tsx em route handler OK (TS erasure).
- **Committed in:** `45218a7`

---

**Total deviations:** 2 auto-fixed (1 blocking path/token reconciliation, 1 missing critical PDF anchor)
**Impact on plan:** Sem scope creep — entregas do plano cumpridas com os arquivos reais. Tokens de design alinhados ao projeto.

## Issues Encountered
- **audit-vocabulary.mjs JÁ vermelho no baseline `5c4a80a`** (exit 1) — confirmado empiricamente que `/privacidade` (5 hits) e `/termos` (3 hits) tinham "tratamento/diagnóstico" ANTES deste plano, além de 27 arquivos pré-existentes Fase 3-7 (RAG/Jensen, capture/login, VocabularyAuditBanner). A memória `project_resend_domain_unverified_launch_gate` ("✅ already passes") está desatualizada. **Ação in-scope:** marcador `audit-vocabulary:allowlist` em /privacidade + /termos + DisclaimerCopy (esses 3 saem com 0 hits). **Out-of-scope (não corrigido):** os 27 arquivos restantes que mantêm exit 1 — logado em `deferred-items.md` com decisão pendente pra um plano de hardening LGPD-06 (Fase 8.1+).
- **report-print-document.test.tsx** tem 1 teste falho (essence-page render) — **pré-existente no baseline** (confirmado via checkout 5c4a80a: idêntico 1 failed/17 passed). Não toquei `report-print-document.tsx`. Out-of-scope.

## Known Stubs
Nenhum. `OPERATOR_EMAIL` usa env var com placeholder consciente (decisão de checkpoint, não stub).

## Checkpoint Pendente — Task 5 (human-verify, blocking)

**O founder precisa:**
1. Revisar `/privacidade` (preview Vercel) — linguagem pt-BR formal? mailto abre cliente de email? SLA 15 dias visível? Seção #deletar-dados clara?
2. Revisar `/termos` — pricing exato D-02 (99,70 / 298,50 / 745,50 / 1.191,00, não arredondado)? Arrependimento 7d em box destacado?
3. Conferir DISCLAIMER no rodapé global das páginas autenticadas + header + rodapé do PDF.
4. **DECIDIR `OPERATOR_EMAIL`:** atualmente `NEXT_PUBLIC_OPERATOR_EMAIL` com fallback placeholder `rhelton@gmail.com`. Manter founder OU criar `suporte@iriscodex.com` (+ regra de forwarding Resend). Configurar a env var no Vercel se mudar.
5. Validar tom dos termos vs `lib/consent/term-v1.md` — sem contradições.

**Resume-signal esperado:** "approved" + escolha de OPERATOR_EMAIL (founder default OU suporte@iriscodex.com) + tom OK SIM/NÃO.

**Wiring do OPERATOR_EMAIL:** `apps/web/app/privacidade/page.tsx` (const linha ~16, usado em item 1 contato + botão de exclusão) e `apps/web/app/termos/page.tsx` (const, usado em seção contato). Ambos: `process.env.NEXT_PUBLIC_OPERATOR_EMAIL ?? 'rhelton@gmail.com'`.

## Next Phase Readiness
- LGPD-02/03/05 entregues; LGPD-06 mantido nas superfícies novas (allowlisted).
- Plano 10 (UI de compra) pode importar `DisclaimerCopy` para a tela de checkout.
- Bloqueador: founder precisa aprovar copy + configurar `NEXT_PUBLIC_OPERATOR_EMAIL` no Vercel antes do deploy LIVE da Fase 8.

## Self-Check: PASSED

- Files FOUND: DisclaimerCopy.tsx, legal.test.ts, privacidade/page.tsx, termos/page.tsx, 08-09-SUMMARY.md
- Commits FOUND: 45218a7, 3b67733, d66ce23, ba20609
- Tests: legal.test.ts 5/5 GREEN
- Lint: exit 0 nos arquivos do plano
- tsc: 0 erros novos (22 baseline pré-existentes inalterados)

---
*Phase: 08-pagamento-lgpd*
*Completed (Tasks 1-4): 2026-05-28 — Task 5 checkpoint pendente*
