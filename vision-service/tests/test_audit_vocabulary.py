"""Behavioural tests for the LGPD vocabulary audit (D-J2)."""
import json
from pathlib import Path

import pytest

from scripts.audit_vocabulary import audit


def test_clean_tree_returns_empty(tmp_path: Path):
    # Build a minimal tree mirroring vision-service/ scan dirs
    (tmp_path / "pipeline").mkdir()
    (tmp_path / "data").mkdir()
    (tmp_path / "pipeline" / "ok.py").write_text("# benign", encoding="utf-8")
    (tmp_path / "data" / "ok.json").write_text(
        json.dumps({"map_name": "jensen", "right": {"7": ["fígado"]}}),
        encoding="utf-8",
    )
    assert audit(tmp_path) == []


def test_detects_diagnostico(tmp_path: Path):
    (tmp_path / "pipeline").mkdir()
    bad = tmp_path / "pipeline" / "bad.py"
    bad.write_text("# isto é um diagnóstico clínico\n", encoding="utf-8")
    hits = audit(tmp_path)
    assert any("bad.py" in h and "diagnóstico" in h for h in hits)


def test_detects_tratamento(tmp_path: Path):
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / "x.json").write_text('{"k":"tratamento"}', encoding="utf-8")
    hits = audit(tmp_path)
    assert any("x.json" in h for h in hits)


def test_case_insensitive(tmp_path: Path):
    (tmp_path / "scripts").mkdir()
    (tmp_path / "scripts" / "y.md").write_text("CURA", encoding="utf-8")
    hits = audit(tmp_path)
    assert any("y.md" in h for h in hits)


def test_skips_non_listed_extensions(tmp_path: Path):
    (tmp_path / "pipeline").mkdir()
    (tmp_path / "pipeline" / "img.jpg").write_text("diagnóstico", encoding="utf-8")
    assert audit(tmp_path) == []


def test_real_tree_is_clean():
    # Smoke gate against the actual repo state at this point in time.
    # If this fails, fix the offending string before merging Wave 0.
    from scripts.audit_vocabulary import audit as audit_real
    assert audit_real() == []
