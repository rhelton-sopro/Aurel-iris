---
phase: 5
slug: pipeline-visao-modal
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-03
updated: 2026-05-04
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seed content from `05-RESEARCH.md` `## Validation Architecture` section.
> Per-task table populated from each `05-NN-PLAN.md` `<verify><automated>` block.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (vision-service) + vitest 2.1.9 (Next.js apps/web) |
| **Config file** | `vision-service/pytest.ini` (Wave 0 — created by 05-01), `apps/web/vitest.config.ts` (existing) |
| **Quick run command** | `cd vision-service && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd vision-service && python -m pytest tests/ -v && pnpm --filter web test:run` |
| **Estimated runtime** | ~30s (pytest CPU-only) + ~10s (vitest) |

---

## Sampling Rate

- **After every task commit:** Run the per-task `<automated>` command from the table below (≤60s).
- **After every plan wave:** Run `cd vision-service && python -m pytest tests/ -v && pnpm --filter web test:run`.
- **Before `/gsd-verify-work`:** Full suite green + `pnpm audit:vocabulary` (extended over `vision-service/data/jensen-map.json` and `data/error_summary.json`) + `cd vision-service && python scripts/audit_vocabulary.py`.
- **Max feedback latency:** 60 seconds.

---

## Per-Task Verification Map

> One row per task that ships an automated `<verify><automated>` command. Extracted from each plan's `<tasks>` section.
> Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky.

| Plan | Task | Wave | Req | Test Type | Automated Command | Status |
|------|------|------|-----|-----------|-------------------|--------|
| 05-01 | 01-01 conftest + pytest.ini + requirements | 0 | VISION-02 | unit | `cd vision-service && python -m pytest --collect-only tests/ 2>&1 \| tail -5 && grep -c '^pytest>=8\.0' requirements.txt && grep -c '^httpx>=0\.27' requirements.txt` | ⬜ pending |
| 05-01 | 01-02 smoke test | 0 | VISION-02 | unit | `cd vision-service && python -m pytest tests/test_smoke.py -x -q 2>&1 \| tail -5` | ⬜ pending |
| 05-01 | 01-03 audit_vocabulary script + tests | 0 | VISION-02 | unit + LGPD audit | `cd vision-service && python -m pytest tests/test_audit_vocabulary.py -x -q 2>&1 \| tail -10 && python -m scripts.audit_vocabulary` | ⬜ pending |
| 05-02 | 02-01 service-role Supabase client | 0 | VISION-04 | unit | `cd apps/web && pnpm test:run lib/supabase/service.test.ts 2>&1 \| tail -10` | ⬜ pending |
| 05-02 | 02-02 HMAC verify+sign (discriminated union) | 0 | VISION-04 | unit + crypto | `cd apps/web && pnpm test:run lib/vision/hmac.test.ts 2>&1 \| tail -25` | ⬜ pending |
| 05-03 | 03-01 Pydantic IrisFeatures import smoke | 1 | VISION-03 | unit | `cd vision-service && python -c "from pipeline.schemas import IrisFeatures, EyeFeatures, ProcessingMetadata; print(IrisFeatures.model_fields.keys())" 2>&1` | ⬜ pending |
| 05-03 | 03-02 schema validation tests | 1 | VISION-03 | contract | `cd vision-service && python -m pytest tests/test_schema.py -x -q 2>&1 \| tail -20` | ⬜ pending |
| 05-04 | 04-01 detect.find_iris constants | 1 | VISION-02 | unit | `cd vision-service && python -c "from pipeline.detect import find_iris, LEFT_IRIS, RIGHT_IRIS, get_landmarker; assert LEFT_IRIS == [468,469,470,471,472]; assert RIGHT_IRIS == [473,474,475,476,477]; print('ok')" 2>&1` | ⬜ pending |
| 05-04 | 04-02 detect tests | 1 | VISION-02 | unit + metric | `cd vision-service && python -m pytest tests/test_detect.py -v 2>&1 \| tail -10` | ⬜ pending |
| 05-05 | 05-01 segment.iris_mask Hough defaults | 1 | VISION-02 | unit | `cd vision-service && python -c "from pipeline.segment import iris_mask, HOUGH_DEFAULTS; assert HOUGH_DEFAULTS['dp'] == 1.0; assert HOUGH_DEFAULTS['minDist'] == 100; assert HOUGH_DEFAULTS['param2'] == 40; assert HOUGH_DEFAULTS['minRadius'] == 80; assert HOUGH_DEFAULTS['maxRadius'] == 200; print('ok')"` | ⬜ pending |
| 05-05 | 05-02 segment tests | 1 | VISION-02 | unit + metric | `cd vision-service && python -m pytest tests/test_segment.py -v 2>&1 \| tail -15` | ⬜ pending |
| 05-06 | 06-01 compose.photometric_combine constants | 1 | VISION-02 | unit | `cd vision-service && python -c "from pipeline.compose import photometric_combine, ANGLE_WEIGHTS; assert ANGLE_WEIGHTS == {'frontal': 0.4, 'lateral': 0.4, 'backlight': 0.2}; print('ok')"` | ⬜ pending |
| 05-06 | 06-02 compose tests | 1 | VISION-02 | unit + metric | `cd vision-service && python -m pytest tests/test_compose.py -v 2>&1 \| tail -15` | ⬜ pending |
| 05-07 | 07-01 normalize.daugman_polar dimensions | 1 | VISION-02 | unit | `cd vision-service && python -c "from pipeline.normalize import daugman_polar, POLAR_RADIAL, POLAR_ANGULAR; assert POLAR_RADIAL == 64; assert POLAR_ANGULAR == 512; print('ok')"` | ⬜ pending |
| 05-07 | 07-02 normalize tests | 1 | VISION-02 | unit + metric | `cd vision-service && python -m pytest tests/test_normalize.py -v 2>&1 \| tail -15` | ⬜ pending |
| 05-08 | 08-01 enhance.clahe constants | 1 | VISION-02 | unit | `cd vision-service && python -c "from pipeline.enhance import clahe, CLAHE_CLIP_LIMIT, CLAHE_TILE_GRID_SIZE; assert CLAHE_CLIP_LIMIT == 2.0; assert CLAHE_TILE_GRID_SIZE == (4, 8); print('ok')"` | ⬜ pending |
| 05-08 | 08-02 enhance tests | 1 | VISION-02 | unit + metric | `cd vision-service && python -m pytest tests/test_enhance.py -v 2>&1 \| tail -15` | ⬜ pending |
| 05-09 | 09-01 jensen-map.json + iris_maps loader | 1 | VISION-02, VISION-03 | unit + LGPD audit | `cd vision-service && python -m pytest tests/test_iris_maps.py -v && python -m scripts.audit_vocabulary 2>&1 \| tail -10` | ⬜ pending |
| 05-09 | 09-02 features.extract_all + compute_asymmetry import | 1 | VISION-02, VISION-03 | unit | `cd vision-service && python -c "from pipeline.features import extract_all, compute_asymmetry, classify_iris_color, KMEANS_K, FIBER_DENSITY_BANDS; print('ok')"` | ⬜ pending |
| 05-09 | 09-03 features tests (incl. B4 anti-regression) | 1 | VISION-02, VISION-03 | unit + contract + metric | `cd vision-service && python -m pytest tests/test_features.py -v 2>&1 \| tail -20` | ⬜ pending |
| 05-09 | 09-04 founder validates jensen-map.json | 1 | VISION-02 | checkpoint:human-verify | _Manual — D-J3 founder approval (not automated)._ | ⬜ pending |
| 05-10 | 10-01 Modal image definition | 1 | VISION-01, VISION-02 | unit + grep | `cd vision-service && python -c "import ast; tree = ast.parse(open('modal_app.py').read()); print('parse ok')" && grep -c 'face_landmarker.task' modal_app.py && grep -c 'libgl1' modal_app.py` | ⬜ pending |
| 05-10 | 10-02 run_pipeline + analyze_iris_endpoint + _post_webhook | 1 | VISION-01, VISION-02, VISION-03, VISION-04 | unit | `cd vision-service && python -c "import ast; ast.parse(open('modal_app.py').read())" && python -c "import modal_app; print(modal_app.app.name)" 2>&1 \| tail -5` | ⬜ pending |
| 05-10 | 10-03 modal_app structure tests (incl. B2/B3/B5) | 1 | VISION-01, VISION-04 | unit | `cd vision-service && python -m pytest tests/test_modal_app.py -v 2>&1 \| tail -20` | ⬜ pending |
| 05-11 | 11-01 modal-client lib + env wiring | 2 | VISION-04 | unit | `cd apps/web && pnpm test:run lib/vision/modal-client.test.ts 2>&1 \| tail -10 && grep -c '^MODAL_ANALYZE_ENDPOINT_URL=' .env.example` | ⬜ pending |
| 05-11 | 11-02 process route handler tests | 2 | VISION-04 | integration | `cd apps/web && pnpm test:run app/api/readings/\[id\]/process/route.test.ts 2>&1 \| tail -20` | ⬜ pending |
| 05-12 | 12-01 webhook route handler (HMAC + Zod + status guard) | 2 | VISION-04 | integration + security | `cd apps/web && pnpm tsc --noEmit -p . 2>&1 \| tail -20 && grep -c "verifyHmacSignature" app/api/vision/webhook/route.ts` | ⬜ pending |
| 05-12 | 12-02 webhook unit tests (incl. B1/B3 anti-regression) | 2 | VISION-04 | unit + security | `cd apps/web && pnpm test:run app/api/vision/webhook/route.test.ts 2>&1 \| tail -25` | ⬜ pending |
| 05-13 | 13-01 finalizeReadingAction triggers Fase 5 | 2 | VISION-04 | unit + grep | `cd apps/web && grep -c "// Fase 5:" app/actions/readings.ts && grep -c "/api/readings/" app/actions/readings.ts && pnpm tsc --noEmit -p . 2>&1 \| tail -10` | ⬜ pending |
| 05-13 | 13-02 finalize action tests | 2 | VISION-04 | integration | `cd apps/web && pnpm test:run app/actions/readings.test.ts 2>&1 \| tail -20` | ⬜ pending |
| 05-14 | 14-01 StatusBadge tests | 2 | VISION-04 | unit + a11y | `cd apps/web && pnpm test:run components/readings/StatusBadge.test.tsx 2>&1 \| tail -15` | ⬜ pending |
| 05-14 | 14-02 ReprocessButton tests | 2 | VISION-04 | unit | `cd apps/web && pnpm test:run components/readings/ReprocessButton.test.tsx 2>&1 \| tail -15` | ⬜ pending |
| 05-14 | 14-03 leituras page integration | 2 | VISION-04 | integration | `cd apps/web && pnpm tsc --noEmit -p . 2>&1 \| tail -10 && grep -c "StatusBadge" "app/(dashboard)/leituras/page.tsx" && grep -c "ReprocessButton" "app/(dashboard)/leituras/page.tsx" && grep -c "vision_features" "app/(dashboard)/leituras/page.tsx"` | ⬜ pending |
| 05-15 | 15-01 GH Actions vision-service workflow | 3 | VISION-02 | unit + grep | `test -f .github/workflows/vision-service-tests.yml && grep -c "name: vision-service tests" .github/workflows/vision-service-tests.yml && grep -c "audit_vocabulary.py" .github/workflows/vision-service-tests.yml && grep -c "pytest tests/" .github/workflows/vision-service-tests.yml && grep -c "modal" .github/workflows/vision-service-tests.yml` | ⬜ pending |
| 05-16 | 16-01 error_summary catalog module | 3 | VISION-02 | unit + LGPD audit | `cd vision-service && python -c "from pipeline.error_summary import ERROR_SUMMARY; assert len(ERROR_SUMMARY)==5; print('OK')" && python -m pytest tests/ -v -k "error_summary or smoke" 2>&1 \| tail -15` | ⬜ pending |
| 05-16 | 16-02 modal_app uses error_summary import | 3 | VISION-02 | unit + grep | `cd vision-service && grep -c "from pipeline.error_summary import ERROR_SUMMARY" modal_app.py && grep -c "ERROR_SUMMARY\['" modal_app.py && python -c "import modal_app; print('ok')" 2>&1 \| tail -5` | ⬜ pending |
| 05-16 | 16-03 audit_vocabulary covers JSON assets | 3 | VISION-02 | unit + LGPD audit | `cd vision-service && python scripts/audit_vocabulary.py 2>&1 \| tail -3 && python -m pytest tests/test_audit_vocabulary.py -v 2>&1 \| tail -25` | ⬜ pending |
| 05-17 | 17-01 apps/web/.env.example Modal block comments | 3 | VISION-01, VISION-04 | unit + grep | `grep -c "^MODAL_TOKEN_ID=" apps/web/.env.example && grep -c "^MODAL_TOKEN_SECRET=" apps/web/.env.example && grep -c "^MODAL_WEBHOOK_SECRET=" apps/web/.env.example && grep -c "^MODAL_ANALYZE_ENDPOINT_URL=" apps/web/.env.example && grep -c "Get from https://modal.com/settings/tokens" apps/web/.env.example` | ⬜ pending |
| 05-17 | 17-02 vision-service/.env.example | 3 | VISION-01, VISION-04 | unit + grep | `test -f vision-service/.env.example && grep -c "^MODAL_WEBHOOK_SECRET=" vision-service/.env.example && grep -c "^WEBHOOK_BASE_URL=" vision-service/.env.example && grep -c "modal secret create" vision-service/.env.example` | ⬜ pending |
| 05-17 | 17-03 README smoke procedure | 3 | VISION-01, VISION-04 | unit + grep | `test -f vision-service/README.md && grep -c "## Smoke procedure" vision-service/README.md && grep -c "modal deploy modal_app.py" vision-service/README.md && grep -c "/api/readings/" vision-service/README.md && grep -c "vision_features" vision-service/README.md && cd vision-service && python scripts/audit_vocabulary.py 2>&1 \| tail -3` | ⬜ pending |

**Sampling continuity check:** No 3 consecutive automated tasks lack a `<verify><automated>` command. Visual scan of the table confirms every plan ships at least one automated gate per task; the only manual gate is `05-09 Task 4` (founder D-J3 checkpoint) which is sandwiched between automated tasks 09-03 and 10-01.

---

## Wave 0 Requirements

Wave 0 lays the test infrastructure and cross-cutting utilities consumed by every later wave. Created by plans `05-01` (vision-service test scaffolding + LGPD audit script) and `05-02` (Next.js HMAC + service-role Supabase utilities).

- [ ] `vision-service/pytest.ini` — pytest config, test discovery (05-01)
- [ ] `vision-service/tests/conftest.py` — shared fixtures, `tests/fixtures/CONSENT.md` placeholder (05-01)
- [ ] `vision-service/tests/test_smoke.py` — smoke test asserts pipeline package importable + 6 stage modules present (05-01)
- [ ] `vision-service/scripts/audit_vocabulary.py` + `tests/test_audit_vocabulary.py` — LGPD vocabulary audit covering py + json + md (05-01; extended in 05-16 to error_summary.json + jensen-map.json)
- [ ] `vision-service/requirements.txt` updates — `pytest>=8.0`, `httpx>=0.27`, `Pillow>=10.4.0`, `pydantic==2.13.3` (05-01 baseline; 05-10 reconfirms; `supabase` removed per RESEARCH Anti-Pattern)
- [ ] `apps/web/lib/supabase/service.ts` + `service.test.ts` — service-role client for RLS bypass in trigger + webhook (05-02)
- [ ] `apps/web/lib/vision/hmac.ts` + `hmac.test.ts` — HMAC-SHA256 verify+sign with **discriminated-union return** (`HmacVerificationResult`) for debuggable rejection causes (05-02)
- [ ] `apps/web/.env.example` — confirm `SUPABASE_SERVICE_ROLE_KEY` + Modal block (touched by 05-02 + 05-11 + 05-17)

> Wave 0 fixtures (founder-photographed iris images + `expected.json` ground-truth + 3rd-party `CONSENT.md`) are **manual** — captured by founder during execution, not committed by 05-01. See `## Manual-Only Verifications` row "Founder annotation of expected.json".

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `modal deploy modal_app.py` end-to-end smoke | VISION-01 | Requires Modal cloud + GPU; not in CI per D-X2 | Follow the 7-step `## Smoke procedure (founder)` section in `vision-service/README.md` (shipped by 05-17) |
| Founder validation of `jensen-map.json` content | VISION-02 / D-J3 | Requires iridologist domain expertise on Jensen Vol. 1 1982 pt-BR | Founder reviews drafted JSON, marks corrections, re-runs `python -m pytest tests/test_iris_maps.py` + `python -m scripts.audit_vocabulary`; replies "approved" on the 05-09 Task 4 checkpoint |
| Founder annotation of `expected.json` for fixtures | D-X3 | Requires iridologist judgment on constituição/findings per fixture | Founder fills `expected_iris_bbox`, `expected_constitution`, `expected_findings_per_sector` once for the 6–10 fixture iris photos in `vision-service/tests/fixtures/expected.json` |
| `MODAL_WEBHOOK_SECRET` parity (Vercel ↔ Modal Secrets) | VISION-04 | Cross-system secret — only the founder can set both | 05-17 README step 4 documents the parity check; symptom (`[webhook] hmac rejected: signature_mismatch`) and remediation captured |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (1 manual checkpoint at 05-09 Task 4 — D-J3 founder; sampling continuity preserved by surrounding automated gates)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (test infra in 05-01, cross-cutting utilities in 05-02)
- [x] No watch-mode flags
- [x] Feedback latency < 60s (each automated command exits in ≤30s on local CPU; vitest <10s; pytest <30s)
- [x] `nyquist_compliant: true` set in frontmatter (flipped from `false` after per-task table populated — 2026-05-04)

**Approval:** planned (revision pass — populated per-task table from PLAN.md `<automated>` blocks).
