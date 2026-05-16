"""
SAM2-based iris/pupil segmentation — parallel comparison branch (Phase 7.4).

This is a DROP-IN alternative to ``pipeline.segment.iris_mask``: it returns
the exact same dict shape so ``compose.photometric_combine`` →
``normalize.daugman_polar`` → ``enhance.clahe`` → ``features.extract_all``
run BYTE-IDENTICAL. Only the geometry stage differs — that is the whole
point of the comparison harness (isolate "does correct segmentation change
the report?" from everything else).

Why SAM2 and not LightIrisNet: SAM2 is Apache-2.0 (license-clean for a
commercial product); LightIrisNet's repo has no license. SAM2 is also
zero-training (foundation model) — no corpus, no fine-tune, no domain-shift
gamble for a first comparison.

Contract (mirrors segment.iris_mask):
    iris_mask_sam(image_rgb, *, warnings=None) -> {
        "binary_mask":     (H, W) bool ndarray,
        "iris_circle":     (cx, cy, r) float tuple,
        "segmented_image": (H, W, 3) uint8 ndarray (zero outside iris),
        "pupil_circle":    (cx, cy, r) float tuple | None,   # NEW vs Hough path
    }

The pupil circle is a genuine improvement the Hough path never produced
reliably: ``features.classify_iris_color`` excludes the pupil disc from its
LAB k-means via ``pupil_circle``; feeding a real one is expected to fix the
castanho/hematogenea misclassification AT THE SOURCE (the diagnosed Nailli
error), independent of any prompt tuning.

⚠️ PROMPT STRATEGY IS THE ONE TUNABLE KNOB. SAM is promptable, not an
iris detector — it needs a hint. The capture pipeline delivers an
iris-roughly-centred frame, so the v1 strategy is: a central box prompt +
pick the mask that is (a) large, (b) centred, (c) roughly circular. This is
documented and DELIBERATELY simple; it must be validated on the founder's
real photos via the Modal deploy (Claude cannot run SAM here — no GPU,
installs blocked). Tuning lives in this one file.

Modal image additions required (founder's `modal deploy` bakes these — see
modal_app.py image definition):
    pip:  torch, torchvision, "git+https://github.com/facebookresearch/sam2.git"
    wget: a SAM2.1 checkpoint (Apache-2.0), e.g. sam2.1_hiera_small.pt, to
          /models/sam2.1_hiera_small.pt  + its config.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

# Lazy module-level singletons — cold-start cost paid once per Modal
# container (mirrors detect.get_landmarker()).
_sam_predictor = None

_DEFAULT_SAM_CKPT = "/models/sam2.1_hiera_small.pt"
_DEFAULT_SAM_CFG = "configs/sam2.1/sam2.1_hiera_s.yaml"

# Pupil = darkest central blob inside the segmented iris. Classical and
# cheap; far more reliable than asking SAM for the pupil, and it only runs
# on pixels SAM already confirmed are iris.
_PUPIL_DARK_PERCENTILE = 8.0   # darkest N% of iris-interior gray
_PUPIL_MIN_AREA_FRAC = 0.005   # of iris bbox area — reject specular dots


def _resolve_sam() :
    """Build the SAM2 image predictor once. Path overridable via env for
    local/CI; defaults to the Modal-baked checkpoint.

    Raises RuntimeError with an actionable message when weights are absent
    (same fail-loud contract as detect._resolve_model_path).
    """
    global _sam_predictor
    if _sam_predictor is not None:
        return _sam_predictor

    ckpt = os.environ.get("SAM2_CHECKPOINT_PATH", _DEFAULT_SAM_CKPT)
    cfg = os.environ.get("SAM2_CONFIG", _DEFAULT_SAM_CFG)
    if not Path(ckpt).is_file():
        raise RuntimeError(
            f"SAM2 checkpoint not found at {ckpt}. Set SAM2_CHECKPOINT_PATH "
            "for local dev, or bake it into the Modal image (modal_app.py "
            "run_commands wget). SAM2 is Apache-2.0."
        )

    import torch  # lazy: only inside the Modal image
    from sam2.build_sam import build_sam2
    from sam2.sam2_image_predictor import SAM2ImagePredictor

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = build_sam2(cfg, ckpt, device=device)
    _sam_predictor = SAM2ImagePredictor(model)
    return _sam_predictor


def _circularity(mask: np.ndarray) -> float:
    """4πA / P² — 1.0 = perfect circle, →0 as the contour gets ragged.
    Used to reject non-iris SAM masks (eyelid arcs, sclera wedges)."""
    cnts, _ = cv2.findContours(
        mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if not cnts:
        return 0.0
    c = max(cnts, key=cv2.contourArea)
    area = cv2.contourArea(c)
    peri = cv2.arcLength(c, True)
    if peri <= 0:
        return 0.0
    return float(4.0 * np.pi * area / (peri * peri))


def _fit_circle(mask: np.ndarray) -> tuple[float, float, float]:
    """Min-enclosing circle of the largest contour → (cx, cy, r)."""
    cnts, _ = cv2.findContours(
        mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    c = max(cnts, key=cv2.contourArea)
    (cx, cy), r = cv2.minEnclosingCircle(c)
    return float(cx), float(cy), float(r)


def _pick_iris_mask(masks: list[np.ndarray], H: int, W: int) -> Optional[np.ndarray]:
    """Among SAM candidate masks pick the iris: large, centred, round.

    Score = circularity × centredness × area-fraction-sweet-spot. The iris
    in an iridology capture fills a large central fraction of the frame and
    is the roundest large region; sclera/lid/skin score low on circularity
    or centredness.
    """
    if not masks:
        return None
    img_cx, img_cy = W / 2.0, H / 2.0
    frame_area = float(H * W)
    best, best_score = None, -1.0
    for m in masks:
        area = float(m.sum())
        if area <= 0:
            continue
        frac = area / frame_area
        # iris realistically occupies ~8%–70% of an iris-centred crop;
        # outside that band it's a speck or the whole eye/face.
        if frac < 0.05 or frac > 0.85:
            continue
        ys, xs = np.nonzero(m)
        cx, cy = xs.mean(), ys.mean()
        dist = np.hypot(cx - img_cx, cy - img_cy)
        centred = max(0.0, 1.0 - dist / (0.5 * min(H, W)))
        circ = _circularity(m)
        score = circ * (0.5 + 0.5 * centred) * min(1.0, frac / 0.35)
        if score > best_score:
            best, best_score = m, score
    return best


def _detect_pupil(
    image_rgb: np.ndarray, iris_mask: np.ndarray, iris_circle: tuple[float, float, float]
) -> Optional[tuple[float, float, float]]:
    """Darkest central blob inside the iris → pupil circle. None if not
    confidently found (downstream tolerates None — _build_pupil defaults)."""
    cx, cy, r = iris_circle
    gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
    interior = gray[iris_mask]
    if interior.size == 0:
        return None
    thresh = np.percentile(interior, _PUPIL_DARK_PERCENTILE)
    dark = ((gray <= thresh) & iris_mask).astype(np.uint8)
    num, labels, stats, centroids = cv2.connectedComponentsWithStats(dark, connectivity=8)
    if num <= 1:
        return None
    iris_bbox_area = np.pi * r * r
    # Largest dark component whose centroid is near the iris centre.
    best_idx, best_area = -1, 0
    for i in range(1, num):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < _PUPIL_MIN_AREA_FRAC * iris_bbox_area:
            continue
        pcx, pcy = centroids[i]
        if np.hypot(pcx - cx, pcy - cy) > 0.6 * r:  # pupil is central
            continue
        if area > best_area:
            best_idx, best_area = i, area
    if best_idx < 0:
        return None
    comp = (labels == best_idx).astype(np.uint8)
    pcx, pcy, pr = _fit_circle(comp)
    return (pcx, pcy, pr)


def iris_mask_sam(
    image_rgb: np.ndarray,
    *,
    warnings: Optional[list[str]] = None,
) -> dict:
    """SAM2 iris+pupil segmentation. Same return contract as
    segment.iris_mask, plus a real pupil_circle.

    On failure (no plausible iris mask) appends
    'sam_segment_failed_no_iris_mask' to ``warnings`` and raises
    ValueError('sam_segment_no_iris') — the orchestrator catches it for
    per-eye soft degradation exactly like the Hough path.
    """
    if image_rgb is None or image_rgb.ndim != 3 or image_rgb.shape[2] != 3:
        raise ValueError("sam_segment_invalid_image")

    H, W = image_rgb.shape[:2]
    predictor = _resolve_sam()

    # Central-box prompt: the capture is iris-roughly-centred, so a generous
    # central box reliably anchors SAM on the iris/eye region. SAM returns
    # multiple candidate masks; _pick_iris_mask selects the iris among them.
    import torch  # lazy

    bx0, by0 = int(W * 0.15), int(H * 0.15)
    bx1, by1 = int(W * 0.85), int(H * 0.85)
    box = np.array([bx0, by0, bx1, by1], dtype=np.float32)
    cpt = np.array([[W / 2.0, H / 2.0]], dtype=np.float32)
    clbl = np.array([1], dtype=np.int32)

    with torch.inference_mode():
        predictor.set_image(image_rgb)
        masks, scores, _ = predictor.predict(
            point_coords=cpt,
            point_labels=clbl,
            box=box,
            multimask_output=True,
        )

    cand = [m.astype(bool) for m in np.asarray(masks)]
    iris = _pick_iris_mask(cand, H, W)
    if iris is None:
        if warnings is not None:
            warnings.append("sam_segment_failed_no_iris_mask")
        raise ValueError("sam_segment_no_iris")

    cx, cy, r = _fit_circle(iris)
    pupil_circle = _detect_pupil(image_rgb, iris, (cx, cy, r))

    # segmented_image: zero outside the iris circle (match Hough path's
    # cv2.circle fill so downstream polar unwrap sees the same kind of input)
    mask_u8 = np.zeros((H, W), dtype=np.uint8)
    cv2.circle(mask_u8, (int(cx), int(cy)), int(r), 1, thickness=-1)
    binary_mask = mask_u8.astype(bool)
    segmented = cv2.bitwise_and(image_rgb, image_rgb, mask=mask_u8)

    print(
        f"[segment_sam] img={W}x{H} iris=({cx:.0f},{cy:.0f},r={r:.0f}) "
        f"pupil={'none' if pupil_circle is None else tuple(round(v) for v in pupil_circle)} "
        f"candidates={len(cand)}"
    )

    return {
        "binary_mask": binary_mask,
        "iris_circle": (cx, cy, r),
        "segmented_image": segmented,
        "pupil_circle": pupil_circle,
    }
