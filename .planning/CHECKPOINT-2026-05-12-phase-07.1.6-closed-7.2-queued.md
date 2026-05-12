---
date: 2026-05-12T19:00:00-03:00
phase_closed: 07.1.6-canonical-capture-pipeline
phase_next: 7.2 (Wave C corpus + calibration items A..G)
resume_command: "/gsd-discuss-phase 7.2"
---

# Checkpoint — Phase 07.1.6 Closed, Phase 7.2 Queued

## Resume in one line

Next session, run:

```
/gsd-discuss-phase 7.2
```

That's it. The phase scope, backlog, and architectural state are all captured below + in the planning docs.

---

## What just shipped — Phase 07.1.6 Canonical Capture Pipeline

**Status:** COMPLETE + UAT APPROVED 2026-05-12 (founder clinical inspection of f4408c23 vs 6 source photos, cross-validated against Gemini)

**42 commits delivered** (`cb03ced..e968582`). Seven original plans plus eight UAT-driven follow-up fixes:

- Per-photo gate diagnostics in `canonical_metadata.gate_diagnostics[]` (71c3feb)
- Iris color extracted in same Sonnet bbox call, zero extra cost (63e1850, 7c6262c)
- Threshold relax `cross_angle_outlier` 0.08 → 0.18 after empirical UAT data (5b01395)
- `mergeCanonicalIrisColor()` overrides vision_features at analyze time, both nested AND top-level constitution (0d98313, 58634a5, bd299a1)
- Re-canonicalizar button also re-triggers Modal pipeline (ac827ab)
- Parser regex accepts `## §N — Title` heading format with Unicode dash class (b91aaf9, d43f0d9)
- Admin page + PhotoDownloadButton render canonical 800×800 crops (625675a)
- Voyage reranker default fixed `voyage-rerank-2.5` → `rerank-2.5` (59dc8d6)
- Admin re-parse endpoint + button (zero LLM cost recovery for parser drift) (1040626)
- Founder bypasses 3/3 regen cap (22d136f)

**What worked clinically:** constitution biliar-linfática mista correct, color verde_acinzentado correct, fiber density correct, all absence-of-signs correct (sodium ring, lymphatic rosary, senile arc, tofus, radii solaris), parser working 13/13 sections rendered.

## Phase 7.2 backlog — 7 calibration items + original Wave C scope

Original Wave C goal (already in ROADMAP): corpus expansion (≥3 fixtures per iris_color category) + `recalibrate-centroids.mjs` re-run + `detect_sectoral_pigments` threshold tuning.

Additions from 07.1.6 UAT + Gemini cross-validation:

| ID | Item | Source | Surface |
|----|------|--------|---------|
| 7.2-A | Findings-hierarchy in LLM prompt — visual prominence drives section ordering (concrete weight: "heterocromia central pigmentada > sectoral lacunas grau 1") | Founder UAT + Gemini | `apps/web/prompts/system.md` + SPEC.md §6 coord |
| 7.2-B | Lacuna size: exclude chromatic transition zones from extent | Founder UAT | Modal `vision-service/pipeline/segment.py` |
| 7.2-C | NEW detector — cramp ring in INNER reticular zone | Founder UAT | Modal pipeline (new) |
| 7.2-D | NEW detector — peripheral pigment clustering in ciliary zone (hours 8-10 + 2-4) | Founder UAT | Modal pipeline (new) |
| 7.2-E | **Carúncula lacrimal laterality** in canonicalize Sonnet prompt (flag inverted captures) | Gemini cross-val | `apps/web/lib/canonicalize/sonnet-bbox.ts` (canonicalize-side, NOT Modal) |
| 7.2-F | TUNE existing nerve ring detector — ciliary zone sensitivity (false negative on cramp rings) | Gemini cross-val | Modal pipeline (tune) |
| 7.2-G | NEW classifier — collarette irregularity (`regular` / `leve_zigue` / `zigue_zague` / `severo`) | Gemini cross-val | Modal pipeline (new) |

**Architectural note for 7.2 planning:** 7.2-E is canonicalize-side (cheap, gates corpus annotation quality), 7.2-A is prompt-eng (independent of Modal deploy cycle), B+C+D+F+G are all Modal pipeline changes that share the same Wave C fixture corpus for empirical threshold derivation. Suggest plan order: E first (gates everything), then A in parallel with B+F (tunes/exclusions on existing detectors), then C+D+G (new detectors) gated by corpus annotation completion.

## Repo state

**Git:** all commits through `e968582` are on `main`. **`e968582` is unpushed at session end** — it's planning-docs-only (ROADMAP + STATE + UAT-FINDINGS additions), no code. Push or not is your call before next session. Last validated prod-deployed commit: `d43f0d9` (parser permissive regex + reparse diagnostic).

**Test baseline:** 525 passed / 3 pre-existing Phase 3 quality-scoring failures (MEMORY entry, not regressions) / 2 skipped / 24 todo. Zero new tsc errors in 07.1.6 touched files. Lint baseline unchanged (9 pre-existing warnings).

**Schema:** migration `0012_canonical_capture` applied to live Supabase 2026-05-12 (founder confirmed via verification SQL). No migrations pending.

**Diagnostic logs in production code** (not blockers, optional cleanup):
- `[analyze/route] merge-diag` — fires every analyze invocation, JSON dump of pre/post-merge constitution + canonical iris_color + eye-block presence
- `[analyze/route] stream-finalize` — sections_completed list + buffer_length
- `[analyze/route] EMPTY-REPORT` — console.error when LLM stream produced zero numbered sections
- `[process/route] path-resolution` — per-image canonical vs original tier

These are cheap and useful for the next parser-drift incident. Cleanup is a single commit when you want production noise reduced.

## Key files for next session

- `.planning/ROADMAP.md` (lines 310-345) — Phase 7.2 entry with full scope additions A..G
- `.planning/phases/07.1.6-canonical-capture-pipeline/07.1.6-UAT-FINDINGS.md` — full clinical review + Gemini cross-val pass + consolidated 7-item table
- `.planning/phases/07.1.6-canonical-capture-pipeline/07.1.6-HUMAN-UAT.md` — all 4 UAT items passed with results
- `.planning/STATE.md` — current `stopped_at` points to `/gsd-discuss-phase 7.2`
- `apps/web/lib/canonicalize/sonnet-bbox.ts` — the prompt + parser to extend for 7.2-E carúncula detection
- `apps/web/prompts/system.md` — the LLM prompt to amend for 7.2-A findings hierarchy

## Open decisions for /gsd-discuss-phase 7.2

The discussion phase should clarify these before planning:

1. **Plan order**: E first (laterality gate) vs corpus-first (need annotations for empirical thresholds B/C/D/F/G)? Suggested: E first, A+B+F in parallel after E lands, then C+D+G after corpus annotated.
2. **Wave C corpus protocol**: how many fixtures per category? Founder annotation rhythm (1 per dogfooding session, batch sprint)? Where do non-founder fixtures come from?
3. **Modal redeploy budget**: 7.2 will require Modal redeploys for B/C/D/F/G. One big deploy or staged?
4. **7.2-A coordination with SPEC.md §6 D-PR1 frozen contract**: prompt amendment needs SPEC edit + sync — same-PR or separate?

These are open until /gsd-discuss-phase 7.2 resolves them.

## End-of-session note

Memory is auto-loaded next session via `MEMORY.md`. Phase 07.1.6 closure narrative is captured in STATE.md status field — you don't need to re-explain the context, just run the resume command.
