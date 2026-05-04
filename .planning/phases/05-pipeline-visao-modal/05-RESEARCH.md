# Phase 5: Pipeline de visão (Modal) - Research

**Researched:** 2026-05-03
**Domain:** Computer vision pipeline (Modal serverless GPU), Next.js 15 webhook, Python/OpenCV/MediaPipe, HMAC security
**Confidence:** HIGH (core stack verified), MEDIUM (CV algorithm parameters), LOW (a few upstream SDK caveats)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Trigger e fluxo de chamada do Modal:**
- D-T1: `analyze_iris` chamado via `app/api/readings/[id]/process/route.ts` (a criar). `finalizeReadingAction` chama rota após persistir 6 imagens; rota usa Modal `.spawn()`, atualiza `readings.status='processing'` e retorna 202.
- D-T2: Após `finalizeReadingAction` + dispatch, redirect imediato para `/leituras`. Sem polling client-side.
- D-T3: Botão `Reprocessar` para `status='failed'` faz POST na mesma rota. Sem auto-retry server-side.
- D-T4: Webhook handler só aplica payload se `status='processing'` (status guard de idempotência).
- D-T5: Trigger persiste `modal_call_id` em `readings.vision_features = { processing_metadata: { modal_call_id: '...' } }` ANTES do `.spawn()`.
- D-T6: Signed URLs com `expiresIn: 600` segundos (10 min TTL).

**Comportamento em falha:**
- D-F1: Per-eye soft degradation — pipeline continua se ao menos 1 olho processável. `status='failed'` só quando nenhum olho produz saída mínima.
- D-F2: Badge vermelho `Falhou` + tooltip com `error_summary` em pt-BR.
- D-F3: Cold-start aceito (~10–30s), sem `keep_warm`.
- D-F4: Idempotência por status guard (D-T4) aplicada também ao webhook `failed`.
- D-F5: Webhook atualiza `vision_features`, `status`, `processed_at` em um único UPDATE.

**Mapa setorial Jensen:**
- D-J1: `vision-service/data/jensen-map.json` como fonte canônica. Comitado no repo, redeploy ao mudar.
- D-J2: Strings das zonas em pt-BR. Auditável via `pnpm audit:vocabulary`.
- D-J3: Fonte autoritativa Jensen Vol. 1 1982 pt-BR. Founder valida draft.
- D-J4: Estrutura por olho separado `{map_name, right: {hour: [zones]}, left: {hour: [zones]}}`.

**Testes por etapa:**
- D-X1: ~6–10 fotos de íris do founder em `vision-service/tests/fixtures/iris/`. CONSENT.md obrigatório.
- D-X2: pytest local CPU + GH Actions. Sem GPU, sem Modal cloud em CI.
- D-X3: Assertion híbrida — structural + 1 métrica numérica por fixture.
- D-X4: Fixtures commitadas (~3–5 MB), sem LFS. Repo privado até LGPD review.

**Schema `processing_metadata`:**
- D-PM1: `model_version` (semver `pipeline_0.1.0`), `processing_time_ms`, `modal_call_id`, `stages_timing_ms`, `warnings[]`, `error_summary`.
- D-PM2: Atomic write no webhook.

**Catálogo error_summary (pt-BR, LGPD-compliant):**
- D-E1: 5 strings autoritativas (ver CONTEXT.md).

**Asymmetry notes:**
- D-A1: pt-BR snake_case — ex: `lacuna_unilateral_setor_7_direito`, `cor_assimetrica_castanho_direito_azul_esquerdo`.
- D-A2: Lista vazia é estado válido.

### Claude's Discretion

- Estrutura interna de `vision-service/pipeline/` (helpers adicionais, `iris_maps.py`, etc.)
- Forma exata da assinatura HMAC (header name, hex vs base64, body signing)
- Payload do webhook (inline vs ref — recomendação: inline 50KB)
- Parâmetros exatos de HoughCircles, CLAHE, HSV clustering
- Implementação de photometric compose (weighted average vs albedo)
- Formato da `daugman_polar` (resolução, interpolação)
- CI matrix (Python 3.11 only vs 3.11+3.12)
- Logging strategy no Modal worker (`print()` vs structlog)
- Badge e tooltip rendering no `/leituras`

### Deferred Ideas (OUT OF SCOPE)

- Polling client-side / Supabase Realtime / push notifications
- Tela de detalhe `/leituras/[id]`
- `keep_warm` Modal
- Auto-retry server-side
- U-Net pré-treinada CASIA-Iris
- CNN própria para lacunas/criptas
- Multi-mapa Jensen + Jausas + Hidalgo
- Modal CI integration test
- Snapshot/golden tests
- Modal volume para artefatos intermediários
- Edição manual de features pelo terapeuta

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VISION-01 | Repositório `vision-service` com Modal app `@app.function(image=image, gpu="T4", timeout=120)` expondo `analyze_iris(reading_id, image_urls)` | Modal SDK 1.4.2 verificado no pip registry; skeleton existe em `vision-service/modal_app.py`; seção Standard Stack detalha image build |
| VISION-02 | Pipeline executa `detect → segment → compose → normalize → enhance → features` com MediaPipe, Hough OpenCV, heurísticas OpenCV, HSV clustering | Skeletons verificados em `vision-service/pipeline/`; seções de parâmetros de cada estágio documentadas |
| VISION-03 | JSON conforme SPEC §4.3: `right_eye`, `left_eye`, `constitution`, `iris_color`, `fiber_density`, `collarette`, `pupil`, `sectors[]`, `rings`, `global_signs`, `image_quality`; `asymmetry_notes`, `processing_metadata` | Pydantic v2 `IrisFeatures` model documentado; contrato JSON completo em Code Examples |
| VISION-04 | `triggerVisionPipeline(reading_id)` + webhook HMAC em `app/api/vision/webhook/route.ts` gravando `vision_features` com `status='ready'`/`'failed'` | Modal JS SDK spawn pattern; HMAC-SHA256 Stripe/GitHub-style; Supabase `createSignedUrl` verificado |

</phase_requirements>

---

## Summary

Phase 5 builds the full computer vision pipeline that transforms 6 iris images into the canonical JSON features object stored in `readings.vision_features`. The phase has two distinct implementation surfaces: (1) the Python `vision-service` running on Modal serverless GPU T4, and (2) the Next.js 15 integration layer (trigger route + webhook handler).

**Critical architectural finding on Modal invocation from Next.js:** The JavaScript `modal` npm package (v0.7.4, latest April 2026) explicitly states that `spawn()` is "coming soon" and not yet available in the JS SDK. The correct 2026 pattern is to expose `analyze_iris` via a Modal `@modal.fastapi_endpoint` (a FastAPI web endpoint), call it from Next.js using standard `fetch()` with `Modal-Key`/`Modal-Secret` proxy auth headers, and have the endpoint return `{"call_id": call.object_id}` synchronously. The vision-service side uses `.spawn()` internally in Python and returns the `call_id` to the caller. This pattern is verified in the official Modal `doc_ocr_webapp` example.

**For MediaPipe in the server pipeline:** The new Tasks API (`mp.tasks.vision.FaceLandmarker`) is the correct API for server-side Python. Iris landmarks 468–477 (left iris: 468–472, right iris: 473–477) are produced when the model is the `face_landmarker.task` model (not legacy solutions API). The `refine_landmarks=True` equivalent in the Tasks API is automatic — the `face_landmarker.task` model always outputs 478 landmarks including iris landmarks.

**Primary recommendation:** Implement the trigger as a `POST /api/readings/[id]/process` Next.js route that calls the Modal web endpoint via `fetch()` with proxy auth headers, receives `call_id` back, writes it to `processing_metadata`, and returns 202. The Modal `analyze_iris` function uses `modal.current_function_call_id()` internally and POSTs the full features JSON to the Next.js webhook on completion.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Trigger pipeline | API / Next.js Route | — | Server-side only; MODAL_TOKEN_ID/SECRET must not reach browser |
| HMAC webhook receive | API / Next.js Route | — | Validates Modal-to-Next.js callback; needs raw body access |
| `readings.status` update | API / Next.js Route | — | RLS bypass via service role; only webhook knows when done |
| Image download + CV processing | Modal GPU Worker | — | HeavyCompute; GPU-dependent; Python-only stack |
| Signed URL generation | API / Next.js Route | — | Requires Supabase service role; 10-min TTL window |
| Badge rendering (`Processando`/`Pronto`/`Falhou`) | Browser / Client | Frontend (SSR) | Server component renders from DB status; no client polling |
| Jensen map lookup | Modal GPU Worker | — | JSON asset read at pipeline init; no network call needed |
| JSON schema validation (output) | Modal GPU Worker | API webhook | Pydantic in worker + Zod shape-check in webhook handler |

---

## Standard Stack

### Core (Python — vision-service)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| modal | 1.4.2 | Serverless GPU deployment + web endpoint | Only serverless GPU platform with Python SDK + web endpoints |
| opencv-python-headless | 4.13.0.92 | HoughCircles, CLAHE, morphology, color ops | Industry standard CV; headless avoids X11 deps in container |
| mediapipe | 0.10.35 | Iris landmark detection (Face Landmarker Tasks API) | Google's solution; 478 landmarks including iris indices 468–477 |
| numpy | >=1.26.0 | Array ops throughout pipeline | Canonical numerical Python |
| scikit-image | >=0.24.0 | Image quality metrics, polar warp support | Useful for skimage.transform.warp in Daugman transform |
| torch | 2.11.0 | Reserved for future U-Net (v1.1); locked in image | Already in skeleton; needed for T4 GPU allocation |
| Pillow | >=10.4.0 | Image decode/resize from URL bytes | Handles JPEG, PNG, HEIC outputs from storage |
| pydantic | 2.13.3 | Output schema validation (`IrisFeatures` model) | v2 is current; `model_validate` pattern for contract enforcement |
| pytest | >=8.0 | Unit tests per stage (D-X2) | Standard Python test runner |
| requests / httpx | latest | HTTP GET for signed URLs inside Modal worker | Simple URL fetching (no Supabase credentials needed) |

> [VERIFIED: pip registry 2026-05-03] — all versions confirmed via `pip index versions`.

### Core (TypeScript — Next.js trigger + webhook)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.105.1 | `createSignedUrl` for Storage + service-role UPDATE in webhook | Already installed (project package.json verified) |
| zod | 4.4.1 | Webhook body shape validation | Already installed; project pattern from Phases 2–4 |
| node:crypto | built-in | HMAC-SHA256 + `timingSafeEqual` for webhook validation | No extra dep; verified in Node 22.14.0 (local env) |

> [VERIFIED: apps/web/package.json] — exact versions from project file.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| structlog | optional | Structured logging in Modal worker | Opt-in; `print()` is sufficient for Estágio 1 (D-CONTEXT) |
| scikit-learn | optional | `MiniBatchKMeans` for HSV clustering | If `cv2.kmeans` performance is insufficient |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Modal JS SDK `spawn()` | Modal web endpoint + fetch | JS SDK spawn is "coming soon" (alpha, April 2026); web endpoint is stable |
| `@modal.fastapi_endpoint` | `@modal.asgi_app` (full FastAPI) | fastapi_endpoint is simpler for single-route dispatch; asgi_app needed only if routing complexity grows |
| Pydantic `model_validate` | Manual dict validation | Pydantic v2 is concise and gives structured errors; manual is brittle |
| Daugman polar + CLAHE pipeline | Direct feature extraction from raw crop | Polar normalization makes sector mapping reliable; skipping it degrades sector assignments |

**Installation (vision-service):**
```bash
pip install modal==1.4.2 opencv-python-headless==4.13.0.92 mediapipe==0.10.35 pydantic==2.13.3 pytest
```

> Note: `torch==2.11.0` and `torchvision` are pre-installed in the Modal image via `requirements.txt`; no local install needed for CI since CI runs CPU-only tests and can skip torch.

---

## Architecture Patterns

### System Architecture Diagram

```
Next.js Server Action (finalizeReadingAction)
          |
          v
POST /api/readings/[id]/process  (Next.js Route Handler)
  - Auth: verifies therapist owns reading
  - Reads reading_images.storage_path (6 rows)
  - Calls supabase.storage.createSignedUrl() × 6 (TTL 600s)
  - Writes readings.vision_features = {processing_metadata: {modal_call_id: <pending>}}
  - Writes readings.status = 'processing'
  - Calls Modal web endpoint: POST https://<app>.modal.run/analyze
    Headers: Modal-Key: $MODAL_TOKEN_ID, Modal-Secret: $MODAL_TOKEN_SECRET
    Body: {reading_id, image_urls: [{eye, angle, url}×6]}
  - Receives: {call_id: "fc-..."}
  - Updates readings.vision_features.processing_metadata.modal_call_id = call_id
  - Returns HTTP 202

                                |
                                v (async, background, ~30–90s)
              Modal Worker (T4 GPU, timeout=120s)
                - Downloads 6 images via signed URLs (HTTP GET)
                - detect × 6 → MediaPipe FaceLandmarker
                - segment × 6 → HoughCircles + mask
                - compose × 2 → weighted photometric average
                - normalize × 2 → Daugman polar (64×512)
                - enhance × 2 → CLAHE
                - features × 2 → IrisFeatures Pydantic model
                - asymmetry_notes comparison
                - modal.current_function_call_id() → embeds in payload
                - HTTP POST → $MODAL_WEBHOOK_URL (Next.js webhook)
                  Headers: X-Modal-Signature: hmac-sha256-hex
                           X-Modal-Timestamp: <unix_epoch>
                  Body: full IrisFeatures JSON (~50KB)

                                |
                                v
POST /api/vision/webhook/route.ts  (Next.js Route Handler)
  - Reads raw body bytes (request.text())
  - Validates HMAC-SHA256 hex vs MODAL_WEBHOOK_SECRET
  - Validates X-Modal-Timestamp (replay window ±5 min) [ASSUMED — not Modal-standard]
  - Checks readings.status = 'processing' (status guard D-T4)
  - Single UPDATE: vision_features = payload, status = 'ready'/'failed',
                   processed_at = now()
  - revalidatePath('/leituras')
  - Returns HTTP 200

                                |
                                v
/leituras page (Next.js Server Component, re-renders on navigation)
  - Renders Badge: Processando | Pronto | Falhou
  - Failed rows: tooltip(error_summary) + Reprocessar button
```

### Recommended Project Structure

```
vision-service/
├── modal_app.py           # Modal App; exposes analyze_iris as @fastapi_endpoint
├── pipeline/
│   ├── __init__.py        # re-exports 6 modules
│   ├── detect.py          # Stage 1: MediaPipe FaceLandmarker
│   ├── segment.py         # Stage 2: HoughCircles + mask
│   ├── compose.py         # Stage 3: weighted photometric average
│   ├── normalize.py       # Stage 4: Daugman polar transform
│   ├── enhance.py         # Stage 5: CLAHE
│   ├── features.py        # Stage 6: IrisFeatures Pydantic + extract_all
│   ├── iris_maps.py       # Load/cache jensen-map.json; @functools.lru_cache
│   └── quality.py         # image_quality helpers (composite_score, warnings)
├── models/
│   └── face_landmarker.task  # Downloaded at Modal image build time
├── data/
│   └── jensen-map.json    # Canonic sector map (pt-BR); validated by founder
├── tests/
│   ├── conftest.py        # Shared fixtures, image loaders
│   ├── fixtures/
│   │   ├── iris/          # 6–10 JPEGs at 1024px
│   │   │   └── right_frontal_01.jpg  # naming: {eye}_{angle}_{id}.jpg
│   │   ├── expected.json  # Founder-annotated ground-truth per fixture
│   │   └── CONSENT.md     # Self-consent (founder) + written consent path (3rd parties)
│   ├── test_detect.py
│   ├── test_segment.py
│   ├── test_compose.py
│   ├── test_normalize.py
│   ├── test_enhance.py
│   └── test_features.py
├── requirements.txt       # Updated with pydantic, pytest
└── README.md              # deploy + test instructions

apps/web/
├── app/
│   └── api/
│       ├── readings/[id]/process/route.ts  # Trigger (NEW)
│       └── vision/webhook/route.ts          # Webhook receiver (NEW)
├── lib/
│   └── vision/
│       └── modal-client.ts                  # triggerVisionPipeline helper (NEW)
└── app/actions/readings.ts                  # Extend finalizeReadingAction (TODO → DONE)
```

### Pattern 1: Modal Web Endpoint + `.spawn()` (Async Trigger)

**What:** The `analyze_iris` function is exposed via `@modal.fastapi_endpoint()` as a FastAPI route in the Modal app. It immediately spawns the actual processing function and returns the `call_id`. This decouples the HTTP call (< 1s) from the GPU work (30–120s).

**When to use:** Whenever you need async fire-and-forget from a non-Python client.

```python
# vision-service/modal_app.py
import modal
import httpx

app = modal.App("aurel-iris-vision")

image = modal.Image.debian_slim().pip_install(
    "opencv-python-headless==4.13.0.92",
    "mediapipe==0.10.35",
    "numpy>=1.26.0",
    "scikit-image>=0.24.0",
    "Pillow>=10.4.0",
    "pydantic==2.13.3",
    "httpx",
).apt_install(
    "libgl1"
).run_commands(
    # Download face_landmarker.task model at build time (not at inference)
    "mkdir -p /models && "
    "wget -q -O /models/face_landmarker.task "
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
)

@app.function(image=image, gpu="T4", timeout=120)
def run_pipeline(reading_id: str, image_urls: list[dict]) -> dict:
    """The actual GPU pipeline (internal; not exposed to HTTP directly)."""
    import os, time, modal
    from pipeline import detect, segment, compose, normalize, enhance, features
    from pipeline.iris_maps import load_jensen_map
    from pipeline.schemas import IrisFeatures

    t_start = time.monotonic()
    call_id = modal.current_function_call_id()  # Source: modal.com/docs/reference/modal.current_function_call_id
    warnings: list[str] = []
    stages_timing: dict = {}
    results = {}

    jensen = load_jensen_map()

    for eye in ["right", "left"]:
        eye_images = [img for img in image_urls if img["eye"] == eye]
        try:
            t0 = time.monotonic()
            detected = [detect.find_iris(load_image(u["url"])) for u in eye_images]
            stages_timing[f"detect_{eye}"] = int((time.monotonic() - t0) * 1000)

            # ... (similar for each stage)
            results[f"{eye}_eye"] = features.extract_all(enhanced, composite, jensen, eye)
        except Exception as exc:
            warnings.append(f"pipeline_failed_{eye}_{type(exc).__name__}")
            results[f"{eye}_eye"] = None

    if results.get("right_eye") is None and results.get("left_eye") is None:
        # Both failed — hard fail
        error_summary = "Falha temporária no processamento — tente novamente"
        _post_webhook(reading_id, call_id, status="failed", error_summary=error_summary)
        return {}

    # Validate output shape before POSTing
    output = IrisFeatures.model_validate({
        **results,
        "asymmetry_notes": compute_asymmetry(results),
        "processing_metadata": {
            "model_version": "pipeline_0.1.0",
            "processing_time_ms": int((time.monotonic() - t_start) * 1000),
            "modal_call_id": call_id,
            "stages_timing_ms": stages_timing,
            "warnings": warnings,
        }
    })

    _post_webhook(reading_id, call_id, status="ready", features=output.model_dump())
    return output.model_dump()


@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def analyze_iris_endpoint(reading_id: str, image_urls: list[dict]):
    """
    HTTP entry point — spawns run_pipeline and returns call_id immediately.
    Source: modal.com/docs/examples/doc_ocr_webapp (canonical spawn pattern)
    """
    call = run_pipeline.spawn(reading_id, image_urls)
    return {"call_id": call.object_id}  # object_id is the FunctionCall ID
```

> [VERIFIED: modal.com/docs/examples/doc_ocr_webapp — canonical spawn pattern]
> [VERIFIED: modal.com/docs/reference/modal.current_function_call_id — confirmed available inside function]

### Pattern 2: Next.js Route Handler — Trigger

```typescript
// apps/web/app/api/readings/[id]/process/route.ts
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'  // service role

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const readingId = params.id
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Guard: reading must be owned by this therapist and status=pending or failed
  const { data: reading } = await supabase
    .from('readings')
    .select('id, status, therapist_id')
    .eq('id', readingId)
    .eq('therapist_id', user.id)
    .single()

  if (!reading || !['pending', 'failed'].includes(reading.status)) {
    return new Response('Not found or not retriggerable', { status: 404 })
  }

  // Generate signed URLs for all 6 images (TTL 600s = 10 min per D-T6)
  const { data: images } = await supabase
    .from('reading_images')
    .select('eye, angle, storage_path')
    .eq('reading_id', readingId)

  const serviceSupabase = createServiceClient()
  const imageUrls = await Promise.all(
    (images ?? []).map(async (img) => {
      const { data, error } = await serviceSupabase.storage
        .from('iris-captures')
        .createSignedUrl(img.storage_path, 600)  // expiresIn: 600 per D-T6
      if (error || !data?.signedUrl) throw error
      return { eye: img.eye, angle: img.angle, url: data.signedUrl }
    })
  )

  // Write processing_metadata.modal_call_id placeholder BEFORE spawn (D-T5)
  await serviceSupabase
    .from('readings')
    .update({
      status: 'processing',
      vision_features: { processing_metadata: { modal_call_id: 'pending' } }
    })
    .eq('id', readingId)

  // Call Modal web endpoint (NOT JS SDK spawn — spawn not available in JS SDK 2026)
  // Source: Modal proxy auth docs — Modal-Key/Modal-Secret headers
  const modalRes = await fetch(process.env.MODAL_ANALYZE_ENDPOINT_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Modal-Key': process.env.MODAL_TOKEN_ID!,
      'Modal-Secret': process.env.MODAL_TOKEN_SECRET!,
    },
    body: JSON.stringify({ reading_id: readingId, image_urls: imageUrls }),
  })

  if (!modalRes.ok) {
    // Rollback to failed
    await serviceSupabase.from('readings').update({ status: 'failed' }).eq('id', readingId)
    return new Response('Modal trigger failed', { status: 502 })
  }

  const { call_id } = await modalRes.json()

  // Update modal_call_id now that we have it (D-T5)
  await serviceSupabase
    .from('readings')
    .update({
      vision_features: { processing_metadata: { modal_call_id: call_id } }
    })
    .eq('id', readingId)

  return new Response(null, { status: 202 })
}
```

> [CITED: supabase.com/docs/reference/javascript/storage-from-createsignedurl — `data.signedUrl` (lowercase camelCase, confirmed via PR #94 in storage-js)]
> [CITED: modal.com/docs/guide/webhook-proxy-auth — Modal-Key / Modal-Secret headers]

### Pattern 3: Next.js Webhook Handler — HMAC + Atomic Update

```typescript
// apps/web/app/api/vision/webhook/route.ts
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

// Top-level shape only — detailed validation is the Python pipeline's responsibility (CONTEXT deferred)
const webhookBodySchema = z.object({
  reading_id: z.string().uuid(),
  status: z.enum(['ready', 'failed']),
  modal_call_id: z.string(),
  features: z.record(z.unknown()).optional(),
  error_summary: z.string().optional(),
})

export async function POST(request: Request) {
  const rawBody = await request.text()  // CRITICAL: read as text FIRST for HMAC

  // HMAC-SHA256 validation — Stripe/GitHub-style pattern
  // Source: Node.js crypto timingSafeEqual pattern, community-standard
  const signature = request.headers.get('x-modal-signature')
  const timestamp = request.headers.get('x-modal-timestamp')

  if (!signature || !timestamp) {
    return new Response('Missing signature headers', { status: 401 })
  }

  // Replay protection: reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    return new Response('Timestamp too old', { status: 401 })
  }

  // What is signed: `${timestamp}.${rawBody}` (Stripe convention)
  const expected = createHmac('sha256', process.env.MODAL_WEBHOOK_SECRET!)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')

  const expectedBuf = Buffer.from(expected, 'hex')
  const receivedBuf = Buffer.from(signature.replace('sha256=', ''), 'hex')

  if (expectedBuf.length !== receivedBuf.length || !timingSafeEqual(expectedBuf, receivedBuf)) {
    return new Response('Invalid signature', { status: 401 })
  }

  const body = webhookBodySchema.safeParse(JSON.parse(rawBody))
  if (!body.success) return new Response('Bad payload', { status: 400 })

  const { reading_id, status, features, error_summary } = body.data
  const supabase = createServiceClient()  // service role — bypasses RLS (D-CONTEXT)

  // Status guard — idempotency (D-T4)
  const { data: current } = await supabase
    .from('readings')
    .select('status')
    .eq('id', reading_id)
    .single()

  if (current?.status !== 'processing') {
    return new Response('No-op (status guard)', { status: 200 })
  }

  // Atomic UPDATE (D-F5)
  await supabase.from('readings').update({
    vision_features: features ?? null,
    status,
    processed_at: new Date().toISOString(),
    ...(error_summary ? { vision_features: { processing_metadata: { error_summary } } } : {}),
  }).eq('id', reading_id)

  revalidatePath('/leituras')
  return new Response(null, { status: 200 })
}
```

> [CITED: community pattern Node.js HMAC timingSafeEqual for webhook validation (2024–2025)]
> [ASSUMED: X-Modal-Signature header name and `${timestamp}.${rawBody}` signing string — Modal does not impose a convention for user-coded callbacks; Stripe pattern is defensible]

### Pattern 4: MediaPipe FaceLandmarker Tasks API (Server-Side Python)

```python
# vision-service/pipeline/detect.py
import mediapipe as mp
import numpy as np
import cv2

# Source: ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/python
# Tasks API replaces legacy mp.solutions.face_mesh

LEFT_IRIS = [468, 469, 470, 471, 472]   # Verified: LEFT iris in FaceLandmarker output
RIGHT_IRIS = [473, 474, 475, 476, 477]  # Verified: RIGHT iris landmarks

# NOTE on landmark naming: In the Tasks API, "left/right" follows the subject's
# anatomical perspective, OPPOSITE to screen-left/right. Verify orientation with
# fixture images against expected.json to confirm eye assignment.

def get_landmarker() -> mp.tasks.vision.FaceLandmarker:
    """Load once per container (cold start); reuse across calls."""
    BaseOptions = mp.tasks.BaseOptions
    FaceLandmarker = mp.tasks.vision.FaceLandmarker
    FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
    VisionRunningMode = mp.tasks.vision.RunningMode

    options = FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path='/models/face_landmarker.task'),
        running_mode=VisionRunningMode.IMAGE,
        num_faces=1,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
    )
    return FaceLandmarker.create_from_options(options)

_landmarker = None

def find_iris(image: np.ndarray) -> dict:
    """
    Args:
        image: H×W×3 RGB numpy array (IMPORTANT: MediaPipe Tasks API expects RGB)

    Returns:
        dict with:
          center: (x, y) in pixels
          radius: float
          pupil_center: (x, y) estimated from inner landmarks
          pupil_radius: float estimated
          landmarks_raw: list[{x, y, z}] for all 478 points
    """
    global _landmarker
    if _landmarker is None:
        _landmarker = get_landmarker()

    h, w = image.shape[:2]
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image)
    result = _landmarker.detect(mp_image)

    if not result.face_landmarks:
        raise ValueError("mediapipe_no_face_detected")

    landmarks = result.face_landmarks[0]  # first (only) face

    # Iris center = mean of 5 iris landmark points
    # LEFT_IRIS / RIGHT_IRIS — which eye this image represents is passed by caller
    # For a cropped eye image, both sets will be present; caller selects by eye param
    iris_pts = [landmarks[i] for i in LEFT_IRIS + RIGHT_IRIS]
    cx = sum(p.x for p in iris_pts) / len(iris_pts) * w
    cy = sum(p.y for p in iris_pts) / len(iris_pts) * h

    # Iris radius: distance from center to edge point (index 469 or 474)
    edge = landmarks[469]  # leftmost point of LEFT_IRIS
    radius = ((edge.x * w - cx) ** 2 + (edge.y * h - cy) ** 2) ** 0.5

    return {
        "center": (cx, cy),
        "radius": radius,
        "landmarks_raw": [{"x": p.x, "y": p.y, "z": p.z} for p in landmarks],
    }
```

> [CITED: ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/python]
> [VERIFIED: mediapipe 0.10.35 on pip registry — iris landmark indices 468–477 are standard since mediapipe 0.10.x with face_landmarker.task model]

### Pattern 5: Hough Circles for Iris Segmentation

```python
# vision-service/pipeline/segment.py
import cv2
import numpy as np

# Starting values calibrated for ~1024px resized iris images
# Source: Literature (Masek 2003, Daugman 2004) + OpenCV Hough docs
# These are STARTING POINTS — must be calibrated against founder fixtures (D-X3)

HOUGH_DEFAULTS = {
    "dp": 1.0,           # Accumulator resolution = image resolution
    "minDist": 100,      # Minimum distance between detected circle centers
    "param1": 100,       # Upper Canny threshold (lower = param1/2 automatically)
    "param2": 40,        # Accumulator threshold — lower = more false positives
    "minRadius": 80,     # ~8% of 1024px — iris is typically 10–15% of full-frame
    "maxRadius": 200,    # ~20% of 1024px
}

def iris_mask(image: np.ndarray, detection: dict) -> dict:
    """
    Compute binary mask for iris ring using Hough Transform.

    Failure modes to handle:
    - Specular highlights: pre-process with inpainting or median blur
    - Partial eyelid occlusion: mask-and-ignore occluded sectors
    - No circle found: fall back to MediaPipe iris radius estimate from detect stage

    Returns:
        dict with binary_mask (H×W bool), iris_circle (cx, cy, r),
                  pupil_circle (cx, cy, r), segmented_image
    """
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)

    # Reduce specular highlight noise before Hough
    gray_blur = cv2.medianBlur(gray, 5)

    circles = cv2.HoughCircles(
        gray_blur,
        cv2.HOUGH_GRADIENT,
        **HOUGH_DEFAULTS
    )

    if circles is None:
        # D-F1 soft degradation: fall back to MediaPipe estimate
        cx, cy = detection["center"]
        r = detection["radius"]
        warnings.append("hough_segment_failed_fallback_mediapipe")
    else:
        cx, cy, r = circles[0][0]  # best circle

    h, w = image.shape[:2]
    mask = np.zeros((h, w), dtype=bool)
    cv2.circle(mask.astype(np.uint8), (int(cx), int(cy)), int(r), 1, -1)

    return {
        "binary_mask": mask,
        "iris_circle": (cx, cy, r),
        "segmented_image": cv2.bitwise_and(image, image, mask=mask.astype(np.uint8)),
    }
```

> [CITED: docs.opencv.org/4.x/d3/de5/tutorial_js_houghcircles.html]
> [ASSUMED: specific numeric defaults (dp=1.0, param1=100, param2=40, minRadius=80, maxRadius=200) — starting point; calibration against founder fixtures required per D-X3]

### Pattern 6: Daugman Polar Transform

```python
# vision-service/pipeline/normalize.py
import cv2
import numpy as np

# Resolution convention from biometric literature:
# Daugman 2004: radial samples × angular samples = 64 × 512 (common in CASIA benchmarks)
# Some implementations use 48×512 or 32×256. 64×512 is a good balance.
# Source: [ASSUMED from training knowledge of biometric literature; verified pattern
#          exists in open implementations like IrisRecognition GitHub repos]
POLAR_RADIAL = 64    # radial resolution (pupil→limbus)
POLAR_ANGULAR = 512  # angular resolution (0→2π)

def daugman_polar(composite: dict) -> np.ndarray:
    """
    Apply Daugman's rubber-sheet model.

    Maps iris ring (annular region between pupil_circle and iris_circle)
    to a rectangular polar image of shape (POLAR_RADIAL, POLAR_ANGULAR, 3).

    Interpolation: cv2.INTER_LINEAR (bilinear) — standard for iris normalization.
    Source: [ASSUMED — INTER_LINEAR is the biometric community default; INTER_CUBIC
             is slightly better quality but 4× slower; acceptable tradeoff for MVP]
    """
    image = composite["segmented_image"]
    cx, cy, r_iris = composite["iris_circle"]
    _, _, r_pupil = composite.get("pupil_circle", (cx, cy, r_iris * 0.35))

    h, w = image.shape[:2]
    polar = np.zeros((POLAR_RADIAL, POLAR_ANGULAR, 3), dtype=np.uint8)

    for row in range(POLAR_RADIAL):
        r_ratio = row / POLAR_RADIAL  # 0=pupil boundary, 1=iris boundary
        r = r_pupil + (r_iris - r_pupil) * r_ratio

        for col in range(POLAR_ANGULAR):
            theta = 2 * np.pi * col / POLAR_ANGULAR
            x = cx + r * np.cos(theta)
            y = cy + r * np.sin(theta)

            xi, yi = int(x), int(y)
            if 0 <= xi < w and 0 <= yi < h:
                polar[row, col] = image[yi, xi]

    return polar  # shape: (64, 512, 3)
```

> [ASSUMED: POLAR_RADIAL=64, POLAR_ANGULAR=512 — literature convention but not pinned to a specific source verified in this session; open implementations use 48–64 × 512–1024]

### Pattern 7: CLAHE Enhancement

```python
# vision-service/pipeline/enhance.py
import cv2
import numpy as np

# OpenCV defaults: clipLimit=40.0, tileGridSize=(8,8)
# Source: docs.opencv.org/3.4/d6/db6/classcv_1_1CLAHE.html (VERIFIED)
# For iris polar images (64×512), smaller tiles improve local contrast on fiber texture.
# clipLimit=2.0, tileGridSize=(4,8) are more conservative — prevents over-amplification.
# [ASSUMED: these iris-specific values; the OpenCV default of 40 is very aggressive]

def clahe(normalized: np.ndarray) -> np.ndarray:
    """Apply CLAHE to the polar-normalized iris image."""
    # Work on L channel of LAB to avoid color shift (better than applying to RGB directly)
    lab = cv2.cvtColor(normalized, cv2.COLOR_RGB2LAB)
    l_chan, a_chan, b_chan = cv2.split(lab)

    clahe_obj = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 8))
    l_enhanced = clahe_obj.apply(l_chan)

    enhanced_lab = cv2.merge([l_enhanced, a_chan, b_chan])
    return cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2RGB)
```

> [VERIFIED: OpenCV default clipLimit=40.0, tileGridSize=(8,8) via docs.opencv.org]
> [ASSUMED: iris-specific clipLimit=2.0 / tileGridSize=(4,8) — applying CLAHE to LAB L-channel is community-standard to avoid hue shift; exact values need fixture calibration]

### Pattern 8: HSV Color Clustering for `iris_color`

```python
# inside vision-service/pipeline/features.py (color analysis section)
import cv2
import numpy as np

# Color space choice: LAB is more perceptually uniform than HSV.
# For iris pigment classification (blue/brown/green/mixed), LAB performs
# better than HSV because brown-green distinction maps better in the a* axis.
# k=3 clusters: primary, secondary, background (sclera bleedthrough)
# [ASSUMED: k=3 and LAB preference; HSV also works but LAB is more robust per literature]

COLOR_LABELS = {
    "azul": {"lab_hue_range": (90, 130)},     # approximate LAB a*/b* signature
    "castanho": {"lab_hue_range": (10, 50)},
    "verde-mosaico": {"lab_hue_range": (50, 90)},
}

def classify_iris_color(masked_image: np.ndarray) -> dict:
    """
    Use k-means in LAB space to find dominant iris color.
    Source: [ASSUMED — LAB space preference from color science literature;
             k=3 is a defensible starting point for 3-color clustering]
    """
    lab = cv2.cvtColor(masked_image, cv2.COLOR_RGB2LAB)
    pixels = lab.reshape(-1, 3).astype(np.float32)

    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
    _, labels, centers = cv2.kmeans(pixels, 3, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)

    # Largest cluster (by pixel count) is primary color
    counts = np.bincount(labels.flatten())
    primary_center = centers[np.argmax(counts)]

    # Classify by mapping LAB center to named color
    primary_color = _lab_to_iris_color_name(primary_center)
    secondary_color = None  # second-largest cluster if different

    return {
        "primary": primary_color,
        "secondary": secondary_color,
        "central_heterochromia": _detect_central_heterochromia(lab, masked_image),
    }
```

### Pattern 9: Pydantic v2 IrisFeatures Schema

```python
# vision-service/pipeline/schemas.py
from pydantic import BaseModel, Field, model_validator
from typing import Optional
from enum import Enum

# Source: pydantic docs v2 — model_validate, ConfigDict
# Version: pydantic 2.13.3 (VERIFIED via pip registry)

class ConstitutionType(str, Enum):
    LINHATICA = "linhatica"
    HEMATOGENEA = "hematogenea"
    MISTA = "mista"

class Constitution(BaseModel):
    primary: ConstitutionType
    confidence: float = Field(ge=0.0, le=1.0)
    indicators: list[str]

class IrisColor(BaseModel):
    primary: str
    secondary: Optional[str] = None
    central_heterochromia: bool = False

class Finding(BaseModel):
    type: str  # "lacuna" | "pigmentacao" | "cripta"
    depth: Optional[str] = None
    size_mm: Optional[float] = None
    color: Optional[str] = None
    extension: Optional[str] = None

class Sector(BaseModel):
    hour: int = Field(ge=1, le=12)
    zones: list[str]
    findings: list[Finding] = []

class ImageQuality(BaseModel):
    composite_score: float = Field(ge=0.0, le=1.0)
    warnings: list[str] = []

class EyeFeatures(BaseModel):
    constitution: Constitution
    iris_color: IrisColor
    fiber_density: dict
    collarette: dict
    pupil: dict
    sectors: list[Sector]
    rings: dict
    global_signs: dict
    image_quality: ImageQuality

class ProcessingMetadata(BaseModel):
    model_version: str
    processing_time_ms: int
    modal_call_id: str
    stages_timing_ms: dict[str, int] = {}
    warnings: list[str] = []
    error_summary: Optional[str] = None

class IrisFeatures(BaseModel):
    right_eye: Optional[EyeFeatures] = None  # None = D-F1 per-eye degradation
    left_eye: Optional[EyeFeatures] = None
    asymmetry_notes: list[str] = []
    processing_metadata: ProcessingMetadata

    @model_validator(mode="after")
    def at_least_one_eye(self) -> "IrisFeatures":
        # Pydantic v2 validator runs after field validation
        # If both None: pipeline should have set status=failed before calling model_validate
        return self
```

> [VERIFIED: pydantic 2.13.3 on pip registry]
> [CITED: docs.pydantic.dev/latest/concepts/models — model_validate, model_validator, ConfigDict]

### Anti-Patterns to Avoid

- **Modal JS SDK `.spawn()` from Next.js:** Not available in npm `modal` package 0.7.4 (April 2026). Use web endpoint + `fetch()` instead.
- **Validating HMAC with `===` or `==`:** Timing oracle attack. Always use `crypto.timingSafeEqual`.
- **Calling `request.json()` before HMAC verification in webhook:** Body stream consumed; re-serialization may differ. Always `request.text()` first.
- **Applying CLAHE to RGB channels directly:** Shifts hue/saturation. Apply to L-channel in LAB or to value channel in HSV only.
- **Using MediaPipe legacy `mp.solutions.face_mesh`:** Deprecated in mediapipe >= 0.10.x for Tasks API. Tasks API with `face_landmarker.task` model is current.
- **Committing `force_build=True` in modal_app.py:** Forces image rebuild on every deploy; use only locally during debugging.
- **Service role Supabase credentials in Modal container:** Modal containers must not receive Supabase service key. Signed URLs are the LGPD-compliant mechanism (D-T6).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HMAC webhook validation | Custom hex comparison | `crypto.timingSafeEqual` (Node built-in) | Timing oracle attack if using `===` |
| Iris landmark detection | Custom CNN | MediaPipe FaceLandmarker (face_landmarker.task) | 478-landmark model with iris indices already in mediapipe 0.10.35 |
| JSON output schema validation | Nested isinstance() checks | Pydantic v2 `IrisFeatures.model_validate()` | Recursive validation with clear error messages |
| Color space math | Manual RGB→LAB conversion | `cv2.cvtColor(img, cv2.COLOR_RGB2LAB)` | NumPy broadcast + OpenCV SIMD-optimized |
| Modal image caching | Manual Docker layer tricks | Modal's built-in per-layer cache (keep deps in early layers) | Modal handles rebuilds intelligently; frequent reordering breaks cache |
| Signed URL expiry logic | Custom TTL tracking | Supabase `createSignedUrl(path, 600)` | Storage handles TTL and signature; 10-min window covers cold-start (D-T6) |
| Polar coordinate mapping | scipy.ndimage.map_coordinates custom | `cv2.remap()` with pre-computed map | SIMD-optimized; produces same result for bilinear interpolation |

**Key insight:** The iris analysis domain has well-studied algorithms (Daugman 2003, Masek 2003) available in OpenCV. The real engineering work is pipeline orchestration, schema enforcement, and the Modal trigger/webhook integration — not reimplementing CV primitives.

---

## Common Pitfalls

### Pitfall 1: Modal JS SDK `spawn()` not available
**What goes wrong:** Developer imports `modal` from npm, calls `modal.functions.fromName(...).spawn()`, gets runtime error ("spawn is coming soon").
**Why it happens:** The JS SDK is alpha (published April 2026); `spawn()` is documented as "coming soon".
**How to avoid:** Expose `analyze_iris` via `@modal.fastapi_endpoint()`, call from Next.js via `fetch()` with `Modal-Key`/`Modal-Secret` headers. Web endpoint Python side calls `run_pipeline.spawn()` internally and returns `call_id`.
**Warning signs:** Modal changelog or blog post announcing JS SDK spawn availability — re-evaluate then.

### Pitfall 2: FaceLandmarker model not downloaded at image build time
**What goes wrong:** `_landmarker` initialized lazily at first request; model download adds 5–10s latency to first inference; model download may fail if storage.googleapis.com unreachable from Modal container.
**Why it happens:** Model is not bundled with mediapipe pip package in Tasks API.
**How to avoid:** Add `run_commands("wget -O /models/face_landmarker.task https://storage.googleapis.com/mediapipe-models/...")` in `modal.Image` definition so model is cached in the image layer.
**Warning signs:** First-inference latency spike > 10s; intermittent `FileNotFoundError` in detect stage.

### Pitfall 3: HMAC body consumed before verification
**What goes wrong:** Webhook handler calls `await request.json()` for parsing, then tries to verify HMAC; HMAC fails because original bytes were not preserved.
**Why it happens:** Web framework streams body once; `json()` deserializes and drops original formatting.
**How to avoid:** Always `const rawBody = await request.text()` first, then `JSON.parse(rawBody)` after HMAC passes.
**Warning signs:** HMAC mismatch despite correct secret; always fails in production but passes in tests that don't test signature.

### Pitfall 4: Signed URL expiry during slow Modal cold start
**What goes wrong:** Modal cold start takes 30–60s for large image (torch + mediapipe); by the time `find_iris()` runs, signed URLs have expired (if TTL < 60s).
**Why it happens:** Container hasn't been warm; pip_install image is large.
**How to avoid:** TTL=600s (10 min) per D-T6 covers even worst-case cold start + processing. Do NOT reduce TTL below 120s.
**Warning signs:** HTTP 403/400 from Supabase Storage mid-pipeline; `image_quality.warnings` logging storage errors.

### Pitfall 5: MediaPipe left/right eye landmark assignment confusion
**What goes wrong:** Pipeline assigns left-iris landmarks (468–472) to right eye photo and vice versa, producing mirrored feature assignments.
**Why it happens:** MediaPipe's "left" is the subject's anatomical left (opposite to camera perspective); depends on whether photo is mirrored.
**How to avoid:** Validate against `expected.json` fixture with known-left and known-right images. Add explicit sanity check in `find_iris`: center of LEFT_IRIS should be camera-right of face center for front-facing photo.
**Warning signs:** Jensen sector mappings systematically wrong; `asymmetry_notes` showing implausible assimetrias.

### Pitfall 6: Jensen map loaded per-request instead of cached
**What goes wrong:** `json.load(open('data/jensen-map.json'))` called inside `features.extract_all()` on every invocation; adds ~5ms but creates unnecessary I/O; breaks if CWD is wrong in Modal container.
**Why it happens:** Lazy loading without caching.
**How to avoid:** Use `@functools.lru_cache(maxsize=None)` on `load_jensen_map()` in `iris_maps.py`; use `Path(__file__).parent.parent / "data" / "jensen-map.json"` for CWD-independent path.
**Warning signs:** File not found errors in Modal container; `stages_timing_ms.features` showing variable I/O latency.

### Pitfall 7: Hough circles returning multiple circles — picking wrong one
**What goes wrong:** `cv2.HoughCircles` returns multiple candidate circles; code picks `circles[0][0]` which may not be the iris (may be a specular highlight or eyelid arc).
**Why it happens:** `param2` too low; `minDist` too small.
**How to avoid:** Sort candidates by radius proximity to MediaPipe estimate from detect stage; use the detection's center as an anchor to select the closest circle.
**Warning signs:** Polar image showing clearly incorrect iris cropping in test output images.

---

## Runtime State Inventory

> Phase 5 is greenfield (new files + DB column fills on existing schema). No renames or migrations. Only the D-T5 `modal_call_id` entry pre-populates `vision_features` before the pipeline runs.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `readings.vision_features` is NULL today; Phase 5 writes it | Code — no migration (column already exists per SPEC §3) |
| Live service config | Modal app `aurel-iris-vision` not yet deployed (skeleton only) | `modal deploy modal_app.py` before production use |
| OS-registered state | None | None — verified by inspection of CONTEXT.md |
| Secrets/env vars | `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`, `MODAL_WEBHOOK_SECRET` provisioned in Phase 1; `MODAL_ANALYZE_ENDPOINT_URL` NEW (the web endpoint URL after `modal deploy`) | Add `MODAL_ANALYZE_ENDPOINT_URL` to `.env.example` and Vercel env |
| Build artifacts | `vision-service/models/` empty today (skeleton comment says "pesos vazios") | Add `wget` of `face_landmarker.task` to Modal image build |

---

## Code Examples

### Generating Signed URLs in Batch

```typescript
// Batch-generate 6 signed URLs — fail-fast if any storage_path is missing
// Source: supabase.com/docs/reference/javascript/storage-from-createsignedurl
// Return property is data.signedUrl (lowercase camelCase, fixed in storage-js PR #94)

const { data: signedUrls, error } = await supabase.storage
  .from('iris-captures')
  .createSignedUrls(
    images.map(img => img.storage_path),
    600  // expiresIn seconds = D-T6
  )
if (error) throw error
// signedUrls[i].signedUrl
```

> Note: `createSignedUrls` (plural) is more efficient than 6 individual `createSignedUrl` calls. Verify it's available in @supabase/supabase-js 2.105.1.

### Photometric Composition (Weighted Average)

```python
# vision-service/pipeline/compose.py
import cv2
import numpy as np

def photometric_combine(segmented_images: list[dict]) -> dict:
    """
    Combine 3-angle (frontal, lateral, backlight) segmented images.
    Simple approach: weighted average with backlight having lower weight
    (backlight image has high specular content that can degrade texture).

    [ASSUMED: weights are starting defaults; may need calibration against fixtures]
    WEIGHTS = {"frontal": 0.4, "lateral": 0.4, "backlight": 0.2}
    """
    WEIGHTS = {"frontal": 0.4, "lateral": 0.4, "backlight": 0.2}
    total_weight = 0.0
    composite = None

    for seg in segmented_images:
        angle = seg.get("angle", "frontal")
        w = WEIGHTS.get(angle, 0.33)
        img = seg["segmented_image"].astype(np.float32)
        if composite is None:
            composite = img * w
        else:
            composite += img * w
        total_weight += w

    return {
        "segmented_image": np.clip(composite / total_weight, 0, 255).astype(np.uint8),
        "iris_circle": segmented_images[0]["iris_circle"],
        "pupil_circle": segmented_images[0].get("pupil_circle"),
    }
```

### Webhook HMAC Signing (Python side — in the Modal worker)

```python
# In vision-service/modal_app.py _post_webhook()
import hmac
import hashlib
import time
import httpx
import os

def _post_webhook(reading_id: str, call_id: str, status: str, **kwargs):
    """POST features JSON back to Next.js webhook with HMAC signature."""
    payload = {
        "reading_id": reading_id,
        "status": status,
        "modal_call_id": call_id,
        **kwargs
    }
    import json
    body = json.dumps(payload)
    timestamp = str(int(time.time()))

    # Sign: HMAC-SHA256 of f"{timestamp}.{body}" — Stripe convention
    # Header format: "sha256=<hex_digest>"
    secret = os.environ["MODAL_WEBHOOK_SECRET"]
    sig = hmac.new(
        secret.encode(),
        f"{timestamp}.{body}".encode(),
        hashlib.sha256
    ).hexdigest()

    webhook_url = os.environ["MODAL_WEBHOOK_URL"]  # e.g. https://aurel.vercel.app/api/vision/webhook
    httpx.post(
        webhook_url,
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Modal-Signature": f"sha256={sig}",
            "X-Modal-Timestamp": timestamp,
        },
        timeout=30,
    )
```

> [ASSUMED: header name `X-Modal-Signature`, format `sha256=<hex>`, signing `${timestamp}.${body}` — Modal has no canonical convention for user-coded callbacks; this follows Stripe/GitHub webhook convention]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `mp.solutions.face_mesh` (legacy) | `mp.tasks.vision.FaceLandmarker` (Tasks API) | mediapipe 0.10.x (2023) | Tasks API required for server-side static image mode; legacy is deprecated |
| `modal.web_endpoint` decorator | `modal.fastapi_endpoint` decorator | 2024 (Modal docs) | `@modal.fastapi_endpoint` is current; `@modal.web_endpoint` still works but fastapi_endpoint is recommended |
| Modal JS SDK for function calling | Web endpoint + `fetch()` with proxy auth | April 2026 (npm modal 0.7.4) | JS SDK spawn is "coming soon"; web endpoint is stable path |
| `data.signedURL` (uppercase) | `data.signedUrl` (camelCase) | storage-js PR #94 | Old code using `signedURL` will get undefined |
| CLAHE applied to BGR/RGB all channels | CLAHE applied to L-channel of LAB | Ongoing best practice | Avoids hue/saturation shift |
| Pydantic v1 `parse_obj()` | Pydantic v2 `model_validate()` | Pydantic 2.0 (2023) | v2 API is breaking from v1; `parse_obj` is gone |

**Deprecated/outdated:**
- `modal.Stub`: renamed to `modal.App` (breaking change in modal ~0.60.x, confirmed in skeleton at `modal_app.py` line 16 which correctly uses `modal.App`).
- `mp.solutions.face_mesh.FaceMesh` with `refine_landmarks=True`: still works in mediapipe 0.10.x but is on legacy solutions path. Tasks API is the forward-compatible approach.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (vision-service) + vitest 2.1.9 (Next.js) |
| Config file | `vision-service/pytest.ini` (Wave 0 — to create) |
| Quick run command | `cd vision-service && python -m pytest tests/ -x -q` |
| Full suite command | `cd vision-service && python -m pytest tests/ -v` |
| Next.js tests | `pnpm test:run` (vitest, from apps/web/) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VISION-01 | Modal app loads; `analyze_iris_endpoint` function importable | smoke/import | `pytest tests/test_modal_app.py -x` | ❌ Wave 0 |
| VISION-02a | `detect.find_iris()` returns center, radius within expected range for fixture | unit + metric | `pytest tests/test_detect.py -x` | ❌ Wave 0 |
| VISION-02b | `segment.iris_mask()` returns mask with correct shape; fallback fires when Hough fails | unit + metric | `pytest tests/test_segment.py -x` | ❌ Wave 0 |
| VISION-02c | `compose.photometric_combine()` output has same shape as inputs; no NaN | unit structural | `pytest tests/test_compose.py -x` | ❌ Wave 0 |
| VISION-02d | `normalize.daugman_polar()` output is (64, 512, 3) | unit structural | `pytest tests/test_normalize.py -x` | ❌ Wave 0 |
| VISION-02e | `enhance.clahe()` output same shape as input; values in [0, 255] | unit structural | `pytest tests/test_enhance.py -x` | ❌ Wave 0 |
| VISION-02f | `features.extract_all()` produces `constitution.primary` matching `expected.json` fixture | unit + metric | `pytest tests/test_features.py -x` | ❌ Wave 0 |
| VISION-03 | `IrisFeatures.model_validate(pipeline_output)` succeeds for all 6 fixture sets | contract | `pytest tests/test_schema.py -x` | ❌ Wave 0 |
| VISION-04a | `POST /api/readings/[id]/process` returns 202 for valid reading; rejects unauthorized | integration | `pnpm test:run app/api/readings/` | ❌ Wave 0 |
| VISION-04b | Webhook handler: valid HMAC → 200; bad HMAC → 401; wrong status → 200 no-op | unit | `pnpm test:run app/api/vision/` | ❌ Wave 0 |
| VISION-04b | Webhook HMAC sign+verify round-trip in Node.js | unit | `pnpm test:run lib/vision/` | ❌ Wave 0 |
| LGPD-vocab | No forbidden words in `jensen-map.json` and `error_summary` catalog | vocab audit | `pnpm audit:vocabulary` + Python script on JSON | Partial ❌ (Python script new) |

### Sampling Rate

- **Per task commit:** `cd vision-service && python -m pytest tests/ -x -q` (CPU only, no Modal, ~30s)
- **Per wave merge:** Full `pytest tests/ -v` + `pnpm test:run` (vitest for Next.js routes)
- **Phase gate:** Both suites green + `pnpm audit:vocabulary` (including jensen-map.json) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vision-service/pytest.ini` — pytest config, test discovery
- [ ] `vision-service/tests/conftest.py` — shared fixture loaders (load JPEG, load expected.json)
- [ ] `vision-service/tests/fixtures/iris/` — founder photographs (6–10 files, founder records)
- [ ] `vision-service/tests/fixtures/expected.json` — founder-annotated ground-truth
- [ ] `vision-service/tests/fixtures/CONSENT.md` — self-consent + 3rd-party consent path
- [ ] `vision-service/tests/test_detect.py` through `test_features.py` + `test_schema.py` — 7 files
- [ ] `apps/web/tests/api/readings-process.test.ts` — trigger route unit test
- [ ] `apps/web/tests/api/vision-webhook.test.ts` — webhook HMAC + status guard test
- [ ] `vision-service/scripts/audit_vocabulary.py` — extends LGPD audit to JSON assets
- [ ] Framework install: `pip install pytest` in local venv (vision-service not in Node workspace)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (trigger route) | Supabase session cookie; therapist ownership check before spawn |
| V3 Session Management | No (stateless route; session via Supabase SSR) | — |
| V4 Access Control | Yes (webhook bypass RLS) | Service role only for webhook UPDATE; HMAC as auth mechanism |
| V5 Input Validation | Yes | Zod in webhook body; Pydantic v2 in pipeline output |
| V6 Cryptography | Yes (HMAC) | `node:crypto` HMAC-SHA256 + `timingSafeEqual` — never hand-roll |

### Known Threat Patterns for Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged webhook from arbitrary source | Spoofing | HMAC-SHA256 with `MODAL_WEBHOOK_SECRET`; `timingSafeEqual` |
| Replay attack (old webhook resent) | Spoofing | `X-Modal-Timestamp` check ±5 min window |
| Status race: two webhook deliveries | Tampering | Status guard D-T4: only process if `status='processing'` |
| Signed URL leakage via Modal container logs | Info disclosure | TTL=600s limits exposure window; Modal Cloud logs are private to workspace |
| Forbidden vocabulary in LLM-facing strings | LGPD violation | `pnpm audit:vocabulary` extended to `jensen-map.json` and `error_summary` catalog |
| Service role Supabase key in Modal container | Privilege escalation | Architectural decision: Modal worker uses signed URLs only; no DB credentials in container |
| Therapist triggering pipeline for other therapist's reading | Privilege escalation | Trigger route checks `auth.uid() = therapist_id` before spawn |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | HMAC header name `X-Modal-Signature`, format `sha256=<hex>`, signing string `${timestamp}.${rawBody}` | Architecture Pattern 3 + webhook code | Modal or the project may decide a different convention; low risk since both sides are in-project |
| A2 | Daugman polar resolution POLAR_RADIAL=64, POLAR_ANGULAR=512 | Pattern 6 | Wrong resolution won't break the pipeline but affects feature detection density; calibrate with fixtures |
| A3 | CLAHE iris-specific params clipLimit=2.0, tileGridSize=(4,8) | Pattern 7 | Over/under enhancement of fiber texture; calibrate with fixtures per D-X3 |
| A4 | Weighted average photometric composition with weights {frontal:0.4, lateral:0.4, backlight:0.2} | Pattern 8 / Code Examples | Backlight weight could be higher or lower; depends on actual image quality from PWA/upload |
| A5 | LAB color space + k=3 for iris color classification | Pattern 8 | HSV may perform equally well; k=2 or k=4 possible; calibrate with fixtures |
| A6 | Hough defaults dp=1.0, param1=100, param2=40, minRadius=80, maxRadius=200 | Pattern 5 | These are starting values; production accuracy requires calibration against founder fixtures |
| A7 | `cv2.INTER_LINEAR` as Daugman interpolation method | Pattern 6 | INTER_CUBIC slightly better quality; INTER_LINEAR is sufficient for MVP |
| A8 | `X-Modal-Timestamp` replay protection (±5 min window) | Pattern 3 / Security | If Modal retry interval > 5 min, legitimate retries would be rejected; adjust window if needed |

---

## Open Questions

1. **`MODAL_ANALYZE_ENDPOINT_URL` format after `modal deploy`**
   - What we know: Modal web endpoints follow a deterministic URL pattern based on workspace/app/function name.
   - What's unclear: Exact URL format (e.g., `https://<workspace>--aurel-iris-vision-analyze-iris-endpoint.modal.run`).
   - Recommendation: Run `modal deploy modal_app.py` in a dev session and capture the URL; add to `.env.example` and Vercel env vars.

2. **`createSignedUrls` (plural) vs 6 × `createSignedUrl` (singular)**
   - What we know: `createSignedUrl` (singular) confirmed in @supabase/supabase-js 2.105.1.
   - What's unclear: Whether `createSignedUrls` (plural batch) is available in this version.
   - Recommendation: Use 6 parallel `Promise.all()` calls with `createSignedUrl` (singular) as confirmed safe; batch variant is a performance optimization for Wave 2+.

3. **Jensen map sector-hour mapping for all 12 sectors**
   - What we know: CONTEXT.md provides examples for hours 1, 6, 7, 9.
   - What's unclear: All 12 sectors for both eyes (founder validates).
   - Recommendation: Planner generates a draft `jensen-map.json` based on Jensen Vol. 1 (1982) knowledge, leaves TODO for founder sign-off before final commit.

4. **MediaPipe left/right eye anatomical vs camera-perspective orientation**
   - What we know: FaceLandmarker assigns left/right from subject's perspective; may be mirror-image of camera frame.
   - What's unclear: How this interacts with cropped single-eye photos (Fase 3 PWA crops to eye region).
   - Recommendation: Add orientation assertion to `test_detect.py`: for a frontal photo of right eye, the detected iris center should be in the right half of the image.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python | vision-service tests, CI | ✓ | 3.10.11 (local) | — |
| Node.js | Next.js trigger/webhook tests | ✓ | 22.14.0 | — |
| npm | package installs | ✓ | 11.13.0 | — |
| modal CLI | `modal deploy`, `modal serve` | ✗ | — | Install: `pip install modal` (1.4.2); requires MODAL_TOKEN_ID/SECRET |
| opencv-python-headless | CI tests | ✗ (not installed locally) | — | Install in virtual env: `pip install opencv-python-headless==4.13.0.92` |
| mediapipe | CI tests | ✗ (not installed locally) | — | Install: `pip install mediapipe==0.10.35` |
| pydantic | CI tests | ✓ (system) | 2.13.3 | — |
| pytest | vision-service CI | ✗ (not in requirements.txt yet) | — | Add to requirements.txt; `pip install pytest` |
| GitHub Actions runner | CI | ✗ (workflow file not yet created) | — | Create `.github/workflows/vision-service-tests.yml` in Wave 0 |

**Missing dependencies with no fallback:**
- Modal CLI: must be installed and authenticated before `modal deploy`.
- GitHub Actions workflow: must be created for automated CI.

**Missing dependencies with fallback:**
- `opencv-python-headless`, `mediapipe`: not installed locally but available on PyPI; Wave 0 sets up virtual env or CI handles installs.

---

## Sources

### Primary (HIGH confidence)
- `vision-service/modal_app.py`, `vision-service/requirements.txt`, `vision-service/pipeline/*.py` — existing skeleton verified by direct file read
- `apps/web/package.json` — exact library versions including @supabase/supabase-js 2.105.1, zod 4.4.1, next 15.5.15
- `pip index versions modal` — Modal SDK 1.4.2 is current (verified 2026-05-03)
- `pip index versions mediapipe` — mediapipe 0.10.35 is current (verified 2026-05-03)
- `pip index versions opencv-python-headless` — 4.13.0.92 (verified 2026-05-03)
- `pip index versions pydantic` — 2.13.3 (verified 2026-05-03)
- `pip index versions torch` — 2.11.0 (verified 2026-05-03)
- npm: `modal` package version 0.7.4 (npm view, April 2026)
- Node.js v22.14.0, npm 11.13.0 (local env)

### Secondary (MEDIUM confidence)
- [modal.com/docs/examples/doc_ocr_webapp](https://modal.com/docs/examples/doc_ocr_webapp) — canonical spawn pattern (`call.object_id`)
- [modal.com/docs/reference/modal.current_function_call_id](https://modal.com/docs/reference/modal.current_function_call_id) — confirmed API for getting call_id inside function
- [modal.com/docs/guide/webhook-proxy-auth](https://modal.com/docs/guide/webhook-proxy-auth) — `Modal-Key` / `Modal-Secret` headers
- [modal.com/blog/sdk-javascript-go](https://modal.com/blog/sdk-javascript-go) — JS SDK spawn "coming soon" as of April 2026
- [github.com/modal-labs/modal-client/js/examples/function-spawn.ts](https://raw.githubusercontent.com/modal-labs/modal-client/main/js/examples/function-spawn.ts) — JS SDK API (`fromName`, `spawn`, `get`)
- [ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/python](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/python) — Tasks API for static image mode
- [supabase.com/docs/reference/javascript/storage-from-createsignedurl](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl) — `createSignedUrl(path, expiresIn)` return shape `data.signedUrl`
- [github.com/supabase/storage-js/pull/94](https://github.com/supabase/storage-js/pull/94) — confirmed `signedUrl` lowercase camelCase fix
- [docs.pydantic.dev/latest/concepts/models](https://docs.pydantic.dev/latest/concepts/models) — `model_validate`, `model_validator`
- [docs.opencv.org/4.x/d3/de5/tutorial_js_houghcircles.html](https://docs.opencv.org/4.x/d3/de5/tutorial_js_houghcircles.html) — HoughCircles parameters
- [docs.opencv.org/3.4/d6/db6/classcv_1_1CLAHE.html](https://docs.opencv.org/3.4/d6/db6/classcv_1_1CLAHE.html) — CLAHE defaults

### Tertiary (LOW confidence / ASSUMED — see Assumptions Log)
- HMAC webhook signing convention (`X-Modal-Signature`, `${timestamp}.${rawBody}` format) — adapted from Stripe/GitHub conventions; neither is Modal-standard for user-coded callbacks
- Daugman polar resolution (64×512) — training knowledge + open implementations; not pinned to verified primary source in this session
- CLAHE iris-specific parameter values (clipLimit=2.0, tileGridSize=(4,8))
- Photometric composition weights {frontal:0.4, lateral:0.4, backlight:0.2}
- LAB color space + k=3 for iris color clustering

---

## Metadata

**Confidence breakdown:**
- Modal trigger integration: HIGH — canonical doc_ocr_webapp pattern verified; JS SDK spawn limitation verified
- MediaPipe Tasks API: HIGH — official docs confirmed; iris indices 468–477 confirmed
- HoughCircles defaults: MEDIUM — starting values from literature; calibration required
- Daugman polar: MEDIUM — known algorithm; resolution ASSUMED
- CLAHE params: MEDIUM — defaults verified; iris-specific values ASSUMED
- HSV/LAB clustering: MEDIUM — approach verified; specific k and weights ASSUMED
- Pydantic v2 schema: HIGH — version and API confirmed
- HMAC webhook: HIGH (pattern) / ASSUMED (exact header names)
- Supabase signed URLs: HIGH — API confirmed; `data.signedUrl` case confirmed

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (30 days) — Modal SDK evolves quickly; recheck JS SDK spawn availability before Phase 6+
