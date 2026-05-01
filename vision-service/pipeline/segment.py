"""
Stage 2/6: Iris segmentation.

MVP baseline (SPEC §4.4): Hough Transform circular via OpenCV.
v1.1 upgrade: U-Net pre-trained on CASIA-Iris.

Status: skeleton.
"""


def iris_mask(image, detection):
    """
    Compute a binary mask isolating the iris region.

    Args:
        image: numpy array (H, W, 3).
        detection: dict from pipeline.detect.find_iris.

    Returns:
        dict with binary_mask (H, W, bool) and segmented_image.

    Raises:
        NotImplementedError: Phase 5 implements this.
    """
    raise NotImplementedError("pipeline.segment.iris_mask — implement in Phase 5")
