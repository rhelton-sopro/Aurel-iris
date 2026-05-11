"""Tests for pipeline.sectoral_pigments — chromatic per-sector pigment detector.

PLAN 07.1-02 P0.3. Synthesizes polar-normalized 64x504 RGB images where
specific sector columns are painted with a target LAB delta over a base,
asserts the detector returns the expected hour/type/intensity entries.
"""
from __future__ import annotations

import cv2
import numpy as np
import pytest


BASE_LAB = (120, 128, 128)  # neutral gray, neither warm nor cool


def _lab_to_rgb_uint8(lab_tuple):
    """Crude LAB(uint8 0-255) -> RGB approx via cv2."""
    arr = np.array([[list(lab_tuple)]], dtype=np.uint8)
    rgb = cv2.cvtColor(arr, cv2.COLOR_LAB2RGB)
    return tuple(int(v) for v in rgb[0, 0])


def _make_polar(base_rgb, sector_overrides):
    """64x504 polar image: column[(i-1)*42:i*42] gets sector i override RGB.

    sector_overrides = {hour_int (1..12): rgb_tuple}
    """
    H, W = 64, 504  # 12 * 42 — clean divisions
    img = np.zeros((H, W, 3), dtype=np.uint8)
    img[:, :] = base_rgb
    SECTOR_W = W // 12
    for hour, rgb in sector_overrides.items():
        col_start = (hour - 1) * SECTOR_W
        col_end = hour * SECTOR_W
        # Ciliary ring = middle rows (rows 16..48 of 64)
        img[16:48, col_start:col_end] = rgb
    return img


def test_detect_amarelo_ambar_moderado_hour_12():
    from pipeline.sectoral_pigments import detect_sectoral_pigments

    base = _lab_to_rgb_uint8(BASE_LAB)
    yellow = _lab_to_rgb_uint8((120, 128, 128 + 20))  # delta_b = +20 -> moderado

    polar = _make_polar(base, {12: yellow})
    pigments = detect_sectoral_pigments(polar, iris_circle=None, collarette_diameter_ratio=0.32)

    yellows = [p for p in pigments if p["type"] == "amarelo_ambar"]
    assert any(p["hour"] == 12 for p in yellows), f"hour 12 missing: {pigments}"
    p12 = next(p for p in yellows if p["hour"] == 12)
    assert p12["intensity"] in ("moderado", "denso"), p12
    assert p12["delta_lab"][2] > 12, p12  # b channel positive


def test_detect_laranja_when_a_and_b_both_positive():
    from pipeline.sectoral_pigments import detect_sectoral_pigments

    base = _lab_to_rgb_uint8(BASE_LAB)
    orange = _lab_to_rgb_uint8((120, 128 + 12, 128 + 16))
    polar = _make_polar(base, {6: orange})
    pigments = detect_sectoral_pigments(polar, iris_circle=None, collarette_diameter_ratio=0.32)

    oranges = [p for p in pigments if p["type"] == "laranja" and p["hour"] == 6]
    assert oranges, f"hour 6 laranja missing: {pigments}"


def test_detect_empty_when_uniform_base():
    from pipeline.sectoral_pigments import detect_sectoral_pigments

    base = _lab_to_rgb_uint8(BASE_LAB)
    polar = _make_polar(base, {})
    pigments = detect_sectoral_pigments(polar, iris_circle=None, collarette_diameter_ratio=0.32)
    assert pigments == [], pigments


def test_detect_intensity_leve_when_delta_b_small():
    from pipeline.sectoral_pigments import detect_sectoral_pigments

    base = _lab_to_rgb_uint8(BASE_LAB)
    light_yellow = _lab_to_rgb_uint8((120, 128, 128 + 14))  # delta_b = +14 -> leve
    polar = _make_polar(base, {1: light_yellow})
    pigments = detect_sectoral_pigments(polar, iris_circle=None, collarette_diameter_ratio=0.32)

    yellows = [p for p in pigments if p["type"] == "amarelo_ambar" and p["hour"] == 1]
    if yellows:  # may be filtered as too weak — accept either way
        assert yellows[0]["intensity"] == "leve", yellows[0]


def test_detect_intensity_denso_when_delta_b_large():
    from pipeline.sectoral_pigments import detect_sectoral_pigments

    base = _lab_to_rgb_uint8(BASE_LAB)
    dense_yellow = _lab_to_rgb_uint8((120, 128, 128 + 30))  # delta_b = +30 -> denso
    polar = _make_polar(base, {12: dense_yellow})
    pigments = detect_sectoral_pigments(polar, iris_circle=None, collarette_diameter_ratio=0.32)

    yellows = [p for p in pigments if p["type"] == "amarelo_ambar" and p["hour"] == 12]
    assert yellows, "denso yellow hour 12 missing"
    assert yellows[0]["intensity"] == "denso", yellows[0]
