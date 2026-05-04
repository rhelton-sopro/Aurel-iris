---
phase: 05-pipeline-visao-modal
plan: "10"
subsystem: vision-service
tags: [vision, modal, orchestrator, hmac, webhook, pipeline-integration]

requires:
  - phase: 05-pipeline-visao-modal
    provides: "Wave 0 (05-01) pytest infra; Wave 0 (05-02) HMAC sign convention reference; Wave 1a (05-03..05-08) all 6 pipeline stages; Wave 1b (05-09) features.extract_all + compute_asymmetry + iris_maps.load_jensen_map"

provides:
  - "vision-service/modal_app.py: app + run_pipeline (T4 GPU worker) + analyze_iris_endpoint (FastAPI POST entry) + _post_webhook + _classify_error_summary + _load_image"
  - "vision-service/requirements.txt: deps pinned per RESEARCH Pattern 1 (modal>=1.4.2, opencv==4.13.0.92, mediapipe==0.10.35, pydantic==2.13.3, Pillow, httpx); supabase REMOVED per D-T6 + Anti-Pattern"

affects:
  - "05-11 (Next.js trigger route — calls analyze_iris_endpoint over HTTPS)"
  - "05-12 (webhook receiver — verifies HMAC signature with apps/web/lib/vision/hmac.ts using same Stripe convention)"
  - "05-13 (finalizeReadingAction integration — triggers the pipeline post-finalize)"
  - "05-17 (smoke procedure — modal deploy lights up the endpoint URL → MODAL_ANALYZE_ENDPOINT_URL env var)"

tech-stack:
  added:
    - "modal>=1.4.2 (Python SDK already in requirements but never wired before this plan)"
  removed:
    - "supabase from vision-service/requirements.txt (D-T6 + RESEARCH Anti-Pattern: Modal container must NOT carry service-role key)"
  patterns:
    - "Lazy imports inside Modal-runtime helpers (_post_webhook imports httpx inside the body) — module-level import doesn't need the Modal image to be built"
    - "Per-eye try/except wrapping the 6-stage chain — D-F1 soft degradation: one bad eye doesn't kill the other"
    - "IrisFeatures.model_validate gate BEFORE _post_webhook on success path — malformed payloads raise and fall into the failed-path branch"
    - "Failed-path payload always carries vision_features key with processing_metadata.error_summary — D-F2 + D-PM1 contract for UI tooltip"
    - "WEBHOOK_BASE_URL env name (NOT MODAL_WEBHOOK_URL) — aligned with vision-service/.env.example documented in 05-17"
    - "HMAC signing convention: ${timestamp}.${rawBody} HMAC-SHA256 hex; X-Modal-Signature: sha256=<hex> + X-Modal-Timestamp: <unix-ts> headers — matches apps/web/lib/vision/hmac.ts verifier"

key-files:
  created:
    - vision-service/tests/test_modal_app.py (10 tests: D-X2 plain pytest CPU)
  modified:
    - vision-service/modal_app.py (replaced Phase 1 NotImplementedError stub with full orchestrator)
    - vision-service/requirements.txt (supabase removed; pydantic/Pillow/httpx pinned)

key-decisions:
  - "torch/torchvision listed in requirements.txt for forward compat (v1.1 U-Net upgrade) but EXCLUDED from the Modal image pip_install to keep cold-start manageable — current pipeline uses MediaPipe + OpenCV only"
  - "WEBHOOK_BASE_URL is the canonical env name; full URL constructed via os.environ['WEBHOOK_BASE_URL'].rstrip('/') + '/api/vision/webhook' — single source of truth in vision-service/.env.example (documented in 05-17)"
  - "Image pre-bakes face_landmarker.task into /models/ via run_commands at build time — Pitfall 2 fix: avoids per-cold-start runtime download (~2.6 MB)"
  - "Failed-path payload carries vision_features dict (not omitted) with minimal {right_eye: None, left_eye: None, asymmetry_notes: [], processing_metadata: {...}} so the 05-12 Zod consumer + 05-14 UI can render error_summary from a consistent shape — D-F2 + D-PM1"
  - "modal_app.py file structure: helpers (_post_webhook, _load_image, _classify_error_summary) above @app.function decorators so the GPU worker imports are minimal and the helpers are unit-testable from plain pytest CPU"

patterns-established:
  - "Pattern: lazy import of runtime-only deps (httpx, numpy, PIL) inside Modal function bodies — module-level import remains importable from plain pytest CPU without the Modal image being built"
  - "Pattern: D-E1 LGPD-compliant pt-BR error catalog as a deterministic mapper function (_classify_error_summary) with substring-pattern matching against accumulated warnings list — replicable for any Python pipeline that needs failure-mode taxonomy for UI consumption"
  - "Pattern: failed-path-with-payload — webhook callbacks for FAILED status still carry the canonical payload key with minimal-but-structured content, so consumers can use a single Zod/discriminated-union schema instead of branching on status"

requirements-completed: [VISION-01, VISION-02, VISION-03, VISION-04]

duration: ~25min (orchestrator inline — 2 spawned-agent attempts blocked by Bash sandbox)
completed: "2026-05-04"
---

# Phase 5 Plan 10: Modal App Orchestrator — Summary

**Wires the 6 vision pipeline stages into a single deployable Modal app: FastAPI HTTP endpoint that spawns a T4 GPU worker which runs detect → segment → compose → normalize → enhance → features per eye with D-F1 soft degradation, validates via Pydantic IrisFeatures, and POSTs HMAC-signed payload to the Next.js webhook. Closes Wave 1 — all 4 VISION requirements (01-04) are now functionally addressed in Python.**

## Performance

- **Tasks:** 3 of 3
- **Files modified:** 2 (modal_app.py, requirements.txt)
- **Files created:** 1 (test_modal_app.py)
- **Test coverage:** 10 new tests; full vision-service suite 97 passed, 4 skipped, 1 known-issue (see "Known issues")

## Accomplishments

- Replaced `analyze_iris` `NotImplementedError` stub in `vision-service/modal_app.py` with full orchestrator (run_pipeline + analyze_iris_endpoint + helpers)
- `app = modal.App("aurel-iris-vision")` with `Image.debian_slim().apt_install("libgl1").pip_install(...).run_commands(...)` pre-baking face_landmarker.task into `/models/` (RESEARCH Pitfall 2 fix)
- `_post_webhook(reading_id, call_id, status, *, vision_features, **kwargs)` — HMAC-SHA256 sign of `${timestamp}.${rawBody}` keyed by `MODAL_WEBHOOK_SECRET`; POSTs to `${WEBHOOK_BASE_URL}/api/vision/webhook` with `X-Modal-Signature: sha256=<hex>` + `X-Modal-Timestamp: <unix-ts>` headers
- `_load_image(url)` — lazy httpx + PIL fetcher returning RGB ndarray (signed-URL only — no Supabase service-role key)
- `_classify_error_summary(warnings)` — deterministic D-E1 pt-BR catalog mapper for UI tooltip rendering
- `run_pipeline(reading_id, image_urls)` — `@app.function(image=image, gpu="T4", timeout=120)`. Per-eye try/except wraps the 6-stage chain. Populates `processing_metadata` per D-PM1, computes asymmetry via `features.compute_asymmetry`, validates via `IrisFeatures.model_validate` BEFORE webhook POST. When BOTH eyes fail → POSTs `status='failed'` with vision_features carrying processing_metadata.error_summary (D-F2 + D-PM1)
- `analyze_iris_endpoint(payload)` — `@modal.fastapi_endpoint(method="POST")`. Calls `run_pipeline.spawn(reading_id, image_urls)` and returns `{"call_id": call.object_id}` synchronously (D-T1 async)
- `vision-service/requirements.txt` — supabase REMOVED (D-T6 + Anti-Pattern); modal>=1.4.2, opencv==4.13.0.92, mediapipe==0.10.35, pydantic==2.13.3 pinned; Pillow + httpx added

## Task Commits

- `5c09527` (amended → `93144f6`) — feat(05-10): modal_app orchestrator + image definition + supabase removed (Tasks 1+2 combined; image definition was tightly coupled with orchestrator imports)
- `d00408e` — test(05-10): 10 tests for modal_app (D-X2 plain pytest CPU)
- (this SUMMARY.md — separate orchestrator commit)

## Test Coverage

10 tests in `vision-service/tests/test_modal_app.py`:

1. `test_modal_app_imports_without_secrets` — env reads happen lazily inside `_post_webhook`, not at import time
2. `test_app_name_is_aurel_iris_vision` — `modal_app.app.name` smoke check
3. `test_run_pipeline_is_modal_function` — `isinstance(modal_app.run_pipeline, modal.Function)` (Modal Function objects are not directly callable in client-side Python)
4. `test_analyze_iris_endpoint_is_modal_function` — same for the FastAPI entry
5. `test_image_pip_packages_excludes_supabase` — source-grep gate for D-T6 (supabase MUST NOT appear in modal_app.py)
6. `test_classify_error_summary_d_e1_catalog` — deterministic mapping for all 5 D-E1 patterns
7. `test_post_webhook_signs_with_stripe_convention` — `vision_features=` kwarg, URL constructed from `WEBHOOK_BASE_URL` (B2 + B5)
8. `test_post_webhook_failed_path_includes_vision_features_with_metadata` — failed-path payload carries `vision_features.processing_metadata.error_summary` (B3 anti-regression for D-F2)
9. `test_post_webhook_omits_url_env_when_base_missing` — KeyError on `WEBHOOK_BASE_URL` absent (B5: legacy `MODAL_WEBHOOK_URL` MUST NOT be read)
10. `test_post_webhook_signs_match_node_format` — header layout matches apps/web/lib/vision/hmac.ts TS verifier

**Verification:**

```
python -m pytest tests/test_modal_app.py -v        → 10 passed
python -m pytest tests/ -q                         → 97 passed, 4 skipped, 1 known-issue (test_real_tree_is_clean — see below)
python -m scripts.audit_vocabulary modal_app.py    → OK: vocabulário proibido ausente
```

## Decisions Made

- **torch/torchvision in requirements.txt but NOT in Modal image pip_install** — they're huge (~2GB) and only needed in v1.1 U-Net upgrade. Listing them in requirements.txt preserves forward compat for local dev / future plans without bloating the Modal cold start
- **WEBHOOK_BASE_URL canonical env name** — full URL constructed via `os.environ['WEBHOOK_BASE_URL'].rstrip('/') + '/api/vision/webhook'`. Single source of truth in vision-service/.env.example (per 05-17 smoke step 4). Legacy `MODAL_WEBHOOK_URL` is a B5 anti-regression — must NOT appear
- **Image pre-bakes face_landmarker.task** via `run_commands("mkdir -p /models", "wget ...")` at build time — avoids per-cold-start runtime download (~2.6 MB; saves ~3-5s wall-clock on first invocation per replica)
- **Failed-path payload carries vision_features key** — B3 contract: 05-12 Zod consumer parses a single shape regardless of status; failure tooltip renders from `vision_features.processing_metadata.error_summary` (D-F2 + D-PM1)
- **HMAC signing convention `${timestamp}.${rawBody}`** with `X-Modal-Signature: sha256=<hex>` header — matches apps/web/lib/vision/hmac.ts verifier exactly (test 10 proves the format roundtrips)

## Deviations from Plan

### Tasks 1+2 combined into a single commit

The plan specified atomic commits per task. The image definition (Task 1) was tightly coupled with the orchestrator imports (Task 2) — splitting into two commits would have left `modal_app.py` in an inconsistent state where the new image definition imports module-level `hmac`/`hashlib`/etc. but the orchestrator using them isn't there yet. Combined as commit `93144f6`. Test commit `d00408e` remains separate per spec.

### Modal Function objects are not directly callable

The plan said: "Modal function objects are callable; this is a smoke check." In `modal>=1.4.2`, they are NOT directly callable client-side — they're `Function` objects intended for `.remote()` / `.spawn()` invocation. Updated tests 3-4 to assert `isinstance(modal_app.run_pipeline, modal.Function)` instead.

### Spawned-agent execution blocked by Bash sandbox

Two attempts to dispatch this plan via `gsd-executor` subagent (with both `mode="bypassPermissions"` set explicitly and without worktree isolation) were blocked by Claude Code's Bash sandbox even with the bypass mode. The orchestrator implemented Task 1+2+3 inline. This is a known **GSD orchestration weakness on Windows / acceptEdits mode** — same issue blocked Wave 1b's 05-09 agent earlier in the session.

## Issues Encountered

### Known issue: `test_real_tree_is_clean` fails on untracked `vision-service/data/jensen-reference.md`

The full vision-service test suite has 1 failure: `tests/test_audit_vocabulary.py::test_real_tree_is_clean` flags `vision-service/data/jensen-reference.md` (an UNTRACKED reference document) for forbidden vocabulary. The flagged content is:

1. **Lines 249-251** — meta-list of forbidden words (it's a doc explaining what to avoid):
   ```
   - diagnóstico, diagnose, diagnóstico definitivo
   - tratamento, tratar
   - cura, curar
   ```
2. **Line 300** — disclaimer line: "*Não constitui material de diagnóstico.*"
3. **Lines 129, 141, 183, 223** — false positives on the substring "cura" inside legitimate Portuguese words ("escuras", "obscura", etc.) — the audit pattern `diagn[óo]stico|tratamento|cura` is naive substring match, not word-bounded

**Why this isn't a regression of 05-10:** the file is untracked (not part of any commit) and the vocabulary issues are unrelated to modal_app.py / orchestrator code. The audit pattern in `scripts/audit_vocabulary.py` (from 05-01) does naive substring matching which is a known weakness.

**Suggested resolution (deferred):** either (a) move `jensen-reference.md` outside `vision-service/data/` (e.g., to `.planning/research/`), (b) update `scripts/audit_vocabulary.py` to use word-boundary regex `\b(...)\b` and skip files with a vocabulary-doc marker, or (c) add an explicit allowlist for documentation files. This is a **separate maintenance concern** from Phase 5 scope.

## Next Phase Readiness

Wave 1 (the entire vision-service Python pipeline) is now fully implemented:

- **05-11 (Next.js trigger route):** can call `analyze_iris_endpoint` over HTTPS; receives `{call_id}` synchronously
- **05-12 (webhook receiver):** receives HMAC-signed POST to `/api/vision/webhook`; the apps/web/lib/vision/hmac.ts verifier (Wave 0) already matches the Python sign format
- **05-13 (finalizeReadingAction integration):** can trigger the pipeline post-finalize via 05-11
- **05-14 (UI status badge):** can render `vision_features.processing_metadata.error_summary` on the failed path (D-F2 contract)
- **05-17 (founder smoke):** `modal deploy vision-service/modal_app.py` lights up the HTTPS endpoint URL → fills `MODAL_ANALYZE_ENDPOINT_URL` in apps/web env

## Threat Model Coverage

| Threat ID | Status |
|-----------|--------|
| T-05-10-01 Spoofing: forged callback to /api/vision/webhook | Mitigated — Stripe-style HMAC with shared MODAL_WEBHOOK_SECRET; verifier in 05-12 enforces |
| T-05-10-02 Privilege escalation: Supabase service-role in container | Mitigated — supabase removed from pip image; signed URLs only (D-T6) |
| T-05-10-03 Tampering: malformed payload reaches webhook | Mitigated — `IrisFeatures.model_validate` runs before _post_webhook; failure falls into D-F1 hard-fail path |
| T-05-10-04 DoS: one eye crashes both | Mitigated — per-eye try/except keeps surviving eye intact |
| T-05-10-05 Repudiation: model_version not bumped | Accepted — manual review (D-PM1 semver policy); deferred to ops doc |
| T-05-10-06 Info disclosure: signed URL leakage via Modal logs | Mitigated — TTL=600s (D-T6) bounds exposure |
| T-05-10-07 Tampering: error_summary with forbidden vocab | Mitigated — `_classify_error_summary` returns from a fixed catalog; `audit:vocabulary` covers modal_app.py |
| T-05-10-08 Spoofing: timestamp rewind on incoming webhook | Verifier-side concern (05-12); sender ships timestamp header per spec |

## Public API Surface

```python
# vision-service/modal_app.py
app: modal.App                                  # name="aurel-iris-vision"
image: modal.Image                              # debian_slim + libgl1 + pinned pip + face_landmarker.task pre-baked

@app.function(image=image, gpu="T4", timeout=120)
def run_pipeline(reading_id: str, image_urls: list[dict]) -> dict: ...

@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def analyze_iris_endpoint(payload: dict) -> dict:
    # POST {"reading_id": str, "image_urls": [{"eye", "angle", "url"}, ...]}
    # → {"call_id": str}

# Module-level helpers (testable from plain pytest CPU):
def _post_webhook(reading_id, call_id, status, *, vision_features=None, **kwargs) -> None
def _load_image(url: str) -> np.ndarray
def _classify_error_summary(warnings: list[str]) -> str
```

## Known Stubs

None. `analyze_iris` (the Phase 1 stub) was REMOVED — replaced by `analyze_iris_endpoint` (HTTP entry) + `run_pipeline` (GPU worker).

## Wave 1 Closure

Plan 05-10 is the FINAL plan in Wave 1. With this commit:

- **Wave 0:** ✅ 05-01 (test infra) + 05-02 (HMAC + service-role)
- **Wave 1a:** ✅ 05-03 (schemas) + 05-04..05-08 (5 pipeline stages)
- **Wave 1b:** ✅ 05-09 (features + jensen-map.json) — founder UAT approved with 1 fix
- **Wave 1c:** ✅ 05-10 (modal_app orchestrator)

**10/17 plans done. Wave 2 next: Next.js integration (05-11..05-14).**

---

*Phase: 05-pipeline-visao-modal*
*Completed: 2026-05-04*
