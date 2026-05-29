import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

export type TermoGateResult =
  | { ok: true; signed_at: string; term_version: string | null }
  | { ok: false; reason: 'termo_missing' | 'client_not_found' | 'db_error'; detail?: string }

/**
 * BILLING-03 + LGPD-01 (D-19) — gate que bloqueia captura biométrica sem termo
 * assinado.
 *
 * Source of truth: o current-pointer LIVE `clients.consent_last_at` (+
 * `consent_current_version`). Setado por signTermAction (08-08, path
 * office_handoff) e por signInviteTermAction (08-15 A+, path remote_link)
 * quando o cliente/terapeuta assina o termo.
 *
 * NOTA DE SCHEMA (importante): o plano 08-15 original lia
 * `clients.consent_signed_at` / `consent_document_url`, mas essas colunas FORAM
 * DROPADAS na migration 0019 ("letra morta — nunca escrita/lida"). O pointer
 * vivo é `consent_current_version` + `consent_last_at` (0019/0020). Ler as
 * colunas antigas seria erro PostgREST em runtime. Ver
 * 08-08-SUMMARY.md deviation #1.
 *
 * NÃO consulta client_consents direto — esse table é append-only e pode ter
 * rows revoke/etc. O current-pointer em `clients` é o snapshot operacional.
 *
 * Caller convention: SE { ok: false, reason: 'termo_missing' }, a UI deve
 * oferecer link/CTA pra assinatura do termo (TermoBiometricoStep 08-08 no path
 * office; passo de termo do convite no path remote_link) com o clientId.
 */
export async function assertClientTermoSigned(clientId: string): Promise<TermoGateResult> {
  const service = createServiceClient()
  const { data, error } = await service
    .from('clients')
    .select('consent_last_at, consent_current_version')
    .eq('id', clientId)
    .maybeSingle()

  if (error) {
    console.error(`[termo-gate] db error client=${clientId}:`, error.message)
    return { ok: false, reason: 'db_error', detail: error.message }
  }
  if (!data) {
    return { ok: false, reason: 'client_not_found' }
  }
  if (!data.consent_last_at) {
    return { ok: false, reason: 'termo_missing' }
  }
  return {
    ok: true,
    signed_at: data.consent_last_at,
    term_version: data.consent_current_version ?? null,
  }
}
