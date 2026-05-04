"""Cached loader for vision-service/data/jensen-map.json.

Pattern: RESEARCH.md Pitfall 6. Uses Path(__file__) to resolve the JSON
location independent of CWD inside the Modal container, and lru_cache
so the file is read once per container lifetime.
"""
from __future__ import annotations

import functools
import json
from pathlib import Path

_MAP_PATH = Path(__file__).parent.parent / "data" / "jensen-map.json"


@functools.lru_cache(maxsize=None)
def load_jensen_map() -> dict:
    """Return the Jensen map dict. Cached across calls."""
    with open(_MAP_PATH, encoding="utf-8") as f:
        return json.load(f)
