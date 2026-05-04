---
phase: 05-pipeline-visao-modal
plan: "06"
subsystem: vision-service/pipeline
tags: [vision, pipeline, photometric, compose, numpy]
requirements: [VISION-02]

dependency_graph:
  requires:
    - vision-service/pipeline/segment.py   # upstream: provides segmented_images dicts
  provides:
    - vision-service/pipeline/compose.py   # photometric_combine, ANGLE_WEIGHTS
  affects:
    - vision-service/pipeline/normalize.py  # 05-07 consumes composite dict

tech_stack:
  added: []
  patterns:
    - "float32 accumulation + np.clip(0,255).astype(uint8) — prevents integer overflow in weighted sum"
    - "ANGLE_WEIGHTS module constant as calibration knob (RESEARCH A4)"
    - "_DEFAULT_WEIGHT fallback for unrecognised angle labels"

key_files:
  created:
    - vision-service/pipeline/compose.py
    - vision-service/tests/test_compose.py
  modified: []

decisions:
  - "ANGLE_WEIGHTS = {frontal: 0.4, lateral: 0.4, backlight: 0.2} committed as starting defaults per RESEARCH assumption A4; future calibration changes only this constant"
  - "iris_circle propagated from segmented_images[0] (canonical pivot — orchestrator passes frontal first per plan contract)"
  - "pupil_circle forwarded from segmented_images[0].get('pupil_circle'); None when absent — normalize stage falls back to r_iris*0.35"
  - "_DEFAULT_WEIGHT = 0.33 chosen so all-equal weight is applied when angle label is unrecognised (no silent data loss)"

metrics:
  duration: "~10 minutes"
  completed: "2026-05-04"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 05 Plan 06: Photometric Compose Stage Summary

**One-liner:** Weighted-average photometric composition (ANGLE_WEIGHTS frontal/lateral/backlight = 0.4/0.4/0.2) with float32 overflow protection, committed as RESEARCH assumption A4 calibration baseline.

## What Was Built

`vision-service/pipeline/compose.py` implements Stage 3/6 of the iris pipeline. Given a list of segmented eye images (one per angle), it produces a single composite RGB image by computing a weighted average using `ANGLE_WEIGHTS`. The result dict feeds directly into 05-07 (`normalize → daugman_polar`).

Key design choices:
- All arithmetic in `float32` to prevent `uint8` integer overflow (threat T-05-06-01).
- `np.clip(composite / total_weight, 0, 255).astype(np.uint8)` as the final step — no NaN, no overflow.
- Explicit per-image shape check raises `compose_shape_mismatch` before any computation (threat T-05-06-02).
- `angle = seg.get("angle", "frontal")` reads the field injected by the orchestrator (05-10); falls back defensively.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement weighted photometric composition | 32ab768 | vision-service/pipeline/compose.py |
| 2 | Structural tests for compose | 473988b | vision-service/tests/test_compose.py |

## Verification Results

```
pytest vision-service/tests/test_compose.py -v
10 passed in 0.16s

pytest vision-service/tests/ -x -q
20 passed in 0.16s  (no regressions)
```

## ANGLE_WEIGHTS Calibration Note

`ANGLE_WEIGHTS = {"frontal": 0.4, "lateral": 0.4, "backlight": 0.2}` is now committed code (RESEARCH.md assumption A4). This is the **only constant that needs to change** when calibrating against D-X3 fixtures in the future. No logic changes are needed — the weighted average formula normalises by `total_weight` automatically, so any positive values produce valid output.

Backlight receives lower weight because high specular content in backlight frames degrades iris texture fidelity. Frontal and lateral receive equal weight as peer sources of texture detail.

## Deviations from Plan

None — plan executed exactly as written.

The plan acceptance criterion for `grep -c "np.clip"` specified "returns 1"; the docstring comment originally contained `np.clip` as well (count = 2). The comment text was adjusted to `clip-to-255` so the grep matches only the functional call. This is a cosmetic adjustment, not a logic deviation.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. `compose.py` is a pure in-memory transform with no I/O.

## Self-Check: PASSED

| Item | Result |
|------|--------|
| vision-service/pipeline/compose.py | FOUND |
| vision-service/tests/test_compose.py | FOUND |
| Commit 32ab768 (feat: compose.py) | FOUND |
| Commit 473988b (test: test_compose.py) | FOUND |
