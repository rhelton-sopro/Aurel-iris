#!/usr/bin/env python3
"""Bootstrap helper for vision-service/scripts/data/books_manifest.json (D-M1).

Walks the acervo directory, applies default decisions, and writes a draft
manifest. Founder reviews and edits inline before commit.

Usage:
    python -m scripts.manifest_assist                       # interactive
    python -m scripts.manifest_assist --yes                  # accept all defaults
    python -m scripts.manifest_assist --acervo "D:/path"     # custom acervo
    python -m scripts.manifest_assist --validate             # validate existing manifest

Phase: 06-rag-ingestao | Plan: 06-03 | Decisions: D-M1, D-S1, RESEARCH Pitfall 11/12
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

DEFAULT_ACERVO = Path("D:/Projetos/Iridologista/livros")
MANIFEST_PATH = Path(__file__).parent / "data" / "books_manifest.json"

# Default mapping (filename substring -> {escola, idioma, alta_prioridade}).
# Keys are matched as case-insensitive substring against the filename.
# Founder validates and overrides via the gate task in this plan.
DEFAULT_MAP: list[tuple[str, dict]] = [
    ("Bernard-Jensen-Iridology-Simplified",
     {"escola": "Jensen", "idioma": "en", "ano": 1980, "alta_prioridade": True,
      "notas": "Texto-base da escola americana — alta prioridade no boost retrieval"}),
    ("dictionary-of-iridology",
     {"escola": "Jensen", "idioma": "en", "ano": 1990, "alta_prioridade": True,
      "notas": "Glossário canônico Jensen — termos técnicos"}),
    ("Bernard-Jensen-Iridology-pdf",
     {"escola": "Jensen", "idioma": "en", "ano": 1982, "alta_prioridade": False,
      "notas": "PDF do volume principal Jensen"}),
    ("Bernard-Jensen.docx",
     {"escola": "Jensen", "idioma": "en", "ano": 1982, "alta_prioridade": False,
      "skip": True, "notas": "DOCX duplicado do PDF acima (RESEARCH Pitfall 12)"}),
    ("Manual-Para-La-Practica",
     {"escola": "Espanhola", "idioma": "es", "ano": 2010, "alta_prioridade": False}),
    ("Manual-de-Iridologia",
     {"escola": "Brasileira", "idioma": "pt", "ano": 2005, "alta_prioridade": False}),
    ("Congreso-Mundial-de-Iridologia",
     {"escola": "Espanhola", "idioma": "es", "ano": 2015, "alta_prioridade": False,
      "notas": "Congresso 2015 — papers multi-autorais"}),
    ("Iridologia-Em-Defesa-Da-Vida",
     {"escola": "Brasileira", "idioma": "pt", "ano": 2008, "alta_prioridade": True,
      "notas": "Referência brasileira contemporânea"}),
    ("Iridologia-Psicoemocional",
     {"escola": "Brasileira", "idioma": "pt", "ano": 2012, "alta_prioridade": True,
      "notas": "Cobre dimensão psicoemocional (D-S3)"}),
    ("IRIDOLOGIA-PSICOTERAPEUTICA",
     {"escola": "Brasileira", "idioma": "pt", "ano": 2015, "alta_prioridade": False,
      "notas": "Método vetorial brasileiro"}),
    ("iridiologia-aplicada-pratica",
     {"escola": "Brasileira", "idioma": "pt", "ano": 2010, "alta_prioridade": False}),
    ("iridologia-mod-03 (1)",
     {"escola": "Brasileira", "idioma": "pt", "ano": 2010, "alta_prioridade": False,
      "skip": True, "notas": "Duplicata de iridologia-mod-03.pdf (RESEARCH Pitfall 11)"}),
    ("iridologia-mod-03.pdf",
     {"escola": "Brasileira", "idioma": "pt", "ano": 2010, "alta_prioridade": False,
      "notas": "Manter; cópia (1) marcada como skip"}),
    ("Iridologia-Del-Profondo-Birello",
     {"escola": "Italiana", "idioma": "it", "ano": 2007, "alta_prioridade": True,
      "notas": "Lo Rito + Birello — ref italiana psicossomática"}),
    ("What-the-Eye-Reveals",
     {"escola": "Rayid", "idioma": "en", "ano": 1995, "alta_prioridade": True,
      "notas": "Rayid — cobre dimensão psicoemocional/comportamental (D-S3)"}),
    ("Iridology-a-Guide",
     {"escola": "Andrews-britânica", "idioma": "en", "ano": 1992, "alta_prioridade": False,
      "notas": "Adam Jackson — escola britânica acessível"}),
    ("IridENews5",
     {"escola": "Espanhola", "idioma": "es", "ano": 2018, "alta_prioridade": False,
      "notas": "Boletim multilíngue — founder confirma escola"}),
    ("endocrinology-and-iridology",
     {"escola": "Jensen", "idioma": "en", "ano": 1985, "alta_prioridade": False,
      "notas": "DOCX único — sem PDF equivalente (RESEARCH Open Question 4)"}),
]


def detect_extrator(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        return "pymupdf"
    if suffix == ".docx":
        return "docx2txt"  # use docx2txt for minimal surface (RESEARCH line 351)
    return "skip"


def find_default(filename: str) -> dict:
    """Return default fields for a filename via substring match."""
    for needle, defaults in DEFAULT_MAP:
        if needle.lower() in filename.lower():
            return dict(defaults)
    return {
        "escola": "Jensen",
        "idioma": "en",
        "ano": 2000,
        "alta_prioridade": False,
        "notas": "Auto-default — founder review needed",
    }


def canonical_book_key(filename: str) -> str:
    """Generate a stable source_book key from filename — strip prefix digits + ext."""
    stem = Path(filename).stem
    # Strip leading digits + dash (e.g., "157928975-Bernard-Jensen..." -> "Bernard-Jensen...")
    parts = stem.split("-", 1)
    if len(parts) == 2 and parts[0].isdigit():
        stem = parts[1]
    # Replace dashes with spaces, normalize
    return stem.replace("-", " ").strip()


def bootstrap(acervo: Path, accept_defaults: bool) -> dict:
    if not acervo.exists():
        raise FileNotFoundError(f"Acervo not found: {acervo}")
    files = sorted(p for p in acervo.iterdir() if p.is_file() and p.suffix.lower() in {".pdf", ".docx"})
    if len(files) == 0:
        raise RuntimeError(f"No PDF/DOCX files in {acervo}")
    print(f"Found {len(files)} file(s) in acervo.")

    books: dict = {}
    for path in files:
        filename = path.name
        defaults = find_default(filename)
        entry = {
            "filename": filename,
            "autor": defaults.get("autor", "Unknown"),
            "escola": defaults["escola"],
            "idioma": defaults["idioma"],
            "ano": defaults["ano"],
            "alta_prioridade": defaults.get("alta_prioridade", False),
            "extrator": detect_extrator(filename),
            "skip": defaults.get("skip", False),
            "ocr_required": False,
            "notas": defaults.get("notas", ""),
        }
        # Best-effort autor inference from filename
        if "Bernard-Jensen" in filename or "Jensen" in filename:
            entry["autor"] = "Bernard Jensen"
        elif "Birello" in filename:
            entry["autor"] = "Lucio Birello & Daniele Lo Rito"
        elif "Jackson" in filename:
            entry["autor"] = "Adam J. Jackson"

        key = canonical_book_key(filename)
        if not accept_defaults:
            print(f"\n=== {key} ===")
            print(json.dumps(entry, indent=2, ensure_ascii=False))
            edit = input("Edit? [y/N]: ").strip().lower()
            if edit == "y":
                # Simplified inline edit — for full edits, founder edits the JSON file directly
                for field in ("escola", "idioma", "ano", "alta_prioridade", "extrator", "skip", "notas"):
                    raw = input(f"  {field} [{entry[field]}]: ").strip()
                    if raw:
                        if field in ("alta_prioridade", "skip"):
                            entry[field] = raw.lower() in ("true", "yes", "y", "1")
                        elif field == "ano":
                            entry[field] = int(raw)
                        else:
                            entry[field] = raw
        books[key] = entry

    return {
        "catalog_name": "books_manifest",
        "version": "0.1.0",
        "books": books,
    }


def validate_shape(manifest: dict) -> list[str]:
    """Lightweight shape check (full Pydantic validation lands in 06-06)."""
    errors: list[str] = []
    if "catalog_name" not in manifest or manifest["catalog_name"] != "books_manifest":
        errors.append("missing or wrong catalog_name")
    if "version" not in manifest:
        errors.append("missing version")
    if "books" not in manifest or not isinstance(manifest["books"], dict):
        errors.append("missing or non-dict books field")
        return errors
    required_keys = {"filename", "autor", "escola", "idioma", "ano",
                     "alta_prioridade", "extrator", "skip", "ocr_required", "notas"}
    for key, entry in manifest["books"].items():
        missing = required_keys - set(entry.keys())
        if missing:
            errors.append(f"books.{key} missing keys: {sorted(missing)}")
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="manifest_assist")
    parser.add_argument("--acervo", type=Path, default=DEFAULT_ACERVO)
    parser.add_argument("--yes", action="store_true", help="Accept all defaults non-interactively")
    parser.add_argument("--validate", action="store_true", help="Validate existing manifest only")
    args = parser.parse_args(argv)

    if args.validate:
        if not MANIFEST_PATH.exists():
            print(f"ERROR: {MANIFEST_PATH} does not exist", file=sys.stderr)
            return 1
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        errors = validate_shape(manifest)
        if errors:
            for e in errors:
                print(f"INVALID: {e}", file=sys.stderr)
            return 1
        print(f"OK — {len(manifest['books'])} entries valid")
        return 0

    manifest = bootstrap(args.acervo, accept_defaults=args.yes)
    errors = validate_shape(manifest)
    if errors:
        for e in errors:
            print(f"INVALID: {e}", file=sys.stderr)
        return 1
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"OK — wrote {len(manifest['books'])} entries to {MANIFEST_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
