---
phase: 5
slug: pipeline-visao-modal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-03
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seed content from `05-RESEARCH.md` `## Validation Architecture` section.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (vision-service) + vitest 2.1.9 (Next.js apps/web) |
| **Config file** | `vision-service/pytest.ini` (Wave 0 — to create), `apps/web/vitest.config.ts` (existing) |
| **Quick run command** | `cd vision-service && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd vision-service && python -m pytest tests/ -v && pnpm --filter web test:run` |
| **Estimated runtime** | ~30s (pytest CPU-only) + ~10s (vitest) |

---

## Sampling Rate

- **After every task commit:** Run `cd vision-service && python -m pytest tests/ -x -q` (or `pnpm --filter web test:run` for Next.js-only tasks)
- **After every plan wave:** Run `cd vision-service && python -m pytest tests/ -v && pnpm --filter web test:run`
- **Before `/gsd-verify-work`:** Full suite green + `pnpm audit:vocabulary` (extended over `vision-service/data/jensen-map.json` and error_summary catalog)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-XX-XX | TBD | TBD | VISION-XX | T-5-XX | TBD | unit/integration/contract | `{command}` | ❌ W0 | ⬜ pending |

*Populated by gsd-planner from PLAN.md task list. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vision-service/pytest.ini` — pytest config, test discovery
- [ ] `vision-service/tests/conftest.py` — shared fixtures (load JPEG, expected.json)
- [ ] `vision-service/tests/fixtures/iris/` — founder photographs (6–10 files, founder records)
- [ ] `vision-service/tests/fixtures/expected.json` — founder-annotated ground-truth
- [ ] `vision-service/tests/fixtures/CONSENT.md` — self-consent + 3rd-party path
- [ ] `vision-service/tests/test_detect.py` … `test_features.py` + `test_schema.py` (7 stubs)
- [ ] `apps/web/tests/api/readings-process.test.ts` — trigger route stub
- [ ] `apps/web/tests/api/vision-webhook.test.ts` — webhook HMAC + status guard stub
- [ ] `vision-service/scripts/audit_vocabulary.py` — extends LGPD audit to JSON assets
- [ ] Add `pytest` to `vision-service/requirements.txt`
- [ ] `.github/workflows/vision-service-tests.yml` — CI workflow

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `modal deploy modal_app.py` end-to-end smoke | VISION-01 | Requires Modal cloud + GPU; not in CI per D-X2 | `cd vision-service && modal deploy modal_app.py`, then trigger via `app/api/readings/[id]/process` against a real fixture reading |
| Founder validation of `jensen-map.json` content | VISION-02f / D-J3 | Requires iridologist domain expertise on Jensen Vol. 1 1982 pt-BR | Founder reviews drafted JSON, marks corrections in `vision-service/data/jensen-map.review.md`, planner applies before commit |
| Founder annotation of `expected.json` for fixtures | D-X3 | Requires iridologist judgment on constituição/findings per fixture | Founder fills `expected_iris_bbox`, `expected_constitution`, `expected_findings_per_sector` once |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
