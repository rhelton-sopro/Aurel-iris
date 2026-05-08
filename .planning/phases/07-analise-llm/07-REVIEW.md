---
phase: 07-analise-llm
reviewed: 2026-05-08T00:00:00Z
depth: standard
files_reviewed: 47
files_reviewed_list:
  - apps/web/app/(dashboard)/leituras/[id]/analise-client.tsx
  - apps/web/app/(dashboard)/leituras/[id]/editar/__tests__/save-action.test.ts
  - apps/web/app/(dashboard)/leituras/[id]/editar/editar-client.tsx
  - apps/web/app/(dashboard)/leituras/[id]/editar/page.tsx
  - apps/web/app/(dashboard)/leituras/[id]/page.tsx
  - apps/web/app/(dashboard)/leituras/page.tsx
  - apps/web/app/actions/analise.schemas.ts
  - apps/web/app/actions/analise.ts
  - apps/web/app/api/readings/[id]/analyze/__tests__/route.test.ts
  - apps/web/app/api/readings/[id]/analyze/route.ts
  - apps/web/app/api/vision/webhook/route.ts
  - apps/web/components/readings/AnalysisCTA.tsx
  - apps/web/components/readings/AnalysisHero.tsx
  - apps/web/components/readings/AnalysisStream.tsx
  - apps/web/components/readings/DeliverDialog.tsx
  - apps/web/components/readings/EditorAccordion.tsx
  - apps/web/components/readings/EditorAuditBanner.tsx
  - apps/web/components/readings/EditorSectionItem.tsx
  - apps/web/components/readings/StatusBadge.tsx
  - apps/web/components/readings/__tests__/AnalysisCTA.test.tsx
  - apps/web/components/readings/__tests__/AnalysisStream.test.tsx
  - apps/web/components/readings/__tests__/EditorAccordion.test.tsx
  - apps/web/components/readings/__tests__/EditorSectionItem.test.tsx
  - apps/web/components/ui/accordion.tsx
  - apps/web/lib/anthropic/__tests__/audit.test.ts
  - apps/web/lib/anthropic/__tests__/client.test.ts
  - apps/web/lib/anthropic/__tests__/diff.test.ts
  - apps/web/lib/anthropic/__tests__/integration.test.ts
  - apps/web/lib/anthropic/__tests__/parser.test.ts
  - apps/web/lib/anthropic/__tests__/prompts.test.ts
  - apps/web/lib/anthropic/analyze.ts
  - apps/web/lib/anthropic/audit.ts
  - apps/web/lib/anthropic/client.ts
  - apps/web/lib/anthropic/diff.ts
  - apps/web/lib/anthropic/parser.ts
  - apps/web/lib/anthropic/prompts.ts
  - apps/web/lib/anthropic/types.ts
  - apps/web/lib/rag/__tests__/section-queries.test.ts
  - apps/web/next.config.ts
  - apps/web/package.json
  - apps/web/prompts/feature-injection.md
  - apps/web/prompts/system.md
  - apps/web/scripts/__tests__/audit-vocabulary.test.mjs
  - apps/web/scripts/audit-vocabulary.mjs
  - apps/web/types/database.ts
  - supabase/migrations/0007_phase_7_analise_llm.sql
  - supabase/tests/0007_jsonb_concat_order.sql
findings:
  critical: 6
  warning: 13
  info: 5
  total: 24
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-05-08
**Depth:** standard
**Files Reviewed:** 47
**Status:** issues_found

## Summary

Phase 7 (Análise LLM) introduces a streaming Anthropic-backed analysis pipeline, an editor flow, an audit module, a diff classifier, and a 0007 migration moving from text columns to jsonb-canonical reports. The architecture is generally sound — prompt caching, abort plumbing, parser defenses (Pitfall 2), and the LGPD vocabulary self-match guard are all carefully thought through. **However, the streaming Route Handler at `app/api/readings/[id]/analyze/route.ts` has multiple correctness defects that put data integrity, cost control, and LGPD compliance at risk in production.** Specifically: TOCTOU races on `regeneration_count` and `regeneration_log`, silent failure of mid-stream UPDATEs, no re-application of `ENCERRAMENTO_LITERAL` on save (D-P3 contract weak), no cleanup of stale `audit_metadata` on partial-stream errors, and `markReadingDelivered` allowing terminal flip with empty `report_delivered`. The editor flow has a related defense-in-depth gap: `saveReportDelivered` accepts arbitrary `encerramento_disclaimer` content (passthrough schema). Test coverage is heavily skewed toward unit tests of pure modules (audit, diff, parser, prompts); the Route Handler and Server Actions are stubbed `it.todo()` only.

## Critical Issues

### CR-01: TOCTOU race on `regeneration_count` cap (gate e bypassable)

**File:** `apps/web/app/api/readings/[id]/analyze/route.ts:94-100, 191`
**Issue:** Gate (e) reads `currentCount = reading.regeneration_count ?? 0` once at request start (line 94), then increments via `regeneration_count: currentCount + 1` at line 191 after the stream finishes. Two concurrent requests both observing `currentCount=2` will both pass the `< 3` check, both stream, and both UPDATE to `regeneration_count = 3`. The DB CHECK constraint `<= 3` does not catch this — both writes are `= 3`. Net effect: 4 regenerations occurred (initial + 3 increments-to-3) with billing for 4 calls when D-S4 caps at 3. There is no SQL-level race protection (no `WHERE regeneration_count < 3` predicate, no advisory lock, no atomic increment via `rpc('increment_count')`).

**Fix:**
```ts
// Replace the post-stream UPDATE at line 186-195 with a guarded UPDATE:
const { data: updated, error } = await supabase
  .from('readings')
  .update({
    report_generated: completedSections,
    report_generated_at: new Date().toISOString(),
    regeneration_count: currentCount + 1,
    regeneration_log: [...existingLog, logEntry] as never,
    audit_metadata: audit as never,
  })
  .eq('id', readingId)
  .eq('regeneration_count', currentCount) // optimistic concurrency check
  .select('id')
  .maybeSingle()
if (error || !updated) {
  // another request raced us — surface to client; do NOT double-count
  console.error('[analyze] regeneration_count race detected reading=' + readingId)
  // partial sections were persisted in the loop; user will see them on refresh
}
```

### CR-02: TOCTOU race on `regeneration_log` overwrites previous entry

**File:** `apps/web/app/api/readings/[id]/analyze/route.ts:64-67, 182-192`
**Issue:** `existingLog` is captured from the initial SELECT at request start (line 64-67 selects `regeneration_log`). The post-stream UPDATE at line 192 writes `[...existingLog, logEntry]`. Two concurrent requests both reading `regeneration_log=[A]`, both successfully streaming, will both write `[A, B1]` and `[A, B2]` — one overwrites the other. SAC telemetry (Fase 10 forward-compat) loses an entry. Same root cause as CR-01: no atomic-array-append; should use a SQL-level `regeneration_log = regeneration_log || jsonb_build_array(...)` via `.rpc()` or run inside a transaction. Compounds with CR-01: when the cap is bypassed, the race makes log loss certain.

**Fix:** Move the final UPDATE into a Postgres function that does atomic `jsonb` array concat + count increment + cap check in one statement:
```sql
create or replace function append_regeneration(
  p_reading_id uuid, p_log_entry jsonb, p_report jsonb,
  p_audit jsonb, p_now timestamptz
) returns boolean ... -- updates only if regeneration_count < 3
```
Call via `supabase.rpc('append_regeneration', ...)`. This serializes via row-level locking inside the function.

### CR-03: Mid-stream UPDATE errors are silently swallowed

**File:** `apps/web/app/api/readings/[id]/analyze/route.ts:143-149`
**Issue:** Inside the `for await` loop, each closed section triggers an `await supabase.from('readings').update({...}).eq('id', readingId)` but the result is never checked. If the UPDATE fails (RLS denied, network blip, DB transient error), the loop continues silently. The user sees text streaming in the UI (controller.enqueue succeeded) but the section is not actually persisted — refresh loses content despite the comment "Você pode atualizar a página — o progresso fica salvo" displayed in `AnalysisStream.tsx:59`. This breaks the D-S2 contract.

**Fix:**
```ts
const { error: updateErr } = await supabase
  .from('readings')
  .update({ report_generated: { ...completedSections } })
  .eq('id', readingId)
if (updateErr) {
  console.error('[analyze] mid-stream UPDATE failed reading=' + readingId, updateErr.message)
  throw new Error('Persistência intermediária falhou: ' + updateErr.message)
}
```
Throwing here triggers the catch block which already handles partial-state cleanup.

### CR-04: `markReadingDelivered` accepts empty `report_delivered`

**File:** `apps/web/app/actions/analise.ts:131-149`
**Issue:** Line 131 reads `delivered = (reading.report_delivered as ReportJsonb | null) ?? {}`. If the user clicks "Entregar ao cliente" before ever clicking "Salvar edição", `report_delivered` is null, defaults to `{}`, `extractForbiddenHits` finds no hits over zero values, and the reading is flipped to `is_delivered=true` with **no actual delivered content**. From `editar-client.tsx:104` the "Entregar ao cliente" button is wired straight to `setDeliverOpen(true)` without a precondition; the dialog calls `markReadingDelivered` with no save in between. The delivered state is now terminal (D-P3) and the original `report_generated` text never made it to `report_delivered`.

**Fix:**
```ts
// Add precondition right after the SELECT in markReadingDelivered:
if (!reading.report_delivered ||
    Object.keys(reading.report_delivered as Record<string, unknown>).length === 0) {
  return { error: 'Salve a edição antes de entregar ao cliente.' }
}
```
Additionally, on the client, `editar-client.tsx:104` should disable "Entregar ao cliente" until `delivered` differs from `null`/empty OR has been saved at least once.

### CR-05: `saveReportDelivered` allows arbitrary `encerramento_disclaimer` content (D-P3 violation)

**File:** `apps/web/app/actions/analise.ts:54, 80-95` and `apps/web/app/actions/analise.schemas.ts:21-27`
**Issue:** D-P3 (Decision: server-appended ENCERRAMENTO_LITERAL, immune to prompt drift) is enforced in the analyze route at line 163 of `route.ts`. But `saveReportDelivered` accepts the full `reportDelivered` payload from the client and writes it directly to `report_delivered` jsonb (line 87) without overriding `encerramento_disclaimer` to `ENCERRAMENTO_LITERAL`. The Zod schema uses `.passthrough()` (Pitfall 10 acknowledged) and treats `encerramento_disclaimer` as `z.string().optional()` — any text passes. A malicious or buggy client can replace the LGPD-required disclaimer with arbitrary content, then call `markReadingDelivered`, and the delivered jsonb permanently carries the wrong disclaimer. The `EditorAccordion` UI is read-only for this key, but server-side trust is the right place to enforce — UI is bypassable via direct Server Action invocation.

**Fix:**
```ts
// In saveReportDelivered, after parsing bodyParsed:
const delivered = {
  ...bodyParsed.data,
  encerramento_disclaimer: ENCERRAMENTO_LITERAL, // server-enforced D-P3
} as ReportJsonb
// (and import ENCERRAMENTO_LITERAL from '@/lib/anthropic/types')
```

### CR-06: Partial-stream error path leaves stale `audit_metadata`

**File:** `apps/web/app/api/readings/[id]/analyze/route.ts:202-224`
**Issue:** When the stream errors mid-flight, the catch block persists partial sections (line 211-215) but does NOT recompute `audit_metadata` over the partial report. The pre-existing `audit_metadata` from a prior generation (or the migration default `'{}'`) remains. The detail page at `AnalysisHero.tsx:69` derives the "Auditoria OK" badge from `audit_metadata.low_anchor_rate` and `forbidden_vocab.length`. After a partial-stream error, the user sees "Auditoria OK" over content that was never audited, and has no signal to act. This is a soft LGPD-compliance hole — forbidden vocab in early-streamed sections would not be flagged.

**Fix:**
```ts
} catch (err) {
  // ... existing logging ...
  try {
    if (Object.keys(completedSections).length > 0) {
      const audit = runAudit(completedSections) // include partial-state audit
      await supabase
        .from('readings')
        .update({
          report_generated: completedSections,
          audit_metadata: audit as never,
        })
        .eq('id', readingId)
    }
    // ...
  }
}
```

## Warnings

### WR-01: Section content includes own heading (UI duplication)

**File:** `apps/web/lib/anthropic/parser.ts:69-79` + `apps/web/components/readings/EditorSectionItem.tsx:43-49`
**Issue:** `closeSections` slices `buffer.slice(boundary.startIdx, endIdx)` where `startIdx` is the index of `### N. ` itself. Test `parser.test.ts:108-110` confirms `closed[0].content === '### 1. Constituição\nTexto da seção 1.'`. The persisted `report_generated[key]` therefore starts with the markdown heading. The `EditorAccordion` displays the heading once in the accordion trigger (`{s.number}. {s.title}` at line 64) AND a second time inside the Textarea/preview (because `deliveredValue` contains `### 1. Constituição\n...`). User sees double headings.

**Fix:** Strip the heading line during slice in `closeSections`:
```ts
// In parser.ts closeSections, change endIdx slicing:
const headingEnd = boundary.headingEndIdx
const content = buffer.slice(headingEnd, endIdx).trim()
```
Update `parser.test.ts:108-110` to assert content WITHOUT the heading.

### WR-02: `client:clients` typing assumes object but Supabase returns array on FK rels

**File:** `apps/web/app/api/readings/[id]/analyze/route.ts:103-104`
**Issue:** `(reading.client as { full_name?: string } | null)?.full_name`. Compare with `app/(dashboard)/leituras/page.tsx:137` which correctly handles `Array.isArray(r.client) ? r.client[0] : r.client`. With Supabase generated types and the `client:clients(...)` join, the result can be an array (1:N relation typing) even when 1:1. The `editar/page.tsx` and `[id]/page.tsx` repeat the same `(reading.client as ...)` pattern. If types ever generate `client: Array<{full_name:string}>`, `clientName` becomes `undefined` (then `'Cliente'` fallback), and the analysis lacks the actual client name in the prompt — silent quality regression.

**Fix:** Use the same pattern as `leituras/page.tsx:137`:
```ts
const clientObj = Array.isArray(reading.client) ? reading.client[0] : reading.client
const clientName = clientObj?.full_name ?? 'Cliente'
const clientBirth = clientObj?.birth_date ?? null
```
Apply uniformly across `analyze/route.ts:103-105`, `[id]/page.tsx:42`, and `editar/page.tsx:27-28`.

### WR-03: `vision_features` not validated before LLM injection

**File:** `apps/web/app/api/readings/[id]/analyze/route.ts:113`
**Issue:** `reading.vision_features as unknown as IrisFeaturesForRag & Record<string, unknown>` is a blind cast. If `vision_features` is `null` (e.g., webhook stored a degraded payload, or admin manually nulled it), `JSON.stringify(null, null, 2)` becomes the literal string `"null"` in the prompt template, the LLM gets garbage features, and the report has no anchorable signals. The route should reject the request when features are missing.

**Fix:**
```ts
if (!reading.vision_features) {
  return NextResponse.json(
    { error: 'Features de visão ausentes — leitura inválida para análise' },
    { status: 409 },
  )
}
```

### WR-04: `clientAge` calculation off-by-one near birthday

**File:** `apps/web/app/api/readings/[id]/analyze/route.ts:105-107`
**Issue:** `Math.floor((Date.now() - new Date(birth_date).getTime()) / 31_557_600_000)` uses 365.25 days. Around the leap-year boundary or DST shifts, age can be 1 unit too high or low for a few hours surrounding the birthday. For an iridological reading prompt the impact is minor, but it's not deterministic and contradicts the hand-tuned UX. Use `date-fns` (already in package.json):

**Fix:**
```ts
import { differenceInYears } from 'date-fns'
const clientAge = clientBirth ? differenceInYears(new Date(), new Date(clientBirth)) : null
```
Also extract `31_557_600_000` to a named constant if keeping the manual approach.

### WR-05: No rate limit on `/api/readings/[id]/analyze`

**File:** `apps/web/app/api/readings/[id]/analyze/route.ts:44-100`
**Issue:** A trial-tier authenticated therapist can fire `POST /api/readings/[id]/analyze` once per reading × N readings, then create new readings ad infinitum. There is no per-user rate limit and no Anthropic-budget circuit breaker. The cost ceiling is `MAX_OUTPUT_TOKENS=16000 × $15/MTok = $0.24` per call × `regeneration_count<=3` per reading × unbounded readings = unbounded liability. Phase 7 is the first surface to expose paid LLM cost; rate-limit before production launch.

**Fix:** Add a per-user request throttle (e.g., 5 analyses per hour) using `@upstash/ratelimit` or a Postgres advisory lock + counter table. At minimum, log `cost_estimate_usd` cumulatively per `therapist_id` and alert above $X/day.

### WR-06: `cancel` handler doesn't run audit / clean partial report state

**File:** `apps/web/app/api/readings/[id]/analyze/route.ts:227-231`
**Issue:** When the browser aborts the fetch, `cancel()` only logs. The `start()` async generator continues until `for await` propagates the abort, but during that window further partial-section UPDATEs may fire. After abort, `report_generated` is partially populated, `regeneration_count` was not incremented (D-S3 — good), but `audit_metadata` and `report_generated_at` are stale. UI then shows "Editar análise" CTA over a half-baked report. Same gap as CR-06 but on the cancel path.

**Fix:** Mirror the CR-06 fix in the cancel handler (run runAudit on whatever is in `completedSections`, persist).

### WR-07: Analyze route is re-entrant during streaming (no exclusivity gate)

**File:** `apps/web/app/api/readings/[id]/analyze/route.ts:79-100`
**Issue:** Gate (c) requires `status='ready'`. The route NEVER moves status to `'streaming'` (UI-SPEC line 222 says it's intentionally ephemeral, not persisted). So while one request is mid-stream, a second `POST /api/readings/[id]/analyze` for the same reading will pass all gates and start a parallel stream. Both streams race to UPDATE `report_generated`, both increment `regeneration_count`. Compounds with CR-01.

**Fix:** Use an advisory lock or a transient `is_streaming boolean` column with `UPDATE ... WHERE is_streaming=false` to claim exclusivity at the start of the stream and clear at end/error. Alternatively, perform the gate check + count increment in a single atomic SQL function that returns `true` on success (claim) and `false` if already claimed.

### WR-08: `saveReportDelivered` does not check `is_delivered` precondition

**File:** `apps/web/app/actions/analise.ts:71-95`
**Issue:** The Server Action does not check `reading.is_delivered`. The page renders the editor read-only when `is_delivered=true`, but Server Actions are callable directly (e.g., a stale tab whose `is_delivered` flipped under it, or any client that knows the action's name). A delivered (terminal, D-P3) reading can be silently rewritten via direct invocation.

**Fix:**
```ts
// Add to the SELECT at line 71-77:
.select('id, therapist_id, report_generated, is_delivered')
// Then before the UPDATE:
if (reading.is_delivered) {
  return { error: 'Leitura já entregue ao cliente — somente leitura.' }
}
```

### WR-09: Stream-error message is concatenated into response body

**File:** `apps/web/app/api/readings/[id]/analyze/route.ts:216-220`
**Issue:** `controller.enqueue(encoder.encode('\n\n[erro]: ' + (err instanceof Error ? err.message : 'desconhecido')))`. Two concerns:
1. The error text is emitted as if it were normal report content. The accumulated `buffer` already received this text via `controller.enqueue(encoder.encode(text))` was the pattern *during* streaming, but here we enqueue the error AFTER the loop. The buffer is NOT updated, so the parser doesn't see it — but the client's `analise-client.tsx:71` accumulates everything from the response body into its `accumulated` string, then matches `BOUNDARY_RE` on it. If the error message contains `### 7. Foo` for any reason, it will spuriously increment the section count in the UI.
2. Anthropic SDK error messages can include API response fragments. Surface PII risk if those messages echo prompt context (low risk — but unbounded).

**Fix:** Send a structured error event using SSE-like framing or a dedicated control byte, OR include error content only in a final JSON response chunk that the client parses separately. At minimum, sanitize: strip newlines + heading markers before enqueue.

### WR-10: `EditarClient` "Entregar" button has no client-side guard for unsaved changes

**File:** `apps/web/app/(dashboard)/leituras/[id]/editar/editar-client.tsx:73-117`
**Issue:** `editedCount` (line 73) measures local diff vs `reportGenerated`. The "Entregar ao cliente" button (line 104) is enabled regardless of whether unsaved edits exist. Combined with CR-04, a user who edits but never saves AND clicks "Entregar" loses their edits silently — `markReadingDelivered` finalizes whatever was last persisted (which may be empty or stale).

**Fix:** Track a `dirty` flag (localState != lastSavedState) and either disable "Entregar" while dirty, or auto-save before delivering. Show toast on entrega: "Edições não salvas serão perdidas. Salvar primeiro?".

### WR-11: `runAudit` `auditor_version` is hard-coded literal and never bumped

**File:** `apps/web/lib/anthropic/types.ts:71-73` + `apps/web/lib/anthropic/audit.ts:129`
**Issue:** `auditor_version: 'v1' as const`. There's no path to evolve the auditor (e.g., add a new forbidden term, change anchor threshold) and re-flag old readings. Once Fase 10 SAC starts using `audit_metadata` for analytics, version tracking becomes important. The literal type makes incrementing painful.

**Fix:** Change to `auditor_version: string` and centralize the constant: `export const AUDITOR_VERSION = 'v1' as const`. This allows future bumps without breaking type narrowing.

### WR-12: `prompts.ts` cache is module-scope and never invalidates on file change

**File:** `apps/web/lib/anthropic/prompts.ts:23-53`
**Issue:** `_systemCache` and `_injectionCache` cache `readFileSync` results forever within a process. In production this is fine (immutable bundle). But in `next dev` with HMR, editing `prompts/system.md` does not invalidate the cache — the dev server uses stale prompt content until restart. The `_resetPromptsCache()` export is for tests only. Add a note or a dev-only fs.watch hook.

**Fix:** Document in the file header: "Production: cache lives for process lifetime (intentional). Dev: restart `pnpm dev` to pick up edits to system.md or feature-injection.md." Or wire an `fs.watchFile` in dev mode to invalidate.

### WR-13: `classifyAllSections` over `({}, delivered)` mislabels first save

**File:** `apps/web/app/actions/analise.ts:79-81`
**Issue:** When a fresh save happens with `report_generated` non-null but the user did not edit (so `delivered` is the seeded `{...reportGenerated}`), `classifyAllSections(generated, delivered)` correctly returns `none` for everything. Good. But if the page-load somehow lost `report_generated` (e.g., race on revalidatePath) and `generated = {}`, every key in delivered would be classified as `'adicionado'`. The logic is correct ("everything was added because before there was nothing"), but as a save-time signal it's misleading. Add a guard:

**Fix:**
```ts
if (!reading.report_generated) {
  return { error: 'Análise ainda não gerada — gere antes de editar' }
}
const generated = reading.report_generated as ReportJsonb
```

## Info

### IN-01: Magic number `3` for regeneration cap is duplicated

**File:** `apps/web/app/api/readings/[id]/analyze/route.ts:95-99`, `apps/web/components/readings/AnalysisCTA.tsx:38-43, 63-67`, `supabase/migrations/0007_phase_7_analise_llm.sql:96-97`
**Issue:** The cap value `3` appears in 4 surfaces (route handler, UI button, tooltip text, DB CHECK constraint). Drift risk: changing to 5 requires touching all 4. Extract to `MAX_REGENERATIONS = 3` in `lib/anthropic/types.ts` and reference from TS surfaces; document the migration link via comment.

### IN-02: `as never` / `as unknown as` casts hide schema misalignment

**File:** `apps/web/app/actions/analise.ts:87-93`, `apps/web/app/api/readings/[id]/analyze/route.ts:192-194`
**Issue:** Multiple `as never` and `as unknown as` casts. Database type has `tipo_edicao: string[] | null` and `zonas_editadas: Json | null`, but code passes typed shapes. The casts work but mask future breakage when Supabase types regenerate. Define a narrowed `TablesUpdate<'readings'>` overlay or use `Database['public']['Tables']['readings']['Update']` directly.

### IN-03: Unused renamed parameters in `EditorSectionItem`

**File:** `apps/web/components/readings/EditorSectionItem.tsx:27-28`
**Issue:** `number: _number, title: _title` — the underscore prefix is a code smell signal. The props are listed in the interface but never used. Either use them (e.g., title in the Label) or remove from `EditorSectionItemProps`. Currently `EditorAccordion.tsx:71-78` passes them with apparent intent.

**Fix:** Remove `number` and `title` from `EditorSectionItemProps` AND the call site in `EditorAccordion.tsx`, OR use them (e.g., aria-label including section number).

### IN-04: `accordion.tsx` re-exports without namespace headers

**File:** `apps/web/components/ui/accordion.tsx:1-72`
**Issue:** No leading file comment indicates this is a base-ui wrapper (different from shadcn-radix accordion). The `multiple` prop semantics (vs Radix `type="multiple"`) is non-obvious. The consumer comment in `EditorAccordion.tsx:7-9` explains, but this should be documented at the source.

**Fix:** Add a header comment: "Wraps `@base-ui/react/accordion`. Props differ from Radix: use `multiple` (boolean) not `type='multiple'`; `defaultValue` accepts `string[]`."

### IN-05: `AnalysisHero` test coverage missing

**File:** No file `apps/web/components/readings/__tests__/AnalysisHero.test.tsx`
**Issue:** `AnalysisHero` decides State A/B/C and the audit badge color (line 69 derives `auditOk` from possibly-undefined `forbidden_vocab.length`). With no test, regressions on the badge color logic ship silently. State decision is also untested.

**Fix:** Add unit tests covering: status='pending' renders waiting card; hasReport=false renders State A; hasReport=true with audit OK renders green badge; hasReport=true with low_anchor_rate renders destructive badge; isDelivered shows "Entregue ao cliente" badge.

---

_Reviewed: 2026-05-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
