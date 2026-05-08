"""Stage 1 -- Iris detection via MediaPipe FaceLandmarker (Tasks API).

Source: RESEARCH.md Pattern 4. The Tasks API replaces legacy
`mp.solutions.face_mesh` (deprecated in mediapipe >= 0.10.x for server-side
static-image inference).

Iris landmark convention per face_landmarker.task (478-point output):
  LEFT_IRIS  = [468, 469, 470, 471, 472]
  RIGHT_IRIS = [473, 474, 475, 476, 477]

The "left/right" naming follows the SUBJECT's anatomical perspective. For a
subject-facing-camera photo, the LEFT_IRIS landmarks appear on the right
side of the image. The orchestrator (05-10) is responsible for selecting
the correct landmark subset based on the `eye` field of the input image
descriptor -- `find_iris` itself returns ALL landmarks in `landmarks_raw`
so callers can discriminate.
"""
from __future__ import annotations

import os
from pathlib import Path

import cv2  # noqa: F401  # imported for side-effect compatibility on some MP builds
import mediapipe as mp
import numpy as np

LEFT_IRIS = [468, 469, 470, 471, 472]
RIGHT_IRIS = [473, 474, 475, 476, 477]

_DEFAULT_MODAL_MODEL_PATH = "/models/face_landmarker.task"

_landmarker = None  # module-level cache; init via get_landmarker()


def _resolve_model_path() -> str:
    """Resolve face_landmarker.task path with env-var override.

    Order:
      1. $MEDIAPIPE_FACE_LANDMARKER_PATH (local dev / CI)
      2. /models/face_landmarker.task (Modal image build target -- Pitfall 2)
    """
    env = os.environ.get("MEDIAPIPE_FACE_LANDMARKER_PATH")
    if env and Path(env).is_file():
        return env
    if Path(_DEFAULT_MODAL_MODEL_PATH).is_file():
        return _DEFAULT_MODAL_MODEL_PATH
    raise RuntimeError(
        "face_landmarker.task not found. Set MEDIAPIPE_FACE_LANDMARKER_PATH "
        "for local dev, or ensure /models/face_landmarker.task is baked "
        "into the Modal image (see modal_app.py run_commands wget)."
    )


def get_landmarker() -> mp.tasks.vision.FaceLandmarker:
    """Lazy singleton init for the FaceLandmarker.

    Cached at module level so cold-start cost is paid once per Modal
    container (RESEARCH Pitfall 2).
    """
    BaseOptions = mp.tasks.BaseOptions
    FaceLandmarker = mp.tasks.vision.FaceLandmarker
    FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
    VisionRunningMode = mp.tasks.vision.RunningMode

    options = FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=_resolve_model_path()),
        running_mode=VisionRunningMode.IMAGE,
        num_faces=1,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
    )
    return FaceLandmarker.create_from_options(options)


def _hough_circle_fallback(image: np.ndarray) -> dict:
    """OpenCV Hough Circle fallback for close-up iris photos.

    Used when MediaPipe FaceLandmarker fails (close-ups too tight to show face
    context). Detects the iris as a dominant dark circle in the image — works
    on extreme close-ups where MediaPipe sees no face.

    Args:
        image: H x W x 3 RGB numpy array (uint8).

    Returns:
        Same dict shape as MediaPipe path: center / radius / landmarks_raw.
        landmarks_raw is empty list — downstream segment.py only uses
        center+radius, so this preserves the contract.

    Raises:
        ValueError("hough_no_circle_detected") -- caught by orchestrator.
    """
    h, w = image.shape[:2]

    # Resize down to max 1024px on long edge before Hough — 4K photos make
    # Hough Circle accumulator search prohibitively slow (~30s+ per call;
    # with 6 calls per pipeline run @ 120s function timeout we hit cancel).
    # Iris detection accuracy is fine at 1024px. Scale coordinates back up
    # to original image space at the end so segment.py downstream gets
    # coords matching its full-res input.
    HOUGH_MAX_DIM = 1024
    long_edge = max(h, w)
    if long_edge > HOUGH_MAX_DIM:
        scale = HOUGH_MAX_DIM / long_edge
        small_w = int(round(w * scale))
        small_h = int(round(h * scale))
        small = cv2.resize(image, (small_w, small_h), interpolation=cv2.INTER_AREA)
    else:
        scale = 1.0
        small = image

    sh, sw = small.shape[:2]
    small_min_dim = min(sh, sw)

    # Convert RGB → BGR → grayscale (cv2 expects BGR).
    bgr = cv2.cvtColor(small, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    # Median blur reduces noise without softening edges (better than Gaussian
    # for Hough — preserves the iris/sclera boundary).
    blurred = cv2.medianBlur(gray, 5)

    # Hough params tuned for IRIS specifically (not the whole eyeball/face contour):
    #   - Real iris in a close-up smartphone photo is typically 12-30% of the
    #     smaller dimension's RADIUS (= 24-60% of frame width). Anything larger
    #     is almost always the eyeball outline, eye socket, or face contour.
    #   - Previous (8-60%) range made Hough's "highest accumulator wins" pick
    #     the larger contours instead of the iris (their edges are stronger).
    #   - dp=1.5: accumulator resolution ratio (>=1 = lower res = faster)
    #   - minDist: only one iris expected → set to half image width
    #   - param1: Canny upper threshold
    #   - param2: accumulator threshold (lower = mais permissivo)
    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1.5,
        minDist=small_min_dim // 2,
        param1=80,
        param2=30,
        minRadius=int(small_min_dim * 0.12),
        maxRadius=int(small_min_dim * 0.30),
    )

    if circles is None or len(circles) == 0:
        raise ValueError("hough_no_circle_detected")

    # Pick the circle CLOSEST to the image center (most likely iris in a
    # well-framed close-up). Hough's default ordering by accumulator score
    # picks whatever has the strongest edge — for iris photos that can be
    # the sclera-eyelid border, not the iris-sclera border. Distance-to-
    # center is a better proxy for "this is the subject."
    img_cx, img_cy = sw / 2.0, sh / 2.0
    best = min(
        circles[0],
        key=lambda c: (c[0] - img_cx) ** 2 + (c[1] - img_cy) ** 2,
    )
    cx_small, cy_small, r_small = best

    # Scale coordinates back to original image space (segment.py expects the
    # input image at full resolution; coords must match).
    cx = cx_small / scale
    cy = cy_small / scale
    r = r_small / scale
    print(f"[detect] hough found circle on resized {sw}x{sh} (scale={scale:.3f}): center=({cx:.0f},{cy:.0f}) r={r:.0f}")

    return {
        "center": (float(cx), float(cy)),
        "radius": float(r),
        "landmarks_raw": [],  # Hough produces no landmarks — segment.py only uses center+radius
        "_detector": "hough",  # debug breadcrumb so downstream can log which path was used
    }


def find_iris(image: np.ndarray) -> dict:
    """Detect iris in a single eye image — hybrid strategy.

    Tries MediaPipe FaceLandmarker first (works when face context is visible).
    Falls back to OpenCV Hough Circle on close-up photos where MediaPipe sees
    no face. Phase 7 dogfooding revealed the capture VLM (Haiku) accepts iris
    ≥8% of frame, but face_landmarker.task needs face context — close-ups
    legitimate for iridology fail MediaPipe → Hough catches them.

    Args:
        image: H x W x 3 RGB numpy array (uint8). MediaPipe Tasks API expects RGB.

    Returns:
        dict with keys:
          center        -- (x, y) in pixel coordinates
          radius        -- float, pixel distance from center to a canonical iris edge landmark
          landmarks_raw -- list of {"x", "y", "z"} normalized coords for all 478 landmarks
                            (empty list when Hough fallback fired — downstream tolerates this)
          _detector     -- "mediapipe" | "hough" (debug breadcrumb)

    Raises:
        ValueError("iris_not_detected") -- BOTH MediaPipe AND Hough failed (caught by orchestrator).
    """
    global _landmarker
    if _landmarker is None:
        _landmarker = get_landmarker()

    h, w = image.shape[:2]
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image)
    result = _landmarker.detect(mp_image)

    # MediaPipe path — full landmarks (preferred when face is visible)
    if result.face_landmarks:
        landmarks = result.face_landmarks[0]  # first (only) face

        iris_pts = [landmarks[i] for i in LEFT_IRIS + RIGHT_IRIS]
        cx = sum(p.x for p in iris_pts) / len(iris_pts) * w
        cy = sum(p.y for p in iris_pts) / len(iris_pts) * h

        edge = landmarks[469]
        radius = float(((edge.x * w - cx) ** 2 + (edge.y * h - cy) ** 2) ** 0.5)

        return {
            "center": (float(cx), float(cy)),
            "radius": radius,
            "landmarks_raw": [
                {"x": float(p.x), "y": float(p.y), "z": float(p.z)} for p in landmarks
            ],
            "_detector": "mediapipe",
        }

    # Fallback path — Hough Circle for close-up iris photos
    print(f"[detect] mediapipe_no_face — falling back to Hough on {w}x{h} image")
    try:
        return _hough_circle_fallback(image)
    except ValueError:
        # Both detection strategies failed — propagate up to orchestrator soft-degradation
        raise ValueError("iris_not_detected")
