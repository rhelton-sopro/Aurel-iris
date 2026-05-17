-- 0018_report_generations_amendment.sql
--
-- Forward fix for the 07.4-36 "emenda completa".
--
-- Root cause: migration 0017 was ALREADY recorded as applied in the remote
-- supabase_migrations table (the original report_generations, pre-amendment).
-- Commit 2e2f6af amended the 0017 FILE (CREATE TABLE + an idempotent ALTER
-- guard), but `supabase db push` is version-tracked, not content-tracked: it
-- never re-runs an already-applied migration version, so the amended block in
-- 0017 never executed against the live DB. The amended 0017 stays correct for
-- FRESH databases (they get all columns from its CREATE TABLE); THIS migration
-- is the forward delta that brings an already-migrated prod DB to parity.
--
-- Strictly additive + idempotent (ADD COLUMN IF NOT EXISTS): safe on a DB that
-- already has some/all of these columns (no-op then), and safe to re-run. No
-- data migration, no backfill. Best-effort instrumentation columns — every
-- read must treat NULL as "not captured for this row".
--
-- Division of labor: Claude authored; the founder applies it (supabase db
-- push / dashboard SQL) — same pattern as 0016 / 0017.

alter table public.report_generations
  add column if not exists prompt_version           text,
  add column if not exists canonical_fallback_count integer,
  add column if not exists audit_summary            jsonb,
  add column if not exists regeneration_count       integer,
  add column if not exists client_id                uuid,
  add column if not exists bbox_cost_usd            numeric(10, 5),
  add column if not exists bbox_latency_ms          integer;

comment on column public.report_generations.prompt_version is
  '07.4-36: short sha256 of the effective system.md content at generation time (getSystemPromptVersion). Lets quality/cost shifts be attributed to prompt iteration vs model change.';
comment on column public.report_generations.canonical_fallback_count is
  '07.4-36: # of the 6 photos that fell back to the raw uncentered frame (canonicalization trust-gate) for THIS generation. Per-generation snapshot (readings.audit_metadata is overwritten each regen).';
comment on column public.report_generations.audit_summary is
  '07.4-36: the AuditMetadata for this generation (low_anchor_rate, anchor_rate_pct, forbidden_vocab[], audited_at). Per-generation snapshot.';
comment on column public.report_generations.regeneration_count is
  '07.4-36: readings.regeneration_count AFTER this generation (1 = first generation, 2 = first regen, …). Authoritative even if a best-effort insert is ever lost.';
comment on column public.report_generations.client_id is
  '07.4-36: denormalized readings.client_id (no FK — mirrors the reading_id decoupling). Survives reading deletion; avoids a join for per-client cost rollups.';
comment on column public.report_generations.bbox_cost_usd is
  '07.4-36: cost of the SEPARATE canonicalization (Sonnet-bbox) Anthropic call for this reading, read from readings.canonical_metadata.cost_usd. Total reading $ = cost_usd + bbox_cost_usd.';
comment on column public.report_generations.bbox_latency_ms is
  '07.4-36: wall-clock latency of the canonicalization batch (6 parallel bbox calls), from readings.canonical_metadata.bbox_latency_ms.';
