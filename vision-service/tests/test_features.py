"""Tests for pipeline.features — Stage 6 feature extraction.

Covers:
- extract_all round-trip against EyeFeatures Pydantic schema
- sectors shape (12 entries, ordered 1..12)
- sector zones from Jensen map
- error cases (invalid eye, missing eye in map)
- warnings propagation to image_quality
- classify_iris_color basic color classification
- compute_asymmetry cases (D-A1/D-A2)
- B4 anti-regression: compute_asymmetry must NOT use attribute access on
  plain dict eye blocks (raises AttributeError if it does)
"""
from __future__ import annotations

import numpy as np
import pytest

from pipeline.features import (
    KMEANS_K,
    classify_iris_color,
    compute_asymmetry,
    extract_all,
)
from pipeline.iris_maps import load_jensen_map
from pipeline.schemas import EyeFeatures


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------

def _make_synthetic_enhanced(h: int = 64, w: int = 512) -> np.ndarray:
    """Mid-gray RGB polar image with random noise."""
    rng = np.random.default_rng(42)
    base = np.full((h, w, 3), 128, dtype=np.uint8)
    noise = rng.integers(-20, 20, size=(h, w, 3), dtype=np.int16)
    return np.clip(base.astype(np.int16) + noise, 0, 255).astype(np.uint8)


def _make_synthetic_composite(
    segmented_value: int = 100,
    size: int = 256,
) -> dict:
    """Minimal composite dict matching features.extract_all expectations."""
    return {
        "segmented_image": np.full((size, size, 3), segmented_value, dtype=np.uint8),
        "iris_circle": (float(size // 2), float(size // 2), float(size // 3)),
        "pupil_circle": (float(size // 2), float(size // 2), float(size // 8)),
    }


def _make_eye_block(
    iris_color: str | dict = "azul",
    fiber_density: dict | None = None,
    findings_at_sector: tuple | None = None,
    jensen_map: dict | None = None,
) -> dict:
    """Construct a minimal valid EyeFeatures plain dict (NOT a Pydantic instance).

    This is what extract_all actually returns and what compute_asymmetry
    is contracted against (B4 anti-regression).
    """
    if fiber_density is None:
        fiber_density = {"score": 0.5, "interpretation": "media"}

    if isinstance(iris_color, str):
        iris_color_dict = {
            "primary": iris_color,
            "secondary": None,
            "central_heterochromia": False,
        }
    else:
        iris_color_dict = iris_color

    sectors = []
    for h in range(1, 13):
        if jensen_map is not None:
            zones = list(jensen_map["right"][str(h)])
        else:
            zones = ["zona_x"]
        findings: list[dict] = []
        if findings_at_sector is not None:
            sector_h, sector_findings = findings_at_sector
            if sector_h == h:
                findings = list(sector_findings)
        sectors.append({"hour": h, "zones": zones, "findings": findings})

    return {
        "constitution": {
            "primary": "linfatica",
            "confidence": 0.7,
            "indicators": ["coloracao_azul_clara"],
        },
        "iris_color": iris_color_dict,
        "fiber_density": fiber_density,
        "collarette": {
            "shape": "regular",
            "diameter_ratio": 0.32,
            "decentralization": "centrada",
        },
        "pupil": {
            "centralization": "centrada",
            "shape": "circular",
            "size_ratio": 0.18,
        },
        "sectors": sectors,
        "rings": {
            "nerve_rings": {"present": False, "count": None, "intensity": None},
            "lymphatic_rosary": {"present": False},
            "sodium_ring": {"present": False},
            "senile_arc": {"present": False},
        },
        "global_signs": {"radii_solaris": [], "transversal_signs": [], "tofus": []},
        "image_quality": {"composite_score": 0.85, "warnings": []},
    }


# ---------------------------------------------------------------------------
# Task 3 tests
# ---------------------------------------------------------------------------

def test_extract_all_round_trips_through_pydantic():
    """extract_all output must validate against EyeFeatures Pydantic schema."""
    enhanced = _make_synthetic_enhanced()
    composite = _make_synthetic_composite()
    jensen_map = load_jensen_map()
    result = extract_all(enhanced, composite, jensen_map, "right")
    validated = EyeFeatures.model_validate(result)
    # model_validate raises ValidationError on failure — reaching here means success
    assert validated.constitution.primary in ("linfatica", "hematogenea", "mista")


def test_extract_all_produces_12_sectors_in_order():
    """Sectors list must have exactly 12 entries in hour order 1..12."""
    enhanced = _make_synthetic_enhanced()
    composite = _make_synthetic_composite()
    jensen_map = load_jensen_map()
    result = extract_all(enhanced, composite, jensen_map, "right")
    assert len(result["sectors"]) == 12
    assert [s["hour"] for s in result["sectors"]] == list(range(1, 13))


def test_sector_zones_from_jensen_map():
    """Each sector's zones must match the Jensen map entry for the given eye."""
    enhanced = _make_synthetic_enhanced()
    composite = _make_synthetic_composite()
    jensen_map = load_jensen_map()
    result = extract_all(enhanced, composite, jensen_map, "right")
    for h in range(1, 13):
        expected_zones = jensen_map["right"][str(h)]
        assert result["sectors"][h - 1]["zones"] == expected_zones, (
            f"sector {h} zones mismatch"
        )


def test_invalid_eye_raises():
    """extract_all with eye not in {'right','left'} must raise ValueError."""
    enhanced = _make_synthetic_enhanced()
    composite = _make_synthetic_composite()
    jensen_map = load_jensen_map()
    with pytest.raises(ValueError, match="features_invalid_eye"):
        extract_all(enhanced, composite, jensen_map, "middle")


def test_jensen_map_missing_eye_raises():
    """extract_all with jensen_map missing the requested eye raises ValueError."""
    enhanced = _make_synthetic_enhanced()
    composite = _make_synthetic_composite()
    minimal_map = {"right": {str(h): ["zona"] for h in range(1, 13)}, "map_name": "x"}
    with pytest.raises(ValueError, match="features_jensen_map_missing_eye"):
        extract_all(enhanced, composite, minimal_map, "left")


def test_warnings_propagate_to_image_quality():
    """Warnings list must appear in image_quality and reduce composite_score."""
    enhanced = _make_synthetic_enhanced()
    composite = _make_synthetic_composite()
    jensen_map = load_jensen_map()
    result = extract_all(enhanced, composite, jensen_map, "right", warnings=["test_warning"])
    assert result["image_quality"]["warnings"] == ["test_warning"]
    assert result["image_quality"]["composite_score"] < 0.85


def test_classify_iris_color_returns_known_primary():
    """A uniform blue-ish image should resolve to azul, misto, or verde-mosaico."""
    # Build a uniform blue RGB image
    blue_img = np.full((200, 200, 3), 0, dtype=np.uint8)
    blue_img[:, :, 0] = 60   # R
    blue_img[:, :, 1] = 100  # G
    blue_img[:, :, 2] = 180  # B
    result = classify_iris_color(blue_img)
    assert result["primary"] in ("azul", "misto", "verde-mosaico"), (
        f"Unexpected primary color: {result['primary']!r}"
    )


def test_compute_asymmetry_unilateral_left():
    """Right None + left present -> unilateral_analysis_only_left_eye."""
    results = {"right_eye": None, "left_eye": _make_eye_block()}
    notes = compute_asymmetry(results)
    assert "unilateral_analysis_only_left_eye" in notes


def test_compute_asymmetry_unilateral_right():
    """Left None + right present -> unilateral_analysis_only_right_eye."""
    results = {"right_eye": _make_eye_block(), "left_eye": None}
    notes = compute_asymmetry(results)
    assert "unilateral_analysis_only_right_eye" in notes


def test_compute_asymmetry_both_present_symmetric_returns_empty():
    """Both eyes with identical features -> no asymmetry notes."""
    block = _make_eye_block(iris_color="azul", fiber_density={"score": 0.5, "interpretation": "media"})
    results = {"right_eye": block, "left_eye": _make_eye_block(iris_color="azul", fiber_density={"score": 0.5, "interpretation": "media"})}
    notes = compute_asymmetry(results)
    assert notes == []


def test_compute_asymmetry_density_drift():
    """Fiber density difference > 0.2 between eyes -> densidade_fibras_assimetrica."""
    right_block = _make_eye_block(fiber_density={"score": 0.3, "interpretation": "esparsa"})
    left_block = _make_eye_block(fiber_density={"score": 0.7, "interpretation": "media-densa"})
    results = {"right_eye": right_block, "left_eye": left_block}
    notes = compute_asymmetry(results)
    assert "densidade_fibras_assimetrica" in notes


def test_compute_asymmetry_lacuna_unilateral_right():
    """Lacuna in right sector 7 only -> lacuna_unilateral_setor_7_direito."""
    lacuna_finding = [{"type": "lacuna", "depth": "grau_1", "size_mm": 0.5}]
    right_block = _make_eye_block(findings_at_sector=(7, lacuna_finding))
    left_block = _make_eye_block()
    results = {"right_eye": right_block, "left_eye": left_block}
    notes = compute_asymmetry(results)
    assert "lacuna_unilateral_setor_7_direito" in notes


def test_compute_asymmetry_both_none_empty():
    """Both eyes None -> empty list (orchestrator handles failed status upstream)."""
    assert compute_asymmetry({"right_eye": None, "left_eye": None}) == []


def test_compute_asymmetry_uses_dict_subscripts_not_attributes():
    """B4 anti-regression: compute_asymmetry must NOT raise AttributeError.

    Plain dict eye blocks (the only thing extract_all returns) must work.
    If a future refactor introduces right.iris_color.primary instead of
    right["iris_color"]["primary"], this test will catch it immediately.
    """
    right_block = _make_eye_block(iris_color="castanho")
    left_block = _make_eye_block(iris_color="azul")
    results = {"right_eye": right_block, "left_eye": left_block}
    try:
        notes = compute_asymmetry(results)
        # Should detect color asymmetry
        color_note = any("cor_assimetrica" in n for n in notes)
        assert isinstance(notes, list)
    except AttributeError as e:
        pytest.fail(
            f"compute_asymmetry raised AttributeError — uses attribute access instead "
            f"of dict subscripts (B4 anti-regression): {e}"
        )


# ---------------------------------------------------------------------------
# PLAN 07.1-02 P0.1 — pupil mask in classify_iris_color
# ---------------------------------------------------------------------------

def test_classify_iris_color_excludes_pupil_pixels():
    """Synthetic image: 200x200 RGB with central black pupil disc (r=30)
    + iris annulus painted verde-mosaico (L=140, a=110, b=145 in LAB).
    Without pupil mask: k-means picks black cluster as primary -> castanho.
    With pupil mask: clean verde-mosaico -> primary='verde-mosaico' or 'misto'.
    """
    H, W = 200, 200
    cx, cy = W // 2, H // 2
    r_iris = 80
    r_pupil = 30

    # Verde-mosaico LAB -> RGB approx (L=140 a=110 b=145 -> ~RGB (102, 130, 80))
    img = np.zeros((H, W, 3), dtype=np.uint8)
    yy, xx = np.ogrid[:H, :W]
    iris_mask = (xx - cx) ** 2 + (yy - cy) ** 2 <= r_iris ** 2
    pupil_mask = (xx - cx) ** 2 + (yy - cy) ** 2 <= r_pupil ** 2

    img[iris_mask] = [102, 130, 80]    # verde-mosaico fill
    img[pupil_mask] = [0, 0, 0]        # pupila preta puro

    # Pupil-edge dark ring: pixels near pupil border that are quase-preto but
    # NOT exactly zero (simula real pós-CLAHE onde pupila chega como cinza
    # muito escuro, escapando do B1a filter R+G+B==0).
    pupil_dark_ring = ((xx - cx) ** 2 + (yy - cy) ** 2 > r_pupil ** 2) & \
                      ((xx - cx) ** 2 + (yy - cy) ** 2 <= (r_pupil + 5) ** 2)
    img[pupil_dark_ring] = [3, 3, 3]

    # With pupil hint: deve acertar
    result_with_hint = classify_iris_color(
        img,
        iris_circle=(float(cx), float(cy), float(r_iris)),
        pupil_circle=(float(cx), float(cy), float(r_pupil)),
    )
    assert result_with_hint["primary"] in {"verde-mosaico", "misto"}, (
        f"With pupil hint, primary should be verde-mosaico or misto, got "
        f"{result_with_hint['primary']}"
    )


def test_classify_iris_color_pupil_hint_optional_no_crash():
    """Backward compat: pupil_circle=None must not crash (fallback to B1a only)."""
    img = np.zeros((50, 50, 3), dtype=np.uint8)
    img[10:40, 10:40] = [102, 130, 80]
    # No pupil_circle, no iris_circle — should not raise
    result = classify_iris_color(img)
    assert result["primary"] in {"azul", "castanho", "verde-mosaico", "misto"}
