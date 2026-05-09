-- ============================================================================
-- Migration 0011 — fix RLS policies on calibration_* tables (auth.jwt vs auth.users)
--
-- Bug em 0009 + 0010: as policies usam subquery em auth.users:
--   using ((select email from auth.users where id = auth.uid()) = 'rhelton@gmail.com')
-- A role 'authenticated' NÃO tem SELECT permission no schema auth, então
-- saveAnnotation / saveCalibrationDiagnosis falham com "permission denied for
-- table users" ao tentar UPSERT.
--
-- Fix: usar auth.jwt() ->> 'email' que lê o email direto do JWT em memória,
-- sem tocar auth.users. Funciona para Supabase magic-link / password auth
-- onde email é claim top-level do JWT.
--
-- Idempotente: drop policy if exists + create policy. Re-runs safe.
-- ============================================================================

-- ── calibration_annotations (0009) ─────────────────────────────────────────
drop policy if exists "founder_full_access" on calibration_annotations;
create policy "founder_full_access"
  on calibration_annotations
  for all
  to authenticated
  using ((auth.jwt() ->> 'email') = 'rhelton@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'rhelton@gmail.com');

-- ── calibration_diagnoses (0010) ───────────────────────────────────────────
drop policy if exists "founder_full_access" on calibration_diagnoses;
create policy "founder_full_access"
  on calibration_diagnoses
  for all
  to authenticated
  using ((auth.jwt() ->> 'email') = 'rhelton@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'rhelton@gmail.com');

-- ============================================================================
-- Note: defesa em profundidade preservada
--   - middleware.ts é o gate primário em /admin/* (TypeScript)
--   - app/admin/layout.tsx chama notFound() se isFounderEmail falha
--   - server actions chamam isFounderEmail antes de qualquer write
--   - RLS é a 4ª camada — agora funcional, antes estava sempre throwing
-- ============================================================================
