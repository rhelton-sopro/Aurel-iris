"""Stage 1 detect tests -- D-X3 hybrid (structural always; metric when fixtures + model present).

Phase 07.1.5 extension: per-test skipif decomposition (was module-level pytestmark)
+ 3 new tests for the HSV color-pre-segmentation path inside _hough_circle_fallback,
including the BLOCKER-3 MediaPipe non-regression guard (mocked landmarker, so the
new tests run without face_landmarker.task being present locally).
"""
from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import pytest


def _model_available() -> bool:
    env = os.environ.get("MEDIAPIPE_FACE_LANDMARKER_PATH")
    if env and Path(env).is_file():
        return True
    return Path("/models/face_landmarker.task").is_file()


# Phase 07.1.5: decomposed from module-level `pytestmark` so the new
# color-mask Hough-only tests + BLOCKER-3 MediaPipe regression guard
# (mocked landmarker) can run WITHOUT face_landmarker.task locally.
_REQUIRES_MODEL = pytest.mark.skipif(
    not _model_available(),
    reason=(
        "face_landmarker.task not available locally. Set "
        "MEDIAPIPE_FACE_LANDMARKER_PATH or run inside the Modal container. "
        "Skipping detect tests; structural smoke is exercised by test_smoke."
    ),
)


@_REQUIRES_MODEL
def test_no_face_raises_value_error():
    """D-F1 contract: orchestrator catches a stable error string."""
    from pipeline.detect import find_iris

    # Pure black 256x256 RGB -- no face -> MediaPipe returns empty.
    blank = np.zeros((256, 256, 3), dtype=np.uint8)
    with pytest.raises(ValueError, match="iris_not_detected"):
        find_iris(blank)


@_REQUIRES_MODEL
def test_returns_required_keys(iris_images):
    from pipeline.detect import find_iris

    if not iris_images:
        pytest.skip("no fixtures committed yet; D-X1 founder records pending")
    name, img = next(iter(iris_images.items()))
    result = find_iris(img)
    assert set(result.keys()) >= {"center", "radius", "landmarks_raw"}
    cx, cy = result["center"]
    assert isinstance(cx, float) and isinstance(cy, float)
    assert result["radius"] > 0.0
    assert len(result["landmarks_raw"]) == 478, f"{name}: expected 478 landmarks, got {len(result['landmarks_raw'])}"


@_REQUIRES_MODEL
def test_iris_iou_above_threshold_when_expected_present(iris_images, expected):
    """Metric assertion: IoU of detected iris bbox vs founder ground truth >= 0.7 (D-X3)."""
    from pipeline.detect import find_iris

    bboxes = expected.get("iris_bbox", {})
    if not bboxes or not iris_images:
        pytest.skip("no founder-annotated bboxes yet; populate expected.json")

    for name, img in iris_images.items():
        if name not in bboxes:
            continue
        result = find_iris(img)
        cx, cy = result["center"]
        r = result["radius"]
        detected = (cx - r, cy - r, cx + r, cy + r)
        x1, y1, x2, y2 = bboxes[name]
        iou = _iou(detected, (x1, y1, x2, y2))
        assert iou >= 0.7, f"{name}: IoU={iou:.3f} < 0.7"


def _iou(a: tuple, b: tuple) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


# ---------------------------------------------------------------------------
# Phase 07.1.5 — new tests (NO _REQUIRES_MODEL decorator; these run anywhere)
# ---------------------------------------------------------------------------


def test_hough_color_masked_detector_on_synthetic_close_up(synthetic_close_up_eye):
    """Close-up synthetic (no face context) -> Hough fallback fires with color mask.

    Tests SC-3 (Approach B implemented) and SC-2 unit slice (_detector breadcrumb).
    """
    from pipeline.detect import _hough_circle_fallback
    img = synthetic_close_up_eye(size=512)
    result = _hough_circle_fallback(img)
    assert result["_detector"] == "hough_color_masked", \
        f"expected hough_color_masked, got {result['_detector']!r}"
    assert result["radius"] > 0.0


def test_hough_color_masked_returns_full_detection_dict_keys(synthetic_close_up_eye):
    """Contract preservation per PATTERNS.md lines 91-100."""
    from pipeline.detect import _hough_circle_fallback
    img = synthetic_close_up_eye(size=512)
    result = _hough_circle_fallback(img)
    assert set(result.keys()) >= {"center", "radius", "landmarks_raw", "_detector"}
    assert isinstance(result["landmarks_raw"], list)


def test_mediapipe_path_does_not_invoke_color_mask(monkeypatch):
    """BLOCKER-3 regression guard: when MediaPipe returns landmarks,
    color_iris_mask is NOT called and _detector == 'mediapipe'.

    Mocks the landmarker so this test runs WITHOUT face_landmarker.task
    being present locally - survives refactors that might move the
    color-mask call out of _hough_circle_fallback.
    """
    from pipeline import detect
    from pipeline import masks as masks_mod

    calls: list = []
    real_mask = masks_mod.color_iris_mask

    def _spy(*a, **kw):
        calls.append(1)
        return real_mask(*a, **kw)

    monkeypatch.setattr(masks_mod, "color_iris_mask", _spy)
    # Also patch detect's reference in case it imported the symbol by name
    if hasattr(detect, "color_iris_mask"):
        monkeypatch.setattr(detect, "color_iris_mask", _spy)

    class _FakeLandmark:
        def __init__(self):
            self.x = 0.5
            self.y = 0.5
            self.z = 0.0

    class _FakeResult:
        face_landmarks = [[_FakeLandmark() for _ in range(478)]]

    class _FakeLandmarker:
        def detect(self, *a, **kw):
            return _FakeResult()

    # Reset module-level cache so find_iris picks up the fake landmarker
    monkeypatch.setattr(detect, "_landmarker", None)
    monkeypatch.setattr(detect, "get_landmarker", lambda: _FakeLandmarker())

    result = detect.find_iris(np.zeros((1080, 1080, 3), dtype=np.uint8))
    assert result["_detector"] == "mediapipe", \
        f"expected mediapipe, got {result.get('_detector')!r}"
    assert len(calls) == 0, \
        "color_iris_mask was invoked on MediaPipe success path " \
        "(Invariant 6 / SC-4 regression)"
