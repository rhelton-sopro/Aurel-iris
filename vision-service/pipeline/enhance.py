"""
Stage 5/6: Contrast enhancement (CLAHE) — RESEARCH Pattern 7.

Applies CLAHE to the L-channel of the LAB color space only.

Anti-pattern guard: applying CLAHE to RGB directly shifts hue/saturation;
we work on the LAB L-channel only, leaving the a/b (chroma) channels
untouched so that iris color information is preserved for downstream
color classification in the features stage.
"""
from __future__ import annotations

import cv2
import numpy as np

# Calibration constants (RESEARCH Pattern 7, assumption A3).
# Exported for D-X3 calibration: adjust these constants — do NOT hard-code
# values inside the function body.
CLAHE_CLIP_LIMIT = 2.0
CLAHE_TILE_GRID_SIZE = (4, 8)


def clahe(normalized_image: np.ndarray) -> np.ndarray:
    """
    Apply Contrast Limited Adaptive Histogram Equalization to the L-channel
    of the LAB color space (RESEARCH Pattern 7).

    Args:
        normalized_image: output of pipeline.normalize.daugman_polar.
            np.ndarray shape (H, W, 3), dtype uint8, RGB color order.

    Returns:
        Enhanced image ready for feature extraction.
        Same shape and dtype as input; hue/saturation preserved.

    Raises:
        ValueError: If input does not have 3 channels or is not uint8.
    """
    if normalized_image.ndim != 3 or normalized_image.shape[2] != 3:
        raise ValueError("enhance_invalid_input_shape")
    if normalized_image.dtype != np.uint8:
        raise ValueError("enhance_invalid_input_dtype")

    # RGB → LAB (L: luminance 0-255, a/b: chroma channels)
    lab = cv2.cvtColor(normalized_image, cv2.COLOR_RGB2LAB)

    # Split into L, a, b channels
    l_chan, a_chan, b_chan = cv2.split(lab)

    # Build CLAHE object with iris-specific calibration constants
    clahe_obj = cv2.createCLAHE(clipLimit=CLAHE_CLIP_LIMIT, tileGridSize=CLAHE_TILE_GRID_SIZE)

    # Apply CLAHE only to the L (luminance) channel
    l_enhanced = clahe_obj.apply(l_chan)

    # Merge back: a/b channels are NOT modified (anti-pattern guard)
    enhanced_lab = cv2.merge([l_enhanced, a_chan, b_chan])

    # LAB → RGB: output matches input color order
    return cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2RGB)
