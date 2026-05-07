# vision-service

Pipeline de visão computacional do Aurel Iris (Modal serverless GPU).

Contrato e arquitetura: ver `SPEC.md` §4 e `.planning/ROADMAP.md` Fase 5.

## Estrutura

- `modal_app.py` — Modal App `aurel-iris-vision` com `analyze_iris_endpoint` (FastAPI POST entry) e `run_pipeline` (worker GPU T4, SPEC §4.2).
- `pipeline/` — Etapas do pipeline:
  - `detect.py` — Detecção de íris (MediaPipe Face Mesh, indices 468-477 / 473-477).
  - `segment.py` — Segmentação (Hough circular OpenCV; U-Net pré-treinada CASIA-Iris em v1.1).
  - `compose.py` — Composição photometric stereo (3 ângulos -> 1 imagem rica).
  - `normalize.py` — Normalização polar Daugman (rubber sheet).
  - `enhance.py` — CLAHE.
  - `features.py` — Extração das features finais (SPEC §4.3 schema).
- `models/` — Pesos pré-treinados (face_landmarker.task pré-baked na imagem Modal em build time).
- `data/` — Assets versionados: `jensen-map.json` (mapa setorial Jensen pt-BR), `error_summary.json` (catálogo D-E1).
- `tests/` — Suite pytest CPU-only (sem GPU, sem Modal cloud). Rode antes de qualquer `modal deploy`.
- `.env.example` — Template de variáveis de ambiente para o worker Modal.

## Setup local (desenvolvimento)

```bash
python -m venv .venv
source .venv/bin/activate   # Linux/Mac
# .venv\Scripts\activate    # Windows
pip install -r requirements.txt
python -m pytest tests/ -v  # deve passar antes do deploy
```

---

## Smoke procedure (founder)

Manual end-to-end verification of the Modal pipeline. Run after every
`modal deploy` and after any non-trivial change to `modal_app.py` /
`pipeline/*.py` / `data/*.json`. NOT automated in CI per D-X2 (Modal cloud
runs cost real money; CI is CPU-only pytest — see `.github/workflows/vision-service-tests.yml`).

Pre-requisites:
- You have access to the Modal dashboard at https://modal.com/.
- You have access to the Supabase project (studio + dashboard).
- You have access to the Vercel project (dashboard or `vercel` CLI).
- You have a fixture reading already created in the database via the captura
  / upload UI (Phase 3 / Phase 4) with `status='pending'` and 6/6 reading_images
  rows. (Easiest: use the desktop upload at `/leituras/nova/upload`.)

### 1. Install Python deps (CPU-only, local machine)

```bash
cd vision-service
pip install -r requirements.txt
```

Verify with `python -m pytest tests/ -v` — same suite the GH Actions workflow
runs in CI. Must exit 0 before deploying.

### 2. Authenticate the Modal CLI

One-time per workstation. Get tokens from https://modal.com/settings/tokens.

```bash
modal token set --token-id <token-id> --token-secret <token-secret>
```

Confirm with `modal token current` — must print your workspace name.

### 3. Deploy the Modal app

```bash
cd vision-service
modal deploy modal_app.py
```

Capture the printed endpoint URL — looks like:

```
https://<workspace>--aurel-iris-vision-analyze-iris-endpoint.modal.run
```

Save it; you'll need it in step 4.

### 4. Set MODAL_ANALYZE_ENDPOINT_URL in Vercel

Both Production and Preview environments. Via dashboard:
- Vercel → Project → Settings → Environment Variables → Add.
- Name: `MODAL_ANALYZE_ENDPOINT_URL`
- Value: the URL from step 3.
- Environments: Production + Preview (NOT Development — local dev uses
  `apps/web/.env.local`).

Or via CLI:

```bash
vercel env add MODAL_ANALYZE_ENDPOINT_URL production
vercel env add MODAL_ANALYZE_ENDPOINT_URL preview
```

Re-deploy any pre-existing preview that needs the new URL (envs are baked in
at deploy time).

Also confirm `MODAL_WEBHOOK_SECRET` is set in BOTH:
- Vercel envs (consumed by `/api/vision/webhook`)
- Modal Secrets (consumed by `_post_webhook` in modal_app.py)

Set Modal Secrets with:

```bash
modal secret create aurel-iris-vision \
  MODAL_WEBHOOK_SECRET=<same-value-as-vercel> \
  WEBHOOK_BASE_URL=https://aurel-iris.vercel.app
```

These two values MUST be IDENTICAL, or HMAC verification will reject the
callback with 401 (visible in Vercel logs as `[webhook] HMAC rejected: mismatch`).

### 5. Trigger one fixture reading

Get a session cookie:
1. Open the deployed Vercel preview URL in a browser.
2. Sign in via magic link.
3. Open DevTools → Application → Cookies → copy the `sb-...-auth-token` cookie value (and any related Supabase auth cookies — copy the whole header from a request in the Network tab for safety).

POST to the trigger route with the reading_id from your fixture:

```bash
curl -X POST \
  "https://<vercel-preview>/api/readings/<reading_id>/process" \
  -H "Cookie: <paste-the-cookies-here>" \
  -i
```

Expected response: HTTP 202 with empty body.

If you get 401 → cookie copy-paste was incomplete; retry.
If you get 404 → reading is not owned by the signed-in user OR not in
`pending`/`failed` status; pick a different fixture.
If you get 502 → Modal trigger failed; see the Vercel logs for the
`[process] error: ...` line and check that `MODAL_ANALYZE_ENDPOINT_URL`
matches the URL from step 3.

### 6. Observe the webhook callback

Stream Vercel logs (in another terminal):

```bash
vercel logs <project-name> --follow
```

Or in the dashboard: Project → Deployments → (latest) → Functions → `/api/vision/webhook`.

Within ~30-90s of the trigger (cold-start dependent — D-F3) you should see:

```
[process] reading=<id> status=processing call_id=fc-...
[webhook] applied reading=<id> status=ready call_id=fc-...
```

If you see `[webhook] applied ... status=failed` instead → the pipeline ran
but produced an error. Check `processing_metadata.error_summary` in step 7
against the D-E1 catalog (`vision-service/data/error_summary.json`).

### 7. Validate the result in Supabase

Open Supabase studio → SQL editor:

```sql
SELECT
  id,
  status,
  processed_at,
  vision_features
FROM readings
WHERE id = '<reading_id>';
```

Verify the result against SPEC §4.3:

- [ ] `status = 'ready'` (or `'failed'` if the pipeline classified the
      fixture as failed — also a valid path, but check error_summary then).
- [ ] `processed_at` is set to a recent timestamp (within the last few minutes).
- [ ] `vision_features.right_eye` is an object (or null if D-F1 unilateral
      degradation occurred — check `asymmetry_notes`).
- [ ] `vision_features.left_eye` similarly.
- [ ] `vision_features.right_eye.constitution.primary` is one of
      `linfatica | hematogenica | mista | indeterminada` (per SPEC §4.3 enum).
- [ ] `vision_features.right_eye.iris_color.primary` is a pt-BR string.
- [ ] `vision_features.right_eye.sectors` is an array of 12 entries
      (hours 1-12).
- [ ] `vision_features.right_eye.sectors[i].zones` strings come from
      `vision-service/data/jensen-map.json` (no ad-hoc strings).
- [ ] `vision_features.processing_metadata.model_version` matches the
      version baked into the deployed modal_app (`pipeline_<X.Y.Z>`).
- [ ] `vision_features.processing_metadata.modal_call_id` is the same
      `fc-...` from the Vercel log line.
- [ ] `vision_features.processing_metadata.stages_timing_ms` has 6 keys
      (one per stage: detect/segment/compose/normalize/enhance/features).

If all checkboxes pass → smoke green. Document the run date + reading_id in
your dogfooding journal.

### Architectural floor (LGPD)

The Modal worker container does NOT receive Supabase service-role
credentials. It receives only time-limited signed URLs (TTL=600s per D-T6)
for the 6 input images and POSTs results back via HMAC-signed webhook. If
a future change adds Supabase credentials to the Modal image / Modal
Secrets, that's a privilege-escalation regression and must be reverted.
See `.planning/phases/05-pipeline-visao-modal/05-CONTEXT.md` D-T6 and
`05-RESEARCH.md` Anti-Patterns table.

### Re-running the smoke after every redeploy

Steps 5-7 are the standing acceptance test. Steps 1-4 only repeat when:
- You change `requirements.txt` (re-install).
- You change `modal_app.py` or `pipeline/*.py` (re-deploy → new endpoint URL → repeat step 4).
- You add/rotate the HMAC secret (re-set in BOTH Vercel + Modal Secrets).

### Rollback notes

If a deploy introduces a regression:

**Rollback Modal app:**
```bash
# List previous deployments
modal app history aurel-iris-vision

# Modal does not support direct rollback — re-deploy the previous commit:
git checkout <previous-commit> -- vision-service/
modal deploy vision-service/modal_app.py
```

**Rotate MODAL_WEBHOOK_SECRET (if compromised):**
1. Generate a new secret: `openssl rand -hex 32`
2. Update Vercel env: Vercel dashboard → Settings → Environment Variables → edit `MODAL_WEBHOOK_SECRET`.
3. Update Modal Secrets: `modal secret create aurel-iris-vision MODAL_WEBHOOK_SECRET=<new-value> WEBHOOK_BASE_URL=<url>` (this replaces the existing secret).
4. Re-deploy both Vercel (trigger a new deployment) and Modal (`modal deploy modal_app.py`).
5. Re-run smoke steps 5-7 to confirm HMAC handshake works with the new secret.

**If WEBHOOK_BASE_URL changes** (e.g., new Vercel project name):
- Update Modal Secrets: `modal secret create aurel-iris-vision WEBHOOK_BASE_URL=<new-url>` (preserves other vars).
- Re-deploy Modal app: `modal deploy modal_app.py`.
- Smoke step 6 confirms callbacks reach the new URL.

---

## RAG Ingestion (Phase 6)

A Fase 6 indexa o acervo iridológico do fundador (18 PDFs/DOCX em `D:\Projetos\Iridologista\livros\`, 12 ativos após `skip` no manifest) em `knowledge_chunks` para retrieval pelo pipeline LLM da Fase 7. O ingest pipeline roda como script Python standalone dentro de `vision-service/` (reusa o ambiente Python já configurado para Modal); o lado de retrieval (`retrieveRelevantKnowledge`) vive em `apps/web/lib/rag/`.

Estado atual (v1, ingest final 2026-05-05): **2761 chunks across 12 source books**, 91% com prefixo `[Contexto:]` (D-N1 ativo), custo total ~US$ 3.70 (Voyage US$ 0.16 + Anthropic Contextual US$ 3.59).

### Quick reference

| Comando | Propósito |
|---------|-----------|
| `pnpm rag:ingest` | Full ingest do acervo ativo (D-N1 Contextual Retrieval ON por padrão; ~US$ 3-5 com 1h-TTL prompt cache) |
| `pnpm rag:ingest --no-contextual` | Ingest sem D-N1 (modo de inspeção barato, ~US$ 0.20 total — pula chamada Anthropic) |
| `pnpm rag:ingest --dry-run` | Estima chunk counts + custo sem chamar APIs (Voyage e Anthropic) |
| `pnpm rag:ingest --book "<source_book>"` | Roda um livro específico (chave canônica em `vision-service/scripts/data/books_manifest.json`) |
| `pnpm rag:ingest --limit-chunks 50` | Smoke-test (processa os primeiros 50 chunks e para) |
| `pnpm rag:purge --book "<source_book>"` | DELETE all chunks for one book (D-I2 — pre-condição para re-ingest) |
| `pnpm rag:spot-check` | UAT smoke — 3 cenários hardcoded (lacuna setor 7, anel tensão, cross-language linfática) imprimindo top-5 chunks |
| `pnpm audit:vocabulary:db` | LGPD audit no DB — varre `metadata.tags_livres` em `knowledge_chunks` por vocabulário proibido |
| `cd vision-service && python -m scripts.audit_vocabulary` | LGPD audit no acervo (Python — varre `pipeline/`, `data/`, `scripts/`, `tests/`, `scripts/data/`) |
| `pnpm audit:vocabulary` | LGPD audit no front (varre `apps/web/{app,components,lib/rag}`) |

> **Mode-mismatch protection:** se o DB já tem chunks contextualizados (D-N1 ON) e você roda `pnpm rag:ingest --no-contextual` (ou vice-versa), o script **aborta** e exige `--purge` antes. Idempotência via `content_hash` SHA256 não detectaria essa transição (o hash inclui o prefixo `[Contexto:]`), então a guarda explícita evita corpus misto.

### Required environment variables

Defina no `.env.local` (NÃO em `.env` — esse é git-tracked) na raiz do repo. Variáveis lidas pelo script Python (via `python-dotenv`) e pelo Node fetch client.

| Variável | Propósito | Origem |
|----------|-----------|--------|
| `VOYAGE_API_KEY` | Embedding (`voyage-3`, dim 1024) + Reranking (`voyage-rerank-2.5`) | https://dash.voyageai.com/api-keys |
| `ANTHROPIC_API_KEY` | D-N1 Contextual Retrieval (Haiku 4.5 com prompt caching 1h-TTL) — NÃO necessária com `--no-contextual` | https://console.anthropic.com/settings/keys |
| `SUPABASE_URL` (ou `NEXT_PUBLIC_SUPABASE_URL`) | URL do projeto Supabase | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role para INSERT (bypass RLS no `knowledge_chunks`) | Supabase Dashboard → Settings → API → `service_role` (NUNCA commit; key começa com `eyJ`) |
| `RAG_SPOT_CHECK_TOKEN` | Token-bearer para `/api/admin/rag-spot-check` Route Handler (gate fail-closed; 403 se env unset) | Gere com `openssl rand -hex 32` e adicione em `.env.local` + Vercel env |
| `VOYAGE_RERANK_MODEL` (opcional) | Override do modelo de rerank (default `voyage-rerank-2.5`; fallback de custo `voyage-rerank-2.5-lite`) | — |
| `RAG_INGEST_DEBUG_CACHE` (opcional) | Quando setado para `1`, loga buckets de tokens (input / cache_creation / cache_read / output) por chunk — útil para auditar custo Anthropic em real-time | — |

**Validação shape:** o script faz uma checagem defensiva no `SUPABASE_SERVICE_ROLE_KEY` exigindo prefixo `eyJ` (todos JWTs do Supabase começam assim). Anon keys também começam com `eyJ`, mas se você tiver copiado errado o script vai falhar mais à frente com 401 — re-confira pegando a `service_role` (não a `anon`).

### Cost guards

- **D-G1: Voyage embedding hardcap = US$ 5.** Definido em `vision-service/scripts/lib/budget.py` (`VoyageBudgetGuard.HARDCAP_USD`). Pricing `voyage-3` a US$ 0.06 / 1M tokens. Script aborta (exit code 2) se o running total ultrapassar US$ 5; alertas em US$ 1 / US$ 2 / US$ 3 / US$ 4. Custo real do v1 Voyage: ~US$ 0.16 (~3M tokens), 31× abaixo do cap.
- **D-N1: Contextual Retrieval hardcap = US$ 15** (`ContextualBudgetGuard.HARDCAP_USD`). Pricing Haiku 4.5: input US$ 0.80 / cached_read US$ 0.08 / cached_creation_5min US$ 1.00 / cached_creation_1h US$ 1.60 / output US$ 4.00 (todos por 1M tokens). 5-bucket accounting (`input` + `cache_creation` + `cache_read` + `output`, com split entre 5min e 1h cache writes quando o SDK expõe). Custo real do v1 Anthropic: ~US$ 3.59 (98% cache hit rate por causa do TTL 1h). Para auditar em real-time: `RAG_INGEST_DEBUG_CACHE=1 pnpm rag:ingest`.
- **Reconciliação:** total reportado pelo script vem do campo `total_tokens` da resposta Voyage (métrica autoritativa de billing). Comparar com https://dash.voyageai.com/billing — deve bater dentro de ~5%. Para Anthropic, comparar com https://console.anthropic.com/settings/usage.
- **Idempotência:** re-runs são seguros. `content_hash = sha256(text.strip())` (computado sobre o texto original do chunk, NÃO sobre o prefixo `[Contexto:]` — o prefixo gerado por Haiku é não-determinístico, então incluí-lo no hash quebraria idempotência). Insert usa `ON CONFLICT (content_hash) DO NOTHING`. Se o hardcap disparar no meio de uma run, basta re-rodar — chunks já indexados são pulados (server-side via PostgREST `Prefer: resolution=ignore-duplicates`).
- **Hardcap aborted recovery:** revise os logs para identificar qual livro queimou o orçamento (linhas estruturadas `[ingest] chunk N/M | tokens X | est_cost $Y | book "Z"` a cada 10 chunks). Para subir o cap permanentemente, edite `HARDCAP_USD` em `vision-service/scripts/lib/budget.py`. Para isolar um livro problemático, rode com `--book "X"` apenas. Para reduzir custo agudo, rode com `--no-contextual` (corta o gasto Anthropic; preserva D-N2 reranking que vive no apps/web).

### Re-ingestion procedure (D-I2)

Quando a estratégia de chunking de um livro mudar, ou quando a extração saiu errada (PDF mal extraído, OCR ruim em scan), use o ciclo `purge → ingest`:

```bash
# 1. Purge as linhas existentes
pnpm rag:purge --book "Bernard Jensen Iridology Simplified"

# 2. Re-ingest com chunker + extractor atuais
pnpm rag:ingest --book "Bernard Jensen Iridology Simplified"

# 3. Verificar contagem nova
psql "$DATABASE_URL" -c "select count(*) from knowledge_chunks where source_book = 'Bernard Jensen Iridology Simplified';"
```

Para re-ingest do corpus inteiro (raro — só se o critério de chunking mudou globalmente):

```bash
psql "$DATABASE_URL" -c "DELETE FROM knowledge_chunks WHERE source_type='biblioteca';"
pnpm rag:ingest
```

> **v1 limitation:** os campos `metadata.dimensoes`, `setores_referenciados`, `sinais_referenciados`, `constituicao_referenciada` e `tags_livres` ficam como **arrays vazios** (`[]`) após o ingest. O multiplier D-R4 `dimensoes intersect 1.2×` em `apps/web/lib/rag/score-weights.ts` depende desses campos populados; enquanto vazios, o multiplier é **inerte** (no-op), e a ordenação do retrieval é dominada por cosine + Contextual Retrieval (D-N1, prefixo `[Contexto:]`) + Reranking (D-N2 `voyage-rerank-2.5`) + `alta_prioridade 1.1×` (D-R4 multiplier ativo via `ALTA_PRIORIDADE_BOOKS` em `apps/web/lib/rag/search.ts`) + `clinical_data 1.5×` (D-R4 multiplier ativo mas sem dados Fase 10). A vocabulary tagging que ativaria o terceiro multiplier (D-T1..T6) é uma **operação separada**, **fora de escopo do v1**, planejada para uma Fase 6.1 pós-MVP. **Não confunda o estado de arrays vazios com bug.**

### Post-ingest tagging (D-T1)

O script de ingest grava chunks com metadata arrays vazios:

```json
{
  "constituicao_referenciada": [],
  "setores_referenciados": [],
  "sinais_referenciados": [],
  "dimensoes": [],
  "tags_livres": []
}
```

A vocabulary tagging (D-T2 constituições, D-T3 setores `h{N}`, D-T4 sinais, D-T5 dimensões + escola_origem, D-T6 dúvida → null/[] strictness) acontece em uma **sessão Claude Code separada** — NÃO dentro de `ingest_knowledge.py`. O fundador + Claude pareiam revisando chunks em batches, aplicando os vocabulários canônicos em `vision-service/scripts/data/vocabularies.json` e a referência de sinais em `vision-service/data/jensen-reference.md`. O output é um JSONL `{chunk_id, metadata_updates}` aplicado via UPDATE batch SQL.

Isto é **by design** (D-T1):
- Reproduzibilidade não é prioridade (a biblioteca não escala — 18 livros é o teto previsto)
- Sessão Claude Code (Sonnet 4.6/4.7) suporta validação founder em real-time, ajuste interativo
- Custo zero adicional além da assinatura Claude Code
- A operacionalização do tagging update script (lê JSONL, batches UPDATEs com retries) é deferida para Fase 6.1 (pós-MVP); até lá o fundador roda UPDATEs ad-hoc.

### Spot-check / Founder UAT

```bash
# Pre-requisito: defina RAG_SPOT_CHECK_TOKEN no .env.local da raiz
# E na Vercel env (production + preview), ou rode localmente com `pnpm dev` rodando em paralelo.

pnpm rag:spot-check
```

Roda 3 cenários hardcoded contra `/api/admin/rag-spot-check` (Route Handler em `apps/web/app/api/admin/rag-spot-check/route.ts`, com gate fail-closed via `RAG_SPOT_CHECK_TOKEN`):

1. **Lacuna setor 7 (fígado)** — Success Criterion 5 do PHASE plan; top-5 deve ser fígado/lacuna em obras clássicas
2. **Anel de tensão psicoemocional** — top-5 deve cobrir Lo Rito + Jensen + Psicoterapêutica
3. **Cross-language linfática** — top-5 deve mesclar pt-BR + en + es (Voyage `voyage-3` é multilíngue)

Saída: JSON prettificado com top-5 chunks de cada cenário (text, source_book, score, metadata). Founder qualifica relevância manualmente.

### Quick troubleshooting

**`VOYAGE_API_KEY is not set` ou `ANTHROPIC_API_KEY is not set`:** defina em `.env.local` (NÃO em `.env`), depois `source .env.local` antes de rodar (ou exporte na shell). `.env` é git-tracked; `.env.local` é git-ignored.

**`SUPABASE_SERVICE_ROLE_KEY appears malformed (no eyJ prefix)`:** o key está errado — JWTs service-role começam SEMPRE com `eyJ`. Você provavelmente copiou o anon key. Pegue o correto em Supabase Dashboard → Settings → API → `service_role` (nunca commit este key).

**`HARD CAP REACHED — $5.00 spent`:** o script abortou no Voyage hardcap. Re-run é idempotente — `pnpm rag:ingest` de novo pula chunks já indexados via `content_hash`. Se um único livro queimou US$ 5 (improvável a US$ 0.06/1M), suba o cap em `vision-service/scripts/lib/budget.py` ou rode com `--no-contextual` (corta gasto Anthropic; Voyage cost stays).

**`HARD CAP REACHED — $15.00 spent` (D-N1 Contextual):** mesma lógica para o budget Anthropic. Verifique cache hit rate nos logs (`RAG_INGEST_DEBUG_CACHE=1`) — se < 80%, algo está errado (TTL configurado para 1h via `cache_control={'type':'ephemeral','ttl':'1h'}`; book longo + Tier 1 50K TPM throttling pode esticar processamento além de 1h e forçar re-creations). Suba o cap em `budget.py` ou rode com `--no-contextual`.

**`mode mismatch: corpus has [Contexto:] prefixes but --no-contextual was passed (or vice-versa)`:** o script detecta corpus misto e exige `--purge` antes. Faça `pnpm rag:purge --book "X"` e re-ingest no modo desejado, ou para o corpus inteiro: `psql -c "DELETE FROM knowledge_chunks WHERE source_type='biblioteca';"`.

**`voyage embed failed after 3 retries` ou Anthropic `503`/`429`:** API estava down ou rate-limited (Voyage Tier 1 throughput, Anthropic Tier 1 50K TPM). Retry exponencial backoff já tentou 3× (1s/4s/16s). Re-run; idempotência cuida.

**Spot-check retorna chunks estranhos para uma query óbvia:** check (1) a flag `alta_prioridade` no `books_manifest.json` — livros errados sendo boostados? (2) `ALTA_PRIORIDADE_BOOKS` em `apps/web/lib/rag/search.ts` precisa espelhar `alta_prioridade=true` do manifest (test `search.test.ts` valida o drift; falha loud se drift). (3) Coverage D-N1: chunks sem `[Contexto:]` perdem ~35% recall — verifique `select count(*) filter (where content like '[Contexto:]%') / count(*)::float from knowledge_chunks where source_type='biblioteca';` (deve estar ≥ 0.80).

**Latência p95 > 2s em produção:** check `hnsw.ef_search` no DB (default 40 após migration 0006 — original 100 foi removido por incompatibilidade `STABLE` function + `SET LOCAL`). Para subir recall ao custo de latência, aplique `ALTER DATABASE postgres SET hnsw.ef_search = 100;` (DB-level, persistente; STABLE functions honram). Reverter: `ALTER DATABASE postgres RESET hnsw.ef_search;`.

**`Unauthenticated` em `/api/admin/rag-spot-check`:** `RAG_SPOT_CHECK_TOKEN` env não setado OU header `Authorization: Bearer <token>` não bate. O Route Handler é fail-closed: 403 se env unset, 403 se token mismatch. Confirme `echo $RAG_SPOT_CHECK_TOKEN` (ou `$env:RAG_SPOT_CHECK_TOKEN` no PowerShell) bate com o setado em `.env.local` da Vercel.

### Phase 6 acceptance gates

Antes de marcar Fase 6 como completa:
- [x] `cd vision-service && python -m pytest tests/ -v` exits 0 (245 passed / 4 skipped — mediapipe model + segment fixture)
- [x] `pnpm --filter web test:run` lib/rag/ green (45 passed across 5 files; pre-existing Phase 3 quality-scoring out-of-scope per STATE.md "Itens diferidos")
- [x] 3 LGPD audits green (`pnpm audit:vocabulary` + `cd vision-service && python -m scripts.audit_vocabulary` + `pnpm audit:vocabulary:db`)
- [x] `psql -c "select count(*) from knowledge_chunks where source_type='biblioteca';"` retorna 2761 (≥1000 acceptance — RAG-03)
- [x] `select count(distinct source_book) from knowledge_chunks where source_type='biblioteca';` retorna 12 (≥10 acceptance — RAG-03)
- [x] `[Contexto:]` prefix coverage ≥ 80% (atual: 91% = 2505/2761 — D-N1 ativo)
- [x] Founder UAT em `.planning/phases/06-rag-ingestao/06-UAT.md` signed off (5/5 PASS, 2026-05-05)
- [x] Migrations 0005 + 0006 aplicadas (`grep -c content_hash apps/web/types/database.ts` retorna ≥ 1; migration 0006 dropped `SET LOCAL` from STABLE function)
- [ ] `/gsd-verify-work 6` passa (pendente — próximo passo após este plan)
