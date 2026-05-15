"""
Stage 2/6: Iris segmentation.

MVP baseline (SPEC §4.4): Hough Transform circular via OpenCV.
Implementation follows RESEARCH Pattern 5 (lines 631-691):
    - HOUGH_DEFAULTS exported as calibration knob per D-X3.
    - Pitfall 7 guard: closest-to-seed circle selection via np.argmin(dists).
    - D-F1 soft degradation: falls back to MediaPipe estimate when Hough returns None,
      appending "hough_segment_failed_fallback_mediapipe" to the warnings sink.

v1.1 upgrade (deferred): U-Net pre-trained on CASIA-Iris.
"""
from __future__ import annotations

from typing import Optional

import cv2
import numpy as np

from pipeline.masks import color_iris_mask

# Starting values calibrated for ~1024px resized iris images.
# Source: Literature (Masek 2003, Daugman 2004) + OpenCV Hough docs.
# These are STARTING POINTS — must be calibrated against founder fixtures (D-X3).
# Exported as a module constant so tuning changes are visible in git diff (T-05-05-04).
HOUGH_DEFAULTS: dict = {
    "dp": 1.0,       # Accumulator resolution = image resolution
    "minDist": 100,  # Minimum distance between detected circle centers
    "param1": 100,   # Upper Canny threshold (lower = param1/2 automatically)
    "param2": 40,    # Accumulator threshold — lower = more false positives
    "minRadius": 80,  # ~8% of 1024px — iris is typically 10–15% of full-frame
    "maxRadius": 200, # ~20% of 1024px
}

# Phase 7.4 iter-6a FIX 11 — ROOT CAUSE of "hough_segment_failed_fallback_
# mediapipe" on 6/6 photos: HOUGH_DEFAULTS minRadius/maxRadius (80–200 px) are
# explicitly calibrated for ~1024px-resized iris images (see comment above),
# but iris_mask() ran HoughCircles on the FULL-RESOLUTION capture (no resize),
# unlike detect.py which resizes to 1024 first. On a 4K photo the true iris
# radius is far larger than 200 px, so HoughCircles returns None every time →
# the D-F1 fallback (seed circle) fires on every image and segmentation never
# refines the boundary. Fix: resize to ≤1024 before Hough (mirroring detect.py),
# then scale the detected circle back to full-resolution coordinates.
HOUGH_MAX_DIM = 1024


def iris_mask(
    image: np.ndarray,
    detection: dict,
    *,
    warnings: Optional[list[str]] = None,
) -> dict:
    """
    Compute a binary mask isolating the iris region.

    Implementation: RESEARCH Pattern 5 (HoughCircles) with Pitfall 7 guard
    (closest-to-seed selection via np.argmin(dists)) and D-F1 soft degradation
    fallback to MediaPipe estimate when Hough returns nothing.

    Args:
        image:     numpy array (H, W, 3), RGB colour space.
        detection: dict from pipeline.detect.find_iris with mandatory keys
                   "center" (cx, cy) and "radius" (float).
        warnings:  optional list owned by the orchestrator (05-10); when provided,
                   soft-degradation events are appended to it.  When None the
                   function works but events are silently dropped.

    Returns:
        dict with:
            binary_mask     – (H, W) bool ndarray
            iris_circle     – (cx, cy, r) tuple of float
            segmented_image – (H, W, 3) uint8 RGB ndarray, zero outside mask

    Raises:
        ValueError("segment_invalid_detection") when detection is missing
            required keys.  The orchestrator (05-10) catches this for D-F1
            per-eye soft degradation.
    """
    # Guard: ensure upstream detect output is present (orchestrator catches ValueError).
    if "center" not in detection or "radius" not in detection:
        raise ValueError("segment_invalid_detection")

    # Seed from MediaPipe estimate — used as fallback (D-F1) and proximity anchor (Pitfall 7).
    cx_seed, cy_seed = detection["center"]
    r_seed = detection["radius"]

    h, w = image.shape[:2]

    # --- Hough pre-processing ------------------------------------------------
    # Convert RGB → gray; medianBlur reduces specular highlight noise before Hough.
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)

    # --- Phase 07.1.5 additive defense: same color mask as detect.py ---
    # Even with a good seed, segment's independent Hough can still pick
    # eyebrow arcs on full-resolution input. Apply the same shared color
    # mask (pipeline.masks.color_iris_mask) so the gradient image only
    # sees iris-candidate pixels.
    _seg_color_mask = color_iris_mask(image)
    gray = cv2.bitwise_and(gray, gray, mask=_seg_color_mask)

    # --- FIX 11: resize to ≤1024 BEFORE Hough so HOUGH_DEFAULTS (calibrated
    # for ~1024px) actually match the iris radius. detect.py already does
    # this; iris_mask() did not, which is why Hough failed on every full-res
    # capture. Coordinates are scaled back to full resolution afterwards.
    long_edge = max(h, w)
    if long_edge > HOUGH_MAX_DIM:
        hough_scale = HOUGH_MAX_DIM / float(long_edge)
        small = cv2.resize(
            gray,
            (int(round(w * hough_scale)), int(round(h * hough_scale))),
            interpolation=cv2.INTER_AREA,
        )
    else:
        hough_scale = 1.0
        small = gray

    gray_blur = cv2.medianBlur(small, 5)

    # --- HoughCircles call (RESEARCH Pattern 5) --------------------------------
    circles = cv2.HoughCircles(
        gray_blur,
        cv2.HOUGH_GRADIENT,
        **HOUGH_DEFAULTS,
    )

    if circles is None:
        # D-F1 soft degradation: fall back to MediaPipe estimate when Hough fails.
        cx, cy, r = float(cx_seed), float(cy_seed), float(r_seed)
        if warnings is not None:
            warnings.append("hough_segment_failed_fallback_mediapipe")
        print(
            f"[segment] hough_no_circle img={w}x{h} scale={hough_scale:.3f} "
            f"params={HOUGH_DEFAULTS} → fallback to seed "
            f"({cx_seed:.0f},{cy_seed:.0f},r={r_seed:.0f})"
        )
    else:
        # circles shape: (1, N, 3) — extract candidate array (N, 3), scaled
        # back to full-resolution coordinates.
        cands = circles[0].astype(np.float64) / hough_scale  # (N, 3) full-res

        # Pitfall 7 guard: pick the circle closest to the MediaPipe seed, NOT circles[0][0].
        dists = np.sqrt(
            (cands[:, 0] - cx_seed) ** 2 + (cands[:, 1] - cy_seed) ** 2
        )
        best = int(np.argmin(dists))
        cx, cy, r = float(cands[best, 0]), float(cands[best, 1]), float(cands[best, 2])
        print(
            f"[segment] hough_ok img={w}x{h} scale={hough_scale:.3f} "
            f"candidates={len(cands)} chosen=({cx:.0f},{cy:.0f},r={r:.0f})"
        )

    # --- Build binary mask ---------------------------------------------------
    mask_u8 = np.zeros((h, w), dtype=np.uint8)
    cv2.circle(mask_u8, (int(cx), int(cy)), int(r), 1, thickness=-1)
    binary_mask = mask_u8.astype(bool)

    # --- Segmented image: zero outside mask -----------------------------------
    segmented = cv2.bitwise_and(image, image, mask=mask_u8)

    return {
        "binary_mask": binary_mask,
        "iris_circle": (cx, cy, r),
        "segmented_image": segmented,
    }
