// Fonte ÚNICA da regra de completude do perfil do TERAPEUTA (Cluster 2b).
// Mesmo molde de profile-completeness.ts (cliente). Pura, sem 'use server',
// unit-testável. Importada pelo middleware (GATE), pela página
// /perfil/completar e pela server action — zero drift.
//
// Distinto de profile-completeness.ts: aquele valida o EXAMINADO; este o
// TERAPEUTA (usuário da plataforma). tos = aceite dos Termos/Privacidade do
// terapeuta (profiles.tos_accepted_at), separado do consent do examinado.

export type TherapistGap = 'phone' | 'specialties' | 'tos'

export interface TherapistProfileInput {
  phone: string | null
  specialties: string[] | null
  tos_accepted_at: string | null
}

export type TherapistGateResult =
  | { status: 'ok' }
  | { status: 'incomplete'; missing: TherapistGap[] }

function nonEmpty(v: string | null | undefined): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * Avaliador puro. Incompleto se faltar telefone, ≥1 especialidade, ou aceite
 * dos Termos. Contas pré-Cluster-2 têm os três NULL → caem no GATE
 * (/perfil/completar) na primeira rota autenticada.
 */
export function evaluateTherapistProfile(
  p: TherapistProfileInput,
): TherapistGateResult {
  const missing: TherapistGap[] = []
  if (!nonEmpty(p.phone)) missing.push('phone')
  if (!Array.isArray(p.specialties) || p.specialties.length < 1)
    missing.push('specialties')
  if (!nonEmpty(p.tos_accepted_at)) missing.push('tos')

  if (missing.length > 0) return { status: 'incomplete', missing }
  return { status: 'ok' }
}
