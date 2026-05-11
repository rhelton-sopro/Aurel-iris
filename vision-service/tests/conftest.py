"""Shared session-scoped fixtures for vision-service pytest suite (D-X3)."""
import json
from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).parent / "fixtures"
IRIS_DIR = FIXTURES_DIR / "iris"


@pytest.fixture(scope="session")
def expected() -> dict:
    """Founder-annotated ground-truth (D-X3). Returns {} until the founder
    populates expected.json with iris_bbox / constitution / findings."""
    path = FIXTURES_DIR / "expected.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="session")
def iris_images() -> dict:
    """All fixture JPEGs as {stem: np.ndarray RGB}. Empty when no fixtures
    are committed yet (founder records them per D-X1).

    cv2 is only imported when JPEG files are present — avoids ImportError
    on dev machines without opencv-python-headless installed (Rule 1 fix).
    """
    jpeg_paths = sorted(IRIS_DIR.glob("*.jpg"))
    if not jpeg_paths:
        return {}
    import cv2  # local import — heavy module, only needed when fixtures exist
    imgs: dict = {}
    for p in jpeg_paths:
        bgr = cv2.imread(str(p))
        if bgr is None:
            continue
        imgs[p.stem] = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    return imgs


@pytest.fixture(scope="session")
def fixtures_dir() -> Path:
    """Filesystem path to tests/fixtures/. Useful for tests that need raw bytes."""
    return FIXTURES_DIR


@pytest.fixture(scope="session")
def synthetic_close_up_eye():
    """Builder for synthetic close-up iris (no face context) — Phase 07.1.5 WARN-6.

    Single source of truth for synthetic close-up images. Consumed by
    test_color_iris_mask.py (helper tests) AND test_detect.py (color-masked
    Hough tests). Returns a builder callable so tests vary iris HSV / size
    without duplicating cv2.circle construction logic.

    Args of returned _build callable:
        iris_hsv: HSV tuple for iris fill colour (default brown: 20, 150, 100).
        bg_hsv:   HSV tuple for sclera background (default ~white: 0, 0, 240).
        size:     square image size (default 512).

    Returns:
        Callable returning H x W x 3 uint8 RGB array with a filled iris disk
        of radius size//4 centred on the image.
    """
    import cv2
    import numpy as np

    def _build(iris_hsv=(20, 150, 100), bg_hsv=(0, 0, 240), size=512):
        bg = cv2.cvtColor(
            np.array([[[*bg_hsv]]], dtype=np.uint8), cv2.COLOR_HSV2RGB
        )[0, 0]
        img = np.full((size, size, 3), bg, dtype=np.uint8)
        iris = cv2.cvtColor(
            np.array([[[*iris_hsv]]], dtype=np.uint8), cv2.COLOR_HSV2RGB
        )[0, 0]
        cv2.circle(
            img, (size // 2, size // 2), size // 4,
            tuple(int(v) for v in iris), thickness=-1,
        )
        return img

    return _build
