"""
Stage 6/6: Feature extraction.

Produces the per-eye block of the canonical features JSON (SPEC §4.3):
constitution, iris_color, fiber_density, collarette, pupil, sectors[],
rings, global_signs, image_quality.

MVP techniques (SPEC §4.4):
  - HSV clustering for iris_color.
  - OpenCV heuristics (adaptive threshold + morphology) for lacunas/criptas.
  - Constitutional palette comparison for constitution.

Status: skeleton.
"""


def extract_all(enhanced_image, composite_image):
    """
    Extract the full per-eye features block.

    Args:
        enhanced_image: output of pipeline.enhance.clahe.
        composite_image: output of pipeline.compose.photometric_combine
                         (kept for color analysis pre-CLAHE).

    Returns:
        Dict matching SPEC §4.3 per-eye shape:
          constitution, iris_color, fiber_density, collarette, pupil,
          sectors, rings, global_signs, image_quality.

    Raises:
        NotImplementedError: Phase 5 implements this.
    """
    raise NotImplementedError(
        "pipeline.features.extract_all — implement in Phase 5"
    )
