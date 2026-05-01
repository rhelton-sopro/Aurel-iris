"""
Stage 3/6: Photometric composition.

Combines 3 angles per eye (frontal, lateral, backlight) into a single
information-rich representation.

Status: skeleton.
"""


def photometric_combine(segmented_images):
    """
    Combine multiple segmented eye images into a composite.

    Args:
        segmented_images: list of dicts from pipeline.segment.iris_mask
                          (one per angle: frontal, lateral, backlight).

    Returns:
        Composite image enhanced for downstream feature extraction.

    Raises:
        NotImplementedError: Phase 5 implements this.
    """
    raise NotImplementedError(
        "pipeline.compose.photometric_combine — implement in Phase 5"
    )
