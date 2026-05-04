"""
Tests for the LGPD vocabulary audit script (scripts/audit_vocabulary.py).

Strategy: invoke the audit's PATTERN regex directly against in-memory strings
(avoid file I/O for speed); also assert the D-E1 catalog passes; also run
the real-tree smoke gate.

Coverage:
  - Positive: each forbidden token form detected (7 parametrized samples)
  - Negative: clean strings including D-E1 catalog pass (16 parametrized samples)
  - Catalog: all 5 D-E1 strings pass the audit
  - Self-skip: script's own regex definition line is not self-triggering
  - Integration: real tree smoke gate (passes if tree is clean)
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.audit_vocabulary import PATTERN, audit

# ---------------------------------------------------------------------------
# Samples
# ---------------------------------------------------------------------------

FORBIDDEN_SAMPLES = [
    "diagnóstico de catarata",
    "Diagnóstico precoce",
    "DIAGNÓSTICO em maiúsculas",
    "diagnostico sem acento",
    "sugere tratamento",
    "cura definitiva",
    "A cura está próxima",
]

CLEAN_SAMPLES = [
    # D-E1 catalog strings (verbatim)
    "Imagens com pouca luz — tente recapturar",
    "Olhos não detectados nas fotos",
    "Tempo limite excedido — tente novamente",
    "Falha temporária no processamento — tente novamente",
    "Imagens em formato inválido",
    # Jensen zone strings (D-J2 anatomical vocabulary)
    "fígado, vesícula biliar",
    "cérebro frontal",
    "apêndice, intestino delgado",
    # False-positive guard: 'cura' substring inside other words
    "curativo no setor 3",          # 'curativo' contains 'cura' — must NOT trigger (word-boundary)
    "procurar fibras radiais",       # 'procurar' contains 'cura' — must NOT trigger
    # Status badge copy
    "Aguardando",
    "Processando",
    "Pronto",
    "Falhou",
    "Editado",
    "Reprocessar",
]


# ---------------------------------------------------------------------------
# Parametrized positive tests: forbidden tokens MUST be detected
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("sample", FORBIDDEN_SAMPLES)
def test_forbidden_token_detected(sample: str):
    """Each forbidden vocabulary form must trigger the PATTERN match."""
    assert PATTERN.search(sample) is not None, (
        f"Expected to detect forbidden vocab in: {sample!r}"
    )


# ---------------------------------------------------------------------------
# Parametrized negative tests: clean strings MUST pass
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("sample", CLEAN_SAMPLES)
def test_clean_string_passes(sample: str):
    """Clean strings — including D-E1 catalog, Jensen zones, badge copy — must NOT be flagged."""
    assert PATTERN.search(sample) is None, (
        f"Clean string falsely flagged: {sample!r}"
    )


# ---------------------------------------------------------------------------
# Catalog integration: all 5 D-E1 strings pass the audit
# ---------------------------------------------------------------------------

def test_d_e1_catalog_strings_are_clean():
    """The 5 D-E1 strings in error_summary.json must pass the LGPD audit."""
    catalog_path = Path(__file__).parent.parent / "data" / "error_summary.json"
    assert catalog_path.exists(), "error_summary.json missing"
    data = json.loads(catalog_path.read_text(encoding="utf-8"))
    strings = data.get("strings") or {}
    assert len(strings) == 5, f"Expected exactly 5 D-E1 strings, got {len(strings)}"
    for key, value in strings.items():
        assert PATTERN.search(value) is None, (
            f"D-E1 catalog entry '{key}' contains forbidden vocab: {value!r}"
        )


# ---------------------------------------------------------------------------
# Self-skip: audit script must not self-trigger on its regex definition
# ---------------------------------------------------------------------------

def test_scan_skips_audit_script_itself(tmp_path: Path):
    """The audit script is in SKIP_FILES — it must not be scanned."""
    import scripts.audit_vocabulary as mod
    script_path = Path(mod.__file__)
    # The script contains the forbidden pattern strings inside its PATTERN definition.
    # Since SKIP_FILES = {Path(__file__).name}, it must not appear in audit hits.
    hits = audit(script_path.parent.parent)
    # Confirm the audit script itself does not produce hits
    script_rel = str(script_path.name)
    script_hits = [h for h in hits if script_rel in h]
    assert not script_hits, (
        f"Audit script self-triggered — hits referencing the script: {script_hits}"
    )


# ---------------------------------------------------------------------------
# Existing file-I/O integration tests (from 05-01)
# ---------------------------------------------------------------------------

def test_clean_tree_returns_empty(tmp_path: Path):
    """Minimal tree with no forbidden vocab returns empty hit list."""
    (tmp_path / "pipeline").mkdir()
    (tmp_path / "data").mkdir()
    (tmp_path / "pipeline" / "ok.py").write_text("# benign", encoding="utf-8")
    (tmp_path / "data" / "ok.json").write_text(
        json.dumps({"map_name": "jensen", "right": {"7": ["fígado"]}}),
        encoding="utf-8",
    )
    assert audit(tmp_path) == []


def test_detects_diagnostico(tmp_path: Path):
    """Audit returns hit for 'diagnóstico' in a pipeline .py file."""
    (tmp_path / "pipeline").mkdir()
    bad = tmp_path / "pipeline" / "bad.py"
    bad.write_text("# isto é um diagnóstico clínico\n", encoding="utf-8")
    hits = audit(tmp_path)
    assert any("bad.py" in h and "diagnóstico" in h for h in hits)


def test_detects_tratamento(tmp_path: Path):
    """Audit returns hit for 'tratamento' in a data .json file."""
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / "x.json").write_text('{"k":"tratamento"}', encoding="utf-8")
    hits = audit(tmp_path)
    assert any("x.json" in h for h in hits)


def test_case_insensitive(tmp_path: Path):
    """Audit matches 'CURA' (uppercase) in a scripts .md file."""
    (tmp_path / "scripts").mkdir()
    (tmp_path / "scripts" / "y.md").write_text("CURA", encoding="utf-8")
    hits = audit(tmp_path)
    assert any("y.md" in h for h in hits)


def test_skips_non_listed_extensions(tmp_path: Path):
    """Files with extensions not in EXTENSIONS (.jpg, .csv, etc.) are ignored."""
    (tmp_path / "pipeline").mkdir()
    (tmp_path / "pipeline" / "img.jpg").write_text("diagnóstico", encoding="utf-8")
    assert audit(tmp_path) == []


def test_real_tree_is_clean():
    """Smoke gate: actual vision-service/ tree must contain no forbidden vocabulary."""
    assert audit() == []
