// Single source of truth for the founder identity check. Used by:
//   - middleware.ts (route-level gate at /admin/*)
//   - app/admin/layout.tsx (defense-in-depth at server component layer)
//   - app/actions/calibration.ts (defense-in-depth at server action layer)
//
// FOUNDER_EMAIL aceita UM e-mail ou uma LISTA separada por vírgula:
//   FOUNDER_EMAIL="a@x.com,b@y.com"
// Founder é acesso TOTAL ao /admin — inclui a exclusão irreversível de terapeuta
// (conta, clientes, leituras e fotos) e a caixa de suporte com dado de cliente.
// Não há papel intermediário: mantenha a lista curta e explícita.
//
// Fail-closed semantics: if FOUNDER_EMAIL env is unset (e.g., misconfigured
// deploy), no one is founder — middleware blocks /admin/* universally.
import 'server-only'

export const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL ?? ''

/** E-mails com papel de founder, normalizados. Lista vazia = ninguém passa. */
export const FOUNDER_EMAILS: readonly string[] = FOUNDER_EMAIL.split(',')
  .map((e) => e.toLowerCase().trim())
  .filter(Boolean)

export function isFounderEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const candidate = email.toLowerCase().trim()
  if (!candidate) return false
  return FOUNDER_EMAILS.includes(candidate)
}
