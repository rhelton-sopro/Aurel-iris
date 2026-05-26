---
phase: 09-polish-dogfooding-beta
plan: "05"
subsystem: docs/close-out
tags: [verification, close-out, roadmap, requirements, deferred, fase-11.1-blocker]
dependency-graph:
  requires:
    - "Plans 09-01/02/03/04 entregues em código + commits"
    - "Founder smoke parcial (cenário 3 PASS por inspeção)"
  provides:
    - ".planning/phases/09-polish-dogfooding-beta/09-VERIFICATION.md (3 cenários + status real)"
    - "ROADMAP.md Fase 9 atualizada DELIVERED + plans listed [x] + progress table 5/5"
    - "REQUIREMENTS.md tabela Rastreabilidade ONBOARD-01..05 status final"
  affects:
    - "Fase 11.1 (NEW blocker descoberto durante smoke — invite/[token] → /dashboard PKCE fix) — bloqueia smoke cenários 1+2"
    - "Memory project_dogfooding_gate_status (founder responsabilidade futura)"
tech-stack:
  added: []
  patterns:
    - "Smoke gate descoberto bloqueador empírico — Rule 4 architectural defer registrado"
    - "Partial close honest: code-complete sim, E2E smoke não (PENDING aguarda dependência externa)"
key-files:
  created:
    - path: ".planning/phases/09-polish-dogfooding-beta/09-VERIFICATION.md"
      purpose: "Smoke checklist 3 cenários E2E (wizard / e-mail / dogfooding) com edge cases + status real per cenário"
    - path: ".planning/phases/09-polish-dogfooding-beta/09-05-SUMMARY.md"
      purpose: "Este arquivo — close-out + decisão de defer"
  modified:
    - path: ".planning/ROADMAP.md"
      change: "Linha 34 Fase 9 [ ] → [~] DELIVERED + Plan 09-05 [x] + cross-link VERIFICATION + Progress table 5/5"
    - path: ".planning/REQUIREMENTS.md"
      change: "Tabela Rastreabilidade ONBOARD-01..05 status final + ONBOARD-04 spec section [x] → [~]"
decisions:
  - "Partial close honest: Fase 9 código-completa (5/5 plans entregues) mas smoke E2E parcial — cenário 3 PASS, cenários 1+2 PENDING aguardando Fase 11.1 (invite-fix descoberto durante o próprio smoke)"
  - "Fase 11.1 (NEW) escopo: corrigir /convite/[token] → /dashboard PKCE code exchange. Sem ela, terapeuta novo via invite cai em /login (signup bloqueado pra alt gmail account)"
  - "ONBOARD-04 marcado [~] (in-progress) — instrumentation entregue mas gate só fecha por uso continuado (3 semanas consecutivas ≥3 leituras/sem clientes reais sem notas paralelas, declaração founder via memory)"
  - "ONBOARD-03 + ONBOARD-05 confirmados Deferred V1.1+ conforme 09-CONTEXT.md D-01 + decisão founder 2026-05-18 (launch v1 = B2B convite, não landing pública nem beta 10-20)"
metrics:
  duration: "~12 min wall-clock (incluindo checkpoint resolution + Task 3)"
  completed_date: "2026-05-26"
  tasks_completed: 3
  files_touched: 4
  commits: 2
---

# Phase 09 Plan 05: Fase 9 Close-Out + Verification Smoke (Partial) Summary

**One-liner:** Fase 9 fechada honest — código 5/5 entregue (wizard ONBOARD-01 + e-mail ONBOARD-02 + dogfooding gate ONBOARD-04), VERIFICATION.md committed com cenário 3 PASS por inspeção e cenários 1+2 PENDING aguardando Fase 11.1 (invite-fix bloqueador descoberto DURANTE o próprio smoke); ROADMAP + REQUIREMENTS atualizados.

## What Shipped

### Task 1 — VERIFICATION.md criado (commit `7ac14e9`)

`.planning/phases/09-polish-dogfooding-beta/09-VERIFICATION.md` (114 linhas) com 3 cenários E2E mais edge cases + status placeholders pro founder:

- **Cenário 1 (ONBOARD-01 wizard):** Setup + 15 steps cobrindo happy path (1/3 → 2/3 → 3/3) + skip path (Pular + persistência) + backward-compat (founder não vê banner)
- **Cenário 2 (ONBOARD-02 e-mail):** 13 steps cobrindo happy path (inbox + From + Subject + link + notification_sent_at) + idempotência (regen NÃO duplica) + graceful degradation (unset RESEND_API_KEY)
- **Cenário 3 (ONBOARD-04 dogfooding):** Setup founder + 8 steps cobrindo bloco visível em /admin/relatorios + 4 KPIs + histórico semanal + non-founder gate 404

Acceptance grep checks todos PASS (Cenário 1/2/3 x2, Idempotência, Backward-compat, Non-founder gate x1 cada; ONBOARD-01/02/04 x7; "PASS / [ ] FAIL" x3).

### Task 2 — Founder smoke (parcial — checkpoint resolved with DEFER)

Founder rodou smoke parcial e **descobriu bug bloqueador** durante a tentativa do Cenário 1:

> Bug descoberto: fluxo /convite/[token] gera link mas terapeuta novo cai em /login (PKCE code não trocado pela rota direto pra /dashboard). Sem invite funcional, não há como criar alt gmail account de teste pra Cenários 1 (wizard novo) e 2 (e-mail leitura pronta na inbox alt).

**Decisão founder (Rule 4 architectural defer):**
- Cenário 3 (dogfooding /admin/relatorios) confirmado **PASS** por inspeção direta como founder logado — bloco visível, 4 KPIs renderizam, dados coerentes com uso founder desde 2026-05-15
- Cenários 1+2 marcados **PENDING** — aguardam entrega da Fase 11.1 (invite-fix)
- Não criar plan de bug-fix dentro da Fase 9; criar Fase 11.1 nova ANTES de fechar smoke

VERIFICATION.md atualizado com status real + nota de defer no rodapé.

### Task 3 — ROADMAP + REQUIREMENTS atualizados (commit final)

**ROADMAP.md:**
- Linha 34 (lista de fases): `[ ] Fase 9: Polish... In-progress implícito` → `[~] Fase 9: Polish + dogfooding + beta — DELIVERED (ONBOARD-01/02/04) 2026-05-26+ — ... Smoke cenários 1+2 PENDING aguardando Fase 11.1 (invite-fix); cenário 3 PASS. ONBOARD-03/05 deferred V1.1+.`
- Seção detalhada Fase 9: Plan 09-05 [ ] → [x] + cross-link pra VERIFICATION.md
- Progress table linha 612: `9. Polish + dogfooding + beta | 0/TBD | In-progress implícito` → `5/5 | DELIVERED (ONBOARD-01/02/04); smoke 1+2 PENDING Fase 11.1 invite-fix; cenário 3 PASS | 2026-05-26 (delivered)`

**REQUIREMENTS.md:**
- Section "Onboarding e e-mail / Polish": `[x] ONBOARD-04` → `[~] ONBOARD-04` (in-progress; gate fecha por uso continuado)
- Tabela Rastreabilidade linhas 166-170:
  - `ONBOARD-01 | Fase 9 | Pendente` → `✅ Completo (Plan 09-02, 2026-05-26) ... smoke E2E pending Fase 11.1`
  - `ONBOARD-02 | Fase 9 | Pendente` → `✅ Completo (Plans 09-03 + Fase 11 11-01, 2026-05-26) ... smoke E2E pending Fase 11.1`
  - `ONBOARD-03 | Fase 9 | Pendente` → `⏸️ Deferred V1.1+ (decisão founder 2026-05-26, ref 09-CONTEXT.md D-01)`
  - `ONBOARD-04 | Fase 9 | Pendente` → `🚧 In progress (Plan 09-04, instrumentation entregue) ... declaração final em memory project_dogfooding_gate_status`
  - `ONBOARD-05 | Fase 9 | Pendente` → `⏸️ Deferred V1.1+ ... beta 10-20 depende de Fase 8 Stripe + ONBOARD-03`

Acceptance grep checks todos 11/11 PASS (5 REQ ONBOARD-XX + Fase 9 DELIVERED + 5 plans listed).

## Deviations from Plan

### Rule 4 (architectural defer) — DOCUMENTED, NÃO auto-fixed

**1. Smoke gate descobriu bloqueador externo no fluxo /convite/[token]**
- **Found during:** Task 2 (founder smoke tentativa Cenário 1)
- **Issue:** PKCE code não trocado pela rota /convite/[token] → terapeuta cai em /login em vez de /dashboard. Bloqueia signup de alt gmail account = bloqueia Cenários 1+2 do smoke
- **Resolution:** Founder decidiu criar Fase 11.1 (invite-therapist-signup) ANTES de fechar smoke 1+2; cenário 3 confirmado por inspeção direta; cenários 1+2 marcados PENDING com nota de defer; Fase 9 fecha PARTIAL honest (código entregue, smoke 1+2 deferred)
- **Files modified:** 09-VERIFICATION.md (status real + nota de defer)
- **Commit:** [final 09-05]

Sem auto-fixes Rule 1/2/3 — nenhum bug introduzido pelo plano, nenhum critical functionality faltando, nenhum blocker técnico em código.

## Authentication Gates

Nenhum auth gate durante execução. Founder operou em prod ao confirmar Cenário 3 (admin/relatorios) com sua própria sessão.

## Known Stubs

Nenhum. Todos artefatos são docs reais com status real (VERIFICATION.md tem status PENDING/PASS calcados em realidade, não placeholders vazios).

## Threat Flags

Nenhuma superfície nova de segurança introduzida — este plano é pure docs. ROADMAP/REQUIREMENTS/VERIFICATION são leitura interna não-PII, autenticada via filesystem do projeto.

## Decisão de defer — Fase 11.1 como blocker

| Item | Status pré-defer | Status pós-defer | Razão |
|------|------------------|------------------|-------|
| Código Fase 9 (5 plans) | Entregue | Entregue ✅ | Nada a fazer — código está em prod |
| Cenário 1 smoke (wizard) | Esperado PASS | PENDING | Sem invite funcional, alt gmail account não signupea |
| Cenário 2 smoke (e-mail) | Esperado PASS | PENDING | Mesma razão — sem terapeuta-teste com inbox real |
| Cenário 3 smoke (dogfooding) | Esperado PASS | PASS ✅ | Inspeção direta founder logado — independente de invite |
| ONBOARD-04 gate (3 semanas) | In-progress | In-progress 🚧 | Fecha por uso continuado founder; instrumentation pronta em /admin/relatorios |
| Fase 11.1 (NEW) | n/a | TBD | Founder discute + planeja antes de retomar smoke 1+2 |

**Quando smoke 1+2 será rodado:**
1. Founder fecha Fase 11.1 (invite-fix)
2. Founder usa o invite-link real (sem PKCE break) pra criar alt gmail account
3. Roda Cenários 1 + 2 do VERIFICATION.md
4. Atualiza VERIFICATION.md com status PASS/FAIL real
5. Se ambos PASS: Fase 9 fecha totalmente (changing `[~]` → `[x]` em ROADMAP)
6. Se algum FAIL: bug-fix plan separado antes de marcar Fase 9 done

## Memory — project_dogfooding_gate_status

Founder responsável por criar/manter memory file `project_dogfooding_gate_status.md` fora deste plano:
- Data início: 2026-05-15 (Sonnet 2x v2.3.0 LIVE)
- Status atual: leituras/semana count + clientes reais únicos (visível em /admin/relatorios)
- Gate close target: ~2026-06-05 se ritmo mantém
- Declaração formal de "passou" via memory update quando 3 semanas consecutivas ≥3 leituras/sem clientes reais sem notas paralelas

Este SUMMARY não cria a memory — só registra que está fora do escopo do plan.

## Próximos passos sugeridos

1. **Imediato:** Founder discute Fase 11.1 (invite-fix) — escopo, plans, waves
2. **Pós-11.1:** Founder roda smoke real cenários 1+2 + atualiza VERIFICATION.md
3. **Paralelo:** Founder mantém uso real diário → ONBOARD-04 gate fecha por si só ~2026-06-05
4. **V1.1 backlog:** ONBOARD-03 (landing) + ONBOARD-05 (beta 10-20) + Fase 8 (Stripe + LGPD-01..06)
5. **Calibração contínua:** Tech debts memory (Stage 1 variability, §2 anti-fusão, §0 vocativo) seguem triggers definidos

## Commits

| Task | Hash      | Message |
|------|-----------|---------|
| 1    | `7ac14e9` | `docs(09-05): criar 09-VERIFICATION.md — smoke checklist manual 3 cenários E2E` |
| 3    | [final]   | `docs(09-05): close Fase 9 — VERIFICATION cenário 3 PASS, 1+2 PENDING aguarda Fase 11.1` |

## Self-Check

Realizado pós-write deste SUMMARY.md — ver bloco final do arquivo.
