---
phase: 06-rag-ingestao
plan: "03"
subsystem: rag-deps-and-manifest
status: complete
completed_date: "2026-05-05"
duration_minutes: 30
tasks_completed: 3
tasks_total: 3
files_created: 2
files_modified: 3
tags: [rag, deps, manifest, founder-gate, wave-0, voyageai, pymupdf, anthropic]
requirements_completed: [RAG-01, RAG-02, RAG-03]

dependency_graph:
  requires:
    - phase: 06-rag-ingestao/06-01
      provides: "test_books_manifest.py scaffolding (Wave 0 stubs — flip GREEN by 06-06 once Pydantic loader lands)"
    - phase: 06-rag-ingestao/06-02
      provides: "vocabularies.json escola_origem (7 schools) — manifest_assist.py default mapping mirrors these"
  provides:
    - vision-service/requirements.txt (8 RAG deps pinned: voyageai 0.3.7, PyMuPDF 1.27.2.3, pdfplumber 0.11.9, docx2txt 0.8, tiktoken, supabase, psycopg2-binary, anthropic)
    - apps/web/package.json (voyageai TS SDK ^0.2.1)
    - package.json (root rag scripts: rag:ingest, rag:purge, rag:spot-check, audit:vocabulary:db)
    - vision-service/scripts/manifest_assist.py (bootstrap CLI for D-M1 manifest)
    - vision-service/scripts/data/books_manifest.json (D-M1 founder-validated v0.1.1, 18 entries)
  affects:
    - 06-04-PLAN (chunker.py + pdf_extractor.py — consume PyMuPDF + pdfplumber + docx2txt deps)
    - 06-05-PLAN (embedder.py + budget.py — consume voyageai + tiktoken)
    - 06-06-PLAN (contextualizer.py + manifest.py loader — consume anthropic, parses books_manifest.json)
    - 06-07-PLAN (persister.py — consumes supabase, psycopg2-binary)
    - 06-08-PLAN (ingest_knowledge.py CLI — orchestrates full pipeline using all deps)
    - 06-09-PLAN (apps/web embed.ts — consumes voyageai TS SDK)
    - 06-12-PLAN (audit:vocabulary:db root script — node apps/web/scripts/audit-vocabulary-db.mjs)

tech_stack:
  added:
    - "voyageai==0.3.7 (Python) — D-E1 voyage-3 embeddings + voyage-rerank-2.5 D-N2"
    - "voyageai^0.2.1 (TS) — Python/TS parity for embed.ts"
    - "PyMuPDF==1.27.2.3 — D-C4 default PDF extractor (text-based PDFs)"
    - "pdfplumber==0.11.9 — D-C4 fallback for table-heavy PDFs (#8 dictionary opt-in)"
    - "docx2txt==0.8 — minimal DOCX surface (RESEARCH line 351)"
    - "tiktoken>=0.7,<0.10 — chunk size control (~500 tokens, flex 300-700)"
    - "supabase>=2.5,<3.0 — D-E2 ON CONFLICT persister"
    - "psycopg2-binary>=2.9 — direct DB driver fallback"
    - "anthropic>=0.40 — D-N1 Contextual Retrieval via Haiku 4.5 + prompt caching"
  patterns:
    - "founder-gate-with-version-bump: v0.1.0 -> v0.1.1 reflects 7 founder edits (escola corrections, autor fills, extrator override) per D-T6"
    - "manifest-as-canonical-data: books_manifest.json is the single source of truth for D-M1 (autor/escola/idioma/ano/alta_prioridade/extrator/skip/notas) — chunker tagger and persister both consume it without re-discovery"
    - "extrator-override-pattern: default pymupdf for PDFs, founder overrides per-book to pdfplumber for table/glossary heavy content (#8 dictionary)"
    - "skip-flag-as-deduplication: 2 entries marked skip=true preserve audit trail of duplicates (#6 docx redundant with PDF, #13 mod-03 copy-marker)"

key_files:
  created:
    - vision-service/scripts/manifest_assist.py
    - vision-service/scripts/data/books_manifest.json
  modified:
    - vision-service/requirements.txt
    - apps/web/package.json
    - package.json

key_decisions:
  - "Approved 7 alta_prioridade books: Jensen Simplified (#1), Iridologia em Defesa da Vida (#4), Bernard-Jensen-Iridology-pdf (#7 — newly added — Jensen Vol.1/Vol.2 core reference), Dictionary of Iridology (#8), Iridologia Psicoemocional (#9), What the Eye Reveals (#15 Rayid), Lo Rito Profondo (#17 Italiana)"
  - "Confirmed 2 skip=true entries: Bernard-Jensen.docx (#6 — duplicate of PDF #7), iridologia-mod-03 (1).pdf (#13 — duplicate of #14)"
  - "Reclassified #10 IRIDOLOGIA-PSICOTERAPEUTICA-METODO-VETORIAL: escola Brasileira -> Italiana (metodo vetorial = Lo Rito's spaziorischio methodology — Italiana lineage despite being in pt)"
  - "Reclassified #16 endocrinology-and-iridology.docx: escola Jensen -> Andrews-britanica (Andrews is British school, distinct lineage from Jensen)"
  - "Override #8 dictionary extrator pymupdf -> pdfplumber (glossary/table-heavy content benefits from pdfplumber's table detection per D-C4)"
  - "Founder filled autor for 7 entries (Moraga Gajardo, Miryan Cunha Chagas, Bernard Jensen, Denny Johnson, John Andrews, Lucio Birello & Daniele Lo Rito, Adam J. Jackson); preserved Unknown for 5 entries (#5, #10, #11, #12, #14) per founder instruction not to guess"
  - "Corrected #4 ano: 2008 -> 2012 (TCC UNI 2012 confirmed) and #16 ano: 1985 -> 2005 (Andrews endocrinology text dated correctly)"
  - "Bumped books_manifest.json version 0.1.0 -> 0.1.1 (D-T6 versioning rule, patch-level for non-breaking schema-compatible edits)"

patterns_established:
  - "Founder gate as commit-pair (continuation-style): 2 pre-checkpoint commits (deps + bootstrap manifest) + 1 post-checkpoint commit (founder edits + version bump) — audit trail preserves proposed-vs-approved diff. Mirrors Plan 06-02 founder-gate pattern."
  - "Manifest_assist.py as long-lived bootstrap helper: --yes for non-interactive default population, --validate for shape sanity check (Pydantic in 06-06), interactive mode for re-bootstrap if files added/removed. Pattern reusable for any catalog-style data file (e.g., future jensen-map updates)."

metrics:
  duration_minutes: 30
  commits: 3  # 8859f90 deps + e256e1e bootstrap + 0d748c3 founder edits
  manifest_version: "0.1.1"
  manifest_books_count: 18
  alta_prioridade_count: 7
  skip_count: 2
  pdfplumber_count: 1
  ocr_required_count: 0
  py_deps_added: 8
  ts_deps_added: 1
  root_scripts_added: 4
---

# Phase 6 Plan 03: Wave 0 — Deps + Manifest Summary

**One-liner:** 8 Python RAG deps pinned + voyageai TS SDK installed + 4 root rag:* scripts wired + manifest_assist.py bootstrap helper authored + books_manifest.json populated with 18 entries founder-validated (v0.1.1 with 7 alta_prioridade books, 2 skips, 1 pdfplumber override).

## Performance

- **Duration:** ~30 min total (across 3 commits, including founder-gate pause)
- **Started:** 2026-05-05 (pre-checkpoint Tasks 1+2)
- **Completed:** 2026-05-05 (post-checkpoint founder edits)
- **Tasks:** 3 (Task 1 + Task 2 + Task 3 founder-gate)
- **Files created:** 2 (manifest_assist.py + books_manifest.json)
- **Files modified:** 3 (requirements.txt + apps/web/package.json + root package.json)
- **Commits:** 3 (8859f90 deps + e256e1e bootstrap + 0d748c3 founder edits)

## Accomplishments

- 8 Python RAG dependencies pinned in requirements.txt (voyageai, PyMuPDF, pdfplumber, docx2txt, tiktoken, supabase, psycopg2-binary, anthropic) — Modal image unaffected (local-only deps for ingestion script)
- voyageai TS SDK pinned in apps/web/package.json + installed via pnpm — node_modules/voyageai/ resolves
- 4 root scripts wired in package.json: rag:ingest, rag:purge, rag:spot-check, audit:vocabulary:db (placeholders that will resolve to ingest_knowledge.py / rag-spot-check.ts / audit-vocabulary-db.mjs as 06-08/06-12/06-13 land)
- manifest_assist.py authored with 3 modes: bootstrap (default), --yes (non-interactive accept defaults), --validate (shape check on existing manifest)
- books_manifest.json populated with 18 entries from D:/Projetos/Iridologista/livros/ — 16 PDFs + 2 DOCX
- Founder edits applied: 7 autor fills, 2 ano corrections, 1 alta_prioridade flip (#7 -> true), 1 escola reclassification (#10 -> Italiana), 1 escola reclassification (#16 -> Andrews-britanica), 1 extrator override (#8 -> pdfplumber), 5 notas updates, version bumped to 0.1.1
- Final aggregates: 7 alta_prioridade, 2 skip, 1 pdfplumber, 0 ocr_required (matches plan acceptance criteria with the +1 alta_prioridade addition for #7 Jensen Vol.1/Vol.2 core)
- LGPD audit clean across all 5 touched files
- pytest baseline preserved: 142 passed / 46 skipped (matches pre-edit baseline)

## Task Commits

Each task was committed atomically:

1. **Task 1: Pin RAG deps + wire root scripts** — `8859f90` (feat)
   * vision-service/requirements.txt: +8 deps under "Phase 6 — RAG ingestion" comment block
   * apps/web/package.json: +voyageai ^0.2.1 in dependencies (alphabetical placement)
   * package.json: +4 rag:* scripts after type-check
   * pip install + pnpm install both clean
2. **Task 2: Author manifest_assist.py + bootstrap manifest** — `e256e1e` (feat)
   * manifest_assist.py: 200+ line CLI with bootstrap/--yes/--validate modes
   * books_manifest.json: 18 entries auto-defaulted from filename substring match (escola/idioma/ano/extrator)
3. **Task 3: Founder-gate edits + version bump** — `0d748c3` (feat)
   * 18 per-book entries reviewed; 10 entries received content edits (autor/ano/notas/escola/extrator/alta_prioridade per founder review)
   * 8 entries confirmed unchanged from defaults
   * version bumped 0.1.0 -> 0.1.1
   * No manifest_assist.py changes (still works for re-bootstrap if acervo grows)

**Plan metadata commit:** (this SUMMARY commit, separate from per-task)

## Files Created/Modified

### Created (2)

- `vision-service/scripts/manifest_assist.py` — interactive CLI for bootstrapping books_manifest.json from D:/Projetos/Iridologista/livros/. Three modes: default (interactive review), --yes (accept defaults), --validate (shape check). Default mapping covers all 18 acervo files via substring match (Bernard Jensen / Iridology / Manual / Congreso / Iridologia / Birello / Jackson / etc.). Shape check enforces 10 required keys per entry and presence of catalog_name + version. Pydantic full validation lands in 06-06 (manifest.py loader).
- `vision-service/scripts/data/books_manifest.json` — D-M1 manifest v0.1.1 with 18 founder-validated entries. Each entry has 10 fields (filename, autor, escola, idioma, ano, alta_prioridade, extrator, skip, ocr_required, notas). Source of truth for D-M1 consumed by chunker (06-04 metadata tagging), persister (06-07 source_book), CLI orchestrator (06-08 file iteration), and reranker (06-11 alta_prioridade boost via D-R4).

### Modified (3)

- `vision-service/requirements.txt` — appended 8 Phase 6 deps under separator comment. All pins verified via PyPI 2026-05-04 (RESEARCH lines 384-392). Existing Phase 5 deps untouched.
- `apps/web/package.json` — added voyageai ^0.2.1 to dependencies in alphabetical position (between tw-animate-css and zod). pnpm-lock.yaml updated.
- `package.json` (root) — added 4 rag:* scripts after type-check entry. Each resolves to a script that lands in 06-08/06-12/06-13 (currently exits with "module not found" — acceptable per Wave 0 plan).

## Decisions Made (founder-gate edits)

See frontmatter `key_decisions` for the full list. Key rationale:

- **#7 Bernard-Jensen-Iridology-pdf alta_prioridade flipped false -> true:** This is the Jensen Vol.1/Vol.2 core reference text — founder confirmed it deserves the +10% retrieval boost (D-R4). The pre-checkpoint default was conservative (only Jensen Simplified #1 marked alta_prioridade for the Jensen lineage); founder added #7 to ensure the volume-principal text also gets boosted. Brings alta_prioridade total from 6 (default) to 7 (founder-final).
- **#10 IRIDOLOGIA-PSICOTERAPEUTICA escola reclassified Brasileira -> Italiana:** "Metodo vetorial" is Lo Rito's spaziorischio methodology — even though the book is in Portuguese, its lineage is Italian (descends from Birello/Lo Rito). escola_origem field tracks methodological lineage, not language; idioma stays pt. This avoids polluting the Brasileira corpus with non-Brasileira methodology in retrieval.
- **#16 endocrinology-and-iridology escola reclassified Jensen -> Andrews-britanica:** John Andrews is the British school founder, distinct lineage from Jensen (American). Pre-checkpoint default of "Jensen" for any English-language iridology text was a heuristic shortcut; founder corrected based on actual authorship.
- **#8 dictionary-of-iridology extrator override pymupdf -> pdfplumber:** Glossary/table-heavy content (alphabetical entries with definitions, may have tables of synonyms). pdfplumber's table detection (D-C4 fallback opt-in) preserves structure better than pymupdf's flat text extraction. Founder verified by sampling the PDF.
- **5 entries kept autor=Unknown intentionally:** #5 IridENews5 (newsletter, no clear author), #10 (multiple methodology contributors), #11/#12/#14 (Brazilian Manuals with no clear single author). Founder explicitly asked NOT to guess these — preserve as Unknown until confirmed sources are found.
- **Version bump 0.1.0 -> 0.1.1 (D-T6):** Patch-level because edits are non-breaking schema-compatible (no new keys added/removed, no key types changed). Approval date stays 2026-05-05 (same calendar day as bootstrap).

## Deviations from Plan

### Auto-fixed Issues

**None.** Plan executed exactly as written. All 3 tasks completed in spec order. Founder edits applied verbatim per the user's spec.

### Auth gates encountered

None. All operations are local file I/O + pip/pnpm package install (no external auth required).

### Pre-existing legacy items (out of scope)

- `pnpm exec tsc --noEmit` apps/web tree: 5 pre-existing errors in `lib/vision/modal-client.test.ts` (Phase 5 test code, tuple type narrowing). Carries over from 06-02 verification — NOT caused by this plan; verified by `tsc 2>&1 | grep "lib/rag/"` returns empty. Documented as deferred Fase 5 cleanup in `.planning/STATE.md`.
- `pnpm audit:vocabulary` (apps/web tree): 8 pre-existing matches in Phase 3 code comments — already documented in `.planning/phases/04-upload-desktop/deferred-items.md`. Out of scope per Rule 1-4 deviation policy.

## Future considerations (deferred decisions)

- **Pydantic full validation** of books_manifest.json shape lands in 06-06 (manifest.py loader using BooksManifest.model_validate). Current --validate mode in manifest_assist.py is shallow shape check only (presence of 10 required keys per entry).
- **OCR-required detection:** All 18 PDFs are confirmed text-extractable (founder-verified). If any future addition is scan-only, set ocr_required=true AND skip=true (OCR is out-of-scope per CONTEXT D-S deferred). 06-04 chunker will detect scan pages via pdf_extractor heuristic and warn if mismatch.
- **escola_origem coverage:** Final distribution after edits is Jensen 3 (#1, #7, #8 — #6 skipped), Brasileira 5 (#4, #9, #11, #12, #14), Italiana 2 (#10, #17), Espanhola 3 (#2, #3, #5), Rayid 1 (#15), Andrews-britanica 2 (#16, #18). All 6 escolas from vocabularies.json `escola_origem` are represented. The 7th escola (Argentina-australiana from vocabularies.json) has no canonical text in the corpus — reserved for future acquisitions.
- **Modal image deps:** voyageai/PyMuPDF/etc. are local-only. Modal image (vision-service/modal_app.py) does NOT need them for Phase 5 vision pipeline. If Phase 6 ingestion ever needs Modal-hosted execution (currently planned as local-only ingestion script), revisit modal_app.py Image() definition then.

## Verification Summary

| Gate | Command | Result |
|------|---------|--------|
| Manifest schema validation | `cd vision-service && python -m scripts.manifest_assist --validate` | **EXIT 0** — OK 18 entries valid |
| LGPD audit (vision-service) | `cd vision-service && python -m scripts.audit_vocabulary` | **EXIT 0** — clean |
| Full vision-service pytest | `cd vision-service && python -m pytest -q` | **EXIT 0** — 142 passed, 46 skipped (baseline match) |
| JSON shape (version + count) | `python -c "import json; m = json.load(open('...')); assert m['version']=='0.1.1' and len(m['books'])==18"` | **EXIT 0** — OK |
| Aggregate counts (alta=7, skip=2, pdfplumber=1, ocr=0) | per-key reduction script | **EXIT 0** — all 4 PASS |
| Per-edit verification (28 founder edits) | per-book key check (autor/ano/escola/extrator/alta_prioridade/skip/notas) | **EXIT 0** — 28/28 PASS |
| Filename existence on disk | `for filename in books: assert (livros/filename).exists()` | **EXIT 0** — all 18 found |

## Issues Encountered

None during founder-edit application. The founder-gate pause itself is by design — Plan 06-03 splits at Task 3 to receive human review of canonical manifest decisions before locking. This is the correct flow for Wave 0 contract artifacts.

## User Setup Required

None. All dependencies installed locally; manifest is repo-tracked; no external service config needed for Wave 0 closure.

## Next Phase Readiness

Wave 0 progress: **3/3 plans complete** (06-01 ✓ + 06-02 ✓ + 06-03 ✓). Wave 0 is **CLOSED**.

Wave 1 unblocked: 06-04 (pdf_extractor + chunker), 06-05 (budget + embedder), 06-06 (contextualizer + manifest.py loader) — all 3 can spawn in parallel as soon as orchestrator advances.

Downstream contracts unblocked:
- 06-04: pdf_extractor.py imports `pymupdf`, `pdfplumber`, `docx2txt`; chunker.py imports `tiktoken`. Will read books_manifest.json for per-book extrator/skip flags.
- 06-05: embedder.py imports `voyageai`; budget.py imports `tiktoken` for cost calculation.
- 06-06: contextualizer.py imports `anthropic`; manifest.py loader uses Pydantic to validate books_manifest.json (full validation replaces shallow --validate).
- 06-07: persister.py imports `supabase`; uses books_manifest.json metadata for source_book/escola/etc.
- 06-08: ingest_knowledge.py CLI orchestrator iterates books_manifest.json (skip=true filtered out).
- 06-09: apps/web/lib/rag/embed.ts imports voyageai (Python/TS parity).

No blockers. Founder-validated manifest is the input contract for everything downstream.

## Self-Check: PASSED

Verified all claims:

| Claim | Verification |
|-------|--------------|
| books_manifest.json exists | `ls vision-service/scripts/data/books_manifest.json` → FOUND |
| manifest_assist.py exists | `ls vision-service/scripts/manifest_assist.py` → FOUND |
| Commit 8859f90 exists | `git log --oneline \| grep 8859f90` → FOUND ("feat(06-03): pin RAG deps + add voyageai TS SDK + root rag scripts") |
| Commit e256e1e exists | `git log --oneline \| grep e256e1e` → FOUND ("feat(06-03): add manifest_assist.py + bootstrap books_manifest.json (pre-gate)") |
| Commit 0d748c3 exists | `git log --oneline \| grep 0d748c3` → FOUND ("feat(06-03): apply founder edits to books_manifest...") |
| version 0.1.1 | `python -c "import json; print(json.load(open('...'))['version'])"` → `0.1.1` |
| 18 books in manifest | `python -c "import json; print(len(json.load(open('...'))['books']))"` → `18` |
| 7 alta_prioridade entries | reduction script → 7 (#1, #4, #7, #8, #9, #15, #17) |
| 2 skip entries | reduction script → 2 (#6 Bernard-Jensen.docx, #13 mod-03 (1).pdf) |
| 1 pdfplumber entry | reduction script → 1 (#8 dictionary) |
| 0 ocr_required | reduction script → 0 |
| #7 alta_prioridade=True (CHANGED) | direct lookup → True ✓ |
| #8 extrator=pdfplumber (CHANGED) | direct lookup → 'pdfplumber' ✓ |
| #10 escola=Italiana (CHANGED) | direct lookup → 'Italiana' ✓ |
| #16 escola=Andrews-britânica (CHANGED) | direct lookup → 'Andrews-britânica' ✓ |
| #4 ano=2012 (CHANGED) | direct lookup → 2012 ✓ |
| #16 ano=2005 (CHANGED) | direct lookup → 2005 ✓ |
| LGPD audit clean | `python -m scripts.audit_vocabulary; echo $?` → 0 |
| pytest baseline maintained | `python -m pytest -q` → 142 passed, 46 skipped (matches pre-edit baseline) |
| All 18 filenames exist on disk | filesystem check → all FOUND |
| Schema validation passes | `python -m scripts.manifest_assist --validate` → "OK 18 entries valid" |

---
*Phase: 06-rag-ingestao*
*Completed: 2026-05-05*
