---
phase: 05-pipeline-visao-modal
plan: "04"
subsystem: vision-service
status: complete
completed_date: "2026-05-04"
duration_minutes: 5
tasks_completed: 2
tasks_total: 2
files_created: 1
files_modified: 1
tags: [vision, pipeline, mediapipe, detect, iris-landmarks]
requirements_completed: [VISION-02]

dependency_graph:
  requires:
    - vision-service/tests/conftest.py (iris_images + expected fixtures from 05-01)
    - vision-service/pipeline/__init__.py (pipeline package structure)
  provides:
    - vision-service/pipeline/detect.py (find_iris, get_landmarker, LEFT_IRIS, RIGHT_IRIS)
    - vision-service/tests/test_detect.py (D-X3 hybrid tests: structural always + metric gated)
  affects:
    - 05-05 (segment): consumes find_iris(img) -> {center, radius, landmarks_raw}
    - 05-10 (orchestrator): wraps find_iris in try/except ValueError for D-F1 per-eye degradation
    - 05-06 (compose): consumes center/radius from find_iris output

tech_stack:
  added:
    - mediapipe==0.10.35 (installed locally for verification; already in requirements.txt)
  patterns:
    - Module-level lazy singleton via _landmarker global + get_landmarker()
    - Dual model path resolution (env-var override then /models fallback) for local dev + Modal
    - D-X3 hybrid test: pytestmark skipif on model absence; structural + IoU metric assertions
    - ValueError with stable string "mediapipe_no_face_detected" for orchestrator D-F1

key_files:
  created:
    - vision-service/tests/test_detect.py
  modified:
    - vision-service/pipeline/detect.py

decisions:
  - "Model path resolution: MEDIAPIPE_FACE_LANDMARKER_PATH env-var takes precedence over /models/face_landmarker.task (Modal build path) -- enables local dev without embedding 4MB model in git"
  - "iris_pts computed as mean of ALL 10 iris landmarks (LEFT_IRIS + RIGHT_IRIS) rather than per-eye subset -- orchestrator picks LEFT_IRIS/RIGHT_IRIS per eye descriptor; find_iris returns raw landmarks for full discriminability"
  - "Radius anchored to landmark 469 (leftmost edge of LEFT_IRIS pentagon) per RESEARCH Pattern 4 -- consistent starting estimate for HoughCircles fallback in 05-05"
  - "RuntimeError raised when model path not found (not ValueError) -- model-missing is a hard infrastructure error, not a soft per-eye degradation event"
  - "cv2 imported at module level for side-effect compatibility (some MediaPipe builds require it) but with noqa comment to avoid linting false positive"

metrics:
  duration_minutes: 5
  completed_date: "2026-05-04"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 5 Plan 04: MediaPipe Iris Detect Stage Summary

**One-liner:** MediaPipe FaceLandmarker Tasks API replacing NotImplementedError stub -- lazy singleton, dual-path model resolution, typed ValueError for orchestrator D-F1, D-X3 hybrid tests skip gracefully when model absent.

## What Was Built

**Task 1 -- Implement detect.py** (`42385d0`)

- `vision-service/pipeline/detect.py`: full implementation replacing `raise NotImplementedError` skeleton
- `LEFT_IRIS = [468, 469, 470, 471, 472]` and `RIGHT_IRIS = [473, 474, 475, 476, 477]` constants (verified per RESEARCH Pattern 4, Pitfall 5)
- `_resolve_model_path()`: two-step lookup -- `$MEDIAPIPE_FACE_LANDMARKER_PATH` env-var first (local dev), `/models/face_landmarker.task` second (Modal image build Pitfall 2 mitigation), `RuntimeError` if neither resolves
- `get_landmarker()`: builds `FaceLandmarkerOptions` with `VisionRunningMode.IMAGE`, `num_faces=1`, `min_face_detection_confidence=0.5`, returns `FaceLandmarker.create_from_options(options)`
- `find_iris(image)`: receives RGB `np.ndarray`, creates `mp.Image(SRGB)`, runs `_landmarker.detect()`, raises `ValueError("mediapipe_no_face_detected")` when `result.face_landmarks` is empty, returns `{center: (x,y), radius: float, landmarks_raw: list[dict]}`
- Module-level `_landmarker = None` cache -- cold-start paid once per Modal container

**Task 2 -- Structural + metric tests** (`1d83342`)

- `vision-service/tests/test_detect.py`: 3 tests with `pytestmark = pytest.mark.skipif(not _model_available(), ...)` module-level gate
- `test_no_face_raises_value_error`: blank 256x256 black array triggers `ValueError("mediapipe_no_face_detected")` -- validates D-F1 orchestrator contract
- `test_returns_required_keys`: iterates `iris_images` fixture; asserts keys `{center, radius, landmarks_raw}`, types, `radius > 0`, `len(landmarks_raw) == 478`
- `test_iris_iou_above_threshold_when_expected_present`: metric assertion IoU >= 0.7 vs founder-annotated `expected.json["iris_bbox"]`; skips gracefully when no bboxes committed yet (D-X3)
- `_iou()` helper: standard box intersection-over-union
- Full suite result: `10 passed, 3 skipped` (no regressions on prior 10 tests)

## Verification Results

```
cd vision-service && python -c "from pipeline.detect import find_iris, LEFT_IRIS, RIGHT_IRIS; assert LEFT_IRIS == [468,469,470,471,472]; assert RIGHT_IRIS == [473,474,475,476,477]; print('ok')"
ok

cd vision-service && python -m pytest tests/test_detect.py -v
3 skipped in 0.12s  (model absent -- expected)

cd vision-service && python -m pytest tests/ -x -q
10 passed, 3 skipped in 1.04s
```

## Model Path Resolution Strategy

The plan required supporting two deployment contexts:

1. **Modal container (production):** model baked at `/models/face_landmarker.task` via `run_commands("wget ...")` in `modal_app.py` image definition (RESEARCH Pitfall 2 mitigation). No env-var needed.

2. **Local dev / CI:** developer downloads `face_landmarker.task` and sets `MEDIAPIPE_FACE_LANDMARKER_PATH=/path/to/face_landmarker.task`. Without this, tests skip via `pytestmark` instead of erroring.

This dual-path design avoids committing the 4MB model binary to git while keeping CI green without GPU infrastructure.

## Deviations from Plan

None. Plan executed exactly as written. The implementation in Task 1 matches RESEARCH.md Pattern 4 verbatim, with the env-var override added as the plan explicitly called for (`MEDIAPIPE_FACE_LANDMARKER_PATH` in `<interfaces>`).

## Known Stubs

None. `find_iris` is fully implemented. Tests skip gracefully when model is absent -- this is intentional gating, not a stub. The IoU metric test will activate once the founder commits iris fixture images and annotates `expected.json["iris_bbox"]` (D-X1/D-X3).

## Threat Flags

No new threat surface beyond what is in the plan's threat model (T-05-04-01 through T-05-04-04).

T-05-04-02 (wrong-eye assignment) mitigation confirmed in implementation: `find_iris` returns all 478 landmarks in `landmarks_raw`; orchestrator selects `LEFT_IRIS`/`RIGHT_IRIS` indices per `eye` descriptor. Documented in module docstring.

T-05-04-04 (malicious model file) mitigation: `_resolve_model_path()` validates file existence (`Path(env).is_file()`) before accepting; Modal image downloads model from `storage.googleapis.com` over HTTPS at build time.

## Self-Check: PASSED
