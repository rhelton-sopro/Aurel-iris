"""
Modal app for the Aurel Iris vision pipeline.

Wires the 6 pipeline stages (detect → segment → compose → normalize → enhance → features)
into a single deployable service:

  - `analyze_iris_endpoint`: FastAPI HTTP entry. Accepts `{reading_id, image_urls}`,
    spawns the GPU worker via `.spawn()` (D-T1 async), returns `{call_id}` synchronously.
  - `run_pipeline`: GPU (T4) worker. Runs the 6 stages PER EYE with `try/except`
    so that one bad eye doesn't kill the other (D-F1 soft degradation). Populates
    `processing_metadata` per D-PM1, computes `asymmetry_notes` per D-A1, validates
    via `IrisFeatures.model_validate` (SPEC §4.3), and POSTs HMAC-signed payload
    to `${WEBHOOK_BASE_URL}/api/vision/webhook` per RESEARCH Pattern 1.

References:
  - SPEC §4.2 (six stages), SPEC §4.3 (canonical IrisFeatures shape)
  - CONTEXT D-T1 (.spawn() async), D-T5 (modal_call_id required), D-T6 (no Supabase
    service-role key in container — signed URLs only)
  - CONTEXT D-F1 (per-eye soft degradation), D-F2 (failed-path payload still carries
    vision_features so UI can render error_summary tooltip)
  - CONTEXT D-PM1 (processing_metadata field set), D-A1/D-A2 (asymmetry_notes shape)
  - CONTEXT D-E1 (pt-BR error_summary catalog — LGPD-compliant vocabulary)
  - RESEARCH Pattern 1 (Modal app structure), Pitfall 2 (model pre-bake via
    run_commands), Anti-Pattern (supabase removed from image).

Deploy:
    modal deploy vision-service/modal_app.py

Local sanity (no Modal cloud needed):
    python vision-service/modal_app.py
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from io import BytesIO

import modal
from pipeline.error_summary import ERROR_SUMMARY


app = modal.App("aurel-iris-vision")

# Shared build base — ALL build steps (apt/pip/run_commands), NO add_local_*.
# Modal requires add_local_* to be the LAST steps in an image (otherwise it
# must rebuild on every local-file change). Both `image` (production) and
# `sam_image` (Phase 7.4 harness) derive from this base and append the SAME
# add_local_* calls LAST. Production's resulting build-step chain is
# byte-identical to before this refactor → identical Modal image → the
# analyze-iris-endpoint / run_pipeline behaviour is unchanged.
_base_image = (
    modal.Image.debian_slim()
    .apt_install(
        "libgl1",
        "libglib2.0-0",   # libgthread-2.0.so.0 (cv2 runtime)
        "libgles2",       # libGLESv2.so.2 (MediaPipe runtime — OpenGL ES)
        "libegl1",        # libEGL.so.1 (MediaPipe runtime — paired with GLES2)
        "libsm6",         # X11 session mgmt (cv2)
        "libxext6",       # X11 ext (cv2)
        "libxrender1",    # X11 render (cv2)
        "wget",
    )
    .pip_install(
        "fastapi[standard]>=0.115",
        "opencv-python-headless==4.13.0.92",
        "mediapipe==0.10.35",
        "numpy>=1.26.0",
        "scikit-image>=0.24.0",
        "Pillow>=10.4.0",
        "pydantic==2.13.3",
        "httpx>=0.27",
    )
    .run_commands(
        "mkdir -p /models",
        (
            "wget -q -O /models/face_landmarker.task "
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
            "face_landmarker/float16/1/face_landmarker.task"
        ),
    )
)

# Mount pipeline package + data dir into container — MUST be the last steps.
# Default Modal only ships the entrypoint file (modal_app.py) — without these
# mounts, `from pipeline.error_summary import ERROR_SUMMARY` (line 43) and
# all line-171+ pipeline imports fail with ModuleNotFoundError. The data dir
# is needed because pipeline/iris_maps.py and pipeline/error_summary.py read
# `Path(__file__).parent.parent / "data" / "*.json"` at import-time.
#
# PRODUCTION: identical build-step sequence as before the SAM refactor
# (_base_image == old debian_slim().apt().pip().run(), then the same two
# add_local_* calls) — same image, no behaviour change.
image = (
    _base_image
    .add_local_python_source("pipeline")
    .add_local_dir("data", "/root/data")
)

# Phase 7.4 SAM comparison harness — heavier image used ONLY by the parallel
# SAM functions so production run_pipeline keeps its lean image. SAM2 is
# Apache-2.0. ALL build steps (sam pip + checkpoint wget) come from
# _base_image and run BEFORE the add_local_* calls (Modal's required order);
# the hydra config ships inside the pip-installed sam2 package.
sam_image = (
    _base_image
    # `git` is required to pip-install sam2 from its GitHub repo. Added on
    # the SAM image ONLY (not _base_image) so production stays untouched.
    .apt_install("git")
    .pip_install(
        "torch",
        "torchvision",
        "git+https://github.com/facebookresearch/sam2.git",
    )
    .run_commands(
        (
            "wget -q -O /models/sam2.1_hiera_small.pt "
            "https://dl.fbaipublicfiles.com/segment_anything_2/092824/"
            "sam2.1_hiera_small.pt"
        ),
    )
    .add_local_python_source("pipeline")
    .add_local_dir("data", "/root/data")
)


def _post_webhook(
    reading_id: str,
    call_id: str,
    status: str,
    *,
    vision_features: dict | None = None,
    **kwargs,
) -> None:
    """HMAC-signed POST to ``${WEBHOOK_BASE_URL}/api/vision/webhook``.

    The signing convention is Stripe-style: ``${timestamp}.${rawBody}`` HMAC-SHA256
    keyed by ``MODAL_WEBHOOK_SECRET``. The Next.js verifier in apps/web/lib/vision/hmac.ts
    enforces the matching format with timingSafeEqual.

    Args:
        reading_id:      UUID string identifying the reading row.
        call_id:         Modal function-call ID (correlation token; D-T5).
        status:          'ready' | 'failed' (matches Zod enum in 05-12).
        vision_features: dict; on 'ready' = ``validated.model_dump()``;
                         on 'failed' = ``{"processing_metadata": {...}}`` so the
                         consumer can render the error_summary tooltip (D-F2 + D-PM1).
                         Defaults to ``{}`` when omitted.
    """
    import httpx  # lazy: only available inside the Modal image

    payload = {
        "reading_id": reading_id,
        "modal_call_id": call_id,
        "status": status,
        "vision_features": vision_features if vision_features is not None else {},
        **kwargs,
    }
    body = json.dumps(payload, default=str)
    timestamp = str(int(time.time()))
    secret = os.environ["MODAL_WEBHOOK_SECRET"]
    sig = hmac.new(
        secret.encode(),
        f"{timestamp}.{body}".encode(),
        hashlib.sha256,
    ).hexdigest()
    # WEBHOOK_BASE_URL is the documented env name (vision-service/.env.example
    # + Modal Secrets per 05-17 smoke). Path is canonical /api/vision/webhook.
    webhook_url = os.environ["WEBHOOK_BASE_URL"].rstrip("/") + "/api/vision/webhook"
    print(f"[_post_webhook] POST {webhook_url} reading={reading_id} status={status} body_len={len(body)}")
    try:
        resp = httpx.post(
            webhook_url,
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-Modal-Signature": f"sha256={sig}",
                "X-Modal-Timestamp": timestamp,
            },
            timeout=30,
        )
        # Defensive: tests may mock httpx.post returning None; production httpx
        # always returns a Response with .status_code/.text. Only log when present.
        if resp is not None and hasattr(resp, "status_code"):
            print(f"[_post_webhook] response status={resp.status_code} body={resp.text[:200]}")
    except Exception as e:
        print(f"[_post_webhook] FAILED reading={reading_id}: {type(e).__name__}: {e}")
        raise


def _load_image(url: str):
    """GET signed URL → decode JPEG → return RGB ndarray. Lazy on httpx + PIL + numpy."""
    import httpx
    import numpy as np
    from PIL import Image as PILImage

    response = httpx.get(url, timeout=30)
    response.raise_for_status()
    pil = PILImage.open(BytesIO(response.content)).convert("RGB")
    return np.array(pil)


def _classify_error_summary(warnings: list[str]) -> str:
    """Map warning patterns to D-E1 pt-BR catalog (LGPD-compliant).

    Returns one of the 5 locked strings from ERROR_SUMMARY (pipeline.error_summary).
    No pt-BR literals are inlined here — all strings come from the catalog.
    """
    joined = " ".join(warnings).lower()
    if (
        "no_face_detected" in joined
        or "mediapipe_no_face" in joined
        or "iris_not_detected" in joined
        or "hough_no_circle" in joined
    ):
        return ERROR_SUMMARY["eyes_not_detected"]
    if "timeout" in joined:
        return ERROR_SUMMARY["timeout"]
    if "format" in joined or "decode" in joined or "load_image" in joined:
        return ERROR_SUMMARY["invalid_format"]
    if "low_light" in joined or "image_quality" in joined:
        return ERROR_SUMMARY["low_light"]
    return ERROR_SUMMARY["transient"]


@app.function(
    image=image,
    gpu="T4",
    timeout=120,
    secrets=[modal.Secret.from_name("aurel-iris-vision")],
)
def run_pipeline(reading_id: str, image_urls: list[dict]) -> dict:
    """Per-eye orchestration with D-F1 soft degradation.

    image_urls: ``[{"eye": "right" | "left", "angle": "frontal" | "lateral" | "backlight",
                    "url": str}, ...]`` — up to 6 entries.
    """
    import time as _time

    from pipeline import compose, detect, enhance, features, normalize, segment
    from pipeline.iris_maps import load_jensen_map
    from pipeline.schemas import IrisFeatures

    t_start = _time.monotonic()
    call_id = modal.current_function_call_id()
    warnings: list[str] = []
    stages_timing: dict[str, int] = {}
    detect_diagnostics: dict[str, list[dict]] = {}  # Wave C probe
    jensen = load_jensen_map()
    results: dict = {}

    for eye in ("right", "left"):
        eye_images = [u for u in image_urls if u.get("eye") == eye]
        per_eye_diag: list[dict] = []
        try:
            # Stage 1: detect (per angle)
            t0 = _time.monotonic()
            loaded = [
                {"angle": u.get("angle"), "image": _load_image(u["url"])}
                for u in eye_images
            ]
            detected = []
            for entry in loaded:
                try:
                    det = detect.find_iris(entry["image"])
                    detected.append(
                        {"angle": entry["angle"], "image": entry["image"], "detection": det}
                    )
                    per_eye_diag.append({
                        "angle": entry["angle"],
                        "detector": det.get("_detector", "unknown"),
                        "detect_center": list(det.get("center", [])),
                        "detect_radius": float(det.get("radius", 0.0)),
                    })
                except ValueError as e:
                    warnings.append(f"detect_{eye}_{entry['angle']}_{str(e)}")
                    per_eye_diag.append({
                        "angle": entry["angle"],
                        "detector": "failed",
                        "error": str(e),
                    })
            stages_timing[f"detect_{eye}"] = int((_time.monotonic() - t0) * 1000)
            detect_diagnostics[eye] = per_eye_diag  # bind early; segment loop mutates in place
            if not detected:
                raise RuntimeError(f"detect_failed_all_angles_{eye}")

            # Stage 2: segment (per angle)
            t0 = _time.monotonic()
            segmented = []
            warn_before_segment = len(warnings)
            for d in detected:
                seg = segment.iris_mask(d["image"], d["detection"], warnings=warnings)
                seg["angle"] = d["angle"]
                segmented.append(seg)
                iris_c = seg.get("iris_circle")
                segment_fallback = any(
                    "hough_segment_failed_fallback_mediapipe" in w
                    for w in warnings[warn_before_segment:]
                )
                for diag in per_eye_diag:
                    if diag["angle"] == d["angle"] and "segment_iris_circle" not in diag:
                        diag["segment_iris_circle"] = (
                            list(iris_c) if iris_c is not None else None
                        )
                        diag["segment_hough_fallback"] = segment_fallback
                        break
            stages_timing[f"segment_{eye}"] = int((_time.monotonic() - t0) * 1000)

            # Stage 3: compose
            t0 = _time.monotonic()
            composite = compose.photometric_combine(segmented)
            stages_timing[f"compose_{eye}"] = int((_time.monotonic() - t0) * 1000)

            # Stage 4: normalize
            t0 = _time.monotonic()
            normalized = normalize.daugman_polar(composite)
            stages_timing[f"normalize_{eye}"] = int((_time.monotonic() - t0) * 1000)

            # Stage 5: enhance
            t0 = _time.monotonic()
            enhanced = enhance.clahe(normalized)
            stages_timing[f"enhance_{eye}"] = int((_time.monotonic() - t0) * 1000)

            # Stage 6: features
            t0 = _time.monotonic()
            eye_block = features.extract_all(
                enhanced, composite, jensen, eye, warnings=warnings
            )
            stages_timing[f"features_{eye}"] = int((_time.monotonic() - t0) * 1000)

            results[f"{eye}_eye"] = eye_block
        except Exception as exc:
            warnings.append(
                f"pipeline_failed_{eye}_{type(exc).__name__}_{str(exc)[:80]}"
            )
            results[f"{eye}_eye"] = None

    # D-F1: hard fail only when both eyes are None.
    # IMPORTANT: the failed-path payload MUST include the `vision_features` key (D-F2).
    # The Zod consumer in 05-12 needs `vision_features.processing_metadata.error_summary`
    # to render the failure tooltip in the UI.
    if results.get("right_eye") is None and results.get("left_eye") is None:
        error_summary = _classify_error_summary(warnings)
        processing_metadata = {
            "model_version": "pipeline_0.2.0",
            "processing_time_ms": int((_time.monotonic() - t_start) * 1000),
            "modal_call_id": call_id,
            "stages_timing_ms": stages_timing,
            "warnings": warnings,
            "error_summary": error_summary,
            "detect_diagnostics": detect_diagnostics,
        }
        failed_features = {
            "right_eye": None,
            "left_eye": None,
            "asymmetry_notes": [],
            "processing_metadata": processing_metadata,
        }
        _post_webhook(
            reading_id, call_id,
            status="failed",
            vision_features=failed_features,
        )
        return {}

    asymmetry = features.compute_asymmetry(results)
    full_payload = {
        "right_eye": results.get("right_eye"),
        "left_eye": results.get("left_eye"),
        "asymmetry_notes": asymmetry,
        "processing_metadata": {
            "model_version": "pipeline_0.2.0",
            "processing_time_ms": int((_time.monotonic() - t_start) * 1000),
            "modal_call_id": call_id,
            "stages_timing_ms": stages_timing,
            "warnings": warnings,
            "error_summary": None,
            "detect_diagnostics": detect_diagnostics,
        },
    }
    validated = IrisFeatures.model_validate(full_payload)
    _post_webhook(
        reading_id, call_id, status="ready", vision_features=validated.model_dump()
    )
    return validated.model_dump()


@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def analyze_iris_endpoint(payload: dict) -> dict:
    """HTTP entry — spawns run_pipeline asynchronously and returns call_id (D-T1)."""
    reading_id = payload["reading_id"]
    image_urls = payload["image_urls"]
    call = run_pipeline.spawn(reading_id, image_urls)
    return {"call_id": call.object_id}


# ---------------------------------------------------------------------------
# Phase 7.4 — PARALLEL SAM BRANCH (comparison harness)
#
# Mirrors run_pipeline EXACTLY except the geometry stage: detect+segment
# (MediaPipe→Hough) is replaced by a single SAM2 call per angle. compose →
# normalize → enhance → features.extract_all run byte-identical, so any
# difference in the report is attributable to segmentation alone — the whole
# point of the experiment.
#
# Isolation from production: this path NEVER posts to the production webhook
# and NEVER writes vision_features. The endpoint is SYNCHRONOUS (.remote()) —
# it returns the validated payload to the caller (the founder-gated Next.js
# admin endpoint), which persists it to the dedicated *_sam columns.
# ---------------------------------------------------------------------------

SAM_MODEL_VERSION = "pipeline_sam_0.1.0"


@app.function(
    image=sam_image,
    gpu="T4",
    timeout=300,
    secrets=[modal.Secret.from_name("aurel-iris-vision")],
)
def run_pipeline_sam(reading_id: str, image_urls: list[dict]) -> dict:
    """SAM-segmentation variant of run_pipeline. Returns the validated
    FeaturesPayload dict (model_dump) synchronously. Per-eye soft
    degradation identical to production (D-F1)."""
    import time as _time

    from pipeline import compose, enhance, features, normalize, segment_sam
    from pipeline.iris_maps import load_jensen_map
    from pipeline.schemas import IrisFeatures

    t_start = _time.monotonic()
    call_id = modal.current_function_call_id()
    warnings: list[str] = []
    stages_timing: dict[str, int] = {}
    seg_diagnostics: dict[str, list[dict]] = {}
    jensen = load_jensen_map()
    results: dict = {}

    for eye in ("right", "left"):
        eye_images = [u for u in image_urls if u.get("eye") == eye]
        per_eye_diag: list[dict] = []
        try:
            t0 = _time.monotonic()
            loaded = [
                {"angle": u.get("angle"), "image": _load_image(u["url"])}
                for u in eye_images
            ]
            segmented = []
            for entry in loaded:
                try:
                    seg = segment_sam.iris_mask_sam(entry["image"], warnings=warnings)
                    seg["angle"] = entry["angle"]
                    segmented.append(seg)
                    ic = seg.get("iris_circle")
                    pc = seg.get("pupil_circle")
                    per_eye_diag.append({
                        "angle": entry["angle"],
                        "detector": "sam2",
                        "iris_circle": list(ic) if ic is not None else None,
                        "pupil_circle": list(pc) if pc is not None else None,
                    })
                except ValueError as e:
                    warnings.append(f"sam_{eye}_{entry.get('angle')}_{str(e)}")
                    per_eye_diag.append({
                        "angle": entry.get("angle"),
                        "detector": "failed",
                        "error": str(e),
                    })
            stages_timing[f"segment_{eye}"] = int((_time.monotonic() - t0) * 1000)
            seg_diagnostics[eye] = per_eye_diag
            if not segmented:
                raise RuntimeError(f"sam_segment_failed_all_angles_{eye}")

            t0 = _time.monotonic()
            composite = compose.photometric_combine(segmented)
            stages_timing[f"compose_{eye}"] = int((_time.monotonic() - t0) * 1000)

            t0 = _time.monotonic()
            normalized = normalize.daugman_polar(composite)
            stages_timing[f"normalize_{eye}"] = int((_time.monotonic() - t0) * 1000)

            t0 = _time.monotonic()
            enhanced = enhance.clahe(normalized)
            stages_timing[f"enhance_{eye}"] = int((_time.monotonic() - t0) * 1000)

            t0 = _time.monotonic()
            eye_block = features.extract_all(
                enhanced, composite, jensen, eye, warnings=warnings
            )
            stages_timing[f"features_{eye}"] = int((_time.monotonic() - t0) * 1000)

            results[f"{eye}_eye"] = eye_block
        except Exception as exc:
            warnings.append(
                f"sam_pipeline_failed_{eye}_{type(exc).__name__}_{str(exc)[:80]}"
            )
            results[f"{eye}_eye"] = None

    processing_metadata = {
        "model_version": SAM_MODEL_VERSION,
        "processing_time_ms": int((_time.monotonic() - t_start) * 1000),
        "modal_call_id": call_id,
        "stages_timing_ms": stages_timing,
        "warnings": warnings,
        "error_summary": (
            None
            if (results.get("right_eye") or results.get("left_eye"))
            else _classify_error_summary(warnings)
        ),
        "segment_diagnostics": seg_diagnostics,
        "variant": "sam",
    }

    if results.get("right_eye") is None and results.get("left_eye") is None:
        return {
            "right_eye": None,
            "left_eye": None,
            "asymmetry_notes": [],
            "processing_metadata": processing_metadata,
        }

    asymmetry = features.compute_asymmetry(results)
    full_payload = {
        "right_eye": results.get("right_eye"),
        "left_eye": results.get("left_eye"),
        "asymmetry_notes": asymmetry,
        "processing_metadata": processing_metadata,
    }
    validated = IrisFeatures.model_validate(full_payload)
    return validated.model_dump()


@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def analyze_iris_sam_endpoint(payload: dict) -> dict:
    """SYNCHRONOUS SAM endpoint (Phase 7.4 harness). Blocks on .remote()
    and returns the validated SAM features inline — the founder-gated
    Next.js admin route persists it to readings.vision_features_sam.
    NOT spawned, NOT webhooked: zero production surface."""
    reading_id = payload["reading_id"]
    image_urls = payload["image_urls"]
    features_payload = run_pipeline_sam.remote(reading_id, image_urls)
    return {"vision_features_sam": features_payload}


if __name__ == "__main__":
    # Local sanity — `python modal_app.py` confirms imports and image definition parse.
    print(f"Modal app: {app.name}")
    print(
        "Functions registered: run_pipeline, analyze_iris_endpoint, "
        "run_pipeline_sam, analyze_iris_sam_endpoint"
    )
