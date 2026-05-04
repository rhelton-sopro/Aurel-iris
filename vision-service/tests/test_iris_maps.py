"""Tests for the Jensen map loader and the JSON content shape."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.iris_maps import load_jensen_map
from scripts.audit_vocabulary import audit


def test_load_jensen_map_returns_dict():
    m = load_jensen_map()
    assert isinstance(m, dict)
    assert m["map_name"] == "jensen"
    assert "right" in m and "left" in m


def test_load_jensen_map_is_cached():
    a = load_jensen_map()
    b = load_jensen_map()
    assert a is b  # lru_cache returns same object


def test_all_12_sectors_present_for_both_eyes():
    m = load_jensen_map()
    expected_hours = {str(h) for h in range(1, 13)}
    assert set(m["right"].keys()) == expected_hours
    assert set(m["left"].keys()) == expected_hours


def test_each_sector_has_non_empty_zones():
    m = load_jensen_map()
    for eye in ("right", "left"):
        for hour, zones in m[eye].items():
            assert isinstance(zones, list), f"{eye}/{hour} not a list"
            assert len(zones) >= 1, f"{eye}/{hour} empty"
            for z in zones:
                assert isinstance(z, str), f"{eye}/{hour}: non-string zone {z!r}"
                assert z.strip() == z, f"{eye}/{hour}: zone has surrounding whitespace"


def test_known_jensen_asymmetries():
    """Anchor cases from CONTEXT specifics.

    Right-only: apêndice (sector 6); fígado/vesícula (sector 7).
    Left-only: coração (sector 9).
    """
    m = load_jensen_map()
    # Sector 6 right contains apêndice; left does not
    right_6 = " ".join(m["right"]["6"]).lower()
    left_6 = " ".join(m["left"]["6"]).lower()
    assert "apêndice" in right_6
    assert "apêndice" not in left_6
    # Sector 7 right has fígado; left has baço
    assert "fígado" in " ".join(m["right"]["7"]).lower()
    assert "baço" in " ".join(m["left"]["7"]).lower()
    # Sector 9 left has coração; right does not
    assert "coração" in " ".join(m["left"]["9"]).lower()
    assert "coração" not in " ".join(m["right"]["9"]).lower()


def test_jensen_map_passes_lgpd_audit():
    """No forbidden vocabulary anywhere in the JSON (D-J2)."""
    hits = audit()
    jensen_hits = [h for h in hits if "jensen-map.json" in h]
    assert jensen_hits == [], f"forbidden vocabulary in jensen-map.json: {jensen_hits}"
