---
phase: 05-pipeline-visao-modal
plan: "05"
subsystem: vision-service
tags: [vision, pipeline, opencv, hough, segment]

requires:
  - phase: 05-pipeline-visao-modal
    provides: "Wave 0 pytest infra (conftest.py + fixtures + audit:vocabulary CLI)"

provides:
  - "vision-service/pipeline/segment.py: iris_mask(image, detection, *, warnings=None) — HoughCircles + MediaPipe-estimate fallback (D-F1) + Pitfall 7 closest-to-seed selector"
  - "vision-service/pipeline/segment.py: HOUGH_DEFAULTS = {dp:1.0, minDist:100, param1:100, param2:40, minRadius:80, maxRadius:200} exported as module constant (D-X3 calibration knob)"

affects:
  - "05-06 (compose — consumes segmented_image triple from this stage)"
  - "05-07 (normalize — consumes iris_circle from this stage)"
  - "05-09 (features — consumes binary_mask from this stage)"

tech-stack:
  added: []
  patterns:
    - "Pre-processing: cv2.cvtColor(RGB→gray) + cv2.medianBlur(gray, 5) before HoughCircles to suppress specular highlights"
    - "Pitfall 7 guard: np.argmin(dists) selects Hough candidate closest to MediaPipe seed, never circles[0][0] directly"
    - "D-F1 soft degradation: when HoughCircles returns None, fallback to detection['center']/['radius'] and append 'hough_segment_failed_fallback_mediapipe' to optional warnings sink"
    - "Module-level constant pattern for tunable cv2 params: HOUGH_DEFAULTS exported so founder can tune against fixtures via git diff"

key-files:
  created:
    - vision-service/pipeline/segment.py (replaced NotImplementedError stub)
    - vision-service/tests/test_segment.py
  modified: []

key-decisions:
  - "HOUGH_DEFAULTS exported as module constant (not hardcoded inline) — RESEARCH Pattern 5 verbatim, D-X3 calibration knob (changes visible in git diff)"
  - "Optional warnings sink (warnings: list[str] | None = None) — orchestrator-controlled; silent fallback when None, appended otherwise"
  - "Pre-processing pipeline (cvtColor + medianBlur) chosen over CLAHE here because CLAHE is the enhance stage's responsibility (05-08); segment stage only needs noise reduction for Hough sensitivity"
  - "ValueError('segment_invalid_detection') on missing center/radius — fail-fast at the function boundary rather than producing a silently-degraded mask"

patterns-established:
  - "Pattern: tunable cv2 parameter dict exported as module constant (HOUGH_DEFAULTS) — replicate for any cv2 stage with calibration knobs"
  - "Pattern: optional warnings: list[str] | None = None sink for soft-degradation paths — orchestrator decides whether to log or surface to user"

requirements-completed: [VISION-02]

duration: 20min
completed: "2026-05-04"
---

# Phase 5 Plan 05: HoughCircles Iris Segmentation — Summary

**Stage 2 of the vision pipeline. `iris_mask(image, detection)` returns a `{binary_mask, iris_circle, segmented_image}` triple using OpenCV HoughCircles with MediaPipe-estimate fallback when Hough returns no candidates.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 of 2
- **Files modified:** 2 (1 created replacing stub, 1 new test file)

## Accomplishments

- `vision-service/pipeline/segment.py` — `iris_mask(image, detection, *, warnings=None) -> dict` implemented per RESEARCH Pattern 5
- `HOUGH_DEFAULTS = {"dp": 1.0, "minDist": 100, "param1": 100, "param2": 40, "minRadius": 80, "maxRadius": 200}` exported as module constant (D-X3)
- Pre-processing: `cv2.cvtColor(RGB→gray)` + `cv2.medianBlur(gray, 5)` to suppress specular reflections before HoughCircles
- Pitfall 7 guard: `np.argmin(dists)` selects the Hough candidate closest to the MediaPipe seed (never naively picks `circles[0][0]`)
- D-F1 soft degradation: when `cv2.HoughCircles(...)` returns `None`, falls back to `detection['center']`/`detection['radius']` and appends `'hough_segment_failed_fallback_mediapipe'` to the optional `warnings` list (silent when `warnings=None`)
- Returns `{"binary_mask": (H,W) bool, "iris_circle": (cx, cy, r) floats, "segmented_image": (H,W,3) uint8}`
- Input validation: `ValueError("segment_invalid_detection")` raised when `detection['center']` or `detection['radius']` missing

## Task Commits (worktree branch `worktree-agent-a40d542f9edfe8b09`)

- `9209faf` — feat(05-05): implement HoughCircles iris segmentation with MediaPipe fallback
- `7583d81` — test(05-05): structural + fallback + Pitfall7 + geometry tests for segment.iris_mask

This SUMMARY.md is committed by the orchestrator (the executor agent paused on permission for git commit before completing the metadata commit).

## Files Created/Modified

- `vision-service/pipeline/segment.py` — replaced `NotImplementedError` stub with the implementation described above
- `vision-service/tests/test_segment.py` — 10 tests (9 pass, 1 skipped cleanly)

## Decisions Made

- HOUGH_DEFAULTS exported as a module-level constant (not hardcoded) so the founder can tune `param2`/`minDist`/etc. against real-world fixtures and have the change show up in `git diff`
- `warnings: list[str] | None = None` keyword-only argument: orchestrator owns whether soft-degradation paths are logged
- Pre-processing kept minimal (gray + medianBlur) — CLAHE is the enhance stage's responsibility (05-08), not segment's
- Returned `iris_circle` is `(cx, cy, r)` floats (not ints) so 05-07 normalize can do sub-pixel `cv2.remap` without rounding errors

## Test Coverage

10 tests in `vision-service/tests/test_segment.py`:

1. Three `ValueError("segment_invalid_detection")` paths (missing center, missing radius, both missing)
2. Structural shape/dtype/key assertions on a uniform image
3. D-F1 fallback path: `warnings` list receives `'hough_segment_failed_fallback_mediapipe'`, seed values returned
4. Silent fallback when `warnings=None` (no exception, no list mutation)
5. Pitfall 7: synthetic image with two circles; seed near circle 1 → winner must be circle 1, not `circles[0][0]`
6. Mask geometry invariant: max True-pixel distance from `iris_circle` center ≤ `r + 1`
7. Segmented image: all pixels outside `binary_mask` are zero
8. Metric test (skipped when fixture set + MediaPipe model not available — triple-gated)

**Verification:**

```
pytest tests/test_segment.py -v     → 9 passed, 1 skipped
pytest tests/ -x -q                 → 19 passed, 1 skipped (no regressions)
python -m scripts.audit_vocabulary  → OK: vocabulário proibido ausente
```

## Deviations from Plan

None of substance. The keyword-only `warnings: list[str] | None = None` parameter is exactly the extended signature documented in the plan's `<interfaces>` block — implemented verbatim.

## Issues Encountered

The executor agent paused on permission request before committing this SUMMARY.md (the Bash tool requires user approval for `git commit` outside the configured allowlist). Tasks 1+2 were committed successfully; the orchestrator finalized this metadata commit after the agent returned.

## Next Phase Readiness

Stage 2 is ready for downstream consumption:

- **05-06 compose:** can call `iris_mask(...)["segmented_image"]` for photometric averaging across angles
- **05-07 normalize:** can call `iris_mask(...)["iris_circle"]` as the outer ring for the Daugman polar transform
- **05-09 features:** can call `iris_mask(...)["binary_mask"]` to gate downstream feature extraction to iris-pixels only
- **HOUGH_DEFAULTS:** importable as `from pipeline.segment import HOUGH_DEFAULTS` for any tuning UI or audit script

## Threat Model Coverage

| Threat | Status |
|--------|--------|
| Pitfall 7 (naive `circles[0][0]` selection ignoring detect estimate) | Mitigated — `np.argmin(dists)` closest-to-seed selector |
| D-F1 hard-fail when Hough returns nothing | Mitigated — soft-degradation fallback with warnings sink |
| Specular highlights confuse Hough | Mitigated — `medianBlur(gray, 5)` pre-processing |
| Float vs int rounding in downstream stages | Mitigated — `iris_circle` returned as floats |

## Public API Surface

```python
# vision-service/pipeline/segment.py
HOUGH_DEFAULTS: dict[str, int | float] = {
    "dp": 1.0,
    "minDist": 100,
    "param1": 100,
    "param2": 40,
    "minRadius": 80,
    "maxRadius": 200,
}

def iris_mask(
    image: np.ndarray,
    detection: dict,
    *,
    warnings: list[str] | None = None,
) -> dict:
    """
    Returns:
        {
            "binary_mask": np.ndarray,       # (H, W) bool
            "iris_circle": tuple[float, ...], # (cx, cy, r)
            "segmented_image": np.ndarray,   # (H, W, 3) uint8
        }

    Raises:
        ValueError("segment_invalid_detection") when center/radius missing.

    Side effects (when warnings is not None):
        appends "hough_segment_failed_fallback_mediapipe" if Hough returns None.
    """
```

## Known Stubs

None. `iris_mask` is fully implemented; the prior `raise NotImplementedError` line was removed.

---

*Phase: 05-pipeline-visao-modal*
*Completed: 2026-05-04*
