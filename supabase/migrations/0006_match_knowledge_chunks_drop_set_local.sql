-- ============================================================================
-- Migration 0006 — fix match_knowledge_chunks RPC: drop SET LOCAL hnsw.ef_search
--
-- Bug surfaced 2026-05-05 during 06-13 founder UAT spot-check: every call to
-- match_knowledge_chunks returned an error
--   "SET is not allowed in a non-volatile function"
-- and produced 0 rows. Postgres rejects SET (even SET LOCAL) inside STABLE or
-- IMMUTABLE functions; only VOLATILE functions may issue SET.
--
-- Tradeoff considered:
--   Option A (chosen): drop SET LOCAL, keep STABLE. ef_search defaults to 40
--     (vs the original 100). Slightly lower recall on the 2761-chunk corpus,
--     but planner still uses the HNSW index — fast retrieval is preserved.
--     If founder UAT shows insufficient recall later, raise via DB-level config:
--       ALTER DATABASE postgres SET hnsw.ef_search = 100;
--     (DB-level config is honored by STABLE functions; it's the function-local
--      SET that's forbidden.)
--   Option B (rejected): change to VOLATILE. SET LOCAL would work, but
--     VOLATILE prevents the planner from using the HNSW index — falls back to
--     sequential scan over 2761 rows on every query. Catastrophic for latency.
--   Option C (rejected): inline raw SQL with WITH-clause + set_config. Brittle
--     and arguably the same restriction applies.
--
-- Idempotent: CREATE OR REPLACE FUNCTION re-runs cleanly. The grant is also
-- idempotent (re-granting to a role that already has it is a no-op).
-- ============================================================================

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
  -- NOTE: no SET LOCAL hnsw.ef_search = 100 — STABLE rejects it. Default 40
  -- applies. Raise via ALTER DATABASE if recall is insufficient (see migration
  -- header for the command).
  select
    knowledge_chunks.id,
    knowledge_chunks.content,
    knowledge_chunks.source_book,
    knowledge_chunks.source_chapter,
    knowledge_chunks.source_page,
    knowledge_chunks.metadata,
    knowledge_chunks.source_type,
    1 - (knowledge_chunks.embedding <=> query_embedding) as score
  from knowledge_chunks
  where 1 - (knowledge_chunks.embedding <=> query_embedding) >= match_threshold
  order by knowledge_chunks.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function match_knowledge_chunks(vector(1024), int, float) to authenticated;
grant execute on function match_knowledge_chunks(vector(1024), int, float) to service_role;
