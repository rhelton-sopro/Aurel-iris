"""Canonical pipeline output schema (SPEC §4.3).

This module is the single source of truth for the JSON contract between the
Modal pipeline (`analyze_iris`) and the Next.js webhook handler. Any change
here must be matched in `apps/web/app/api/vision/webhook/route.ts` Zod
validation and bumped via `processing_metadata.model_version` (D-PM1).

Decisions encoded:
  - D-F1: right_eye / left_eye are Optional. Soft degradation per eye is
    legal; both-None is the orchestrator's hard-fail signal (it must set
    status='failed' and skip model_validate, or pass an EyeFeatures-less
    payload only if the orchestrator first posts the failed webhook).
  - D-PM1: processing_metadata fields enumerated below.
  - D-A1, D-A2: asymmetry_notes is list[str], empty list is valid.
  - D-T5: modal_call_id is required (str).

Constitution.primary canonical values (Jensen): "linfatica", "hematogenea",
"mista". Kept as str (not Enum) to allow pipeline experimentation without a
schema bump; see ConstitutionType for the canonical enumeration when
needed.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ConstitutionType(str, Enum):
    """Canonical Jensen constitution values (informational; not enforced).

    Expanded 2026-05-11 (PLAN 07.1-02 P0.2) to accommodate the Brazilian
    iridology school + mixed types diagnosed by founder during calibration
    sprint. Constitution.primary remains `str` (not Enum-enforced) so old
    payloads validate unchanged.
    """

    LINFATICA = "linfatica"
    HEMATOGENEA = "hematogenea"
    MISTA = "mista"
    # Added by PLAN 07.1-02:
    MISTA_BILIAR = "mista_biliar"
    MISTA_HEMATOGENEA = "mista_hematogenea"
    BILIAR = "biliar"
    NEUROGENICA = "neurogenica"


class Constitution(BaseModel):
    primary: str
    confidence: float = Field(ge=0.0, le=1.0)
    indicators: list[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class IrisColor(BaseModel):
    primary: str
    secondary: Optional[str] = None
    central_heterochromia: bool = False

    model_config = ConfigDict(extra="forbid")


class FiberDensity(BaseModel):
    score: float = Field(ge=0.0, le=1.0)
    interpretation: str

    model_config = ConfigDict(extra="forbid")


class Collarette(BaseModel):
    shape: str
    diameter_ratio: float = Field(ge=0.0, le=1.0)
    decentralization: str

    model_config = ConfigDict(extra="forbid")


class Pupil(BaseModel):
    centralization: str
    shape: str
    size_ratio: float = Field(ge=0.0, le=1.0)

    model_config = ConfigDict(extra="forbid")


class Finding(BaseModel):
    type: str  # "lacuna" | "pigmentacao" | "cripta" | future...
    depth: Optional[str] = None
    size_mm: Optional[float] = Field(default=None, ge=0.0)
    color: Optional[str] = None
    extension: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class Sector(BaseModel):
    hour: int = Field(ge=1, le=12)
    zones: list[str] = Field(default_factory=list)
    findings: list[Finding] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class RingMarker(BaseModel):
    """Generic boolean-flag ring marker (sodium_ring, senile_arc, lymphatic_rosary)."""

    present: bool

    model_config = ConfigDict(extra="forbid")


class NerveRings(BaseModel):
    present: bool
    count: Optional[int] = Field(default=None, ge=0)
    intensity: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class Rings(BaseModel):
    nerve_rings: NerveRings
    lymphatic_rosary: RingMarker
    sodium_ring: RingMarker
    senile_arc: RingMarker

    model_config = ConfigDict(extra="forbid")


class RadiusSolarisItem(BaseModel):
    sector: int = Field(ge=1, le=12)
    extent: str  # "leve" | "media" | "ampla" | future

    model_config = ConfigDict(extra="forbid")


class GlobalSigns(BaseModel):
    radii_solaris: list[RadiusSolarisItem] = Field(default_factory=list)
    transversal_signs: list[dict] = Field(default_factory=list)
    tofus: list[dict] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class ImageQuality(BaseModel):
    composite_score: float = Field(ge=0.0, le=1.0)
    warnings: list[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class EyeFeatures(BaseModel):
    constitution: Constitution
    iris_color: IrisColor
    fiber_density: FiberDensity
    collarette: Collarette
    pupil: Pupil
    sectors: list[Sector] = Field(default_factory=list)
    rings: Rings
    global_signs: GlobalSigns
    image_quality: ImageQuality

    model_config = ConfigDict(extra="forbid")


class ProcessingMetadata(BaseModel):
    """Top-level processing metadata (D-PM1)."""

    model_version: str  # semver `pipeline_<MAJOR>.<MINOR>.<PATCH>`
    processing_time_ms: int = Field(ge=0)
    modal_call_id: str  # D-T5 — required from the moment status='processing'
    stages_timing_ms: dict[str, int] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    error_summary: Optional[str] = None  # populated only when reading is failed; D-E1 catalog

    model_config = ConfigDict(extra="forbid")


class IrisFeatures(BaseModel):
    """Top-level pipeline output (SPEC §4.3)."""

    right_eye: Optional[EyeFeatures] = None
    left_eye: Optional[EyeFeatures] = None
    asymmetry_notes: list[str] = Field(default_factory=list)  # D-A1, D-A2
    processing_metadata: ProcessingMetadata

    model_config = ConfigDict(extra="forbid")
