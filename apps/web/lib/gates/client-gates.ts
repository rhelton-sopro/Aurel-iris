// Composição de pré-condições de cliente. HOJE só profile-completeness;
// Fase 2 pluga consent-gate AQUI, mesma forma de retorno. Pura/testável —
// o side-effect (redirect) fica na fronteira da rota, não aqui.

import type { ProfileClientInput, ProfileGap } from './profile-completeness'
import { evaluateProfileCompleteness } from './profile-completeness'

export interface ClientGateInput extends ProfileClientInput {
  id: string
}

export type ClientGate =
  | { status: 'ok' }
  | { status: 'incomplete'; missing: ProfileGap[]; completionPath: string }
  | {
      status: 'blocked_underage'
      age: number
      birthDate: string
      detailPath: string
    }

export function resolveClientGate(
  client: ClientGateInput,
  opts: { now?: Date } = {},
): ClientGate {
  const profile = evaluateProfileCompleteness(client, opts.now)

  if (profile.status === 'blocked_underage') {
    return {
      status: 'blocked_underage',
      age: profile.age,
      birthDate: profile.birthDate,
      detailPath: `/clientes/${client.id}`, // painel de bloqueio renderiza aqui
    }
  }
  if (profile.status === 'incomplete') {
    return {
      status: 'incomplete',
      missing: profile.missing,
      completionPath: `/clientes/${client.id}/editar?motivo=completar`,
    }
  }

  // ── Fase 2 seam (NÃO implementar agora) ──────────────────────────────
  // Se profile ok mas consentimento pendente/reconfirm:
  //   const consent = evaluateConsent(client, currentTerm, opts.now)
  //   if (consent !== 'valid') return { status: 'needs_consent', ... }
  // Mesma forma de retorno; consumidores tratam igual.

  return { status: 'ok' }
}
