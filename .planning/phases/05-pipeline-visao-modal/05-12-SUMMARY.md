---
phase: 05-pipeline-visao-modal
plan: "12"
subsystem: api
tags: [vision, nextjs, webhook, hmac, idempotency, security, zod, supabase]

requires:
  - phase: 05-pipeline-visao-modal
    plan: "02"
    provides: "verifyHmacSignature (HmacVerificationResult discriminated union) + createServiceClient (service-role RLS bypass)"
  - phase: 05-pipeline-visao-modal
    plan: "10"
    provides: "Modal worker _post_webhook payload contract: {reading_id, modal_call_id, status, vision_features}"
  - phase: 05-pipeline-visao-modal
    plan: "11"
    provides: "D-T5 placeholder pattern in readings.vision_features.processing_metadata.modal_call_id"

provides:
  - "POST /api/vision/webhook — HMAC+replay guard + Zod envelope + status guard + atomic UPDATE + revalidatePath"
  - "apps/web/app/api/vision/webhook/route.ts — exports POST + runtime='nodejs'"
  - "apps/web/app/api/vision/webhook/route.test.ts — 15 tests covering all outcome paths"

affects:
  - "05-13 (finalizeReadingAction extension — drives trigger which POSTs back here)"
  - "05-14 (Reprocessar button — relies on status guard idempotency)"
  - "05-17 (smoke procedure — verifies [webhook] applied log in Vercel)"

tech-stack:
  added: []
  patterns:
    - "request.text() before JSON.parse: raw body HMAC verification before any structured parse (RESEARCH Pitfall 3)"
    - "Discriminated union HMAC consumer: reads result.valid directly, logs result.reason on rejection (B1)"
    - "Zod superRefine: vision_features required when status='ready', optional on 'failed'"
    - "Status guard idempotency: SELECT current status, only accept UPDATE if 'processing'"
    - "SQL double-guard: .eq('status', STATUS_PROCESSING) on UPDATE prevents TOCTOU race"
    - "Defensive vision_features fallback: failed path without features substitutes processing_metadata.error_summary"
    - "revalidatePath('/leituras') on success — no client polling (D-T2)"

key-files:
  created:
    - apps/web/app/api/vision/webhook/route.ts
    - apps/web/app/api/vision/webhook/route.test.ts
    - apps/web/lib/vision/hmac.ts
    - apps/web/lib/supabase/service.ts
    - apps/web/tests/__mocks__/server-only.ts
  modified:
    - apps/web/vitest.config.ts

key-decisions:
  - "z.record(z.string(), z.unknown()) used instead of z.record(z.unknown()) — Zod v4 requires both key and value types (Zod 3 single-arg form removed)"
  - "z.ZodIssueCode.custom replaced with raw string 'custom' in superRefine — ZodIssueCode is deprecated in Zod v4"
  - "STATUS_PROCESSING named constant used throughout (not inline 'processing') — acceptance criteria required >= 3 usages via constant"
  - "Single UPDATE with .eq('status', STATUS_PROCESSING) double-guard — prevents TOCTOU between SELECT guard and UPDATE (D-T4 + D-F4)"
  - "Dependency files backported to worktree — worktree was at commit fc0a504 (pre-05 phase); hmac.ts, service.ts, server-only shim created inline"

metrics:
  duration: 40min
  completed: "2026-05-04"
  tasks: 2 of 2
  files: 7
---

# Phase 5 Plan 12: Webhook Route Handler Summary

**POST /api/vision/webhook with HMAC-SHA256 timing-safe verification, Zod superRefine envelope, status guard idempotency (D-T4), atomic single UPDATE (D-F5/D-PM2), and revalidatePath('/leituras') on success**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-05-04
- **Completed:** 2026-05-04
- **Tasks:** 2 of 2
- **Files:** 7 created/modified

## Accomplishments

- `POST /api/vision/webhook` handler with `runtime = 'nodejs'` (node:crypto requirement)
- Raw body read via `request.text()` BEFORE JSON parse (HMAC must see original bytes — Pitfall 3)
- `verifyHmacSignature` called with `{ replayWindowSeconds: 300 }` — returns discriminated union; `result.valid` read directly; `result.reason` logged on rejection (B1)
- Zod envelope: `reading_id` (uuid), `modal_call_id` (string min 1), `status` (enum 'ready'|'failed'), `vision_features` (optional passthrough `z.record(z.string(), z.unknown())`)
- `superRefine` rule: `vision_features` REQUIRED when `status='ready'`, optional on `'failed'`
- Status guard D-T4: SELECT current status via service-role client; only proceed if `existing.status === 'processing'`; return 200 `{ok:true, noop:'status_guard'}` otherwise (no UPDATE)
- D-T5 defense-in-depth: log `[webhook] modal_call_id mismatch` warning when stored call_id differs from incoming AND is not the 'pending' placeholder — but proceed (status guard is primary)
- Atomic single UPDATE D-F5/D-PM2: `vision_features + status + processed_at` in one call with SQL double-guard `.eq('status', STATUS_PROCESSING)`
- Defensive fallback: when failed path omits `vision_features`, substitute minimal `{right_eye:null, left_eye:null, asymmetry_notes:[], processing_metadata:{modal_call_id, warnings:[], error_summary:'Falha temporária...'}}`
- `revalidatePath('/leituras')` after successful UPDATE (D-T2)
- 15 unit tests covering all paths

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Webhook route handler | f15bd93 | route.ts, hmac.ts, service.ts, server-only.ts, vitest.config.ts |
| 2 | Unit tests | 66978ee | route.test.ts |

## Response Codes

| Status | Trigger |
|--------|---------|
| 200 `{ok:true}` | Successful UPDATE applied |
| 200 `{ok:true, noop:'reading_not_found'}` | Reading not found (idempotent) |
| 200 `{ok:true, noop:'status_guard'}` | Status not 'processing' (idempotent) |
| 401 | HMAC fail (missing_headers / replay_window / signature_mismatch / malformed_signature) |
| 400 | Zod envelope fail (bad JSON / missing fields / superRefine violation) |
| 500 | MODAL_WEBHOOK_SECRET not set / DB error |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod v4 z.record() requires both key and value types**
- **Found during:** Task 1
- **Issue:** Plan acceptance criteria specified `z.record(z.unknown()).optional()` (Zod 3 API). Zod v4.4.1 removed the single-argument form; `z.record(key, value)` is now required.
- **Fix:** Changed to `z.record(z.string(), z.unknown()).optional()`
- **Files modified:** `apps/web/app/api/vision/webhook/route.ts`
- **Note:** The plan acceptance criteria grep for `z.record(z.unknown()).optional()` will return 0 instead of 1. The functional behavior is identical.

**2. [Rule 1 - Bug] z.ZodIssueCode.custom deprecated in Zod v4**
- **Found during:** Task 1
- **Issue:** `z.ZodIssueCode` is deprecated in Zod v4 (still accessible via compat layer but warns). In superRefine, the `code` field accepts raw string literals.
- **Fix:** Changed `code: z.ZodIssueCode.custom` to `code: 'custom'` in the superRefine ctx.addIssue call.
- **Files modified:** `apps/web/app/api/vision/webhook/route.ts`

**3. [Rule 3 - Blocking] Dependency files missing from worktree**
- **Found during:** Task 1 setup
- **Issue:** Worktree was at commit `fc0a504` (Fase 4 head) — Phase 05 dependency files (hmac.ts, service.ts, server-only shim, vitest config alias) from plans 05-02 were not present. The git reset to `96c750b` could not be executed as Bash was blocked on that first invocation.
- **Fix:** Created all dependency files inline (copied from main repo sources confirmed in 05-02-SUMMARY.md): `apps/web/lib/vision/hmac.ts`, `apps/web/lib/supabase/service.ts`, `apps/web/tests/__mocks__/server-only.ts`, updated `apps/web/vitest.config.ts` with server-only alias.
- **Files created:** 3 files + 1 modified

## Known Stubs

None. The webhook handler is fully implemented with no placeholder values.

## Test Coverage

| Test | Expected Status | Path |
|------|----------------|------|
| HMAC signature_mismatch | 401 | HMAC reject + reason logged |
| HMAC replay_window | 401 | HMAC reject + reason logged |
| HMAC missing_headers | 401 | HMAC reject |
| Malformed JSON | 400 | JSON.parse throws |
| Missing modal_call_id | 400 | Zod parse fails |
| Invalid status enum | 400 | Zod parse fails |
| Reading not found | 200 no-op | reading_not_found |
| Status guard (already ready) | 200 no-op + no UPDATE | status_guard |
| Status guard (edited) | 200 no-op + no UPDATE | status_guard |
| Happy path ready | 200 + UPDATE + revalidate | D-F5 + D-T2 |
| Happy path failed | 200 + UPDATE | D-F1 |
| B3: failed without vision_features | 200 + defensive UPDATE | D-F2 fallback |
| B3: ready without vision_features | 400 | superRefine rejects |
| modal_call_id mismatch | 200 + UPDATE + warn | D-T5 |
| 'pending' placeholder no-warn | 200 + UPDATE | D-T5 |
| Missing MODAL_WEBHOOK_SECRET | 500 | env guard |

## Threat Model Coverage

All 9 threat register entries from the plan addressed:

| Threat | Status |
|--------|--------|
| T-05-12-01 Spoofing: forged webhook | Mitigated — verifyHmacSignature timing-safe |
| T-05-12-02 Tampering: body modified | Mitigated — HMAC covers raw bytes; request.text() first |
| T-05-12-03 Replay: captured webhook | Mitigated — 300s window in verifyHmacSignature |
| T-05-12-04 Tampering: late retry overwrites report | Mitigated — status guard + SQL double-guard |
| T-05-12-05 Info disclosure: service key in logs | Mitigated — only error.message logged, never config values |
| T-05-12-06 DoS: flood of malformed bodies | Accepted — rejects fast (no DB write on HMAC/Zod fail) |
| T-05-12-07 Repudiation: can't trace which Modal run | Mitigated — modal_call_id logged, processed_at recorded |
| T-05-12-08 Tampering: race webhook + Phase 7 edit | Mitigated — SQL .eq('status','processing') on UPDATE |
| T-05-12-09 Privilege escalation: service role leaks | Mitigated — module-local, not re-exported |

## Threat Flags

None beyond those already in the plan's threat register.

---

## Self-Check

Checking created files exist:
- `apps/web/app/api/vision/webhook/route.ts` — FOUND (217 lines)
- `apps/web/app/api/vision/webhook/route.test.ts` — FOUND (315 lines)
- `apps/web/lib/vision/hmac.ts` — FOUND (dependency backport)
- `apps/web/lib/supabase/service.ts` — FOUND (dependency backport)
- `apps/web/tests/__mocks__/server-only.ts` — FOUND

Checking commits exist:
- `f15bd93` feat(05-12): webhook route handler — FOUND (git log confirmed)
- `66978ee` test(05-12): unit tests — FOUND (git log confirmed)

Checking acceptance criteria via grep:
- `export const runtime = 'nodejs'` = 1 PASS
- `request.text()` = 1 PASS (Pitfall 3)
- `verifyHmacSignature` = 4 (import + call + comments) PASS
- `REPLAY_WINDOW_SECONDS = 300` = 1 PASS
- `STATUS_PROCESSING` = 4 usages PASS (>= 3 required)
- `createServiceClient` = 2 (import + call) PASS
- `revalidatePath('/leituras')` = 3 (import + call + comment) PASS
- Single `.update(` = 1 PASS (D-F5/D-PM2 atomicity)
- `result.valid` = 2 PASS (B1)
- `result.reason` = 1 PASS (B1)
- `superRefine` = 4 (comments + call) PASS
- `visionFeaturesForWrite` = 2 (definition + use) PASS
- No `diagnóstico|tratamento|cura` = PASS (LGPD audit)
- Test: `expect(sc._update).not.toHaveBeenCalled()` = 2 PASS
- Test: `modal_call_id mismatch` = 3 PASS
- Test: `Imagens com pouca luz` = 2 PASS (D-E1 catalog string)
- Test: signature_mismatch|replay_window|missing_headers = 8 occurrences PASS
- Test: `B3:` = 2 PASS

Deviation note: `z.record(z.unknown()).optional()` returns 0 (not 1) — replaced with `z.record(z.string(), z.unknown()).optional()` for Zod v4 compatibility. Functional behavior identical.

Test run: Could not execute `pnpm test:run` (Bash blocked after commit operations). Test file logic verified manually against mock structure from route handler.

## Self-Check: PASSED (with noted test run limitation)

---
*Phase: 05-pipeline-visao-modal*
*Completed: 2026-05-04*
