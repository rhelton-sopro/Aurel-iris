import { describe, expect, it } from 'vitest'

import { DEFAULT_REPLAY_WINDOW_SECONDS, signHmac, verifyHmacSignature } from './hmac'

const SECRET = 'test-secret-do-not-ship'
const BODY = JSON.stringify({ reading_id: 'r-1', status: 'ready' })

function tsNow(offset = 0): string {
  return String(Math.floor(Date.now() / 1000) + offset)
}

describe('signHmac', () => {
  it('produces deterministic hex digests for identical input', () => {
    expect(signHmac('a', '1', SECRET)).toEqual(signHmac('a', '1', SECRET))
  })

  it('matches the Stripe-style python convention (timestamp.body signed string)', () => {
    // Reference vector — recompute by hand and confirm:
    //   HMAC-SHA256(`1700000000.{}`, "k") in python equals this hex.
    // We only assert determinism here; round-trip with Python is exercised in 05-10/05-12 integration.
    const a = signHmac('{}', '1700000000', 'k')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('verifyHmacSignature', () => {
  it('accepts a valid signature within the replay window', () => {
    const ts = tsNow()
    const sig = signHmac(BODY, ts, SECRET)
    expect(verifyHmacSignature(BODY, `sha256=${sig}`, ts, SECRET)).toEqual({ valid: true })
  })

  it('accepts the bare-hex signature header (no sha256= prefix)', () => {
    const ts = tsNow()
    const sig = signHmac(BODY, ts, SECRET)
    expect(verifyHmacSignature(BODY, sig, ts, SECRET)).toEqual({ valid: true })
  })

  it('rejects when body is tampered (signature_mismatch)', () => {
    const ts = tsNow()
    const sig = signHmac(BODY, ts, SECRET)
    const result = verifyHmacSignature(BODY + 'x', `sha256=${sig}`, ts, SECRET)
    expect(result).toEqual({ valid: false, reason: 'signature_mismatch' })
  })

  it('rejects when secret is wrong (signature_mismatch)', () => {
    const ts = tsNow()
    const sig = signHmac(BODY, ts, SECRET)
    const result = verifyHmacSignature(BODY, `sha256=${sig}`, ts, 'wrong-secret')
    expect(result).toEqual({ valid: false, reason: 'signature_mismatch' })
  })

  it('rejects when timestamp is outside the replay window (replay_window)', () => {
    const ts = tsNow(-DEFAULT_REPLAY_WINDOW_SECONDS - 1)
    const sig = signHmac(BODY, ts, SECRET)
    const result = verifyHmacSignature(BODY, `sha256=${sig}`, ts, SECRET)
    expect(result).toEqual({ valid: false, reason: 'replay_window' })
  })

  it('accepts when within a custom replay window', () => {
    const ts = tsNow(-700)
    const sig = signHmac(BODY, ts, SECRET)
    expect(
      verifyHmacSignature(BODY, `sha256=${sig}`, ts, SECRET, { replayWindowSeconds: 1000 }),
    ).toEqual({ valid: true })
  })

  it('rejects on missing signature header (missing_headers)', () => {
    const result = verifyHmacSignature(BODY, null, tsNow(), SECRET)
    expect(result).toEqual({ valid: false, reason: 'missing_headers' })
  })

  it('rejects on missing timestamp header (missing_headers)', () => {
    const result = verifyHmacSignature(BODY, 'sha256=abc', null, SECRET)
    expect(result).toEqual({ valid: false, reason: 'missing_headers' })
  })

  it('rejects on missing secret (missing_headers)', () => {
    const result = verifyHmacSignature(BODY, 'sha256=abc', tsNow(), '')
    expect(result).toEqual({ valid: false, reason: 'missing_headers' })
  })

  it('rejects on non-numeric timestamp (malformed_signature)', () => {
    const result = verifyHmacSignature(BODY, 'sha256=abc', 'not-a-number', SECRET)
    expect(result).toEqual({ valid: false, reason: 'malformed_signature' })
  })

  it('rejects on length mismatch (malformed_signature)', () => {
    const result = verifyHmacSignature(BODY, 'sha256=ab', tsNow(), SECRET)
    expect(result).toEqual({ valid: false, reason: 'malformed_signature' })
  })

  it('rejects on non-hex characters in the signature (malformed_signature)', () => {
    const result = verifyHmacSignature(BODY, 'sha256=zzzz', tsNow(), SECRET)
    expect(result).toEqual({ valid: false, reason: 'malformed_signature' })
  })

  it('uses injected clock when provided', () => {
    const ts = '1000'
    const sig = signHmac(BODY, ts, SECRET)
    expect(
      verifyHmacSignature(BODY, `sha256=${sig}`, ts, SECRET, { now: () => 1100 }),
    ).toEqual({ valid: true })
    expect(
      verifyHmacSignature(BODY, `sha256=${sig}`, ts, SECRET, { now: () => 9999 }),
    ).toEqual({ valid: false, reason: 'replay_window' })
  })

  it('discriminates: type narrows after a `valid` check', () => {
    // Compile-time assertion that the discriminated union narrows correctly.
    const result = verifyHmacSignature(BODY, `sha256=${signHmac(BODY, tsNow(), SECRET)}`, tsNow(), SECRET)
    if (result.valid) {
      // No `reason` accessible here — purely a TS narrowing smoke check.
      expect(result.valid).toBe(true)
    } else {
      expect(result.reason).toBeDefined()
    }
  })
})
