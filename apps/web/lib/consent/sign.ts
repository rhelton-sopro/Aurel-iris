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

export interface SignBiometricInput {
  client_id: string
  reading_id: string
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
      reading_id: input.reading_id,
      term_version: currentTerm.version,
      event_type: 'initial',
      consent_channel: input.consent_channel,
      ip: input.ip ?? null,
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
