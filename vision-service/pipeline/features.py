"""Stage 6/6: Feature extraction.

Produces the per-eye block of the canonical features JSON (SPEC §4.3):
constitution, iris_color, fiber_density, collarette, pupil, sectors[],
rings, global_signs, image_quality.

Techniques (SPEC §4.4 / RESEARCH.md):
  - LAB k-means (Pattern 8) for iris_color — KMEANS_K=3.
  - OpenCV heuristics (dark threshold + connected components) for lacunas/criptas.
  - Sobel magnitude for fiber_density.
  - Jensen sector map per-eye for sectors[*].zones (D-J4).

Asymmetry (D-A1/D-A2):
  - compute_asymmetry(results) consumes plain dict eye blocks — NO attribute
    access on result blocks (B4 anti-regression). Uses dict subscripts / .get()
    exclusively.

References:
  - SPEC §4.3 — canonical per-eye payload shape
  - RESEARCH.md Pattern 8 — LAB k-means color classification
  - CONTEXT.md D-A1/D-A2 — asymmetry naming convention
  - CONTEXT.md D-F1 — soft degradation per eye
"""
from __future__ import annotations

import functools
from typing import Optional

import cv2
import numpy as np

from pipeline.sectoral_pigments import detect_sectoral_pigments

# ---------------------------------------------------------------------------
# Module constants (D-X3 calibration anchors — exposed for tuning)
# ---------------------------------------------------------------------------

KMEANS_K: int = 3
"""Number of clusters for LAB k-means color classification (RESEARCH Pattern 8)."""

LACUNA_DARK_THRESHOLD: int = 60
"""uint8 pixel value below which a region is a lacuna candidate."""

LACUNA_MIN_AREA: int = 30
"""Minimum connected-component area (pixels) to qualify as a lacuna."""

IRIS_DIAMETER_MM: float = 12.0
"""Anatomical human iris diameter (classic iridology reference scale).
iter-6a FIX 12: the px→mm conversion never existed — `_detect_findings_in_
sector` returned `size_mm = area_px / 100`, so a 1653-px blob reported
"16.53 mm" (larger than the whole 12 mm iris). Real conversion derives the
scale from the iris geometry instead."""

MAX_PLAUSIBLE_FINDING_MM: float = 4.0
"""iter-6a FIX 12 hard sanity gate. The largest physiologically plausible
discrete iridological structure (major lacuna / large pigment spot) is
~3 mm; >4 mm is almost always a mis-segmented whole region; >12 mm is
physically impossible. Policy: log + DROP (never pass to the LLM)."""

FIBER_DENSITY_BANDS: tuple[float, float, float] = (0.4, 0.65, 0.85)
"""Score boundaries for esparsa | media | media-densa | densa buckets."""

IRIS_COLOR_LABELS: tuple[str, ...] = ("azul", "castanho", "verde-mosaico", "misto")
"""Canonical primary iris color values."""

IRIS_COLOR_LAB_CENTROIDS: dict[str, tuple[int, int, int]] = {
    "azul": (220, 130, 110),
    "castanho": (90, 145, 160),
    # P0.4 (PLAN 07.1-02, 2026-05-11): recalibrated from Nailli fixture
    # (reading 71a7bf1d, real_iris_color='mista_biliar' — verde-acinzentado
    # base + amarelo-âmbar superior). Both eyes (n=2) produced
    # OD: LAB (149,140,144), OE: LAB (150,142,145); mean (150,141,145)
    # via apps/web/scripts/recalibrate-centroids.mjs. Intra-cluster variance
    # (1,1,1) — left/right symmetric. Previous hardcoded value (140,110,145)
    # had `a` channel pulled to 110 (more green than the real photographic
    # signal) which made distance to 'castanho' (a=145) artificially
    # smaller than distance to verde-mosaico for the Nailli iris,
    # contributing to the castanho/hematogenea misclassification cascade
    # diagnosed 2026-05-09. Sanity gate L in [50,200]: PASS (L=150).
    # Re-derive as calibration corpus grows past N=3 per category.
    "verde-mosaico": (150, 141, 145),
}
"""Heuristic LAB anchor centroids for color classification.
'misto' is the fallback when distances to all three are within 10% of each other.
"""


# ---------------------------------------------------------------------------
# classify_iris_color — RESEARCH Pattern 8
# ---------------------------------------------------------------------------

def classify_iris_color(
    masked_image: np.ndarray,
    iris_circle: Optional[tuple[float, float, float]] = None,
    pupil_circle: Optional[tuple[float, float, float]] = None,
) -> dict:
    """Classify iris primary/secondary color via LAB k-means.

    Args:
        masked_image: RGB uint8 array of the segmented iris region.
        iris_circle: Optional (cx, cy, r) tuple for central_heterochromia detection.
        pupil_circle: Optional (cx, cy, r) — exclude pupil disc (r*1.10 margin
            for anti-aliasing) from k-means BEFORE classification. P0.1 fix
            (PLAN 07.1-02): without this, pupil pixels arrive as ~RGB (3,3,3)
            after enhance.clahe (not pure zero, escaping the B1a R+G+B==0
            filter) and still pull cluster centers toward LAB-black, which
            lands on the 'castanho' centroid (L=90). Diagnosed 2026-05-09
            on Nailli reading 71a7bf1d (verde-acinzentado classificada como
            castanho/hematogenea). Falls back gracefully when None or invalid.

    Returns:
        dict with keys: primary, secondary (Optional[str]), central_heterochromia (bool).
    """
    # Convert RGB -> LAB
    lab = cv2.cvtColor(masked_image, cv2.COLOR_RGB2LAB)

    # Filter out mask-zeroed pixels before clustering. `segment.iris_mask`
    # produces an image where everything outside the iris circle is pure
    # black (cv2.bitwise_and). In a typical 4K capture the iris occupies
    # ~2% of the frame, so without this filter the largest k-means cluster
    # is the mask-black pixels and primary classification collapses to
    # whichever centroid is closest to LAB (0,128,128) — historically
    # 'castanho'. Bug surfaced 2026-05-09 dogfooding (green iris classified
    # as castanho/hematogenea). Real iris pixels never have R=G=B=0.
    rgb_pixels = masked_image.reshape(-1, 3)
    iris_pixels_mask = rgb_pixels.sum(axis=1) > 0

    # P0.1 (PLAN 07.1-02): also exclude pupil disc if hint provided. The
    # B1a filter alone is insufficient — pupil pixels post-CLAHE arrive
    # as quase-preto (RGB ~3,3,3) and still pull k-means toward castanho.
    # Margin 1.10 handles anti-aliasing at the pupil/iris boundary.
    if pupil_circle is not None:
        try:
            cx_p, cy_p, r_p = (float(v) for v in pupil_circle)
        except (TypeError, ValueError):
            cx_p = cy_p = r_p = 0.0
        # Guard: r must be positive and finite, center must be finite.
        if (
            r_p > 0
            and np.isfinite(cx_p)
            and np.isfinite(cy_p)
            and np.isfinite(r_p)
        ):
            r_excl = r_p * 1.10
            H, W = masked_image.shape[:2]
            yy, xx = np.ogrid[:H, :W]
            pupil_disc = (xx - cx_p) ** 2 + (yy - cy_p) ** 2 <= r_excl ** 2
            # Flatten + AND with iris_pixels_mask (skip pupil pixels)
            iris_pixels_mask = iris_pixels_mask & (~pupil_disc.reshape(-1))

    pixels = lab.reshape(-1, 3).astype(np.float32)[iris_pixels_mask]

    # Edge case: input fully masked (no iris pixels). Return safe default.
    if pixels.shape[0] < KMEANS_K:
        return {"primary": "misto", "secondary": None, "central_heterochromia": False}

    # Run k-means
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
    _, labels, centers = cv2.kmeans(
        pixels,
        KMEANS_K,
        None,
        criteria,
        10,
        cv2.KMEANS_RANDOM_CENTERS,
    )

    # Find cluster sizes
    counts = np.bincount(labels.flatten())
    sorted_idx = np.argsort(-counts)  # descending by size

    primary_center = centers[sorted_idx[0]]
    secondary_center = centers[sorted_idx[1]] if KMEANS_K > 1 else None

    def _nearest_color(center: np.ndarray) -> str:
        dists = {
            name: float(np.linalg.norm(center - np.array(anchor, dtype=np.float32)))
            for name, anchor in IRIS_COLOR_LAB_CENTROIDS.items()
        }
        min_dist = min(dists.values())
        # If two closest centroids are within 10% of each other -> misto
        sorted_dists = sorted(dists.values())
        if len(sorted_dists) >= 2 and sorted_dists[1] <= sorted_dists[0] * 1.1:
            return "misto"
        return min(dists, key=lambda k: dists[k])

    primary = _nearest_color(primary_center)

    secondary: Optional[str] = None
    if secondary_center is not None:
        sec_color = _nearest_color(secondary_center)
        if sec_color != primary:
            secondary = sec_color

    # central_heterochromia: MVP returns False when no iris_circle provided
    central_heterochromia = False

    return {
        "primary": primary,
        "secondary": secondary,
        "central_heterochromia": central_heterochromia,
    }


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _polar_area_to_mm(area_px: float, polar_height: int) -> float:
    """iter-6a FIX 12 — convert a connected-component area (polar pixels) to an
    approximate physical diameter in mm.

    Model (documented V1 approximation): the polar-unwrapped image's H rows
    span the iris RADIUS, so 1 polar row ≈ iris_radius_px / H cartesian px.
    A blob's equivalent diameter is 2·√(area/π) polar px. Mapping through the
    radial scale and the iris≈12 mm reference, the iris_radius_px term
    cancels analytically, leaving a stable estimate that depends only on the
    polar radial resolution:

        size_mm ≈ 2·√(area/π) · (IRIS_DIAMETER_MM / 2) / H

    The radial (not angular) scale is used deliberately — it is the
    conservative axis; the angular scale is what produced the absurd 13–16 mm
    values in the Nailli reading.
    """
    if polar_height <= 0:
        return float("inf")
    equiv_diam_polar_px = 2.0 * float(np.sqrt(area_px / np.pi))
    return equiv_diam_polar_px * (IRIS_DIAMETER_MM / 2.0) / float(polar_height)


def _detect_findings_in_sector(
    enhanced_polar: np.ndarray,
    sector_idx: int,
    *,
    iris_radius_px: Optional[float] = None,
    warnings: Optional[list[str]] = None,
) -> list[dict]:
    """Detect lacunas in a single sector of the polar-unwrapped iris image.

    iter-6a FIX 12: real px→mm conversion + hard sanity gate. A finding whose
    estimated diameter exceeds MAX_PLAUSIBLE_FINDING_MM (4 mm) is logged and
    DROPPED — it is a mis-segmented region, not a discrete structure, and
    must never reach the LLM. When the upstream iris circle is missing/invalid
    the segmentation itself is untrustworthy, so findings are dropped rather
    than emitted with a fabricated size (returning a silent default is the
    worst possible behavior — it gaslights every downstream consumer).

    Args:
        enhanced_polar: RGB uint8 polar image (H x W x 3).
        sector_idx: 0-based sector index (0..11).
        iris_radius_px: segmented iris radius (px). Validity signal — when
            falsy/non-finite the sector's findings are dropped.
        warnings: optional orchestrator sink; one summary token is appended
            per sector when findings are dropped.

    Returns:
        List of finding dicts (may be empty).
    """
    H, W = enhanced_polar.shape[:2]

    # Drop-when-no-scale: an absent/invalid iris circle means segmentation
    # failed; emitting findings with a guessed size is worse than emitting none.
    if not (
        iris_radius_px is not None
        and np.isfinite(iris_radius_px)
        and iris_radius_px > 0
    ):
        col_start = sector_idx * (W // 12)
        col_end = (sector_idx + 1) * (W // 12)
        sector_slice = enhanced_polar[:, col_start:col_end]
        gray = cv2.cvtColor(sector_slice, cv2.COLOR_RGB2GRAY)
        mask = (gray < LACUNA_DARK_THRESHOLD).astype(np.uint8)
        num, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
        candidate = sum(
            1 for i in range(1, num) if int(stats[i, cv2.CC_STAT_AREA]) >= LACUNA_MIN_AREA
        )
        if candidate > 0:
            print(
                f"[features] sector {sector_idx + 1}: dropped {candidate} finding(s) "
                f"— no valid iris scale (iris_radius_px={iris_radius_px})"
            )
            if warnings is not None:
                warnings.append(f"findings_dropped_no_iris_scale_sector_{sector_idx + 1}")
        return []

    col_start = sector_idx * (W // 12)
    col_end = (sector_idx + 1) * (W // 12)
    sector_slice = enhanced_polar[:, col_start:col_end]

    gray = cv2.cvtColor(sector_slice, cv2.COLOR_RGB2GRAY)
    mask = (gray < LACUNA_DARK_THRESHOLD).astype(np.uint8)

    num, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)

    findings: list[dict] = []
    dropped_oversize = 0
    for i in range(1, num):  # skip label 0 (background)
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < LACUNA_MIN_AREA:
            continue
        size_mm = _polar_area_to_mm(area, H)
        if size_mm > MAX_PLAUSIBLE_FINDING_MM:
            dropped_oversize += 1
            print(
                f"[features] sector {sector_idx + 1}: DROP finding "
                f"area={area}px size_mm={size_mm:.2f} > {MAX_PLAUSIBLE_FINDING_MM}mm "
                f"(mis-segmented region, not a discrete structure)"
            )
            continue
        findings.append({
            "type": "lacuna",
            "depth": "grau_1",
            "size_mm": round(size_mm, 3),
        })
    if dropped_oversize > 0 and warnings is not None:
        warnings.append(
            f"findings_dropped_oversize_{dropped_oversize}_sector_{sector_idx + 1}"
        )
    return findings


def _compute_fiber_density(enhanced_polar: np.ndarray) -> dict:
    """Estimate fiber density via Sobel gradient magnitude.

    Args:
        enhanced_polar: RGB uint8 polar image.

    Returns:
        dict with score (float [0,1]) and interpretation (str).
    """
    gray = cv2.cvtColor(enhanced_polar, cv2.COLOR_RGB2GRAY).astype(np.float32)
    grad_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0)
    grad_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1)
    mag = np.sqrt(grad_x ** 2 + grad_y ** 2)
    score = float(np.clip(mag.mean() / 50.0, 0.0, 1.0))

    if score < FIBER_DENSITY_BANDS[0]:
        interpretation = "esparsa"
    elif score < FIBER_DENSITY_BANDS[1]:
        interpretation = "media"
    elif score < FIBER_DENSITY_BANDS[2]:
        interpretation = "media-densa"
    else:
        interpretation = "densa"

    return {"score": score, "interpretation": interpretation}


def _classify_constitution(
    iris_color: dict,
    fiber_density: dict,
    sectoral_pigments: Optional[list[dict]] = None,
) -> dict:
    """6-way Jensen constitution heuristic (PLAN 07.1-02 P0.2).

    Heuristic priority (first match wins):
      1. azul + densa             -> neurogenica
      2. azul + (esparsa|media)   -> linfatica
      3. verde-mosaico|misto + amarelo-âmbar superior x≥2 -> mista_biliar (low/med fiber)
                                                            | biliar (densa)
      4. castanho + marrom_difuso x≥2 -> mista_hematogenea
      5. castanho                 -> hematogenea
      6. fallback                 -> mista

    Args:
        iris_color: output of classify_iris_color.
        fiber_density: output of _compute_fiber_density.
        sectoral_pigments: output of detect_sectoral_pigments (P0.3); None when
            called without sectoral_pigments support (backward compat).

    Returns:
        dict with primary (str), confidence (float), indicators (list[str]).
    """
    primary_color = iris_color.get("primary", "misto")
    interpretation = fiber_density.get("interpretation", "media")
    pigments = sectoral_pigments or []
    indicators: list[str] = []

    # Pigment signals (P0.3 input)
    superior_hours = {11, 12, 1, 2}
    amarelo_ambar_superior = [
        p for p in pigments
        if p.get("type") == "amarelo_ambar"
        and p.get("hour") in superior_hours
        and p.get("intensity") in ("moderado", "denso")
    ]
    marrom_difuso_present = [
        p for p in pigments
        if p.get("type") == "marrom_difuso" and p.get("intensity") in ("moderado", "denso")
    ]

    # Branch 1: neurogenica (azul + densa → fibras radiais finas marcadas)
    if primary_color == "azul" and interpretation == "densa":
        indicators.append("coloracao_azul_clara")
        indicators.append("fibras_radiais_finas_marcadas")
        return {"primary": "neurogenica", "confidence": 0.7, "indicators": indicators}

    # Branch 2: linfatica (azul + esparsa/media/media-densa)
    if primary_color == "azul":
        indicators.append("coloracao_azul_clara")
        return {
            "primary": "linfatica",
            "confidence": 0.8 if iris_color.get("secondary") is None else 0.7,
            "indicators": indicators,
        }

    # Branch 3: biliar / mista_biliar (verde-mosaico|misto + pigmento amarelo)
    if primary_color in ("verde-mosaico", "misto") and len(amarelo_ambar_superior) >= 2:
        indicators.append("coloracao_verde_amarelada")
        indicators.append("pigmento_amarelo_ambar_setorial")
        if interpretation == "densa":
            return {"primary": "biliar", "confidence": 0.7, "indicators": indicators}
        return {"primary": "mista_biliar", "confidence": 0.65, "indicators": indicators}

    # Branch 4: mista_hematogenea (castanho + pigmento marrom difuso x≥2)
    if primary_color == "castanho" and len(marrom_difuso_present) >= 2:
        indicators.append("coloracao_castanha")
        indicators.append("pigmento_marrom_difuso")
        return {"primary": "mista_hematogenea", "confidence": 0.65, "indicators": indicators}

    # Branch 5: hematogenea pura (castanho sem pigmento difuso)
    if primary_color == "castanho":
        indicators.append("coloracao_castanha")
        return {"primary": "hematogenea", "confidence": 0.8, "indicators": indicators}

    # Branch 6: fallback (verde-mosaico|misto sem pigmento ou outras combinações)
    indicators.append("coloracao_mista_ou_verde")
    return {"primary": "mista", "confidence": 0.6, "indicators": indicators}


def _build_collarette() -> dict:
    """Return MVP collarette defaults.

    Fixture-driven calibration (D-X3) will replace these defaults in a follow-up.
    The Pydantic schema accepts these values.
    """
    return {
        "shape": "regular",
        "diameter_ratio": 0.32,
        "decentralization": "centrada",
    }


def _build_pupil(composite: dict) -> dict:
    """Build pupil block from composite dict.

    Args:
        composite: dict with optional 'pupil_circle' and 'iris_circle' keys.

    Returns:
        dict with centralization, shape, size_ratio.
    """
    pupil_circle = composite.get("pupil_circle")
    iris_circle = composite.get("iris_circle")

    if pupil_circle is None or iris_circle is None:
        return {"centralization": "centrada", "shape": "circular", "size_ratio": 0.18}

    r_pupil = float(pupil_circle[2])
    r_iris = float(iris_circle[2])
    size_ratio = float(np.clip(r_pupil / r_iris if r_iris > 0 else 0.18, 0.0, 1.0))
    return {"centralization": "centrada", "shape": "circular", "size_ratio": size_ratio}


def _build_rings(enhanced_polar: np.ndarray) -> dict:
    """Return MVP rings defaults.

    Calibration TODO: detect nerve rings via radial gradient profile.
    """
    return {
        "nerve_rings": {"present": False, "count": None, "intensity": None},
        "lymphatic_rosary": {"present": False},
        "sodium_ring": {"present": False},
        "senile_arc": {"present": False},
    }


def _build_global_signs() -> dict:
    """Return MVP global signs defaults."""
    return {
        "radii_solaris": [],
        "transversal_signs": [],
        "tofus": [],
    }


def _build_image_quality(warnings: list[str], composite: dict) -> dict:
    """Build image_quality block.

    composite_score = 0.85 minus 0.1 per warning, clipped to [0, 1].
    """
    score = float(np.clip(0.85 - 0.1 * len(warnings), 0.0, 1.0))
    return {"composite_score": score, "warnings": list(warnings)}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_all(
    enhanced_image: np.ndarray,
    composite_image: dict,
    jensen_map: dict,
    eye: str,
    *,
    warnings: Optional[list[str]] = None,
) -> dict:
    """Extract full per-eye features block.

    Args:
        enhanced_image: RGB uint8 polar image from pipeline.enhance.clahe.
        composite_image: dict from pipeline.compose.photometric_combine with
            keys: segmented_image (np.ndarray), iris_circle (tuple|None),
            pupil_circle (tuple|None).
        jensen_map: loaded Jensen map dict (from iris_maps.load_jensen_map).
        eye: "right" or "left".
        warnings: accumulated pipeline warnings (D-PM1, D-F1).

    Returns:
        Plain Python dict matching SPEC §4.3 EyeFeatures shape.
        Validates via EyeFeatures.model_validate(result).

    Raises:
        ValueError: if eye not in {"right", "left"} or jensen_map missing eye key.
    """
    if eye not in ("right", "left"):
        raise ValueError("features_invalid_eye")
    if eye not in jensen_map:
        raise ValueError("features_jensen_map_missing_eye")

    warnings = warnings if warnings is not None else []

    iris_color = classify_iris_color(
        composite_image["segmented_image"],
        iris_circle=composite_image.get("iris_circle"),
        pupil_circle=composite_image.get("pupil_circle"),
    )
    fiber_density = _compute_fiber_density(enhanced_image)
    collarette = _build_collarette()
    pupil = _build_pupil(composite_image)

    # P0.3 (PLAN 07.1-02): chromatic per-sector pigment detection BEFORE
    # constitution classification (constitution heuristic consumes pigments).
    sectoral_pigments = detect_sectoral_pigments(
        enhanced_image,
        iris_circle=composite_image.get("iris_circle"),
        collarette_diameter_ratio=collarette.get("diameter_ratio", 0.32),
    )

    # P0.2 (PLAN 07.1-02): constitution heuristic accepts sectoral_pigments
    # to trigger biliar / mista_biliar / mista_hematogenea branches.
    constitution = _classify_constitution(
        iris_color, fiber_density, sectoral_pigments=sectoral_pigments
    )

    # iter-6a FIX 12: thread the segmented iris radius so findings get a real
    # mm scale + the >4 mm sanity drop. iris_circle is (cx, cy, r) or None.
    _iris_circle = composite_image.get("iris_circle")
    _iris_radius_px: Optional[float] = None
    if _iris_circle is not None:
        try:
            _iris_radius_px = float(_iris_circle[2])
        except (TypeError, ValueError, IndexError):
            _iris_radius_px = None

    sectors = []
    for hour in range(1, 13):
        zones = list(jensen_map[eye][str(hour)])
        findings = _detect_findings_in_sector(
            enhanced_image,
            hour - 1,
            iris_radius_px=_iris_radius_px,
            warnings=warnings,
        )
        sectors.append({
            "hour": hour,
            "zones": zones,
            "findings": findings,
        })

    rings = _build_rings(enhanced_image)
    global_signs = _build_global_signs()
    image_quality = _build_image_quality(warnings, composite_image)

    return {
        "constitution": constitution,
        "iris_color": iris_color,
        "fiber_density": fiber_density,
        "collarette": collarette,
        "pupil": pupil,
        "sectors": sectors,
        "sectoral_pigments": sectoral_pigments,
        "rings": rings,
        "global_signs": global_signs,
        "image_quality": image_quality,
    }


def compute_asymmetry(results: dict) -> list[str]:
    """Compute asymmetry notes between right and left eye feature blocks.

    Args:
        results: dict with keys "right_eye" and "left_eye", each being either
            None or a plain Python dict (the output of extract_all).
            IMPORTANT: Uses dict subscripts and .get() only — NEVER attribute
            access (B4 anti-regression).

    Returns:
        list[str] of asymmetry notes in pt-BR snake_case (D-A1).
        Empty list when no asymmetries detected (D-A2).
    """
    right = results.get("right_eye")
    left = results.get("left_eye")

    # Unilateral cases
    if right is None and left is not None:
        return ["unilateral_analysis_only_left_eye"]
    if left is None and right is not None:
        return ["unilateral_analysis_only_right_eye"]
    if right is None and left is None:
        return []

    notes: list[str] = []

    # Iris color asymmetry
    right_primary = right.get("iris_color", {}).get("primary")
    left_primary = left.get("iris_color", {}).get("primary")
    if (
        right_primary is not None
        and left_primary is not None
        and right_primary != left_primary
        and right_primary != "misto"
        and left_primary != "misto"
    ):
        notes.append(f"cor_assimetrica_{right_primary}_direito_{left_primary}_esquerdo")

    # Sector lacuna asymmetry
    right_sectors = right["sectors"]
    left_sectors = left["sectors"]
    for h in range(1, 13):
        right_findings = right_sectors[h - 1]["findings"]
        left_findings = left_sectors[h - 1]["findings"]
        right_has_lacuna = any(f["type"] == "lacuna" for f in right_findings)
        left_has_lacuna = any(f["type"] == "lacuna" for f in left_findings)
        if right_has_lacuna and not left_findings:
            notes.append(f"lacuna_unilateral_setor_{h}_direito")
        elif left_has_lacuna and not right_findings:
            notes.append(f"lacuna_unilateral_setor_{h}_esquerdo")

    # Fiber density asymmetry
    right_score = right.get("fiber_density", {}).get("score")
    left_score = left.get("fiber_density", {}).get("score")
    if (
        right_score is not None
        and left_score is not None
        and abs(right_score - left_score) > 0.2
    ):
        notes.append("densidade_fibras_assimetrica")

    return notes
