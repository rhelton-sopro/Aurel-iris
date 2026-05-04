"""
Authoritative loader for the D-E1 error_summary catalog.

The catalog lives at ``vision-service/data/error_summary.json`` and contains
the 5 pt-BR strings (LGPD-audited) used by ``modal_app.py`` to populate
``processing_metadata.error_summary`` when the pipeline fails.

Usage::

    from pipeline.error_summary import ERROR_SUMMARY
    # ...
    except SomeException:
        error_summary = ERROR_SUMMARY['transient']

The catalog is loaded once via ``@functools.lru_cache`` (Pitfall 6 — load
on first import, not on every call) using a CWD-independent path.

Mirror of ``pipeline/iris_maps.py`` for consistency.
"""
from __future__ import annotations

import functools
import json
from pathlib import Path
from typing import Dict

_CATALOG_PATH = Path(__file__).parent.parent / "data" / "error_summary.json"


@functools.lru_cache(maxsize=None)
def load_error_summary() -> Dict[str, str]:
    """Load and cache ``data/error_summary.json`` strings dict.

    Returns:
        Dict mapping English catalog keys to pt-BR display strings (D-E1).

    Raises:
        FileNotFoundError: if ``data/error_summary.json`` is missing.
        ValueError: if the JSON structure is malformed (missing ``strings`` dict).
    """
    with open(_CATALOG_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    strings = raw.get("strings")
    if not isinstance(strings, dict):
        raise ValueError(
            f"error_summary.json malformed at {_CATALOG_PATH}: missing 'strings' dict"
        )
    return strings


# Module-level convenience export — populated on first import.
# Type annotation mirrors Dict[str, str] for static analysis compatibility.
ERROR_SUMMARY: Dict[str, str] = load_error_summary()
