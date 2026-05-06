---
phase: 06-rag-ingestao
status: partial
started: 2026-05-05
updated: 2026-05-05
---

# Phase 6 — RAG Ingestão — UAT

**Phase:** 06-rag-ingestao
**Started:** 2026-05-05
**Founder:** Rhelton

---

## Current Test

Test 5 — Spot-check: lacuna setor 7 → top-5 chunks fígado/lacuna (founder gate, awaiting run via `pnpm rag:spot-check`).

---

## Known limitation v1

⚠ Ingest ships chunks with EMPTY controlled-vocabulary arrays:
`metadata.dimensoes=[]`, `setores_referenciados=[]`, `sinais_referenciados=[]`,
`constituicao_referenciada=[]`, `tags_livres=[]`. The D-R4 weighting rule
`dimensoes intersect 1.2×` is therefore INERT in v1 — it acts as a no-op until
the founder runs the deferred Claude-Code-session tagging exercise (D-T1..T5)
that populates these fields.

Additionally, the final ingest in 06-08 ran with `--no-contextual` (D-N1
DEFERRED — see STATE.md "Itens diferidos") so chunks have NO contextual
sentence prefix. The Anthropic Contextual Retrieval boost (~+35% recall per
Anthropic blog) is absent. To reactivate D-N1: `DELETE FROM knowledge_chunks
WHERE source_type='biblioteca';` + `pnpm rag:ingest` (default mode). Estimate:
30–90 min wall-clock + ~$2–5 Anthropic Tier 1.

For UAT scope, the spot-check qualitative grade reflects:
- Cosine retrieval (pgvector HNSW, ef_search=100)
- **Without** Contextual Retrieval (D-N1 deferred)
- Reranking (D-N2 — voyage-rerank-2.5)
- `clinical_data 1.5×` multiplier — also a no-op in Phase 6 (no chunks with
  `source_type='clinical_data'` populated; Fase 10 forward-compat)
- `alta_prioridade 1.1×` multiplier — active (manifest D-M1 marks 5 high-priority
  books in v0.1.2)
- `dimensoes intersect 1.2×` multiplier — **inert** until D-T1 lands

In other words, top-30 ranking in v1 is driven by **retrieval + rerank +
`source_book` priority**, NOT by domain-tag interactions and NOT by contextual
prefixes. UAT must be evaluated against this reality.

**Decision gate (06-13 founder gate):** if the spot-check shows recall is
insufficient (top-5 doesn't return relevant fígado/lacuna chunks for "lacuna
setor 7"), this is the trigger to reactivate D-N1 re-ingest before closing
the phase. Otherwise, defer D-N1 to Fase 9 polish.

---

## Tests

### Test 1 — Success Criterion 1: `vision-service/scripts/ingest_knowledge.py` rodado uma vez

**Test:** `pnpm rag:ingest --dry-run` succeeds; `pnpm rag:ingest --no-contextual`
completes successfully (06-08 founder gate ran with `--no-contextual` after
~$6 spent on failed Anthropic attempts).

**Actual:** Final ingest 2026-05-05 produced 2761 chunks across 12 distinct
source_books with $0.05 Voyage cost and zero contextual prefixes. Fix-chain
of 7 commits (e5f5535..995d0ea) restored D-N1 viability for future re-ingest.

**Result:** **PASS** (verified by 06-08 SUMMARY)

**Notes:** D-N1 contextual retrieval deferred per STATE.md "Itens diferidos".

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
- Voyage cost: $0.05 (well under $5 budget)
- Contextual cost: $0 (D-N1 deferred); ~$6 spent in failed attempts before
  pivot to `--no-contextual`

**Result:** **PASS** (verified by 06-08 SUMMARY; D-N1 deferred is documented gap)

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

**Top-5 review (Scenario 1: lacuna setor 7 / fígado):**
1. [book] [page] — [PASS/WEAK/FAIL]: [why]
2. [book] [page] — [PASS/WEAK/FAIL]: [why]
3. [book] [page] — [PASS/WEAK/FAIL]: [why]
4. [book] [page] — [PASS/WEAK/FAIL]: [why]
5. [book] [page] — [PASS/WEAK/FAIL]: [why]

**Tally:**
- **≥3/5 PASS** = Criterion 5 PASS
- **1–2/5 PASS** = WEAK — flag for D-N1 reactivation or re-tagging session
- **0/5 PASS** = FAIL — investigate (model mismatch? bad chunks? missing
  alta_prioridade flags?)

**Top-5 review (Scenario 2: anel de tensão + neurogênica):**
1. [book] [page] — [PASS/WEAK/FAIL]
2. [book] [page] — [PASS/WEAK/FAIL]
3. [book] [page] — [PASS/WEAK/FAIL]
4. [book] [page] — [PASS/WEAK/FAIL]
5. [book] [page] — [PASS/WEAK/FAIL]

**Top-5 review (Scenario 3: linfática + biliar — cross-language):**
1. [book] [page] — [PASS/WEAK/FAIL]
2. [book] [page] — [PASS/WEAK/FAIL]
3. [book] [page] — [PASS/WEAK/FAIL]
4. [book] [page] — [PASS/WEAK/FAIL]
5. [book] [page] — [PASS/WEAK/FAIL]

**Result:** **PENDING** — awaiting founder gate

**D-N1 reactivation decision:** `[trigger D-N1 re-ingest / defer to Fase 9]`

---

## Summary

| Total | Passed | Failed | Pending |
| ----- | ------ | ------ | ------- |
| 5     | 4      | 0      | 1       |

Tests 1–4 are PASS by virtue of prior plan execution (06-08 + 06-11 + 06-13).
Test 5 is PENDING the founder spot-check sign-off.

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
- [ ] Founder runs `pnpm rag:spot-check` and signs off Test 5

---

## Gaps

(Populated if founder reports issues during spot-check.)

---

**UAT signed off:** *pending founder gate*

---

*Phase: 06-rag-ingestao*
*UAT criado: 2026-05-05 (Plan 06-13)*
*Última atualização: pelo continuation agent após founder sign-off do Test 5*
