"""Shared OpenCV mask helpers for the iris vision pipeline.

Phase 07.1.5 D-01: HSV color pre-segmentation that isolates iris-candidate
pixels before Hough or U-Net inference. Imported by both
pipeline.detect._hough_circle_fallback and pipeline.segment.iris_mask
(single source of truth per WARN-2 — no cross-module import of a
'_'-prefixed private helper).
"""
from __future__ import annotations

import cv2
import numpy as np

# --- Approach B color pre-segmentation constants (Phase 07.1.5 D-01) -------
# Starting values — tuned via probe iteration in Wave 2 per RESEARCH Pitfalls 1-4.
# All thresholds operate on OpenCV HSV scale: H in [0, 179], S/V in [0, 255].
_COLOR_MASK_S_MIN = 80          # Cycle 3: raised from 60 — Cycle 2 mask ratio still ~0.80 (too permissive); Nailli iris has S>=100 in close-ups, skin S~40-70
_COLOR_MASK_V_MIN = 50          # Cycle 2: raised from 40 — drops more eyelash + skin shadow; iris still survives (V~70+ at 1024 resize)
_COLOR_MASK_CLOSE_KERNEL = (5, 5)   # Fills specular reflection holes up to ~8 px diameter
_COLOR_MASK_CLOSE_ITER = 2
_COLOR_MASK_OPEN_KERNEL = (7, 7)    # Cycle 3: enlarged from (5,5) per Pitfall 2 — Cycle 2 eyelash residue caused Hough to pick eyebrow arcs on LEFT
_COLOR_MASK_OPEN_ITER = 2           # Cycle 3: doubled from 1 — more aggressive cleanup of skin/eyelid residue


def color_iris_mask(rgb: np.ndarray) -> np.ndarray:
    """Build a binary mask isolating iris-candidate pixels (Phase 07.1.5 Approach B).

    HSV-based color pre-segmentation that drops sclera (low saturation),
    pupil/eyelash (very low value), and most skin/eyelid via morphology.
    Used inside ``_hough_circle_fallback`` and ``segment.iris_mask`` to
    remove eyebrow/eyelid arcs from the Hough accumulator's search space.

    Args:
        rgb: H x W x 3 uint8 RGB numpy array (post-resize, <=1024 long edge
            in detect.py; full-resolution in segment.py).

    Returns:
        uint8 H x W mask with values 0 (drop) or 255 (keep).

    Raises:
        ValueError: if input shape/dtype invalid (defensive guard per T-07.1.5-03
            DoS mitigation — bounded input contract).
    """
    if rgb.dtype != np.uint8 or rgb.ndim != 3 or rgb.shape[2] != 3:
        raise ValueError(
            f"color_iris_mask: expected uint8 HxWx3, got {rgb.dtype} {rgb.shape}"
        )

    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    lower = np.array([0, _COLOR_MASK_S_MIN, _COLOR_MASK_V_MIN], dtype=np.uint8)
    upper = np.array([179, 255, 255], dtype=np.uint8)
    mask = cv2.inRange(hsv, lower, upper)

    # Closing first — fills internal holes (specular reflections inside iris,
    # pupil region that drops below the V threshold). Per RESEARCH Pitfall 4.
    kernel_close = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, _COLOR_MASK_CLOSE_KERNEL
    )
    mask = cv2.morphologyEx(
        mask, cv2.MORPH_CLOSE, kernel_close,
        iterations=_COLOR_MASK_CLOSE_ITER,
    )

    # Opening second — removes thin eyelash strands and tiny isolated regions
    # that survived the colour filter. Per RESEARCH Pitfall 2.
    kernel_open = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, _COLOR_MASK_OPEN_KERNEL
    )
    mask = cv2.morphologyEx(
        mask, cv2.MORPH_OPEN, kernel_open,
        iterations=_COLOR_MASK_OPEN_ITER,
    )

    return mask
