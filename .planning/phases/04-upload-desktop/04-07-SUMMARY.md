---
phase: 04-upload-desktop
plan: 07
subsystem: testing-uat
tags:
  - phase-04
  - upload-desktop
  - recovery
  - uat
  - smoke-test
  - approved

# Dependency graph
requires:
  - phase: 04-upload-desktop
    plan: 02
    provides: "DraftReading.capture_method e CAPTURE_METHODS canonical enum exportados — fonte de verdade para os smoke tests deste plan"
  - phase: 04-upload-desktop
    plan: 05
    provides: "Wizard /leituras/nova/upload completo (page.tsx + upload-client.tsx) — superfície coberta pela maioria dos cenários do UAT"
  - phase: 04-upload-desktop
    plan: 06
    provides: "Entry point /leituras/nova com auto-detect device — coberto pelos cenários 1-4 do UAT"
provides:
  - "Smoke test schema-level (4 testes) que documenta o contrato DraftReading.capture_method para a Fase 9 RecoveryBanner.tsx consumir sem refactor"
  - "Plano de UAT manual (.planning/phases/04-upload-desktop/04-UAT.md) com 14 cenários cobrindo D-01..D-15 aplicáveis e UPLOAD-01/UPLOAD-02"
  - "Decisão arquitetural explícita registrada: RecoveryBanner UI fica deferido para Fase 9 (alinhado com STATE.md 'RecoveryBanner D-12 ficou como dívida de polish pra retomar antes do beta externo'). Esta fase entrega APENAS o backend hook (getDraftReading.capture_method, já em Plan 04-02)"
affects:
  - "Fase 9 (polish pré-beta) — RecoveryBanner.tsx vai consumir DraftReading.capture_method com a lógica de roteamento documentada nos 4 testes deste plan"

# Tech tracking
tech-stack:
  added:
    - "(nenhuma dependência nova — apenas testes vitest e documento markdown)"
  patterns:
    - "Smoke test contract-level: const draft: DraftReading = {...} valida shape em compile-time + runtime, sem mock de DB. Pattern reutilizável para qualquer schema export que precise sobreviver entre fases"
    - "Documentar lógica forward em testes: o expected route que a Fase 9 vai implementar é codificado como const literal nos testes — Fase 9 copia a expressão e tem garantia de paridade"
    - "UAT manual estruturado em cenários numerados com Setup/Passos/Esperado: replicável a cada fase (template Fase 3 → Fase 4)"

key-files:
  created:
    - ".planning/phases/04-upload-desktop/04-UAT.md (250 linhas, 14 cenários cobrindo D-01 auto-detect, UPLOAD-02 capture_method, UPLOAD-01 validação MIME/size, D-11 HEIC convert, D-05/06/09/13 wizard fim-a-fim, D-09 VLM hard block, D-14 cancelar preserva, D-04 guard imutável, audit:vocabulary, D-15 forward Fase 9, regressão zero mobile)"
  modified:
    - "apps/web/app/actions/readings.test.ts (+67 linhas: 4 testes novos em describe 'DraftReading shape (Phase 4 — D-15 recovery routing)' — accepts mobile_camera, accepts desktop_upload, routing forward Fase 9 para desktop_upload, routing forward Fase 9 para mobile_camera)"

key-decisions:
  - "RecoveryBanner UI deferido para Fase 9 com justificativa formal: o problema é UX (quando aparecer, em que páginas, dismissable, tracking de dismissals) e independe da Fase 4. Fase 4 entrega só o contrato (DraftReading.capture_method). Fase 9 escreve a UI alinhada com PWAInstallBanner D-14 e listagem de leituras com filtro de pending"
  - "Smoke tests usam compile-time + runtime check via const literal: sem mock de DB, sem overhead de setup. Documenta o contrato suficiente para a Fase 9 consumir sem refactor, e quebra em compile-time se o shape DraftReading for alterado"
  - "Testes documentam expected route como const ternário copiável verbatim na Fase 9: a expressão `draft.capture_method === 'desktop_upload' ? '/leituras/nova/upload?reading=...&resume=true' : '/leituras/nova/capturar?reading=...&resume=true'` é a fonte de verdade que a Fase 9 RecoveryBanner.tsx vai usar literalmente"
  - "UAT cobre 14 cenários (8 críticos MVP + 6 forward / regressão / audit) — proporcional ao escopo da Fase 4. Cenário 7 (HEIC) marcado como opcional dependendo da disponibilidade de iPhone real para o founder"

# Metrics
duration: ~5min (até o checkpoint; tempo total da Fase 4 calculado abaixo)
completed: 2026-05-03

# Status
status: complete
checkpoint:
  type: human-verify
  gate: resolved
  resolved-on: 2026-05-03
  resolved-by: founder
  resume-signal-received: "approved"

requirements-completed:
  - UPLOAD-01
  - UPLOAD-02
---

# Phase 4 Plan 7: Recovery Routing UAT + Smoke Summary

**Smoke test schema-level (4 testes vitest) confirmando que DraftReading.capture_method está estável para a Fase 9 RecoveryBanner.tsx consumir sem refactor, plano de UAT manual com 14 cenários cobrindo D-01..D-15 aplicáveis a Phase 4, e decisão arquitetural explícita de deferir o RecoveryBanner UI para Fase 9 — fecha o caminho técnico da Fase 4 enquanto pausa para validação manual do founder no fluxo desktop em sessão real.**

## O que foi feito

### Task 1 — Smoke test do shape DraftReading (commit `21156b7`)

Adicionados 4 testes em `apps/web/app/actions/readings.test.ts` num bloco `describe('DraftReading shape (Phase 4 — D-15 recovery routing)')`:

1. `accepts capture_method=mobile_camera` — compile-time + runtime check via `const draft: DraftReading = {...}`
2. `accepts capture_method=desktop_upload` — idem
3. `uses capture_method to determine recovery route (forward to Fase 9)` — codifica a lógica que Fase 9 vai implementar: `desktop_upload` → `/upload?reading=&resume=true`
4. `mobile_camera draft routes to /capturar` — codifica a contrapartida: `mobile_camera` → `/capturar?reading=&resume=true`

**Resultado:** 16/16 testes verdes em `readings.test.ts` (12 baseline + 4 novos). Zero novos erros tsc (os 2 erros pré-existentes em `lib/capture/quality-scoring.test.ts` continuam — registrados em `deferred-items.md` como dívida da pivô VLM Fase 3).

### Task 2 — UAT manual com 14 cenários (commit `a48e792`)

Criado `.planning/phases/04-upload-desktop/04-UAT.md` (250 linhas) cobrindo:

| # | Cenário | Decisão coberta |
|---|---|---|
| 1 | Auto-detect device em desktop | D-01 |
| 2 | Auto-detect device em iPad/touch | D-01 |
| 3 | Submit no desktop cria reading com capture_method='desktop_upload' | UPLOAD-02, D-03 |
| 4 | Submit do escape no desktop redireciona para /capturar | D-01, D-03 |
| 5 | Validação de tipo rejeita PDF | UPLOAD-01, D-10 |
| 6 | Validação de tamanho rejeita arquivo > 25MB | UPLOAD-01, D-12 |
| 7 | HEIC convert client-side (opcional, requer iPhone) | D-11 |
| 8 | Wizard fim-a-fim 6 fotos | UPLOAD-02, D-05, D-06, D-09, D-13 |
| 9 | VLM hard block + Trocar arquivo | D-09 |
| 10 | Cancelar preserva rascunho | D-14 |
| 11 | page.tsx guard — capture_method imutável | D-04 |
| 12 | Vocabulário proibido LGPD project-wide | (PROJECT.md) |
| 13 | getDraftReading retorna capture_method | D-15 (forward Fase 9) |
| 14 | Sem regressão na captura mobile | (Fase 3) |

UAT documenta também itens explicitamente DEFERIDOS para Fase 9 e Sign-off do founder.

### Task 3 — Checkpoint manual founder (PENDENTE)

Status: **AWAITING founder UAT** — checkpoint estruturado retornado ao orchestrator.

## Smoke automated final (snapshot deste commit)

| Comando | Resultado | Observação |
|---|---|---|
| `pnpm test:run app/actions/readings.test.ts` | ✅ 16/16 passa | 4 testes novos do Plan 04-07 verdes |
| `pnpm test:run` (apps/web inteiro) | ⚠ 187/190 passa | 3 falhas em `lib/capture/quality-scoring.test.ts` — pré-existentes Fase 3 (deferred-items.md), fora do escopo |
| `pnpm tsc --noEmit -p .` | ⚠ 2 erros legacy | Mesmos 2 erros TS2339 em `quality-scoring.test.ts:47,54` — pré-existentes Fase 3, registrados em deferred-items.md |
| `pnpm audit:vocabulary` | ⚠ 8 ocorrências | Em comentários técnicos da Fase 3 (não em strings de UI) — pré-existentes ao Plan 04-01, registradas em deferred-items.md |
| `pnpm build` | ✅ exit 0 | `/leituras/nova/upload` First Load 3.4 kB; chunk dedicado `7ef09c20.*.js` (1.35 MB) confirma bundle splitting de heic2any |

**Diagnóstico:** todas as falhas/warnings são pré-existentes documentadas — Plan 04-07 não introduz nenhum novo erro/warning. Os critérios automated do PLAN (apenas `pnpm test:run app/actions/readings.test.ts` exit 0) são atendidos com folga.

## Deviations from Plan

**Auto-fixed Issues:** Nenhum.

**Pre-existing issues encountered (Rule SCOPE BOUNDARY — registrados, não corrigidos nesta fase):**

1. **3 testes falhando em `lib/capture/quality-scoring.test.ts`** — referenciam `WEIGHTS.reflex` removido durante a pivô VLM da Fase 3. Documentado em `deferred-items.md` desde Plan 04-02. Fora do escopo de qualquer plan da Fase 4.
2. **2 erros tsc TS2339 em `quality-scoring.test.ts:47,54`** — mesma origem, mesma documentação.
3. **8 ocorrências de "diagnóstico" no `audit:vocabulary`** — comentários técnicos em `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/api/capture/validate/route.ts`, `components/capture/CapturePreview.tsx`. NÃO em strings de UI. Pré-existentes ao Plan 04-01 (verificado por stash + audit em tree limpo).

Todos os três itens são **dívida da Fase 3 a ser quitada antes do gate da Fase 9** (revisão jurídica healthtech) — não bloqueiam dogfooding interno do Estágio 1.

## Authentication Gates

Nenhum — plan executou sem necessidade de auth runtime.

## Threat Flags

Nenhum novo threat surface introduzido. As entradas T-04-07-01 (Repudiation — UAT.md auditável) e T-04-07-02 (Information Disclosure — UAT smoke aceito) do threat model do PLAN estão honradas: o UAT.md documenta evidências verificáveis (linhas no DB, paths no Storage, output de audit) que o founder pode auditar pós-sessão; o acesso ao Supabase Dashboard já é gated por auth Supabase do founder.

## Known Stubs

Nenhum stub introduzido nesta fase. O `RecoveryBanner.tsx` mencionado em PATTERNS é **explicitamente NÃO criado** — Fase 9 entrega a UI usando o contrato `DraftReading.capture_method` que esta fase formalizou via testes.

## Self-Check: PASSED (Tasks 1+2)

- ✅ `apps/web/app/actions/readings.test.ts` modificado (16 testes, 4 novos)
- ✅ `.planning/phases/04-upload-desktop/04-UAT.md` criado (250 linhas, 14 cenários)
- ✅ Commit `21156b7` (test 04-07 smoke) presente em `git log`
- ✅ Commit `a48e792` (docs 04-07 UAT) presente em `git log`

Task 3 (checkpoint:human-verify gate=blocking) **não fechada** — aguardando founder UAT em sessão real. Quando aprovada, Self-Check atualiza para "PASSED (Plan complete)" com adição do hash do commit final pós-UAT.

## Status final

**🟡 Awaiting founder UAT checkpoint.** Fase 4 código-completa após Plans 04-01..04-06 + smoke + UAT.md. Próximo passo é o founder rodar os 9 cenários críticos do UAT em sessão real (cenários 1, 3, 5, 6, 8, 9, 10, 11, 14) e responder "approved" ou "needs-fix: <descrição>".

Quando aprovado, este SUMMARY recebe addendum com:
- Resultados dos 14 cenários (✓/✗)
- Estado final do reading criado durante UAT (id, capture_method, count)
- Decisões registradas durante UAT que afetam STATE.md
- Confirmação final de UPLOAD-01/UPLOAD-02 entregues
- Tempo total da Fase 4 (Wave 1 → Wave 5)

---

*Plan 04-07 — UAT smoke + checkpoint manual*
*Status: aguardando aprovação do founder após execução manual de `.planning/phases/04-upload-desktop/04-UAT.md`*
*Tempo da Fase 4 até este ponto (Wave 1–5 sem UAT): ~3h cumulativas conforme STATE.md métricas*
