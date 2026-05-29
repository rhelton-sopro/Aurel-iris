/**
 * Flow server-side de assinatura do termo biométrico: lê o termo vigente +
 * INSERT append-only em client_consents (a trilha de auditoria jurídica,
 * imutável — 0020). NÃO toca clients aqui (current-pointer é atualizado pelo
 * caller signTermAction).
 *
 * Usa service-role (bypass RLS): o path remote_link (cliente em casa) não tem
 * sessão; o path office_handoff tem sessão de terapeuta mas o INSERT em
 * client_consents não tem policy pra authenticated (append-only via service).
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

/**
 * WR-02: client_consents.ip é Postgres `inet`. Um x-forwarded-for malformado
 * (ex. 'unknown', IPv6 com zone id, artefato de vírgula) faria o INSERT falhar
 * com 'invalid input syntax for type inet' e bloquearia TODA a assinatura do
 * termo — path LGPD-crítico. Coerção a null em vez de hard-fail: o IP é
 * evidência best-effort, não pode travar o consentimento legítimo.
 *
 * Aceita IPv4 (a.b.c.d com octetos 0-255) e IPv6 (heurística: contém ':' e só
 * caracteres hex/':'/'.'; sem zone id '%'). Qualquer coisa fora disso → null.
 */
export function sanitizeInet(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  // IPv4
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s)
  if (v4) {
    const ok = v4.slice(1).every((o) => {
      const n = Number(o)
      return n >= 0 && n <= 255 && String(n) === String(Number(o))
    })
    return ok ? s : null
  }
  // IPv6 (sem zone id): só hex, ':' e '.' (IPv4-mapped). Rejeita '%zone'.
  if (s.includes(':') && /^[0-9a-fA-F:.]+$/.test(s)) return s
  return null
}

export interface SignBiometricInput {
  client_id: string
  /** Nullable: consentimento a nível de cliente (consultório) não tem reading ainda. */
  reading_id?: string | null
  consent_channel:
    | 'office_handoff'
    | 'office_qr'
    | 'remote_link'
    | 'therapist_created'
  ip?: string | null
  user_agent?: string | null
  cpf_titular?: string | null
}

export type SignBiometricResult =
  | { ok: true; consent_id: string; term_version: string }
  | { ok: false; error: string }

export async function signBiometricTerm(
  input: SignBiometricInput,
): Promise<SignBiometricResult> {
  const service = createServiceClient()
  const { data: currentTerm, error: tErr } = await service
    .from('consent_terms')
    .select('version, content_sha256')
    .eq('is_current', true)
    .maybeSingle()
  if (tErr || !currentTerm) return { ok: false, error: 'no_current_term' }

  const { data: consent, error: cErr } = await service
    .from('client_consents')
    .insert({
      client_id: input.client_id,
      reading_id: input.reading_id ?? null,
      term_version: currentTerm.version,
      event_type: 'initial',
      consent_channel: input.consent_channel,
      ip: sanitizeInet(input.ip), // WR-02: coerção segura (inet) — nunca trava
      user_agent: input.user_agent ?? null,
    })
    .select('id')
    .single()
  if (cErr || !consent) {
    console.error('[consent] sign INSERT failed:', cErr?.message)
    return { ok: false, error: cErr?.message ?? 'INSERT failed' }
  }
  return { ok: true, consent_id: consent.id, term_version: currentTerm.version }
}
