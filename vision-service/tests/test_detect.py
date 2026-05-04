"""Stage 1 detect tests -- D-X3 hybrid (structural always; metric when fixtures + model present)."""
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


pytestmark = pytest.mark.skipif(
    not _model_available(),
    reason=(
        "face_landmarker.task not available locally. Set "
        "MEDIAPIPE_FACE_LANDMARKER_PATH or run inside the Modal container. "
        "Skipping detect tests; structural smoke is exercised by test_smoke."
    ),
)


def test_no_face_raises_value_error():
    """D-F1 contract: orchestrator catches a stable error string."""
    from pipeline.detect import find_iris

    # Pure black 256x256 RGB -- no face -> MediaPipe returns empty.
    blank = np.zeros((256, 256, 3), dtype=np.uint8)
    with pytest.raises(ValueError, match="mediapipe_no_face_detected"):
        find_iris(blank)


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
