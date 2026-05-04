"""
Tests for pipeline.normalize.daugman_polar (Stage 4/6).

Coverage:
- Shape (64 x 512 x 3) and dtype uint8
- Missing required keys → ValueError("normalize_invalid_input")
- pupil_circle absent (key not in dict) → fallback r_pupil = r_iris * 0.35
- pupil_circle=None (key present but None) → same fallback
- Synthetic white annulus on black image → polar mean > 100 (samples land in ring)
- Performance: cv2.remap-based implementation completes in < 50ms for 256x256 input
- Off-center iris_circle → no crash (cv2.remap BORDER_CONSTANT handles edges)
"""
from __future__ import annotations

import time

import cv2
import numpy as np
import pytest

from pipeline.normalize import POLAR_ANGULAR, POLAR_RADIAL, daugman_polar


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_uniform_image(value: int = 100, size: int = 256) -> np.ndarray:
    """Return a (size, size, 3) uint8 image filled with *value*."""
    return np.full((size, size, 3), value, dtype=np.uint8)


def _make_annulus_image(
    center: tuple[int, int] = (128, 128),
    r_outer: int = 100,
    r_inner: int = 35,
    size: int = 256,
) -> np.ndarray:
    """
    Return a (size, size, 3) uint8 image with a white annulus on black.

    Outer circle filled white, inner circle (pupil region) overdrawn black,
    producing a white ring between r_inner and r_outer.
    """
    img = np.zeros((size, size, 3), dtype=np.uint8)
    cv2.circle(img, center, r_outer, (255, 255, 255), thickness=-1)
    cv2.circle(img, center, r_inner, (0, 0, 0), thickness=-1)
    return img


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_invalid_input_raises_on_empty_dict():
    """Empty dict → missing both required keys → ValueError."""
    with pytest.raises(ValueError, match="normalize_invalid_input"):
        daugman_polar({})


def test_invalid_input_raises_on_missing_iris_circle():
    """Dict with only segmented_image → ValueError."""
    img = _make_uniform_image()
    with pytest.raises(ValueError, match="normalize_invalid_input"):
        daugman_polar({"segmented_image": img})


def test_invalid_input_raises_on_missing_segmented_image():
    """Dict with only iris_circle → ValueError."""
    with pytest.raises(ValueError, match="normalize_invalid_input"):
        daugman_polar({"iris_circle": (128.0, 128.0, 100.0)})


def test_invalid_input_raises_on_non_dict():
    """Non-dict input → ValueError."""
    with pytest.raises(ValueError, match="normalize_invalid_input"):
        daugman_polar(None)  # type: ignore[arg-type]


def test_output_shape_and_dtype():
    """Output must be (POLAR_RADIAL, POLAR_ANGULAR, 3) uint8."""
    img = _make_uniform_image(value=100)
    composite = {
        "segmented_image": img,
        "iris_circle": (128.0, 128.0, 100.0),
        "pupil_circle": (128.0, 128.0, 35.0),
    }
    polar = daugman_polar(composite)
    assert polar.shape == (64, 512, 3), f"Expected (64, 512, 3), got {polar.shape}"
    assert polar.shape == (POLAR_RADIAL, POLAR_ANGULAR, 3)
    assert polar.dtype == np.uint8, f"Expected uint8, got {polar.dtype}"


def test_pupil_fallback_when_key_absent():
    """pupil_circle key absent → fallback r_pupil=r_iris*0.35; no error; shape unchanged."""
    img = _make_uniform_image(value=128)
    composite = {
        "segmented_image": img,
        "iris_circle": (128.0, 128.0, 100.0),
        # "pupil_circle" intentionally omitted
    }
    polar = daugman_polar(composite)
    assert polar.shape == (POLAR_RADIAL, POLAR_ANGULAR, 3)
    assert polar.dtype == np.uint8


def test_pupil_fallback_when_pupil_circle_is_none():
    """pupil_circle=None → fallback r_pupil=r_iris*0.35; no error; shape unchanged."""
    img = _make_uniform_image(value=128)
    composite = {
        "segmented_image": img,
        "iris_circle": (128.0, 128.0, 100.0),
        "pupil_circle": None,
    }
    polar = daugman_polar(composite)
    assert polar.shape == (POLAR_RADIAL, POLAR_ANGULAR, 3)
    assert polar.dtype == np.uint8


def test_synthetic_ring_produces_nonzero_polar():
    """
    White annulus (r_inner=35, r_outer=100) on black background:
    most polar samples land inside the white ring → mean > 100.
    """
    img = _make_annulus_image(center=(128, 128), r_outer=100, r_inner=35)
    composite = {
        "segmented_image": img,
        "iris_circle": (128.0, 128.0, 100.0),
        "pupil_circle": (128.0, 128.0, 35.0),
    }
    polar = daugman_polar(composite)
    mean_val = float(polar.mean())
    # Most radial rows sample inside the white annulus; tolerance accounts for
    # BORDER_CONSTANT=0 padding on rows near r_ratio→0 (very close to pupil edge).
    assert mean_val > 100, (
        f"Expected polar mean > 100 (samples inside white ring), got {mean_val:.1f}"
    )


def test_performance_under_50ms():
    """
    cv2.remap-based implementation must complete in < 50ms for a 256x256 input.
    A Python pixel loop for 64x512 would take ~500ms+ — this guards against
    accidental regression to a slow loop.
    """
    img = _make_uniform_image(value=100)
    composite = {
        "segmented_image": img,
        "iris_circle": (128.0, 128.0, 100.0),
        "pupil_circle": (128.0, 128.0, 35.0),
    }
    # Warm-up: one call to prime any lazy imports / JIT within cv2
    daugman_polar(composite)

    N = 5
    times_ms: list[float] = []
    for _ in range(N):
        t0 = time.perf_counter()
        daugman_polar(composite)
        t1 = time.perf_counter()
        times_ms.append((t1 - t0) * 1000.0)

    min_ms = min(times_ms)
    assert min_ms < 50.0, (
        f"Minimum call time {min_ms:.1f}ms exceeds 50ms limit. "
        f"All times: {[f'{t:.1f}ms' for t in times_ms]}. "
        "A Python double-loop implementation would be much slower."
    )


def test_iris_circle_off_center_works():
    """
    Off-center iris (partially outside image) must not crash.
    cv2.remap with BORDER_CONSTANT=0 fills out-of-bounds pixels with 0.
    """
    img = _make_uniform_image(value=128)
    composite = {
        "segmented_image": img,
        "iris_circle": (80.0, 200.0, 50.0),
        # pupil_circle absent → fallback
    }
    polar = daugman_polar(composite)
    assert polar.shape == (POLAR_RADIAL, POLAR_ANGULAR, 3)
    assert polar.dtype == np.uint8
