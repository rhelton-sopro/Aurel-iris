# Phase 5: Pipeline de visão (Modal) - Pattern Map

**Mapped:** 2026-05-03
**Files analyzed:** 20
**Analogs found:** 17 / 20

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `vision-service/modal_app.py` | Python module (orchestrator) | event-driven + request-response | `vision-service/modal_app.py` (skeleton itself) | self (replace NotImplementedError) |
| `vision-service/pipeline/detect.py` | Python module (stage) | transform | `vision-service/pipeline/detect.py` (skeleton) | self (implement stub) |
| `vision-service/pipeline/segment.py` | Python module (stage) | transform | `vision-service/pipeline/segment.py` (skeleton) | self (implement stub) |
| `vision-service/pipeline/compose.py` | Python module (stage) | transform | `vision-service/pipeline/compose.py` (skeleton) | self (implement stub) |
| `vision-service/pipeline/normalize.py` | Python module (stage) | transform | `vision-service/pipeline/normalize.py` (skeleton) | self (implement stub) |
| `vision-service/pipeline/enhance.py` | Python module (stage) | transform | `vision-service/pipeline/enhance.py` (skeleton) | self (implement stub) |
| `vision-service/pipeline/features.py` | Python module (stage) | transform | `vision-service/pipeline/features.py` (skeleton) | self (implement stub) |
| `vision-service/pipeline/iris_maps.py` | Python utility | transform | `vision-service/pipeline/features.py` skeleton docstring | partial (new helper, no direct analog) |
| `vision-service/pipeline/schemas.py` (or `pipeline/schemas.py`) | Python model (Pydantic) | transform | no existing Pydantic model in repo | no analog — use RESEARCH.md Pattern 9 |
| `vision-service/data/jensen-map.json` | data asset | — | `apps/web/scripts/audit-vocabulary.mjs` (JSON target) | partial — format convention only |
| `vision-service/tests/conftest.py` | test config/fixture | — | `apps/web/lib/capture/upload.test.ts` (mock factory pattern) | partial (different language) |
| `vision-service/tests/test_detect.py` | test | structural+metric | `apps/web/lib/capture/quality-scoring.test.ts` | role-match (hybrid structural+metric) |
| `vision-service/tests/test_segment.py` | test | structural+metric | `apps/web/lib/capture/quality-scoring.test.ts` | role-match |
| `vision-service/tests/test_compose.py` | test | structural | `apps/web/lib/capture/upload.test.ts` | role-match |
| `vision-service/tests/test_normalize.py` | test | structural | `apps/web/lib/capture/upload.test.ts` | role-match |
| `vision-service/tests/test_enhance.py` | test | structural | `apps/web/lib/capture/upload.test.ts` | role-match |
| `vision-service/tests/test_features.py` | test | structural+metric | `apps/web/lib/capture/quality-scoring.test.ts` | role-match |
| `vision-service/tests/fixtures/CONSENT.md` | data asset | — | no analog | no analog — plain documentation |
| `vision-service/scripts/audit_vocabulary.py` | utility script | batch | `apps/web/scripts/audit-vocabulary.mjs` | exact (same logic, different language) |
| `vision-service/pytest.ini` | config | — | no analog in repo (no existing Python tests) | no analog — use standard pytest conventions |
| `apps/web/app/api/readings/[id]/process/route.ts` | route handler | request-response | `apps/web/app/api/capture/validate/route.ts` | role-match (auth gate + body parse + external call + NextResponse) |
| `apps/web/app/api/vision/webhook/route.ts` | route handler | event-driven | `apps/web/app/api/capture/validate/route.ts` | role-match (auth/validation gate + error handling) |
| `apps/web/lib/vision/modal-client.ts` | utility | request-response | `apps/web/lib/capture/upload.ts` | role-match (thin client wrapper + typed args) |
| `apps/web/lib/vision/hmac.ts` | utility | request-response | `apps/web/lib/capture/storage-path.ts` | role-match (pure utility function, no side effects) |
| `apps/web/app/actions/readings.ts` (modify) | server action | request-response | `apps/web/app/actions/readings.ts` itself | self (extend `finalizeReadingAction`) |
| `apps/web/app/(dashboard)/leituras/page.tsx` (modify) | page component (SSR) | request-response | `apps/web/app/(dashboard)/leituras/page.tsx` itself | self (add badge + Reprocessar) |
| `apps/web/components/readings/StatusBadge.tsx` | component | — | `apps/web/components/ui/badge.tsx` + `leituras/page.tsx` inline badge | exact (wraps shadcn Badge) |
| `apps/web/components/readings/ReprocessButton.tsx` | component | request-response | `apps/web/components/clientes/clients-table.tsx` (Button usage) | role-match (client component + Button + fetch POST) |
| `apps/web/.env.example` (modify) | config | — | `apps/web/.env.example` itself | self (add one line) |
| `.github/workflows/vision-service-tests.yml` | CI config | — | no analog (no existing GH Actions workflows) | no analog — use pytest standard |

---

## Pattern Assignments

### `vision-service/modal_app.py` (orchestrator — replace skeleton)

**Analog:** `vision-service/modal_app.py` (own skeleton, lines 1–62)

**Current skeleton pattern** (lines 14–27 — image definition to keep/extend):
```python
import modal

app = modal.App("aurel-iris-vision")

image = modal.Image.debian_slim().pip_install(
    "opencv-python-headless",
    "numpy",
    "scikit-image",
    "mediapipe",
    "torch",
    "torchvision",
    "Pillow",
    "supabase",
)
```

**Core pattern to implement** (from RESEARCH.md Pattern 1, lines 286–371):
- Split into two Modal functions: `run_pipeline` (GPU worker, `@app.function(gpu="T4", timeout=120)`) and `analyze_iris_endpoint` (`@app.function` + `@modal.fastapi_endpoint(method="POST")`).
- `analyze_iris_endpoint` spawns `run_pipeline` and returns `{"call_id": call.object_id}` synchronously (< 1s).
- `run_pipeline` calls `_post_webhook()` at the end with full `IrisFeatures.model_dump()`.
- Image definition must add `pydantic==2.13.3`, `httpx`, `.apt_install("libgl1")`, and `.run_commands("wget -O /models/face_landmarker.task ...")` for model pre-bake.

**HMAC signing pattern for `_post_webhook`** (from RESEARCH.md Code Examples, lines 1047–1087):
```python
import hmac, hashlib, time, httpx, os, json

def _post_webhook(reading_id, call_id, status, **kwargs):
    payload = {"reading_id": reading_id, "status": status, "modal_call_id": call_id, **kwargs}
    body = json.dumps(payload)
    timestamp = str(int(time.time()))
    secret = os.environ["MODAL_WEBHOOK_SECRET"]
    sig = hmac.new(
        secret.encode(),
        f"{timestamp}.{body}".encode(),
        hashlib.sha256
    ).hexdigest()
    httpx.post(
        os.environ["MODAL_WEBHOOK_URL"],
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Modal-Signature": f"sha256={sig}",
            "X-Modal-Timestamp": timestamp,
        },
        timeout=30,
    )
```

**Deviation:** `supabase` pip package removed from image (pipeline only uses signed URLs, no Supabase credentials in Modal container per CONTEXT D-T6 + anti-pattern note). Add `httpx` instead.

---

### `vision-service/pipeline/detect.py` (Stage 1 — implement stub)

**Analog:** `vision-service/pipeline/detect.py` (own skeleton, lines 1–25) + RESEARCH.md Pattern 4

**Stub signature to preserve** (lines 11–24):
```python
def find_iris(image):
    """
    Args:
        image: numpy array (H, W, 3), BGR or RGB.
    Returns:
        dict with iris center (x, y), radius, and landmarks.
    """
    raise NotImplementedError("pipeline.detect.find_iris — implement in Phase 5")
```

**Implementation pattern** (RESEARCH.md Pattern 4, lines 548–625):
- Use `mp.tasks.vision.FaceLandmarker` (Tasks API, not legacy `mp.solutions.face_mesh`).
- Module-level `_landmarker = None`; lazy init on first call with `get_landmarker()`.
- `LEFT_IRIS = [468, 469, 470, 471, 472]`, `RIGHT_IRIS = [473, 474, 475, 476, 477]`.
- Return dict: `{"center": (cx, cy), "radius": float, "landmarks_raw": [...]}`.
- On `not result.face_landmarks`: `raise ValueError("mediapipe_no_face_detected")` (caught by orchestrator for D-F1 soft degradation).

**Deviation from stub:** Add imports (`import mediapipe as mp`, `import numpy as np`, `import cv2`). Model path is `/models/face_landmarker.task` (pre-baked in Modal image).

---

### `vision-service/pipeline/segment.py` (Stage 2 — implement stub)

**Analog:** `vision-service/pipeline/segment.py` (own skeleton) + RESEARCH.md Pattern 5

**Stub signature to preserve** (lines 11–25):
```python
def iris_mask(image, detection):
    """
    Args:
        image: numpy array (H, W, 3).
        detection: dict from pipeline.detect.find_iris.
    Returns:
        dict with binary_mask (H, W, bool) and segmented_image.
    """
```

**Implementation pattern** (RESEARCH.md Pattern 5, lines 631–691):
```python
HOUGH_DEFAULTS = {
    "dp": 1.0, "minDist": 100, "param1": 100, "param2": 40,
    "minRadius": 80, "maxRadius": 200,
}

def iris_mask(image, detection):
    gray_blur = cv2.medianBlur(cv2.cvtColor(image, cv2.COLOR_RGB2GRAY), 5)
    circles = cv2.HoughCircles(gray_blur, cv2.HOUGH_GRADIENT, **HOUGH_DEFAULTS)
    if circles is None:
        cx, cy = detection["center"]
        r = detection["radius"]
        # D-F1 soft degradation fallback
    else:
        cx, cy, r = circles[0][0]  # closest to MediaPipe estimate
    # ... build mask + return dict
```

**Deviation:** Sort Hough candidates by proximity to `detection["center"]` (Pitfall 7 guard). Collect `warnings` list passed in from orchestrator.

---

### `vision-service/pipeline/compose.py` (Stage 3 — implement stub)

**Analog:** `vision-service/pipeline/compose.py` (own skeleton) + RESEARCH.md Code Examples (lines 1008–1043)

**Stub signature to preserve** (lines 11–27):
```python
def photometric_combine(segmented_images):
    """
    Args:
        segmented_images: list of dicts from pipeline.segment.iris_mask
                          (one per angle: frontal, lateral, backlight).
    Returns:
        Composite image enhanced for downstream feature extraction.
    """
```

**Implementation pattern** (RESEARCH.md, lines 1015–1042):
```python
WEIGHTS = {"frontal": 0.4, "lateral": 0.4, "backlight": 0.2}

def photometric_combine(segmented_images):
    composite = None
    total_weight = 0.0
    for seg in segmented_images:
        w = WEIGHTS.get(seg.get("angle", "frontal"), 0.33)
        img = seg["segmented_image"].astype(np.float32)
        composite = img * w if composite is None else composite + img * w
        total_weight += w
    return {
        "segmented_image": np.clip(composite / total_weight, 0, 255).astype(np.uint8),
        "iris_circle": segmented_images[0]["iris_circle"],
        "pupil_circle": segmented_images[0].get("pupil_circle"),
    }
```

**Deviation:** None significant. Weights are calibrated defaults (ASSUMED per RESEARCH.md); fixture calibration may adjust.

---

### `vision-service/pipeline/normalize.py` (Stage 4 — implement stub)

**Analog:** `vision-service/pipeline/normalize.py` (own skeleton) + RESEARCH.md Pattern 6

**Stub signature to preserve** (lines 11–26):
```python
def daugman_polar(composite_image):
    """
    Args:
        composite_image: output of pipeline.compose.photometric_combine.
    Returns:
        Rectangular polar image of the iris.
    """
```

**Implementation pattern** (RESEARCH.md Pattern 6, lines 698–742):
- Output shape: `(64, 512, 3)` — standard biometric convention (POLAR_RADIAL=64, POLAR_ANGULAR=512).
- Extract `cx, cy, r_iris` from `composite_image["iris_circle"]`; `r_pupil` from `composite_image.get("pupil_circle")` with fallback `r_iris * 0.35`.
- Use `cv2.remap()` with pre-computed maps (RESEARCH.md "Don't Hand-Roll" note, line 921) rather than Python loops.

**Deviation:** Replace the Python loop example in RESEARCH.md with `cv2.remap()` for performance (SIMD-optimized; the loop example in research is illustrative only).

---

### `vision-service/pipeline/enhance.py` (Stage 5 — implement stub)

**Analog:** `vision-service/pipeline/enhance.py` (own skeleton) + RESEARCH.md Pattern 7

**Stub signature to preserve** (lines 8–21):
```python
def clahe(normalized_image):
    """
    Args:
        normalized_image: output of pipeline.normalize.daugman_polar.
    Returns:
        Enhanced image ready for feature extraction.
    """
```

**Implementation pattern** (RESEARCH.md Pattern 7, lines 750–771):
```python
def clahe(normalized: np.ndarray) -> np.ndarray:
    # Apply to L-channel of LAB to avoid hue/saturation shift (anti-pattern note)
    lab = cv2.cvtColor(normalized, cv2.COLOR_RGB2LAB)
    l_chan, a_chan, b_chan = cv2.split(lab)
    clahe_obj = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 8))
    l_enhanced = clahe_obj.apply(l_chan)
    return cv2.cvtColor(cv2.merge([l_enhanced, a_chan, b_chan]), cv2.COLOR_LAB2RGB)
```

**Deviation:** CLAHE on LAB L-channel only (anti-pattern = applying to RGB directly shifts hue). Parameters `clipLimit=2.0, tileGridSize=(4,8)` are iris-specific starting defaults; fixture calibration may adjust.

---

### `vision-service/pipeline/features.py` (Stage 6 — implement stub)

**Analog:** `vision-service/pipeline/features.py` (own skeleton) + RESEARCH.md Pattern 8 (HSV/LAB clustering)

**Stub signature to extend** (lines 17–36):
```python
def extract_all(enhanced_image, composite_image):
    """
    Args:
        enhanced_image: output of pipeline.enhance.clahe.
        composite_image: output of pipeline.compose.photometric_combine
    Returns:
        Dict matching SPEC §4.3 per-eye shape: constitution, iris_color,
        fiber_density, collarette, pupil, sectors, rings, global_signs, image_quality.
    """
```

**New signature** (extend to accept `jensen_map` and `eye` params):
```python
def extract_all(enhanced_image, composite_image, jensen_map: dict, eye: str) -> dict:
```

**Color classification pattern** (RESEARCH.md Pattern 8, lines 795–820):
```python
def classify_iris_color(masked_image):
    lab = cv2.cvtColor(masked_image, cv2.COLOR_RGB2LAB)
    pixels = lab.reshape(-1, 3).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
    _, labels, centers = cv2.kmeans(pixels, 3, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
    counts = np.bincount(labels.flatten())
    primary_center = centers[np.argmax(counts)]
    # ... map LAB center to iris color name
```

**Deviation:** Jensen map lookup uses `from pipeline.iris_maps import load_jensen_map` (loaded once via `@functools.lru_cache`). Sectors populated as `[{"hour": h, "zones": jensen_map[eye][str(h)], "findings": [...]} for h in range(1,13)]`.

---

### `vision-service/pipeline/iris_maps.py` (new helper — no direct analog)

**Closest analog:** RESEARCH.md Pitfall 6 description (lines 959–963) + `apps/web/lib/capture/storage-path.ts` (pure utility with validation)

**Pattern to follow:**
```python
import json
import functools
from pathlib import Path

@functools.lru_cache(maxsize=None)
def load_jensen_map() -> dict:
    """Load and cache jensen-map.json. CWD-independent path (Pitfall 6 fix)."""
    map_path = Path(__file__).parent.parent / "data" / "jensen-map.json"
    with open(map_path, encoding="utf-8") as f:
        return json.load(f)
```

**Deviation:** No analog in repo. Follows functional utility pattern from `storage-path.ts`: single responsibility, pure, no side effects. `@functools.lru_cache` is the canonical Python equivalent of module-level singletons.

---

### `vision-service/pipeline/schemas.py` (new Pydantic model — no direct analog)

**Closest analog:** RESEARCH.md Pattern 9 (lines 822–894) — full Pydantic v2 schema defined there.

**Core Pydantic v2 pattern** (RESEARCH.md lines 836–894):
```python
from pydantic import BaseModel, Field, model_validator
from typing import Optional
from enum import Enum

class IrisFeatures(BaseModel):
    right_eye: Optional[EyeFeatures] = None   # None = D-F1 per-eye degradation
    left_eye: Optional[EyeFeatures] = None
    asymmetry_notes: list[str] = []
    processing_metadata: ProcessingMetadata

    @model_validator(mode="after")
    def at_least_one_eye(self) -> "IrisFeatures":
        return self
```

**Deviation:** Use `model_validate()` (not `parse_obj()`) — Pydantic v2 breaking change (RESEARCH.md State of the Art table). Validator is permissive per D-F1 (both eyes null is a pipeline error caught before `model_validate`, not a schema rejection).

---

### `vision-service/data/jensen-map.json` (new data asset)

**Closest analog:** `apps/web/scripts/audit-vocabulary.mjs` — this script will audit the JSON file. No structural analog exists.

**Required structure** (CONTEXT.md D-J4):
```json
{
  "map_name": "jensen",
  "right": {
    "1": ["cérebro frontal", "lobo frontal"],
    "7": ["fígado", "vesícula biliar"],
    "6": ["apêndice", "intestino delgado"]
  },
  "left": {
    "1": ["cérebro frontal", "lobo frontal"],
    "9": ["coração", "esternônio"],
    "6": ["intestino delgado"]
  }
}
```

**Deviation:** All zone strings in pt-BR per D-J2. Must pass `pnpm audit:vocabulary` (no `diagnóstico`/`tratamento`/`cura`). Founder validates before commit per D-J3.

---

### `vision-service/tests/conftest.py` (new pytest fixtures)

**Closest analog:** `apps/web/lib/capture/upload.test.ts` (lines 1–32 — mock factory + shared args pattern)

**Pattern to mirror in Python:**
```python
# conftest.py
import pytest
import json
import cv2
import numpy as np
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent / "fixtures"
IRIS_DIR = FIXTURES_DIR / "iris"

@pytest.fixture(scope="session")
def expected():
    """Load founder-annotated ground-truth from expected.json once per session."""
    with open(FIXTURES_DIR / "expected.json", encoding="utf-8") as f:
        return json.load(f)

@pytest.fixture(scope="session")
def iris_images():
    """Load all fixture JPEGs as {name: np.ndarray RGB} dict."""
    imgs = {}
    for p in sorted(IRIS_DIR.glob("*.jpg")):
        bgr = cv2.imread(str(p))
        imgs[p.stem] = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    return imgs
```

**Deviation:** Python `pytest` fixtures vs vitest `vi.fn()` mocks — language difference. `scope="session"` loads I/O-heavy fixtures once (analogous to module-level `makeMockSupabase` helper in upload.test.ts).

---

### `vision-service/tests/test_detect.py` through `test_features.py` (new test files)

**Closest analog:** `apps/web/lib/capture/quality-scoring.test.ts` (structural + metric hybrid pattern)

**TypeScript pattern to mirror in Python** (quality-scoring.test.ts lines 1–30):
```typescript
// vitest: describe + it, PERFECT fixture, structural + threshold assertions
const PERFECT: QualityCheck = { irisDetected: true, irisCenteredness: 1, ... }
describe('levelFromScore', () => {
  it('< 0.40 → ruim', () => expect(levelFromScore(0.30)).toBe('ruim'))
})
```

**Python pytest equivalent:**
```python
# test_detect.py
import pytest
import numpy as np
from pipeline.detect import find_iris

def test_find_iris_returns_required_keys(iris_images):
    """Structural: output has center, radius, landmarks_raw."""
    img = next(iter(iris_images.values()))
    result = find_iris(img)
    assert "center" in result
    assert "radius" in result
    assert result["radius"] > 0

def test_find_iris_iou_above_threshold(iris_images, expected):
    """Metric: IoU of detected bbox vs founder-annotated bbox >= 0.7 (D-X3)."""
    for name, img in iris_images.items():
        if name not in expected.get("iris_bbox", {}):
            continue
        result = find_iris(img)
        iou = _compute_iou(result, expected["iris_bbox"][name])
        assert iou >= 0.7, f"{name}: IoU={iou:.3f} < 0.7"
```

**Deviation:** Python `pytest` + `conftest.py` fixtures instead of vitest. Same hybrid structural + metric assertion philosophy (D-X3).

---

### `vision-service/scripts/audit_vocabulary.py` (new Python vocabulary audit)

**Closest analog:** `apps/web/scripts/audit-vocabulary.mjs` (lines 1–71 — exact same logic, different language)

**JavaScript pattern to translate to Python** (audit-vocabulary.mjs lines 1–71):
```javascript
const PATTERN = /diagnóstico|tratamento|cura/i
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const DIRS = ['app', 'components']
// collectFiles() → recurse + match extension → check each line → exit 1 if match
```

**Python equivalent:**
```python
#!/usr/bin/env python3
import re, sys
from pathlib import Path

PATTERN = re.compile(r'diagnóstico|tratamento|cura', re.IGNORECASE)
EXTENSIONS = {'.py', '.json', '.md'}
DIRS = ['pipeline', 'data', 'scripts']
ROOT = Path(__file__).parent.parent

matches = []
for dir_name in DIRS:
    for path in (ROOT / dir_name).rglob('*'):
        if path.suffix in EXTENSIONS and path.is_file():
            for i, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
                if PATTERN.search(line):
                    matches.append(f"{path}:{i}: {line.strip()}")

if matches:
    print("VOCAB FAIL — vocabulário proibido encontrado:")
    for m in matches: print(m)
    sys.exit(1)
print("OK: vocabulário proibido ausente")
```

**Deviation:** Scans `pipeline/`, `data/`, `scripts/` instead of `app/` + `components/`. Adds `.json` and `.md` to extensions (to catch `jensen-map.json` and `CONSENT.md`).

---

### `apps/web/app/api/readings/[id]/process/route.ts` (new route handler)

**Closest analog:** `apps/web/app/api/capture/validate/route.ts` (lines 1–185)

**Auth gate pattern** (validate/route.ts lines 66–72):
```typescript
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }
  // ...
}
```

**Service role + external call pattern** (RESEARCH.md Pattern 2, lines 378–459):
```typescript
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  // 1. Auth gate (user client)
  // 2. Guard: reading owned by user + status in ['pending', 'failed']
  // 3. Generate 6 signed URLs via service client (expiresIn: 600 per D-T6)
  // 4. Write processing placeholder + status='processing' (D-T5)
  // 5. POST to Modal web endpoint with Modal-Key/Modal-Secret headers
  // 6. Update modal_call_id from response
  // 7. Return 202
}
```

**Error handling pattern** (validate/route.ts lines 130–136):
```typescript
} catch (err) {
  const msg = err instanceof Error ? err.message : 'unknown'
  console.error('[process] error:', msg)
  return NextResponse.json({ error: 'Internal error', detail: msg }, { status: 500 })
}
```

**Deviation from analog:** Uses dynamic route segment `{ params }` (not in validate/route.ts which is a static path). Returns `202` (not `200`). Uses service-role Supabase client (`createServiceClient`) for storage signed URL generation and readings UPDATE — route auth validates user ownership first, then upgrades to service role. No `NextResponse.json` needed for 202 (use `new Response(null, { status: 202 })`). `export const runtime = 'nodejs'` required (like validate/route.ts line 6) for Node.js crypto.

---

### `apps/web/app/api/vision/webhook/route.ts` (new route handler — HMAC webhook)

**Closest analog:** `apps/web/app/api/capture/validate/route.ts` (auth + validation + external service call pattern)

**Critical deviations from analog:**
1. No user auth (`supabase.auth.getUser`) — request comes from Modal, not browser
2. HMAC validation replaces JWT auth (RESEARCH.md Pattern 3, lines 466–540)
3. `request.text()` MUST be called first (before any `.json()`) to preserve raw bytes for HMAC (Pitfall 3)
4. Uses service-role client only (no user session)

**HMAC + status guard pattern** (RESEARCH.md Pattern 3, lines 467–538):
```typescript
import { createHmac, timingSafeEqual } from 'node:crypto'

export async function POST(request: Request) {
  const rawBody = await request.text()  // FIRST — before any JSON parse
  const signature = request.headers.get('x-modal-signature')
  const timestamp = request.headers.get('x-modal-timestamp')
  if (!signature || !timestamp) return new Response('Missing headers', { status: 401 })

  // Replay protection (±5 min)
  if (Math.abs(Math.floor(Date.now()/1000) - parseInt(timestamp, 10)) > 300) {
    return new Response('Timestamp too old', { status: 401 })
  }

  // HMAC-SHA256 of `${timestamp}.${rawBody}` (Stripe convention)
  const expected = createHmac('sha256', process.env.MODAL_WEBHOOK_SECRET!)
    .update(`${timestamp}.${rawBody}`).digest('hex')
  if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature.replace('sha256=', ''), 'hex'))) {
    return new Response('Invalid signature', { status: 401 })
  }

  // Status guard (D-T4) + atomic UPDATE (D-F5)
}
```

**Zod validation pattern** (from actions/readings.ts createReadingSchema.safeParse pattern):
```typescript
const body = webhookBodySchema.safeParse(JSON.parse(rawBody))
if (!body.success) return new Response('Bad payload', { status: 400 })
```

**Deviation from validate/route.ts:** No `export const runtime = 'nodejs'` needed explicitly (route.ts files default to Node.js in Next.js 15 App Router). `revalidatePath('/leituras')` called after successful UPDATE.

---

### `apps/web/lib/vision/modal-client.ts` (new utility)

**Closest analog:** `apps/web/lib/capture/upload.ts` (lines 1–99)

**Structural pattern to mirror** (upload.ts lines 1–27):
```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export interface UploadArgs {
  supabase: SupabaseClient<Database>
  blob: Blob
  // ... typed args
}

export interface UploadResult {
  path: string
}

export async function uploadCaptureImage(args: UploadArgs): Promise<UploadResult> {
  // ... implementation
}
```

**Pattern for modal-client.ts:**
```typescript
export interface TriggerArgs {
  readingId: string
}
export interface TriggerResult {
  callId: string
}

export async function triggerVisionPipeline(args: TriggerArgs): Promise<TriggerResult> {
  const res = await fetch(process.env.MODAL_ANALYZE_ENDPOINT_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Modal-Key': process.env.MODAL_TOKEN_ID!,
      'Modal-Secret': process.env.MODAL_TOKEN_SECRET!,
    },
    body: JSON.stringify({ reading_id: args.readingId, image_urls: args.imageUrls }),
  })
  if (!res.ok) throw new Error(`Modal trigger failed: ${res.status}`)
  const { call_id } = await res.json()
  return { callId: call_id }
}
```

**Deviation from upload.ts:** No Supabase client dependency (server env vars only). No `signal?` abort support (fire-and-forget trigger). Signed URL generation stays in the route handler, not in this utility.

---

### `apps/web/lib/vision/hmac.ts` (new utility)

**Closest analog:** `apps/web/lib/capture/storage-path.ts` (lines 1–37 — pure utility, single responsibility, no side effects)

**Pattern to mirror** (storage-path.ts lines 19–37):
```typescript
// Single exported function, typed args, throws on invalid input
export function buildOriginalStoragePath(
  therapistId: string, readingId: string, eye: Eye, angle: Angle
): string {
  validateSegment(therapistId, 'therapistId')
  validateSegment(readingId, 'readingId')
  return `${therapistId}/${readingId}/originais/${eye}_${angle}.jpg`
}
```

**hmac.ts pattern:**
```typescript
import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyHmacSignature(
  rawBody: string,
  signatureHeader: string,
  timestampHeader: string,
  secret: string,
): boolean {
  const expected = createHmac('sha256', secret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest('hex')
  const exp = Buffer.from(expected, 'hex')
  const recv = Buffer.from(signatureHeader.replace('sha256=', ''), 'hex')
  if (exp.length !== recv.length) return false
  return timingSafeEqual(exp, recv)
}
```

**Deviation:** Uses Node.js `crypto` built-in (server-only). Must NOT be imported in client components. Add `// server-only` comment or mark as server utility.

---

### `apps/web/app/actions/readings.ts` (modify — extend `finalizeReadingAction`)

**Analog:** `apps/web/app/actions/readings.ts` itself (lines 98–117 — the function to extend)

**Current TODO to replace** (lines 112–116):
```typescript
// Fase 5: muda status para 'processing' aqui e dispara triggerVisionPipeline(reading_id).
// Nesta fase apenas confirmamos a sessão e revalidamos os caches relevantes.
revalidatePath('/leituras')
revalidatePath(`/leituras/${parsed.data.reading_id}`)
return {}
```

**Pattern for the extension** (mirrors existing auth + readingIdSchema.safeParse pattern in same file):
```typescript
// After the safeParse guard, fetch the process route:
const res = await fetch(
  `${process.env.NEXT_PUBLIC_SITE_URL}/api/readings/${parsed.data.reading_id}/process`,
  { method: 'POST', headers: { Cookie: ... } }
)
// D-T2: redirect immediately to /leituras regardless of trigger result
revalidatePath('/leituras')
redirect('/leituras')
```

**Deviation:** Internal server-to-server fetch requires forwarding the session cookie or using a shared internal secret. Planner must decide: option A (forward cookie from request context) or option B (server-side direct call to `triggerVisionPipeline` from modal-client.ts, bypassing the route). CONTEXT says "call the dedicated route for uniformity" — planner evaluates cookie forwarding in Next.js 15 App Router server actions.

---

### `apps/web/app/(dashboard)/leituras/page.tsx` (modify — add badge + Reprocessar)

**Analog:** `apps/web/app/(dashboard)/leituras/page.tsx` itself (lines 1–144)

**Existing inline badge pattern to replace/extend** (lines 119–125):
```typescript
<span className={cn(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  badgeClass,
)}>
  {badgeLabel}
</span>
```

**New pattern** (replace inline span with `StatusBadge` component + add `ReprocessButton`):
```typescript
// In the TableRow, Status cell:
<StatusBadge
  status={status}
  isRascunho={isRascunho}
  errorSummary={r.vision_features?.processing_metadata?.error_summary}
/>
// In the actions cell:
{status === 'failed' && <ReprocessButton readingId={r.id} />}
{isRascunho && <Link ...>Continuar</Link>}
```

**Deviation:** Must add `vision_features` to the Supabase query select clause to expose `error_summary` for the tooltip. Shape: `vision_features->processing_metadata->error_summary`. Existing `STATUS_LABEL` and `STATUS_CLASS` dicts can remain (used by `StatusBadge` internally or removed if component handles all styling).

---

### `apps/web/components/readings/StatusBadge.tsx` (new component)

**Closest analog:** `apps/web/components/ui/badge.tsx` (lines 1–52) + inline badge in `leituras/page.tsx` (lines 96–104)

**Badge component pattern** (badge.tsx lines 30–50):
```typescript
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
// badge.tsx uses base-ui's useRender + cva variants: "default" | "secondary" | "destructive" | "outline"
```

**Pattern for StatusBadge:**
```typescript
// server component (no 'use client' needed — no interactivity)
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

interface StatusBadgeProps {
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'edited'
  isRascunho?: boolean
  errorSummary?: string
}

export function StatusBadge({ status, isRascunho, errorSummary }: StatusBadgeProps) {
  // Map status to badge variant and label (pt-BR copy)
  // Wrap "failed" badge in <Tooltip> showing errorSummary (D-F2)
}
```

**Deviation from badge.tsx:** StatusBadge is a domain-specific wrapper, not a primitive. Tooltip wrapping for `failed` status uses the `TooltipProvider` from `tooltip.tsx` (lines 7–17 — `delay=0` default). Badge `variant` mapping: `ready` → `default`, `failed` → `destructive`, `processing` → `secondary`, `pending`/`edited` → `outline`.

---

### `apps/web/components/readings/ReprocessButton.tsx` (new component)

**Closest analog:** `apps/web/components/clientes/clients-table.tsx` (lines 1–14 — client component + Button + action)

**Pattern to mirror** (clients-table.tsx lines 1–8):
```typescript
'use client'
import { Button, buttonVariants } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
```

**ReprocessButton pattern:**
```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export function ReprocessButton({ readingId }: { readingId: string }) {
  const [pending, setPending] = useState(false)
  async function handleClick() {
    setPending(true)
    await fetch(`/api/readings/${readingId}/process`, { method: 'POST' })
    // No optimistic update — badge changes on next navigation (D-T2, no polling)
    setPending(false)
  }
  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={pending}>
      <RefreshCw className="mr-1" /> Reprocessar
    </Button>
  )
}
```

**Deviation:** `'use client'` required (onClick). No `router.refresh()` call — consistent with D-T2 (no client-side polling; terapeuta navigates manually to see updated status). Button disabled while `pending=true` (D-T3: "disabled enquanto status='processing'" — here disabled while the POST is in-flight).

---

### `apps/web/.env.example` (modify — add one line)

**Analog:** `apps/web/.env.example` itself (lines 1–33)

**Existing Modal section** (lines 17–20):
```
# Modal (Phase 5+)
MODAL_TOKEN_ID=
MODAL_TOKEN_SECRET=
MODAL_WEBHOOK_SECRET=
```

**Add one line after `MODAL_WEBHOOK_SECRET`:**
```
MODAL_ANALYZE_ENDPOINT_URL=
```

**Deviation:** None. Simple append to existing Modal section.

---

### `.github/workflows/vision-service-tests.yml` (new CI config — no analog)

**No existing workflows in the repo.** Pattern from RESEARCH.md Validation Architecture section (lines 1112–1143).

**Standard pytest GitHub Actions pattern:**
```yaml
name: vision-service tests

on:
  push:
    paths:
      - 'vision-service/**'
  pull_request:
    paths:
      - 'vision-service/**'

jobs:
  pytest:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.11"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
          cache: 'pip'
          cache-dependency-path: 'vision-service/requirements.txt'
      - run: pip install -r vision-service/requirements.txt
        working-directory: .
      - run: python -m pytest tests/ -x -q
        working-directory: vision-service
```

**Deviation:** Path filter to `vision-service/**` avoids running Python CI on Next.js-only changes. Python matrix is 3.11 only (D-X2 decision; expandable to 3.12 later). `torch` and GPU not needed in CI (D-X2: CPU-only).

---

## Shared Patterns

### Auth Gate (all Next.js route handlers)
**Source:** `apps/web/app/api/capture/validate/route.ts` lines 66–72
**Apply to:** `app/api/readings/[id]/process/route.ts` (user auth) — NOT to webhook (uses HMAC instead)
```typescript
const supabase = await createClient()
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (!user || authError) {
  return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
}
```

### Service Role Client
**Source:** RESEARCH.md Pattern 2 (line 410) — `createServiceClient()` for storage signed URLs and RLS-bypassing UPDATE
**Apply to:** `app/api/readings/[id]/process/route.ts`, `app/api/vision/webhook/route.ts`
**Note:** `apps/web/lib/supabase/service.ts` does NOT exist yet — must be created (mirrors `server.ts` pattern but uses `SUPABASE_SERVICE_ROLE_KEY`).

### Zod safeParse Validation
**Source:** `apps/web/app/actions/readings.ts` lines 58–63
**Apply to:** `app/api/vision/webhook/route.ts` (body shape validation after HMAC pass)
```typescript
const parsed = createReadingSchema.safeParse(data)
if (!parsed.success) {
  return { error: parsed.error.flatten().fieldErrors }
}
```

### `revalidatePath` after mutations
**Source:** `apps/web/app/actions/readings.ts` lines 85, 114
**Apply to:** `app/api/vision/webhook/route.ts` after successful UPDATE; `app/actions/readings.ts` finalizeReadingAction
```typescript
revalidatePath('/leituras')
```

### Python Stub-to-Implementation Pattern
**Source:** All 6 `vision-service/pipeline/*.py` skeleton files
**Apply to:** All 6 pipeline stage implementations
- Preserve docstring and function signature exactly
- Replace `raise NotImplementedError(...)` with actual implementation
- Add necessary imports at module top (not inside function)
- Module-level constants (e.g., `HOUGH_DEFAULTS`, `POLAR_RADIAL`) above the function

### pytest Fixture Loading via conftest.py
**Source:** `apps/web/lib/capture/upload.test.ts` lines 1–32 (mock factory pattern)
**Apply to:** All `vision-service/tests/test_*.py` files
- Share `iris_images` and `expected` fixtures via `conftest.py` (session-scoped)
- Structural assertion first, metric assertion second (mirrors PERFECT fixture + threshold pattern in quality-scoring.test.ts)

---

## `apps/web/lib/supabase/service.ts` — Missing Dependency (Must Create)

**Note:** The process route and webhook handler both need a Supabase service-role client, but `apps/web/lib/supabase/service.ts` does not exist in the repo.

**Pattern to follow:** `apps/web/lib/supabase/server.ts` (lines 1–29)

```typescript
// apps/web/lib/supabase/service.ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
```

**Deviation from server.ts:** No cookie management. Synchronous (not async). Uses service role key. Returns a standard client, not SSR client. This file is implicitly required by the process route and webhook — planner should add it as a Wave 0 task.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `vision-service/pipeline/schemas.py` | Python model | transform | No Pydantic models exist in repo; use RESEARCH.md Pattern 9 verbatim |
| `vision-service/pytest.ini` | config | — | No Python tests exist; use standard `[pytest] testpaths = tests` convention |
| `vision-service/tests/fixtures/CONSENT.md` | data asset | — | Documentation file; no template in repo |
| `.github/workflows/vision-service-tests.yml` | CI config | — | No GitHub Actions workflows exist in repo; use standard Python/pytest GH Actions pattern |
| `apps/web/lib/supabase/service.ts` | utility | — | Does not exist; needed by process route + webhook; create following server.ts pattern |

---

## Metadata

**Analog search scope:** `apps/web/app/api/`, `apps/web/app/actions/`, `apps/web/components/ui/`, `apps/web/components/clientes/`, `apps/web/lib/capture/`, `apps/web/lib/supabase/`, `apps/web/scripts/`, `vision-service/`, `apps/web/app/(dashboard)/leituras/`
**Files scanned:** 28
**Pattern extraction date:** 2026-05-03
