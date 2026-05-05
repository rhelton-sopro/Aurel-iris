"""Tests for D-T2..T5 vocabulary enforcement (RAG-01).

Wave 0 scaffolding (06-01-PLAN). Flipped GREEN in 06-02-PLAN once
vision-service/scripts/data/vocabularies.json landed with founder-approved
canonical lists (D-T2..T5).

Covers (read from vision-service/scripts/data/vocabularies.json):
  - constituicao_referenciada — D-T2 verbatim list of 6 entries
  - setores_referenciados — D-T3 verbatim h1..h12
  - dimensoes — D-T5 verbatim list of 6 entries
  - escola_origem — D-T5 verbatim list of 7 schools
  - sinais_referenciados — D-T4 baseline (founder validates full list in 06-02)
  - LGPD: no forbidden vocab in vocabularies.json
"""
from __future__ import annotations


class TestVocabularies:
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
        # Versioning convention (D-T6) — bumps require founder approval + re-tag.
        # 0.1.1 reflects the founder-gate edits in 06-02 (3 sinais added,
        # nutricao_carencias section added on TS side).
        assert data["vocabularies_name"] == "rag_controlled_vocabularies"
        assert data["version"] == "0.1.1"

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

    def test_sinais_referenciados_includes_baseline_signs(self):
        # D-T4 baseline; founder validates full list in 06-02
        import json
        from pathlib import Path
        path = Path(__file__).parent.parent / "scripts" / "data" / "vocabularies.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        baseline = {"lacuna_aberta", "cripta", "anel_tensao", "arco_senil"}
        assert baseline.issubset(set(data["sinais_referenciados"]))
        # 06-02 founder-gate additions (2026-05-05) — bumps version to 0.1.1.
        # These three sinais were proposed by the founder during the human-verify
        # checkpoint and must remain in the canonical list (regression guard).
        founder_additions = {"pterigium_pigmentar", "nevus", "criptas_radiais"}
        assert founder_additions.issubset(set(data["sinais_referenciados"]))

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
