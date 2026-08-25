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

/**
 * ⭐ 2026-08-25 — O ENDEREÇO SAIU DO PORTÃO DE ENTRADA.
 *
 * O cadastro pedia nome, e-mail, WhatsApp, CPF, especialidades e termos. Ao
 * entrar pela primeira vez, a pessoa era imediatamente desviada para uma
 * SEGUNDA tela de cadastro pedindo CEP, número, cidade e estado — e qualquer
 * tela que ela tentasse abrir virava essa. O endereço existe por dois motivos,
 * e os dois acontecem na hora de COMPRAR: emitir a nota fiscal e passar no
 * antifraude da operadora do cartão. Quem está na avaliação gratuita nunca
 * precisou dele, e ele estava barrando exatamente quem ainda não viu valor
 * nenhum: duas de oito contas recentes ficaram paradas nisso (2026-08-03).
 *
 *   'acesso' — usar o produto. WhatsApp, especialidades, termos e CPF.
 *              (o CPF fica: é o antifraude da própria avaliação gratuita, D-12)
 *   'compra' — comprar créditos. Tudo do 'acesso' MAIS o endereço.
 *
 * ⛔ Ao mexer aqui, mexer nos DOIS lados: o middleware avalia 'acesso' e a tela
 * de compra avalia 'compra'. Um gate só, dois contextos — nunca duas cópias da
 * regra, que foi como o texto dos Termos ficou 81 dias divergindo do sistema.
 */
export type GateContexto = 'acesso' | 'compra'

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
  contexto: GateContexto = 'acesso',
): TherapistGateResult {
  const missing: TherapistGap[] = []
  if (!nonEmpty(p.phone)) missing.push('phone')
  if (!Array.isArray(p.specialties) || p.specialties.length < 1)
    missing.push('specialties')
  if (!nonEmpty(p.tos_accepted_at)) missing.push('tos')
  if (!p.cpf || !isValidCpf(p.cpf)) missing.push('cpf') // Fase 8 D-12
  // Endereço completo: CEP (8 díg) + número + cidade + UF. city/state são
  // preenchidos pelo ViaCEP a partir do CEP. Sem isso, NF-e não emite e o
  // cartão é recusado — por isso ele é exigido na COMPRA, e só nela.
  if (contexto === 'compra' && !enderecoCompleto(p)) missing.push('address')

  if (missing.length > 0) return { status: 'incomplete', missing }
  return { status: 'ok' }
}

/** O endereço está completo o bastante pra emitir nota e passar no antifraude? */
export function enderecoCompleto(p: TherapistProfileInput): boolean {
  return (
    cepIsValidBR(p.cep ?? '') &&
    nonEmpty(p.address_number) &&
    nonEmpty(p.city) &&
    ufIsValidBR(p.state)
  )
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
