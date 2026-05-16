-- 0016_readings_sam_parallel.sql
--
-- Parallel SAM comparison harness (Phase 7.4 — SAM vs vigente).
--
-- Purpose: let the founder run an alternative segmentation branch (SAM2)
-- on an existing or new reading WITHOUT touching the production pipeline
-- output. The parallel result lives in dedicated nullable columns so:
--   - production `vision_features` / `report_generated` are never modified
--   - the side-by-side comparison UI reads `*_sam` columns
--   - readings with no SAM run simply have NULLs (no behavioural change)
--
-- Strictly additive. No data migration, no default, no backfill. Existing
-- rows and all current code paths are unaffected (every read of the new
-- columns must treat NULL = "no SAM run yet").
--
-- Division of labor: Claude authored this migration; the founder applies it
-- to the production database (supabase db push / dashboard) — same pattern
-- as the Modal deploy.

alter table public.readings
  add column if not exists vision_features_sam   jsonb,
  add column if not exists report_generated_sam  jsonb,
  add column if not exists report_generated_sam_at timestamptz,
  -- Free-text + structured provenance of the SAM run (model_version,
  -- modal_call_id, source = 'reprocess_existing' | 'new', triggered_by,
  -- error_summary). Mirrors the spirit of processing_metadata but kept
  -- separate so it can never collide with production vision_features.
  add column if not exists sam_run_metadata      jsonb;

comment on column public.readings.vision_features_sam is
  'Phase 7.4 SAM harness: parallel vision feature JSON from the SAM2 segmentation branch. NULL = no SAM run. Never overwrites vision_features.';
comment on column public.readings.report_generated_sam is
  'Phase 7.4 SAM harness: report (same ReportJsonb shape as report_generated) generated from vision_features_sam. NULL = no SAM run. Never overwrites report_generated.';
comment on column public.readings.report_generated_sam_at is
  'Phase 7.4 SAM harness: timestamp of the last SAM report generation.';
comment on column public.readings.sam_run_metadata is
  'Phase 7.4 SAM harness: provenance of the SAM run (model_version, modal_call_id, source, triggered_by, error_summary).';
