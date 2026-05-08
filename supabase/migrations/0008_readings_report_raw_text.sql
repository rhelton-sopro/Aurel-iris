-- ============================================================================
-- Migration 0008 — readings.report_raw_text (defensive raw stream capture)
--
-- Bug surfaced 2026-05-08 dogfooding (leitura 71a7bf1d-747f-4de8-9129-13b69197c6a4):
-- Phase 7 LLM stream completed (~5min, ~$0.30) but parser found 0 boundaries
-- (`^### N. ` regex did not match Sonnet's output). Result: report_generated
-- jsonb persisted with only `encerramento_disclaimer` (server-appended); 12 of
-- 13 sections lost. Without raw capture we cannot diagnose why parser missed.
--
-- This column captures the full accumulated buffer pre-parse so the next failure
-- is debuggable. Always populated alongside report_generated; nullable for
-- pre-existing rows + error paths that abort before any text arrives.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.
-- ============================================================================

alter table readings
  add column if not exists report_raw_text text;

comment on column readings.report_raw_text is
  'Full LLM stream buffer captured pre-parse. Defensive — used when parser misses section boundaries. Phase 7 dogfooding 2026-05-08.';
