# Phase 6: RAG — Ingestão da base de conhecimento - Pattern Map

**Mapped:** 2026-05-04
**Files analyzed:** 37 (Python: 21, TypeScript: 11, SQL: 1, config: 4)
**Analogs found:** 32 / 37 (5 sem analog direto — usam padrão de RESEARCH.md)

---

## File Classification

### Python — `vision-service/`

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `vision-service/scripts/ingest_knowledge.py` | orchestrator (CLI) | batch + transform | `vision-service/scripts/audit_vocabulary.py` | exact (CLI script + `__main__`) |
| `vision-service/scripts/lib/__init__.py` | package marker | — | `vision-service/scripts/__init__.py` | exact |
| `vision-service/scripts/lib/pdf_extractor.py` | extractor (wrapper) | file-I/O → transform | `vision-service/pipeline/error_summary.py` (lru_cache loader) + RESEARCH §PyMuPDF | partial (new wrapper, no direct analog) |
| `vision-service/scripts/lib/chunker.py` | utility (transform) | transform | `vision-service/pipeline/features.py` (algoritmo + módulo-level constantes) | role-match (algorithm with constants) |
| `vision-service/scripts/lib/contextualizer.py` | wrapper (D-N1) | request-response (LLM) | `vision-service/modal_app.py` `_post_webhook` (HTTP wrapper) | role-match |
| `vision-service/scripts/lib/embedder.py` | wrapper (Voyage) | request-response (HTTP) | `apps/web/lib/vision/modal-client.ts` | role-match (thin SDK wrapper + retry) |
| `vision-service/scripts/lib/persister.py` | persister (DB) | CRUD (upsert) | RESEARCH §supabase-py + Pattern from `apps/web/lib/capture/upload.ts` | partial (new — no Python persister exists) |
| `vision-service/scripts/lib/budget.py` | utility (state) | event-driven (counter) | RESEARCH §Cost Monitoring Pattern (lines 622–669) | no analog — use research excerpt verbatim |
| `vision-service/scripts/lib/manifest.py` | model + loader (Pydantic) | file-I/O | `vision-service/pipeline/error_summary.py` + `vision-service/pipeline/schemas.py` | role-match (loader + Pydantic) |
| `vision-service/scripts/data/books_manifest.json` | config | — | `vision-service/data/error_summary.json` | exact (catalog JSON + version + entries) |
| `vision-service/scripts/data/vocabularies.json` | config | — | `vision-service/data/jensen-map.json` | exact (controlled vocab JSON) |
| `vision-service/data/jensen-reference.md` | data asset (docs) | — | `vision-service/tests/fixtures/CONSENT.md` | partial (canonical .md) |
| `vision-service/tests/test_ingest_extract.py` | test (unit) | structural | `vision-service/tests/test_iris_maps.py` | role-match (loader + invariants) |
| `vision-service/tests/test_chunker.py` | test (unit) | structural+metric | `vision-service/tests/test_features.py` (hybrid) | role-match |
| `vision-service/tests/test_books_manifest.py` | test (schema) | structural | `vision-service/tests/test_error_summary.py` | exact (schema + JSON shape + values) |
| `vision-service/tests/test_embedder.py` | test (mock) | structural+behavioral | `apps/web/lib/capture/upload.test.ts` (mock factory) | role-match (Python translation) |
| `vision-service/tests/test_idempotency.py` | test (integration-light) | structural | `vision-service/tests/test_error_summary.py` (lru_cache identity) | role-match |
| `vision-service/tests/test_budget.py` | test (unit) | structural | `vision-service/tests/test_iris_maps.py::test_known_jensen_asymmetries` (anchor cases) | role-match |
| `vision-service/tests/test_persist.py` | test (integration / DB) | structural | `apps/web/lib/supabase/service.test.ts` | role-match (env mocking + smoke) |
| `vision-service/tests/test_vocabularies.py` | test (audit) | structural | `vision-service/tests/test_audit_vocabulary.py` | exact |
| `vision-service/tests/test_contextualizer.py` | test (mock) | structural | `vision-service/tests/test_modal_app.py` (HTTP mock) | role-match |
| `vision-service/tests/test_contextualize_budget.py` | test (unit) | structural | (mirror de `test_budget.py`) | role-match |

### TypeScript — `apps/web/lib/rag/`

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/lib/rag/types.ts` | types | — | `apps/web/lib/vision/modal-client.ts` (typed args/result) | role-match (interface declarations) |
| `apps/web/lib/rag/embed.ts` | wrapper (Voyage) | request-response | `apps/web/lib/vision/modal-client.ts` | exact (HTTP/SDK client + server-only + env guard) |
| `apps/web/lib/rag/build-queries.ts` | utility (transform) | transform | `apps/web/lib/capture/storage-path.ts` | role-match (pure utility, typed args) |
| `apps/web/lib/rag/section-queries.ts` | config (templates) | — | `vision-service/data/jensen-map.json` (controlled lookup) | partial (TS const-record vs JSON) |
| `apps/web/lib/rag/score-weights.ts` | utility (transform) | transform | `apps/web/lib/capture/quality-scoring.ts` (RESEARCH analogy) | role-match (pure scoring function) |
| `apps/web/lib/rag/rerank.ts` | wrapper (Voyage rerank, D-N2) | request-response | `apps/web/lib/vision/modal-client.ts` | role-match (graceful fallback over throw) |
| `apps/web/lib/rag/search.ts` | server action (orchestrator) | request-response | `apps/web/app/actions/readings.ts` (`'use server'`, auth gate, supabase rpc) | role-match |
| `apps/web/lib/rag/search.test.ts` | test (mock) | structural | `apps/web/lib/capture/upload.test.ts` | exact (mock factory + describe/it) |
| `apps/web/lib/rag/build-queries.test.ts` | test (unit) | structural | `apps/web/lib/capture/quality-scoring.test.ts` | exact |
| `apps/web/lib/rag/score-weights.test.ts` | test (unit) | structural | `apps/web/lib/capture/quality-scoring.test.ts` | exact |
| `apps/web/lib/rag/rerank.test.ts` | test (mock) | structural | `apps/web/lib/supabase/service.test.ts` (env-driven mock) | role-match |

### SQL e CLI/scripts

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0005_knowledge_chunks_content_hash_and_source_type.sql` | migration + RPC | DDL | `supabase/migrations/0004_storage_bucket_iris_captures.sql` | exact (idempotent DO blocks + indices) |
| `apps/web/scripts/rag-spot-check.ts` | utility script (UAT) | request-response | `apps/web/scripts/audit-vocabulary.mjs` (CLI standalone) | role-match (CLI shape) |
| `apps/web/scripts/audit-vocabulary-db.mjs` | utility script (DB audit) | DB query | `apps/web/scripts/audit-vocabulary.mjs` (sibling) | exact (mesma logic, DB target) |

### Modificações em arquivos existentes

| Modified File | What Changes | Analog/Pattern |
|---------------|--------------|----------------|
| `vision-service/requirements.txt` | adiciona voyageai/pymupdf/pdfplumber/python-docx/tiktoken/anthropic | (própria estrutura existente) |
| `apps/web/package.json` | adiciona `voyageai` dep + scripts | (própria estrutura) |
| `package.json` (root) | adiciona `rag:ingest`, `rag:purge`, `rag:spot-check`, `audit:vocabulary:db` | (própria estrutura) |
| `vision-service/scripts/audit_vocabulary.py` | estende SCAN_DIRS para `scripts/data` | self (1-line diff) |

---

## Pattern Assignments

### `vision-service/scripts/ingest_knowledge.py` (orchestrator CLI)

**Analog:** `vision-service/scripts/audit_vocabulary.py` (lines 1–76)

**CLI shebang + module docstring + main pattern** (audit_vocabulary.py lines 1–10):
```python
#!/usr/bin/env python3
"""<Module purpose docstring>.

Usage:
    python -m scripts.<name>           # CLI
    from scripts.<name> import <fn>    # programmatic
"""
from __future__ import annotations
```

**`__name__ == "__main__"` exit pattern** (audit_vocabulary.py lines 63–75):
```python
def main() -> int:
    # ... orchestrate
    return 0  # or 1 on failure

if __name__ == "__main__":
    sys.exit(main())
```

**Apply to ingest_knowledge.py — orchestrator skeleton** (combining audit_vocabulary.py CLI form with multi-stage workflow):
```python
#!/usr/bin/env python3
"""Ingest the founder's iridology library into knowledge_chunks (Phase 6 D-S1).

Pipeline: extract → chunk → contextualize (D-N1) → embed → persist.
Idempotent via content_hash (D-E2). Aborts on cost hardcap (D-G1).

Usage:
    python -m scripts.ingest_knowledge                        # full run
    python -m scripts.ingest_knowledge --book "<source_book>" # single book
    python -m scripts.ingest_knowledge --purge --book "X"     # D-I2 re-ingest
    python -m scripts.ingest_knowledge --dry-run              # no API calls
"""
from __future__ import annotations
import argparse, sys
from pathlib import Path
from scripts.lib.manifest import load_manifest
from scripts.lib.pdf_extractor import extract
from scripts.lib.chunker import chunk_text
from scripts.lib.contextualizer import contextualize  # D-N1
from scripts.lib.embedder import embed_batch
from scripts.lib.persister import upsert_chunks, purge_book
from scripts.lib.budget import VoyageBudgetGuard, ContextualBudgetGuard

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ingest_knowledge")
    parser.add_argument("--book", help="Limit to one source_book entry")
    parser.add_argument("--purge", action="store_true", help="Delete + re-ingest (D-I2)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    # ... orchestrate
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

**Deviation:** Multi-stage pipeline vs single-pass audit. State is held in `BudgetGuard` instances (RESEARCH §Cost Monitoring) and dispatched per book from `manifest`. The `--purge` flag invokes `purge_book` BEFORE ingestion (mirrors D-I2 contract).

---

### `vision-service/scripts/lib/pdf_extractor.py` (PyMuPDF + pdfplumber wrapper)

**Closest analog:** `vision-service/pipeline/error_summary.py` (lines 1–53 — module docstring + lazy lru_cache loader pattern) + RESEARCH §PyMuPDF (lines 290–335).

**Pattern to follow** (error_summary.py lines 20–48 — typed module-level loader):
```python
from __future__ import annotations
import functools
from pathlib import Path

@functools.lru_cache(maxsize=None)
def _open_doc(path: str):
    import pymupdf  # lazy: only available inside ingest env
    return pymupdf.open(path)
```

**Core pattern (RESEARCH lines 301–333 — extraction + scan detection):**
```python
def extract_pdf(path: Path, extractor: str = "pymupdf") -> list[dict]:
    """Return list of {page, text, chapter_marker, scan_detected} per page.

    Args:
        path:      .pdf file location.
        extractor: "pymupdf" (D-C4 primary) or "pdfplumber" (D-C4 fallback).
    """
    import pymupdf  # lazy import — keeps test_persist.py importable without these
    doc = pymupdf.open(str(path))
    pages: list[dict] = []
    for page_num, page in enumerate(doc):
        text = page.get_text("text")
        scan = is_scanned_page(page)  # see RESEARCH lines 314–333
        pages.append({"page": page_num + 1, "text": text, "scan_detected": scan})
    return pages

def is_scanned_page(page) -> bool:
    """RESEARCH lines 314–333 verbatim — scan heuristic."""
    text = page.get_text("text").strip()
    if text:
        if text.count("�") / max(len(text), 1) > 0.3:
            return True
        return False
    images = page.get_images()
    if not images:
        return True
    page_area = page.rect.width * page.rect.height
    for img in images:
        for r in page.get_image_rects(img[0]):
            if (r.width * r.height) / page_area > 0.95:
                return True
    return False
```

**DOCX handler pattern** (RESEARCH lines 346–352 — minimal `docx2txt`):
```python
def extract_docx(path: Path) -> list[dict]:
    """One synthetic 'page' with the whole text — DOCX has no real page boundary."""
    import docx2txt
    text = docx2txt.process(str(path))
    return [{"page": None, "text": text, "scan_detected": False}]
```

**Deviation:** Use **lazy imports** for `pymupdf`/`pdfplumber`/`docx2txt` (inside the function body, not at module top) so unit tests can mock the extractor without forcing a heavy install. Mirrors the `import httpx  # lazy` pattern in `vision-service/modal_app.py` lines 94 (modal_app.py).

---

### `vision-service/scripts/lib/chunker.py` (custom Python splitter, D-C1..C3)

**Closest analog:** `vision-service/pipeline/features.py` (algorithm-with-constants pattern — module-level config + pure functions) + Phase 5 PATTERNS line 308–322 (utility lru_cache loader).

**Pattern to follow** (mirroring features.py module-level constants + pure transform):
```python
"""Custom chapter→section→paragraph chunker for iridology PDFs (D-C1..C3).

Target 500 tokens, flex 300–700, overlap 80, NO overlap across chapter/section.
Tokenization: tiktoken cl100k_base (proxy; under-counts Voyage by ~1.2× — OK
within the 300–700 flex band per RESEARCH §tiktoken).
"""
from __future__ import annotations
import re
from dataclasses import dataclass
from typing import Iterable

# D-C1 locked params
TARGET_TOKENS = 500
MIN_TOKENS = 300
MAX_TOKENS = 700
OVERLAP_TOKENS = 80

# D-C2 hierarchy detection
CHAPTER_RE = re.compile(r"^(?:CAP[IÍ]TULO|CHAPTER|CAPITOLO)\s+\w+", re.IGNORECASE | re.MULTILINE)
SECTION_RE = re.compile(r"^(?:\d+\.\d+|[A-Z][A-Z\s]{4,})\s*$", re.MULTILINE)

@dataclass
class Chunk:
    text: str
    chapter: str | None
    section: str | None
    page: int | None
    tokens_estimated: int

def chunk_book(pages: list[dict], book_meta: dict) -> list[Chunk]:
    """Split a book's pages into Chunks honoring D-C1/C2 boundaries."""
    # ... implementation
```

**Token counting (RESEARCH lines 375–380):**
```python
import tiktoken
_enc = tiktoken.get_encoding("cl100k_base")

def count_tokens(text: str) -> int:
    return len(_enc.encode(text))
```

**Content hash invariant (RESEARCH §Pitfall 1, lines 841–846 — DO NOT NORMALIZE):**
```python
import hashlib

def content_hash(text: str) -> str:
    """D-E2: content_hash = sha256(text.strip().encode('utf-8')). LOCKED.

    Do NOT lowercase, collapse whitespace, or NFC/NFD normalize — re-runs would
    silently duplicate. Test asserts hash of a known string against a hardcoded
    expected hex digest to catch any future change to canonicalization.
    """
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()
```

**Deviation:** No `langchain` (D-C3 explicit). Custom regex-based chapter/section detection because iridology PDFs use idiosyncratic conventions ("CAPITOLO IV — Setore 7", "1.2 Lacunas profundas"). Tested in `test_chunker.py` against synthetic fixture (RESEARCH Open Question 9).

---

### `vision-service/scripts/lib/contextualizer.py` (D-N1 Anthropic Haiku 4.5 + prompt caching)

**Closest analog:** `vision-service/modal_app.py` `_post_webhook` (lines 71–125 — HTTP wrapper with env validation + lazy import) + RESEARCH §Contextual Retrieval (lines 717–757).

**HTTP wrapper pattern (modal_app.py lines 94–125):**
```python
def _post_webhook(reading_id, call_id, status, *, vision_features=None, **kwargs):
    import httpx  # lazy: only available inside the Modal image
    payload = {"reading_id": reading_id, "modal_call_id": call_id, "status": status, ...}
    body = json.dumps(payload)
    timestamp = str(int(time.time()))
    secret = os.environ["MODAL_WEBHOOK_SECRET"]
    sig = hmac.new(secret.encode(), f"{timestamp}.{body}".encode(), hashlib.sha256).hexdigest()
    httpx.post(url, content=body, headers={...}, timeout=30)
```

**Apply to contextualizer.py — Anthropic SDK call with prompt caching:**
```python
"""D-N1 Contextual Retrieval — generates situating sentences via Haiku 4.5.

Pattern: lazy import `anthropic`; cache the chapter document via the SDK's
`cache_control={"type": "ephemeral"}` block (5min cache, 90% off after first).
Anthropic's exact prompt template per RESEARCH lines 723–730.
"""
from __future__ import annotations
import os
from scripts.lib.budget import ContextualBudgetGuard

PROMPT_TEMPLATE = (
    "<document>{document}</document>\n"
    "Here is the chunk we want to situate within the whole document\n"
    "<chunk>{chunk}</chunk>\n"
    "Please give a short succinct context to situate this chunk within the overall "
    "document for the purposes of improving search retrieval of the chunk. Answer "
    "only with the succinct context and nothing else."
)

def situate_chunk(
    chunk_text: str,
    chapter_text: str,
    *,
    guard: ContextualBudgetGuard,
    model: str = "claude-haiku-4-5",
) -> str:
    """Returns a 1-2 sentence situating context. Caches the chapter (prompt cache)."""
    import anthropic  # lazy
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    response = client.messages.create(
        model=model,
        max_tokens=200,
        system=[
            {
                "type": "text",
                "text": "You are a helpful assistant that contextualizes document chunks for retrieval.",
            },
            {
                "type": "text",
                "text": f"<document>{chapter_text}</document>",
                "cache_control": {"type": "ephemeral"},  # 90% discount on hit
            },
        ],
        messages=[{"role": "user", "content": PROMPT_TEMPLATE.format(
            document="(see system)", chunk=chunk_text
        )}],
    )
    guard.add(
        input_tokens=response.usage.input_tokens,
        cached_tokens=getattr(response.usage, "cache_read_input_tokens", 0),
        output_tokens=response.usage.output_tokens,
    )
    return response.content[0].text.strip()
```

**Deviation:** Lazy `anthropic` import (not in default vision-service env — opt-in via requirements pin). The cached `system` block is the **chapter** (not the whole book) per RESEARCH line 734: "in datasets caching is especially efficient because the cached 'document' is the chapter, not the book." `ContextualBudgetGuard` (sibling of `VoyageBudgetGuard`) hardcaps at US$ 15 per D-N1.

---

### `vision-service/scripts/lib/embedder.py` (Voyage Python SDK wrapper)

**Closest analog:** `apps/web/lib/vision/modal-client.ts` (lines 1–79 — exact same role: thin SDK/HTTP client wrapper, server-only/env-guarded, custom error class, typed args/result).

**Pattern to translate from TS to Python** (modal-client.ts lines 28–78):
```typescript
// TS analog — the shape we mirror in Python:
export class ModalTriggerError extends Error {
  constructor(message: string, public readonly status?: number) { super(message); this.name = 'ModalTriggerError' }
}

export async function triggerVisionPipeline(args: TriggerArgs): Promise<TriggerResult> {
  const endpoint = process.env.MODAL_ANALYZE_ENDPOINT_URL
  if (!endpoint) throw new ModalTriggerError('MODAL_ANALYZE_ENDPOINT_URL is not set')
  // ...
  if (!res.ok) throw new ModalTriggerError(`Modal trigger failed: ${res.status}`, res.status)
}
```

**Python equivalent — embedder.py:**
```python
"""Voyage embedding client — D-E1 (voyage-3, batches ≤128, retry 1s/4s/16s).

Mirror of apps/web/lib/vision/modal-client.ts: thin SDK wrapper, env-guarded,
custom error class, typed args/result. RESEARCH §Voyage Python SDK.
"""
from __future__ import annotations
import os, time
from typing import Sequence
from scripts.lib.budget import VoyageBudgetGuard

EMBEDDING_MODEL = "voyage-3"  # PINNED (RESEARCH Pitfall 4 — must match TS retrieval side)
BATCH_SIZE = 128              # D-E1
RETRY_DELAYS = (1.0, 4.0, 16.0)  # D-E1: not exponential — degraded fallback

class VoyageEmbedError(Exception):
    """Mirror of ModalTriggerError. Raised on persistent batch failure."""

def embed_batch(
    texts: Sequence[str],
    *,
    input_type: str = "document",  # RESEARCH §input_type — DO NOT skip
    guard: VoyageBudgetGuard,
) -> list[list[float]]:
    if len(texts) > BATCH_SIZE:
        raise VoyageEmbedError(f"batch size {len(texts)} exceeds D-E1 limit {BATCH_SIZE}")
    api_key = os.environ.get("VOYAGE_API_KEY")
    if not api_key:
        raise VoyageEmbedError("VOYAGE_API_KEY is not set")

    import voyageai  # lazy import (Pitfall 10 analog: not bundled into vision-service modal image)
    vo = voyageai.Client(api_key=api_key)

    last_exc: Exception | None = None
    for delay in (0.0, *RETRY_DELAYS):
        if delay:
            time.sleep(delay)
        try:
            result = vo.embed(
                texts=list(texts),
                model=EMBEDDING_MODEL,
                input_type=input_type,
                truncation=True,
            )
            guard.add(tokens=result.total_tokens, ...)  # D-G1/G2 logging
            return result.embeddings
        except Exception as e:  # narrow to voyageai exceptions in real impl
            last_exc = e
    raise VoyageEmbedError(f"voyage embed failed after {len(RETRY_DELAYS)} retries: {last_exc}")
```

**Deviation from modal-client.ts:**
- Lazy `voyageai` import (Python convention; modal-client.ts uses ESM imports at top because TS server-only is enforced by `import 'server-only'`).
- `RETRY_DELAYS` is fixed-progression (not pure exponential) per D-E1 — degrades to manual retry via `failed_batches.jsonl`.
- Returns `list[list[float]]` (1024-dim per chunk); calling code is responsible for pairing back with the input chunks.
- The `EMBEDDING_MODEL` constant is pinned and **must match** `apps/web/lib/rag/embed.ts` (RESEARCH Pitfall 4 — single source of truth in two places).

---

### `vision-service/scripts/lib/persister.py` (supabase-py upsert with ON CONFLICT)

**Closest analog:** `apps/web/lib/capture/upload.ts` (upsert pattern) + RESEARCH §supabase-py (lines 354–373).

**Pattern (RESEARCH lines 363–369 — bulk upsert with ON CONFLICT DO NOTHING):**
```python
"""Persist chunks to knowledge_chunks (D-E2 idempotent + D-I2 purge)."""
from __future__ import annotations
import os
from typing import Sequence

def get_client():
    """Service-role client. RLS bypass for INSERT (RESEARCH §Project Constraints)."""
    from supabase import create_client
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
    if not key.startswith("eyJ"):
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY missing or malformed")  # Pitfall 14
    return create_client(url, key)

def upsert_chunks(rows: Sequence[dict]) -> int:
    """ON CONFLICT (content_hash) DO NOTHING — D-E2 idempotency.

    Args:
        rows: each dict has keys
              {content, content_hash, embedding, source_book, source_chapter,
               source_page, source_type, metadata}.
    Returns:
        number of rows actually inserted (DB returns inserted set).
    """
    client = get_client()
    response = (
        client.table("knowledge_chunks")
        .upsert(list(rows), on_conflict="content_hash", ignore_duplicates=True)
        .execute()
    )
    return len(response.data or [])

def purge_book(source_book: str) -> int:
    """D-I2 — DELETE FROM knowledge_chunks WHERE source_book = $1."""
    client = get_client()
    response = (
        client.table("knowledge_chunks")
        .delete()
        .eq("source_book", source_book)
        .execute()
    )
    return len(response.data or [])
```

**Deviation:** Service-role key required (RLS bypass). Uses `eq("source_book", ...)` for purge per supabase-py idiom. Insert in batches of 100–500 (RESEARCH Pitfall 5) — caller composes batches.

---

### `vision-service/scripts/lib/budget.py` (running-total tracker, D-G1/G2 + D-N1)

**No analog in repo.** Use RESEARCH lines 622–669 verbatim.

**Pattern (RESEARCH §Cost Monitoring — full class):**
```python
"""D-G1 hardcap + D-G2 logging + D-N1 dedicated Contextual hardcap."""
from __future__ import annotations

class BudgetExceeded(Exception):
    pass

class VoyageBudgetGuard:
    """RESEARCH lines 622–669 verbatim. D-G1 = $5 hardcap, $1/2/3/4 alerts, log every 10 chunks."""
    PRICE_PER_1M_TOKENS = 0.06  # voyage-3 (D-E1)
    HARDCAP_USD = 5.00

    def __init__(self):
        self.total_tokens = 0
        self.chunks_indexed = 0
        self.next_alert_usd = 1.0

    @property
    def cost_usd(self) -> float:
        return self.total_tokens * self.PRICE_PER_1M_TOKENS / 1_000_000

    def add(self, tokens: int, book: str, total_chunks: int) -> None:
        self.total_tokens += tokens
        self.chunks_indexed += 1
        if self.chunks_indexed % 10 == 0:
            print(f'[ingest] chunk {self.chunks_indexed}/{total_chunks} | '
                  f'tokens {self.total_tokens:,} | est_cost ${self.cost_usd:.4f} | book "{book}"')
        while self.cost_usd >= self.next_alert_usd and self.next_alert_usd <= 4:
            print(f'[ingest] ALERT: cost crossed ${self.next_alert_usd:.0f}')
            self.next_alert_usd += 1
        if self.cost_usd > self.HARDCAP_USD:
            raise BudgetExceeded(
                f'HARD CAP REACHED — ${self.HARDCAP_USD:.2f} spent (${self.cost_usd:.4f} estimated). '
                f'Indexed {self.chunks_indexed} chunks. '
                f'Re-run idempotently: chunks already indexed will be skipped via content_hash. '
                f'Increase hardcap by editing INGEST_HARDCAP_USD in vision-service/scripts/ingest_knowledge.py.'
            )

class ContextualBudgetGuard:
    """D-N1 dedicated hardcap = US$ 15 (3× estimate of $3-9 with Haiku 4.5 + caching)."""
    HARDCAP_USD = 15.00
    # Anthropic 2026 pricing (verify before deploy):
    #   Haiku 4.5 input ~$0.25/1M, cache reads ~$0.025/1M (10% of input), output ~$1.25/1M.
    PRICE_INPUT_PER_1M = 0.25
    PRICE_CACHE_READ_PER_1M = 0.025
    PRICE_OUTPUT_PER_1M = 1.25

    def __init__(self):
        self.input_tokens = 0
        self.cached_tokens = 0
        self.output_tokens = 0

    @property
    def cost_usd(self) -> float:
        return (
            self.input_tokens * self.PRICE_INPUT_PER_1M / 1_000_000
            + self.cached_tokens * self.PRICE_CACHE_READ_PER_1M / 1_000_000
            + self.output_tokens * self.PRICE_OUTPUT_PER_1M / 1_000_000
        )

    def add(self, *, input_tokens: int, cached_tokens: int, output_tokens: int) -> None:
        self.input_tokens += input_tokens
        self.cached_tokens += cached_tokens
        self.output_tokens += output_tokens
        if self.cost_usd > self.HARDCAP_USD:
            raise BudgetExceeded(
                f'CONTEXTUAL HARD CAP REACHED — ${self.HARDCAP_USD:.2f} spent '
                f'(${self.cost_usd:.4f} estimated; input={self.input_tokens}, '
                f'cached={self.cached_tokens}, output={self.output_tokens}).'
            )
```

**Deviation:** None. RESEARCH provides verbatim. Test (`test_budget.py`) constructs Guard, calls `.add()` repeatedly, asserts raise after threshold.

---

### `vision-service/scripts/lib/manifest.py` (Pydantic model + loader for `books_manifest.json`)

**Closest analog:** `vision-service/pipeline/error_summary.py` (lines 1–53 — lru_cache loader) + `vision-service/pipeline/schemas.py` (lines 22–117 — Pydantic ConfigDict pattern).

**Loader pattern (error_summary.py lines 30–48):**
```python
import functools, json
from pathlib import Path

@functools.lru_cache(maxsize=None)
def load_manifest() -> "BooksManifest":
    path = Path(__file__).parent.parent / "data" / "books_manifest.json"
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    return BooksManifest.model_validate(raw)
```

**Pydantic model pattern (schemas.py lines 38–43):**
```python
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Literal, Annotated

class BookEntry(BaseModel):
    filename: str
    autor: str
    escola: Literal["Jensen", "Rayid", "Italiana", "Alemã", "Brasileira", "Espanhola", "Andrews-britânica"]
    idioma: Literal["pt", "en", "it", "es", "de"]
    ano: int = Field(ge=1900, le=2100)
    alta_prioridade: bool = False
    extrator: Literal["pymupdf", "pdfplumber", "python-docx", "skip"]
    skip: bool = False
    ocr_required: bool = False
    notas: str = ""

    model_config = ConfigDict(extra="forbid")  # mirrors schemas.py — strict (D-T6 dúvida → null)

class BooksManifest(BaseModel):
    books: dict[str, BookEntry]   # key = source_book canonical name
    model_config = ConfigDict(extra="forbid")
```

**Deviation:** `extra="forbid"` matches schemas.py pattern (lines 43, 51, 58, 66, 74, 84, 92, 100, 108, 117). Founder fills the file in Wave 0; test (`test_books_manifest.py`) validates schema + asserts each `filename` exists at `D:\Projetos\Iridologista\livros\<filename>`.

---

### `vision-service/scripts/data/books_manifest.json` (D-M1)

**Closest analog:** `vision-service/data/error_summary.json` (lines 1–11 — versioned JSON catalog).

**Pattern (error_summary.json verbatim shape):**
```json
{
  "catalog_name": "books_manifest",
  "version": "0.1.0",
  "books": {
    "Bernard Jensen Iridology Simplified": {
      "filename": "157928975-Bernard-Jensen-Iridology-Simplified.pdf",
      "autor": "Bernard Jensen",
      "escola": "Jensen",
      "idioma": "en",
      "ano": 1980,
      "alta_prioridade": true,
      "extrator": "pymupdf",
      "skip": false,
      "ocr_required": false,
      "notas": "Texto-base da escola americana — alta prioridade no boost retrieval"
    }
  }
}
```

**Deviation:** Top-level `catalog_name` + `version` mirrors `error_summary.json` lines 2–3 (versionable assets convention). Nested `books` dict (D-M1 example shape) keys = canonical `source_book` names. **Founder fills in Wave 0** before any extraction.

---

### `vision-service/scripts/data/vocabularies.json` (D-T2..T5)

**Closest analog:** `vision-service/data/jensen-map.json` (controlled vocab JSON, pt-BR, audited by `audit_vocabulary.py`).

**Pattern (jensen-map.json shape — extended for 5 vocabularies):**
```json
{
  "vocabularies_name": "rag_controlled_vocabularies",
  "version": "0.1.0",
  "constituicao_referenciada": ["linfatica", "biliar", "hematogina", "mix-biliar", "neurogenica", "miasmatica"],
  "setores_referenciados": ["h1","h2","h3","h4","h5","h6","h7","h8","h9","h10","h11","h12"],
  "sinais_referenciados": ["lacuna_aberta", "lacuna_fechada", "cripta", "ponta_lanca", "..."],
  "dimensoes": ["fisica", "psicossomatica", "transgeracional", "constitucional", "energetica", "comportamental"],
  "escola_origem": ["Jensen", "Rayid", "Italiana", "Alemã", "Brasileira", "Espanhola", "Andrews-britânica"]
}
```

**Deviation:** **Must scan via `pnpm audit:vocabulary`** — file goes under `vision-service/scripts/data/` so `vision-service/scripts/audit_vocabulary.py` SCAN_DIRS must add `"scripts/data"` (1-line edit, RESEARCH §audit:vocabulary script extensibility). All terms pt-BR per D-T2..T5 except the canonical school names.

---

### `vision-service/data/jensen-reference.md` (D-T4 canonical signs list)

**Closest analog:** `vision-service/tests/fixtures/CONSENT.md` (canonical .md asset under repo) + RESEARCH `<specifics>` lines 215–224 (initial sign list).

**Pattern (Markdown reference doc, founder validates Wave 0):**
```markdown
# Sinais Iridológicos Canônicos — Aurel Iris (Phase 6 D-T4)

**Founder approval date:** <yyyy-mm-dd>
**Vocabulary version:** 0.1.0
**Status:** locked — additions require founder approval + bump version + re-audit.

This file is the source of truth for the `metadata.sinais_referenciados` array.
Tagger (Claude Code session) MUST select from this list verbatim. Sinais
não-canônicos vão em `metadata.tags_livres`, NUNCA inventar entrada nova aqui.

## Lacunas e criptas
- `lacuna_aberta`
- `lacuna_fechada`
- `cripta`
- ...

## Anéis e arcos
- `anel_tensao`
- `anel_psorico`
- ...
```

**Deviation:** Plain markdown reference doc. Audited by `vision-service/scripts/audit_vocabulary.py` (already includes `.md` in EXTENSIONS). No code consumes this directly — `vocabularies.json` `sinais_referenciados` mirrors this list and is what enforcement uses.

---

### `vision-service/tests/test_*.py` (8 test modules)

**Closest analog:** `vision-service/tests/test_iris_maps.py` (lines 1–60) + `vision-service/tests/test_error_summary.py` (lines 1–115 — full schema+behavior+invariants).

**Pattern from test_error_summary.py (lines 33–94 — class-based grouping + structural+behavior assertions):**
```python
"""Tests for <module> covering D-X assertions."""
from __future__ import annotations
import json
from pathlib import Path
import pytest

from scripts.lib.<module> import <fn>

class Test<Module>:
    def test_<behavior>_happy_path(self):
        result = <fn>(...)
        assert ...

    def test_<invariant>(self):
        # idempotency check, lru_cache identity, etc.
        ...
```

**Hybrid structural+metric pattern (from RESEARCH §Validation + Phase 5 PATTERNS lines 411–449):**
```python
def test_chunker_split_preserves_chapter_boundaries(synthetic_pages):
    chunks = chunk_book(synthetic_pages, book_meta={"source_book": "Test"})
    assert all(300 <= c.tokens_estimated <= 700 for c in chunks)  # D-C1
    # No overlap crosses chapter
    for i in range(1, len(chunks)):
        if chunks[i].chapter != chunks[i-1].chapter:
            # No shared text between adjacent chunks
            assert not _shares_overlap(chunks[i-1], chunks[i])
```

**Mock factory pattern (Python translation of upload.test.ts lines 1–32 — see `scripts.lib.embedder` mock):**
```python
def make_mock_voyage(*, fail: bool = False):
    """Mirrors makeMockSupabase in upload.test.ts."""
    class FakeClient:
        def embed(self, texts, model, input_type, truncation):
            if fail:
                raise RuntimeError("voyage err")
            class R:
                embeddings = [[0.0] * 1024 for _ in texts]
                total_tokens = len(texts) * 100
            return R()
    return FakeClient()
```

**Deviation:** Python pytest classes + monkeypatch instead of vitest `vi.fn()`. Tests live under `vision-service/tests/` (already has `pytest.ini` + `conftest.py`).

---

### `apps/web/lib/rag/types.ts` (shared types)

**Closest analog:** `apps/web/lib/vision/modal-client.ts` lines 11–37 (interface declarations + custom error class pattern).

**Pattern (modal-client.ts lines 13–36):**
```typescript
export interface ImageUrlEntry { eye: 'right' | 'left'; angle: 'frontal' | ...; url: string }
export interface TriggerArgs { readingId: string; imageUrls: ImageUrlEntry[] }
export interface TriggerResult { callId: string }
export class ModalTriggerError extends Error { ... }
```

**Apply to types.ts:**
```typescript
import type { Database } from '@/types/database'

export type ReportSection =
  | 'constituicao'
  | 'psicoemocional'
  | 'transgeracional'
  | 'simbolico'
  | 'mensagem_final'
  | 'mental_cognitivo'

export interface KnowledgeChunkMetadata {
  autor: string
  escola: 'Jensen' | 'Rayid' | 'Italiana' | 'Alemã' | 'Brasileira' | 'Espanhola' | 'Andrews-britânica' | null
  idioma: 'pt' | 'en' | 'it' | 'es' | 'de'
  ano: number | null
  constituicao_referenciada: string[]
  setores_referenciados: string[]
  sinais_referenciados: string[]
  dimensoes: string[]
  tags_livres: string[]
  contextual_sentence?: string  // D-N1 forward-compat
}

export interface KnowledgeChunkRow {
  id: string
  text: string                     // = content
  source_book: string
  chapter: string | null            // = source_chapter
  section: string | null            // (lives in metadata in DB until migration adds; Plan note)
  page: number | null               // = source_page
  metadata: KnowledgeChunkMetadata
  source_type: 'biblioteca' | 'clinical_data'
  score: number                     // 1 - cosine_distance, post-weighting
}

export type SearchResult = KnowledgeChunkRow

export class RagError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'RagError'
  }
}
```

**Deviation:** Cross-references `Database` type for downstream `gen:types` reconciliation (RESEARCH §Current State lines 974–986). Field naming **must match** the Pydantic shape in `manifest.py` + the migration's column names (Pitfall 9 — shape drift).

---

### `apps/web/lib/rag/embed.ts` (Voyage TS SDK wrapper)

**Closest analog:** `apps/web/lib/vision/modal-client.ts` (lines 1–79) — exact role match (server-only, env-guarded SDK wrapper, custom error, AbortController + timeout).

**Pattern verbatim from modal-client.ts (lines 1–79 — adapted):**
```typescript
/**
 * Thin wrapper for Voyage embeddings — D-E1 voyage-3, dim 1024.
 * Mirror of apps/web/lib/vision/modal-client.ts pattern.
 *
 * EMBEDDING_MODEL constant MUST match vision-service/scripts/lib/embedder.py
 * (RESEARCH Pitfall 4 — single source of truth in two places).
 */
import 'server-only'
import { VoyageAIClient } from 'voyageai'

export const EMBEDDING_MODEL = 'voyage-3'  // D-E1 PINNED
export const EMBED_TIMEOUT_MS = 10_000

export interface EmbedArgs {
  texts: string[]
  inputType?: 'query' | 'document'  // RESEARCH §input_type — DO NOT skip
}

export interface EmbedResult {
  embeddings: number[][]   // dim 1024
  totalTokens: number
}

export class VoyageEmbedError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = 'VoyageEmbedError'
  }
}

export async function embedTexts(args: EmbedArgs): Promise<EmbedResult> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) throw new VoyageEmbedError('VOYAGE_API_KEY is not set')

  const client = new VoyageAIClient({ apiKey })
  const result = await client.embed({
    input: args.texts,
    model: EMBEDDING_MODEL,
    inputType: args.inputType ?? 'query',  // retrieval default
  })
  return {
    embeddings: result.data.map((d) => d.embedding),
    totalTokens: result.usage.totalTokens,
  }
}
```

**Deviation from modal-client.ts:** Uses Voyage SDK (not raw fetch) per RESEARCH §Voyage TS SDK lines 246–258 (built-in retries, AbortSignal, typed response). `inputType: 'query'` is the retrieval default (the only caller is `search.ts`), so we don't need an explicit param at the call site for the common path.

---

### `apps/web/lib/rag/build-queries.ts` (D-R2 Family A + B)

**Closest analog:** `apps/web/lib/capture/storage-path.ts` (lines 1–37 — pure utility, typed args, no side effects).

**Pattern (storage-path.ts lines 19–37):**
```typescript
// Single exported function, typed args, throws on invalid input
export function buildOriginalStoragePath(...): string { ... }
```

**Apply to build-queries.ts:**
```typescript
import type { ReportSection } from './types'
import { SECTION_QUERY_TEMPLATES } from './section-queries'

interface IrisFeaturesShape {
  constitution: { primary: string; secondary?: string }
  sectors: Array<{ hour: number; findings: Array<{ type: string }> }>
  rings: Record<string, { present: boolean }>
}

/** D-R2 Family A — derived from features. Returns query strings for embedding. */
export function buildFamilyA(features: IrisFeaturesShape): string[] {
  const queries: string[] = []
  // 1 query per constitution
  queries.push(`constituição ${features.constitution.primary}`)
  if (features.constitution.secondary) {
    queries.push(`constituição ${features.constitution.secondary}`)
  }
  // 1 query per sector with findings
  for (const sec of features.sectors) {
    if (sec.findings.length > 0) {
      const types = sec.findings.map(f => f.type).join(', ')
      queries.push(`${types} no setor ${sec.hour}`)
    }
  }
  // 1 query per active global ring
  for (const [name, ring] of Object.entries(features.rings)) {
    if (ring.present) queries.push(`${name} presente`)
  }
  return queries
}

/** D-R2 Family B — derived from reportSections × constitution. */
export function buildFamilyB(features: IrisFeaturesShape, sections: ReportSection[]): string[] {
  return sections.flatMap(section => {
    const tmpl = SECTION_QUERY_TEMPLATES[section]
    return tmpl ? tmpl(features) : []
  })
}
```

**Deviation:** Pure functions, no I/O — directly composable. Templates moved to `section-queries.ts` (D-R2 explicit) so they version alongside the Fase 7 super prompt.

---

### `apps/web/lib/rag/section-queries.ts` (D-R2 templates)

**Closest analog:** `vision-service/data/jensen-map.json` (controlled lookup) + RESEARCH `<specifics>` lines 200–213 (template sketch).

**Pattern (RESEARCH lines 202–213 verbatim):**
```typescript
import type { ReportSection } from './types'

interface FeaturesShape {
  constitution: { primary: string; secondary?: string }
}

/** D-R2 Family B templates — versioned alongside the Fase 7 super prompt. */
export const SECTION_QUERY_TEMPLATES: Record<ReportSection, (f: FeaturesShape) => string[]> = {
  psicoemocional: (f) => [
    `${f.constitution.primary} dimensão psicoemocional`,
    `${f.constitution.primary} padrão emocional reprimido`,
  ],
  transgeracional: (f) => [
    `${f.constitution.primary} herança familiar transgeracional`,
  ],
  simbolico: (f) => [
    `${f.constitution.primary} simbolismo iridológico`,
  ],
  mental_cognitivo: (f) => [
    `${f.constitution.primary} dimensão mental cognitiva`,
  ],
  constituicao: (f) => [
    `caracterização da constituição ${f.constitution.primary}`,
  ],
  mensagem_final: (f) => [
    `${f.constitution.primary} orientação holística geral`,
  ],
}
```

**Deviation:** **Auditado por `pnpm audit:vocabulary`** (RESEARCH §audit-vocabulary lines 1018–1023 — must extend `apps/web/scripts/audit-vocabulary.mjs` to scan `lib/rag/`). Templates use only pt-BR + permitted iridology jargon; no `diagnóstico/tratamento/cura`. Plan-checker verifies founder spot-check on these strings before lock.

---

### `apps/web/lib/rag/score-weights.ts` (D-R4)

**Closest analog:** `apps/web/lib/capture/quality-scoring.ts` (pure scoring + thresholds — referenced by Phase 5 PATTERNS).

**Pattern (pure transform with documented multipliers):**
```typescript
import type { KnowledgeChunkRow, ReportSection } from './types'

/** D-R4 multipliers — applied AFTER rerank (D-N2), BEFORE final cap=30 sort. */
export const WEIGHTS = {
  CLINICAL_DATA: 1.5,        // D-R4: source_type='clinical_data' (Phase 10 forward-compat)
  ALTA_PRIORIDADE: 1.1,      // D-R4: book marked alta_prioridade in manifest
  DIMENSAO_INTERSECT: 1.2,   // D-R4: metadata.dimensoes intersects section theme
} as const

const SECTION_THEMES: Record<ReportSection, string[]> = {
  psicoemocional: ['psicossomatica', 'comportamental'],
  transgeracional: ['transgeracional'],
  simbolico: ['energetica'],
  mental_cognitivo: ['comportamental'],
  constituicao: ['constitucional', 'fisica'],
  mensagem_final: ['constitucional'],
}

export function applyWeights(
  chunks: KnowledgeChunkRow[],
  section: ReportSection | null,
  altaPrioridadeBooks: Set<string>,
): KnowledgeChunkRow[] {
  return chunks.map((chunk) => {
    let score = chunk.score
    if (chunk.source_type === 'clinical_data') {
      score *= WEIGHTS.CLINICAL_DATA  // +50%
    }
    if (altaPrioridadeBooks.has(chunk.source_book)) {
      score *= WEIGHTS.ALTA_PRIORIDADE  // +10%
    }
    if (section) {
      const themes = SECTION_THEMES[section]
      const intersects = chunk.metadata.dimensoes.some((d) => themes.includes(d))
      if (intersects) score *= WEIGHTS.DIMENSAO_INTERSECT  // +20%
    }
    return { ...chunk, score }
  })
}
```

**Deviation:** No I/O, pure function. The `altaPrioridadeBooks: Set<string>` is built once per request from manifest (loaded server-side). Re-sorting happens in `search.ts` after this pass.

---

### `apps/web/lib/rag/rerank.ts` (D-N2 voyage-rerank-2.5)

**Closest analog:** `apps/web/lib/vision/modal-client.ts` — same structure (server-only SDK wrapper) but with **graceful fallback** instead of throw.

**Pattern (modal-client.ts adapted with fallback semantics):**
```typescript
import 'server-only'
import { VoyageAIClient } from 'voyageai'
import type { KnowledgeChunkRow } from './types'

export const RERANK_MODEL = process.env.VOYAGE_RERANK_MODEL ?? 'voyage-rerank-2.5'

export interface RerankArgs {
  query: string
  candidates: KnowledgeChunkRow[]
  topK?: number   // default 30 per D-R3 cap
}

/**
 * D-N2 reranker. Graceful fallback: on any error, returns input candidates
 * sorted by their existing cosine score (top-K). Logs the failure but never
 * throws — D-N2 explicit: "Fallback graceful: se rerank API falha, retorna
 * top-30 cosine puro (não derruba retrieval)."
 */
export async function rerankChunks(args: RerankArgs): Promise<KnowledgeChunkRow[]> {
  const topK = args.topK ?? 30
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    console.warn('[rag.rerank] VOYAGE_API_KEY missing — falling back to cosine sort')
    return args.candidates.slice(0, topK)
  }
  try {
    const client = new VoyageAIClient({ apiKey })
    const result = await client.rerank({
      query: args.query,
      documents: args.candidates.map((c) => c.text),
      model: RERANK_MODEL,
      topK,
    })
    // Reorder candidates by reranker indices, replace score with rerank relevance
    return result.data.map((r) => ({
      ...args.candidates[r.index],
      score: r.relevanceScore,
    }))
  } catch (err) {
    console.warn('[rag.rerank] reranker failed — falling back to cosine sort:', err)
    return args.candidates.slice(0, topK)
  }
}
```

**Deviation from modal-client.ts:** Returns fallback array instead of throwing (D-N2 graceful semantics). Env-driven model name allows experimenting with `voyage-rerank-2.5-lite` (RESEARCH lines 137 — fallback de custo).

---

### `apps/web/lib/rag/search.ts` (server action — main retrieval)

**Closest analog:** `apps/web/app/actions/readings.ts` (lines 1–80 — `'use server'`, auth gate, `safeParse` validation, direct supabase call).

**Pattern (readings.ts lines 1–66):**
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
// ...
export async function <action>(args: ...): Promise<...> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) throw new Error('Unauthenticated')
  // ...
}
```

**Apply to search.ts (orchestrator):**
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { embedTexts } from './embed'
import { buildFamilyA, buildFamilyB } from './build-queries'
import { rerankChunks } from './rerank'
import { applyWeights } from './score-weights'
import type { KnowledgeChunkRow, ReportSection } from './types'

const TOP_K_PER_QUERY = 10        // D-N2: bumped from 5 → 10 to feed reranker
const FINAL_CAP = 30              // D-R3 cap
const MATCH_THRESHOLD = 0.0       // RPC default

interface RetrieveArgs {
  features: unknown                // narrowed via Zod or trust caller (Phase 7)
  reportSections: ReportSection[]
}

export async function retrieveRelevantKnowledge(args: RetrieveArgs): Promise<KnowledgeChunkRow[]> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (!user || authErr) throw new Error('Unauthenticated')

  const queriesA = buildFamilyA(args.features as never)
  const queriesB = buildFamilyB(args.features as never, args.reportSections)
  const allQueries = [...queriesA, ...queriesB]

  // Embed queries in parallel (D-R5 Promise.all)
  const { embeddings } = await embedTexts({ texts: allQueries, inputType: 'query' })

  // pgvector retrieval via RPC (RESEARCH §pgvector — RPC pattern with SET LOCAL ef_search=100)
  const rpcCalls = embeddings.map((emb) =>
    supabase.rpc('match_knowledge_chunks', {
      query_embedding: emb as never,
      match_count: TOP_K_PER_QUERY,
      match_threshold: MATCH_THRESHOLD,
    }),
  )
  const responses = await Promise.all(rpcCalls)

  // Dedup by id, keep best cosine score
  const dedupMap = new Map<string, KnowledgeChunkRow>()
  for (const { data } of responses) {
    if (!data) continue
    for (const row of data) {
      const existing = dedupMap.get(row.id)
      if (!existing || row.score > existing.score) {
        dedupMap.set(row.id, row as never)
      }
    }
  }
  let candidates = Array.from(dedupMap.values())

  // D-N2 rerank (graceful fallback inside)
  candidates = await rerankChunks({
    query: allQueries.join(' '),
    candidates,
    topK: FINAL_CAP * 2,  // overfetch, weights cull below
  })

  // D-R4 weights (clinical_data 1.5×, alta_prioridade 1.1×, dimensoes 1.2×)
  const altaSet = await loadAltaPrioridadeSet()
  candidates = applyWeights(candidates, args.reportSections[0] ?? null, altaSet)

  // Final sort + cap
  candidates.sort((a, b) => b.score - a.score)
  const result = candidates.slice(0, FINAL_CAP)

  // Telemetry (RESEARCH `<specifics>` line 238 — no PII)
  console.info({
    event: 'rag_retrieve',
    queries_count: allQueries.length,
    chunks_returned: result.length,
    top_score: result[0]?.score,
    bottom_score: result[result.length - 1]?.score,
  })
  return result
}
```

**Deviation from readings.ts:** Returns array directly (no `redirect`/`revalidatePath` — pure data fetch). RPC pattern is unique to this route (no precedent in repo); shape from RESEARCH §pgvector lines 432–469 verbatim.

---

### `apps/web/lib/rag/*.test.ts` (vitest)

**Closest analog:** `apps/web/lib/capture/upload.test.ts` (mock factory + describe/it pattern).

**Pattern (upload.test.ts lines 1–60 — mock factory, baseArgs builder, describe block):**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

function makeMockSupabase(opts: { rpcFails?: boolean; rpcReturns?: unknown[] } = {}) {
  const rpc = vi.fn().mockResolvedValue({
    data: opts.rpcFails ? null : opts.rpcReturns ?? [],
    error: opts.rpcFails ? { message: 'rpc err' } : null,
  })
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
    rpc,
  } as unknown as ReturnType<typeof createClient>
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(makeMockSupabase())),
}))

vi.mock('./embed', () => ({
  embedTexts: vi.fn().mockResolvedValue({ embeddings: [[0.1]], totalTokens: 100 }),
}))

describe('retrieveRelevantKnowledge', () => {
  beforeEach(() => vi.resetAllMocks())
  it('returns ≤30 chunks deduped by id, ordered desc', async () => {
    // ...
  })
})
```

**Deviation:** Mock factory is the canonical pattern (upload.test.ts line 6); env-driven mock pattern from `service.test.ts` lines 5–14 (for `embed.test.ts` env-validation tests).

---

### `supabase/migrations/0005_knowledge_chunks_content_hash_and_source_type.sql`

**Closest analog:** `supabase/migrations/0004_storage_bucket_iris_captures.sql` (lines 1–99) — exact role match (idempotent migration with header comment, DO blocks for constraints, multi-purpose feature in single file).

**Header comment pattern (0004 lines 1–16 verbatim):**
```sql
-- supabase/migrations/0005_knowledge_chunks_content_hash_and_source_type.sql
-- Fase 6 — RAG Ingestão: estende knowledge_chunks com idempotência (D-E2)
-- e source_type para forward-compat Fase 10 (D-F1).
--
-- O que esta migration cobre:
--   1) Adiciona content_hash (UNIQUE para ON CONFLICT DO NOTHING — D-E2).
--   2) Adiciona source_type CHECK ('biblioteca' | 'clinical_data') — D-F1.
--   3) Btree em source_book (filtro de purge — D-I2) e source_type.
--   4) RPC function match_knowledge_chunks com SET LOCAL hnsw.ef_search=100
--      (RESEARCH §pgvector tuning — recall salta significativamente).
--
-- Idempotente: pode ser re-aplicada sem erro (DO blocks + IF NOT EXISTS).
```

**DO block + idempotency pattern (0004 lines 88–99):**
```sql
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'knowledge_chunks_content_hash_key'
  ) then
    alter table knowledge_chunks
      add constraint knowledge_chunks_content_hash_key unique (content_hash);
  end if;
end $$;
```

**Full body (RESEARCH lines 564–600 verbatim + RPC from lines 432–469):**
```sql
alter table knowledge_chunks
  add column if not exists content_hash text,
  add column if not exists source_type text not null default 'biblioteca';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'knowledge_chunks_content_hash_key') then
    alter table knowledge_chunks
      add constraint knowledge_chunks_content_hash_key unique (content_hash);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'knowledge_chunks_source_type_check') then
    alter table knowledge_chunks
      add constraint knowledge_chunks_source_type_check
      check (source_type in ('biblioteca', 'clinical_data'));
  end if;
end $$;

create index if not exists knowledge_chunks_source_type_idx
  on knowledge_chunks (source_type);
create index if not exists knowledge_chunks_source_book_idx
  on knowledge_chunks (source_book);

-- RPC function match_knowledge_chunks
create or replace function match_knowledge_chunks(
  query_embedding vector(1024),
  match_count int default 5,
  match_threshold float default 0.0
)
returns table (
  id uuid,
  content text,
  source_book text,
  source_chapter text,
  source_page int,
  metadata jsonb,
  source_type text,
  score float
)
language sql
stable
as $$
  set local hnsw.ef_search = 100;
  select
    id, content, source_book, source_chapter, source_page,
    metadata, source_type,
    1 - (embedding <=> query_embedding) as score
  from knowledge_chunks
  where 1 - (embedding <=> query_embedding) >= match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function match_knowledge_chunks to authenticated;
```

**Deviation:** Combine schema + RPC into one migration (RESEARCH Open Question 7 default = combine). HNSW index ALREADY exists (Phase 1 line 90–91); D-P3 says "validate; if defaults differ, ajustar" — defaults are correct (RESEARCH §pgvector lines 408–410), so **no DROP/CREATE** needed.

---

### `apps/web/scripts/audit-vocabulary-db.mjs` (DB-side audit)

**Closest analog:** `apps/web/scripts/audit-vocabulary.mjs` (lines 1–72 — exact sibling, same logic, DB target instead of file target).

**Pattern verbatim from audit-vocabulary.mjs (lines 14, 64–71 — pattern + exit codes):**
```javascript
#!/usr/bin/env node
// apps/web/scripts/audit-vocabulary-db.mjs
// Sibling de audit-vocabulary.mjs: scaneia metadata.tags_livres em knowledge_chunks
// para vocabulário proibido (LGPD). Exit 0 = clean. Exit 1 = matches found.
// O `content` da tabela NÃO é auditado (citações de livro são permitidas) —
// apenas as TAGS LIVRES (conteúdo que NÓS escrevemos durante curadoria).

import { createClient } from '@supabase/supabase-js'

const PATTERN = /diagnóstico|tratamento|cura/i

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}

const supabase = createClient(url, key)
const { data, error } = await supabase
  .from('knowledge_chunks')
  .select('id, source_book, metadata')

if (error) {
  console.error('DB query failed:', error.message)
  process.exit(2)
}

const matches = []
for (const row of data ?? []) {
  const tags = row.metadata?.tags_livres ?? []
  for (const tag of tags) {
    if (PATTERN.test(tag)) {
      matches.push(`${row.id} (${row.source_book}): "${tag}"`)
    }
  }
}

if (matches.length) {
  console.error('VOCAB FAIL — tags_livres com vocabulário proibido:')
  for (const m of matches) console.error(m)
  process.exit(1)
}
console.log('OK: tags_livres limpas')
process.exit(0)
```

**Deviation from audit-vocabulary.mjs:** Targets DB rather than filesystem (no `collectFiles` recursion). Pattern unchanged. Exit codes preserved (0/1) plus `2` for env-config errors.

---

### `apps/web/scripts/rag-spot-check.ts` (UAT script — Success Criterion 5)

**Closest analog:** `apps/web/scripts/audit-vocabulary.mjs` (CLI script with exit codes).

**Pattern (CLI orchestrator with hardcoded fixture features → calls retrieve → prints top-5):**
```typescript
#!/usr/bin/env tsx
/**
 * apps/web/scripts/rag-spot-check.ts — Success Criterion 5 manual UAT.
 * Run: pnpm rag:spot-check
 *
 * Founder reviews output: top-5 chunks for "lacuna no setor 7 (fígado)"
 * must be visibly relevant to liver/lacuna in classical iridology works.
 */
import { retrieveRelevantKnowledge } from '@/lib/rag/search'

const FIXTURE_FEATURES = {
  constitution: { primary: 'biliar' },
  sectors: [{ hour: 7, findings: [{ type: 'lacuna_aberta' }] }],
  rings: { anel_tensao: { present: false } },
}

async function main() {
  const result = await retrieveRelevantKnowledge({
    features: FIXTURE_FEATURES,
    reportSections: ['constituicao'],
  })
  console.log(`Top ${result.length} chunks:`)
  result.slice(0, 5).forEach((c, i) => {
    console.log(`\n[${i + 1}] score=${c.score.toFixed(3)} | ${c.source_book} | p.${c.page}`)
    console.log(c.text.slice(0, 200) + '...')
  })
}

main().catch((err) => { console.error(err); process.exit(1) })
```

**Deviation:** Imports server action directly (only valid in `tsx`/`node` script context, not browser). Bypasses auth gate by setting fake session env (planner decides; alternative: use service-role client directly).

---

## Shared Patterns

### LGPD audit gate (cross-tree)
**Source:** `vision-service/scripts/audit_vocabulary.py` lines 21–28 (Python regex + SCAN_DIRS) AND `apps/web/scripts/audit-vocabulary.mjs` lines 14–21 (JS regex + DIRS).
**Apply to:** All new TS/Python/JSON/MD files in Phase 6.
**Required edits:**
1. `vision-service/scripts/audit_vocabulary.py` line 28 — add `"scripts/data"` to `SCAN_DIRS`.
2. `apps/web/scripts/audit-vocabulary.mjs` line 21 — add `"lib/rag"` to `DIRS`.
3. New: `apps/web/scripts/audit-vocabulary-db.mjs` for `metadata.tags_livres` (sibling, exact same regex).

### Lazy import for heavy/optional dependencies (Python)
**Source:** `vision-service/modal_app.py` line 94 (`import httpx  # lazy`) and `vision-service/pipeline/error_summary.py` (no imports outside stdlib in module head).
**Apply to:** `pdf_extractor.py` (PyMuPDF/pdfplumber), `embedder.py` (voyageai), `contextualizer.py` (anthropic), `persister.py` (supabase).
**Why:** keeps unit tests lightweight (mock-replaceable); keeps heavy installs scoped to where actually used.

### `'server-only'` import + env guard (TypeScript)
**Source:** `apps/web/lib/supabase/service.ts` lines 11, 17–25 + `apps/web/lib/vision/modal-client.ts` lines 9, 39–44.
**Apply to:** `apps/web/lib/rag/embed.ts`, `apps/web/lib/rag/search.ts`, `apps/web/lib/rag/rerank.ts`.
**Pattern:**
```typescript
import 'server-only'
// ...
const apiKey = process.env.VOYAGE_API_KEY
if (!apiKey) throw new VoyageEmbedError('VOYAGE_API_KEY is not set')
```

### Pydantic `ConfigDict(extra="forbid")` (Python schema strictness)
**Source:** `vision-service/pipeline/schemas.py` lines 43, 51, 58, 66, 74, 84, 92, 100, 108, 117 — every Pydantic model uses it.
**Apply to:** `vision-service/scripts/lib/manifest.py` (BookEntry, BooksManifest).
**Why:** D-T6 "dúvida → null/[]" — extra fields are bugs. `extra="forbid"` catches manifest typos at load time.

### Idempotent SQL migration with DO blocks
**Source:** `supabase/migrations/0004_storage_bucket_iris_captures.sql` lines 88–99.
**Apply to:** `supabase/migrations/0005_knowledge_chunks_content_hash_and_source_type.sql`.
**Why:** `ALTER TABLE … ADD CONSTRAINT IF NOT EXISTS` not supported in all PG versions; DO + `pg_constraint` lookup is portable.

### `lru_cache` loader for canonical assets
**Source:** `vision-service/pipeline/error_summary.py` lines 30–48 + `vision-service/pipeline/iris_maps.py` lines 16–20.
**Apply to:** `vision-service/scripts/lib/manifest.py` (`load_manifest`).
**Why:** read once per process; avoid CWD assumptions via `Path(__file__).parent.parent / "data"`.

### Custom error class for SDK wrappers
**Source:** `apps/web/lib/vision/modal-client.ts` lines 28–36 (`ModalTriggerError`).
**Apply to:** `apps/web/lib/rag/embed.ts` (`VoyageEmbedError`), `vision-service/scripts/lib/embedder.py` (`VoyageEmbedError`), `apps/web/lib/rag/types.ts` (`RagError`).
**Why:** caller can `catch (err) { if (err instanceof VoyageEmbedError) ... }` — type-safe error discrimination.

### Mock factory for vitest/pytest
**Source:** `apps/web/lib/capture/upload.test.ts` lines 6–20 (TS `makeMockSupabase`).
**Apply to:** All new `*.test.ts` in `apps/web/lib/rag/` AND Python equivalent in `vision-service/tests/test_embedder.py`, `test_persist.py`, `test_contextualizer.py`.
**Why:** repeatable, encapsulated mock surface; spies exposed via `_spies` for assertion.

### Hybrid structural + metric assertion (tests)
**Source:** `vision-service/tests/test_iris_maps.py` lines 13–60 (structural shape + content invariants).
**Apply to:** `test_chunker.py` (chunk count + tokens range + boundary preservation), `test_books_manifest.py` (schema + filename existence).
**Why:** structural assertions catch refactor regressions; metric assertions catch quality drift.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `vision-service/scripts/lib/budget.py` | utility (state) | event-driven | No analog — use RESEARCH §Cost Monitoring lines 622–669 verbatim |
| `vision-service/scripts/lib/persister.py` | persister (DB) | CRUD | No Python persister exists in repo (Phase 5 used signed URLs; Phase 6 needs supabase-py upsert) |
| `vision-service/data/jensen-reference.md` | data asset | — | First canonical signs reference; founder validates Wave 0 |
| `apps/web/lib/rag/section-queries.ts` | config (templates) | — | First D-R2 templates; versioned alongside Phase 7 super prompt |
| `apps/web/lib/rag/search.ts` (RPC pattern) | server action | request-response | No precedent for `supabase.rpc('...')` in repo; RESEARCH §pgvector lines 432–469 is the verbatim source |

For each: planner copies the RESEARCH excerpt directly into the plan action and notes "no in-repo analog — use RESEARCH §X lines Y-Z verbatim."

---

## REQUIREMENTS.md Update Notes

RESEARCH §Outdated REQUIREMENTS.md (lines 1030–1035) flags 3 documentation lags. Plan should include a small Wave 0 doc-only task:

| Req | Outdated text | Update to |
|-----|---------------|-----------|
| RAG-01 | "Script `scripts/ingest-knowledge.ts` extrai texto de PDFs (pdf-parse/pdfjs)" | "Script `vision-service/scripts/ingest_knowledge.py` extrai via PyMuPDF (D-C4)" |
| RAG-03 | "Jensen Vol. 1 + Battello" | "18 PDFs do acervo do fundador (D-S1)" |
| RAG-04 | `retrieveRelevantKnowledge(features)` | `retrieveRelevantKnowledge(features, reportSections)` |

STATE.md update (D-S2): remove the falso-positivo "Battello pt-BR" blocker line — not "fechado como found", but **removido** com nota de false positive.

---

## Metadata

**Analog search scope:**
- `vision-service/` (modal_app.py, pipeline/, scripts/, tests/, data/, requirements.txt, pytest.ini, README.md)
- `apps/web/` (app/api/, app/actions/, lib/capture/, lib/supabase/, lib/vision/, scripts/, package.json)
- `supabase/migrations/` (0001–0004)
- `.planning/phases/05-pipeline-visao-modal/05-PATTERNS.md` (Phase 5 pattern conventions reused)

**Files scanned:** 28 in-repo + 1 prior PATTERNS.md cross-reference.
**Pattern extraction date:** 2026-05-04.
