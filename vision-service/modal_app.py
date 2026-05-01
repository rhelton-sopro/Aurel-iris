"""
Modal app for the Aurel Iris vision pipeline.

Status: SKELETON ONLY — Phase 1 (Setup).
Real pipeline implementation lands in Phase 5 (Pipeline de visão / Modal).

Contract per SPEC §4.2:
  analyze_iris(reading_id: str, image_urls: list[dict]) -> dict
    image_urls: [{"eye": "right" | "left", "angle": "frontal" | "lateral" | "backlight", "url": str}]

Pipeline stages (SPEC §4.2): detect -> segment -> compose -> normalize -> enhance -> features.
"""

import modal

app = modal.App("aurel-iris-vision")

image = modal.Image.debian_slim().pip_install(
    "opencv-python-headless",
    "numpy",
    "scikit-image",
    "mediapipe",
    "torch",
    "torchvision",
    "Pillow",
    "supabase",
)


@app.function(image=image, gpu="T4", timeout=120)
def analyze_iris(reading_id: str, image_urls: list[dict]) -> dict:
    """
    Analyze iris images and return the canonical features JSON (SPEC §4.3).

    Args:
        reading_id: UUID of the reading row in Supabase (readings.id).
        image_urls: List of {"eye", "angle", "url"} dicts, up to 6 entries.

    Returns:
        Canonical features JSON per SPEC §4.3 with right_eye, left_eye,
        asymmetry_notes, processing_metadata.

    Raises:
        NotImplementedError: This is a Phase 1 skeleton. Real implementation
                             lands in Phase 5.
    """
    # Import side-effect: validates that the pipeline package is structured
    # correctly. Phase 5 will replace this with real orchestration.
    from pipeline import detect, segment, compose, normalize, enhance, features  # noqa: F401

    raise NotImplementedError(
        "analyze_iris is a Phase 1 skeleton. "
        "Real pipeline implementation will be added in Phase 5 "
        "(see .planning/ROADMAP.md Fase 5: Pipeline de visão / Modal)."
    )


if __name__ == "__main__":
    # Local sanity check (does NOT run Modal; just validates imports).
    print("Aurel Iris vision-service skeleton loaded.")
    print(f"App name: {app.name}")
