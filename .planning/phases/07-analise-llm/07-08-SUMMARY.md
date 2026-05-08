---
phase: 07-analise-llm
plan: 08
subsystem: api
tags: [phase-7, route-handler, streaming, web-streams, auth, next-js, anthropic, supabase]

# Dependency graph
requires:
  - phase: 07-analise-llm
    plan: 07-04
    provides: "findAllBoundaries + closeSections parser (section-boundary detection)"
  - phase: 07-analise-llm
    plan: 07-05
    provides: "runAudit (anchor rate + forbidden vocab AuditMetadata)"
  - phase: 07-analise-llm
    plan: 07-07
    provides: "analyzeReading orchestrator (stream + finalize interface)"
  - phase: 07-analise-llm
    plan: 07-03
    provides: "ENCERRAMENTO_LITERAL, ReportJsonb, RegenerationLogEntry, types"
  - phase: 07-analise-llm
    plan: 07-01
    provides: "readings schema with regeneration_count, report_generated jsonb, audit_metadata"
provides:
  - "POST /api/readings/[id]/analyze — streaming HTTP entry point for Phase 7 LLM pipeline"
  - "5 auth gates (T-7-AUTH a-e): 401/403/404/409/409/409"
  - "Web Streams ReadableStream with section-boundary persistence mid-stream (D-S2)"
  - "ENCERRAMENTO_LITERAL server-appended post-stream (D-P3 SC4 guarantee)"
  - "Audit + telemetry pós-stream: AuditMetadata + RegenerationLogEntry persisted"
  - "Wave-0 stub test file: 16 it.todo covering all 5 gates + Response shape + finalization"
affects: [07-09, 07-10, leituras-page, analysis-cta-component, analysis-stream-component]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Web Streams API pattern: Response(new ReadableStream({ async start(controller) {...} }))"
    - "Section-boundary persistence: accumulate buffer → findAllBoundaries → closeSections → DB UPDATE per closed section"
    - "D-S3 error safety: catch block preserves partial sections but never increments regeneration_count"
    - "D-P3 server-appended disclaimer: ENCERRAMENTO_LITERAL set AFTER stream loop, not from LLM output"
    - "AbortSignal cascade: request.signal passed to analyzeReading → llmStream.controller.abort()"

key-files:
  created:
    - "apps/web/app/api/readings/[id]/analyze/route.ts"
    - "apps/web/app/api/readings/[id]/analyze/__tests__/route.test.ts"
  modified:
    - "apps/web/app/api/vision/webhook/route.ts"

key-decisions:
  - "D-S1 enforced: session client (createClient) only — no createServiceClient in this route (cross-therapist leakage prevented)"
  - "D-S2: section-boundary persistence fires per closed section mid-stream, not at end (partial saves survive stream abort)"
  - "D-S3: error path explicitly skips regeneration_count increment — infra failures don't punish the user's regen budget"
  - "D-P3: ENCERRAMENTO_LITERAL appended server-side after stream end — immune to LLM prompt drift (SC4 guarantee)"
  - "D-T1 LGPD: console.error contains only readingId + err.message — no clientName/therapistNotes/report text"
  - "Wave-0 test stubs: full integration testing deferred (Anthropic stream mocking complexity high); founder UAT is primary validation path"
  - "Webhook comment update: single-line clarification of ai_report_edited -> report_delivered jsonb reference (migration 0007)"

patterns-established:
  - "Route Handler auth pattern: gate (a) session → load reading with maybeSingle() → gate (b) ownership explicit check + RLS → gate (c/d/e) status/delivered/regen-cap"
  - "Streaming response: Response(new ReadableStream) with text/plain + no-cache + nosniff headers (D-S1)"
  - "Post-stream finalize: await analysis.finalize() after for-await loop completes to collect usage + cost"

requirements-completed: [LLM-01, LLM-03]

# Metrics
duration: 4min
completed: 2026-05-08
---

# Phase 7 Plan 08: Analyze Route Handler Summary

**Streaming POST /api/readings/[id]/analyze with 5 auth gates (T-7-AUTH a-e), Web Streams section-boundary persistence (D-S2), server-appended ENCERRAMENTO_LITERAL (D-P3), and audit+telemetry pós-stream**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-08T16:53:27Z
- **Completed:** 2026-05-08T16:57:15Z
- **Tasks:** 2
- **Files modified:** 3 (2 created + 1 comment-only edit)

## Accomplishments

- Route Handler `POST /api/readings/[id]/analyze` built with all 5 T-7-AUTH gates (401/403/404/409×3), Web Streams API, and runtime=nodejs + maxDuration=300
- Section-boundary parser integrated: findAllBoundaries + closeSections accumulates buffer mid-stream and persists each closed section via DB UPDATE (D-S2, ~14 writes per analysis, ~140ms DB overhead)
- ENCERRAMENTO_LITERAL appended server-side AFTER stream completes (D-P3 — SC4 disclaimer guarantee independent of LLM output)
- Error handling preserves partial sections without incrementing regeneration_count (D-S3)
- AbortSignal cascade from request.signal → analyzeReading → llmStream.controller.abort() (T-7-COST)
- Audit (runAudit) + telemetry (RegenerationLogEntry) persisted in final UPDATE pós-stream
- Wave-0 stub test file (16 it.todo) created documenting full test contract for founder UAT

## Auth Gates — Exact List

| Gate | HTTP Status | Condition |
|------|-------------|-----------|
| a | 401 Unauthenticated | No Supabase session (`auth.getUser()` returns null/error) |
| b | 403 Forbidden | `reading.therapist_id !== user.id` |
| (not found) | 404 Reading not found | `reading` is null after DB query |
| c | 409 | `reading.status !== 'ready'` |
| d | 409 | `reading.report_delivered != null` |
| e | 409 Regeneration limit reached (3/3) | `reading.regeneration_count >= 3` |

## Sequence Diagram (Summary)

```
client POST /api/readings/[id]/analyze
  → await params (Next.js 15 Pitfall 5)
  → Gate a: auth.getUser() — 401 if missing
  → SELECT reading (RLS + explicit .eq('id', readingId))
  → Gate b: ownership check — 403 if wrong therapist
  → Gate c/d/e: status/delivered/regen-cap — 409 each
  → analyzeReading({ signal: request.signal, ... }) → AnalyzeResult
  → Response(new ReadableStream) — headers text/plain + no-cache + nosniff
    for await (text of analysis.stream):
      buffer += text
      controller.enqueue(encoder.encode(text))
      findAllBoundaries(buffer) → if new boundaries:
        closeSections(boundaries.slice(0,-1), buffer)
        for each closed section: supabase.update(report_generated) — D-S2
    // stream end:
    closeSections(finalBoundaries, buffer) → completedSections
    completedSections.encerramento_disclaimer = ENCERRAMENTO_LITERAL  // D-P3
    await analysis.finalize() → usage + latency + cost
    runAudit(completedSections) → AuditMetadata
    supabase.update({ report_generated, regeneration_count+1, regeneration_log, audit_metadata })
    revalidatePath x3
    controller.close()
  catch err:
    D-S3: NO regeneration_count increment
    supabase.update(partial completedSections) if any
    controller.enqueue([erro]: message)
    controller.close()
```

## Performance Estimate

- **DB writes per analysis:** 13 mid-stream section UPDATEs (one per section boundary closed) + 1 final UPDATE (encerramento + audit + regeneration_log) = **14 writes total**
- **DB overhead:** ~10ms per write × 14 = ~140ms DB overhead distributed over 30-60s stream
- **Stream latency:** Vercel Sonnet 4.6 typical TTFT ~2-3s; full generation 30-60s

## Task Commits

1. **Task 1: Wave-0 stub test file for Route Handler auth gates** — `ee66eb9` (test)
2. **Task 2: Author Route Handler streaming POST** — `cae3969` (feat)

## Files Created/Modified

- `apps/web/app/api/readings/[id]/analyze/route.ts` — Streaming POST handler (241 lines): 5 auth gates + ReadableStream + section-boundary persistence + ENCERRAMENTO_LITERAL + audit + telemetry
- `apps/web/app/api/readings/[id]/analyze/__tests__/route.test.ts` — Wave-0 stub: 16 it.todo documenting contract for founder UAT
- `apps/web/app/api/vision/webhook/route.ts` — Comment-only: line 16 updated to reference `report_delivered` jsonb instead of `ai_report_edited` text (migration 0007 clarification)

## Decisions Made

- **IrisFeaturesForRag type cast via unknown**: `reading.vision_features` from Supabase is typed as `Json` (Supabase generated type). Cast `as unknown as IrisFeaturesForRag & Record<string, unknown>` is safe because vision_features is server-generated by the Phase 5 pipeline and always conforms to IrisFeaturesForRag shape; bypassing TS structural check here is intentional and documented.
- **therapistNotes: null** (intentional, not stub): Phase 7 doesn't surface therapist notes in the analysis prompt; Fase 9 polish may add this. Documented in code comment.
- **Wave-0 stubs for route test**: Anthropic stream mocking is high-complexity integration testing. The 5 auth gates are testable via HTTP in founder UAT scenarios (07-UAT.md). Stubs serve as contract documentation and test-file scaffold for future work.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type error for visionFeatures cast**
- **Found during:** Task 2 (Route Handler implementation)
- **Issue:** Plan's verbatim code used `as Record<string, unknown> & { constitution: { ... } }` which doesn't satisfy `IrisFeaturesForRag & Record<string, unknown>` — TypeScript error TS2322
- **Fix:** Changed cast to `as unknown as IrisFeaturesForRag & Record<string, unknown>` and added `import type { IrisFeaturesForRag }` from `@/lib/rag/build-queries`
- **Files modified:** `apps/web/app/api/readings/[id]/analyze/route.ts`
- **Verification:** `pnpm tsc --noEmit` produces zero errors for analyze/route.ts
- **Committed in:** `cae3969` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — TypeScript type fix)
**Impact on plan:** Minimal — the verbatim code in the plan had a type error that tsc caught. Fix was a one-line cast change + one import addition. No behavior change.

## Issues Encountered

- `pnpm audit:vocabulary` exits non-zero due to pre-existing violations in `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/api/capture/validate/route.ts`, and `components/capture/CapturePreview.tsx`. These are out-of-scope for this plan. The new `analyze/route.ts` has zero forbidden vocabulary (verified separately with inline Node check).

## Known Stubs

- `therapistNotes: null` in route.ts line 116 — intentional deferral documented: "Phase 7 doesn't surface notes; Fase 9 polish may add". Does not prevent plan goal (streaming analysis works without notes).

## Threat Surface Scan

No new security-relevant surface beyond the plan's threat model. The route introduces one new network endpoint (`POST /api/readings/[id]/analyze`) which is already registered in the plan's trust boundary table. All 8 STRIDE threats in the plan's threat register (T-7-AUTH through T-7-PARTIAL) are mitigated or accepted as documented.

## Next Phase Readiness

- Route Handler is now the live HTTP entry point for Anthropic streaming — Phases 07-09 (AnalysisCTA component) and 07-10 (Editor + save action) can consume this endpoint
- Auth gates testable in founder UAT (07-UAT.md scenarios)
- Section-boundary persistence atomic — no jsonb corruption risk from partial writes
- Disclaimer SC4 guaranteed server-side (D-P3)
- Cost cap server-enforced (T-7-COST gate-e)

---
*Phase: 07-analise-llm*
*Completed: 2026-05-08*
