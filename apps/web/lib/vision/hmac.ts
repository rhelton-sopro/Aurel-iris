/**
 * HMAC-SHA256 helpers for the Modal -> Next.js webhook callback.
 *
 * Convention (matches the Python signer in vision-service/modal_app.py):
 *   - Header `X-Modal-Signature`: value `sha256=<hex>` (lowercase hex digest).
 *   - Header `X-Modal-Timestamp`: unix epoch seconds (string).
 *   - Signed string: `${timestamp}.${rawBody}` (literal dot separator).
 *
 * Server-only — depends on `node:crypto`. Never import from a client component.
 *
 * Return shape: `verifyHmacSignature` returns a discriminated union so the
 * webhook handler can log a precise rejection cause (e.g. `replay_window`
 * vs `signature_mismatch`) without sacrificing type safety. A bare boolean
 * return invites the `if (!result.valid)` consumer bug where `result` is
 * the boolean and `.valid` is `undefined`.
 */
import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

/** Default replay window: ±5 minutes. Aligns with RESEARCH.md A8. */
export const DEFAULT_REPLAY_WINDOW_SECONDS = 300

export type HmacVerificationResult =
  | { valid: true }
  | {
      valid: false
      reason:
        | 'missing_headers'
        | 'replay_window'
        | 'signature_mismatch'
        | 'malformed_signature'
    }

export interface VerifyOptions {
  /** Override the replay window for tests. Defaults to DEFAULT_REPLAY_WINDOW_SECONDS. */
  replayWindowSeconds?: number
  /** Inject a clock for deterministic tests (returns unix-epoch seconds). */
  now?: () => number
}

/**
 * Computes the lowercase-hex HMAC-SHA256 of `${timestamp}.${body}`.
 * Mirrors hashlib.hmac in vision-service/modal_app.py.
 */
export function signHmac(body: string, timestamp: string, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

/**
 * Verifies an incoming Modal webhook signature.
 *
 * Returns `{ valid: true }` only when ALL of the following hold:
 *   - `signatureHeader` is present and parses as `sha256=<hex>` of the same length as the expected digest.
 *   - `timestampHeader` is a numeric unix-epoch seconds string.
 *   - |now - timestamp| <= replayWindowSeconds.
 *   - HMAC-SHA256 of `${timestamp}.${rawBody}` keyed by `secret` equals the provided hex (timing-safe).
 *
 * Otherwise returns `{ valid: false, reason: ... }` so the caller can log the cause.
 */
export function verifyHmacSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  timestampHeader: string | null | undefined,
  secret: string,
  options: VerifyOptions = {},
): HmacVerificationResult {
  if (!signatureHeader || !timestampHeader || !secret) {
    return { valid: false, reason: 'missing_headers' }
  }

  const ts = Number.parseInt(timestampHeader, 10)
  if (!Number.isFinite(ts)) {
    return { valid: false, reason: 'malformed_signature' }
  }

  const window = options.replayWindowSeconds ?? DEFAULT_REPLAY_WINDOW_SECONDS
  const now = options.now ? options.now() : Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > window) {
    return { valid: false, reason: 'replay_window' }
  }

  const prefix = 'sha256='
  const provided = signatureHeader.startsWith(prefix)
    ? signatureHeader.slice(prefix.length)
    : signatureHeader

  if (!/^[0-9a-f]+$/i.test(provided)) {
    return { valid: false, reason: 'malformed_signature' }
  }

  const expected = signHmac(rawBody, timestampHeader, secret)
  const expectedBuf = Buffer.from(expected, 'hex')
  const providedBuf = Buffer.from(provided.toLowerCase(), 'hex')
  if (expectedBuf.length === 0 || expectedBuf.length !== providedBuf.length) {
    return { valid: false, reason: 'malformed_signature' }
  }

  const equal = timingSafeEqual(expectedBuf, providedBuf)
  if (!equal) {
    return { valid: false, reason: 'signature_mismatch' }
  }
  return { valid: true }
}
