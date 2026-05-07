---
phase: 06-rag-ingestao
status: resolved
started: 2026-05-05
updated: 2026-05-05
signed_off_by: Rhelton
signed_off_date: 2026-05-05
---

# Phase 6 — RAG Ingestão — UAT

**Phase:** 06-rag-ingestao
**Started:** 2026-05-05
**Founder:** Rhelton

---

## Current Test

All 5 tests PASS. Founder UAT signed off 2026-05-05 after `pnpm rag:spot-check` verified all 3 scenarios green.

---

## Known limitation v1 (after final D-N1 reactivation)

⚠ Ingest ships chunks with EMPTY controlled-vocabulary arrays:
`metadata.dimensoes=[]`, `setores_referenciados=[]`, `sinais_referenciados=[]`,
`constituicao_referenciada=[]`, `tags_livres=[]`. The D-R4 weighting rule
`dimensoes intersect 1.2×` is therefore INERT in v1 — it acts as a no-op until
the founder runs the deferred Claude-Code-session tagging exercise (D-T1..T5)
that populates these fields.

**D-N1 Contextual Retrieval is ACTIVE in the final corpus** (resolved 2026-05-05).
After an initial deferral due to a budget guard accounting bug + 5-min cache TTL
expiring under Tier 1 throttling + wrong Haiku 4.5 prices, the fix-chain across
~10 commits (e5f5535..d9b2cc9) restored D-N1 viability. Founder ran a full
`pnpm rag:ingest` with `cache_control: { type: 'ephemeral', ttl: '1h' }` and got
2761 chunks indexed with 91% coverage (2505 chunks have `[Contexto: ...]` prefix;
256 chunks from "Iridology a Guide to Iris Analysis" Adam Jackson legitimately
skipped because one chapter exceeds the 40K Tier 1 TPM cap). Cost: $3.59
contextual + $0.11 voyage = $3.70 total at 98% cache hit rate.

For UAT scope, the spot-check qualitative grade reflects:
- Cosine retrieval (pgvector HNSW, ef_search=40 default per migration 0006 —
  the original `SET LOCAL hnsw.ef_search = 100` was rejected by Postgres
  because SET is forbidden in STABLE functions; if recall proves insufficient
  later, raise via `ALTER DATABASE postgres SET hnsw.ef_search = 100;`)
- D-N1 Contextual Retrieval (91% of chunks)
- Reranking (D-N2 — voyage-rerank-2.5)
- `clinical_data 1.5×` multiplier — no-op in Phase 6 (no chunks with
  `source_type='clinical_data'` populated; Fase 10 forward-compat)
- `alta_prioridade 1.1×` multiplier — active (manifest D-M1 marks 5 high-priority
  books in v0.1.2)
- `dimensoes intersect 1.2×` multiplier — **inert** until D-T1 lands

In other words, top-30 ranking in v1 is driven by **retrieval + D-N1 contextual +
rerank + `source_book` priority**, NOT yet by domain-tag interactions
(`dimensoes`, `setores_referenciados`, etc.). The tagger session is the next
quality-improvement lever.

---

## Tests

### Test 1 — Success Criterion 1: `vision-service/scripts/ingest_knowledge.py` rodado uma vez

**Test:** `pnpm rag:ingest --dry-run` succeeds; `pnpm rag:ingest --no-contextual`
completes successfully (06-08 founder gate ran with `--no-contextual` after
~$6 spent on failed Anthropic attempts).

**Actual:** Initial ingest 2026-05-05 produced 2761 chunks (no contextual)
after the first attempt blew $6 on Anthropic with broken cost tracking.
After 4 additional fixes (8da720b cache_creation tracking + 1h TTL,
0da1887 corrected Haiku 4.5 prices, d9b2cc9 migration 0006 dropping
SET LOCAL from STABLE function, plus 06-13 RPC + auth fixes), founder
ran a final D-N1-active re-ingest: 2761 chunks across 12 books, 2505
with `[Contexto: ...]` prefix (91% coverage), $3.59 contextual + $0.11
voyage at 98% cache hit rate.

**Result:** **PASS** (verified by 06-08 SUMMARY + 06-13 D-N1 reactivation)

**Notes:** D-N1 contextual retrieval ACTIVE in final corpus (resolved
2026-05-05). Adam Jackson's 256 chunks legitimately skip D-N1 because
one chapter exceeds 40K Tier 1 TPM cap.

---

### Test 2 — Success Criterion 2: `knowledge_chunks` populated

**Test:**
```sql
select count(*), count(distinct source_book)
from knowledge_chunks
where source_type = 'biblioteca';
-- Expected: ≥ 1000 chunks, ≥ 10 distinct books
```

**Actual:** 2761 chunks across 12 distinct source_books (276% / 120% of targets).

**Result:** **PASS** (verified by 06-08 SUMMARY)

---

### Test 3 — Success Criterion 3: Embeddings dim 1024 + cost ≤ ~US$ 25

**Test:**
```sql
select id, vector_dims(embedding) from knowledge_chunks limit 5;
-- Expected: all rows show 1024
```
Plus: 06-08 final cost report ≤ $5 voyage + ≤ $15 contextual.

**Actual:**
- All rows: `vector_dims(embedding) = 1024` (`voyage-3` PINNED in
  vision-service/scripts/lib/embedder.py + apps/web/lib/rag/embed.ts)
- Final Voyage cost: $0.11 (well under $5 budget; cumulative across 2 ingests)
- Final Contextual cost: $3.59 (under $15 hardcap; D-N1 active at 91% coverage,
  98% cache hit rate, 1h TTL working as designed)
- Total cost: $3.70 final + ~$6 wasted on initial broken attempts = ~$9.70 over
  the lifetime of the phase

**Result:** **PASS** (verified by 06-08 SUMMARY + final re-ingest 2026-05-05)

---

### Test 4 — Success Criterion 4: `retrieveRelevantKnowledge` returns ≤30 chunks in ≤3s

**Test:** vitest `apps/web/lib/rag/search.test.ts` covers:
- caps result at 30 chunks (D-R3)
- latency p95 ≤ 2s with 8 mocked queries (D-N4 early-warning)
- runs RPC calls in parallel (Promise.all — D-R5)
- dedupes by id, keeps best cosine score
- orders chunks by score desc

Plus end-to-end timing via `pnpm rag:spot-check` (Test 5).

**Actual:** 10/10 search.test.ts tests green; 18/18 lib/rag/ tests green
overall after the ALTA_PRIORIDADE_BOOKS sync in 06-13.

**Result:** **PASS** (verified by 06-11 + 06-13)

---

### Test 5 — Success Criterion 5: Spot-check (founder gate)

**Test:** Founder runs `pnpm rag:spot-check` against the running Next.js dev
server and qualitatively grades the top-5 chunks for the canonical scenario
"lacuna setor 7 (fígado), constituição biliar".

**How to run (Windows PowerShell):**
```powershell
cd D:\Projetos\Iridologista
$env:RAG_SPOT_CHECK_TOKEN = (New-Guid).ToString()

# Terminal A — boot the dev server
pnpm dev

# Terminal B — spot-check
$env:RAG_SPOT_CHECK_TOKEN = "<same value as Terminal A>"
pnpm rag:spot-check
```

The Route Handler `apps/web/app/api/admin/rag-spot-check/route.ts` exercises
3 scenarios and returns JSON with top-5 chunks per scenario.

**Top-5 review (Scenario 1: lacuna setor 7 / fígado, retrieved=21):**
1. Cunha Chagas pt-BR — score 0.596 — **PASS**: biliar constitution
2. Cunha Chagas pt-BR — score 0.570 — **PASS**: constitution types
3. Manual Espanhol — score 0.521 — **PASS**: mixed/biliar constitution
4. Manual Espanhol — score 0.518 — **PASS**: constitutional types
5. Cunha Chagas pt-BR — score 0.496 — **PASS**: sinais sintomáticos
All chunks carry `[Contexto: ...]` D-N1 prefix.

**Tally:** 5/5 PASS → Criterion 5 **PASS**.

**Top-5 review (Scenario 2: anel de tensão + neurogênica, retrieved=30):**
Top-5 covers psychoemotional dimension + Lo Rito/Birello (Italian school) +
Jensen + Iridologia Psicoterapêutica (Brazilian psychoemotional reference).
All recognizably about the requested feature combination. **PASS**.

**Top-5 review (Scenario 3: linfática + biliar — cross-language, retrieved=18):**
Top-5 includes pt-BR + en + es sources — voyage-3 cross-lingual semantic
matching working as expected. **PASS**.

**Result:** **PASS** — founder grade 2026-05-05 by Rhelton.

**D-N1 reactivation decision:** N/A — D-N1 already active in the final
corpus (91% coverage). The deferred entry in STATE.md "Itens diferidos"
is now resolved.

---

## Summary

| Total | Passed | Failed | Pending |
| ----- | ------ | ------ | ------- |
| 5     | 5      | 0      | 0       |

All 5 success criteria PASS as of 2026-05-05. Phase 6 UAT closed.

---

## Closing checklist

- [ ] All 5 success criteria PASS
- [x] `cd vision-service && python -m pytest tests/ -v 2>&1 | tail -5` shows
  Phase 5 + Phase 6 pytest green (239/4 per 06-08 SUMMARY)
- [x] `pnpm --filter web test:run lib/rag/` shows all lib/rag/ vitest green
  (45/45 per 06-13 verification)
- [x] LGPD audits — `pnpm audit:vocabulary:db` exit 0 (06-12 verified);
  `cd vision-service && python -m scripts.audit_vocabulary` exit 0 (06-12);
  `pnpm --filter web audit:vocabulary` 8 pre-existing Phase 3 hits unchanged,
  zero new from lib/rag/ (06-12 acceptance criterion met)
- [x] STATE.md Battello falso-positivo blocker removed (06-13 commit `c3c38d8`)
- [x] REQUIREMENTS.md RAG-01..04 reflect implementation reality (06-13 commit
  `c3c38d8`)
- [x] ALTA_PRIORIDADE_BOOKS in `apps/web/lib/rag/search.ts` synced to manifest
  v0.1.2 (06-13 commit `2cc85e2`); W3 drift detection test green
- [x] Founder runs `pnpm rag:spot-check` and signs off Test 5 (2026-05-05)
- [x] D-N1 Contextual Retrieval reactivated and verified working (91% coverage)

---

## Gaps

(Populated if founder reports issues during spot-check.)

---

**UAT signed off:** **2026-05-05 by Rhelton** — all 5 Success Criteria PASS, retrieval pipeline production-grade with D-N1 active.

---

*Phase: 06-rag-ingestao*
*UAT criado: 2026-05-05 (Plan 06-13)*
*Última atualização: pelo continuation agent após founder sign-off do Test 5*
