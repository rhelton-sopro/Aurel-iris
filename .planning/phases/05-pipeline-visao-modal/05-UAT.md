---
status: partial
phase: 05-pipeline-visao-modal
source:
  - 05-01-SUMMARY.md
  - 05-02-SUMMARY.md
  - 05-03-SUMMARY.md
  - 05-04-SUMMARY.md
  - 05-05-SUMMARY.md
  - 05-06-SUMMARY.md
  - 05-07-SUMMARY.md
  - 05-08-SUMMARY.md
  - 05-09-SUMMARY.md
  - 05-10-SUMMARY.md
  - 05-11-SUMMARY.md
  - 05-12-SUMMARY.md
  - 05-13-SUMMARY.md
  - 05-14-SUMMARY.md
  - 05-15-SUMMARY.md
  - 05-16-SUMMARY.md
  - 05-17-SUMMARY.md
started: "2026-05-04T21:00:00.000Z"
updated: "2026-05-04T21:40:00.000Z"
---

## Current Test

[testing paused — 1 item outstanding (blocked: deployment-gate)]

## Tests

### 1. Cold Start Smoke Test
expected: |
  vision-service `pytest tests/` → 135 passed + 4 skipped expected.
  apps/web `pnpm test:run` → 260 passed + 3 pre-existing legacy fails (Phase 3 quality-scoring, deferred).
  `audit:vocabulary` clean cross-tree.
result: pass

### 2. Trigger Route Contract — `POST /api/readings/[id]/process`
expected: |
  ROADMAP Fase 5 Success Criterion 1.

  Route exists at apps/web/app/api/readings/[id]/process/route.ts. Auth gate (401 sem sessão), ownership guard (404 se não dono OR status fora de {pending, failed}), gera 6 signed URLs (TTL 600s D-T6), pre-spawn UPDATE com modal_call_id='pending' (D-T5), chama triggerVisionPipeline, post-spawn UPDATE com call_id real, retorna 202. Em falha do Modal, rollback para status='failed' com error_summary D-E1 e retorna 502.

  13 vitest tests cobrem todas as saídas: 401, 404×3, 500, 502, 202.

  Verificável manualmente abrindo o arquivo + lendo o test runner output, ou inspeção visual de `apps/web/app/api/readings/[id]/process/route.test.ts`.
result: pass

### 3. Webhook Route Contract — `POST /api/vision/webhook`
expected: |
  ROADMAP Fase 5 Success Criterion 4.

  Route exists at apps/web/app/api/vision/webhook/route.ts. Lê raw body via request.text(), verifica HMAC via verifyHmacSignature (401 + reason logged em fail), Zod superRefine valida payload (400 em fail), status guard D-T4 (200 no-op se já final), atomic UPDATE D-F5 com createServiceClient. revalidatePath('/leituras') no fim.

  16 vitest tests cobrem: HMAC fail × 3, Zod fail × 3, no-op × 3, success × 4, D-T5 mismatch × 2, env missing × 1.
result: pass

### 4. Modal Pipeline Contract — `analyze_iris_endpoint` + `run_pipeline`
expected: |
  ROADMAP Fase 5 Success Criterion 2 (6 stages execute in order) + 3 (JSON conforma SPEC §4.3).

  vision-service/modal_app.py exporta:
  - `app = modal.App("aurel-iris-vision")`
  - `analyze_iris_endpoint` (FastAPI POST) que faz `run_pipeline.spawn(...)` → retorna `{call_id}`
  - `run_pipeline` (T4 GPU, timeout=120s) que executa as 6 stages per eye com try/except (D-F1 soft degradation): detect → segment → compose → normalize → enhance → features
  - Valida via `IrisFeatures.model_validate(...)` ANTES de POST → garante SPEC §4.3 conformity
  - `_post_webhook` HMAC-signed POST a `${WEBHOOK_BASE_URL}/api/vision/webhook`

  10 pytest tests cobrem importabilidade, image config, _classify_error_summary D-E1, _post_webhook Stripe convention, B2/B3/B5 anti-regressions.
result: pass

### 5. UI: StatusBadge + ReprocessButton em `/leituras`
expected: |
  apps/web/components/readings/StatusBadge.tsx renderiza 5 variants pt-BR (Aguardando/Processando/Pronto/Falhou/Editado) com Rascunho override + tooltip on failed mostrando vision_features.processing_metadata.error_summary.

  apps/web/components/readings/ReprocessButton.tsx renderiza para readings com status='failed', POSTs a /api/readings/[id]/process, on 202 chama router.refresh() (D-T2 — sem polling).

  /leituras/page.tsx wireado: StatusBadge per row + ReprocessButton condicional em status='failed'.

  19 vitest tests (12 StatusBadge + 7 ReprocessButton) cobrem todas as variants + tooltip + disabled states + fetch URL + router.refresh.

  Verificação direta: rodar `pnpm dev` no apps/web, fazer login, criar leitura draft, finalizar, ver StatusBadge no /leituras. Ou só confirmar pelo código + tests passing.
result: pass

### 6. CI Workflow — `.github/workflows/vision-service-tests.yml`
expected: |
  Workflow GH Actions existe e tem YAML válido. Trigger em push/PR tocando vision-service/**. Steps: checkout@v4 → setup-python@v5 (Python 3.11) → pip install -r requirements.txt → pytest -v → audit_vocabulary (with `if: always()` para rodar mesmo em pytest fail). permissions: contents: read.

  Não foi pushed ainda — vai rodar pela primeira vez no próximo PR/push tocando vision-service/**.
result: pass

### 7. Founder Smoke Procedure — `vision-service/README.md` + `.env.example`
expected: |
  ROADMAP Fase 5 Success Criterion 5 (depende deste runbook).

  vision-service/README.md (244 linhas) tem markdown checklist passo-a-passo: modal deploy → capture endpoint URL → fill MODAL_ANALYZE_ENDPOINT_URL em apps/web/.env.local → trigger reading via UI → observe webhook callback → verificar status='ready' + vision_features populado. Includes rollback notes + secret rotation.

  vision-service/.env.example tem 2 vars com inline docs: MODAL_WEBHOOK_SECRET (com `openssl rand -hex 32` cmd) e WEBHOOK_BASE_URL. Naming alinhado com modal_app.py (NÃO MODAL_WEBHOOK_URL legacy).

  Esta é a procedura QUE VOCÊ executa pra fechar a Fase 5 (Estágio 1 dogfooding). NÃO é executada agora.
result: pass

### 8. End-to-End Modal Pipeline (DEPLOYMENT-GATED)
expected: |
  ROADMAP Fase 5 Success Criterion 5 — flow completo.

  Após você executar o smoke (test 7): finalize uma reading real → readings.status transita pending → processing → ready (ou failed) sem intervenção manual → vision_features populado com SPEC §4.3 schema → StatusBadge atualiza de Processando para Pronto/Falhou.

  Este teste REQUER modal deploy + Vercel preview deploy. NÃO é executável neste UAT — flag como `blocked` com `blocked_by: deployment-gate`. Marca quando você completar o smoke procedure (test 7) e ver o flow rodar end-to-end.

  Resposta esperada: "blocked: deployment-gate — testaremos depois do modal deploy" ou "skip: separate gate".
result: blocked
blocked_by: deployment-gate
reason: "Modal deploy + Vercel preview deploy required — testar depois do smoke procedure (test 7)."

## Summary

total: 8
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 1

## Gaps

[none yet]
