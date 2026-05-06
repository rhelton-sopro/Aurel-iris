# Phase 6 — Deferred items

Items discovered during plan execution that are out-of-scope for the
current plan. Tracked here so they don't get lost.

## ALTA_PRIORIDADE_BOOKS drift in apps/web/lib/rag/search.ts

**Discovered:** 2026-05-05 during 06-12 verification (vitest run lib/rag/).

**Symptom:** `apps/web/lib/rag/search.test.ts:280` (the W3 drift detection
test added by 06-11) fails because `books_manifest.json` v0.1.2 sets
`alta_prioridade: true` for `"dictionary of iridology pdf"` but the
hardcoded `ALTA_PRIORIDADE_BOOKS` Set in `apps/web/lib/rag/search.ts`
still mirrors the v0.1.1 list (7 books, missing `dictionary of iridology pdf`).

**Cause:** Commit `64d54e5` (06-08) bumped `books_manifest.json` 0.1.1 → 0.1.2
to mark 4 scan-only PDFs as skip+ocr_required, and as part of that work the
dictionary book's `alta_prioridade` flag flipped — but the TS-side mirror in
`search.ts` was not updated in lockstep. The W3 drift test (added later in
06-11 to catch exactly this kind of skew) is doing its job: flagging the
divergence loudly.

**Pre-existing baseline:** present at commit `48a2e9ea` (06-08 SUMMARY closing
commit) — verified by checkout test. NOT introduced by 06-12.

**Out-of-scope rationale (06-12 SCOPE BOUNDARY):** plan 06-12's goal is the
LGPD vocabulary audit extension. The TS Set drift is a Phase 6 retrieval-
side correctness issue (06-11's domain) that surfaces only because 06-08
edited the manifest after 06-11 landed. Fixing it requires either bumping
the TS Set or rolling back the manifest — both architectural decisions that
06-12 is not authorized to make.

**Resolution path:** founder/06-13 plan should either (a) update
`ALTA_PRIORIDADE_BOOKS` in `apps/web/lib/rag/search.ts` to include
`'dictionary of iridology pdf'`, regenerating the W3 drift test baseline, or
(b) decide whether the dictionary should drop `alta_prioridade: true` in
`books_manifest.json` (founder editorial call). Either choice is one
single-line edit + test re-run.

**Status:** RESOLVED 2026-05-05 in 06-13. Updated `ALTA_PRIORIDADE_BOOKS` in `apps/web/lib/rag/search.ts` to mirror manifest v0.1.2 — removed `Bernard Jensen Iridology Simplified` and `dictionary of iridology pdf` (both flipped to `skip: true / alta_prioridade: false` in 06-08 commit `64d54e5`), keeping the 5 books that remain `alta_prioridade: true` in v0.1.2. W3 drift detection test now green.
