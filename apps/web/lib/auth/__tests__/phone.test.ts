import { describe, expect, it } from 'vitest'

import { phoneDigits } from '../phone'

describe('phoneDigits (CR-01)', () => {
  it('strips formatting characters', () => {
    expect(phoneDigits('(47) 99999-9999')).toBe('47999999999')
  })

  it('strips the + from E.164', () => {
    expect(phoneDigits('+55 47 99999-9999')).toBe('5547999999999')
  })

  it('handles already-digit input', () => {
    expect(phoneDigits('47999999999')).toBe('47999999999')
  })

  it('null/undefined → empty string', () => {
    expect(phoneDigits(null)).toBe('')
    expect(phoneDigits(undefined)).toBe('')
  })
})
