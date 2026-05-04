---
phase: 05-pipeline-visao-modal
plan: "01"
subsystem: vision-service
status: complete
completed_date: "2026-05-04"
duration_minutes: 5
tasks_completed: 3
tasks_total: 3
files_created: 11
files_modified: 1
tags: [vision, testing, python, pytest, lgpd-vocab]
requirements_completed: [VISION-02]

dependency_graph:
  requires: []
  provides:
    - vision-service/pytest.ini (pytest discovery root + pythonpath)
    - vision-service/tests/conftest.py (session fixtures: expected, iris_images, fixtures_dir)
    - vision-service/scripts/audit_vocabulary.py (LGPD vocab audit callable + CLI)
    - vision-service/tests/fixtures/CONSENT.md (LGPD self-consent record)
    - vision-service/tests/fixtures/expected.json (founder annotation seed)
  affects:
    - Wave 1 stage tests (unblocked by conftest fixtures)
    - Plan 05-15 (CI workflow wires audit_vocabulary as gate)

tech_stack:
  added:
    - pytest>=8.0 (test runner)
    - httpx>=0.27 (HTTP client for future integration tests)
  patterns:
    - session-scoped pytest fixtures via conftest.py
    - audit script that excludes itself from SKIP_FILES to avoid self-detection
    - deferred cv2 import (only when JPEG fixtures exist) to avoid ImportError on dev machines

key_files:
  created:
    - vision-service/pytest.ini
    - vision-service/conftest.py
    - vision-service/scripts/__init__.py
    - vision-service/scripts/audit_vocabulary.py
    - vision-service/tests/__init__.py
    - vision-service/tests/conftest.py
    - vision-service/tests/test_smoke.py
    - vision-service/tests/test_audit_vocabulary.py
    - vision-service/tests/fixtures/CONSENT.md
    - vision-service/tests/fixtures/expected.json
    - vision-service/tests/fixtures/iris/.gitkeep
  modified:
    - vision-service/requirements.txt (appended pytest>=8.0 and httpx>=0.27)

decisions:
  - "SKIP_FILES = {audit_vocabulary.py} added to avoid self-detection: the audit script itself contains the pattern string (encoded to avoid match) but the SKIP_FILES guard is the primary safety net"
  - "cv2 import deferred inside iris_images fixture until JPEG paths exist, so pytest runs cleanly on dev machines without opencv-python-headless"
  - "conftest.py at project root (vision-service/) is an empty anchor ensuring pythonpath=. resolves correctly in pytest 8.x"
---

# Phase 5 Plan 01: Test Infrastructure Bootstrap Summary

**One-liner:** Pytest config + session fixtures + LGPD vocabulary audit script with SKIP_FILES self-exclusion guard, all running exit-0 from a clean clone.

## What Was Built

**Task 1 — Pytest config + requirements bump + project-level conftest** (`7d13ce9`)

- `vision-service/pytest.ini`: `testpaths=tests`, `pythonpath=.`, `--strict-markers`, `filterwarnings=ignore::DeprecationWarning`
- `vision-service/conftest.py`: empty project-root anchor (one docstring line) ensuring pytest 8.x resolves `pythonpath=.` from vision-service root
- `vision-service/requirements.txt`: appended `pytest>=8.0` and `httpx>=0.27`
- `vision-service/tests/__init__.py`: zero-byte package marker

**Task 2 — Tests conftest + smoke test + fixture scaffolding** (`5079a83`)

- `vision-service/tests/conftest.py`: three session-scoped fixtures — `expected` (loads `expected.json`), `iris_images` (loads JPEGs as `{stem: ndarray}`), `fixtures_dir` (path to fixtures/)
- `vision-service/tests/test_smoke.py`: 4 tests proving pipeline modules importable, expected fixture loads, iris_images returns dict, fixtures/iris dir exists
- `vision-service/tests/fixtures/CONSENT.md`: LGPD founder self-consent + third-party consent path (D-X1, D-X4)
- `vision-service/tests/fixtures/expected.json`: placeholder `{}` for founder annotation (D-X3)
- `vision-service/tests/fixtures/iris/.gitkeep`: empty directory tracker

**Task 3 — LGPD vocabulary audit script** (`50d102f`)

- `vision-service/scripts/__init__.py`: zero-byte package marker enabling `from scripts.audit_vocabulary import audit`
- `vision-service/scripts/audit_vocabulary.py`: Python analog of `apps/web/scripts/audit-vocabulary.mjs`; scans `pipeline/`, `data/`, `scripts/`, `tests/fixtures/` for `.py/.json/.md` containing `diagnóstico|tratamento|cura` (case-insensitive); CLI exits 0/1; callable `audit(root=None) -> list[str]`
- `vision-service/tests/test_audit_vocabulary.py`: 6 tests covering clean/dirty/case/extension/self/real-tree paths

## Verification Results

```
cd vision-service && python -m pytest tests/ -x -q
10 passed in 0.07s   (4 smoke + 6 audit)

cd vision-service && python -m scripts.audit_vocabulary
OK: vocabulário proibido ausente em vision-service/   (exit 0)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Deferred cv2 import in iris_images fixture**
- **Found during:** Task 3 (running `python -m pytest tests/test_smoke.py`)
- **Issue:** `import cv2` inside fixture body executed immediately at fixture invocation even when no JPEG files exist, causing `ModuleNotFoundError` on dev machines without `opencv-python-headless` installed
- **Fix:** Added `jpeg_paths = sorted(IRIS_DIR.glob("*.jpg"))` guard; `import cv2` and loop only execute when `jpeg_paths` is non-empty. Returns `{}` immediately on clean clone.
- **Files modified:** `vision-service/tests/conftest.py`
- **Commit:** `50d102f`

**2. [Rule 1 - Bug] SKIP_FILES guard in audit_vocabulary.py to prevent self-detection**
- **Found during:** Task 3 (running `python -m scripts.audit_vocabulary`)
- **Issue:** The audit script scans `scripts/` directory and matched its own source lines containing the forbidden pattern (docstring + PATTERN line). Exit code was 1 instead of 0.
- **Fix:** (a) Encoded PATTERN via string concatenation to avoid literal match in source; (b) Added `SKIP_FILES = {Path(__file__).name}` and `if path.name in SKIP_FILES: continue` guard so the script excludes itself. This mirrors how the JS analog avoids self-detection by only scanning `app/` and `components/` (not `scripts/`).
- **Files modified:** `vision-service/scripts/audit_vocabulary.py`
- **Commit:** `50d102f`

## Known Stubs

None. This plan is infrastructure-only — no data flows or UI components that could produce stubs.

## Threat Flags

No new threat surface introduced beyond what is in the plan's threat model (T-05-01-01 through T-05-01-05 already registered).

## Self-Check: PASSED
