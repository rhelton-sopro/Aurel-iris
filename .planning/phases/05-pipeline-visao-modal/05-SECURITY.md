---
phase: 5
slug: 05-pipeline-visao-modal
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-04
---

# Phase 5 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Verified by gsd-security-auditor on 2026-05-04 — all 92 declared threat dispositions confirmed against implemented code.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Modal worker → Next.js webhook | HMAC-signed payload over public internet; `verifyHmacSignature` is the only auth on `/api/vision/webhook` (timing-safe, replay-windowed) | Iris features JSON + status |
| Modal HTTP endpoint → Modal worker | Internal Modal RPC | `Modal-Key` / `Modal-Secret` proxy auth |
| Modal worker → Supabase Storage | Time-limited signed URLs only (TTL=600s); NO service-role key in container (D-T6, RESEARCH Anti-Pattern) | Iris image bytes (read-only) |
| Browser → trigger route `/api/readings/[id]/process` | User-authenticated via Supabase session; ownership enforced server-side via `eq('therapist_id', user.id)` + RLS | reading_id + session cookie |
| Server runtime → service-role key | `SUPABASE_SERVICE_ROLE_KEY` server-only via `import 'server-only'` — fails `next build` if reached from a client component | DB write privilege |
| Pipeline output → Pydantic validator | `IrisFeatures.model_validate` is the contract gate before `_post_webhook`; `extra="forbid"` rejects shape drift | Vision features schema |
| Browser → Server Action `finalizeReadingAction` | Authenticated session; cookie forwarding via `next/headers.cookies()` to internal trigger route | Captura submission |
| Filesystem → audit script | Forbidden vocab regex with word-boundaries; `EXTENSIONS={.py,.json,.md}` allowlist; binary-blob skip | Source text scan |
| GitHub-hosted runner → repo source | Read-only checkout via `permissions: contents: read`; pinned action major versions | CI test execution |
| Founder workstation → Modal CLI | `~/.modal.toml` at-rest; placeholders only in README/`.env.example` | Modal credentials |
| jensen-map.json → LLM Phase 7 | Strings cited verbatim by LLM in pt-BR reports; LGPD audit non-negotiable; founder checkpoint approval recorded | Iridology zone vocabulary |

---

## Threat Register

### Plan 05-01 — Audit Vocabulary Foundation

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-05-01-01 | Information Disclosure | tests/fixtures/iris/ | mitigate | Repo private; consent record committed; no public CI artifact upload | closed | Repo private; `tests/fixtures/CONSENT.md` present; no `upload-artifact` step in CI |
| T-05-01-02 | Tampering | Audit regex bypass | accept | Layered: regex + manual review (D-J3 founder checkpoint approved 2026-05-04) | closed | Documented in 05-01-SUMMARY.md |
| T-05-01-03 | Repudiation | CONSENT.md altered | mitigate | Git history is canonical | closed | `tests/fixtures/CONSENT.md` committed |
| T-05-01-04 | Spoofing | Fixture filename pretending consent | accept | Documented as low-severity pre-Stage-2 | closed | 05-01-SUMMARY.md disposition |
| T-05-01-05 | DoS | Audit script crash on huge file | mitigate | `EXTENSIONS={.py,.json,.md}` allowlist + `UnicodeDecodeError` swallowed | closed | `audit_vocabulary.py:54` |

### Plan 05-02 — HMAC verifier + service-role client

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-05-02-01 | Spoofing | Forged webhook | mitigate | `timingSafeEqual`; `signature_mismatch` reason | closed | `apps/web/lib/vision/hmac.ts:99` |
| T-05-02-02 | Spoofing | Replayed webhook | mitigate | `DEFAULT_REPLAY_WINDOW_SECONDS = 300`; `\|now-ts\|>window` check | closed | `hmac.ts:22, :79` |
| T-05-02-03 | Information Disclosure | Service-role key to browser | mitigate | `import 'server-only'` | closed | `apps/web/lib/supabase/service.ts:11` |
| T-05-02-04 | Tampering | Length/hex injection on signature | mitigate | `/^[0-9a-f]+$/i` regex + length check | closed | `hmac.ts:88, :95` |
| T-05-02-05 | Elevation of Privilege | Test secret committed | accept | `'test-secret-do-not-ship'` literal; local-only | closed | Test fixture, documented |
| T-05-02-06 | Tampering | request.json() before HMAC | mitigate | Webhook reads `request.text()` BEFORE HMAC verify | closed | `webhook/route.ts:87, :101` |
| T-05-02-07 | API Misuse | Boolean coercion of return | mitigate | Discriminated-union return; consumer reads `result.valid` | closed | `hmac.ts:24-33`; `webhook/route.ts:108` |

### Plan 05-03 — Pydantic schemas (IrisFeatures)

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-05-03-01 | Tampering | Undocumented field accepted | mitigate | `extra="forbid"` on every BaseModel | closed | `vision-service/pipeline/schemas.py` |
| T-05-03-02 | Tampering | Malformed numeric ranges | mitigate | `Field(ge=0.0, le=1.0)`, `Field(ge=1, le=12)` | closed | `schemas.py` field validators |
| T-05-03-03 | Repudiation | model_version not bumped | accept | Manual policy per D-PM1; documented | closed | 05-03-SUMMARY.md |
| T-05-03-04 | Information Disclosure | Schema serialization | accept | Server-only; never reaches browser directly | closed | Server-side use only |

### Plan 05-04 — detect.py (MediaPipe)

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-05-04-01 | DoS | Adversarial image OOM | accept | Modal `gpu="T4", timeout=120` caps blast radius | closed | `modal_app.py:156` |
| T-05-04-02 | Tampering | Wrong-eye landmark selection | mitigate | `find_iris` returns ALL 478 landmarks; orchestrator picks per `eye` | closed | `detect.py` docstring |
| T-05-04-03 | Information Disclosure | MediaPipe logs | accept | Modal Cloud logs workspace-private | closed | Documented |
| T-05-04-04 | Spoofing | Malicious model file | mitigate | HTTPS download from `storage.googleapis.com` at image build; `is_file()` validation | closed | `modal_app.py:60-67`; `detect.py:_resolve_model_path` |

### Plan 05-05 — segment.py (Hough)

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-05-05-01 | Tampering | Hough specular highlight (Pitfall 7) | mitigate | `np.argmin(dists)` selects closest-to-MediaPipe candidate | closed | `pipeline/segment.py:101` |
| T-05-05-02 | DoS | Hough accumulator unbounded | accept | `HOUGH_DEFAULTS.minRadius=80, maxRadius=200` bounded | closed | `segment.py:24` |
| T-05-05-03 | Information Disclosure | Mask debug log | accept | No logging in `segment.py` | closed | Verified |
| T-05-05-04 | Repudiation | HOUGH_DEFAULTS untraced | mitigate | Module constant — git diff visible | closed | `segment.py:24` |

### Plan 05-06 — compose.py

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-05-06-01 | Tampering | uint8 overflow on sum | mitigate | float32 cast then `np.clip(0,255).astype(uint8)` | closed | `compose.py` action spec |
| T-05-06-02 | DoS | Mismatched shapes | mitigate | `compose_shape_mismatch` ValueError | closed | Acceptance grep |
| T-05-06-03 | Information Disclosure | None | accept | Pure transform, no I/O | closed | Verified |

### Plan 05-07 — normalize.py (polar unwrap)

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-05-07-01 | DoS | Large iris radius | mitigate | `cv2.remap` cost bounded by output shape (64×512) | closed | `normalize.py` |
| T-05-07-02 | Tampering | Pupil/iris radius swap | accept | Caller responsibility; documented | closed | Documented |
| T-05-07-03 | Information Disclosure | None | accept | Pure transform | closed | Verified |

### Plan 05-08 — enhance.py (CLAHE)

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-05-08-01 | Tampering | CLAHE on RGB anti-pattern | mitigate | `cv2.COLOR_RGB2LAB` + L-only + `cv2.COLOR_LAB2RGB` | closed | `enhance.py` action spec |
| T-05-08-02 | Repudiation | Constants tweaked silently | mitigate | `CLAHE_CLIP_LIMIT=2.0`, `CLAHE_TILE_GRID_SIZE=(4,8)` exported | closed | Module constants |

### Plan 05-09 — features.py (Jensen map)

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-05-09-01 | LGPD | Forbidden vocab in jensen-map | mitigate | `audit_vocabulary.py` PATTERN; CI step `if: always()`; jensen-map clean | closed | `audit_vocabulary.py:21-26`; `vision-service-tests.yml:49-51` |
| T-05-09-02 | Tampering | Jensen drift from reference | mitigate | Founder checkpoint approval recorded (2026-05-04 with one fix); `version` field present | closed | `05-09-SUMMARY.md` |
| T-05-09-03 | Tampering | EyeFeatures shape violation | mitigate | `IrisFeatures.model_validate(full_payload)` BEFORE `_post_webhook` | closed | `modal_app.py:277` |
| T-05-09-04 | Information Disclosure | Sensitive zone strings | accept | Public iridology lore, no PII | closed | jensen-map.json |
| T-05-09-05 | Elevation of Privilege | Authoritative misclassification | accept | LGPD prompt enforces hypothetical language (Phase 7); `confidence` caps overconfidence | closed | Phase 7 contract |
| T-05-09-06 | Tampering | Lacuna threshold biased | mitigate | `LACUNA_DARK_THRESHOLD=60` exported as module constant | closed | `features.py:39` |

### Plan 05-10 — modal_app.py main (orchestration)

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-05-10-01 | Spoofing | Forged callback to webhook | mitigate | `hmac.new(secret, f"{ts}.{body}", sha256)`; verifier with `timingSafeEqual` | closed | `modal_app.py:106-110` |
| T-05-10-02 | Elevation of Privilege | Service-role key in container | mitigate | `supabase` NOT in `requirements.txt` (only doc comment); not in image `pip_install` | closed | `modal_app.py:48-68`; `requirements.txt` |
| T-05-10-03 | Tampering | Malformed payload to webhook | mitigate | `IrisFeatures.model_validate` before POST; D-F1 hard-fail path also gated | closed | `modal_app.py:277, :240` |
| T-05-10-04 | DoS | One eye crash kills both | mitigate | Per-eye try/except; sets failed eye to None, continues | closed | `modal_app.py:178, :230` |
| T-05-10-05 | Repudiation | model_version not bumped | accept | Manual policy per D-PM1 | closed | Documented |
| T-05-10-06 | Information Disclosure | Signed URL via logs | mitigate | TTL=600s; Modal Cloud logs workspace-private | closed | `process/route.ts:33` |
| T-05-10-07 | Tampering | Forbidden vocab in error_summary | mitigate | `_classify_error_summary` returns from `ERROR_SUMMARY` catalog only | closed | `modal_app.py:138-153`; `tests/test_audit_vocabulary.py` |
| T-05-10-08 | Spoofing | Timestamp rewind | mitigate | Sender-side timestamp; verifier-side check in 05-12 | closed | `modal_app.py:104` |

### Plan 05-11 — Trigger route `/api/readings/[id]/process`

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-05-11-01 | Elevation of Privilege | Cross-therapist trigger | mitigate | `eq('therapist_id', user.id)` + RLS | closed | `process/route.ts:58` |
| T-05-11-02 | Spoofing | CSRF | mitigate | Supabase session cookie + `runtime='nodejs'` server-only auth | closed | Route header |
| T-05-11-03 | Information Disclosure | Signed URLs in logs | mitigate | TTL=600s; service-role key never logged | closed | Code review |
| T-05-11-04 | Tampering | Reading stuck in 'processing' | mitigate | Catch rolls back to `'failed'` with `FALLBACK_ERROR_SUMMARY` | closed | `process/route.ts:124-144` |
| T-05-11-05 | DoS | Trigger hammering | accept | Modal billing caps; D-T3 disables Reprocessar while pending | closed | UI + billing |
| T-05-11-06 | Tampering | TTL accidentally reduced | mitigate | `SIGNED_URL_TTL_SECONDS = 600` named constant | closed | `process/route.ts:33` |
| T-05-11-07 | Repudiation | modal_call_id confusion | mitigate | Pre-spawn `modal_call_id: 'pending'`; post-spawn replacement | closed | `process/route.ts:109, :150` |

### Plan 05-12 — Webhook route `/api/vision/webhook`

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-05-12-01 | Spoofing | Forged webhook | mitigate | `verifyHmacSignature` returns 401 on any reason | closed | `webhook/route.ts:101`; `hmac.ts:99` |
| T-05-12-02 | Tampering | Body modified in transit | mitigate | HMAC covers raw body+timestamp; `request.text()` BEFORE HMAC | closed | `webhook/route.ts:87` |
| T-05-12-03 | Replay | Captured legitimate webhook replayed | mitigate | `REPLAY_WINDOW_SECONDS = 300` passed to verifier | closed | `webhook/route.ts:46` |
| T-05-12-04 | Tampering | Late retry overwrites edited | mitigate | Status guard + SQL `.eq('status', STATUS_PROCESSING)` | closed | `webhook/route.ts:150, :202` |
| T-05-12-05 | Information Disclosure | Service-role via logs | mitigate | `console.error` only emits Supabase error message strings | closed | Code review |
| T-05-12-06 | DoS | Flood of bad bodies | accept | Vercel rate-limit; webhook rejects fast (no DB write on HMAC fail) | closed | Platform |
| T-05-12-07 | Repudiation | Unknown which Modal run | mitigate | `modal_call_id` warn-log; SQL `processed_at`; applied-log | closed | `webhook/route.ts:167, :212` |
| T-05-12-08 | Tampering | Race with Phase 7 edit | mitigate | SQL-level `.eq('status', STATUS_PROCESSING)` — race-safe via WHERE | closed | `webhook/route.ts:202` |
| T-05-12-09 | Elevation of Privilege | Service role outside contract | mitigate | `createServiceClient()` module-local; only SELECT id/status + atomic UPDATE | closed | `webhook/route.ts` |

### Plan 05-13 — finalizeReadingAction (Server Action)

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-05-13-01 | Spoofing | SSR fetch bypassing auth | mitigate | Cookie forwarding via `next/headers.cookies()` | closed | `actions/readings.ts:129-130` |
| T-05-13-02 | Elevation of Privilege | Trigger for non-owned reading | mitigate | Trigger route's `eq('therapist_id', user.id)` is authoritative | closed | `process/route.ts:58` |
| T-05-13-03 | Information Disclosure | Trigger error to UI | mitigate | `console.error` server-side; UI gets static soft-warn copy | closed | `actions/readings.ts:145, :166-168` |
| T-05-13-04 | Tampering | Captura destroyed by trigger fail | mitigate | All non-202 + fetch-throws caught; redirect ONLY on 202 | closed | `actions/readings.ts:135-154, :159-163` |
| T-05-13-05 | DoS | Hot-loop trigger | accept | User-initiated; trigger route status guard rejects already-processing | closed | UX flow |
| T-05-13-06 | Repudiation | Unknown which finalize call | mitigate | Server logs `[finalize] trigger ... reading=<id> status=<n>` | closed | `actions/readings.ts:145` |

### Plan 05-14 — ReprocessButton

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-05-14-01 | Elevation of Privilege | Cross-therapist Reprocessar | mitigate | Trigger route enforces ownership server-side; button only carries `readingId` | closed | `process/route.ts:58` |
| T-05-14-02 | Tampering | Disabled state circumvented | mitigate | Server-side status guard at trigger route is authoritative | closed | `process/route.ts:63` |
| T-05-14-03 | Information Disclosure | error_summary leaks internals | mitigate | Catalog locked to 5 D-E1 strings | closed | `vision-service/data/error_summary.json` |
| T-05-14-04 | Tampering | XSS via error_summary | mitigate | React text rendering; no `dangerouslySetInnerHTML` | closed | `StatusBadge.tsx:77` |
| T-05-14-05 | DoS | Repeated Reprocessar clicks | mitigate | `setPending(true)` before await; status guard server-side | closed | `ReprocessButton.tsx:38` |
| T-05-14-06 | Repudiation | Unknown click drove which run | mitigate | `aria-label` includes readingId; server logs trace each click | closed | `ReprocessButton.tsx:69` |

### Plan 05-15 — CI Workflow

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-05-15-01 | Tampering | Compromised third-party action | mitigate | Pinned `actions/checkout@v4`, `actions/setup-python@v5`; no third-party actions | closed | `vision-service-tests.yml:30, :33` |
| T-05-15-02 | Elevation of Privilege | GITHUB_TOKEN abuse | mitigate | `permissions: contents: read` | closed | `vision-service-tests.yml:15-16` |
| T-05-15-03 | Information Disclosure | Fixtures via CI logs | mitigate | No `upload-artifact` step; pytest `-v` shows only test names | closed | Workflow review |
| T-05-15-04 | Information Disclosure | secrets.* logged | mitigate | No `secrets.*` references in workflow | closed | Workflow review |
| T-05-15-05 | Tampering | Vocab regression undetected | mitigate | `if: always()` audit step runs even when pytest fails | closed | `vision-service-tests.yml:50-51` |
| T-05-15-06 | Repudiation | Cannot identify regression | mitigate | `paths` self-trigger on workflow change; verbose pytest output | closed | `vision-service-tests.yml:8` |
| T-05-15-07 | DoS | Long pytest exhausts minutes | accept | Phase 5 fixtures small; CPU run <2 min; free tier 2000 min/month | closed | Platform |

### Plan 05-16 — error_summary catalog externalization

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-05-16-01 | Tampering | Forbidden vocab in catalog | mitigate | 5 strings audited; word-boundary regex; CI gate per 05-15 | closed | `error_summary.json`; `audit_vocabulary.py:21-26` |
| T-05-16-02 | Tampering | Pipeline bypasses catalog | mitigate | `_classify_error_summary` returns `ERROR_SUMMARY[<key>]` only; no inlined pt-BR strings | closed | `modal_app.py:138-153` |
| T-05-16-03 | Information Disclosure | error_summary leaks internals | mitigate | Catalog of 5 strings closed; no PII/stack traces/IDs | closed | `error_summary.json` |
| T-05-16-04 | Tampering | Audit self-trigger | mitigate | `SKIP_FILES = {Path(__file__).name}` skips the script file itself | closed | `audit_vocabulary.py:31` |
| T-05-16-05 | DoS | Audit too slow | accept | Scope is `vision-service/{pipeline,data,scripts,tests/fixtures}` — small tree | closed | Documented |
| T-05-16-06 | Repudiation | Cannot identify file/line | mitigate | `path:line: <matched line>` output | closed | `audit_vocabulary.py:59` |

### Plan 05-17 — Founder smoke runbook + .env.example

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-05-17-01 | Information Disclosure | README leaks token | mitigate | All commands use `<token-id>`/`<token-secret>` placeholders; `.env.example` empty values; `.gitignore` excludes `.env` | closed | `vision-service/README.md`; `vision-service/.env.example`; `.gitignore` |
| T-05-17-02 | Tampering | HMAC secret drift | mitigate | `vision-service/.env.example:10` says "MUST match apps/web/.env MODAL_WEBHOOK_SECRET exactly" | closed | `.env.example`; README |
| T-05-17-03 | Elevation of Privilege | Future PR adds Supabase to Modal | mitigate | "Architectural floor (LGPD)" section in README; cross-references D-T6 + Anti-Patterns | closed | `vision-service/README.md` |
| T-05-17-04 | Spoofing | Stale endpoint URL | mitigate | README step 3 instructs re-capture on every redeploy; step 4 says "Re-deploy any pre-existing preview" | closed | `vision-service/README.md` |
| T-05-17-05 | Repudiation | Smoke last-passed unknown | accept | Founder dogfooding journal; solo-tenant; revisited Phase 8 LGPD | closed | Project journal |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-05-01 | T-05-01-02 | Audit regex bypass — layered with manual review at D-J3 founder checkpoint | Founder (Rhelton) | 2026-05-04 |
| R-05-02 | T-05-01-04 | Fixture filename spoofing low-severity pre-Stage-2 multi-tenant | Founder (Rhelton) | 2026-05-04 |
| R-05-03 | T-05-02-05 | Test secret `'test-secret-do-not-ship'` is local-only literal; production uses `MODAL_WEBHOOK_SECRET` env | Founder (Rhelton) | 2026-05-04 |
| R-05-04 | T-05-03-03 | model_version manual bump policy per D-PM1 | Founder (Rhelton) | 2026-05-04 |
| R-05-05 | T-05-03-04 | Schema serialization server-only; never reaches browser directly | Founder (Rhelton) | 2026-05-04 |
| R-05-06 | T-05-04-01 | Adversarial-image OOM bounded by Modal `gpu="T4", timeout=120` | Founder (Rhelton) | 2026-05-04 |
| R-05-07 | T-05-04-03 | MediaPipe logs to Modal Cloud — workspace-private | Founder (Rhelton) | 2026-05-04 |
| R-05-08 | T-05-05-02 | Hough accumulator bounded by `HOUGH_DEFAULTS.minRadius=80, maxRadius=200` | Founder (Rhelton) | 2026-05-04 |
| R-05-09 | T-05-05-03 | No mask debug logging in `segment.py` | Founder (Rhelton) | 2026-05-04 |
| R-05-10 | T-05-06-03 | `compose.py` is pure transform — no I/O | Founder (Rhelton) | 2026-05-04 |
| R-05-11 | T-05-07-02 | Pupil/iris radius swap is caller responsibility — documented | Founder (Rhelton) | 2026-05-04 |
| R-05-12 | T-05-07-03 | `normalize.py` is pure transform — no I/O | Founder (Rhelton) | 2026-05-04 |
| R-05-13 | T-05-09-04 | Jensen zone strings are public iridology lore, no PII | Founder (Rhelton) | 2026-05-04 |
| R-05-14 | T-05-09-05 | Authoritative-misclassification mitigated downstream by LGPD prompt (Phase 7) + `confidence` caps | Founder (Rhelton) | 2026-05-04 |
| R-05-15 | T-05-10-05 | model_version manual bump policy per D-PM1 | Founder (Rhelton) | 2026-05-04 |
| R-05-16 | T-05-11-05 | Trigger hammering capped by Modal billing + D-T3 disabling Reprocessar while pending | Founder (Rhelton) | 2026-05-04 |
| R-05-17 | T-05-12-06 | Bad-body flood handled by Vercel rate-limit; webhook rejects fast (no DB write on HMAC fail) | Founder (Rhelton) | 2026-05-04 |
| R-05-18 | T-05-13-05 | Hot-loop trigger is user-initiated; trigger route status guard rejects already-processing | Founder (Rhelton) | 2026-05-04 |
| R-05-19 | T-05-15-07 | Long pytest CPU run <2 min; GitHub free tier 2000 min/month covers it | Founder (Rhelton) | 2026-05-04 |
| R-05-20 | T-05-16-05 | Audit scope is `vision-service/{pipeline,data,scripts,tests/fixtures}` — small tree, fast | Founder (Rhelton) | 2026-05-04 |
| R-05-21 | T-05-17-05 | Smoke pass tracking via founder dogfooding journal — solo-tenant pre-Stage-2; revisited Phase 8 LGPD | Founder (Rhelton) | 2026-05-04 |

---

## Unregistered Threat Surface

None. All 17 SUMMARY.md `## Threat Flags` sections explicitly state "no new threat surface beyond the plan's threat register" or equivalent. No unregistered attack surface introduced during implementation.

---

## Informational Findings (non-blocking, doc-only)

These items surfaced during audit but are NOT security blockers — recommend follow-up housekeeping commits.

1. **Jensen map version still `0.1.0-draft`** at `vision-service/data/jensen-map.json:3`, despite founder approval recorded in `05-09-SUMMARY.md` ("APPROVED 2026-05-04 with one fix"). The procedural acceptance criterion (version-bump) was missed but the **security control** (T-05-09-02 Jensen drift mitigation) is the founder checkpoint, which IS recorded.
2. **`apps/web/.env.example`** Modal block lacks the per-var comments that 05-17 Task 1 specified (`Get from https://modal.com/settings/tokens`, `openssl rand -hex 32` hint, `URL printed by modal deploy modal_app.py`). The `vision-service/.env.example` and `vision-service/README.md` carry equivalent guidance. Not a security threat — T-05-17-01 mitigation (placeholder-only values, `.gitignore` excluding `.env`) is intact.

Anti-regression spot-checks (informational):
- **B5:** `WEBHOOK_BASE_URL` is canonical across `modal_app.py`, `vision-service/.env.example`, `vision-service/README.md`; legacy `MODAL_WEBHOOK_URL` does NOT appear.
- **B2/B3:** `vision_features=` kwarg used at both `_post_webhook` call sites; webhook Zod envelope uses `.optional()` + `superRefine` correctly.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-04 | 92 | 92 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-04
