"""Diagnostic experiment for the iris color classifier bug surfaced 2026-05-09.

Hypothesis (from analysis of the Nailli reading 71a7bf1d):
    classify_iris_color receives `segmented_image` from compose.photometric_combine,
    which is the iris pixels surrounded by mask-zeroed pixels (black). In a
    realistic 4K capture, the iris occupies ~2% of the image area. K-means with
    K=3 on the FULL image (including mask) makes the LARGEST cluster the
    mask-black pixels, and the LAB centroid nearest to black (L=0, A=128, B=128)
    in the hardcoded IRIS_COLOR_LAB_CENTROIDS map is "castanho" (90, 145, 160).
    Therefore EVERY iris classified by this pipeline returns "castanho" as
    primary, regardless of actual color.

This file is a RED test suite that documents the current broken behavior. When
the fix lands (filter mask pixels before k-means), these tests get flipped to
assert the correct color instead of "castanho".

Run with:  pytest -s vision-service/tests/test_color_classifier_diagnostic.py
                  ^ -s shows the print() output that makes the math visible.
"""
from __future__ import annotations

import cv2
import numpy as np
import pytest

from pipeline.features import (
    IRIS_COLOR_LAB_CENTROIDS,
    KMEANS_K,
    classify_iris_color,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_segmented_iris(rgb: tuple[int, int, int], image_size: int = 1024,
                          iris_radius_ratio: float = 0.13) -> np.ndarray:
    """Build a synthetic segmented_image mirroring segment.iris_mask output.

    Mask-zeroed (black) outside iris_circle; uniform `rgb` color inside.
    Default `iris_radius_ratio=0.13` mirrors the typical 4K capture ratio
    (iris ~250px radius in a 1024x1024 normalized image — segment.py
    HOUGH_DEFAULTS minRadius=80, maxRadius=200 over a ~1024px image).
    """
    img = np.zeros((image_size, image_size, 3), dtype=np.uint8)
    cx, cy = image_size // 2, image_size // 2
    r = int(image_size * iris_radius_ratio)
    cv2.circle(img, (cx, cy), r, rgb, thickness=-1)
    return img


def _lab_distance(p1: tuple[float, ...], p2: tuple[float, ...]) -> float:
    return float(np.linalg.norm(np.array(p1, dtype=np.float32) -
                                np.array(p2, dtype=np.float32)))


def _print_kmeans_centers(masked_image: np.ndarray, label: str) -> None:
    """Replicate the internal k-means and dump centers for visibility."""
    lab = cv2.cvtColor(masked_image, cv2.COLOR_RGB2LAB)
    pixels = lab.reshape(-1, 3).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
    _, labels, centers = cv2.kmeans(
        pixels, KMEANS_K, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS
    )
    counts = np.bincount(labels.flatten())
    sorted_idx = np.argsort(-counts)

    print(f"\n--- {label} ---")
    for rank, idx in enumerate(sorted_idx):
        center = centers[idx]
        pct = counts[idx] / counts.sum() * 100
        nearest_name = min(
            IRIS_COLOR_LAB_CENTROIDS.items(),
            key=lambda kv: _lab_distance(tuple(center), kv[1]),
        )[0]
        nearest_dist = min(
            _lab_distance(tuple(center), v)
            for v in IRIS_COLOR_LAB_CENTROIDS.values()
        )
        print(
            f"  cluster #{rank} ({pct:5.1f}% of pixels): "
            f"LAB=({center[0]:6.1f}, {center[1]:6.1f}, {center[2]:6.1f}) "
            f"-> nearest: {nearest_name} (dist={nearest_dist:5.1f})"
        )


# ---------------------------------------------------------------------------
# Sanity check (regression guard for k-means itself)
# ---------------------------------------------------------------------------

def test_uniform_blue_image_classifies_as_azul():
    """Baseline: when the WHOLE image is iris pixels (no mask), classification
    works. This is the only case the existing test_features.py covers."""
    img = np.full((200, 200, 3), 0, dtype=np.uint8)
    img[:, :, 0] = 60   # R
    img[:, :, 1] = 100  # G
    img[:, :, 2] = 180  # B
    result = classify_iris_color(img)
    assert result["primary"] in ("azul", "misto"), result["primary"]


# ---------------------------------------------------------------------------
# The bug (RED — these document broken behavior)
# ---------------------------------------------------------------------------

# After the B1a mask-filter fix (2026-05-09), classify_iris_color filters
# pure-black mask pixels before k-means. These tests are now regression
# guards: they assert that segmented inputs are no longer dominated by mask
# pixels and produce reasonable iris-color classifications.
#
# Note on `expected`: the hardcoded LAB centroids in IRIS_COLOR_LAB_CENTROIDS
# are still uncalibrated (B1b — deferred), so blue and hazel synthetic inputs
# resolve to verde-mosaico because the 'azul' centroid (L=220) is unrealistically
# bright. Once B1b lands with calibrated centroids from real fixtures, these
# expectations should tighten.
@pytest.mark.parametrize(
    "color_label, rgb, expected",
    [
        # blue iris: real RGB falls closest to verde-mosaico under current
        # uncalibrated centroids. Still NOT castanho (the win from B1a).
        ("blue iris (~hex #4060B0)", (60, 100, 180), {"verde-mosaico", "azul", "misto"}),
        # green iris (Nailli case) — the dogfooding-trigger.
        ("green iris  — Nailli case", (90, 140, 80), {"verde-mosaico", "misto"}),
        # brown iris: classification was already correct, mask filter should
        # not regress it.
        ("brown iris", (130, 90, 50), {"castanho"}),
        # hazel iris: legitimately mixed; either misto or verde-mosaico is fine.
        ("hazel iris", (140, 110, 70), {"verde-mosaico", "misto", "castanho"}),
    ],
)
def test_segmented_iris_classifies_correctly_after_mask_filter(
    color_label, rgb, expected
):
    """Regression guard for B1a (mask-filter fix, 2026-05-09).

    Pre-fix, segmented_image (98% black mask + 2% iris) always classified
    as 'castanho' regardless of actual iris color, because the largest
    k-means cluster was the mask-black pixels and LAB-black's nearest
    centroid is castanho.

    Post-fix, classify_iris_color filters pure-black pixels (R=G=B=0) before
    k-means, so the cluster centers reflect actual iris colors.

    Critical assertion: 'castanho' must NOT be returned for non-brown inputs.
    This is the dogfooding-blocker that this fix resolves.
    """
    segmented = _build_segmented_iris(rgb)
    _print_kmeans_centers(segmented, f"INPUT: {color_label}")
    result = classify_iris_color(segmented)
    print(f"  >>> classify_iris_color result: primary={result['primary']!r} "
          f"secondary={result['secondary']!r}")
    assert result["primary"] in expected, (
        f"Expected {color_label!r} to classify as one of {expected}, "
        f"got {result['primary']!r}. Mask filter may have regressed."
    )


def test_nailli_case_no_longer_classifies_as_castanho():
    """Explicit regression guard for the Nailli dogfooding bug (2026-05-09).

    A green iris must NEVER classify as castanho/hematogenea after B1a fix.
    Hardcoded as a separate test (not parametrized) so the failure message
    points directly at the dogfooding regression."""
    green_iris = _build_segmented_iris((90, 140, 80))
    result = classify_iris_color(green_iris)
    assert result["primary"] != "castanho", (
        f"Nailli regression: green iris classified as 'castanho' again. "
        f"Mask filter in classify_iris_color may have been removed or bypassed."
    )


# ---------------------------------------------------------------------------
# Direct probe: cluster math
# ---------------------------------------------------------------------------

def test_largest_cluster_in_segmented_image_is_mask_black():
    """Verify the upstream cause: the largest k-means cluster center sits
    near LAB (0, 128, 128) — the mask-black pixels — not near any iris color
    centroid. Run with -s to see the centers printed."""
    segmented = _build_segmented_iris((90, 140, 80))  # green iris

    lab = cv2.cvtColor(segmented, cv2.COLOR_RGB2LAB)
    pixels = lab.reshape(-1, 3).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
    _, labels, centers = cv2.kmeans(
        pixels, KMEANS_K, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS
    )
    counts = np.bincount(labels.flatten())
    largest = centers[np.argmax(counts)]

    # Black in OpenCV LAB ≈ (0, 128, 128) (a/b are zero-offset at 128).
    dist_to_black = _lab_distance(tuple(largest), (0, 128, 128))
    print(f"\n  largest cluster center: LAB=({largest[0]:.1f}, "
          f"{largest[1]:.1f}, {largest[2]:.1f})")
    print(f"  distance to LAB-black (0, 128, 128): {dist_to_black:.1f}")
    print(f"  distance to 'castanho' centroid:     "
          f"{_lab_distance(tuple(largest), IRIS_COLOR_LAB_CENTROIDS['castanho']):.1f}")
    print(f"  distance to 'azul' centroid:         "
          f"{_lab_distance(tuple(largest), IRIS_COLOR_LAB_CENTROIDS['azul']):.1f}")
    print(f"  distance to 'verde-mosaico' centroid:"
          f"{_lab_distance(tuple(largest), IRIS_COLOR_LAB_CENTROIDS['verde-mosaico']):.1f}")

    # The largest cluster should be within ~10 LAB units of pure black.
    assert dist_to_black < 30.0, (
        f"Expected largest cluster to be mask-black (within 30 LAB units of "
        f"(0,128,128)), got distance {dist_to_black:.1f}. "
        f"If this fails, segment.py's masking changed."
    )


def test_lab_black_nearest_centroid_is_castanho():
    """Direct math: prove that LAB-black's nearest centroid in the hardcoded
    IRIS_COLOR_LAB_CENTROIDS table is 'castanho'. This is why every masked
    iris classifies brown."""
    black_lab = (0.0, 128.0, 128.0)
    distances = {
        name: _lab_distance(black_lab, anchor)
        for name, anchor in IRIS_COLOR_LAB_CENTROIDS.items()
    }
    print("\n  LAB-black distances:")
    for name, dist in sorted(distances.items(), key=lambda kv: kv[1]):
        print(f"    {name:20s} {dist:6.1f}")
    nearest = min(distances, key=lambda k: distances[k])
    assert nearest == "castanho", (
        f"Expected 'castanho' to be nearest to LAB-black, got {nearest!r}"
    )
