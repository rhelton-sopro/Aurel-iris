import { describe, expect, it } from 'vitest'
import { verifyAsaasToken } from '../webhook-auth'

describe('verifyAsaasToken', () => {
  it('returns misconfigured when secret env missing', () => {
    expect(verifyAsaasToken('abc', undefined)).toEqual({ valid: false, reason: 'misconfigured' })
  })
  it('returns missing_token when header absent', () => {
    expect(verifyAsaasToken(null, 'secret')).toEqual({ valid: false, reason: 'missing_token' })
    expect(verifyAsaasToken(undefined, 'secret')).toEqual({ valid: false, reason: 'missing_token' })
  })
  it('returns invalid_token on mismatch', () => {
    expect(verifyAsaasToken('wrong', 'secret')).toEqual({ valid: false, reason: 'invalid_token' })
  })
  it('returns invalid_token on length mismatch', () => {
    expect(verifyAsaasToken('short', 'much-longer-secret')).toEqual({ valid: false, reason: 'invalid_token' })
  })
  it('returns valid on exact match', () => {
    expect(verifyAsaasToken('secret123', 'secret123')).toEqual({ valid: true })
  })
})
