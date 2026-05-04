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
