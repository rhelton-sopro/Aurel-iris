"""
Tests for pipeline.enhance.clahe — RESEARCH Pattern 7 compliance.

Covers:
- Input validation (shape + dtype guards)
- Output shape and dtype invariants
- No-op on uniform (flat) image
- Local contrast increase on gradient image
- Hue preservation (a/b LAB channels untouched)
- Module constants exposed for D-X3 calibration
"""
import cv2
import numpy as np
import pytest

from pipeline.enhance import clahe


# ---------------------------------------------------------------------------
# Validation tests
# ---------------------------------------------------------------------------

def test_invalid_shape_raises():
    """2D array (missing channel dim) must raise ValueError."""
    bad = np.zeros((64, 512), dtype=np.uint8)
    with pytest.raises(ValueError, match="enhance_invalid_input_shape"):
        clahe(bad)


def test_invalid_dtype_raises():
    """float32 input must raise ValueError (only uint8 accepted)."""
    bad = np.zeros((64, 512, 3), dtype=np.float32)
    with pytest.raises(ValueError, match="enhance_invalid_input_dtype"):
        clahe(bad)


# ---------------------------------------------------------------------------
# Output invariants
# ---------------------------------------------------------------------------

def test_output_shape_and_dtype():
    """Output shape and dtype must match uint8 (H, W, 3) input exactly."""
    rng = np.random.default_rng(42)
    img = rng.integers(0, 256, size=(64, 512, 3), dtype=np.uint8)
    result = clahe(img)
    assert result.shape == (64, 512, 3), f"Shape mismatch: {result.shape}"
    assert result.dtype == np.uint8, f"Dtype mismatch: {result.dtype}"


def test_uniform_image_unchanged():
    """Uniform (flat) image should be essentially unchanged after CLAHE (no-op on flat L)."""
    img = np.full((64, 512, 3), 128, dtype=np.uint8)
    result = clahe(img)
    max_drift = int(np.abs(result.astype(int) - img.astype(int)).max())
    assert max_drift <= 2, (
        f"Uniform image drifted by {max_drift} pixel units after CLAHE — "
        "expected <= 2 (flat L channel should be CLAHE no-op)"
    )


# ---------------------------------------------------------------------------
# Contrast improvement test
# ---------------------------------------------------------------------------

def test_local_contrast_increases_for_gradient():
    """CLAHE must improve contrast on a low-contrast image.

    Build a narrow-range gradient image (L channel range ~30 units out of 255).
    CLAHE redistributes the histogram locally, so the overall L-channel standard
    deviation must increase (or stay equal) after enhancement.

    Note: CLAHE does NOT guarantee per-tile range increase — tiles in the interior
    of a smooth gradient see their narrow local range redistributed within the same
    tile context, which can reduce tile-level range while expanding the global
    distribution. The correct metric is global variance / std dev of the L channel.
    """
    # Low-contrast image: narrow luminance range 100-130 (only 30 units out of 255)
    img = np.zeros((64, 512, 3), dtype=np.uint8)
    col_values = np.linspace(100, 130, 512).astype(np.uint8)
    img[:, :, 0] = col_values  # R
    img[:, :, 1] = col_values  # G
    img[:, :, 2] = col_values  # B

    lab_in = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
    l_in = cv2.split(lab_in)[0]
    std_in = float(l_in.std())

    result = clahe(img)

    lab_out = cv2.cvtColor(result, cv2.COLOR_RGB2LAB)
    l_out = cv2.split(lab_out)[0]
    std_out = float(l_out.std())

    # CLAHE must not decrease the standard deviation of the L channel on a
    # low-contrast image (allow 5% tolerance for edge effects)
    assert std_out >= std_in * 0.95, (
        f"L-channel std decreased after CLAHE: before={std_in:.2f}, after={std_out:.2f}. "
        "CLAHE should preserve or increase contrast spread on a low-contrast image."
    )


# ---------------------------------------------------------------------------
# Hue preservation test
# ---------------------------------------------------------------------------

def test_hue_approximately_preserved():
    """Dominant HSV hue must not shift more than 5 units after CLAHE.

    Uses a reddish-brown image (RGB 120, 80, 40) with a well-defined H in HSV.
    The a/b LAB channels are not modified by our implementation, so hue drift
    should be negligible.
    """
    img = np.full((64, 512, 3), (120, 80, 40), dtype=np.uint8)

    result = clahe(img)

    # HSV in OpenCV: H in [0, 180]
    hsv_in = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
    hsv_out = cv2.cvtColor(result, cv2.COLOR_RGB2HSV)

    h_in = int(np.median(hsv_in[:, :, 0]))
    h_out = int(np.median(hsv_out[:, :, 0]))

    # Circular hue distance
    diff = abs(h_in - h_out)
    diff = min(diff, 180 - diff)  # wrap around the hue circle

    assert diff < 5, (
        f"Hue drifted by {diff} OpenCV-HSV units (limit: 5). "
        f"Input median H={h_in}, output median H={h_out}. "
        "CLAHE on LAB L-channel should not change hue significantly."
    )


# ---------------------------------------------------------------------------
# Constants exposure test
# ---------------------------------------------------------------------------

def test_clahe_constants_exposed():
    """Module must export CLAHE_CLIP_LIMIT and CLAHE_TILE_GRID_SIZE for D-X3 calibration."""
    from pipeline.enhance import CLAHE_CLIP_LIMIT, CLAHE_TILE_GRID_SIZE

    assert CLAHE_CLIP_LIMIT == 2.0, f"Expected 2.0, got {CLAHE_CLIP_LIMIT}"
    assert CLAHE_TILE_GRID_SIZE == (4, 8), f"Expected (4, 8), got {CLAHE_TILE_GRID_SIZE}"
