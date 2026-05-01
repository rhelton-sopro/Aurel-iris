"""
Stage 1/6: Iris detection via MediaPipe Face Mesh.

Per SPEC §4.4 + §4.1: MediaPipe FaceLandmarker with iris landmark indices
468-477 (right eye) and 473-477 (left eye).

Status: skeleton.
"""


def find_iris(image):
    """
    Locate iris in a single eye image and return landmark coordinates.

    Args:
        image: numpy array (H, W, 3), BGR or RGB.

    Returns:
        dict with iris center (x, y), radius, and landmarks.

    Raises:
        NotImplementedError: Phase 5 implements this.
    """
    raise NotImplementedError("pipeline.detect.find_iris — implement in Phase 5")
