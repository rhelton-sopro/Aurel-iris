// Pure CPF módulo-11 validation. Sem dep externa per RESEARCH §Don't Hand-Roll.
// Usable em client form mask + server zod schema + tests.

export function cpfDigits(v: string | null | undefined): string {
  return (v ?? '').replace(/\D/g, '')
}

export function formatCpfBR(v: string | null | undefined): string {
  const d = cpfDigits(v).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function isValidCpf(v: string | null | undefined): boolean {
  const clean = cpfDigits(v)
  if (clean.length !== 11) return false
  if (/^(\d)\1{10}$/.test(clean)) return false // 11111111111, 22222222222...

  // Primeiro dígito verificador
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i]!) * (10 - i)
  let mod = (sum * 10) % 11
  if (mod === 10) mod = 0
  if (mod !== parseInt(clean[9]!)) return false

  // Segundo dígito verificador
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i]!) * (11 - i)
  mod = (sum * 10) % 11
  if (mod === 10) mod = 0
  return mod === parseInt(clean[10]!)
}
