"""Custom chapter->section->paragraph chunker for iridology PDFs (D-C1..C3, D-E2).

Target 500 tokens, flex 300-700, overlap 80, NO overlap across chapter/section.
Tokenization: tiktoken cl100k_base (proxy; under-counts Voyage by ~1.2x — OK
within the 300-700 flex band per RESEARCH section on tiktoken).

content_hash canonicalization is LOCKED to sha256(text.strip().encode('utf-8')) —
no NFC/NFD normalization, no lowercase, no whitespace collapse. Test asserts
hash of "hello" against the well-known sha256 hex digest.

Phase: 06-rag-ingestao | Plan: 06-04 | Decisions: D-C1, D-C2, D-C3, D-E2,
RESEARCH Pitfall 1 (locked canonicalization)

NOTE: vocabularies.json (D-T2..T5) is consumed by the *tagger* (curation step)
and the persister, not the chunker. The chunker is library-only — it produces
chunks with raw text + structural metadata; semantic tags are applied later.
"""
from __future__ import annotations

import functools
import hashlib
import re
from dataclasses import dataclass

# D-C1 locked params
TARGET_TOKENS = 500
MIN_TOKENS = 300
MAX_TOKENS = 700
OVERLAP_TOKENS = 80

# D-C2 hierarchy detection -- multilingual chapter/section markers.
#
# Chapter regex matches lines like "CAPÍTULO I — Introdução", "CHAPTER 5",
# "CAPITOLO IV". The match anchors on the marker word + roman/arabic numeral.
CHAPTER_RE = re.compile(
    r"^\s*(?:CAP[IÍ]TULO|CHAPTER|CAPITOLO)\s+[IVXLCDM\d]+",
    re.IGNORECASE | re.MULTILINE,
)
# Section regex matches numbered headings ("1.1 Setor 7 Fígado", "2.3.4 Lacunas")
# OR an ALL-CAPS line of >=5 chars (e.g., "LACUNAS E CRIPTAS").
# The numeric branch greedily matches whatever follows the number prefix on the
# same line; this is intentional because section headings span variable-length
# titles ("1.1 Setor 7 — Fígado", "2.4 Anel de tensão").
SECTION_RE = re.compile(
    r"^\s*(?:\d+\.\d+(?:\.\d+)?\s+\S.*|[A-Z][A-Z\s]{4,})\s*$",
    re.MULTILINE,
)


@dataclass
class Chunk:
    text: str
    chapter: str | None
    section: str | None
    page: int | None
    tokens_estimated: int


@functools.lru_cache(maxsize=1)
def _get_encoder():
    import tiktoken  # lazy: only available inside ingest env
    return tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    """tiktoken cl100k_base length — proxy for Voyage tokens (under-counts ~1.2x)."""
    return len(_get_encoder().encode(text))


def content_hash(text: str) -> str:
    """sha256(text.strip().encode('utf-8')) — D-E2 LOCKED (RESEARCH Pitfall 1).

    Do NOT lowercase, collapse whitespace, or NFC/NFD normalize — re-runs would
    silently duplicate. The test asserts hash of "hello" against the well-known
    sha256 hex digest to catch any future change to canonicalization.
    """
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


def _tail_for_overlap(text: str, target_tokens: int) -> str:
    """Return the trailing portion of ``text`` whose token count is ~target_tokens.

    Sentence-tail granularity: walk sentences from the end, accumulating until
    we reach (or just exceed) the target. This is the overlap seed for the
    next chunk, used inside the same section per D-C1.
    """
    if not text or target_tokens <= 0:
        return ""
    # Sentence-aware split keeping terminators with their sentences.
    sentences = re.split(r"(?<=[.!?])\s+", text)
    tail: list[str] = []
    accum = 0
    for sent in reversed(sentences):
        st = count_tokens(sent)
        tail.insert(0, sent)
        accum += st
        if accum >= target_tokens:
            break
    out = " ".join(tail).strip()
    # Cap at 1.5x target to avoid runaway when sentences are long.
    while count_tokens(out) > int(target_tokens * 1.5) and len(tail) > 1:
        tail.pop(0)
        out = " ".join(tail).strip()
    return out


def _split_long_paragraph(text: str, max_tokens: int) -> list[str]:
    """Split an oversized paragraph at sentence boundaries.

    A single paragraph that exceeds MAX_TOKENS would otherwise blow the size
    invariant. Split on sentence enders (. ! ?) accumulating until each piece
    is just below max_tokens, then return the list.

    Used only as a safety valve when paragraphs are denser than expected
    (e.g., scanned PDFs with paragraph breaks lost, or aggressive single-line
    formatting).

    BPE caveat: ``count_tokens(' '.join(parts))`` can exceed
    ``sum(count_tokens(p) for p in parts)`` because BPE re-tokenizes the joined
    boundaries. We therefore re-count after each join and keep popping
    sentences until the joined text fits under ``max_tokens``.
    """
    if count_tokens(text) <= max_tokens:
        return [text]
    # Sentence split — keep the terminator with the sentence to preserve meaning.
    sentences = re.split(r"(?<=[.!?])\s+", text)
    out: list[str] = []
    buf: list[str] = []
    for sent in sentences:
        candidate = " ".join([*buf, sent])
        if buf and count_tokens(candidate) > max_tokens:
            out.append(" ".join(buf))
            buf = [sent]
        else:
            buf.append(sent)
    if buf:
        out.append(" ".join(buf))
    return out


def chunk_book(pages: list[dict], book_meta: dict) -> list[Chunk]:
    """Split a book's pages into Chunks honoring D-C1/C2 boundaries.

    Args:
        pages: list[{page, text, scan_detected}] from pdf_extractor.
        book_meta: dict with at least {source_book, ...} for downstream tagging.

    Returns:
        list[Chunk] in document order.
    """
    # Pass 1 -- build linear stream of (kind, ...) tuples.
    # Oversized paragraphs are pre-split at sentence boundaries so the chunker's
    # MAX_TOKENS invariant holds end-to-end (D-C1).
    stream: list[tuple] = []

    def _emit_text(body: str, page_num: int | None) -> None:
        body = body.strip()
        if not body:
            return
        # Safety valve: split paragraphs that exceed TARGET_TOKENS at
        # sentence boundaries before they hit the chunk buffer. TARGET_TOKENS
        # is the ceiling here (not MAX) because the within-section overlap
        # seed plus the next piece plus BPE boundary noise must all stay
        # under MAX_TOKENS — TARGET gives the headroom needed.
        for piece in _split_long_paragraph(body, TARGET_TOKENS):
            stream.append(("TEXT", piece, page_num))

    for page_dict in pages:
        page_num = page_dict.get("page")
        text = page_dict.get("text", "") or ""
        # Paragraph break is `\n\n+`; if the source PDF emits only single
        # newlines we still want to detect chapter/section markers that begin
        # a paragraph and split off the body. Markers are looked up via
        # ``re.match`` (anchored at start) so a body line that merely contains
        # a section-like substring doesn't get misclassified.
        for para in re.split(r"\n\n+", text):
            stripped = para.strip()
            if not stripped:
                continue
            chapter_m = CHAPTER_RE.match(stripped)
            section_m = None if chapter_m else SECTION_RE.match(stripped)
            if chapter_m:
                marker = chapter_m.group(0).strip()
                # The marker may be followed by a title on the same line + a
                # body on subsequent lines. Treat first line as marker,
                # rest as TEXT body for the new chapter.
                first_line, _, rest = stripped.partition("\n")
                stream.append(("CHAPTER", first_line.strip()))
                _emit_text(rest, page_num)
            elif section_m:
                first_line, _, rest = stripped.partition("\n")
                stream.append(("SECTION", first_line.strip()))
                _emit_text(rest, page_num)
            else:
                _emit_text(stripped, page_num)

    # Pass 2 -- chunk-build
    chunks: list[Chunk] = []
    current_chapter: str | None = None
    current_section: str | None = None
    buffer_paragraphs: list[tuple[str, int | None]] = []
    buffer_tokens = 0
    first_page: int | None = None

    def _flush() -> None:
        nonlocal buffer_paragraphs, buffer_tokens, first_page
        if not buffer_paragraphs:
            return
        chunk_text = "\n\n".join(p[0] for p in buffer_paragraphs)
        chunks.append(Chunk(
            text=chunk_text,
            chapter=current_chapter,
            section=current_section,
            page=first_page,
            tokens_estimated=count_tokens(chunk_text),
        ))
        buffer_paragraphs = []
        buffer_tokens = 0
        first_page = None

    for entry in stream:
        kind = entry[0]
        if kind == "CHAPTER":
            _flush()  # Boundary: emit even if small (no cross-chapter overlap)
            current_chapter = entry[1]
            current_section = None
        elif kind == "SECTION":
            _flush()  # Boundary: emit even if small (no cross-section overlap)
            current_section = entry[1]
        else:  # TEXT
            _, paragraph, page = entry
            tokens = count_tokens(paragraph)
            # Hard ceiling: if the buffer would exceed MAX_TOKENS by appending
            # this paragraph, flush BEFORE appending. We accept boundary chunks
            # below MIN_TOKENS per D-C1 (tail-of-section flex) — keeping the
            # MAX cap is more important than the MIN floor.
            if buffer_paragraphs and buffer_tokens + tokens > MAX_TOKENS:
                # Within-section overlap (D-C1): keep ~OVERLAP_TOKENS worth of
                # the rendered chunk's TAIL as the seed for the next chunk.
                # Computed at sentence-tail granularity so overlap works even
                # when the buffer holds a single large paragraph (a paragraph
                # boundary is too coarse a unit to land near 80 tokens).
                overlap_text = ""
                if buffer_tokens >= MIN_TOKENS:
                    rendered = "\n\n".join(p[0] for p in buffer_paragraphs)
                    overlap_text = _tail_for_overlap(rendered, OVERLAP_TOKENS)
                last_page = buffer_paragraphs[-1][1] if buffer_paragraphs else page
                _flush()
                if overlap_text:
                    buffer_paragraphs = [(overlap_text, last_page)]
                    buffer_tokens = count_tokens(overlap_text)
                    first_page = last_page
                else:
                    buffer_paragraphs = []
                    buffer_tokens = 0
                    first_page = None
            if first_page is None:
                first_page = page
            buffer_paragraphs.append((paragraph, page))
            buffer_tokens += tokens

    _flush()
    return chunks
