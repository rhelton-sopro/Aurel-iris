# Phase 04 — Deferred Items

Out-of-scope discoveries logged during plan execution. Do NOT fix in current plan.

## audit:vocabulary pre-existing failures (Fase 3)

**Discovered during:** Plan 04-01 execution (Task 1 verification)
**Files affected (all pre-existing, not modified by 04-01):**

- `apps/web/app/(auth)/login/page.tsx:58, 75` — comments using "diagnóstico"
- `apps/web/app/(auth)/signup/page.tsx:56, 74` — comments using "diagnóstico"
- `apps/web/app/api/capture/validate/route.ts:9, 92, 139` — comments using "validar"/"Diagnóstico"
- `apps/web/components/capture/CapturePreview.tsx:101` — debug overlay JSX comment using "diagnóstico"

**Nature:** All occurrences are in **technical comments** (JSDoc, inline `//`, JSX `{/* */}`), never in user-facing strings. The LGPD vocabulary gate is intended for product surfaces (UI copy, marketing). The comments are about **HTTP diagnostic logging**, not iridology diagnosis.

**Why deferred:** These violations existed on `main` BEFORE plan 04-01 started (verified by stashing local changes and running audit on clean tree — same 8 matches reported). They are out of scope for plan 04-01 per executor's Scope Boundary rule.

**Recommended action:** Open a separate maintenance plan (or fold into a future phase touching these files) to either:
1. Replace "diagnóstico"/"Diagnóstico" with synonyms ("depuração", "depuration logging", "log diagnóstico técnico" → "log de depuração técnica"), OR
2. Tighten the audit-vocabulary regex to skip comments (riskier — false negatives in JSX where comments and copy can blur).

**Status:** Logged 2026-05-03 by plan-04-01 executor.
