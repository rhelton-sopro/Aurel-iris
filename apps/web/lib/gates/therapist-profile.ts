// Fonte ÚNICA da regra de completude do perfil do TERAPEUTA (Cluster 2b).
// Mesmo molde de profile-completeness.ts (cliente). Pura, sem 'use server',
// unit-testável. Importada pelo middleware (GATE), pela página
// /perfil/completar e pela server action — zero drift.
//
// Distinto de profile-completeness.ts: aquele valida o EXAMINADO; este o
// TERAPEUTA (usuário da plataforma). tos = aceite dos Termos/Privacidade do
// terapeuta (profiles.tos_accepted_at), separado do consent do examinado.

import { isValidCpf } from '@/lib/auth/cpf'
import { cepIsValidBR, ufIsValidBR } from '@/lib/profile/fields'

export type TherapistGap = 'phone' | 'specialties' | 'tos' | 'cpf' | 'address'

export interface TherapistProfileInput {
  phone: string | null
  specialties: string[] | null
  tos_accepted_at: string | null
  cpf: string | null // Fase 8 (D-12): CPF anti-fraud trial obrigatório
  // Fase 8 (endereço): obrigatório p/ NF-e + antifraude de cartão Asaas.
  // CEP + número são digitados; city/state vêm do ViaCEP (autofill).
  cep: string | null
  address_number: string | null
  city: string | null
  state: string | null
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
  if (!p.cpf || !isValidCpf(p.cpf)) missing.push('cpf') // Fase 8 D-12
  // Endereço completo: CEP (8 díg) + número + cidade + UF. city/state são
  // preenchidos pelo ViaCEP a partir do CEP; se faltarem, o cadastro ficou
  // incompleto. Sem isso, NF-e não emite e o cartão é recusado pelo Asaas.
  if (
    !cepIsValidBR(p.cep ?? '') ||
    !nonEmpty(p.address_number) ||
    !nonEmpty(p.city) ||
    !ufIsValidBR(p.state)
  )
    missing.push('address')

  if (missing.length > 0) return { status: 'incomplete', missing }
  return { status: 'ok' }
}

/**
 * Rótulo de cada lacuna, na voz de quem lê a tela.
 *
 * ⭐ Existe porque o gate SABIA o que faltava e a tela não mostrava (2026-08-03): a pessoa
 * era devolvida para "Complete seu cadastro" a cada navegação, sem descobrir qual campo
 * estava travando. Caso real: a Juliana só devia o ENDEREÇO, mas via o formulário inteiro
 * de novo e concluía que o cadastro não salvava. Duas de oito contas recentes estavam
 * paradas exatamente assim.
 */
export const THERAPIST_GAP_LABEL: Record<TherapistGap, string> = {
  phone: 'WhatsApp',
  specialties: 'suas especialidades',
  tos: 'o aceite dos termos',
  cpf: 'o CPF',
  address: 'o endereço (CEP, número, cidade e estado)',
}

/** "o endereço" · "o CPF e o endereço" · "o CPF, o endereço e o WhatsApp" */
export function describeGaps(missing: TherapistGap[]): string {
  const t = missing.map((m) => THERAPIST_GAP_LABEL[m])
  if (t.length <= 1) return t[0] ?? ''
  return t.slice(0, -1).join(', ') + ' e ' + t[t.length - 1]
}
