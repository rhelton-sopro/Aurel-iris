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


def find_iris(image: np.ndarray) -> dict:
    """Detect iris in a single eye image.

    Args:
        image: H x W x 3 RGB numpy array (uint8). MediaPipe Tasks API expects RGB.

    Returns:
        dict with keys:
          center        -- (x, y) in pixel coordinates
          radius        -- float, pixel distance from center to a canonical iris edge landmark
          landmarks_raw -- list of {"x", "y", "z"} normalized coords for all 478 landmarks

    Raises:
        ValueError("mediapipe_no_face_detected") -- caught by orchestrator (D-F1 soft degradation).
    """
    global _landmarker
    if _landmarker is None:
        _landmarker = get_landmarker()

    h, w = image.shape[:2]
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image)
    result = _landmarker.detect(mp_image)

    if not result.face_landmarks:
        raise ValueError("mediapipe_no_face_detected")

    landmarks = result.face_landmarks[0]  # first (only) face

    # Compute iris center as the mean of both iris-landmark sets. The eye
    # the image actually represents is communicated by the orchestrator
    # via the `eye` field of the input descriptor; here we return raw
    # landmarks so callers can pick LEFT_IRIS / RIGHT_IRIS as needed.
    iris_pts = [landmarks[i] for i in LEFT_IRIS + RIGHT_IRIS]
    cx = sum(p.x for p in iris_pts) / len(iris_pts) * w
    cy = sum(p.y for p in iris_pts) / len(iris_pts) * h

    # Iris radius from center to a canonical edge landmark (469 -- left side
    # of LEFT_IRIS pentagon). Used as a starting estimate for Hough fallback.
    edge = landmarks[469]
    radius = float(((edge.x * w - cx) ** 2 + (edge.y * h - cy) ** 2) ** 0.5)

    return {
        "center": (float(cx), float(cy)),
        "radius": radius,
        "landmarks_raw": [
            {"x": float(p.x), "y": float(p.y), "z": float(p.z)} for p in landmarks
        ],
    }
