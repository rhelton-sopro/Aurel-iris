/**
 * Timing-safe shared-secret verification for the Asaas webhook.
 *
 * Asaas authenticates webhooks with a simple shared secret in the
 * `asaas-access-token` header (NOT an HMAC of the request body). That is a
 * different contract from lib/vision/hmac.ts, so this lives in its own file
 * instead of being shoehorned into the HMAC helper (RESEARCH §HMAC).
 *
 * Server-only — depends on `node:crypto`. Never import from a client component.
 *
 * Returns a discriminated union so the webhook handler can log the precise
 * rejection cause (misconfigured vs missing vs invalid) without a bare-boolean
 * consumer bug.
 */
import 'server-only'
import { timingSafeEqual } from 'node:crypto'

export type AsaasWebhookAuthResult =
  | { valid: true }
  | { valid: false; reason: 'missing_token' | 'invalid_token' | 'misconfigured' }

export function verifyAsaasToken(
  providedHeader: string | null | undefined,
  expectedSecret: string | undefined,
): AsaasWebhookAuthResult {
  if (!expectedSecret) return { valid: false, reason: 'misconfigured' }
  if (!providedHeader) return { valid: false, reason: 'missing_token' }

  const a = Buffer.from(providedHeader)
  const b = Buffer.from(expectedSecret)
  // Length mismatch leaks length (not the secret bytes) — acceptable since
  // Asaas tokens are fixed-length 32-255 chars (RESEARCH).
  if (a.length !== b.length) return { valid: false, reason: 'invalid_token' }
  if (!timingSafeEqual(a, b)) return { valid: false, reason: 'invalid_token' }
  return { valid: true }
}
