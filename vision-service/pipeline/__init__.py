"""
Aurel Iris vision pipeline stages (SPEC §4.2).

Order: detect -> segment -> compose -> normalize -> enhance -> features.

Status: SKELETON ONLY — Phase 1 (Setup). Real implementations land in Phase 5.
"""

from . import compose, detect, enhance, features, normalize, segment

__all__ = ["detect", "segment", "compose", "normalize", "enhance", "features"]
