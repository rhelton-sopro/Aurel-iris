// Single source of truth for the founder identity check. Used by:
//   - middleware.ts (route-level gate at /admin/*)
//   - app/admin/layout.tsx (defense-in-depth at server component layer)
//   - app/actions/calibration.ts (defense-in-depth at server action layer)
//
// Fail-closed semantics: if FOUNDER_EMAIL env is unset (e.g., misconfigured
// deploy), no one is founder — middleware blocks /admin/* universally.
import 'server-only'

export const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL ?? ''

export function isFounderEmail(email: string | null | undefined): boolean {
  if (!FOUNDER_EMAIL) return false
  if (!email) return false
  return email.toLowerCase().trim() === FOUNDER_EMAIL.toLowerCase().trim()
}
