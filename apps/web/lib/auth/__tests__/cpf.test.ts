import { describe, expect, it } from 'vitest'

import { cpfDigits, formatCpfBR, isValidCpf } from '../cpf'

describe('cpfDigits', () => {
  it('strips non-digits', () => {
    expect(cpfDigits('123.456.789-09')).toBe('12345678909')
    expect(cpfDigits('abc 12 def')).toBe('12')
  })
  it('handles null/undefined', () => {
    expect(cpfDigits(null)).toBe('')
    expect(cpfDigits(undefined)).toBe('')
  })
})

describe('formatCpfBR', () => {
  it('formats partial input as user types', () => {
    expect(formatCpfBR('123')).toBe('123')
    expect(formatCpfBR('1234')).toBe('123.4')
    expect(formatCpfBR('1234567')).toBe('123.456.7')
    expect(formatCpfBR('12345678909')).toBe('123.456.789-09')
  })
})

describe('isValidCpf', () => {
  it('rejects wrong length', () => {
    expect(isValidCpf('123')).toBe(false)
    expect(isValidCpf('1234567890')).toBe(false)
    expect(isValidCpf('123456789012')).toBe(false)
  })
  it('rejects repeated digits', () => {
    expect(isValidCpf('11111111111')).toBe(false)
    expect(isValidCpf('00000000000')).toBe(false)
    expect(isValidCpf('99999999999')).toBe(false)
  })
  it('rejects invalid checksum', () => {
    expect(isValidCpf('12345678900')).toBe(false)
    expect(isValidCpf('12345678910')).toBe(false)
  })
  it('accepts valid CPFs', () => {
    // Algoritmo aprovado em validation-br community + RESEARCH lines 697-718
    expect(isValidCpf('12345678909')).toBe(true)
    expect(isValidCpf('123.456.789-09')).toBe(true) // accept formatted
    expect(isValidCpf('00012345601')).toBe(true) // leading zeros (checksum válido)
  })
  it('handles null/undefined', () => {
    expect(isValidCpf(null)).toBe(false)
    expect(isValidCpf(undefined)).toBe(false)
    expect(isValidCpf('')).toBe(false)
  })
})
