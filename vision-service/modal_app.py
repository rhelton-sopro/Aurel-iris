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

image = (
    modal.Image.debian_slim()
    .apt_install("libgl1")
    .pip_install(
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
    if "no_face_detected" in joined or "mediapipe_no_face" in joined:
        return ERROR_SUMMARY["eyes_not_detected"]
    if "timeout" in joined:
        return ERROR_SUMMARY["timeout"]
    if "format" in joined or "decode" in joined or "load_image" in joined:
        return ERROR_SUMMARY["invalid_format"]
    if "low_light" in joined or "image_quality" in joined:
        return ERROR_SUMMARY["low_light"]
    return ERROR_SUMMARY["transient"]


@app.function(image=image, gpu="T4", timeout=120)
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
    jensen = load_jensen_map()
    results: dict = {}

    for eye in ("right", "left"):
        eye_images = [u for u in image_urls if u.get("eye") == eye]
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
                except ValueError as e:
                    warnings.append(f"detect_{eye}_{entry['angle']}_{str(e)}")
            stages_timing[f"detect_{eye}"] = int((_time.monotonic() - t0) * 1000)
            if not detected:
                raise RuntimeError(f"detect_failed_all_angles_{eye}")

            # Stage 2: segment (per angle)
            t0 = _time.monotonic()
            segmented = []
            for d in detected:
                seg = segment.iris_mask(d["image"], d["detection"], warnings=warnings)
                seg["angle"] = d["angle"]
                segmented.append(seg)
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
            "model_version": "pipeline_0.1.0",
            "processing_time_ms": int((_time.monotonic() - t_start) * 1000),
            "modal_call_id": call_id,
            "stages_timing_ms": stages_timing,
            "warnings": warnings,
            "error_summary": error_summary,
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
            "model_version": "pipeline_0.1.0",
            "processing_time_ms": int((_time.monotonic() - t_start) * 1000),
            "modal_call_id": call_id,
            "stages_timing_ms": stages_timing,
            "warnings": warnings,
            "error_summary": None,
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


if __name__ == "__main__":
    # Local sanity — `python modal_app.py` confirms imports and image definition parse.
    print(f"Modal app: {app.name}")
    print("Functions registered: run_pipeline, analyze_iris_endpoint")
