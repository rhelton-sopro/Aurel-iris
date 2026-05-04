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
    are committed yet (founder records them per D-X1)."""
    import cv2  # local import — heavy module, only needed when fixtures exist
    imgs: dict = {}
    for p in sorted(IRIS_DIR.glob("*.jpg")):
        bgr = cv2.imread(str(p))
        if bgr is None:
            continue
        imgs[p.stem] = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    return imgs


@pytest.fixture(scope="session")
def fixtures_dir() -> Path:
    """Filesystem path to tests/fixtures/. Useful for tests that need raw bytes."""
    return FIXTURES_DIR
