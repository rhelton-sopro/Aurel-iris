"""
Stage 4/6: Polar normalization (Daugman rubber sheet).

Converts the iris (donut shape) into a rectangular polar representation
standard in iridology and biometric pipelines.

Status: skeleton.
"""


def daugman_polar(composite_image):
    """
    Apply Daugman's rubber-sheet model to map the iris ring to a rectangle.

    Args:
        composite_image: output of pipeline.compose.photometric_combine.

    Returns:
        Rectangular polar image of the iris.

    Raises:
        NotImplementedError: Phase 5 implements this.
    """
    raise NotImplementedError(
        "pipeline.normalize.daugman_polar — implement in Phase 5"
    )
