---
phase: 06-rag-ingestao
plan: "13"
subsystem: rag-uat-and-spot-check
status: complete
completed_date: "2026-05-05"
duration_minutes: 480
tasks_completed: 4
tasks_total: 4
files_created: 4
files_modified: 6
tags: [rag, requirements-update, uat, spot-check, founder-gate, wave-4, d-n1-reactivation]
requirements_completed: [RAG-01, RAG-03, RAG-04]

dependency_graph:
  requires:
    - phase: 06-rag-ingestao/06-08
      provides: "knowledge_chunks populated (2761 chunks across 12 books) — substrate for retrieval testing"
    - phase: 06-rag-ingestao/06-09..06-11
      provides: "retrieveRelevantKnowledge server-side function — exercised by spot-check Route Handler"
    - phase: 06-rag-ingestao/06-12
      provides: "audit-vocabulary-db.mjs — LGPD compliance verified before founder UAT sign-off"
  provides:
    - .planning/REQUIREMENTS.md (RAG-01/03/04 wording reflects implementation reality)
    - .planning/STATE.md (Battello falso-positivo removed; D-N1 deferred entry resolved)
    - apps/web/app/api/admin/rag-spot-check/route.ts (Route Handler with RAG_SPOT_CHECK_TOKEN gate + 3 hardcoded scenarios)
    - apps/web/scripts/rag-spot-check.mjs (cross-platform Node fetch client)
    - .planning/phases/06-rag-ingestao/06-UAT.md (founder-signed-off: 5/5 PASS)
    - apps/web/lib/rag/search.ts (auth: 'service-role' option for admin endpoints; pgvector text-literal serialization; RPC error surfacing)
    - supabase/migrations/0006_match_knowledge_chunks_drop_set_local.sql (idempotent fix for STABLE function constraint)
  affects:
    - 06-14-PLAN (vision-service/README.md RAG runbook documents the 5 user-facing CLI flags + spot-check + audit:vocabulary:db scripts now wired)
    - Fase 7 LLM analysis (retrieveRelevantKnowledge upstream contract verified — server action called from Route Handler, not Server Action import)

tech_stack:
  added:
    - "anthropic prompt caching (1h TTL) — verified in production"
  patterns:
    - "service-role-auth-bypass-for-admin-endpoints: extending RetrieveArgs with `auth: 'session' | 'service-role'` discriminator. Default 'session' preserves the secure user-facing route pattern; 'service-role' is reserved for routes already gated by a separate trust mechanism (RAG_SPOT_CHECK_TOKEN here). Trust boundary explicit in caller. Reusable for any future admin endpoint that bypasses RLS by design."
    - "pgvector-text-literal-serialization: PostgREST does not auto-cast JSON arrays to vector(1024) — must serialize as `[0.1,0.2,...]` text literal which Postgres implicit-casts. Pattern: `query_embedding: \\`[\\${emb.join(',')}]\\` as unknown as string`. Applies to any RPC that takes a vector parameter."
    - "STABLE-function-no-SET-LOCAL: Postgres rejects SET (including SET LOCAL) inside STABLE/IMMUTABLE functions. For pgvector tuning that needs ef_search/probes overrides, use DB-level config (`ALTER DATABASE … SET hnsw.ef_search = N;`) instead — STABLE functions honor it. Only VOLATILE functions allow SET LOCAL, but VOLATILE breaks index usage on vector ops."
    - "cross-platform-npm-script-via-node-shim: Avoid bash-style `\\${VAR}` expansion in package.json scripts — Windows PowerShell doesn't expand it. Replace with a Node script file that reads `process.env.VAR` and uses built-in fetch. No deps; works on every platform Node runs."
    - "anthropic-prompt-cache-1h-TTL: When sustained throttling stretches per-chapter processing past 5 min, the default ephemeral TTL expires mid-chapter and forces cache_creation re-fires. `cache_control: {type: 'ephemeral', ttl: '1h'}` pays cache-write 2× ONCE per chapter and survives the throttle window — net cost dramatically lower than repeated 5-min creations."
    - "5-bucket-cost-tracking: Anthropic SDK exposes input_tokens, cache_creation_input_tokens, cache_read_input_tokens, output_tokens. Tracking only 3 of 4 (the original implementation missed cache_creation entirely) made the budget guard watch the wrong number while real spend ran 3× higher. ContextualBudgetGuard now tracks all 5 buckets (5-min vs 1-h cache writes split when SDK provides the breakdown)."

key_files:
  created:
    - apps/web/app/api/admin/rag-spot-check/route.ts
    - apps/web/scripts/rag-spot-check.mjs
    - .planning/phases/06-rag-ingestao/06-UAT.md
    - supabase/migrations/0006_match_knowledge_chunks_drop_set_local.sql
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md (Battello entry removed; D-N1 + ALTA_PRIORIDADE deferred entries → Resolved)
    - apps/web/lib/rag/search.ts ('use server' removed; auth-mode discriminator; pgvector text serialization; RPC error surfacing)
    - apps/web/lib/rag/search.test.ts (+1 service-role auth-mode test)
    - apps/web/lib/rag/score-weights.ts (no change in 06-13 itself; ALTA_PRIORIDADE_BOOKS lives in search.ts)
    - package.json (rag:spot-check rewired from curl to Node script)

key_decisions:
  - "D-N1 Contextual Retrieval REACTIVATED via 1h-TTL fix. Originally deferred in 06-08 after \\$6 burn on broken cache+price tracking. The 06-13 root-cause investigation found 5 separate bugs that compounded: missing cache_creation_input_tokens accounting, 5-min TTL too short under Tier 1 50K TPM throttling, content_hash including non-deterministic Haiku output (broke idempotency), Haiku 4.5 prices 3.2× higher than placeholder Haiku 3 constants, multilingual chapter regex too narrow + flat-book fallback missing. Fix-chain across ~10 commits restored D-N1 viability; final re-ingest 91% coverage at \\$3.70 total cost. v1 ships with D-N1 active."
  - "spot-check entrypoint = Next.js Route Handler (not standalone tsx script). search.ts initially declared 'use server' under the assumption Fase 7 would import retrieveRelevantKnowledge directly as a Server Action — but Server Actions require every export be async, which we violated by exporting ALTA_PRIORIDADE_BOOKS as a Set. Replaced with `import 'server-only'` (no async constraint, server-only enforcement preserved) and call retrieveRelevantKnowledge from a Route Handler. Future Fase 7 will use the same pattern."
  - "auth: 'service-role' bypass added to RetrieveArgs as a security-explicit discriminator. Default 'session' is the secure user-facing pattern; 'service-role' is reserved for admin endpoints already gated by a separate trust mechanism (here: RAG_SPOT_CHECK_TOKEN env header). Inline comment in route.ts marks the trust boundary explicitly. Future user-facing routes that fail to set this stay on the safe default."
  - "pgvector text-literal serialization replaces JS-array passthrough. PostgREST 0.7+ does not auto-cast JSON arrays to vector(1024) — must serialize as `[0.1,0.2,...]` text literal. The original `emb as unknown as string` was a hint to TypeScript but the runtime actually sent JSON arrays, hence the silent 0-row returns until 06-13 surfaced the underlying RPC error."
  - "migration 0006 drops SET LOCAL hnsw.ef_search from match_knowledge_chunks. Postgres rejects SET in STABLE functions; the original migration 0005 had this latent bug that only surfaced under live traffic. Tradeoff: ef_search defaults to 40 (vs intended 100) — slightly lower recall but planner still uses HNSW index. If founder UAT recall insufficient, raise via ALTER DATABASE."
  - "rag:spot-check script rewritten as Node fetch client. PowerShell does not expand bash-style \\${VAR} in npm scripts; the original curl one-liner sent the literal string as the auth header, producing 403 Forbidden. Cross-platform Node script (no deps; built-in fetch on Node 18+) reads process.env.RAG_SPOT_CHECK_TOKEN and prints prettified JSON. Mirror of 06-12 audit-vocabulary-db.mjs pattern."

patterns_established:
  - "founder-UAT-as-real-DB-smoke: 06-13 surfaced 6 production bugs that unit tests with mocked DB couldn't catch (cache_creation tracking, content_hash determinism, 1h TTL behavior, pgvector cast, STABLE+SET LOCAL, PowerShell var expansion). Treating the founder UAT as the FIRST end-to-end real-DB smoke is structurally correct but should be supplemented with a thin integration test in future phases that actually hits the linked DB after migration push."
  - "fix-during-execution-retrospective-resilience: 8 commits across 06-08 + 6 across 06-13 (totaling 14 mid-execution fixes for what was originally 2 plans of work) all landed atomically with regression tests. Better than batch-fixing because each commit was independently revertible; if a later fix broke a prior assumption, we'd find out at the next test run, not after the whole chain."

metrics:
  duration_minutes: 480  # ~8 hours wall-clock across 2 founder-gate cycles + 6 mid-execution fixes + final UAT
  commits: 11  # c3c38d8 + f59649c + 2cc85e2 + 56f7616 + bdce870 + 8da720b + 1149f25 + 0da1887 + 607811b + 91c6338 + 5f0982b + abbd567 + d9b2cc9 + this docs commit
  d_n1_coverage_final: 0.91  # 2505/2761
  cache_hit_rate_final: 0.98
  total_cost_usd_lifetime: 9.70  # ~6 wasted on initial broken attempts + 3.70 successful final
  founder_uat_pass_rate: 1.00  # 5/5 Success Criteria
---

# Phase 6 Plan 13: Wave 4 — Spot-check + UAT + D-N1 Reactivation Summary

**One-liner:** Founder UAT 5/5 PASS — RAG retrieval pipeline production-grade with D-N1 Contextual active (91% coverage), 2761 chunks indexed, all 3 spot-check scenarios green including the canonical lacuna-setor-7-fígado test (5/5 chunks recognizably relevant).

## Performance

- **Duration:** ~8 hours wall-clock — substantially over the 06-13 PLAN's 30-min estimate because what looked like a documentation-and-UAT plan turned out to be the integration test for everything Phase 6 had built
- **Started:** 2026-05-05
- **Completed:** 2026-05-05 (founder UAT sign-off)
- **Tasks:** 4 (REQUIREMENTS update + Route Handler + UAT.md + founder gate) plus 6 mid-execution debug fixes
- **Commits:** 14 total (4 pre-checkpoint + 6 mid-execution fixes + UAT close-out)

## Accomplishments

- REQUIREMENTS.md RAG-01/03/04 wording reflects implementation reality (Python script not TS, 18 PDFs not Jensen+Battello, retrieveRelevantKnowledge takes reportSections)
- STATE.md Battello falso-positivo bullet removed
- /api/admin/rag-spot-check Route Handler with RAG_SPOT_CHECK_TOKEN gate (fail-closed, 403 on env-unset OR header-mismatch)
- 3 hardcoded test scenarios: Success Criterion 5 (lacuna setor 7), anel de tensão + neurogênica, cross-language linfática
- Cross-platform pnpm rag:spot-check script (Node fetch — no curl/bash issues)
- 06-UAT.md authored + signed off by founder Rhelton 2026-05-05 (5/5 Success Criteria PASS)
- D-N1 Contextual Retrieval REACTIVATED — 91% coverage at $3.70 cost / 98% cache hit rate
- ALTA_PRIORIDADE_BOOKS synced from manifest v0.1.2 (deferred-items.md from 06-12 cleared)
- 6 mid-execution fixes (each with regression tests) shipping production correctness

## Task Commits

Pre-checkpoint (4 commits):
1. `c3c38d8` — REQUIREMENTS.md RAG-01/03/04 wording + STATE.md Battello removal
2. `f59649c` — Route Handler with token auth gate
3. `2cc85e2` — package.json wire + ALTA_PRIORIDADE_BOOKS sync
4. `56f7616` — 06-UAT.md authored

Mid-execution fixes (real-DB integration bugs surfaced during founder UAT):
5. `bdce870` — content_hash from source text not contextual prefix (Haiku non-determinism breaks idempotency)
6. `8da720b` — D-N1 prompt caching: track cache_creation_input_tokens + 1h TTL + debug logs
7. `1149f25` — per-chunk cost logging in real-time
8. `0da1887` — corrected Haiku 4.5 prices (3.2× higher than placeholder Haiku 3 constants)
9. `607811b` — removed 'use server' directive (Next.js export contract)
10. `91c6338` — curl → Node fetch script (PowerShell var expansion)
11. `5f0982b` — service-role auth bypass for admin endpoint
12. `abbd567` — pgvector text-literal serialization + RPC error surfacing
13. `d9b2cc9` — migration 0006 (SET LOCAL not allowed in STABLE function)

Closing commit:
14. `[this commit]` — UAT sign-off + STATE/ROADMAP/SUMMARY

## Verification Summary

| Gate | Result |
|------|--------|
| pytest (vision-service) | EXIT 0 — 245 passed / 4 skipped |
| vitest (apps/web/lib/rag) | EXIT 0 — 11/11 search tests including service-role auth-mode regression |
| LGPD audits (Python + JS + DB) | All EXIT 0 |
| Founder UAT Scenario 1 (lacuna setor 7) | 5/5 fígado/lacuna chunks PASS |
| Founder UAT Scenario 2 (anel de tensão) | top-5 covers Lo Rito + Jensen + Psicoterapeutica PASS |
| Founder UAT Scenario 3 (cross-language) | pt-BR + en + es in top-5 PASS |
| `vector_dims(embedding)` over 2761 rows | All 1024 |
| `[Contexto:]` prefix coverage | 2505/2761 = 91% |

## Self-Check: PASSED

All artifacts on disk; all commits in git log; STATE.md + ROADMAP.md reflect 13/14 plans Phase 6 + 55/56 milestone v1.0.

---
*Phase: 06-rag-ingestao*
*Completed: 2026-05-05*
