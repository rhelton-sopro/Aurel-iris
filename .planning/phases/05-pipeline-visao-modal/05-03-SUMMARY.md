---
phase: 05-pipeline-visao-modal
plan: "03"
subsystem: vision-service
status: complete
completed_date: "2026-05-04"
duration_minutes: 3
tasks_completed: 2
tasks_total: 2
files_created: 2
files_modified: 0
tags: [vision, pydantic, schema, contract, tdd]
requirements_completed: [VISION-03]

dependency_graph:
  requires:
    - vision-service/pytest.ini (plan 05-01)
    - vision-service/tests/conftest.py (plan 05-01)
    - vision-service/pipeline/__init__.py (phase 1 skeleton)
  provides:
    - vision-service/pipeline/schemas.py (IrisFeatures Pydantic v2 contract, SPEC §4.3)
    - vision-service/tests/test_schema.py (22 round-trip + boundary tests)
  affects:
    - Plan 05-09 (features stage — must populate IrisFeatures fields)
    - Plan 05-10 (orchestrator — must call IrisFeatures.model_validate before webhook)
    - Plan 05-12 (webhook Zod schema — TypeScript mirror of IrisFeatures)

tech_stack:
  added:
    - pydantic==2.13.3 (already in requirements; IrisFeatures.model_validate API)
  patterns:
    - Pydantic v2 BaseModel with ConfigDict(extra='forbid') on every class
    - Field(ge=..., le=...) for numeric range enforcement
    - from __future__ import annotations for Python 3.10 list[str] syntax
    - Optional[EyeFeatures] per eye for D-F1 soft degradation
    - ConstitutionType Enum (informational, not enforced on field) per RESEARCH Pattern 9

key_files:
  created:
    - vision-service/pipeline/schemas.py
    - vision-service/tests/test_schema.py
  modified: []

decisions:
  - "extra='forbid' on all 16 BaseModel classes to catch undocumented pipeline fields early (T-05-03-01)"
  - "Constitution.primary is str not Enum — allows pipeline experimentation without schema bump; ConstitutionType Enum documented but not enforced"
  - "GlobalSigns.transversal_signs and tofus are list[dict] (not typed sub-models) — SPEC §4.3 leaves their internal shape undefined; typed later when pipeline populates them"
  - "from __future__ import annotations required for list[str] on Python 3.10 (CI matrix)"
  - "No model_validator added — orchestrator decides both-eyes-None = hard fail, schema stays permissive (D-F1)"

metrics:
  duration_minutes: 3
  completed_date: "2026-05-04"
  test_count: 22
  parametrized_cases: 8
---

# Phase 5 Plan 03: IrisFeatures Pydantic v2 Schema Summary

**One-liner:** Pydantic v2 IrisFeatures schema mirroring SPEC §4.3 exactly — 16 models with `extra="forbid"`, numeric Field bounds, Optional per-eye (D-F1), and 22 green tests proving round-trip and boundary rejection.

## What Was Built

**Task 1 — IrisFeatures schema** (`5dd25bb`)

`vision-service/pipeline/schemas.py` — 16 Pydantic v2 BaseModel classes:

| Class | Role |
|-------|------|
| `ConstitutionType` | Informational Enum (Jensen canonical 3 values); not enforced on field |
| `Constitution` | `primary: str`, `confidence: float [0,1]`, `indicators: list[str]` |
| `IrisColor` | `primary`, `secondary: Optional[str]`, `central_heterochromia: bool` |
| `FiberDensity` | `score: float [0,1]`, `interpretation: str` |
| `Collarette` | `shape`, `diameter_ratio: float [0,1]`, `decentralization` |
| `Pupil` | `centralization`, `shape`, `size_ratio: float [0,1]` |
| `Finding` | `type`, `depth?`, `size_mm?: float >=0`, `color?`, `extension?` |
| `Sector` | `hour: int [1,12]`, `zones: list[str]`, `findings: list[Finding]` |
| `RingMarker` | `present: bool` (lymphatic_rosary, sodium_ring, senile_arc) |
| `NerveRings` | `present: bool`, `count?: int >=0`, `intensity?: str` |
| `Rings` | `nerve_rings`, `lymphatic_rosary`, `sodium_ring`, `senile_arc` |
| `RadiusSolarisItem` | `sector: int [1,12]`, `extent: str` |
| `GlobalSigns` | `radii_solaris`, `transversal_signs: list[dict]`, `tofus: list[dict]` |
| `ImageQuality` | `composite_score: float [0,1]`, `warnings: list[str]` |
| `EyeFeatures` | All per-eye fields composing the above models |
| `ProcessingMetadata` | `model_version`, `processing_time_ms >=0`, `modal_call_id` (D-T5), `stages_timing_ms`, `warnings`, `error_summary?` |
| `IrisFeatures` | `right_eye?`, `left_eye?` (D-F1), `asymmetry_notes` (D-A1/A2), `processing_metadata` |

Every class has `model_config = ConfigDict(extra="forbid")` (16 occurrences, mitigating T-05-03-01).

**Task 2 — 22 schema tests** (`1faf413`)

`vision-service/tests/test_schema.py` — 22 test cases including:
- 1 canonical SPEC §4.3 round-trip (model_validate → model_dump field equality)
- 3 Optional/None acceptance tests (D-F1, D-A2)
- 2 parametrized confidence boundary tests (`[-0.01, 1.01]` → ValidationError)
- 2 parametrized composite_score boundary tests
- 4 parametrized hour boundary tests (`[0, 13, -1, 100]` → ValidationError)
- 2 extra-field rejection tests (top-level + eye block)
- 4 further boundary tests (modal_call_id required, error_summary optional, radii_solaris sector, size_mm >=0, diameter_ratio <=1)
- 2 sub-model construction tests (ProcessingMetadata, EyeFeatures)

Full test suite (32 tests including plans 05-01): all green in 0.24s.

## Verification Results

```
cd vision-service && python -m pytest tests/test_schema.py -v
22 passed in 0.17s

cd vision-service && python -m pytest tests/ -x -q
32 passed in 0.24s

python -c "from pipeline.schemas import IrisFeatures; print(len(IrisFeatures.model_fields))"
4

python -m scripts.audit_vocabulary
OK: vocabulário proibido ausente em vision-service/
```

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. The schema content was specified verbatim in the plan's `<action>` block and implemented as-is.

### Deviation from RESEARCH.md Pattern 9 (documented per plan output spec)

Pattern 9 in RESEARCH.md provided the Pydantic v2 idiom template. Two tightening choices were made that do NOT alter SPEC §4.3 payload shape:

1. **`FiberDensity`, `Collarette`, `Pupil` are typed BaseModels** (not raw `dict`) — Pattern 9 left these open. Typed sub-models provide better IDE auto-complete and earlier shape validation for pipeline authors.
2. **`extra="forbid"` added globally** — Pattern 9 showed it on IrisFeatures only. Applied to all 16 models for defense-in-depth (T-05-03-01 threat mitigation).

Both choices are additive and do not break round-trip with the SPEC §4.3 canonical payload.

## Known Stubs

None. The schema is a pure data-contract module with no data sources to wire. `GlobalSigns.transversal_signs` and `tofus` use `list[dict]` (untyped inner shape) because SPEC §4.3 leaves those fields as open arrays. This is intentional — plan 05-09 (features stage) will populate them as needed.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: none | — | No new network endpoints, auth paths, or trust boundaries introduced. Schema is server-only and never reaches the browser directly. |

No actionable threat flags. Schema is the gate (T-05-03-01 mitigated by `extra="forbid"`; T-05-03-02 mitigated by `Field(ge/le)` + tests).

## Self-Check: PASSED
