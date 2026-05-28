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
