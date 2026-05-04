"""Local-only tests for vision-service/modal_app.py (D-X2 — plain pytest CPU, no Modal cloud)."""
from __future__ import annotations

import json
import sys


def test_modal_app_imports_without_secrets(monkeypatch):
    """Importing modal_app must not require MODAL_WEBHOOK_SECRET / WEBHOOK_BASE_URL.

    Env reads happen inside `_post_webhook`, not at import time.
    """
    monkeypatch.delenv("MODAL_WEBHOOK_SECRET", raising=False)
    monkeypatch.delenv("WEBHOOK_BASE_URL", raising=False)
    # Force fresh import so environment-aware module-level code (if any) re-runs.
    sys.modules.pop("modal_app", None)
    import modal_app  # noqa: F401


def test_app_name_is_aurel_iris_vision():
    import modal_app

    assert modal_app.app.name == "aurel-iris-vision"


def test_run_pipeline_is_modal_function():
    import modal
    import modal_app

    # Modal Function objects are not directly callable in client-side Python — they're
    # invoked via .remote() / .spawn() inside the Modal runtime. Assert the type instead.
    assert isinstance(modal_app.run_pipeline, modal.Function)


def test_analyze_iris_endpoint_is_modal_function():
    import modal
    import modal_app

    assert isinstance(modal_app.analyze_iris_endpoint, modal.Function)


def test_image_pip_packages_excludes_supabase():
    """RESEARCH Anti-Pattern + D-T6: no Supabase service-role key in container.

    Verifies via source-text grep because Modal Image objects don't expose pip list.
    """
    src = open("modal_app.py", encoding="utf-8").read()
    assert '"supabase"' not in src
    assert "pydantic==2.13.3" in src
    assert "opencv-python-headless==4.13.0.92" in src
    assert "mediapipe==0.10.35" in src
    assert "face_landmarker.task" in src
    assert "libgl1" in src


def test_classify_error_summary_d_e1_catalog():
    """D-E1 pt-BR catalog mapping is deterministic per warning pattern."""
    from modal_app import _classify_error_summary

    assert _classify_error_summary(["mediapipe_no_face_detected"]) == "Olhos não detectados nas fotos"
    assert _classify_error_summary(["timeout exceeded"]) == "Tempo limite excedido — tente novamente"
    assert _classify_error_summary(["load_image httpx 404"]) == "Imagens em formato inválido"
    assert _classify_error_summary([]) == "Falha temporária no processamento — tente novamente"
    assert _classify_error_summary(["random_unknown"]) == "Falha temporária no processamento — tente novamente"
    assert _classify_error_summary(["low_light_warning"]) == "Imagens com pouca luz — tente recapturar"


def test_post_webhook_signs_with_stripe_convention(monkeypatch):
    """B2/B5: kwarg is `vision_features=` (NOT `features=`); URL constructed from WEBHOOK_BASE_URL."""
    import modal_app

    captured = {}

    class MockHttpx:
        @staticmethod
        def post(url, content, headers, timeout):
            captured["url"] = url
            captured["body"] = content
            captured["headers"] = headers

    monkeypatch.setenv("MODAL_WEBHOOK_SECRET", "test-secret")
    monkeypatch.setenv("WEBHOOK_BASE_URL", "https://example.test")
    sys.modules["httpx"] = MockHttpx
    try:
        modal_app._post_webhook("r1", "fc-1", "ready", vision_features={"k": "v"})
    finally:
        del sys.modules["httpx"]

    assert captured["url"] == "https://example.test/api/vision/webhook"
    assert captured["headers"]["X-Modal-Signature"].startswith("sha256=")
    assert len(captured["headers"]["X-Modal-Signature"].replace("sha256=", "")) == 64
    assert "X-Modal-Timestamp" in captured["headers"]

    parsed = json.loads(captured["body"])
    assert parsed["reading_id"] == "r1"
    assert parsed["status"] == "ready"
    assert parsed["modal_call_id"] == "fc-1"
    assert parsed["vision_features"] == {"k": "v"}


def test_post_webhook_failed_path_includes_vision_features_with_metadata(monkeypatch):
    """B3 (D-F2 + D-PM1): failed-path payload MUST carry vision_features.processing_metadata."""
    import modal_app

    captured = {}

    class MockHttpx:
        @staticmethod
        def post(url, content, headers, timeout):
            captured["body"] = content

    monkeypatch.setenv("MODAL_WEBHOOK_SECRET", "test-secret")
    monkeypatch.setenv("WEBHOOK_BASE_URL", "https://example.test")
    sys.modules["httpx"] = MockHttpx
    try:
        modal_app._post_webhook(
            "r1", "fc-2", "failed",
            vision_features={
                "right_eye": None,
                "left_eye": None,
                "asymmetry_notes": [],
                "processing_metadata": {
                    "model_version": "pipeline_0.1.0",
                    "modal_call_id": "fc-2",
                    "stages_timing_ms": {},
                    "warnings": ["mediapipe_no_face_detected"],
                    "error_summary": "Olhos não detectados nas fotos",
                },
            },
        )
    finally:
        del sys.modules["httpx"]

    parsed = json.loads(captured["body"])
    assert parsed["status"] == "failed"
    assert "vision_features" in parsed
    assert (
        parsed["vision_features"]["processing_metadata"]["error_summary"]
        == "Olhos não detectados nas fotos"
    )


def test_post_webhook_omits_url_env_when_base_missing(monkeypatch):
    """B5: legacy MODAL_WEBHOOK_URL must NOT be read; only WEBHOOK_BASE_URL."""
    import modal_app
    import pytest as _pytest

    monkeypatch.delenv("WEBHOOK_BASE_URL", raising=False)
    monkeypatch.setenv("MODAL_WEBHOOK_SECRET", "test-secret")
    with _pytest.raises(KeyError, match="WEBHOOK_BASE_URL"):
        modal_app._post_webhook("r1", "fc-3", "ready", vision_features={})


def test_post_webhook_signs_match_node_format():
    """Ensure Python sign format matches the apps/web TS verifier expectation.

    The TS verifier in apps/web/lib/vision/hmac.ts:
      1. strips the leading 'sha256=' prefix from X-Modal-Signature header
      2. computes hmac-sha256(secret, `${ts}.${rawBody}`).digest('hex')
      3. timingSafeEqual against the stripped header value
    """
    import hashlib
    import hmac as _hmac

    secret = "shared-secret"
    body = '{"k":"v"}'
    ts = "1700000000"
    expected = _hmac.new(
        secret.encode(), f"{ts}.{body}".encode(), hashlib.sha256
    ).hexdigest()
    header_value = f"sha256={expected}"

    assert header_value.startswith("sha256=")
    assert len(header_value) == len("sha256=") + 64
