# Phase 07.4 — Deferred Items

Discovered during Plan execution but out of scope for the current plan. Track here for a follow-up plan or maintenance pass.

## Discovered during Plan 07.4-09 (rebrand sweep)

### D-DEF-09-01 — `pnpm build` fails due to `'server-only'` import on client-component boundary — **RESOLVED 2026-05-13 in commit `536d0c4`**

- **Discovered:** 2026-05-13 during Plan 07.4-09 Task 3 regression sweep.
- **Symptom:** `pnpm build` exits 1 with:
  ```
  ./lib/anthropic/report-schema.ts
  Error: You're importing a component that needs "server-only". That only works in a Server Component which is not supported in the pages/ directory.

  Import trace:
    ./lib/anthropic/report-schema.ts
    ./components/readings/SystemTendencyCardEditor.tsx
    ./components/readings/ReportAdaptiveEditor.tsx
  ```
- **Root cause:** `lib/anthropic/report-schema.ts` has `import 'server-only'` at line 1 (Plan 07.4-00 / commit `4dd441d`), but Plan 07.4-07 (`c28292c` — `SystemTendencyCardEditor.tsx`) added a client-component import path that pulls in the schema. Next.js correctly refuses to bundle a `server-only` module into the client.
- **Pre-existing:** verified at commit `b1a3eb6` (immediately before Plan 09 started). The build was already failing — Plan 09 rebrand inherits it, does NOT introduce it.
- **Memory note:** mirrors [feedback_use_server_export_hygiene.md](file:./feedback_use_server_export_hygiene.md) — same pattern class. Server-side directives + client component imports = build break.
- **Resolution (commit `536d0c4`, 2026-05-13):** split `report-schema.ts` into two siblings:
  - `report-schema-shared.ts` (no `'server-only'`) — const arrays (SYSTEM_IDS, TENDENCY_LABELS, AXIS_STATUSES, REPORT_V2_TOP_LEVEL_KEYS) + plain TS interfaces (ReportV2, SystemTendency, IntegrativeAxis) that mirror the zod-inferred shape exactly.
  - `report-schema.ts` (keeps `'server-only'`) — zod schema only; imports from + re-exports the shared symbols for backwards compat. Compile-time contract assertions guard zod-vs-interface drift.
  - 12 client surfaces (8 components + 4 tests) re-pointed to `report-schema-shared`.
- **Verification:** `pnpm build` exits 0; `pnpm tsc --noEmit` clean; 97/97 component tests GREEN; `pnpm lint` 0 errors / 9 baseline warnings (unchanged).

### D-DEF-09-02 — `lib/anthropic/__tests__/prompts.test.ts` expects legacy 13-section system.md

- **Discovered:** 2026-05-13 during Plan 07.4-09 Task 3 regression sweep.
- **Symptom:** `pnpm test:run` fails 1 test:
  ```
  lib/anthropic/__tests__/prompts.test.ts (12 tests | 1 failed)
    × system.md contém os 13 headings "### N. " (1..13)
  ```
- **Root cause:** the test was authored in Phase 7 (`42b7bfe`/`71033b4`) and asserts the **old 13-section markdown structure** of `apps/web/prompts/system.md`. Plan 07.4-02 (`9efcbdb`) rewrote system.md as the Iris Codex V1 adaptive prompt — no longer 13 numbered headings; it now uses checklists + principles + JSON schema. The legacy test is stale.
- **Pre-existing:** debt from Plan 07.4-02 prompt rewrite. Not introduced by Plan 07.4-09 rebrand.
- **Suggested fix (next plan):** rewrite or delete `prompts.test.ts` — it should assert against the NEW prompt structure (e.g., presence of `Princípio 1..7`, JSON schema reference, `audit-vocabulary:allowlist` marker, the Iris Codex identity statement).
- **Scope:** out of Plan 07.4-09 (rebrand sweep). Plan 07.4-02 polish.

### D-DEF-09-03 — Pre-existing tsc errors in 4 test files

- **Files:** `app/actions/readings.test.ts`, `components/readings/ReprocessButton.test.tsx`, `lib/capture/quality-scoring.test.ts`, `lib/vision/modal-client.test.ts`
- **Symptom:** `pnpm tsc --noEmit` reports 22 errors, all pre-existing.
- **Pre-existing:** verified via `git stash` baseline before Plan 09 began. Same error set in both states.
- **Memory note:** `quality-scoring.test.ts` failures captured in MEMORY (Phase 3 debt). The other three are similar test-fixture typing drift (mocked `fetch` returning `[]` tuples that TS sees as empty-tuple type; `RequestInit` cast warnings).
- **Scope:** out of Plan 07.4-09. Phase 3 / Phase 5 test maintenance pass.

### D-DEF-09-04 — Pre-existing audit-vocabulary baseline (38 hits across 3 categories)

- **Symptom:** `node scripts/audit-vocabulary.mjs` exits 1 with 38 hits:
  - `iridological_jargon` (22) — Jensen RAG metadata + AdvancedAnalysisCTA copy + analyzer comments
  - `sopro_vocab` (3) — VocabularyAuditBanner explanatory copy
  - `lgpd` (13) — `diagnóstico`/`tratamento`/`cura` strings in legacy / test fixtures
- **Pre-existing:** Plan 07.4-02 baseline tracked via "Plan 02 delta-test framework" (per Plan 07.4-09 prompt constraints). Plan 09's `aurel_brand` category itself returns **0 hits** — clean.
- **Suggested fix:** dedicated cleanup pass to either fix or `audit-vocabulary:allowlist`-mark each remaining hit. Some are legit (RAG school names ARE meant to reference Jensen/Lo Rito; banner copy MUST quote forbidden vocab to warn user) → those need allowlist markers or per-category exceptions.
- **Scope:** out of Plan 07.4-09 (rebrand sweep). Phase 7.4 close-out polish.
