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
