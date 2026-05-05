---
phase: 06-rag-ingestao
plan: "04"
subsystem: rag-extractor-and-chunker
status: complete
completed_date: "2026-05-05"
duration_minutes: 45
tasks_completed: 2
tasks_total: 2
files_created: 4
files_modified: 3
tags: [rag, python, extraction, chunking, content-hash, wave-1, pymupdf, pdfplumber, docx2txt, tiktoken]
requirements_completed: [RAG-01, RAG-02]

dependency_graph:
  requires:
    - phase: 06-rag-ingestao/06-01
      provides: "test_ingest_extract.py + test_chunker.py + test_idempotency.py scaffolding (13 stubs flipped GREEN by this plan); sample_book.txt fixture"
    - phase: 06-rag-ingestao/06-03
      provides: "PyMuPDF + pdfplumber + docx2txt + tiktoken pinned in requirements.txt"
  provides:
    - vision-service/scripts/lib/__init__.py (package marker)
    - vision-service/scripts/lib/pdf_extractor.py (extract_pdf primary/fallback + extract_docx + is_scanned_page heuristic)
    - vision-service/scripts/lib/chunker.py (chunk_book + content_hash + count_tokens + Chunk dataclass + D-C1 constants)
    - vision-service/tests/fixtures/_make_sample_pdf.py (idempotent 4-page PDF regenerator)
    - vision-service/tests/fixtures/sample_book.pdf (3538 bytes, 4 pages — was 67-byte stub)
  affects:
    - 06-05-PLAN (embedder.py consumes count_tokens + content_hash for budget + idempotency)
    - 06-06-PLAN (contextualizer.py + manifest.py loader — Chunk dataclass shape consumed)
    - 06-07-PLAN (persister.py uses content_hash for ON CONFLICT idempotency D-E2)
    - 06-08-PLAN (ingest_knowledge.py CLI orchestrator chains extract -> chunk -> embed -> persist)

tech_stack:
  added: []  # all deps already pinned in 06-03
  patterns:
    - "lazy-import-inside-function: pymupdf/pdfplumber/docx2txt imported inside _extract_pdf_pymupdf/_extract_pdf_pdfplumber/extract_docx so test collection succeeds without the heavy deps installed (mirrors `import httpx  # lazy` in modal_app.py:94)"
    - "lru_cache-singleton-encoder: count_tokens uses @functools.lru_cache(maxsize=1) on _get_encoder() to avoid repeated tiktoken initialization across thousands of chunks"
    - "marker-with-body-paragraph-split: chunk_book detects chapter/section markers via re.match (anchored at paragraph start) and splits the marker line off, emitting the rest as TEXT under the new chapter/section context — handles real PDFs where the page text starts with `CAPÍTULO I — Title\\nbody...` without losing body content"
    - "sentence-tail-overlap-seed: _tail_for_overlap walks sentences from the chunk's end, accumulating until ~OVERLAP_TOKENS=80 tokens are collected, and seeds the next chunk's buffer — works even when chunks contain a single large paragraph (paragraph-level overlap is too coarse for the 80-token target)"
    - "BPE-aware-piece-ceiling: _split_long_paragraph splits oversized paragraphs to TARGET_TOKENS=500 (not MAX=700) because count_tokens is sub-additive at chunk-join boundaries — leaving headroom keeps the rendered chunk's actual token count under MAX"
    - "fixture-as-text-spec deterministic regen: _make_sample_pdf.py reads sample_book.txt, splits on chapter+section markers, emits one A4 page per part — reproducible across runs; replaces 67-byte stub from 06-01 with 3538-byte 4-page real PDF"

key_files:
  created:
    - vision-service/scripts/lib/__init__.py
    - vision-service/scripts/lib/pdf_extractor.py
    - vision-service/scripts/lib/chunker.py
    - vision-service/tests/fixtures/_make_sample_pdf.py
  modified:
    - vision-service/tests/fixtures/sample_book.pdf  (67 -> 3538 bytes, 0 -> 4 pages)
    - vision-service/tests/test_ingest_extract.py    (4 skips -> 8 passes)
    - vision-service/tests/test_chunker.py           (5 skips -> 7 passes)
    - vision-service/tests/test_idempotency.py       (4 skips -> 5 passes)

key_decisions: []  # plan executed verbatim except for the algorithmic refinements documented under Deviations

metrics:
  duration_minutes: 45
  commits: 3  # 648a2ec extractor + da05ed5 chunker + 75f9b09 test flips
  pytest_passes_added: 20  # was 142, now 162
  pytest_skips_removed: 13
  pdf_size_before: 67
  pdf_size_after: 3538
  pdf_pages_before: 0
  pdf_pages_after: 4
---

# Phase 6 Plan 04: Wave 1 — pdf_extractor + chunker + content_hash Summary

**One-liner:** Custom Python chunker + PyMuPDF/pdfplumber/docx2txt extractors landed; 20 Wave-0 tests flipped GREEN (8 extractor + 7 chunker + 5 idempotency); content_hash locked to sha256(text.strip().encode('utf-8')) and verified against hardcoded sha256("hello") digest; sample_book.pdf regenerated 67 → 3538 bytes via _make_sample_pdf.py.

## Performance

- **Duration:** ~45 min (across 3 task commits + algorithmic refinement loop)
- **Started:** 2026-05-05 (after 06-03 Wave 0 closure at 54ed36d)
- **Completed:** 2026-05-05
- **Tasks:** 2 (Task 1 extractor + Task 2 chunker)
- **Files created:** 4 (__init__.py + pdf_extractor.py + chunker.py + _make_sample_pdf.py)
- **Files modified:** 3 (sample_book.pdf binary + 2 test files; test_ingest_extract.py was rewritten)
- **Commits:** 3 (648a2ec extractor + da05ed5 chunker + 75f9b09 test flips)

## Accomplishments

- 3 module files implementing PDF + DOCX extraction and chunking:
  - `scripts/lib/__init__.py` — package marker
  - `scripts/lib/pdf_extractor.py` — `extract_pdf(path, extractor='pymupdf'|'pdfplumber')`, `extract_docx(path)`, `is_scanned_page(page)`. RESEARCH lines 314–333 verbatim for scan heuristic. Lazy imports keep test collection cheap.
  - `scripts/lib/chunker.py` — `chunk_book(pages, book_meta) -> list[Chunk]`, `content_hash(text)`, `count_tokens(text)`, `Chunk` dataclass, D-C1 constants `TARGET_TOKENS=500 / MIN_TOKENS=300 / MAX_TOKENS=700 / OVERLAP_TOKENS=80`. Multilingual chapter+section regex; sentence-tail overlap; BPE-aware piece sizing.
- Synthetic fixture PDF regenerated via `_make_sample_pdf.py`: 4 A4 pages, 3538 bytes (was 67-byte stub from 06-01). Splits sample_book.txt on chapter+section markers so PyMuPDF-extracted text contains the canonical CAPÍTULO/section markers each on its own page.
- 20 Wave-0 tests flipped from skip → pass:
  - `test_ingest_extract.py`: 4 → 8 passes (added 3 scan-detection edge cases + ValueError test for unknown extractor; DOCX test consumes the read-only acervo file `727258853-endocrinology-and-iridology.docx`)
  - `test_chunker.py`: 5 → 7 passes (added end-to-end fixture-PDF smoke + locked-constants regression guard)
  - `test_idempotency.py`: 4 → 5 passes (added inner-whitespace preservation guard)
- content_hash canonicalization LOCKED: `content_hash('hello') == '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'` — direct sha256 of `b'hello'`. Test asserts equality against the hardcoded hex digest AND against `hashlib.sha256(b"hello").hexdigest()` so any future drift (NFC/NFD normalization, lowercase, whitespace collapse) breaks the test loud and clear.
- LGPD vocabulary audit clean across all 4 created Python files (`python -m scripts.audit_vocabulary` exit 0).
- Vitest unchanged (no TS files modified): 32 todos still skipped per Wave 0 contract.

## Task Commits

1. **Task 1: pdf_extractor + DOCX + scan detection + fixture regen** — `648a2ec` (feat)
   * scripts/lib/__init__.py + pdf_extractor.py
   * tests/fixtures/_make_sample_pdf.py (idempotent regenerator)
   * tests/fixtures/sample_book.pdf regenerated (67 → 3538 bytes)
   * tests/test_ingest_extract.py rewritten with 8 passing assertions
2. **Task 2 step 1: chunker module** — `da05ed5` (feat)
   * scripts/lib/chunker.py with full algorithm
3. **Task 2 step 2: test flips for chunker + idempotency** — `75f9b09` (test)
   * tests/test_chunker.py: 5 skips → 7 passes
   * tests/test_idempotency.py: 4 skips → 5 passes

## Deviations from Plan

The PLAN provided algorithm guidance and skeleton code that revealed, during execution, two subtle invariants that needed explicit handling. All deviations are correctness fixes (Rule 1) rather than scope changes — the public API, decision IDs, and acceptance criteria are unchanged.

### Auto-fixed Issues

**1. [Rule 1 — Bug] Section regex required `\S.*` (greedy line) instead of `\S` (single non-whitespace char)**

- **Found during:** Task 2 first pytest run
- **Issue:** PATTERNS.md skeleton `SECTION_RE = re.compile(r"^\s*(?:\d+\.\d+(?:\.\d+)?\s+\S|[A-Z]...)\s*$")` only matched section headings whose number was followed by a single non-whitespace character before the line end (e.g., `1.1 X`). Real headings like `1.1 Setor 7 Fígado` did NOT match — `\S` consumes one char, then `\s*$` requires whitespace/end which fails because `etor 7 Fígado` follows.
- **Fix:** Changed `\s+\S` → `\s+\S.*` so the numeric branch greedily matches the rest of the line.
- **Files modified:** scripts/lib/chunker.py:32
- **Commit:** da05ed5

**2. [Rule 1 — Bug] Single oversized paragraphs needed sentence-level splitting**

- **Found during:** Task 2 chunker testing with `'sentence. ' * 80` synthetic input
- **Issue:** PATTERNS algorithm split text into paragraphs by `\n\n+` then chunked at paragraph boundaries. A single paragraph >MAX_TOKENS would emit a chunk over the cap, violating D-C1's hard ceiling.
- **Fix:** Added `_split_long_paragraph(text, max_tokens)` safety valve — splits on `(?<=[.!?])\s+` and accumulates sentences with re-counted joined token totals (BPE-aware). Called inline before stream emission so every TEXT entry is ≤ TARGET_TOKENS.
- **Files modified:** scripts/lib/chunker.py:78
- **Commit:** da05ed5

**3. [Rule 1 — Bug] Tokenization is sub-additive at join boundaries**

- **Found during:** Task 2 testing — chunks were emerging at 753 / 798 tokens despite MAX=700
- **Issue:** `count_tokens(' '.join([s1, s2]))` ≠ `count_tokens(s1) + count_tokens(s2)` because BPE re-tokenizes at the joined boundary (typically +1 token per join). The chunker's accumulator (`buffer_tokens += count_tokens(paragraph)`) under-counts the rendered chunk's actual token total by ~5%.
- **Fix:** Two-fold: (a) `_split_long_paragraph` re-counts the candidate string after each join (`count_tokens(' '.join([*buf, sent]))`) instead of using an additive counter; (b) the piece-size ceiling for `_split_long_paragraph` is TARGET_TOKENS=500 (not MAX_TOKENS=700) so the rendered chunk + within-section overlap + boundary noise stays under MAX.
- **Files modified:** scripts/lib/chunker.py:78,118
- **Commit:** da05ed5

**4. [Rule 1 — Bug] Within-section overlap seed needed to be sentence-tail granularity, not paragraph-level**

- **Found during:** Task 2 — overlap test asserted 0 token overlap when buffer held a single large paragraph
- **Issue:** PATTERNS algorithm computed overlap by walking buffer paragraphs from the end and accumulating until `tail_tokens > OVERLAP_TOKENS`. When the buffer contained a single paragraph >80 tokens, the loop bailed immediately and produced an empty tail — no overlap.
- **Fix:** Added `_tail_for_overlap(text, target)` that takes the **rendered chunk text** and walks SENTENCES from the end, accumulating until ~target tokens are reached. The overlap seed is then re-injected as the first paragraph of the next chunk's buffer. Cap at 1.5× target prevents runaway when sentences are unusually long.
- **Files modified:** scripts/lib/chunker.py:60,159
- **Commit:** da05ed5

**5. [Rule 1 — Bug] Chapter/section markers at paragraph start lose body content**

- **Found during:** Task 2 — `test_chunker_runs_on_fixture_pdf` returned 0 chunks
- **Issue:** PyMuPDF emits page text where each page is essentially a single "paragraph" (only single newlines between lines, no `\n\n` between heading and body). The original algorithm classified the entire paragraph as CHAPTER/SECTION when the regex matched anywhere — losing the body content entirely.
- **Fix:** Switched marker detection from `re.search` to `re.match` (anchored at paragraph start). When a paragraph begins with a marker, extract the first line as the marker and emit `rest` (the body) as TEXT under the new chapter/section. This preserves body content while still reacting to the structural cue.
- **Files modified:** scripts/lib/chunker.py:147–172
- **Commit:** da05ed5

**6. [Rule 2 — Hardening] Test fixture used uniquely-numbered sentences**

- **Found during:** Task 2 — overlap measurement was polluted by the synthetic fixture's repeated sentences
- **Issue:** `'sentence. ' * 80` contains the same sentence 80 times. The test "find longest common substring between adjacent chunks" cannot distinguish chunker-overlap from naturally repeated content — overlap measurements come back at 200+ tokens whether or not the chunker is doing anything.
- **Fix:** Added `_varied_paragraph(prefix, count)` helper to test_chunker.py that emits 200 sentences each with an embedded counter (`sentenca numero 042 sobre o tema discutido`). Now the longest common substring between adjacent chunks reflects actual chunker overlap.
- **Files modified:** tests/test_chunker.py:30–38 (helper) + 53,69 (fixture text)
- **Commit:** 75f9b09

**Note: All six fixes were caught by Wave 0 tests; the test scaffolding was effective at surfacing real algorithmic issues. None of the fixes change the public API contract (extract_pdf/extract_docx/chunk_book/content_hash signatures), the decision IDs, or the acceptance criteria.**

### Auth gates encountered

None. All operations are local file I/O and pure Python.

### Pre-existing legacy items (out of scope)

- `pnpm exec tsc --noEmit` apps/web tree: 5 pre-existing errors in `lib/vision/modal-client.test.ts` (Phase 5 carry-over) — NOT touched by this plan.
- `pnpm audit:vocabulary` (apps/web tree): 8 pre-existing matches in Phase 3 code comments — already documented in `.planning/phases/04-upload-desktop/deferred-items.md`.

## Algorithm Notes (for downstream plans)

**Chunk distribution from real fixture PDF (`tests/fixtures/sample_book.pdf`, 4 pages):**
- 3 chunks emitted: tokens=[247, 184, 98]
- avg=176 tokens (well below TARGET=500 because the fixture is intentionally small — 1.95 KB sample_book.txt)
- chapter detection: 2 distinct (`CAPÍTULO I — Introdução à Iridologia` + `CAPÍTULO II — Setores Iridais`)
- section detection: 2 distinct under chapter II (`1.1 Setor 7 — Fígado` + `1.2 Lacunas e Criptas`)

**Chunk distribution from synthetic test fixture (varied 200-sentence paragraphs):**
- 12 tests across test_chunker.py + test_idempotency.py all pass
- Chunks land in [300, 700] range with overlap ~80 tokens within section
- Cross-chapter pairs share NO sentence content

**For 06-08 ingestion CLI:** The chunker handles real-world PDF quirks already — a paragraph that begins with a chapter heading still produces a chunk with the body text under the new chapter context. Pages with only a marker line (e.g., a chapter title page) emit no TEXT entries; the marker still updates `current_chapter` so subsequent pages' content lands under it.

**For 06-05 embedder + budget:** `count_tokens` is fine for chunk-size budgeting (D-C1 300–700 band tolerates the ~5% BPE drift) but inadequate for cost-budget enforcement; per RESEARCH §tiktoken (line 287), use the `total_tokens` field from `vo.embed()` responses instead.

**For 06-07 persister:** `content_hash(chunk.text)` is the single source of truth for D-E2 idempotency. The test pins the canonicalization to `sha256(text.strip().encode('utf-8'))` against a hardcoded "hello" digest — any drift breaks the test.

## Verification Summary

| Gate | Command | Result |
|------|---------|--------|
| Target test files (3) | `cd vision-service && python -m pytest tests/test_ingest_extract.py tests/test_chunker.py tests/test_idempotency.py -v` | **EXIT 0** — 20 passed (8 + 7 + 5) |
| Full vision-service suite | `cd vision-service && python -m pytest -q` | **EXIT 0** — 162 passed, 33 skipped (was 142 / 46 baseline; +20 passes / -13 skips) |
| Phase 5 regression check | `cd vision-service && python -m pytest tests/ -q --ignore=tests/test_ingest_extract.py --ignore=tests/test_chunker.py --ignore=tests/test_idempotency.py` | **EXIT 0** — 142 passed, 33 skipped (matches Wave 0 baseline ex-target) |
| LGPD audit (vision-service) | `cd vision-service && python -m scripts.audit_vocabulary` | **EXIT 0** — clean |
| Acceptance import chain | `python -c "from scripts.lib.pdf_extractor import extract_pdf, extract_docx, is_scanned_page; from scripts.lib.chunker import chunk_book, content_hash, count_tokens, Chunk, TARGET_TOKENS, MIN_TOKENS, MAX_TOKENS, OVERLAP_TOKENS; assert content_hash('hello')=='2cf24...4'"` | **EXIT 0** — all imports + locked invariant OK |
| Sample PDF regenerated | `wc -c vision-service/tests/fixtures/sample_book.pdf` | **3538 bytes** (was 67) |
| Sample PDF page count | `python -c "import pymupdf; print(len(pymupdf.open('tests/fixtures/sample_book.pdf')))"` | **4 pages** |
| Lazy import comments | `grep -c "lazy" vision-service/scripts/lib/pdf_extractor.py` | **4** (>=3 required) |
| pytest.mark.skip removed | `grep -c "pytest.mark.skip" vision-service/tests/test_ingest_extract.py vision-service/tests/test_chunker.py vision-service/tests/test_idempotency.py` | **0** in all 3 files |
| RESEARCH Pitfall 1 mention | `grep -c "Pitfall 1" vision-service/scripts/lib/chunker.py` | **2** (>=1 required) |
| Vitest baseline preserved | `cd apps/web && pnpm test:run lib/rag/` | **EXIT 0** — 32 todos still skipped |

## Issues Encountered

The 6 algorithmic refinements documented under **Deviations** were the only issues — all were caught by the Wave 0 tests (proving the scaffolding's value), all were correctness fixes within the same module, and none required architectural changes. Total iteration cost: ~6 inner-loop pytest runs across ~10 minutes.

## User Setup Required

None. All deliverables are local files; no external services or config touched.

## Next Phase Readiness

Wave 1 progress: **1/3 plans complete** (06-04 ✓; 06-05 + 06-06 still pending).

Wave 1 remaining work unblocked:
- 06-05 (embedder + budget): consumes `count_tokens` (chunker.py) for chunk-size budget; `content_hash` (chunker.py) for D-E2 idempotency dedup before embedding.
- 06-06 (contextualizer + manifest.py loader): consumes `Chunk` dataclass shape; `chunk_book` produces the input for contextualizer; manifest.py validates books_manifest.json shape.
- 06-07 (persister): consumes `content_hash` for ON CONFLICT D-E2; needs Chunk dataclass for upsert row construction.
- 06-08 (CLI orchestrator): chains extract_pdf → chunk_book → contextualize → embed → persist.

No blockers. Wave 1 can continue in parallel for 06-05 and 06-06.

## Self-Check: PASSED

Verified all claims:

| Claim | Verification |
|-------|--------------|
| `scripts/lib/__init__.py` exists | filesystem check → FOUND |
| `scripts/lib/pdf_extractor.py` exists | filesystem check → FOUND |
| `scripts/lib/chunker.py` exists | filesystem check → FOUND |
| `tests/fixtures/_make_sample_pdf.py` exists | filesystem check → FOUND |
| `tests/fixtures/sample_book.pdf` regenerated to 3538 bytes | `wc -c` → 3538 (was 67) |
| Commit `648a2ec` exists | `git log --oneline \| grep 648a2ec` → FOUND ("feat(06-04): add pdf_extractor (pymupdf+pdfplumber+docx2txt) with scan detection") |
| Commit `da05ed5` exists | `git log --oneline \| grep da05ed5` → FOUND ("feat(06-04): add chunker with content_hash canonicalization (D-C1, D-E2)") |
| Commit `75f9b09` exists | `git log --oneline \| grep 75f9b09` → FOUND ("test(06-04): flip Wave 0 stubs GREEN — 12 tests for chunker + idempotency") |
| 20 target tests pass | `pytest tests/test_ingest_extract.py tests/test_chunker.py tests/test_idempotency.py -v` → 20 passed |
| Full suite 162 passed / 33 skipped | `pytest -q` → exact match |
| content_hash invariant locked | `python -c "from scripts.lib.chunker import content_hash; assert content_hash('hello') == '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'"` → exit 0 |
| LGPD audit clean | `python -m scripts.audit_vocabulary` → exit 0 |
| Sample PDF has 4 pages | `python -c "import pymupdf; print(len(pymupdf.open('tests/fixtures/sample_book.pdf')))"` → 4 |
| No `pytest.mark.skip` in target test files | grep across 3 files → 0 |
| Lazy-import pattern documented | `grep -c "lazy" pdf_extractor.py` → 4; `grep -c "lazy" chunker.py` → 1 |

---
*Phase: 06-rag-ingestao*
*Completed: 2026-05-05*
