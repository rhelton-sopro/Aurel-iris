#!/usr/bin/env python3
"""LGPD vocabulary audit for vision-service.

Analog of apps/web/scripts/audit-vocabulary.mjs. Fails (exit 1) when any
file under SCAN_DIRS contains forbidden vocabulary (LGPD-aligned per D-J2).

Usage:
    python -m scripts.audit_vocabulary           # CLI
    from scripts.audit_vocabulary import audit   # programmatic
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# Forbidden terms encoded to avoid self-detection (this file is in SCAN_DIRS).
# Concatenated at runtime — do not expand to literals in this file.
# Word-boundary anchors (\b) prevent false positives like "escuras" / "obscura"
# matching the substring "cura". The audit fires only on the standalone words.
_FORBIDDEN = "|".join([
    r"\bdiagn[" + "ó" + r"o]stico\b",
    r"\btratamento\b",
    r"\bcura\b",
])
PATTERN = re.compile(_FORBIDDEN, re.IGNORECASE | re.UNICODE)
EXTENSIONS = {".py", ".json", ".md"}
SCAN_DIRS = ["pipeline", "data", "scripts", "tests/fixtures"]
SKIP_DIRS = {"__pycache__", ".pytest_cache", "node_modules"}
# This file must be excluded — it references the forbidden pattern for matching purposes.
SKIP_FILES = {Path(__file__).name}
ROOT = Path(__file__).parent.parent  # vision-service/


def audit(root: Path | None = None) -> list[str]:
    """Return list of violation lines `path:line: content`. Empty list = clean."""
    base = root or ROOT
    hits: list[str] = []
    for sub in SCAN_DIRS:
        target = base / sub
        if not target.exists():
            continue
        for path in target.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix not in EXTENSIONS:
                continue
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            if path.name in SKIP_FILES:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            for i, line in enumerate(text.splitlines(), 1):
                if PATTERN.search(line):
                    rel = path.relative_to(base)
                    hits.append(f"{rel}:{i}: {line.strip()}")
    return hits


def main() -> int:
    hits = audit()
    if hits:
        print("VOCAB FAIL — vocabulário proibido encontrado:")
        for h in hits:
            print(h)
        return 1
    print("OK: vocabulário proibido ausente em vision-service/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
