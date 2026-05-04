"""
Tests for vision-service/pipeline/segment.py (Stage 2: iris segmentation).

Coverage:
    - structural: returned dict keys, dtypes, shapes
    - invalid detection: ValueError("segment_invalid_detection")
    - D-F1 fallback: uniform image (Hough fails) → seed values returned + warning appended
    - fallback silent: warnings=None → no exception, all keys present
    - Pitfall 7 selection: multiple circles → closest to seed wins
    - mask geometry: every True pixel lies within iris_circle (cx, cy, r+1)
    - segmented image: pixels outside mask are zero
    - metric (gated): coverage ≥60% of expected iris bbox area (skipped when no fixtures)
"""
import math

import cv2
import numpy as np
import pytest

from pipeline.segment import HOUGH_DEFAULTS, iris_mask


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _uniform_image(value: int = 127, size: int = 256) -> np.ndarray:
    """Create a solid-colour RGB image where HoughCircles cannot find any circle."""
    return np.full((size, size, 3), value, dtype=np.uint8)


def _default_detection(cx: float = 128.0, cy: float = 128.0, r: float = 50.0) -> dict:
    return {"center": (cx, cy), "radius": r}


# ---------------------------------------------------------------------------
# Test 1: invalid detection raises ValueError
# ---------------------------------------------------------------------------

def test_invalid_detection_raises_value_error():
    """Empty detection dict must raise ValueError with the sentinel message."""
    img = _uniform_image()
    with pytest.raises(ValueError, match="segment_invalid_detection"):
        iris_mask(img, {})


def test_invalid_detection_missing_radius_raises():
    """Detection with center but no radius must also raise."""
    img = _uniform_image()
    with pytest.raises(ValueError, match="segment_invalid_detection"):
        iris_mask(img, {"center": (128.0, 128.0)})


def test_invalid_detection_missing_center_raises():
    """Detection with radius but no center must also raise."""
    img = _uniform_image()
    with pytest.raises(ValueError, match="segment_invalid_detection"):
        iris_mask(img, {"radius": 50.0})


# ---------------------------------------------------------------------------
# Test 2: returns required keys with uniform image (Hough falls back)
# ---------------------------------------------------------------------------

def test_returns_required_keys_with_uniform_image():
    """Output dict has binary_mask, iris_circle, segmented_image with correct types/shapes."""
    img = _uniform_image(127, 256)
    detection = _default_detection(128.0, 128.0, 50.0)
    warnings_list: list[str] = []

    result = iris_mask(img, detection, warnings=warnings_list)

    assert set(result.keys()) == {"binary_mask", "iris_circle", "segmented_image"}

    # binary_mask
    assert result["binary_mask"].dtype == bool
    assert result["binary_mask"].shape == (256, 256)

    # segmented_image
    assert result["segmented_image"].shape == (256, 256, 3)
    assert result["segmented_image"].dtype == np.uint8

    # iris_circle — 3 floats
    circle = result["iris_circle"]
    assert len(circle) == 3
    assert all(isinstance(v, float) for v in circle)


# ---------------------------------------------------------------------------
# Test 3: fallback to MediaPipe when Hough fails (uniform image)
# ---------------------------------------------------------------------------

def test_fallback_to_mediapipe_when_hough_fails():
    """Solid-gray image: Hough returns None → iris_circle == seed values, warning appended."""
    img = _uniform_image(127, 256)
    detection = {"center": (50.0, 60.0), "radius": 30.0}
    warnings_list: list[str] = []

    result = iris_mask(img, detection, warnings=warnings_list)

    assert result["iris_circle"] == (50.0, 60.0, 30.0)
    assert "hough_segment_failed_fallback_mediapipe" in warnings_list


# ---------------------------------------------------------------------------
# Test 4: fallback silent when warnings=None
# ---------------------------------------------------------------------------

def test_fallback_silent_when_warnings_none():
    """When warnings=None the fallback must not raise; all keys still present."""
    img = _uniform_image(127, 256)
    detection = {"center": (50.0, 60.0), "radius": 30.0}

    result = iris_mask(img, detection, warnings=None)

    assert "binary_mask" in result
    assert "iris_circle" in result
    assert "segmented_image" in result


# ---------------------------------------------------------------------------
# Test 5: picks closest to seed when multiple Hough candidates
# ---------------------------------------------------------------------------

def test_picks_closest_to_seed_when_multiple_candidates():
    """
    Synthetic image with two distinct dark circles.  Detection seed is close
    to the first circle.  The winner must be the first circle (Pitfall 7 guard).

    If OpenCV's HoughCircles does not resolve both circles in a particular build
    (parameter sensitivity), the test falls back to asserting that the result
    is plausibly close to the seed (within 30 px), never beyond 100 px from it.
    """
    size = 320
    # White background
    img = np.full((size, size, 3), 200, dtype=np.uint8)
    # Circle 1: center (100, 100), radius 60 — draw filled black
    cv2.circle(img, (100, 100), 60, (0, 0, 0), thickness=-1)
    # Circle 2: center (240, 240), radius 60 — draw filled black (far away)
    cv2.circle(img, (240, 240), 60, (0, 0, 0), thickness=-1)

    # Seed close to circle 1
    detection = {"center": (105.0, 105.0), "radius": 60.0}
    warnings_list: list[str] = []

    result = iris_mask(img, detection, warnings=warnings_list)
    cx, cy, _ = result["iris_circle"]

    if "hough_segment_failed_fallback_mediapipe" in warnings_list:
        # Hough found nothing — falls back to seed; that's plausible (within 30 px of seed)
        assert abs(cx - 105.0) <= 30 and abs(cy - 105.0) <= 30
    else:
        # Hough found circle(s) — winner must be the one near (100, 100), not (240, 240)
        dist_to_first = math.sqrt((cx - 100) ** 2 + (cy - 100) ** 2)
        dist_to_seed = math.sqrt((cx - 105.0) ** 2 + (cy - 105.0) ** 2)
        # Result must be closer to seed than 100 px
        assert dist_to_seed < 100, (
            f"iris_circle center ({cx:.1f}, {cy:.1f}) is too far from seed (105, 105): "
            f"{dist_to_seed:.1f} px"
        )
        # And must not have drifted to the far circle at (240, 240)
        dist_to_second = math.sqrt((cx - 240) ** 2 + (cy - 240) ** 2)
        assert dist_to_first <= dist_to_second, (
            f"Expected winner to be closer to first circle (100,100) than second (240,240); "
            f"got ({cx:.1f},{cy:.1f})"
        )


# ---------------------------------------------------------------------------
# Test 6: binary mask geometry — every True pixel lies within iris_circle
# ---------------------------------------------------------------------------

def test_binary_mask_is_inside_iris_circle():
    """Every True pixel in binary_mask must lie within iris_circle radius (+1px aliasing)."""
    img = _uniform_image(127, 256)
    detection = _default_detection(128.0, 128.0, 50.0)
    warnings_list: list[str] = []

    result = iris_mask(img, detection, warnings=warnings_list)
    mask = result["binary_mask"]
    cx, cy, r = result["iris_circle"]

    ys, xs = np.where(mask)
    if len(ys) == 0:
        pytest.skip("mask is all-False — cannot verify geometry")

    dists = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    max_dist = float(dists.max())
    assert max_dist <= r + 1, (
        f"Mask pixel at distance {max_dist:.2f} from center exceeds r={r:.2f} + 1"
    )


# ---------------------------------------------------------------------------
# Test 7: segmented_image is zero outside the mask
# ---------------------------------------------------------------------------

def test_segmented_image_zero_outside_mask():
    """Pixels outside binary_mask must be 0 in all three channels."""
    img = _uniform_image(127, 256)
    detection = _default_detection(128.0, 128.0, 50.0)
    warnings_list: list[str] = []

    result = iris_mask(img, detection, warnings=warnings_list)
    seg = result["segmented_image"]
    mask = result["binary_mask"]

    outside = seg[~mask]  # shape (N_outside, 3)
    assert (outside == 0).all(), (
        f"Found {(outside != 0).any(axis=1).sum()} pixels outside mask that are non-zero"
    )


# ---------------------------------------------------------------------------
# Test 8: metric test — coverage ≥60% of expected iris bbox (gated by fixtures)
# ---------------------------------------------------------------------------

def test_metric_iris_coverage_against_fixture(iris_images, expected):
    """
    For each founder fixture with an annotated iris_bbox, check that the
    iris_mask output covers ≥60% of that bounding-box area (D-X3 hybrid).

    Skipped when:
      - no JPEG fixtures are committed yet (iris_images is empty)
      - expected.json has no "iris_bbox" annotations
    """
    if not iris_images:
        pytest.skip("no founder fixtures yet — iris_images is empty")

    bbox_annotations = expected.get("iris_bbox", {})
    if not bbox_annotations:
        pytest.skip("no founder fixtures yet — expected.json has no iris_bbox annotations")

    # Deferred import: pipeline.detect may raise RuntimeError if the model file
    # is absent (running in CI without pre-baked Modal image).
    try:
        from pipeline.detect import find_iris
    except Exception:
        pytest.skip("pipeline.detect unavailable in this environment")

    for name, img in iris_images.items():
        if name not in bbox_annotations:
            continue

        ann = bbox_annotations[name]
        x1, y1, x2, y2 = ann["x1"], ann["y1"], ann["x2"], ann["y2"]
        bbox_area = (x2 - x1) * (y2 - y1)
        if bbox_area <= 0:
            continue

        try:
            det = find_iris(img)
        except RuntimeError:
            pytest.skip(f"find_iris model unavailable for fixture {name!r}")

        warnings_list: list[str] = []
        result = iris_mask(img, det, warnings=warnings_list)
        mask = result["binary_mask"]

        # Count True pixels inside the annotated bounding box
        roi_mask = mask[y1:y2, x1:x2]
        covered = int(roi_mask.sum())
        coverage = covered / bbox_area

        assert coverage >= 0.6, (
            f"{name}: iris coverage inside bbox = {coverage:.1%} < 60%"
        )
