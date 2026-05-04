---
phase: 05-pipeline-visao-modal
plan: "17"
subsystem: vision-service
tags: [vision, smoke, manual-test, env, documentation, founder-gate]

requires:
  - phase: 05-pipeline-visao-modal
    provides: "05-10 modal_app.py deployable; 05-11 trigger route consuming MODAL_ANALYZE_ENDPOINT_URL; 05-12 webhook receiver consuming MODAL_WEBHOOK_SECRET"

provides:
  - "vision-service/README.md: founder smoke procedure (markdown checklist) — modal deploy → endpoint URL capture → env fill → trigger reading → webhook callback → verify status='ready'"
  - "vision-service/.env.example: required env vars (MODAL_WEBHOOK_SECRET, WEBHOOK_BASE_URL) with inline docs on where each is consumed"

affects:
  - "Founder Stage 1 dogfooding gate (Phase 9) — this smoke is the bridge from code-complete to founder using the pipeline against real clients"
  - "Modal Secrets setup procedure documented (one-time, but also serves as runbook for secret rotation)"

tech-stack:
  added: []
  patterns:
    - "Markdown checklist as procedural runbook — not executable, intentionally human-gated (smoke is one-time, not CI)"
    - ".env.example as inline documentation (comments above each var explain consumption + generation; e.g. `openssl rand -hex 32` for HMAC secret)"
    - "Modal Secrets parity with .env.example — same var names, just different transport (file vs Modal Secret)"

key-files:
  created:
    - vision-service/.env.example (19 lines, 2 vars: MODAL_WEBHOOK_SECRET + WEBHOOK_BASE_URL)
  modified:
    - vision-service/README.md (replaced 30-line Phase 1 skeleton with 244-line founder smoke procedure)

key-decisions:
  - ".env.example documents the MODAL_WEBHOOK_SECRET generation command (`openssl rand -hex 32`) inline — no need to context-switch to a separate runbook"
  - "Single source of truth for Modal Secrets: the same vars in .env.example are the ones to set via `modal secret create aurel-iris-vision`. The README documents this parity explicitly"
  - "README is NOT a CI smoke — it's a one-time founder gate. Manual checklist with concrete commands, expected outputs, rollback notes"
  - "WEBHOOK_BASE_URL not MODAL_WEBHOOK_URL — this name is the canonical one (decided in 05-10), B5 anti-regression confirmed"

requirements-completed: [VISION-01, VISION-04]

duration: ~10min (orchestrator finalization after agent rate-limit; files were already written)
completed: "2026-05-04"
---

# Phase 5 Plan 17: Founder Smoke Procedure + .env.example — Summary

**vision-service/README.md becomes the founder runbook for first-time deployment of the Modal pipeline: deploy → capture endpoint URL → fill env vars → trigger a real reading → observe webhook callback → verify status='ready'. .env.example finalizes the 2 required env vars with inline generation commands.**

## Performance

- **Tasks:** 2 (README rewrite + .env.example)
- **Files modified:** 1 (README.md, +214 lines)
- **Files created:** 1 (.env.example, 19 lines)

## Accomplishments

- `vision-service/README.md` — markdown checklist for founder smoke: `modal deploy modal_app.py` → capture endpoint URL → fill `MODAL_ANALYZE_ENDPOINT_URL` in apps/web/.env.local → trigger a real reading via `/leituras/nova` → observe webhook → verify `readings.status='ready'` + `vision_features` populated. Includes rollback notes (modal deploy --no-create-environment, secret rotation via `modal secret create`)
- `vision-service/.env.example` — 2 required vars: `MODAL_WEBHOOK_SECRET` (HMAC shared with apps/web; generate via `openssl rand -hex 32`) + `WEBHOOK_BASE_URL` (no trailing slash; production = vercel app URL). Inline documentation explains where each var is consumed
- Naming aligned with 05-10 contract: `WEBHOOK_BASE_URL` (NOT legacy `MODAL_WEBHOOK_URL`) — B5 anti-regression confirmed

## Task Commits

Combined into a single docs commit by orchestrator (agent ran into rate-limit after writing files but before committing).

## Verification

- `python -m scripts.audit_vocabulary` → clean (no LGPD-prohibited vocab in README or .env.example)
- README references match modal_app.py env reads exactly (verified by inspection)

## Decisions Made

- README is intentionally a manual checklist — smoke is a one-time founder gate, not CI
- .env.example uses inline comments to document generation commands (`openssl rand -hex 32` for the HMAC secret) so the founder doesn't need a separate runbook
- Modal Secrets setup documented with the same var names as .env.example — parity is explicit, no translation table needed

## Deviations from Plan

The spawned executor agent hit Anthropic API rate limits ("You've hit your limit · resets 4:40pm") after writing files but before writing this SUMMARY.md. Orchestrator copied the worktree files into main, ran the audit, and committed inline.

## Next Phase Readiness

This plan closes Wave 3 and Phase 5 entirely. Next gates:

- **Founder smoke (manual, this plan's checklist):** runs `modal deploy` and triggers an end-to-end reading to confirm the pipeline works in production
- **`/gsd-verify-work 5`:** automated phase verification against ROADMAP success criteria
- **Phase 6 (RAG):** unblocked — vision_features payloads are now produced by a real Modal pipeline

---

*Phase: 05-pipeline-visao-modal*
*Completed: 2026-05-04*
