// Fonte ÚNICA dos campos novos do cadastro de terapeuta (Cluster 2b).
// Pura, sem 'use server', sem side-effects — usada por signup, /perfil/completar
// e pelo gate. Zero drift entre form e validação.

export const OTHER = 'Outro' as const

// Lista FIXA (15, ordem e grafia travadas — decisão founder). "Outro" é a
// última e abre texto livre que SUBSTITUI o literal no array salvo.
export const SPECIALTIES = [
  'Iridologia',
  'Hipnose / Hipnoterapia',
  'Constelação Familiar',
  'Reiki',
  'Florais',
  'Naturopatia',
  'Acupuntura / MTC',
  'Aromaterapia',
  'Biomagnetismo',
  'Cromoterapia',
  'Psicologia / Psicoterapia',
  'Coaching / PNL',
  'Práticas Corporais',
  'Tarot / Oráculos',
  OTHER,
] as const

export const MAX_SPECIALTIES = 3 as const

/**
 * Monta o array final salvo em profiles.specialties: troca o literal "Outro"
 * pelo texto livre digitado (trim). Sem o literal "Outro" no resultado.
 * Retorna null se nada selecionado (deixa o gate tratar como incompleto).
 */
export function buildSpecialties(
  selected: string[],
  otherText: string,
): string[] {
  const out: string[] = []
  for (const s of selected) {
    if (s === OTHER) {
      const t = otherText.trim()
      if (t) out.push(t)
    } else if (s.trim()) {
      out.push(s)
    }
  }
  return out
}

/** Só dígitos. */
export function phoneDigits(v: string): string {
  return (v || '').replace(/\D/g, '')
}

/** Máscara BR progressiva: (99) 99999-9999 (11) ou (99) 9999-9999 (10). */
export function formatPhoneBR(v: string): string {
  const d = phoneDigits(v).slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** BR válido = 10 (fixo) ou 11 (celular) dígitos. */
export function phoneIsValidBR(v: string): boolean {
  const n = phoneDigits(v).length
  return n === 10 || n === 11
}

// ── Endereço (Fase 8 — NF-e + antifraude cartão Asaas) ──────────────────────

/** Só dígitos do CEP. */
export function cepDigits(v: string): string {
  return (v || '').replace(/\D/g, '').slice(0, 8)
}

/** Máscara 99999-999. */
export function formatCepBR(v: string): string {
  const d = cepDigits(v)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

/** CEP válido = 8 dígitos. */
export function cepIsValidBR(v: string): boolean {
  return cepDigits(v).length === 8
}

/** UF brasileira válida (2 letras). */
const UFS = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
])
export function ufIsValidBR(v: string | null | undefined): boolean {
  return typeof v === 'string' && UFS.has(v.trim().toUpperCase())
}
