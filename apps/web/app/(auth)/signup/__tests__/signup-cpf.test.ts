import { describe, expect, it } from 'vitest'
import { isValidCpf, cpfDigits, formatCpfBR } from '@/lib/auth/cpf'

// Cobertura dos helpers puros usados no signup + /perfil/completar.
// A integração de UI (form → metadata → trigger → dedup 23505) é validada
// pelo smoke checkpoint (Task 4) contra o sandbox Asaas/Supabase real.
describe('signup CPF helpers', () => {
  it('cpfDigits strips formatting', () => {
    expect(cpfDigits('123.456.789-09')).toBe('12345678909')
    expect(cpfDigits(null)).toBe('')
  })

  it('formatCpfBR masks live', () => {
    expect(formatCpfBR('12345')).toMatch(/^123\.45/)
    expect(formatCpfBR('12345678909')).toBe('123.456.789-09')
  })

  it('rejects all-equal digits (LGPD-friendly false-CPF)', () => {
    expect(isValidCpf('11111111111')).toBe(false)
    expect(isValidCpf('00000000000')).toBe(false)
  })

  it('rejects wrong-length / non-numeric', () => {
    expect(isValidCpf('123')).toBe(false)
    expect(isValidCpf('')).toBe(false)
    expect(isValidCpf(null)).toBe(false)
  })

  it('accepts known-valid CPF', () => {
    expect(isValidCpf('12345678909')).toBe(true)
    expect(isValidCpf('123.456.789-09')).toBe(true)
  })
})
