"""Smoke test — proves pytest + fixtures + project layout are wired before Wave 1."""
from pathlib import Path

from pipeline import compose, detect, enhance, features, normalize, segment


def test_pipeline_modules_importable():
    for mod in (detect, segment, compose, normalize, enhance, features):
        assert hasattr(mod, "__name__")


def test_expected_fixture_loads(expected):
    assert isinstance(expected, dict)


def test_iris_images_fixture_returns_dict(iris_images):
    assert isinstance(iris_images, dict)


def test_fixtures_dir_exists(fixtures_dir):
    assert isinstance(fixtures_dir, Path)
    assert fixtures_dir.is_dir()
    assert (fixtures_dir / "iris").is_dir()
