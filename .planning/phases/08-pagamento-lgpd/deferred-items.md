# Deferred Items — Fase 08 (Pagamento + LGPD)

Itens out-of-scope descobertos durante execução. NÃO corrigidos (não causados pelos diffs do plano).

## Lint errors pré-existentes / untracked (descoberto em 08-02)

`pnpm lint` no app falha com 20 errors + 15 warnings, TODOS fora de `lib/asaas/`
(os arquivos do plano 08-02 passam `eslint lib/asaas --max-warnings 0` com exit 0).

Arquivos afetados (pré-existentes ou untracked, não tocados por este plano):

- `app/(capture)/leituras/nova/capturar/capture-client.tsx`
- `app/(dashboard)/leituras/[id]/editar/__tests__/save-action.test.ts`
- `app/(dashboard)/leituras/nova/upload/upload-client.tsx`
- `app/actions/therapist-invites.test.ts`
- `app/admin/calibration/[id]/comparar/page.tsx`
- `app/api/capture/validate/route.ts`
- `app/api/health/db/route.ts`
- `components/readings/EditorSectionItem.tsx`
- `lib/capture/camera-detection.ts`
- `lib/vision/modal-client.test.ts`
- `scripts/audit-repetition-last10.mts` (untracked)
- `scripts/run-sonnet-direct.spec.ts` (untracked)
- `scripts/test-haiku-vs-sonnet-stage1.mts` (untracked — git status)

Nota: vários são `.spec.ts`/`.mts` scripts de teste manuais untracked + tstest files.
O gate `next build` (eslint) precisa ser limpo ANTES de deploy LIVE da Fase 8 (plano 08-04+).
Decidir antes do deploy: corrigir vs `.eslintignore` dos scripts manuais untracked.

---

## Smoke test E2E de compra (do checkpoint 08-06 Task 4) — DIFERIDO pro 08-14

Migration 0039 JÁ aplicada live (founder, 2026-05-28). O smoke test E2E foi movido pro 08-14:
- `createChargeAction({ sku: 'avulsa' })` → `{ ok, invoice_url, credit_id, asaas_payment_id }`
- abrir invoice_url → checkout Asaas R$ 99,70
- `customer_credits` → status='pending', asaas_payment_id preenchido
- signup CPF duplicado → erro humano de dedup

Pré-requisitos antes do 08-14: ASAAS_WEBHOOK_TOKEN no Vercel (após webhook ter URL preview, plano 08-13) + deploy preview.

---

## PDF smoke do termo biométrico (checkpoint 08-08 Task 5) — DIFERIDO pro 08-14

Founder cria bucket privado `client-consents` + roda seed termo v1 (ações live em andamento).
PDF smoke E2E movido pro 08-14 (precisa deploy preview + GOTENBERG_URL/GOTENBERG_BASIC_AUTH):
- POST /api/consent/generate-pdf com client_id + reading_id existentes
- abrir pdf_url → conferir corpo hidratado + footer (IP/data BRT/SHA-256)
- confirmar A6 (consent_channel office_handoff E remote_link)

---

## audit-vocabulary.mjs JÁ red no baseline — 27 arquivos pré-existentes (descoberto em 08-09)

A memória `project_resend_domain_unverified_launch_gate` dizia "audit-vocabulary ✅ already
passes", mas empiricamente `node scripts/audit-vocabulary.mjs` **sai com exit 1 no baseline
`5c4a80a`** (antes do plano 08-09). São os 24+ hits pré-existentes Fase 3-7 já documentados em
STATE.md (linha do Plan 07.4-02): RAG/Jensen metadata, comentários operacionais de
capture/login, e VocabularyAuditBanner citando termos pra exibir ao usuário.

Confirmado pré-existente: `/privacidade` tinha 5 hits e `/termos` 3 hits de "tratamento/
diagnóstico" no baseline (uso lícito LGPD). NÃO causados pelo 08-09.

Ação tomada no 08-09 (in-scope): adicionado marcador `audit-vocabulary:allowlist` no topo de
`/privacidade`, `/termos` e `DisclaimerCopy.tsx` — uso lícito de vocab clínico (negar) +
"tratamento de dados" LGPD. Após o marcador, esses 3 arquivos saem com 0 hits.

OUT OF SCOPE (não corrigidos — scope boundary): os 27 arquivos restantes que mantêm o exit 1.
Lista completa em /tmp/audit2.txt da sessão; categorias: lib/rag/*, lib/anthropic/*
(stage1-glossary Jensen refs, analyze*.ts iris_map jensen), app/(auth)/login, app/convite,
app/api/capture/*, components/capture/*, components/readings/{AnalysisHero,VocabularyAuditBanner,
AdvancedAnalysisCTA}, + vários *.test.ts/*.test.tsx.

DECISÃO necessária antes de tornar audit-vocabulary um CI gate hard de verdade: ou (a) adicionar
allowlist marker / EXCLUDE_SUBPATHS aos arquivos legítimos (RAG metadata, test fixtures), ou
(b) refinar os PATTERNS pra não pegar "jensen" como nome de escola em bibliografia. Trabalho
próprio — não fold neste plano. Revisitar em plano de hardening LGPD-06 (Fase 8.1+).

---

## OPERATOR_EMAIL + vocab debt (checkpoint 08-09 Task 5 — resolvido 2026-05-28)

Founder decidiu OPERATOR_EMAIL = suporte@iriscodex.com (copy legal aprovada). Ações pendentes do founder:
- Criar caixa suporte@iriscodex.com
- Setar NEXT_PUBLIC_OPERATOR_EMAIL=suporte@iriscodex.com no Vercel (fallback no código já aponta pra lá)

LGPD-06 vocab debt (NÃO desta fase): audit-vocabulary.mjs já estava VERMELHO no baseline 5c4a80a —
27 arquivos pré-existentes (Fases 3-7) com "tratamento/diagnóstico". As 3 superfícies do 08-09 têm
marcador allowlist (0 hits novos). Memória "audit já passa" desatualizada. Decidir antes do GA:
revisar os 27 OU expandir allowlist com justificativa por arquivo.

---

## Refinamentos de copy /assinatura/comprar (08-10 UAT, founder aprovou visual 2026-05-28)

UAT visual APROVADO (desktop+mobile). Refinamentos não-bloqueantes pra rodada futura:
- TYPO: "volladas" → "voltadas" no disclaimer (grep em components/billing/PackageGrid.tsx ou page.tsx)
- Card trial "Não disponível" → copy mais convidativa
- "vs Avulsa" → "Você economiza R$X"
3 estados do trial (active/ended) + redirect Asaas real NÃO testados → smoke E2E 08-14.

## NOTA typo "volladas": está em components/legal/DisclaimerCopy.tsx (compartilhado) — fix único cobre TODAS as telas (08-09/08-10/08-11). 08-11 UAT estado-vazio aprovado; estados-com-dado → 08-14.

---

# 📋 Backlog Fase 8.1 — code review findings NÃO corrigidos (decisão founder: beta-OK se baixo impacto)

Os 8 críticos (CR-01/02/03 + WR-01/02/03/05/07) JÁ corrigidos (commits 41315be→200899c, +21 testes, billing 128 green). Restam pra decisão futura:

## Warnings (4)
- **WR-04** — `expireOldCredits` grava `amount: 0` na expiração → ledger perde o saldo confiscado (auditoria incompleta). Impacto: relatório/auditoria, não saldo do usuário.
- **WR-06** — `analyze/route.ts` converte a reserva só no happy path → geração abandonada/com-erro nunca debita, crédito fica preso reservado (até expirar a reserva). Impacto: UX/dinheiro médio — slot some temporariamente. Vale par com um job de release de reservas órfãs.
- **WR-08** — `evaluateTrial`: `ended_at` explícito mascara motivo "exhausted-readings" como `manual`. Impacto: cosmético/telemetria.
- **WR-09** — TTL de signed URL = 365 dias pro PDF de consentimento biométrico = excessivo (LGPD/segurança). Reduzir TTL + gerar on-demand. Vale rever pré-GA.

## Infos (7)
- **IN-01** — `verifyAsaasToken` branch de length-mismatch vaza tamanho do token (early return).
- **IN-02** — `signBiometricTerm` seleciona `content_sha256` mas não usa.
- **IN-03** — `clientAge` usa divisor fixo `31_557_600_000` ms/ano.
- **IN-04** — comentário de `audit_events.event_type` lista vocabulário stale vs `events.ts`.
- **IN-05** — `cleanupStaleEmptyReadingsAction` deleta readings mas não suas reservations (par com WR-06).
- **IN-06** — `createChargeAction` compensation delete pode deixar customer Asaas sem credit row local em falha parcial.
- **IN-07** — gate de perfil no `middleware.ts` roda query a cada request protegido (sem cache).

Relatório completo: 08-REVIEW.md. Fixes aplicados: ver git log fix(08).
