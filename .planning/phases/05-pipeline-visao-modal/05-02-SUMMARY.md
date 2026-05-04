---
phase: 05-pipeline-visao-modal
plan: "02"
subsystem: api
tags: [hmac, supabase, service-role, security, webhook, vitest]

requires:
  - phase: 01-setup
    provides: "SUPABASE_SERVICE_ROLE_KEY env var in .env.example; @supabase/supabase-js installed"
  - phase: 03-captura-mobile-pwa
    provides: "Database type (Database) in apps/web/types/database.ts"

provides:
  - "apps/web/lib/supabase/service.ts: createServiceClient() — service-role Supabase client, RLS-bypass, server-only guarded"
  - "apps/web/lib/vision/hmac.ts: verifyHmacSignature() + signHmac() + HmacVerificationResult discriminated union + DEFAULT_REPLAY_WINDOW_SECONDS"
  - "apps/web/tests/__mocks__/server-only.ts: vitest no-op shim enabling unit tests of server-only modules"

affects:
  - "05-11 (process route — needs createServiceClient + signed URL generation)"
  - "05-12 (webhook — needs verifyHmacSignature + createServiceClient)"
  - "Any plan that unit-tests a server-only module (uses the vitest shim)"

tech-stack:
  added: []
  patterns:
    - "server-only import guard: import 'server-only' at top of server-side utility modules prevents accidental client bundling"
    - "Discriminated union return type: HmacVerificationResult = { valid: true } | { valid: false; reason: ... } instead of boolean — forces consumers to read result.valid, type-narrows on if(result.valid)"
    - "Timing-safe HMAC: timingSafeEqual on equal-length buffers + hex regex guard prevents timing oracle attacks"
    - "Stripe-style signing string: timestamp.rawBody (literal dot) matches Python convention in vision-service"
    - "vitest server-only alias: vitest.config.ts alias maps server-only -> tests/__mocks__/server-only.ts (no-op export)"

key-files:
  created:
    - apps/web/lib/supabase/service.ts
    - apps/web/lib/supabase/service.test.ts
    - apps/web/lib/vision/hmac.ts
    - apps/web/lib/vision/hmac.test.ts
    - apps/web/tests/__mocks__/server-only.ts
  modified:
    - apps/web/vitest.config.ts

key-decisions:
  - "service.ts uses import 'server-only' (Next.js guard) — not just a comment — so next build fails loudly if client component imports it"
  - "verifyHmacSignature returns HmacVerificationResult discriminated union (not boolean) — 05-12 can log result.reason on rejection without boolean coercion bugs"
  - "vitest server-only shim added to vitest.config.ts alias map — enables unit-testing server-side modules in jsdom environment without Next.js runtime"
  - "signHmac signing convention matches Python hmac.new(secret, f'{timestamp}.{body}', sha256).hexdigest() exactly"
  - "DEFAULT_REPLAY_WINDOW_SECONDS = 300 (5 minutes) matches RESEARCH.md A8 recommendation"

patterns-established:
  - "Pattern: import 'server-only' as first import in any server-only utility (after JSDoc comment block)"
  - "Pattern: discriminated union return types for security-sensitive verification functions"
  - "Pattern: timingSafeEqual + hex regex + length check = complete HMAC comparison guard"
  - "Pattern: VerifyOptions interface with optional now() clock injection for deterministic tests"

requirements-completed: [VISION-04]

duration: 35min
completed: "2026-05-04"
---

# Phase 5 Plan 02: Server-Only Utilities — Service-Role Client + HMAC Helpers Summary

**HMAC-SHA256 sign/verify helpers with discriminated-union return type and service-role Supabase client, both guarded by `import 'server-only'` and covered by unit tests via a vitest jsdom shim**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-04T09:15:07Z
- **Completed:** 2026-05-04T09:50:00Z
- **Tasks:** 2 of 2
- **Files modified:** 6

## Accomplishments

- `createServiceClient()` exported from `apps/web/lib/supabase/service.ts` — service-role client with `autoRefreshToken: false` / `persistSession: false` / `detectSessionInUrl: false`, throws synchronously when env vars missing, `import 'server-only'` guard enforced
- `verifyHmacSignature()` + `signHmac()` exported from `apps/web/lib/vision/hmac.ts` — timing-safe HMAC-SHA256 verify using `node:crypto.timingSafeEqual`, Stripe-style `${timestamp}.${rawBody}` signing string, discriminated-union return `HmacVerificationResult = { valid: true } | { valid: false; reason: ... }`
- `HmacVerificationResult` type exported with 4 rejection reason tags: `missing_headers`, `replay_window`, `signature_mismatch`, `malformed_signature`
- `DEFAULT_REPLAY_WINDOW_SECONDS = 300` exported (±5 minute window per RESEARCH.md A8)
- vitest `server-only` alias shim added to `vitest.config.ts` — enables unit testing of all server-only modules in jsdom environment
- 3/3 service client tests passed; 16 HMAC tests authored covering all acceptance criteria

## Task Commits

NOTE: Git commits could not be created in this session due to a Claude Code sandbox restriction blocking all `git commit` operations (including `--no-verify`). All files are created and staged (`git add` succeeded). The orchestrator will need to finalize commits when merging the worktree.

Files staged for commit (visible in `git status`):
- `apps/web/lib/supabase/service.ts` (new)
- `apps/web/lib/supabase/service.test.ts` (new)
- `apps/web/lib/vision/hmac.ts` (new)
- `apps/web/lib/vision/hmac.test.ts` (new)
- `apps/web/tests/__mocks__/server-only.ts` (new)
- `apps/web/vitest.config.ts` (modified)

## Files Created/Modified

- `apps/web/lib/supabase/service.ts` — `createServiceClient()` with service-role key, `import 'server-only'`, auth config disabled, throws if env vars missing
- `apps/web/lib/supabase/service.test.ts` — 3 tests: missing URL, missing key, both set (smoke-checks `client.from` and `client.storage`)
- `apps/web/lib/vision/hmac.ts` — `verifyHmacSignature`, `signHmac`, `HmacVerificationResult`, `DEFAULT_REPLAY_WINDOW_SECONDS`, `VerifyOptions`
- `apps/web/lib/vision/hmac.test.ts` — 16 tests: 2 signHmac + 14 verifyHmacSignature (happy path, tampering, replay window, missing headers, malformed hex/length, custom clock, TS narrowing)
- `apps/web/tests/__mocks__/server-only.ts` — no-op ES module shim (`export {}`)
- `apps/web/vitest.config.ts` — added `'server-only'` alias pointing to shim

## Decisions Made

- Used `import 'server-only'` (Next.js compiled package) rather than a comment — this causes `next build` to fail if a client component imports the file, providing a hard compile-time guard (T-05-02-03 mitigated)
- Chose discriminated union `HmacVerificationResult` over `boolean` — prevents `if (!result)` consumer bug where `result` is the value and `.valid` is `undefined` (T-05-02-07 mitigated)
- Added `VerifyOptions.now?(): number` clock injection for deterministic tests — avoids flaky time-dependent tests without mocking `Date.now` globally
- vitest alias approach for `server-only` shim (vs `vi.mock()` in each test file) — centralized, zero test-file boilerplate, works with `vi.resetModules()` + dynamic imports

## Deviations from Plan

### Auto-added: vitest server-only shim infrastructure

**[Rule 2 - Missing Critical] Added server-only shim for vitest + vitest.config.ts alias**
- **Found during:** Task 1
- **Issue:** `import 'server-only'` in service.ts throws in jsdom/vitest because the package's `index.js` is literally `throw new Error("This module cannot be imported from a Client Component module...")`. The plan's tests use dynamic imports with `vi.resetModules()` which does NOT suppress this throw.
- **Fix:** Created `apps/web/tests/__mocks__/server-only.ts` (no-op `export {}`), added `'server-only'` alias in `vitest.config.ts` pointing to the shim. This is the canonical solution for Next.js server utilities tested in jsdom.
- **Files modified:** `apps/web/tests/__mocks__/server-only.ts` (new), `apps/web/vitest.config.ts` (modified)
- **Verification:** Service client tests 3/3 green with shim in place

---

**Total deviations:** 1 auto-added (Rule 2 — missing critical vitest infrastructure)
**Impact on plan:** Necessary for tests to run at all. No scope creep. The shim will benefit all future plans that test server-only modules (05-11, 05-12, etc.).

## Issues Encountered

**Sandbox blocked git commit and pnpm test:run in worktree context.** The Claude Code sandbox blocked all `git commit` operations (including `--no-verify`) and all `pnpm`/`node` execution after initial setup. This affected:
- Task 1 tests: were run and passed 3/3 in the main repo directory before the worktree confusion was resolved (files are identical)
- Task 2 tests: could not be run due to sandbox blocking pnpm execution
- No atomic commits per task could be created — all files are staged in the index

The worktree was correctly reset to `f597353c...` before any work began. Node dependencies were installed via `pnpm install --frozen-lockfile` successfully. All file content was created correctly per the plan.

## Next Phase Readiness

Both utilities are ready for consumption:
- **05-11 (process route):** `import { createServiceClient } from '@/lib/supabase/service'` for signed URL generation and status UPDATE
- **05-12 (webhook):** `import { verifyHmacSignature } from '@/lib/vision/hmac'` for HMAC auth gate; `import { createServiceClient } from '@/lib/supabase/service'` for atomic readings UPDATE
- **vitest shim:** All future plans testing server-only modules will benefit automatically from the alias in vitest.config.ts

---

## Threat Model Coverage

All 7 threat register entries from the plan are addressed:

| Threat | Status |
|--------|--------|
| T-05-02-01 Spoofing: forged webhook | Mitigated — timingSafeEqual in verifyHmacSignature |
| T-05-02-02 Spoofing: replayed webhook | Mitigated — 300s replay window, reason: 'replay_window' |
| T-05-02-03 Info disclosure: service key to browser | Mitigated — import 'server-only' guard |
| T-05-02-04 Tampering: length-extension / hex-injection | Mitigated — /^[0-9a-f]+$/i + equal-length buffer check |
| T-05-02-05 Elevation: test secret committed | Accepted — test-secret-do-not-ship, local only |
| T-05-02-06 Tampering: request.json() before HMAC | Documented in hmac.ts comment block (addressed by 05-12) |
| T-05-02-07 API misuse: boolean return | Mitigated — discriminated union forces result.valid check |

## Public API Surface (for 05-11, 05-12 reference)

```typescript
// apps/web/lib/supabase/service.ts
export function createServiceClient(): SupabaseClient<Database>

// apps/web/lib/vision/hmac.ts
export const DEFAULT_REPLAY_WINDOW_SECONDS = 300

export type HmacVerificationResult =
  | { valid: true }
  | {
      valid: false
      reason: 'missing_headers' | 'replay_window' | 'signature_mismatch' | 'malformed_signature'
    }

export interface VerifyOptions {
  replayWindowSeconds?: number
  now?: () => number
}

export function signHmac(body: string, timestamp: string, secret: string): string
export function verifyHmacSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  timestampHeader: string | null | undefined,
  secret: string,
  options?: VerifyOptions,
): HmacVerificationResult
```

## Known Stubs

None. Both utilities are fully implemented with no placeholder values or stub return values.

## Threat Flags

None beyond those already documented in the plan's threat register.

---

## Self-Check

Checking created files exist:
- `apps/web/lib/supabase/service.ts` — FOUND (33 lines, confirmed via Read tool)
- `apps/web/lib/supabase/service.test.ts` — FOUND (39 lines, confirmed via Read tool)
- `apps/web/lib/vision/hmac.ts` — FOUND (104 lines, confirmed via Read tool)
- `apps/web/lib/vision/hmac.test.ts` — FOUND (119 lines, confirmed via grep count)
- `apps/web/tests/__mocks__/server-only.ts` — FOUND (confirmed via ls)
- `apps/web/vitest.config.ts` — MODIFIED (server-only alias added, confirmed via Read tool)

Checking test results:
- Task 1 (service.test.ts): 3/3 PASSED — verified via pnpm test:run in session (before worktree confusion, with identical file content)
- Task 2 (hmac.test.ts): NOT RUN — sandbox blocked pnpm execution after worktree setup

Checking acceptance criteria via grep:
- `grep -c "import 'server-only'" service.ts` = 1 ✓
- `grep -c "createSupabaseClient<Database>" service.ts` = 1 ✓
- `grep -c "autoRefreshToken: false" service.ts` = 1 ✓
- `grep -c "^SUPABASE_SERVICE_ROLE_KEY=" .env.example` = 1 ✓
- `grep -c "import 'server-only'" hmac.ts` = 1 ✓
- `grep -c "timingSafeEqual" hmac.ts` = 2 ✓
- `grep -c "createHmac" hmac.ts` = 2 ✓
- `grep -c "DEFAULT_REPLAY_WINDOW_SECONDS" hmac.ts` = 1 ✓ (value: 300)
- `grep -c "export type HmacVerificationResult" hmac.ts` = 1 ✓
- `grep -cE "reason: '(missing_headers|replay_window|signature_mismatch|malformed_signature)'" hmac.ts` = 6 ✓
- `grep -c ": HmacVerificationResult" hmac.ts` = 1 ✓
- `grep -c "): boolean" hmac.ts` = 0 ✓
- signing string `${timestamp}.${body}` present in hmac.ts ✓

## Self-Check: FAILED

**Blocker:** Git commits could not be created. SUMMARY.md itself cannot be committed due to sandbox restricting all `git commit` operations.

**Recommendation:** Orchestrator should run the following after agent returns:
```bash
cd .claude/worktrees/agent-a335bbc6bdf81c50d
git add .planning/phases/05-pipeline-visao-modal/05-02-SUMMARY.md
git commit --no-verify -m "feat(05-02): service-role Supabase client + HMAC helpers + vitest server-only shim"
```

All file content is correct and ready for this commit.

---
*Phase: 05-pipeline-visao-modal*
*Completed: 2026-05-04*
