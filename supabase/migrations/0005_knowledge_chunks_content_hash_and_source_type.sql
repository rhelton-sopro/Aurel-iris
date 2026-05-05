-- supabase/migrations/0005_knowledge_chunks_content_hash_and_source_type.sql
-- Phase 6 — RAG Ingestão: estende knowledge_chunks com idempotência (D-E2)
-- e source_type para forward-compat Fase 10 (D-F1).
-- Adiciona RPC match_knowledge_chunks com SET LOCAL hnsw.ef_search = 100
-- (RESEARCH pgvector — boost recall em corpus pequeno).
--
-- Idempotente: pode ser re-aplicada sem erro (add column if not exists,
-- DO blocks para constraints, create index if not exists, create or replace
-- function). 06-PLAN-07 deste fase.

-- ============================================================================
-- 1) Colunas: content_hash + source_type (D-E2 + D-F1)
-- ============================================================================
alter table knowledge_chunks
  add column if not exists content_hash text,
  add column if not exists source_type text not null default 'biblioteca';

-- ============================================================================
-- 2) UNIQUE em content_hash (D-E2 — idempotência via ON CONFLICT)
-- DO block porque ADD CONSTRAINT IF NOT EXISTS não é suportado em todas as
-- versões do Postgres (mesmo padrão de 0004_storage_bucket_iris_captures.sql).
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knowledge_chunks_content_hash_key'
  ) then
    alter table knowledge_chunks
      add constraint knowledge_chunks_content_hash_key unique (content_hash);
  end if;
end $$;

-- ============================================================================
-- 3) CHECK em source_type (D-F1 — forward-compat Fase 10 clinical_data)
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knowledge_chunks_source_type_check'
  ) then
    alter table knowledge_chunks
      add constraint knowledge_chunks_source_type_check
      check (source_type in ('biblioteca', 'clinical_data'));
  end if;
end $$;

-- ============================================================================
-- 4) Btree indexes para filtros rápidos (D-P1)
-- ============================================================================
create index if not exists knowledge_chunks_source_type_idx
  on knowledge_chunks (source_type);
create index if not exists knowledge_chunks_source_book_idx
  on knowledge_chunks (source_book);

-- ============================================================================
-- 5) RPC match_knowledge_chunks (RESEARCH lines 432–469 — pgvector retrieval)
-- SET LOCAL hnsw.ef_search = 100 boosta recall em corpus pequeno (~5k chunks).
-- language sql stable preserva uso do index HNSW da Fase 1.
-- create or replace permite re-runs idempotentes da migration.
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
  set local hnsw.ef_search = 100;
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
