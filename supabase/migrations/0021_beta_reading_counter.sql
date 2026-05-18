-- 0021_beta_reading_counter.sql
--
-- Beta launch: deletion-proof 2-reading cap.
--
-- Counting live `readings` rows is bypassable by deleting a finished reading.
-- The robust + RLS-safe model is a MONOTONIC counter on the therapist's own
-- `profiles` row (the therapist can self-read profiles; `report_generations`
-- is founder-only RLS so it cannot back the cap, and it has no therapist_id).
--
--   - profiles.beta_readings_used : monotonic tally, +1 per reading at its
--     first pending→ready transition, NEVER decremented (delete-proof).
--   - readings.beta_counted       : compare-and-set guard so the increment
--     fires EXACTLY ONCE per reading (idempotent vs reprocess / regen /
--     double-fire / concurrent /process calls).
--   - increment_beta_readings_used(uuid) : atomic `col = col + 1` (security
--     definer; called from the /process route via the service client).
--
-- Strictly additive + idempotent. No backfill: pre-existing readings keep
-- beta_counted=false and are already past 'pending' (the /process route is
-- not retriggerable for status='ready'), so they never count — beta accounts
-- start clean at 0. Division of labor: Claude authored; the founder applies
-- it (supabase db push / dashboard SQL) — same pattern as 0016/0017/0020.

alter table public.profiles
  add column if not exists beta_readings_used integer not null default 0;

alter table public.readings
  add column if not exists beta_counted boolean not null default false;

create or replace function public.increment_beta_readings_used(p_therapist uuid)
returns void
language sql
security definer set search_path = ''
as $$
  update public.profiles
     set beta_readings_used = beta_readings_used + 1
   where id = p_therapist;
$$;

comment on column public.profiles.beta_readings_used is
  'Beta cap: contagem monotônica de leituras consumidas (+1 por leitura na 1ª transição pending→ready; nunca decrementa — deletion-proof).';
comment on column public.readings.beta_counted is
  'Beta cap: true depois que esta leitura incrementou profiles.beta_readings_used (compare-and-set para exatamente-uma-vez).';
