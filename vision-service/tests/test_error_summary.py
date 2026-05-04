"""
Tests for the D-E1 error_summary catalog loader (pipeline/error_summary.py).

Asserts:
  - Catalog round-trips from JSON and exports the correct 5 keys.
  - ERROR_SUMMARY module-level dict is populated on import.
  - load_error_summary() is idempotent via lru_cache (same object identity).
  - All 5 D-E1 strings are non-empty, pt-BR (spot-check accented chars).
  - Catalog passes the LGPD vocabulary audit (no diagnóstico/tratamento/cura).
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.error_summary import ERROR_SUMMARY, load_error_summary

_EXPECTED_KEYS = {
    "low_light",
    "eyes_not_detected",
    "timeout",
    "transient",
    "invalid_format",
}

_CATALOG_PATH = (
    Path(__file__).parent.parent / "data" / "error_summary.json"
)


class TestErrorSummaryCatalogLoader:
    def test_error_summary_catalog_loads(self):
        """Happy path: load_error_summary() returns a dict with the 5 D-E1 keys."""
        catalog = load_error_summary()
        assert isinstance(catalog, dict)
        assert set(catalog.keys()) == _EXPECTED_KEYS

    def test_error_summary_all_values_are_non_empty_strings(self):
        """All 5 strings must be non-empty (D-E1 contract)."""
        catalog = load_error_summary()
        for key, value in catalog.items():
            assert isinstance(value, str), f"{key}: expected str, got {type(value)}"
            assert value, f"{key}: string must not be empty"

    def test_error_summary_module_export_matches_loader(self):
        """Module-level ERROR_SUMMARY must equal the lru_cached loader result."""
        assert ERROR_SUMMARY == load_error_summary()

    def test_error_summary_lru_cache_returns_same_object(self):
        """lru_cache means repeated calls return the SAME dict object (Pitfall 6)."""
        first = load_error_summary()
        second = load_error_summary()
        assert first is second, "load_error_summary() should be lru_cached"

    def test_error_summary_count_is_exactly_five(self):
        """Exactly 5 keys — no more, no less (D-E1 locked set)."""
        assert len(ERROR_SUMMARY) == 5

    def test_error_summary_low_light_has_em_dash(self):
        """'low_light' must use U+2014 em-dash, not a plain hyphen."""
        value = ERROR_SUMMARY["low_light"]
        assert "—" in value, (
            f"low_light must contain em-dash (U+2014), got: {value!r}"
        )

    def test_error_summary_timeout_has_em_dash(self):
        """'timeout' must use U+2014 em-dash."""
        value = ERROR_SUMMARY["timeout"]
        assert "—" in value, (
            f"timeout must contain em-dash (U+2014), got: {value!r}"
        )

    def test_error_summary_transient_has_em_dash(self):
        """'transient' must use U+2014 em-dash."""
        value = ERROR_SUMMARY["transient"]
        assert "—" in value, (
            f"transient must contain em-dash (U+2014), got: {value!r}"
        )

    def test_error_summary_json_file_exists(self):
        """data/error_summary.json must exist on disk."""
        assert _CATALOG_PATH.exists(), f"Missing catalog file: {_CATALOG_PATH}"

    def test_error_summary_json_has_correct_shape(self):
        """JSON must have catalog_name, version, strings fields."""
        raw = json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))
        assert "catalog_name" in raw, "Missing 'catalog_name' field"
        assert "version" in raw, "Missing 'version' field"
        assert "strings" in raw, "Missing 'strings' field"
        assert raw["catalog_name"] == "aurel_iris_error_summary"
        assert len(raw["strings"]) == 5

    def test_error_summary_catalog_strings_pass_lgpd_audit(self):
        """All 5 D-E1 strings must pass the LGPD vocabulary audit (no forbidden tokens)."""
        import re
        # Mirrors the FORBIDDEN pattern from scripts/audit_vocabulary.py
        forbidden = re.compile(
            r"\bdiagn[óo]stico\b|\btratamento\b|\bcura\b",
            re.IGNORECASE | re.UNICODE,
        )
        for key, value in ERROR_SUMMARY.items():
            assert forbidden.search(value) is None, (
                f"D-E1 catalog entry '{key}' contains forbidden LGPD vocab: {value!r}"
            )

    def test_error_summary_exact_d_e1_strings(self):
        """Spot-check exact D-E1 locked strings (verbatim match including accents/em-dashes)."""
        assert ERROR_SUMMARY["low_light"] == "Imagens com pouca luz — tente recapturar"
        assert ERROR_SUMMARY["eyes_not_detected"] == "Olhos não detectados nas fotos"
        assert ERROR_SUMMARY["timeout"] == "Tempo limite excedido — tente novamente"
        assert ERROR_SUMMARY["transient"] == "Falha temporária no processamento — tente novamente"
        assert ERROR_SUMMARY["invalid_format"] == "Imagens em formato inválido"
