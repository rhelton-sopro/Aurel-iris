"""Unit tests for pipeline.masks.color_iris_mask (Phase 07.1.5 D-01).

Approach B (HSV color pre-segmentation before Hough) verification surface.
All tests consume the `synthetic_close_up_eye` conftest fixture (WARN-6).

Tests are RED until pipeline/masks.py is created in Task 2 — they import
the symbol lazily inside each test so collection works even when the module
does not yet exist.
"""
from __future__ import annotations

import cv2
import numpy as np
import pytest


def test_color_mask_returns_uint8_shape_matches_input(synthetic_close_up_eye):
    """Invariant: mask.dtype == np.uint8 AND mask.shape == img.shape[:2]."""
    from pipeline.masks import color_iris_mask
    img = synthetic_close_up_eye(size=256)
    mask = color_iris_mask(img)
    assert mask.dtype == np.uint8
    assert mask.shape == img.shape[:2]


def test_color_mask_brown_iris_yields_nonzero_pixels(synthetic_close_up_eye):
    """Brown iris HSV(20, 150, 100) on white sclera -> mask_ratio > 0.10."""
    from pipeline.masks import color_iris_mask
    img = synthetic_close_up_eye(iris_hsv=(20, 150, 100), bg_hsv=(0, 0, 240), size=512)
    mask = color_iris_mask(img)
    ratio = float(np.count_nonzero(mask)) / float(mask.size)
    assert ratio > 0.10, f"brown iris mask_ratio={ratio:.3f}, expected >0.10"


def test_color_mask_white_field_yields_near_zero():
    """Pure sclera (no iris) -> mask drops almost everything (<5%)."""
    from pipeline.masks import color_iris_mask
    img = np.full((256, 256, 3), 240, dtype=np.uint8)
    mask = color_iris_mask(img)
    ratio = float(np.count_nonzero(mask)) / float(mask.size)
    assert ratio < 0.05, f"white field mask_ratio={ratio:.3f}, expected <0.05"


def test_color_mask_black_field_yields_near_zero():
    """Very dark eyelash/pupil -> V threshold drops it (<1%)."""
    from pipeline.masks import color_iris_mask
    img = np.zeros((256, 256, 3), dtype=np.uint8)
    mask = color_iris_mask(img)
    ratio = float(np.count_nonzero(mask)) / float(mask.size)
    assert ratio < 0.01, f"black field mask_ratio={ratio:.3f}, expected <0.01"


def test_color_mask_morphology_fills_specular_hole(synthetic_close_up_eye):
    """Synthetic iris with a 6x6 white specular spot inside -> CLOSE fills the hole."""
    from pipeline.masks import color_iris_mask
    img = synthetic_close_up_eye(size=512)
    # Stamp a 6x6 white "specular reflection" inside the iris disk
    cx, cy = 256, 256
    img[cy - 3:cy + 3, cx - 3:cx + 3] = (250, 250, 250)
    mask = color_iris_mask(img)
    # Closing should fill the hole
    assert mask[cy, cx] == 255, \
        f"specular hole at ({cx},{cy}) not filled; mask value = {mask[cy, cx]}"


def test_color_mask_returns_only_zero_or_255_values(synthetic_close_up_eye):
    """Invariant: mask is binary (only 0 or 255)."""
    from pipeline.masks import color_iris_mask
    img = synthetic_close_up_eye()
    mask = color_iris_mask(img)
    uniq = set(np.unique(mask).tolist())
    assert uniq.issubset({0, 255}), f"non-binary mask values: {uniq}"
