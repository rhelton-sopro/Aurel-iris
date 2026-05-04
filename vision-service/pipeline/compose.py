"""
Stage 3/6: Photometric composition.

Combines 3 angles per eye (frontal, lateral, backlight) into a single
information-rich composite image via weighted average.

Implementation follows RESEARCH.md "Code Examples — Photometric Composition".
Weights are starting defaults (RESEARCH assumption A4) calibrated against
fixtures via D-X3. Future calibration changes ANGLE_WEIGHTS only.

Threat mitigations applied (see plan threat model):
  T-05-06-01: float32 accumulation + clip-to-255 prevents uint8 overflow.
  T-05-06-02: explicit shape check raises compose_shape_mismatch early.
"""
from __future__ import annotations

import numpy as np

# Angle weights — RESEARCH.md assumption A4 / SPEC §4.2.
# backlight receives lower weight because high specular content
# in backlight images degrades texture fidelity.
# Calibratable: change only these constants, no logic changes needed.
ANGLE_WEIGHTS: dict[str, float] = {
    "frontal": 0.4,
    "lateral": 0.4,
    "backlight": 0.2,
}

# Fallback weight for unrecognised angle labels (defensive default).
_DEFAULT_WEIGHT: float = 0.33


def photometric_combine(segmented_images: list[dict]) -> dict:
    """
    Combine multiple segmented eye images into a composite.

    Args:
        segmented_images: list of dicts from pipeline.segment.iris_mask
                          (one per angle: frontal, lateral, backlight).
                          Each dict must contain:
                            - "segmented_image": np.ndarray (H, W, 3) uint8
                            - "iris_circle": (cx, cy, r)
                          Optional keys:
                            - "angle": str ("frontal" | "lateral" | "backlight")
                              defaults to "frontal" when absent.
                            - "pupil_circle": (cx, cy, r) | None

    Returns:
        Composite image enhanced for downstream feature extraction.
        Dict keys:
          - "segmented_image": np.ndarray (H, W, 3) uint8
          - "iris_circle": (cx, cy, r)  — propagated from segmented_images[0]
          - "pupil_circle": (cx, cy, r) | None — from segmented_images[0]

    Raises:
        ValueError: "compose_empty_input" if segmented_images is empty.
        ValueError: "compose_shape_mismatch" if images do not share H×W.
        ValueError: "compose_zero_weight" if total weight is zero (defensive).
    """
    if not segmented_images:
        raise ValueError("compose_empty_input")

    first_img = segmented_images[0]["segmented_image"]
    H, W = first_img.shape[:2]

    # Validate all images share the same spatial dimensions.
    for seg in segmented_images[1:]:
        h, w = seg["segmented_image"].shape[:2]
        if h != H or w != W:
            raise ValueError("compose_shape_mismatch")

    composite = np.zeros((H, W, 3), dtype=np.float32)
    total_weight = 0.0

    for seg in segmented_images:
        angle = seg.get("angle", "frontal")
        weight = ANGLE_WEIGHTS.get(angle, _DEFAULT_WEIGHT)
        img = seg["segmented_image"].astype(np.float32)
        composite += img * weight
        total_weight += weight

    if total_weight == 0:
        raise ValueError("compose_zero_weight")

    out = np.clip(composite / total_weight, 0, 255).astype(np.uint8)

    return {
        "segmented_image": out,
        "iris_circle": segmented_images[0]["iris_circle"],
        "pupil_circle": segmented_images[0].get("pupil_circle"),
    }
