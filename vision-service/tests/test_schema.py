"""Schema round-trip + boundary tests for IrisFeatures (SPEC §4.3)."""
from __future__ import annotations

import copy

import pytest
from pydantic import ValidationError

from pipeline.schemas import (
    EyeFeatures,
    IrisFeatures,
    ProcessingMetadata,
)


def _canonical_eye() -> dict:
    return {
        "constitution": {
            "primary": "linfatica",
            "confidence": 0.78,
            "indicators": ["fibras_finas_radiais"],
        },
        "iris_color": {"primary": "azul", "secondary": None, "central_heterochromia": False},
        "fiber_density": {"score": 0.62, "interpretation": "media-densa"},
        "collarette": {"shape": "irregular", "diameter_ratio": 0.34, "decentralization": "leve_nasal"},
        "pupil": {"centralization": "centrada", "shape": "circular", "size_ratio": 0.18},
        "sectors": [
            {"hour": 1, "zones": ["cérebro frontal"], "findings": []},
            {
                "hour": 7,
                "zones": ["fígado", "vesícula"],
                "findings": [
                    {"type": "lacuna", "depth": "grau_2", "size_mm": 0.4},
                    {"type": "pigmentacao", "color": "amarelada", "extension": "pequena"},
                ],
            },
        ],
        "rings": {
            "nerve_rings": {"present": True, "count": 2, "intensity": "moderada"},
            "lymphatic_rosary": {"present": False},
            "sodium_ring": {"present": False},
            "senile_arc": {"present": False},
        },
        "global_signs": {
            "radii_solaris": [{"sector": 8, "extent": "media"}],
            "transversal_signs": [],
            "tofus": [],
        },
        "image_quality": {"composite_score": 0.83, "warnings": []},
    }


def _canonical_payload() -> dict:
    return {
        "right_eye": _canonical_eye(),
        "left_eye": None,  # D-F1 per-eye soft degradation
        "asymmetry_notes": ["lacuna_unilateral_setor_7_direito", "unilateral_analysis_only_right_eye"],
        "processing_metadata": {
            "model_version": "pipeline_0.1.0",
            "processing_time_ms": 4820,
            "modal_call_id": "fc-abc123",
            "stages_timing_ms": {"detect": 200, "segment": 400},
            "warnings": ["hough_segmentation_failed_left_backlight"],
            "error_summary": None,
        },
    }


def test_canonical_payload_round_trips():
    payload = _canonical_payload()
    validated = IrisFeatures.model_validate(payload)
    dumped = validated.model_dump()
    assert dumped["right_eye"]["constitution"]["primary"] == "linfatica"
    assert dumped["left_eye"] is None
    assert dumped["processing_metadata"]["modal_call_id"] == "fc-abc123"


def test_left_eye_none_accepted_d_f1():
    payload = _canonical_payload()
    payload["left_eye"] = None
    IrisFeatures.model_validate(payload)


def test_both_eyes_none_accepted_orchestrator_gates():
    payload = _canonical_payload()
    payload["right_eye"] = None
    payload["left_eye"] = None
    IrisFeatures.model_validate(payload)


def test_asymmetry_notes_empty_d_a2():
    payload = _canonical_payload()
    payload["asymmetry_notes"] = []
    IrisFeatures.model_validate(payload)


@pytest.mark.parametrize("bad_value", [-0.01, 1.01])
def test_constitution_confidence_boundary(bad_value):
    payload = _canonical_payload()
    payload["right_eye"]["constitution"]["confidence"] = bad_value
    with pytest.raises(ValidationError):
        IrisFeatures.model_validate(payload)


@pytest.mark.parametrize("bad_value", [-0.01, 1.01])
def test_image_quality_composite_score_boundary(bad_value):
    payload = _canonical_payload()
    payload["right_eye"]["image_quality"]["composite_score"] = bad_value
    with pytest.raises(ValidationError):
        IrisFeatures.model_validate(payload)


@pytest.mark.parametrize("bad_hour", [0, 13, -1, 100])
def test_sector_hour_boundary(bad_hour):
    payload = _canonical_payload()
    payload["right_eye"]["sectors"][0]["hour"] = bad_hour
    with pytest.raises(ValidationError):
        IrisFeatures.model_validate(payload)


def test_extra_fields_forbidden_at_top_level():
    payload = _canonical_payload()
    payload["unknown_field"] = "noise"
    with pytest.raises(ValidationError):
        IrisFeatures.model_validate(payload)


def test_extra_fields_forbidden_in_eye_block():
    payload = _canonical_payload()
    payload["right_eye"]["mystery"] = 1
    with pytest.raises(ValidationError):
        IrisFeatures.model_validate(payload)


def test_modal_call_id_required_d_t5():
    payload = _canonical_payload()
    del payload["processing_metadata"]["modal_call_id"]
    with pytest.raises(ValidationError):
        IrisFeatures.model_validate(payload)


def test_error_summary_optional_default_none():
    payload = _canonical_payload()
    del payload["processing_metadata"]["error_summary"]
    validated = IrisFeatures.model_validate(payload)
    assert validated.processing_metadata.error_summary is None


def test_stages_timing_ms_dict_accepted():
    payload = _canonical_payload()
    payload["processing_metadata"]["stages_timing_ms"] = {
        "detect": 200,
        "segment": 400,
        "compose": 100,
        "normalize": 50,
        "enhance": 30,
        "features": 600,
    }
    validated = IrisFeatures.model_validate(payload)
    assert validated.processing_metadata.stages_timing_ms["features"] == 600


def test_radii_solaris_sector_boundary():
    payload = _canonical_payload()
    payload["right_eye"]["global_signs"]["radii_solaris"][0]["sector"] = 13
    with pytest.raises(ValidationError):
        IrisFeatures.model_validate(payload)


def test_finding_size_mm_must_be_non_negative():
    payload = _canonical_payload()
    payload["right_eye"]["sectors"][1]["findings"][0]["size_mm"] = -0.1
    with pytest.raises(ValidationError):
        IrisFeatures.model_validate(payload)


def test_diameter_ratio_boundary():
    payload = _canonical_payload()
    payload["right_eye"]["collarette"]["diameter_ratio"] = 1.5
    with pytest.raises(ValidationError):
        IrisFeatures.model_validate(payload)


def test_processing_metadata_exposed_as_subobject():
    # The orchestrator should be able to construct ProcessingMetadata directly:
    ProcessingMetadata(
        model_version="pipeline_0.1.0",
        processing_time_ms=100,
        modal_call_id="fc-x",
    )


def test_eye_features_constructable_from_dict():
    EyeFeatures.model_validate(_canonical_eye())
