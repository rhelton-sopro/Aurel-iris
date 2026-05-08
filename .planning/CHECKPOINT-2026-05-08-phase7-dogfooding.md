# Checkpoint Phase 7 dogfooding — 2026-05-08 ~22h00

> Salvo antes do session restart pra recuperar contexto. Próxima sessão: faz `/gsd-resume-work` ou lê este arquivo.

## TL;DR onde paramos

Phase 7 fechada no GSD (12/12 plans). Hoje fui em prod e descobri que **Phase 5 (vision pipeline) nunca tinha sido configurada em produção**. Cascata de 14+ commits pra fazer funcionar:

- ✅ Modal env vars (`MODAL_*`)
- ✅ Image build deps (libgles2, libegl1, libgthread, fastapi, wget, opencv runtime)
- ✅ Modal Secret + WEBHOOK_BASE_URL
- ✅ Mount pipeline/ + data/ na image
- ✅ Hybrid detection (MediaPipe → Hough fallback) — fechamos quando MediaPipe falhou em close-ups de íris
- ✅ Hough downscale 4K→1024 pra caber em 120s timeout
- ✅ Hough radius 12-30% + center-most circle
- ✅ Pipeline produziu primeiro `status: ready` da sessão!
- ✅ Webhook chain Modal → Vercel funcionando (HMAC, status=200)

## Onde TRAVAMOS no fim da sessão

**Phase 7 LLM (Sonnet) ainda não rodou end-to-end.** Sequência de erros 500 no `/api/readings/[id]/analyze`:

1. ✅ Fix: contract mismatch `constitution: string` vs `{ primary }` — commit `0fbd1b4`
2. ⏳ **Erro atual quando paramos**: `VOYAGE_API_KEY is not set` em prod Vercel — RAG retrieval falha
   - Usuário disse que adicionou no Vercel + redeploy
   - Não confirmamos se LLM streaming funcionou após o redeploy

## Próximo passo imediato (5 min)

1. Confirma que VOYAGE_API_KEY está no Vercel produção
2. Aguarda redeploy completar (se ainda estiver buildando)
3. Vai em `/leituras/{id-da-leitura-ready}` (id `71a7bf1d-747f-4de8-9129-13b69197c6a4`)
4. Clica "Gerar análise"
5. Espera streaming aparecer

**Se aparecer streaming** → Phase 7 destravada de verdade pela primeira vez. Cola as primeiras palavras pra confirmar (tem ancoragem `[features.X]`? Linguagem hipotética? Disclaimer no fim?)

**Se outro 500** → vai ser outra env var faltando. Lista candidata (compara com `.env.local` e mete tudo que não está no Vercel):
- `ANTHROPIC_API_KEY` (CRÍTICA — Sonnet não roda sem)
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (já devem estar)

## Bugs que ainda preciso testar/calibrar (médio prazo)

### 1. Hough achando círculo errado
Logs mostraram `r=1210-1360` numa 3088x2316 — quase 80% da imagem. Setei radius range pra 12-30% no commit `0446d76` mas não validamos se em fotos reais agora pega íris real (raio ~150-300) vs globo ocular. Próxima leitura `ready` → SQL `SELECT vision_features` e olhar se `iris_circle.r` ficou plausível.

### 2. VLM Haiku confunde nitidez
Round 14 do prompt (`293edaf`) explicitou "íris é o que importa, skin/cílios podem estar fora de foco". Teste de captura nova: tirar foto típica iridologia (DOF rasa, íris nítida, pele blur) → VLM deve dar "boa" ou "excelente", não "borrado".

### 3. Persistência de intermediate stages
TODO `8980ffb` em `.planning/todos/pending/2026-05-08-persist-pipeline-intermediate-stages.md` — adicionar uploads de `segmented_image`, `normalized_polar`, `composed_iris` pro Supabase Storage. Crucial pra Fase 10 + auditoria. Implementar SÓ depois do pipeline produzir features clinicamente corretos (calibragem do Hough OK).

### 4. Quality-scoring stale tests
TODO `bfd84bd` em `.planning/todos/pending/2026-05-08-fix-stale-quality-scoring-test.md` — 3 falhas pre-existing em `quality-scoring.test.ts`. Phase 3 debt, baixa prioridade.

## Memórias salvas (auto-memory) hoje

- `feedback_quality_scoring_test_gate.md` — noise filter pros 3 known fails
- `feedback_orchestrator_cwd_drift.md` — sempre `cd D:/Projetos/Iridologista &&` em git ops
- `feedback_gsd_tools_commit_filters_planning.md` — `gsd-tools.cjs commit` ignora source files; usar `git commit` direto
- `feedback_run_lint_before_push.md` — `next build` roda eslint como gate; rodar `pnpm --filter web lint` antes de push grande

## Estado git no fim da sessão

- Branch: `main`
- Origin: pushado até `0fbd1b4` (analyze contract fix)
- Vercel: rebuilding com último push
- Modal: deployado com `0446d76` (Hough tightened)
- DB: leitura `71a7bf1d-747f-4de8-9129-13b69197c6a4` em status `ready`

## Statusline restart

Configurada em `0446d76`-equivalente em `.claude/settings.local.json` mas só aplica após session restart. Quando reabrir, deve aparecer `ctx:N%` colorido + modelo + diretório + branch.

## Commits desta sessão (timeline)

```
0fbd1b4 fix(analyze): normalize pipeline features to RAG shape
0446d76 fix(detect): tighten Hough radius + prefer center-most circle
8980ffb docs(todo): persist pipeline intermediate stages
897988c perf(vision-service): downscale before Hough to fit 120s function timeout
de5a368 feat(vision-service): hybrid MediaPipe + Hough Circle iris detection
d373fde fix(vision-service): defensive None check in _post_webhook
374a32f fix(vision-service): add libgles2 + libegl1 for MediaPipe runtime
8dbd219 fix(vision-service): add observability to _post_webhook
293edaf fix(capture/validate): VLM prompt round 14 — íris-only sharpness
01f1009 fix(vision-service): attach modal.Secret to run_pipeline
9e4cb63 fix(process/route): surface actual Modal error message
ea88183 fix(modal-client): bump timeout 10s → 30s
7dc9441 fix(vision-service): mount pipeline/ + data/ into Modal image
739e6de fix(vision-service): add OpenCV runtime libs to Modal image
2d85196 fix(capture/validate): VLM prompt round 13 — relax muito_longe
3fd5fec fix(build): resolve 2 type errors blocking Vercel deploy
28625fc fix(vision/webhook): silence eslint no-explicit-any in test mock
bdd623e (commit equivocado, ignorável)
... +4 commits anteriores fechando Phase 7 propriamente (75b2905, 1806e34, 1eb094c, d7fc340, 8854a5b)
```

## Arquivo de retomada

Este arquivo + auto-memories + git log = contexto completo. Próxima sessão: começa com `/gsd-resume-work` ou apenas leia este arquivo + `git log --oneline -30`.
