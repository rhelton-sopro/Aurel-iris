---
phase: 6
slug: rag-ingestao
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-06
---

# Phase 6 — Security

> Per-phase security contract for the RAG Ingestion phase: trust boundaries, threat register consolidated from per-plan summary frontmatter (`threat_register_status:` blocks across plans 06-07/09/10/11), accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Founder workstation → Voyage AI | Outbound HTTPS from `vision-service/scripts/` for embedding the 18-book corpus and contextual sentences | Public published-book text + Haiku-generated context lines (no PII) |
| Founder workstation → Anthropic | Outbound HTTPS from `vision-service/scripts/contextualize_chunks.py` (Haiku 4.5 with prompt caching) | Per-chapter book context (public published-book text, no PII) |
| Founder workstation → Supabase Postgres | Service-role client (`SUPABASE_SERVICE_ROLE_KEY`) used by `vision-service/scripts/lib/persister.py` to write `knowledge_chunks` | Embedded vectors + metadata + content_hash; no PII (LGPD audit clean) |
| Browser/client (authenticated therapist) → Next.js (apps/web) | Server actions and Route Handlers; Supabase session cookies | User session identity; never reaches RAG telemetry |
| Next.js server → Voyage AI | `apps/web/lib/rag/embed.ts` query embedding + `rerank.ts` reranking; key in server-only module | User query strings (derived from features + reportSections, no free text from users) |
| Next.js server → Supabase RPC `match_knowledge_chunks` | Vector retrieval; runs as `authenticated` (default) or `service_role` (admin spot-check only) | Query embedding (1024-dim float vector); returns book content (no PII) |
| Founder local CLI → `/api/admin/rag-spot-check` Route Handler | Token-gated header `x-spot-check-token` matching `RAG_SPOT_CHECK_TOKEN` env var | 128-bit secret in HTTP header; admin trust elevation |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-RAG-01 | Tampering | `vision-service/scripts/lib/persister.py` + migration `0005_knowledge_chunks_content_hash_and_source_type.sql` | mitigate | `content_hash` UNIQUE constraint + `on_conflict='content_hash', ignore_duplicates=True` upsert + canonicalization-drift guard test (`tests/test_idempotency.py` pins `sha256('hello')` hex digest) | closed |
| T-RAG-02 | Information Disclosure | `vision-service/scripts/lib/persister.py` (`get_client`) | mitigate | `SUPABASE_SERVICE_ROLE_KEY` never logged; `PersisterError` messages reference env-var name only; `eyJ` shape check uses `startswith()` so key bytes never enter exception text (RESEARCH Pitfall 14) | closed |
| T-RAG-03 | Tampering | `apps/web/lib/rag/embed.ts` + `vision-service/scripts/lib/embedder.py` | mitigate | `EMBEDDING_MODEL='voyage-3'` pinned in both files; `embed.test.ts` and `test_embedder.py` assert the constant (drift breaks tests in either tree) | closed |
| T-RAG-04 | Tampering | `apps/web/lib/rag/score-weights.ts` (`SECTION_THEMES`) | mitigate | Typed `Record<ReportSection, string[]>` — adding a new `ReportSection` without a theme breaks `tsc --noEmit` | closed |
| T-RAG-05 | Denial of Service (availability) | `apps/web/lib/rag/rerank.ts` | mitigate | Three graceful fallback paths (missing API key / SDK throw / empty response); zero `throw` statements (verified by grep gate); `console.warn` for observability (D-N2 contract) | closed |
| T-RAG-06 | Spoofing / Authorization | `apps/web/lib/rag/search.ts` default auth path | mitigate | Supabase `auth.getUser()` gate — throws `'Unauthenticated'` if `!user || authErr` (defense-in-depth even if middleware fails); test `'throws when user is unauthenticated'` verifies | closed |
| T-RAG-07 | Information Disclosure | `apps/web/lib/rag/embed.ts` (and `rerank.ts`, `search.ts` mirror) | mitigate | First non-comment line `import 'server-only'` triggers Next.js Reserved-Module hard build error if any client component transitively imports; mirrors `apps/web/lib/supabase/service.ts` from Phase 5 | closed |
| T-RAG-08 | Information Disclosure (PII / LGPD) | `apps/web/lib/rag/search.ts` telemetry | mitigate | `console.info` payload restricted to `{event, queries_count, chunks_returned, top_score, bottom_score}` — explicit absence of `user_id`, `client_id`, `reading_id`, query strings, and chunk text; `'logs telemetry event with no PII'` test asserts negation | closed |
| T-RAG-09 | Tampering (silent recall regression) | `apps/web/lib/rag/embed.ts` + `vision-service/scripts/lib/embedder.py` | mitigate | Default `inputType='query'` (retrieval) and `input_type='document'` (ingestion) — Voyage's canonical footgun; both files tested for default behavior | closed |
| T-RAG-10 | Denial of Service / Resource Exhaustion | Supabase RPC `match_knowledge_chunks` (migrations `0005`, `0006`) | accept | RPC has no server-side cap on `match_count`; orchestrator (`apps/web/lib/rag/search.ts`) caps at `TOP_K_PER_QUERY=10` per call but a direct authenticated caller could request a large N. Accepted because: (a) authenticated-only via `grant execute … to authenticated`, (b) `knowledge_chunks` content is published-book text — no PII (LGPD audit clean across all 14 plans), (c) impact is server-side performance, not data exfiltration, (d) abuse vector is bounded to registered therapists. Re-evaluate if therapist count grows past Phase 8 dogfooding cohort. | closed |
| T-RAG-11 | Compliance (LGPD vocabulário proibido) | `apps/web/lib/rag/{search,rerank,build-queries,score-weights}.ts` + `vision-service/scripts/audit_vocabulary.py` + `apps/web/scripts/audit-vocabulary-db.mjs` | mitigate | Literal-grep gate `grep -E 'diagn[óo]stico\|tratamento\|cura'` returns empty for all rag/* TS files including comments; `pnpm audit:vocabulary` extended in 06-12 to scan `lib/rag/`; `audit:vocabulary:db` (06-12) scans `metadata.tags_livres` of all populated `knowledge_chunks` (2761 rows, all clean at UAT) | closed |
| T-RAG-12 | Tampering (vocabulary drift) | `apps/web/lib/rag/score-weights.ts` `SECTION_THEMES` values | mitigate | Acceptance gate runs Python script that loads canonical `vision-service/scripts/data/vocabularies.json` and asserts `themes_used.issubset(canonical_dimensoes)` — typo'd theme like `'emotional'` instead of `'psicossomatica'` would silently never intersect; gate catches it loud | closed |
| T-RAG-13 | Tampering (manifest drift) | `apps/web/lib/rag/search.ts` `ALTA_PRIORIDADE_BOOKS` | mitigate | Drift detection test in `search.test.ts` reads `vision-service/scripts/data/books_manifest.json` at test time, computes `alta_prioridade=true` keys Set, asserts equality with the hardcoded TS constant. Founder edits to manifest must mirror in `search.ts` or test fails with diff | closed |
| T-RAG-14 | Denial of Service (latency budget) | `apps/web/lib/rag/search.ts` retrieval pipeline | mitigate | Test `'latency p95 <= 2s with 8 mocked queries'` enforces D-N4 early-warning gate (under D-R5 hard cap of 3s); typical observed value <50ms with mocked I/O. Real-network latency budget covered by 06-13 founder UAT (5/5 PASS). | closed |
| T-RAG-15 | Authorization / Elevation of Privilege | `apps/web/app/api/admin/rag-spot-check/route.ts` + `auth: 'service-role'` discriminator on `RetrieveArgs` | mitigate | Fail-closed Route Handler: returns 403 if `RAG_SPOT_CHECK_TOKEN` env var unset OR header `x-spot-check-token` mismatches; service-role bypass only invoked AFTER token check passes; explicit trust-boundary comment in `route.ts` and `search.ts`. Default `auth: 'session'` preserves the secure user-facing pattern. | closed |
| T-RAG-16 | Information Disclosure (timing oracle) | `apps/web/app/api/admin/rag-spot-check/route.ts:75` (`headerToken !== expectedToken`) | accept | Token comparison is non-constant-time (string `!==`). Accepted because: (a) `RAG_SPOT_CHECK_TOKEN` is a 128-bit `openssl rand -hex 16` secret — exhaustive search infeasible regardless of timing leak, (b) endpoint is founder-local only (no public deployment), (c) Route Handler runs in Vercel/Next.js where stage-by-stage timing on string compare is also blunted by request scheduling jitter. Re-evaluate if endpoint is ever exposed beyond founder-local: switch to `crypto.timingSafeEqual` over equal-length Buffers. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-RAG-01 | T-RAG-10 | RPC `match_knowledge_chunks` has no server-side `match_count` cap. Authenticated callers could request large N, causing server-side resource pressure. Accepted: authenticated-only (RLS + `grant execute … to authenticated`), `knowledge_chunks` content is published-book text (no PII, LGPD audit clean), abuse bounded to registered therapists, orchestrator FINAL_CAP=30 protects all in-app callers. Trigger to revisit: therapist cohort growth past Phase 8 dogfooding, or any change that allows anonymous read on `knowledge_chunks`. | Founder (Rhelton) | 2026-05-06 |
| AR-RAG-02 | T-RAG-16 | `x-spot-check-token` comparison uses non-constant-time `!==`. Accepted: 128-bit secret (`openssl rand -hex 16`) defeats brute force regardless of timing, founder-local-only endpoint, no public exposure path. Trigger to revisit: any deployment that exposes `/api/admin/rag-spot-check` beyond founder workstation — switch to `crypto.timingSafeEqual` over equal-length Buffers before that change ships. | Founder (Rhelton) | 2026-05-06 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-06 | 16 | 16 | 0 | /gsd-secure-phase 6 (consolidated from per-plan `threat_register_status:` summaries; 2 risks accepted by founder) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-06
