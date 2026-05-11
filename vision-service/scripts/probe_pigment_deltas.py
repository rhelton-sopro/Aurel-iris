#!/usr/bin/env python3
"""probe_pigment_deltas.py — Phase 7.2 (Wave C) instrumentation probe.

Runs the full local pipeline (detect -> segment -> compose -> normalize -> enhance)
against a stored reading, then dumps per-sector LAB deltas regardless of pass/fail
threshold so the founder can compare real-photo signal against the current
detect_sectoral_pigments thresholds (DELTA_B_LEVE_MIN=12, etc).

Throwaway dev tool — not deployed to Modal, not committed as production code.

Usage (from D:/Projetos/Iridologista):
    python vision-service/scripts/probe_pigment_deltas.py [reading_id]

Defaults to Nailli reading: 71a7bf1d-747f-4de8-9129-13b69197c6a4

Outputs:
    vision-service/scripts/output/<reading_id>_<eye>_enhanced_polar.png  (visual)
    Stdout: 12-row table per eye with dL/dA/dB + would-classify-as flags
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from io import BytesIO
from itertools import combinations
from pathlib import Path
from urllib.request import urlopen

import cv2
import numpy as np
from PIL import Image as PILImage

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))

NAILLI_READING_ID = "71a7bf1d-747f-4de8-9129-13b69197c6a4"
SIGNED_URL_TTL = 600


def load_env_from_apps_web() -> None:
    env_path = ROOT.parent / "apps" / "web" / ".env.local"
    if not env_path.is_file():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def ensure_model() -> None:
    model_path = ROOT / "models" / "face_landmarker.task"
    if not model_path.is_file():
        print(f"face_landmarker.task missing at {model_path}", file=sys.stderr)
        sys.exit(2)
    os.environ.setdefault("MEDIAPIPE_FACE_LANDMARKER_PATH", str(model_path))


def load_image_from_url(url: str) -> np.ndarray:
    response = urlopen(url, timeout=30)
    pil = PILImage.open(BytesIO(response.read())).convert("RGB")
    return np.array(pil)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Probe vision pipeline locally (Phase 07.1.5 instrumentation).",
    )
    parser.add_argument(
        "reading_id",
        nargs="?",
        default=NAILLI_READING_ID,
        help=f"reading_id (uuid); defaults to Nailli {NAILLI_READING_ID}",
    )
    parser.add_argument(
        "--dump-detect-table",
        action="store_true",
        help=(
            "Phase 07.1.5 D-08: emit per-eye segment convergence table "
            "(centers, radii, max spread, CV, PASS/FAIL gates)."
        ),
    )
    parser.add_argument(
        "--dump-json",
        type=str,
        default=None,
        help=(
            "Phase 07.1.5 BLOCKER-2 / P2 SC-2 gate: write a JSON snapshot of "
            "per-eye per-angle segment_center + segment_radius to this path. "
            "Consumed by P2 Task 3's programmatic SC-2 gate."
        ),
    )
    args = parser.parse_args()
    reading_id = args.reading_id

    load_env_from_apps_web()
    ensure_model()

    supa_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get(
        "SUPABASE_URL"
    )
    supa_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supa_url or not supa_key:
        print(
            "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
            file=sys.stderr,
        )
        sys.exit(2)
    if not supa_key.startswith("eyJ"):
        print("SUPABASE_SERVICE_ROLE_KEY appears malformed (no eyJ prefix)", file=sys.stderr)
        sys.exit(2)

    from supabase import create_client

    supa = create_client(supa_url, supa_key)

    rows_resp = (
        supa.table("reading_images")
        .select("eye, angle, storage_path")
        .eq("reading_id", reading_id)
        .execute()
    )
    rows = rows_resp.data or []
    if not rows:
        print(f"No images for reading {reading_id}", file=sys.stderr)
        sys.exit(1)

    paths = [r["storage_path"] for r in rows]
    signed_resp = supa.storage.from_("iris-captures").create_signed_urls(
        paths, SIGNED_URL_TTL
    )
    url_by_path = {s["path"]: s["signedURL"] for s in signed_resp}

    out_dir = HERE / "output"
    out_dir.mkdir(exist_ok=True)

    from pipeline import compose, detect, enhance, normalize, segment
    from pipeline.sectoral_pigments import (
        CILIARY_RING_BOTTOM_FRAC,
        CILIARY_RING_TOP_FRAC,
        DELTA_B_DENSO_MIN,
        DELTA_B_LEVE_MIN,
        DELTA_B_MODERADO_MIN,
        SECTOR_COUNT,
    )

    print(f"\n=== Probe pigment deltas for reading {reading_id} ===\n")
    print(
        f"Thresholds: DELTA_B_LEVE_MIN={DELTA_B_LEVE_MIN}, "
        f"MODERADO={DELTA_B_MODERADO_MIN}, DENSO={DELTA_B_DENSO_MIN}"
    )
    print(
        f"Ciliary ring rows: {CILIARY_RING_TOP_FRAC:.2f}..{CILIARY_RING_BOTTOM_FRAC:.2f}"
    )
    print(f"Sectors: {SECTOR_COUNT} (hour 1..12)\n")

    # Phase 07.1.5 BLOCKER-2: accumulate per-eye per-angle segment circles
    # for the JSON snapshot consumed by P2 Task 3's programmatic SC-2 gate.
    detect_dump: dict = {}

    for eye in ("right", "left"):
        eye_rows = [r for r in rows if r["eye"] == eye]
        if not eye_rows:
            continue

        warnings: list[str] = []
        detected = []
        for r in eye_rows:
            url = url_by_path.get(r["storage_path"])
            if not url:
                print(f"  WARN: missing signed URL for {r['storage_path']}", file=sys.stderr)
                continue
            try:
                img = load_image_from_url(url)
                det = detect.find_iris(img)
                detected.append({"angle": r["angle"], "image": img, "detection": det})
            except Exception as exc:
                print(
                    f"  WARN: detect failed {eye}/{r['angle']}: {type(exc).__name__}: {exc}",
                    file=sys.stderr,
                )

        if not detected:
            print(f"\n--- {eye.upper()} eye: detect failed on all angles; skipping")
            continue

        segmented = []
        for d in detected:
            try:
                seg = segment.iris_mask(d["image"], d["detection"], warnings=warnings)
                seg["angle"] = d["angle"]
                segmented.append(seg)
            except Exception as exc:
                print(
                    f"  WARN: segment failed {eye}/{d['angle']}: {type(exc).__name__}: {exc}",
                    file=sys.stderr,
                )

        if not segmented:
            print(f"\n--- {eye.upper()} eye: segment failed on all angles; skipping")
            continue

        # Phase 07.1.5 BLOCKER-2: accumulate per-angle segment circles for JSON snapshot
        eye_dump: dict = {}
        for seg in segmented:
            cx, cy, r = seg["iris_circle"]
            eye_dump[seg["angle"]] = {
                "segment_center": [float(cx), float(cy)],
                "segment_radius": float(r),
            }
        detect_dump[eye] = eye_dump

        # Phase 07.1.5 D-08 --dump-detect-table: convergence table for P1 SUMMARY
        if args.dump_detect_table:
            circles = [seg["iris_circle"] for seg in segmented]
            centers = np.array([(c[0], c[1]) for c in circles], dtype=np.float64)
            radii = np.array([c[2] for c in circles], dtype=np.float64)
            pairs = list(combinations(range(len(circles)), 2))
            center_dists = [
                float(np.linalg.norm(centers[i] - centers[j]))
                for i, j in pairs
            ]
            max_center_spread = max(center_dists) if center_dists else 0.0
            r_mean = float(radii.mean()) if len(radii) else 0.0
            r_cv = float(radii.std() / r_mean) if r_mean > 0 else float("inf")
            center_gate_pass = max_center_spread <= 50.0
            radius_gate_pass = r_cv <= 0.15
            print(f"\n[probe] === {eye.upper()} segment convergence ===")
            for seg in segmented:
                cx, cy, r = seg["iris_circle"]
                print(
                    f"[probe]   {seg['angle']:<10} center=({cx:7.1f},{cy:7.1f}) "
                    f"radius={r:6.1f}"
                )
            print(
                f"[probe]   max center spread:  {max_center_spread:7.1f} px  "
                f"(gate: <=50 px)  {'PASS' if center_gate_pass else 'FAIL'}"
            )
            print(
                f"[probe]   radius CV:          {r_cv:7.3f}      "
                f"(gate: <=0.15) {'PASS' if radius_gate_pass else 'FAIL'}"
            )

        composite = compose.photometric_combine(segmented)
        normalized = normalize.daugman_polar(composite)
        enhanced = enhance.clahe(normalized)

        png_path = out_dir / f"{reading_id}_{eye}_enhanced_polar.png"
        cv2.imwrite(str(png_path), cv2.cvtColor(enhanced, cv2.COLOR_RGB2BGR))

        H, W = enhanced.shape[:2]
        sector_w = W // SECTOR_COUNT
        row_top = int(H * CILIARY_RING_TOP_FRAC)
        row_bottom = int(H * CILIARY_RING_BOTTOM_FRAC)
        lab = cv2.cvtColor(enhanced, cv2.COLOR_RGB2LAB).astype(np.float32)
        ciliary = lab[row_top:row_bottom]

        sector_means: list[np.ndarray] = []
        for i in range(SECTOR_COUNT):
            slab = ciliary[:, i * sector_w : (i + 1) * sector_w].reshape(-1, 3)
            if slab.size == 0:
                sector_means.append(np.array([0, 128, 128], dtype=np.float32))
            else:
                sector_means.append(slab.mean(axis=0))

        base = np.median(np.stack(sector_means, axis=0), axis=0)

        rel_png = png_path.relative_to(ROOT.parent) if png_path.is_relative_to(ROOT.parent) else png_path
        print(f"\n--- {eye.upper()} eye  (enhanced polar -> {rel_png})")
        print(
            f"    polar image: {H}x{W}, sector_w={sector_w}, "
            f"ciliary rows {row_top}..{row_bottom}"
        )
        print(
            f"    base LAB (median of 12 sectors): "
            f"L={base[0]:.1f} a={base[1]:.1f} b={base[2]:.1f}"
        )
        print()
        print(
            f"    {'hour':>4} | {'dL':>7} | {'dA':>7} | {'dB':>7} | "
            f"{'amarelo':>7} | {'laranja':>7} | {'marrom':>7}"
        )
        print(
            f"    {'-'*4} | {'-'*7} | {'-'*7} | {'-'*7} | "
            f"{'-'*7} | {'-'*7} | {'-'*7}"
        )
        for i, sm in enumerate(sector_means):
            dL, dA, dB = (sm - base).tolist()
            hour = i + 1
            am = "YES" if (dB > DELTA_B_LEVE_MIN and abs(dA) < 8) else ""
            la = "YES" if (dA > 8 and dB > 8) else ""
            ma = "YES" if (dL < -10 and dA > 5 and dB > 5) else ""
            print(
                f"    {hour:>4} | {dL:>+7.2f} | {dA:>+7.2f} | {dB:>+7.2f} | "
                f"{am:>7} | {la:>7} | {ma:>7}"
            )

    # Phase 07.1.5 BLOCKER-2: write JSON snapshot for P2 Task 3 SC-2 gate.
    if args.dump_json:
        out_path = Path(args.dump_json)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("w", encoding="utf-8") as f:
            json.dump(detect_dump, f, indent=2, sort_keys=True)
        print(f"\n[probe] wrote detect_diagnostics JSON snapshot -> {out_path}")


if __name__ == "__main__":
    main()
