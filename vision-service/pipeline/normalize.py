"""
Stage 4/6: Polar normalization (Daugman rubber sheet).

Implements Daugman's rubber-sheet model: the iris annulus (between pupil circle
and iris circle) is mapped to a fixed-size rectangular polar image.

Design choices:
- POLAR_RADIAL = 64, POLAR_ANGULAR = 512 — literature convention from RESEARCH
  assumption A2; standard in CASIA benchmarks and open iris-recognition
  implementations.
- cv2.remap is used instead of a Python double loop (RESEARCH "Don't Hand-Roll",
  line 921). np.outer pre-computes the full (64, 512) coordinate grids
  in SIMD-friendly NumPy operations; cv2.remap performs bilinear interpolation
  via the C++ backend, orders of magnitude faster than a Python pixel loop.
- Interpolation: cv2.INTER_LINEAR (bilinear) — standard for iris normalization,
  balances quality and speed (RESEARCH assumption A7).
- Missing pupil circle: fallback r_pupil = r_iris * 0.35 (RESEARCH Pattern 6,
  line 723).

References:
  Daugman, J. (2004). How iris recognition works.
  IEEE Transactions on Circuits and Systems for Video Technology, 14(1), 21–30.
"""

from __future__ import annotations

import cv2
import numpy as np

POLAR_RADIAL: int = 64   # radial resolution: pupil boundary → iris boundary
POLAR_ANGULAR: int = 512  # angular resolution: 0 → 2π


def daugman_polar(composite_image: dict) -> np.ndarray:
    """
    Apply Daugman's rubber-sheet model to map the iris ring to a rectangle.

    Args:
        composite_image: output of pipeline.compose.photometric_combine.
            Must be a dict with keys:
                "segmented_image" (np.ndarray, shape (H, W, 3), dtype uint8)
                "iris_circle"    (cx: float, cy: float, r_iris: float)
                "pupil_circle"   (cx: float, cy: float, r_pupil: float) | None
                                 — omitted or None triggers fallback.

    Returns:
        Rectangular polar image of the iris, shape (POLAR_RADIAL, POLAR_ANGULAR, 3),
        dtype uint8. Pixels outside the source image are filled with 0 (black)
        via cv2.BORDER_CONSTANT.

    Raises:
        ValueError("normalize_invalid_input"): if "segmented_image" or
            "iris_circle" is missing from composite_image.
    """
    if not isinstance(composite_image, dict):
        raise ValueError("normalize_invalid_input")
    if "segmented_image" not in composite_image or "iris_circle" not in composite_image:
        raise ValueError("normalize_invalid_input")

    image: np.ndarray = composite_image["segmented_image"]
    cx, cy, r_iris = composite_image["iris_circle"]

    pupil = composite_image.get("pupil_circle")
    if pupil is None:
        r_pupil = r_iris * 0.35  # RESEARCH Pattern 6 line 723 fallback
    else:
        _, _, r_pupil = pupil

    # --- Build coordinate grids (SIMD-friendly; no Python loops) ---
    #
    # theta: angular samples uniformly distributed over [0, 2π)
    # r_ratio: radial samples uniformly distributed over [0, 1)
    #          r_ratio=0 → pupil boundary, r_ratio=1 → iris boundary
    # radii: actual pixel radii for each radial row
    #
    # map_x[r_row, theta_col] = x coordinate in the source image
    # map_y[r_row, theta_col] = y coordinate in the source image
    theta = np.linspace(0.0, 2.0 * np.pi, POLAR_ANGULAR, endpoint=False, dtype=np.float32)
    r_ratio = np.linspace(0.0, 1.0, POLAR_RADIAL, endpoint=False, dtype=np.float32)
    radii = (r_pupil + (r_iris - r_pupil) * r_ratio).astype(np.float32)  # (POLAR_RADIAL,)
    cos_t = np.cos(theta)   # (POLAR_ANGULAR,)
    sin_t = np.sin(theta)   # (POLAR_ANGULAR,)

    # Outer product: map[r, theta] = center + radius[r] * trig(theta)
    map_x = (cx + np.outer(radii, cos_t)).astype(np.float32)  # (64, 512)
    map_y = (cy + np.outer(radii, sin_t)).astype(np.float32)  # (64, 512)

    # --- cv2.remap: bilinear interpolation; out-of-bounds → 0 ---
    polar: np.ndarray = cv2.remap(
        image,
        map_x,
        map_y,
        cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=0,
    )
    # polar.shape == (POLAR_RADIAL, POLAR_ANGULAR, 3)  dtype uint8

    return polar
