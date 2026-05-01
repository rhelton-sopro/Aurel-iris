---
plan: 03-05
phase: 03-captura-mobile-pwa
subsystem: capture-quality-pipeline
tags: [mediapipe, quality-scoring, iris-detection, tdd, pwa, lazy-loading]
depends_on: [03-04]
provides: [lib/capture/quality-scoring, useIrisDetector, useStableQualityGate, QualityIndicator, LiveFeedbackMessage]
affects: [capture-client, lib/capture, hooks/use-quality-score, hooks/use-iris-detector, components/capture]
tech_stack:
  added:
    - "@mediapipe/tasks-vision@0.10.35"
  patterns:
    - "TDD RED-GREEN for pure libs and hooks"
    - "next/dynamic({ ssr: false }) for MediaPipe lazy-loading"
    - "requestVideoFrameCallback with rAF fallback"
    - "setInterval polling 50ms for stability gate"
key_files:
  created:
    - apps/web/lib/capture/iris-geometry.ts
    - apps/web/lib/capture/laplacian-variance.ts
    - apps/web/lib/capture/exposure.ts
    - apps/web/lib/capture/quality-scoring.ts
    - apps/web/lib/capture/quality-scoring.test.ts
    - apps/web/lib/capture/laplacian-variance.test.ts
    - apps/web/lib/capture/exposure.test.ts
    - apps/web/hooks/use-iris-detector.ts
    - apps/web/hooks/use-quality-score.ts
    - apps/web/hooks/use-quality-score.test.ts
    - apps/web/components/capture/IrisDetector.tsx
    - apps/web/components/capture/QualityIndicator.tsx
    - apps/web/components/capture/LiveFeedbackMessage.tsx
    - apps/web/components/ui/progress.tsx
    - apps/web/public/mediapipe/face_landmarker.task
    - apps/web/public/mediapipe/wasm/vision_wasm_internal.js
    - apps/web/public/mediapipe/wasm/vision_wasm_internal.wasm
    - apps/web/public/mediapipe/wasm/vision_wasm_nosimd_internal.js
    - apps/web/public/mediapipe/wasm/vision_wasm_nosimd_internal.wasm
  modified:
    - apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx
    - apps/web/app/actions/readings.ts
    - apps/web/tests/setup.ts
    - apps/web/eslint.config.mjs
    - apps/web/package.json
    - pnpm-lock.yaml
decisions:
  - "MediaPipe assets hosted same-origin (public/mediapipe/) per T-03-05-02 mitigation"
  - "IrisDetector.tsx as thin wrapper with default export enables next/dynamic ssr:false code-split"
  - "useStableQualityGate uses setInterval(tick, 50ms) polling — avoids dependency on requestAnimationFrame in test environment"
  - "Fake timers must include 'performance' for elapsed-time tests to work with vi.useFakeTimers"
metrics:
  duration: "13 minutes"
  completed: "2026-05-01"
  tasks_completed: 3
  files_created: 19
  files_modified: 6
  tests_added: 48
---

# Phase 03 Plan 05: MediaPipe Core — Quality Scoring Pipeline Summary

MediaPipe FaceLandmarker integrated with 7 sub-score quality pipeline, 4-level visual indicator, and 400ms auto-capture gate — all lazy-loaded and same-origin hosted.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for lib/capture | 958fed8 | quality-scoring.test.ts, laplacian-variance.test.ts, exposure.test.ts, tests/setup.ts |
| 1 (GREEN) | lib/capture pure libs | b081f53 | iris-geometry.ts, laplacian-variance.ts, exposure.ts, quality-scoring.ts |
| 2 (RED) | Failing tests for useStableQualityGate | 8bb4d6c | hooks/use-quality-score.test.ts |
| 2 (GREEN) | MediaPipe hooks + IrisDetector wrapper | 3f17e3f | use-iris-detector.ts, use-quality-score.ts, IrisDetector.tsx, package.json |
| 2 (assets) | MediaPipe public assets | 1f533d7 | public/mediapipe/face_landmarker.task + wasm/* |
| 3 | UI + capture-client integration | 78f7da4 | QualityIndicator.tsx, LiveFeedbackMessage.tsx, progress.tsx, capture-client.tsx |

## MediaPipe Asset Sizes

| File | Size |
|------|------|
| face_landmarker.task | 3.58 MB (float16, from storage.googleapis.com) |
| vision_wasm_internal.wasm | 11.15 MB |
| vision_wasm_internal.js | 322 KB |
| vision_wasm_nosimd_internal.wasm | 10.48 MB |
| vision_wasm_nosimd_internal.js | 322 KB |

@mediapipe/tasks-vision version: **0.10.35**

## Test Results

| Test File | Tests | Status |
|-----------|-------|--------|
| lib/capture/quality-scoring.test.ts | 26 | PASS |
| lib/capture/laplacian-variance.test.ts | 7 | PASS |
| lib/capture/exposure.test.ts | 8 | PASS |
| hooks/use-quality-score.test.ts | 7 | PASS |
| **Total lib/capture + hooks** | **48** | **ALL PASS** |
| Full suite | 71 | ALL PASS |

## Bundle Audit

MediaPipe (tasks-vision / face_landmarker) appears ONLY in dynamic numbered chunks:
- `.next/static/chunks/29.3321489450984869.js`
- `.next/static/chunks/879.b35e51935695dadc.js`

NOT present in:
- `main-app-*.js` (shared app shell)
- Any `app-(dashboard)` chunks
- Any pages or shared chunks

T-03-05-01 threat mitigated: lazy-loading via `next/dynamic({ ssr: false })` is working.

## UAT Status

Task 4 is a `checkpoint:human-verify` (blocking). UAT on physical devices has NOT yet been performed.

### Awaiting UAT:
- iPhone real: camera opens, quality bar reacts to iris distance/focus, messages change in pt-BR
- Android real: same smoke test
- Console check: after ~400ms stable "Boa", `[capture-client] auto-trigger ready...` appears
- Lighthouse mobile: Performance >= 75

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ImageData not in jsdom**
- **Found during:** Task 1 GREEN verification
- **Issue:** jsdom does not implement `ImageData` constructor; tests for `computeQualityCheck` threw `ReferenceError: ImageData is not defined`
- **Fix:** Added `ImageData` mock class to `tests/setup.ts`
- **Files modified:** apps/web/tests/setup.ts

**2. [Rule 3 - Blocking] Lint errors from WASM bundles in public/mediapipe/**
- **Found during:** Task 2 verification (pnpm run lint)
- **Issue:** ESLint was linting `vision_wasm_internal.js` (485 problems — require() imports, this-alias, react-hooks violations in Emscripten-generated code)
- **Fix:** Added `"public/mediapipe/**"` to `ignores` in `eslint.config.mjs`
- **Files modified:** apps/web/eslint.config.mjs

**3. [Rule 1 - Bug] Pre-existing TypeScript type error in readings.ts**
- **Found during:** Task 3 build verification
- **Issue:** `ReadingFormState` and `DraftReading` were used in function signatures of `readings.ts` but only re-exported (not imported locally). TypeScript cannot use re-exported types for local type annotations in `'use server'` files.
- **Fix:** Added `type ReadingFormState, type DraftReading` to the import statement from `./readings.schemas`
- **Files modified:** apps/web/app/actions/readings.ts

**4. [Rule 1 - Bug] Test assertions wrong for dominantFailure boundary conditions**
- **Found during:** Task 1 GREEN phase
- **Issue:** Tests expected `dominantFailure` to return 'centeredness' and 'sharpness' when score was actually >= 0.75 (returns 'good' not the specific failure). The boundary condition requires score < 0.75 for `dominantFailure` to inspect individual signals.
- **Fix:** Adjusted test inputs to ensure `overallScore < 0.75` while keeping the target failure signal dominant (added second low sub-score to push score below threshold)
- **Files modified:** apps/web/lib/capture/quality-scoring.test.ts

**5. [Rule 3 - Blocking] vi.useFakeTimers() does not fake performance.now() by default**
- **Found during:** Task 2 GREEN phase
- **Issue:** `useStableQualityGate` uses `performance.now()` for elapsed time. With default `vi.useFakeTimers()`, `performance.now()` was not advancing, causing gate tests to always get 0ms elapsed.
- **Fix:** Changed to `vi.useFakeTimers({ toFake: ['performance', 'Date', 'setTimeout', 'setInterval', 'clearInterval'] })`
- **Files modified:** apps/web/hooks/use-quality-score.test.ts

## TDD Gate Compliance

RED commits present: 958fed8 (Task 1), 8bb4d6c (Task 2)
GREEN commits present: b081f53 (Task 1), 3f17e3f (Task 2)
TDD gates satisfied for Tasks 1 and 2.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Auto-trigger console.log | capture-client.tsx:98 | Real capture (Canvas.toBlob + upload) deferred to 03-07 |
| `currentEye = 'right'` fixed | capture-client.tsx:45 | Sequence state machine deferred to 03-06 |
| Debug `readingId.slice(0,8)` div | capture-client.tsx:116-120 | Dev-only; will be removed when 03-06 adds state machine |

## Self-Check: PASSED

All 9 key files exist and all 6 commits are present in git log.

| Check | Result |
|-------|--------|
| iris-geometry.ts | FOUND |
| quality-scoring.ts | FOUND |
| use-iris-detector.ts | FOUND |
| use-quality-score.ts | FOUND |
| IrisDetector.tsx | FOUND |
| QualityIndicator.tsx | FOUND |
| LiveFeedbackMessage.tsx | FOUND |
| face_landmarker.task | FOUND |
| vision_wasm_internal.wasm | FOUND |
| commit 958fed8 (RED 1) | FOUND |
| commit b081f53 (GREEN 1) | FOUND |
| commit 8bb4d6c (RED 2) | FOUND |
| commit 3f17e3f (GREEN 2) | FOUND |
| commit 1f533d7 (assets) | FOUND |
| commit 78f7da4 (Task 3) | FOUND |
