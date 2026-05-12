-- supabase/migrations/0012_canonical_capture.sql
-- Phase 07.1.6 — Canonical Capture Pipeline (per D-01..D-06 + C-01..C-08)
-- Additive-only. All new columns are nullable → backward-compatible with
-- pre-07.1.6 readings (NULL = not yet canonicalized; process/route.ts falls
-- back to storage_path).
--
-- Idempotência: `add column if not exists` permite re-run safe.
-- NO new RLS policies needed: reading_images inherits existing RLS via
-- reading_id → readings.therapist_id (migration 0001).

begin;

-- reading_images: canonical crop path (NULL = not canonicalized / fallback / pre-07.1.6)
alter table reading_images
  add column if not exists canonical_storage_path text;

-- readings: aggregate canonical audit metadata (jsonb, NULL until first canonicalize call)
-- Shape (documented in apps/web/lib/anthropic/types.ts CanonicalMetadata):
--   {
--     sonnet_input_tokens: int,
--     sonnet_output_tokens: int,
--     cost_usd: number,
--     status_summary: { ok: int, fallback: int, disabled: int },
--     canonicalized_at: timestamptz ISO string
--   }
alter table readings
  add column if not exists canonical_metadata jsonb;

commit;
