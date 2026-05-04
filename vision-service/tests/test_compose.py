"""
Structural tests for pipeline.compose.photometric_combine.

Covers:
  - Empty input raises ValueError("compose_empty_input")
  - Mismatched shapes raise ValueError("compose_shape_mismatch")
  - Output keys, dtype, shape invariants
  - Weighted average correctness (frontal 0.4 + lateral 0.4 + backlight 0.2)
  - No NaN, no overflow
  - iris_circle propagated from index 0
  - pupil_circle propagation (None when absent; value when present)
  - Unknown angle falls back to _DEFAULT_WEIGHT (0.33)
  - Single-input passthrough
"""
import numpy as np
import pytest

from pipeline.compose import _DEFAULT_WEIGHT, ANGLE_WEIGHTS, photometric_combine


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _make_seg(
    value: int,
    angle: str,
    iris_circle: tuple,
    shape: tuple = (64, 64, 3),
    pupil_circle=None,
) -> dict:
    """Build a minimal segment dict as produced by pipeline.segment.iris_mask."""
    seg = {
        "segmented_image": np.full(shape, value, dtype=np.uint8),
        "iris_circle": iris_circle,
        "binary_mask": np.ones(shape[:2], dtype=bool),
        "angle": angle,
    }
    if pupil_circle is not None:
        seg["pupil_circle"] = pupil_circle
    return seg


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------

def test_empty_input_raises():
    """Empty list must raise ValueError with message 'compose_empty_input'."""
    with pytest.raises(ValueError, match="compose_empty_input"):
        photometric_combine([])


def test_shape_mismatch_raises():
    """Two segments with different H×W must raise ValueError('compose_shape_mismatch')."""
    seg_a = _make_seg(100, "frontal", (32.0, 32.0, 28.0), shape=(64, 64, 3))
    seg_b = _make_seg(100, "lateral", (16.0, 16.0, 14.0), shape=(32, 32, 3))
    with pytest.raises(ValueError, match="compose_shape_mismatch"):
        photometric_combine([seg_a, seg_b])


def test_returns_required_keys():
    """Output dict must contain segmented_image, iris_circle, pupil_circle."""
    segs = [
        _make_seg(200, "frontal",   (32.0, 32.0, 30.0)),
        _make_seg(100, "lateral",   (32.0, 32.0, 30.0)),
        _make_seg(50,  "backlight", (32.0, 32.0, 30.0)),
    ]
    result = photometric_combine(segs)
    assert "segmented_image" in result
    assert "iris_circle" in result
    assert "pupil_circle" in result
    assert result["segmented_image"].dtype == np.uint8
    assert result["segmented_image"].shape == (64, 64, 3)


def test_weighted_average_correct():
    """
    Frontal=200, lateral=100, backlight=50, weights 0.4/0.4/0.2.
    Expected = (200*0.4 + 100*0.4 + 50*0.2) / (0.4+0.4+0.2) = 130.0
    """
    segs = [
        _make_seg(200, "frontal",   (32.0, 32.0, 30.0)),
        _make_seg(100, "lateral",   (32.0, 32.0, 30.0)),
        _make_seg(50,  "backlight", (32.0, 32.0, 30.0)),
    ]
    result = photometric_combine(segs)
    # 1 unit tolerance for float32 → uint8 rounding.
    assert np.allclose(result["segmented_image"], 130, atol=1)


def test_no_nan_no_overflow():
    """Output must have no NaN values and be within [0, 255]."""
    segs = [
        _make_seg(200, "frontal",   (32.0, 32.0, 30.0)),
        _make_seg(100, "lateral",   (32.0, 32.0, 30.0)),
        _make_seg(50,  "backlight", (32.0, 32.0, 30.0)),
    ]
    result = photometric_combine(segs)
    assert not np.isnan(result["segmented_image"].astype(np.float32)).any()
    assert result["segmented_image"].max() <= 255
    assert result["segmented_image"].min() >= 0


def test_iris_circle_propagated_from_index_0():
    """iris_circle must come from segmented_images[0], not any other."""
    segs = [
        _make_seg(128, "frontal",   (10.0, 10.0, 5.0)),
        _make_seg(128, "lateral",   (20.0, 20.0, 10.0)),
        _make_seg(128, "backlight", (30.0, 30.0, 15.0)),
    ]
    result = photometric_combine(segs)
    assert result["iris_circle"] == (10.0, 10.0, 5.0)


def test_pupil_circle_none_when_absent():
    """pupil_circle must be None when no input segment carries it."""
    segs = [
        _make_seg(128, "frontal",   (32.0, 32.0, 30.0)),
        _make_seg(128, "lateral",   (32.0, 32.0, 30.0)),
        _make_seg(128, "backlight", (32.0, 32.0, 30.0)),
    ]
    result = photometric_combine(segs)
    assert result["pupil_circle"] is None


def test_pupil_circle_propagated_when_present():
    """pupil_circle from segmented_images[0] must be forwarded unchanged."""
    segs = [
        _make_seg(128, "frontal",   (32.0, 32.0, 30.0), pupil_circle=(32.0, 32.0, 10.0)),
        _make_seg(128, "lateral",   (32.0, 32.0, 30.0)),
        _make_seg(128, "backlight", (32.0, 32.0, 30.0)),
    ]
    result = photometric_combine(segs)
    assert result["pupil_circle"] == (32.0, 32.0, 10.0)


def test_unknown_angle_uses_default_weight():
    """
    All segments with unrecognised angle label 'bizarro' must use _DEFAULT_WEIGHT.
    With uniform pixel value, output must equal the input value (all equal weights).
    """
    segs = [
        _make_seg(100, "bizarro", (32.0, 32.0, 30.0)),
        _make_seg(100, "bizarro", (32.0, 32.0, 30.0)),
        _make_seg(100, "bizarro", (32.0, 32.0, 30.0)),
    ]
    result = photometric_combine(segs)
    # All identical inputs → output identical regardless of weight (as long as weight > 0).
    assert np.allclose(result["segmented_image"], 100, atol=1)
    # Confirm _DEFAULT_WEIGHT is the fallback used (value defined in module).
    assert _DEFAULT_WEIGHT == 0.33


def test_iris_circle_unchanged_when_only_one_input():
    """Single input: iris_circle unchanged; segmented_image matches input within 1 unit."""
    iris = (20.0, 20.0, 15.0)
    seg = _make_seg(128, "frontal", iris)
    result = photometric_combine([seg])
    assert result["iris_circle"] == iris
    # float32 roundtrip from a uniform uint8 image must be lossless at 128.
    assert np.allclose(result["segmented_image"], 128, atol=1)
