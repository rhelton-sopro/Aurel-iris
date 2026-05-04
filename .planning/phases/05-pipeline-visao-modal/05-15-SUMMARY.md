---
phase: 05-pipeline-visao-modal
plan: "15"
subsystem: ci
status: complete
completed_date: "2026-05-04"
duration_minutes: 10
tasks_completed: 1
tasks_total: 1
files_created: 1
files_modified: 0
tags: [vision, ci, github-actions, pytest, lgpd-vocab]
requirements_completed: [VISION-02]

dependency_graph:
  requires:
    - vision-service/scripts/audit_vocabulary.py (05-01)
    - vision-service/tests/ (05-01 through 05-09)
    - vision-service/requirements.txt (pytest>=8.0 present — 05-01)
  provides:
    - .github/workflows/vision-service-tests.yml (CI gate for all vision-service PRs)
  affects:
    - Every PR touching vision-service/** (blocked until green CI)
    - Plan 05-16 (extended audit_vocabulary.py will be exercised by this workflow)

tech_stack:
  added:
    - GitHub Actions (actions/checkout@v4, actions/setup-python@v5)
  patterns:
    - paths filter scoping CI trigger to vision-service/** only
    - if: always() on audit step so LGPD gate runs even when pytest fails
    - defaults.run.working-directory at job level (DRY — all run steps share cwd)
    - permissions: contents: read (least-privilege GITHUB_TOKEN)

key_files:
  created:
    - .github/workflows/vision-service-tests.yml
  modified: []

decisions:
  - "Single workflow / single job (pytest): both pytest and audit_vocabulary.py share the same job so CI produces one status check per PR rather than two. Simpler merge gate."
  - "if: always() on LGPD audit step: ensures forbidden-vocabulary regressions surface in the same CI run even when tests fail — catches both kinds of regression in one run."
  - "paths filter includes workflow file itself (.github/workflows/vision-service-tests.yml): workflow edits trigger their own CI run, preventing silent breakage of the CI definition."
  - "Python 3.11 only (no matrix): D-X2 specifies CPU-only pytest matching Modal image; matrix expansion to 3.12 is a one-line change for a future plan."
  - "No Modal/CUDA references: D-X2 prohibits Modal cloud calls in CI; GPU drivers and torch+cuda are not installed. opencv-python-headless (CPU build) comes from requirements.txt."
  - "permissions: contents: read: defense-in-depth against accidental write operations; GitHub 2024+ org defaults are already read-only but explicit declaration is required per T-05-15-02."
---

# Phase 5 Plan 15: CI Workflow (vision-service) Summary

**One-liner:** GitHub Actions CI workflow that gates every vision-service PR behind pytest (Python 3.11, CPU-only) and the LGPD vocabulary audit script, with least-privilege permissions and no Modal cloud calls.

## What Was Built

**Task 1 — Create `.github/workflows/vision-service-tests.yml`**

Single workflow file with:

- **Triggers:** `push` to `main` AND `pull_request` on any branch, both scoped to `paths: ['vision-service/**', '.github/workflows/vision-service-tests.yml']`. Next.js-only PRs (`apps/web/**`) do not trigger Python CI, saving free-tier minutes.
- **Job:** `pytest` on `ubuntu-latest`, Python 3.11 (matches Modal image per D-X2).
- **Steps in order:**
  1. `actions/checkout@v4` — pinned major version, first-party GitHub Action.
  2. `actions/setup-python@v5` — pip cache keyed on `vision-service/requirements.txt`, avoiding redundant installs on repeated runs.
  3. `pip install -r requirements.txt` — installs all deps including `opencv-python-headless` (CPU build), `mediapipe`, `numpy`, `scikit-image`, `Pillow`, `pydantic`, `httpx`, `pytest>=8.0`. No CUDA, no `torch+cuda`, no GPU drivers.
  4. `python -m pytest tests/ -v` — runs all stage tests (detect, segment, compose, normalize, enhance, features, smoke, audit_vocabulary) with verbose output for readable CI logs.
  5. `python scripts/audit_vocabulary.py` with `if: always()` — LGPD gate runs regardless of pytest outcome so forbidden-vocabulary regressions are caught in the same CI run even when tests fail.
- **Security:** `permissions: contents: read` at workflow level (T-05-15-02). No `secrets.*` references — CPU-only test needs no Modal token, no Supabase key (T-05-15-04).

## Verification (Manual Gate Check)

All acceptance criteria satisfied by inspection of the committed file:

| Check | Status |
|-------|--------|
| `name: vision-service tests` present | PASS |
| `actions/checkout@v4` pinned | PASS |
| `actions/setup-python@v5` pinned | PASS |
| `python-version: '3.11'` | PASS |
| `audit_vocabulary.py` step present | PASS |
| `pytest tests/ -v` step present | PASS |
| `if: always()` on audit step | PASS |
| Zero `modal` references | PASS |
| Zero `cuda`/`nvidia` references | PASS |
| Zero `secrets.` references | PASS |
| `permissions: contents: read` | PASS |
| `vision-service/**` in paths (push + PR) | PASS — appears on lines 7 and 11 |

## Deviations from Plan

None — plan executed exactly as written. The workflow content matches the YAML template specified in the plan's `<action>` block verbatim.

## Known Stubs

None. This plan is CI infrastructure only — no data flows, no UI components.

## Threat Flags

No new threat surface beyond what is registered in the plan's threat model (T-05-15-01 through T-05-15-07 already documented in 05-15-PLAN.md).

## Self-Check: PASSED

- `.github/workflows/vision-service-tests.yml` exists at the correct path.
- All acceptance criteria verified by file inspection above.
- No STATE.md or ROADMAP.md modifications made (parallel executor constraint honored).
