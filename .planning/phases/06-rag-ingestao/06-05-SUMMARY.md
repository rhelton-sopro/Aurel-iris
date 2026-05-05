---
phase: 06-rag-ingestao
plan: "05"
subsystem: rag-budget-and-embedder
status: complete
completed_date: "2026-05-05"
duration_minutes: 15
tasks_completed: 2
tasks_total: 2
files_created: 2
files_modified: 3
tags: [rag, python, budget, embedding, voyage, hardcap, wave-1]
requirements_completed: [RAG-02]

dependency_graph:
  requires:
    - phase: 06-rag-ingestao/06-01
      provides: "test_budget.py + test_embedder.py + test_contextualize_budget.py scaffolding (15 stubs flipped GREEN by this plan)"
    - phase: 06-rag-ingestao/06-03
      provides: "voyageai 0.3.7 + anthropic 0.98.1 pinned in requirements.txt"
  provides:
    - vision-service/scripts/lib/budget.py (VoyageBudgetGuard + ContextualBudgetGuard + BudgetExceeded)
    - vision-service/scripts/lib/embedder.py (embed_batch + EMBEDDING_MODEL='voyage-3' + BATCH_SIZE=128 + RETRY_DELAYS=(1,4,16) + VoyageEmbedError)
  affects:
    - 06-06-PLAN (contextualizer.py uses ContextualBudgetGuard for D-N1 hardcap; manifest loader unaffected)
    - 06-08-PLAN (ingest_knowledge.py CLI instantiates VoyageBudgetGuard, threads guard through embed_batch)
    - 06-09-PLAN (apps/web/lib/rag/embed.ts MUST mirror EMBEDDING_MODEL='voyage-3' constant — RESEARCH Pitfall 4)
    - 06-10-PLAN (Contextual Retrieval orchestration: contextualizer + ContextualBudgetGuard, $15 cap)

tech_stack:
  added: []  # voyageai/anthropic already pinned in 06-03
  patterns:
    - "alert-ladder-loop: VoyageBudgetGuard fires sequential alerts at $1/$2/$3/$4 thresholds via `while cost_usd >= next_alert_usd` so a single huge add() that jumps from $0 to $4.50 emits all 4 alerts back-to-back before the hardcap check decides to raise"
    - "lazy-import-inside-function (continued from 06-04): voyageai imported inside embed_batch (not at module top) so that test collection + import-only scenarios succeed without the heavy SDK"
    - "two-clause exception ordering: `except BudgetExceeded: raise` placed BEFORE `except Exception as e:` in retry loop — prevents the broad catch from swallowing budget hits and silently retrying after the user's hardcap was already exceeded (would burn through retry budget on a no-op)"
    - "constant-as-cross-tree-pin: EMBEDDING_MODEL='voyage-3' duplicated in two files (vision-service/scripts/lib/embedder.py now; apps/web/lib/rag/embed.ts in 06-09) with a header comment cross-referencing the other file — RESEARCH Pitfall 4 mitigated on the Python side; locking the TS side is contractually owed by 06-09"
    - "guard-add-after-success: guard.add(tokens=N) is called AFTER the Voyage API responded successfully, never before — keeps the budget tracker correct under transient failures (no double-counting on retries)"

key_files:
  created:
    - vision-service/scripts/lib/budget.py
    - vision-service/scripts/lib/embedder.py
  modified:
    - vision-service/tests/test_budget.py            (4 skips -> 7 passes; +3 new tests beyond Wave-0)
    - vision-service/tests/test_contextualize_budget.py (5 skips -> 7 passes; +2 new tests beyond Wave-0)
    - vision-service/tests/test_embedder.py          (6 skips -> 10 passes; +4 new tests beyond Wave-0)

key_decisions:
  - "EMBEDDING_MODEL pinned as a module constant rather than env var so that the constant can be `assert`-checked at test time (test_embedding_model_constant_is_voyage_3 fails loud if anyone changes the model without updating the TS counterpart)"
  - "Two-clause exception ordering chosen over a typed `except (httpx.HTTPError, voyageai.error.VoyageError)` because (a) voyageai SDK's exception hierarchy is not stable across minor versions, (b) explicit `except BudgetExceeded: raise` is unambiguous and survives SDK upgrades"
  - "Wave-0 stub API names (`source_book`, `total_cost_usd`, `_get_client`) replaced with PLAN spec names (`book`, `cost_usd`, direct `voyageai.Client` patch). Stubs were placeholder contracts; the PLAN authoritative interfaces took precedence per the plan's Step 2 rewrite directive"

metrics:
  duration_minutes: 15
  commits: 2  # 50e00d8 budget + d1dee9a embedder
  pytest_passes_added: 24  # was 162, now 186
  pytest_skips_removed: 15  # was 33, now 18
  tests_in_06-05_files: 24  # 7 budget + 7 contextualize_budget + 10 embedder
---

# Phase 6 Plan 05: Wave 1 — Voyage Embedder + Budget Guards Summary

**One-liner:** Voyage-3 embedding wrapper + cost guards landed; `EMBEDDING_MODEL='voyage-3'` pinned with cross-tree comment to apps/web/lib/rag/embed.ts (06-09); VoyageBudgetGuard ($5 hardcap, $1/$2/$3/$4 alert ladder, log every 10 chunks) + ContextualBudgetGuard ($15 hardcap, 3-token-type accounting for Haiku 4.5 + 90% prompt-cache discount); 15 Wave-0 stubs flipped GREEN, 24 total tests live across 3 files.

## Performance

- **Duration:** ~15 min (clean run, zero deviations)
- **Started:** 2026-05-05 (after 06-04 Wave 1 plan 4 closure at df1b5c9)
- **Completed:** 2026-05-05
- **Tasks:** 2 (Task 1 budget.py + Task 2 embedder.py)
- **Files created:** 2 (budget.py + embedder.py)
- **Files modified:** 3 (3 test files flipped from skip-stubs to live assertions)
- **Commits:** 2 atomic commits per task (50e00d8 budget + d1dee9a embedder)
- **pytest delta:** 162 passed / 33 skipped → 186 passed / 18 skipped (+24 / -15)

## Tasks Executed

### Task 1: budget.py + flip test_budget.py + test_contextualize_budget.py

**Files:**
- `vision-service/scripts/lib/budget.py` (NEW, 99 lines)
- `vision-service/tests/test_budget.py` (rewrite, 7 tests GREEN)
- `vision-service/tests/test_contextualize_budget.py` (rewrite, 7 tests GREEN)

**Behavior verified:**
- `VoyageBudgetGuard.HARDCAP_USD == 5.0`, `PRICE_PER_1M_TOKENS == 0.06`
- `add(tokens=100M)` → cost=$6 → raises `BudgetExceeded(match="HARD CAP REACHED")`
- 20× `add(tokens=100, total_chunks=20)` → 2 progress lines logged at chunk 10 and chunk 20
- Single `add(tokens=75M)` (cost=$4.50) emits exactly 4 alert lines (`$1`, `$2`, `$3`, `$4`)
- `ContextualBudgetGuard.HARDCAP_USD == 15.0`; 3 prices: $0.25/$0.025/$1.25 per 1M (input/cached/output)
- `cost_usd` formula: `(input*0.25 + cached*0.025 + output*1.25) / 1_000_000`
- 100M output tokens (cost=$125) → raises `BudgetExceeded(match="CONTEXTUAL HARD CAP REACHED")`

**Commit:** `50e00d8 feat(06-05): add VoyageBudgetGuard + ContextualBudgetGuard with hardcap and alerts (D-G1, D-G2, D-N1)`

### Task 2: embedder.py + flip test_embedder.py

**Files:**
- `vision-service/scripts/lib/embedder.py` (NEW, 86 lines)
- `vision-service/tests/test_embedder.py` (rewrite, 10 tests GREEN)

**Behavior verified:**
- Constants: `EMBEDDING_MODEL == "voyage-3"`, `BATCH_SIZE == 128`, `RETRY_DELAYS == (1.0, 4.0, 16.0)`
- Missing `VOYAGE_API_KEY` → `VoyageEmbedError(match="VOYAGE_API_KEY is not set")`
- 200 texts (>128) → `VoyageEmbedError(match="batch size 200 exceeds")`
- Successful path: `vo.embed(...)` called with `model='voyage-3'`, `input_type='document'`, `truncation=True`; returns 1024-dim vectors parallel to input
- `guard.add(tokens=result.total_tokens, book="...", total_chunks=...)` called once per success
- API failure: `vo.embed.side_effect = RuntimeError` → 4 calls total (1 + 3 retries) → `VoyageEmbedError(match="failed after 3 retries")`
- `guard.add` raises `BudgetExceeded` → propagates immediately; `guard.add` called once, `vo.embed` called once (NOT retried — two-clause exception fix verified)

**Commit:** `d1dee9a feat(06-05): add voyage-3 embedder with retry + budget integration`

## Verification Gates

| Gate | Command | Result |
|------|---------|--------|
| Task 1 tests | `pytest tests/test_budget.py tests/test_contextualize_budget.py -v` | 14 passed |
| Task 2 tests | `pytest tests/test_embedder.py -v` | 10 passed |
| Full pytest baseline | `pytest -q` | 186 passed / 18 skipped (was 162/33) |
| Module imports clean | `python -c "from scripts.lib.budget import ..."` | OK |
| Module imports clean | `python -c "from scripts.lib.embedder import ..."` | OK |
| LGPD audit | `python -m scripts.audit_vocabulary` | OK |
| Constant pinning | `grep -c 'EMBEDDING_MODEL = "voyage-3"' embedder.py` | 1 |
| Cross-ref comment | `grep -c "RESEARCH Pitfall 4" embedder.py` | 2 |
| Two-clause fix | `grep -c "except BudgetExceeded" embedder.py` | 1 |
| Hardcap constants | `grep -c "HARDCAP_USD = 5.00" budget.py` | 1 |
| Hardcap constants | `grep -c "HARDCAP_USD = 15.00" budget.py` | 1 |
| No Wave-0 skips remain | `grep -c "pytest.mark.skip" {3 test files}` | 0 / 0 / 0 |

## Decisions Made

1. **`EMBEDDING_MODEL` as module constant (not env var).** `assert EMBEDDING_MODEL == "voyage-3"` in test_embedder.py creates a hard regression-as-contract — anyone who edits this file to switch models breaks the build immediately. The companion TS constant in apps/web/lib/rag/embed.ts (owed by 06-09) MUST mirror this exact string. RESEARCH Pitfall 4: mismatched embedding spaces silently destroy retrieval recall — this dual-pin pattern is the cheapest mechanical defense.

2. **Two-clause exception ordering: `except BudgetExceeded: raise` BEFORE `except Exception as e:`.** This is structurally equivalent to a typed exception filter but does not depend on voyageai SDK's exception hierarchy (which is not stable across minor versions). On a budget hit, the guard correctly raises and the user's intent ("stop spending money") is honored without burning a single retry. PLAN's `<interfaces>` section flagged this as a critical detail to apply.

3. **Wave-0 stub API names superseded by PLAN's spec names.** Wave 0 (06-01) had used `guard.add(tokens=N, source_book="X")`, `guard.total_cost_usd`, and `embedder._get_client()` as placeholder contracts. The PLAN's authoritative interfaces use `book=`, `cost_usd`, and direct `voyageai.Client` patching. Per the PLAN's Step 2 rewrite directive, the spec names won. No downstream consumer references the old names yet.

## Cross-tree Pinning — IMPORTANT for 06-09

`vision-service/scripts/lib/embedder.py:18` pins `EMBEDDING_MODEL = "voyage-3"`. The companion file at `apps/web/lib/rag/embed.ts` (does not exist yet — owed by Plan 06-09) MUST declare:

```typescript
export const EMBEDDING_MODEL = "voyage-3"  // PINNED — must match vision-service/scripts/lib/embedder.py
```

If 06-09 forgets this, retrieval recall drops to near-random (RESEARCH Pitfall 4: "model mismatch puts queries and documents in incompatible embedding spaces"). The Python-side regression test will not catch the TS-side drift; 06-09 must add a parallel TS-side assertion.

## Deviations from Plan

**None.** Plan executed verbatim. The PLAN's `<interfaces>` section provided full file content for both modules; the only adjustment was the explicit two-clause exception ordering (which the PLAN itself flagged as a critical fix in `<interfaces>` — applied as written, not a deviation).

The 9 net-new tests added beyond Wave-0's 15 stubs (24 total - 15 = 9 new) were also specified in the PLAN's `<action>` Step 2 / Step 3 verbatim test code blocks (e.g. `test_initial_state_zero`, `test_add_increments_tokens_and_chunks`, `test_alert_ladder_fires_at_each_dollar`, `test_price_output_per_1m_is_haiku45_output`, `test_calls_guard_add_with_total_tokens`, `test_retries_then_raises_after_3_attempts`, `test_budget_exceeded_propagates_immediately`, `test_raises_when_batch_oversized`).

## Authentication Gates

None encountered. All voyageai SDK calls in tests use mock clients via `unittest.mock.patch("voyageai.Client", return_value=fake_client)` — no real API calls, no API key required for the test suite.

The `test_raises_voyage_embed_error_when_api_key_missing` test exercises the env-missing branch deliberately via `monkeypatch.delenv("VOYAGE_API_KEY")`.

## Self-Check

Files created and committed:
- `vision-service/scripts/lib/budget.py` — verified at commit `50e00d8`
- `vision-service/scripts/lib/embedder.py` — verified at commit `d1dee9a`

Tests added (24 total live in this plan's 3 test files):
- test_budget.py: 7 (was 4 skipped → 7 passed)
- test_contextualize_budget.py: 7 (was 5 skipped → 7 passed)
- test_embedder.py: 10 (was 6 skipped → 10 passed)

Commits made:
- `50e00d8` feat(06-05): VoyageBudgetGuard + ContextualBudgetGuard
- `d1dee9a` feat(06-05): voyage-3 embedder with retry + budget integration

## Self-Check: PASSED
