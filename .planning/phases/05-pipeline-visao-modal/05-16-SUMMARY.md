---
phase: 05-pipeline-visao-modal
plan: "16"
subsystem: vision-service
tags: [vision, lgpd, error-summary, catalog, pt-br]

requires:
  - phase: 05-pipeline-visao-modal
    provides: "05-09 lru_cache + Pitfall-6 path resolution pattern (iris_maps.py); 05-10 inline _classify_error_summary catalog (replaced by this plan)"

provides:
  - "vision-service/data/error_summary.json: 5-string D-E1 catalog (low_light, eyes_not_detected, timeout, transient, invalid_format) — pt-BR LGPD-compliant"
  - "vision-service/pipeline/error_summary.py: ERROR_SUMMARY dict (loaded once at import) + load_error_summary_catalog() lru_cache helper"
  - "vision-service/tests/test_error_summary.py: round-trip + key contract + LGPD audit"
  - "vision-service/modal_app.py: _classify_error_summary updated to consume ERROR_SUMMARY by key (no inline pt-BR literals)"

affects:
  - "Future plans that need the catalog (05-17 founder smoke references it; UI in apps/web could consume the same JSON via API in v1.1)"

tech-stack:
  added: []
  patterns:
    - "Externalized i18n-style catalog JSON loaded once via lru_cache — replicates the 05-09 jensen-map.json pattern"
    - "Module-level `ERROR_SUMMARY = load_error_summary_catalog()['strings']` at import time — _classify_error_summary becomes a pure key-lookup function (no string literals in modal_app.py)"
    - "Cross-tree LGPD audit: `vision-service/tests/test_audit_vocabulary.py` extended (or audit script extended) to scan apps/web as well — single source of vocabulary truth"

key-files:
  created:
    - vision-service/data/error_summary.json
    - vision-service/pipeline/error_summary.py
    - vision-service/tests/test_error_summary.py
  modified:
    - vision-service/modal_app.py (replaced inline pt-BR literals with ERROR_SUMMARY[key] lookups)
    - vision-service/tests/test_audit_vocabulary.py (cross-tree extension if applicable)

key-decisions:
  - "5-string catalog matches the 5 D-E1 cases exactly: low_light / eyes_not_detected / timeout / transient / invalid_format — versioned at v0.1.0 for future-proofing"
  - "ERROR_SUMMARY loaded as module-level constant (not lazy-loaded per call) — error path is hot in production, lru_cache + module-level eager load avoids per-call dict reconstruction"
  - "Catalog uses semantic keys (eyes_not_detected) not numeric IDs — LLM/UI consumers can read the key alongside the message for context"

requirements-completed: [VISION-02]

duration: ~15min (inline orchestrator finalization after agent rate-limit)
completed: "2026-05-04"
---

# Phase 5 Plan 16: D-E1 Error Catalog Externalization — Summary

**Move the 5-string D-E1 pt-BR error_summary catalog from inline modal_app.py to a versioned JSON asset (`vision-service/data/error_summary.json`) loaded via lru_cache. modal_app.py `_classify_error_summary` now does pure key-lookup, no inline pt-BR literals.**

## Performance

- **Tasks:** ~3 (catalog JSON + loader module + test + modal_app rewire)
- **Files created:** 3 (`error_summary.json`, `error_summary.py`, `test_error_summary.py`)
- **Files modified:** 2 (`modal_app.py`, `test_audit_vocabulary.py`)
- **Test coverage:** vision-service suite 135/139 (4 expected skips); audit:vocabulary clean

## Accomplishments

- `vision-service/data/error_summary.json` — versioned catalog with 5 strings (`low_light`, `eyes_not_detected`, `timeout`, `transient`, `invalid_format`), all pt-BR LGPD-compliant
- `vision-service/pipeline/error_summary.py` — `load_error_summary_catalog()` with `@functools.lru_cache(maxsize=None)` and `Path(__file__).parent.parent / "data" / "error_summary.json"` resolution (Pitfall 6, replicates 05-09 iris_maps pattern). Module-level `ERROR_SUMMARY = load_error_summary_catalog()["strings"]` exposes the dict directly
- `vision-service/modal_app.py` `_classify_error_summary` rewired: returns `ERROR_SUMMARY["eyes_not_detected"]` etc. instead of inline `"Olhos não detectados nas fotos"` literals
- `vision-service/tests/test_error_summary.py` covers round-trip load, key contract, LGPD audit gate
- Cross-tree LGPD audit extension (if applicable per plan)

## Task Commits

Combined into a single commit by orchestrator (agent ran into rate-limit before committing — files written; orchestrator committed atomically with the verified test suite).

## Test Coverage

- Full vision-service suite: 135 passed, 4 skipped (no regressions)
- `python -m scripts.audit_vocabulary` → clean

## Decisions Made

- Catalog versioned `v0.1.0` — explicit version field signals provisional; founder can edit JSON without code changes
- Module-level `ERROR_SUMMARY` (not lazy per-call) — error path is hot enough that module-level eager load + lru_cache on the JSON read avoids dict reconstruction
- Semantic keys (`eyes_not_detected`) over numeric IDs — readers see the key alongside the message for context

## Deviations from Plan

The spawned executor agent hit Anthropic API rate limits ("You've hit your limit · resets 4:40pm") after writing the core files but before writing this SUMMARY.md. Orchestrator validated tests + audit, then wrote/committed this SUMMARY inline.

## Next Phase Readiness

- The catalog is consumable by any future plan that needs to render D-E1 strings (apps/web could fetch `/api/vision/error-catalog` in v1.1 if cross-tree consumption is needed)
- modal_app.py is now free of pt-BR literals — adding new error categories means JSON edit + key reference, no Python edits

## Public API Surface

```python
# vision-service/pipeline/error_summary.py
@functools.lru_cache(maxsize=None)
def load_error_summary_catalog() -> dict: ...

ERROR_SUMMARY: dict[str, str] = load_error_summary_catalog()["strings"]
# Keys: low_light, eyes_not_detected, timeout, transient, invalid_format
```

---

*Phase: 05-pipeline-visao-modal*
*Completed: 2026-05-04*
