// Fonte ÚNICA de verdade da regra de completude de perfil + maioridade.
// Importado pelo Zod (app/actions/clients.ts) E pelo gate — zero drift.
// Pura, sem side-effects, sem 'use server' — unit-testável isolada.

export const MIN_AGE = 18 as const

export type ProfileGap =
  | 'full_name'
  | 'birth_date'
  | 'biological_sex'
  | 'email'
  | 'phone'

/** Shape mínimo aceito (a Row do DB é estruturalmente atribuível). */
export interface ProfileClientInput {
  full_name: string | null
  birth_date: string | null
  biological_sex: string | null
  email: string | null
  phone: string | null
}

export type ProfileGateResult =
  | { status: 'ok' }
  | { status: 'incomplete'; missing: ProfileGap[] }
  | { status: 'blocked_underage'; age: number; birthDate: string }

function nonEmpty(v: string | null | undefined): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

/** Parse 'YYYY-MM-DD' por partes inteiras — sem Date.parse (evita shift de
 *  timezone que corromperia a fronteira de maioridade). null se inválido. */
function parseYMD(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim())
  if (!m) return null
  return { y: +m[1], m: +m[2], d: +m[3] }
}

/**
 * Idade em anos completos por calendário (não divisão de ms — essa erra
 * fronteira por ano bissexto/aniversário). Retorna null se birth_date
 * ausente/inválido (→ "não dá pra saber" = incomplete, NÃO blocked).
 *
 * Fronteiras (cobertas em profile-completeness.test.ts):
 *  - nascido há exatamente 18 anos HOJE   → 18 → ≥ MIN_AGE → passa
 *  - aniversário de 18 é AMANHÃ (17a364d) → 17 → < MIN_AGE → bloqueia
 *  - bissexto 29/02 antes/depois de 01/03 → idade correta
 */
export function computeAge(
  birthDate: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!nonEmpty(birthDate)) return null
  const b = parseYMD(birthDate as string)
  if (!b) return null
  const nY = now.getFullYear()
  const nM = now.getMonth() + 1
  const nD = now.getDate()
  let age = nY - b.y
  if (nM < b.m || (nM === b.m && nD < b.d)) age--
  return age
}

export function isAdult(
  birthDate: string | null | undefined,
  now: Date = new Date(),
): boolean | null {
  const age = computeAge(birthDate, now)
  return age === null ? null : age >= MIN_AGE
}

/**
 * Avaliador puro. Precedência: blocked_underage (birth_date presente E
 * idade < 18) VENCE incomplete — caso irresolúvel, oferta de delete.
 * birth_date ausente → incomplete (não dá pra computar idade ainda).
 */
export function evaluateProfileCompleteness(
  client: ProfileClientInput,
  now: Date = new Date(),
): ProfileGateResult {
  const missing: ProfileGap[] = []
  if (!nonEmpty(client.full_name)) missing.push('full_name')
  if (!nonEmpty(client.birth_date)) missing.push('birth_date')
  if (!nonEmpty(client.biological_sex)) missing.push('biological_sex')
  if (!nonEmpty(client.email)) missing.push('email')
  if (!nonEmpty(client.phone)) missing.push('phone')

  if (nonEmpty(client.birth_date)) {
    const age = computeAge(client.birth_date, now)
    if (age !== null && age < MIN_AGE) {
      return {
        status: 'blocked_underage',
        age,
        birthDate: client.birth_date as string,
      }
    }
  }
  if (missing.length > 0) return { status: 'incomplete', missing }
  return { status: 'ok' }
}
