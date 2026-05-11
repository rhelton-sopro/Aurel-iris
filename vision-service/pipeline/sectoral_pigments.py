"""Per-sector chromatic pigment detection (PLAN 07.1-02 P0.3).

Iridology context (founder calibration 2026-05-09): pigment markers visible
on the iris are clinically as important as geometric findings (lacunas).
Amarelo-âmbar in superior sectors signals hepato-biliary terrain;
marrom-difuso signals chronic hematogenea overlap; laranja signals
digestive/pancreatic involvement.

Algorithm:
    1. Take the polar-normalized iris image (64 x 504 RGB, 12 hour-sectors).
    2. For each hour i in 1..12:
         - Slice column range [(i-1)*SECTOR_W : i*SECTOR_W]
         - Restrict rows to the ciliary ring (middle 50% of H — excludes
           pupil edge artifacts at top rows and limbus at bottom).
         - Compute LAB mean across that slice.
    3. Compute base LAB = median across ALL 12 sector means
       (robust to outliers — if 2 sectors are dyed, base still reflects stroma).
    4. delta_LAB[i] = sector_LAB[i] - base_LAB.
    5. Classify (priority order — laranja > amarelo_ambar > marrom_difuso so
       laranja (a+ AND b+) wins over amarelo_ambar (b+ only) when both apply):
         laranja:         delta_a > +8 AND delta_b > +8
         amarelo_ambar:   delta_b > +12 AND |delta_a| < 8 AND not laranja branch
         marrom_difuso:   delta_L < -10 AND delta_a > +5 AND delta_b > +5
       (other deltas may exist but only these 3 are clinically actionable in v1).
    6. Intensity from |delta_b| (or |delta_a + delta_b| for laranja):
         < 16  -> leve
         16-24 -> moderado
         > 24  -> denso

The `collarette_diameter_ratio` arg is currently UNUSED but accepted for forward
compat — Wave C P2.1 will narrow rows to "between collarette and limbus" using it.
The `iris_circle` arg is also accepted but not used at polar resolution (the polar
unwrap already mapped iris geometry; pixels are addressable directly via column index).
"""
from __future__ import annotations

from typing import Optional

import cv2
import numpy as np

SECTOR_COUNT = 12
DELTA_B_LEVE_MIN = 12
DELTA_B_MODERADO_MIN = 16
DELTA_B_DENSO_MIN = 24

CILIARY_RING_TOP_FRAC = 0.25  # rows 25%..75% of H
CILIARY_RING_BOTTOM_FRAC = 0.75


def _classify_intensity(delta_b_abs: float) -> str:
    if delta_b_abs >= DELTA_B_DENSO_MIN:
        return "denso"
    if delta_b_abs >= DELTA_B_MODERADO_MIN:
        return "moderado"
    return "leve"


def detect_sectoral_pigments(
    enhanced_polar: np.ndarray,
    iris_circle: Optional[tuple[float, float, float]] = None,
    collarette_diameter_ratio: float = 0.32,
) -> list[dict]:
    """Detect chromatic pigment markers per hour sector.

    Args:
        enhanced_polar: RGB uint8 polar image, shape (H, W, 3). W must be
            divisible by SECTOR_COUNT (default polar pipeline emits 64x504
            which gives 42 cols/sector; 64x512 also works with sector_w=42
            dropping the last 8 cols).
        iris_circle: Reserved for future (unused at polar resolution).
        collarette_diameter_ratio: Reserved for future row-narrowing.

    Returns:
        List of pigment dicts (may be empty):
            [{
                'hour': int (1..12),
                'type': 'amarelo_ambar'|'laranja'|'marrom_difuso',
                'intensity': 'leve'|'moderado'|'denso',
                'delta_lab': [dL, dA, dB]
            }, ...]
    """
    if enhanced_polar is None or enhanced_polar.size == 0:
        return []
    if enhanced_polar.ndim != 3 or enhanced_polar.shape[2] != 3:
        return []

    H, W = enhanced_polar.shape[:2]
    sector_w = W // SECTOR_COUNT
    if sector_w == 0:
        return []

    row_top = int(H * CILIARY_RING_TOP_FRAC)
    row_bottom = int(H * CILIARY_RING_BOTTOM_FRAC)
    if row_bottom <= row_top:
        return []

    lab = cv2.cvtColor(enhanced_polar, cv2.COLOR_RGB2LAB).astype(np.float32)
    ciliary = lab[row_top:row_bottom]

    sector_means: list[np.ndarray] = []
    for i in range(SECTOR_COUNT):
        col_start = i * sector_w
        col_end = (i + 1) * sector_w
        slab = ciliary[:, col_start:col_end].reshape(-1, 3)
        if slab.size == 0:
            sector_means.append(np.array([0, 128, 128], dtype=np.float32))
        else:
            sector_means.append(slab.mean(axis=0))

    base = np.median(np.stack(sector_means, axis=0), axis=0)

    results: list[dict] = []
    for i, sm in enumerate(sector_means):
        dL, dA, dB = (sm - base).tolist()
        hour = i + 1

        # laranja (a+ AND b+) — priority over amarelo_ambar
        if dA > 8 and dB > 8:
            intensity_metric = abs(dA) + abs(dB) - 8
            results.append({
                "hour": hour,
                "type": "laranja",
                "intensity": _classify_intensity(intensity_metric),
                "delta_lab": [round(dL, 2), round(dA, 2), round(dB, 2)],
            })
            continue
        # amarelo_ambar (b+ only, a neutral)
        if dB > DELTA_B_LEVE_MIN and abs(dA) < 8:
            results.append({
                "hour": hour,
                "type": "amarelo_ambar",
                "intensity": _classify_intensity(abs(dB)),
                "delta_lab": [round(dL, 2), round(dA, 2), round(dB, 2)],
            })
            continue
        # marrom_difuso (L-, a+, b+ — darker AND warmer)
        if dL < -10 and dA > 5 and dB > 5:
            results.append({
                "hour": hour,
                "type": "marrom_difuso",
                "intensity": _classify_intensity(abs(dL)),
                "delta_lab": [round(dL, 2), round(dA, 2), round(dB, 2)],
            })

    return results
