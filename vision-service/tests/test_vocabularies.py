"""Tests for D-T2..T5 vocabulary enforcement (RAG-01).

Wave 0 scaffolding (06-01-PLAN). Each test currently SKIPS with the
implementation plan number that will turn it GREEN.

Covers (read from vision-service/scripts/data/vocabularies.json):
  - constituicao_referenciada — D-T2 verbatim list of 6 entries
  - setores_referenciados — D-T3 verbatim h1..h12
  - dimensoes — D-T5 verbatim list of 6 entries
  - escola_origem — D-T5 verbatim list of 7 schools
  - sinais_referenciados — D-T4 baseline (founder validates full list in 06-02)
  - LGPD: no forbidden vocab in vocabularies.json
"""
from __future__ import annotations
import pytest


class TestVocabularies:
    @pytest.mark.skip(reason="Wave 0 — flip in 06-02-PLAN")
    def test_vocabularies_json_loads_without_error(self):
        import json
        from pathlib import Path
        path = Path(__file__).parent.parent / "scripts" / "data" / "vocabularies.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        # Top-level keys present (assertion finalized in 06-02)
        assert "constituicao_referenciada" in data
        assert "setores_referenciados" in data
        assert "dimensoes" in data
        assert "escola_origem" in data
        assert "sinais_referenciados" in data

    @pytest.mark.skip(reason="Wave 0 — flip in 06-02-PLAN")
    def test_constituicao_referenciada_canonical_list(self):
        # D-T2 verbatim
        import json
        from pathlib import Path
        path = Path(__file__).parent.parent / "scripts" / "data" / "vocabularies.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data["constituicao_referenciada"] == [
            "linfatica", "biliar", "hematogina",
            "mix-biliar", "neurogenica", "miasmatica",
        ]

    @pytest.mark.skip(reason="Wave 0 — flip in 06-02-PLAN")
    def test_setores_referenciados_h1_through_h12(self):
        # D-T3 verbatim — Jensen clock notation
        import json
        from pathlib import Path
        path = Path(__file__).parent.parent / "scripts" / "data" / "vocabularies.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data["setores_referenciados"] == [
            "h1", "h2", "h3", "h4", "h5", "h6",
            "h7", "h8", "h9", "h10", "h11", "h12",
        ]

    @pytest.mark.skip(reason="Wave 0 — flip in 06-02-PLAN")
    def test_dimensoes_canonical_list(self):
        # D-T5 verbatim
        import json
        from pathlib import Path
        path = Path(__file__).parent.parent / "scripts" / "data" / "vocabularies.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data["dimensoes"] == [
            "fisica", "psicossomatica", "transgeracional",
            "constitucional", "energetica", "comportamental",
        ]

    @pytest.mark.skip(reason="Wave 0 — flip in 06-02-PLAN")
    def test_escola_origem_canonical_list(self):
        # D-T5 verbatim — exact 7 schools
        import json
        from pathlib import Path
        path = Path(__file__).parent.parent / "scripts" / "data" / "vocabularies.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data["escola_origem"] == [
            "Jensen", "Rayid", "Italiana", "Alemã",
            "Brasileira", "Espanhola", "Andrews-britânica",
        ]

    @pytest.mark.skip(reason="Wave 0 — flip in 06-02-PLAN")
    def test_sinais_referenciados_includes_baseline_signs(self):
        # D-T4 baseline; founder validates full list in 06-02
        import json
        from pathlib import Path
        path = Path(__file__).parent.parent / "scripts" / "data" / "vocabularies.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        baseline = {"lacuna_aberta", "cripta", "anel_tensao", "arco_senil"}
        assert baseline.issubset(set(data["sinais_referenciados"]))

    @pytest.mark.skip(reason="Wave 0 — flip in 06-02-PLAN")
    def test_no_forbidden_vocab_in_vocabularies_json(self):
        # LGPD-06: no diagnóstico/tratamento/cura in canonical vocab
        import re
        from pathlib import Path
        path = Path(__file__).parent.parent / "scripts" / "data" / "vocabularies.json"
        text = path.read_text(encoding="utf-8")
        forbidden = re.compile(
            r"\bdiagn[óo]stico\b|\btratamento\b|\bcura\b",
            re.IGNORECASE | re.UNICODE,
        )
        assert forbidden.search(text) is None, "Forbidden LGPD vocab in vocabularies.json"
