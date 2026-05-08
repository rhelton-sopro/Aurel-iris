/**
 * POST /api/vision/webhook
 *
 * Modal worker callback. The worker POSTs full SPEC §4.3 features JSON here
 * with Stripe-style HMAC headers after `run_pipeline` finishes (or fails).
 *
 * Contract:
 *   - 401: HMAC missing / mismatch / malformed / replay (>300s skew).
 *   - 400: body shape invalid (Zod envelope failure).
 *   - 200 (success): atomic UPDATE applied; revalidatePath('/leituras') called.
 *   - 200 (no-op):   reading not found OR status guard rejects (status != 'processing').
 *
 * Idempotency strategy:
 *   - PRIMARY barrier: status guard — only `status='processing'` accepts the UPDATE.
 *     Late retries from Modal find `status='ready'` or `'failed'` and no-op.
 *     Phase 7 edits move status to `'edited'` and write to `report_delivered`
 *     jsonb (the legacy `ai_report_edited` text view is now a GENERATED column
 *     reconstructed from report_delivered — see migration 0007).
 *   - DEFENSE-IN-DEPTH: warn-log on stored modal_call_id mismatch (D-T5) but
 *     proceed — status guard is primary. This avoids brittleness if the
 *     trigger route's placeholder/replacement sequence (D-T5) is ever
 *     interrupted mid-flight.
 *
 * Honors:
 *   - D-T4 / D-F4 status guard for idempotency.
 *   - D-T5 modal_call_id defense-in-depth.
 *   - D-F5 / D-PM2 atomic single-UPDATE (vision_features + status + processed_at).
 *   - D-T2 revalidatePath('/leituras') on success — no client polling.
 *   - D-F1 per-eye soft degradation: payload with one eye null is accepted as
 *     `status='ready'`; vision-service is the authority on degradation logic.
 *
 * Security:
 *   - HMAC verification via `verifyHmacSignature` (timing-safe — see 05-02).
 *   - `request.text()` is read FIRST so HMAC sees the original bytes (Pitfall 3).
 *   - Service-role client is used ONLY for the final UPDATE (RLS bypass —
 *     request originates from Modal, not the terapeuta's session).
 */
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createServiceClient } from '@/lib/supabase/service'
import { verifyHmacSignature } from '@/lib/vision/hmac'

export const runtime = 'nodejs'

// Stripe convention — 5-minute replay window
const REPLAY_WINDOW_SECONDS = 300

// Status guard whitelist — D-T4
const STATUS_PROCESSING = 'processing'

// Zod envelope validates the OUTER shape; the `vision_features` object is
// passthrough because Pydantic IrisFeatures (vision-service) is the schema
// authority for the inner object. Re-validating SPEC §4.3 here would
// duplicate the contract and create a mismatch surface.
//
// `vision_features` is OPTIONAL at the type level (B3): the failed-path
// payload from 05-10 always includes it, but the wire contract treats it as
// legitimately optional in case future failure modes omit it entirely. A
// `superRefine` rule REQUIRES `vision_features` when `status='ready'` so
// success-path callers can't accidentally send a body that would store
// `null` features and break the listing tooltip.
const webhookEnvelopeSchema = z
  .object({
    reading_id: z.string().uuid(),
    modal_call_id: z.string().min(1),
    status: z.enum(['ready', 'failed']),
    vision_features: z.record(z.string(), z.unknown()).optional(), // passthrough; vision-service validates internals
  })
  .superRefine((value, ctx) => {
    if (value.status === 'ready' && !value.vision_features) {
      ctx.addIssue({
        code: 'custom',
        path: ['vision_features'],
        message: 'vision_features is required when status is "ready"',
      })
    }
  })

type WebhookEnvelope = z.infer<typeof webhookEnvelopeSchema>

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request): Promise<NextResponse> {
  // 1. Read raw body BEFORE JSON parse — required for HMAC (Pitfall 3).
  const rawBody = await request.text()

  // 2. HMAC + replay verification.
  const sigHeader = request.headers.get('x-modal-signature')
  const tsHeader = request.headers.get('x-modal-timestamp')
  const secret = process.env.MODAL_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhook] MODAL_WEBHOOK_SECRET is not set')
    return jsonError('Server misconfigured', 500)
  }

  // B1: `verifyHmacSignature` returns the discriminated union
  // `{ valid: true } | { valid: false; reason: ... }` from 05-02. Read
  // `result.valid` directly — never coerce `result` to boolean.
  const result = verifyHmacSignature(
    rawBody,
    sigHeader,
    tsHeader,
    secret,
    { replayWindowSeconds: REPLAY_WINDOW_SECONDS },
  )
  if (!result.valid) {
    // Log the rejection cause for debuggability (replay_window vs
    // signature_mismatch vs malformed_signature vs missing_headers).
    console.warn(`[webhook] hmac rejected: ${result.reason}`)
    return jsonError('Invalid signature', 401)
  }

  // 3. Body shape validation.
  let parsed: WebhookEnvelope
  try {
    const json = JSON.parse(rawBody) as unknown
    const parseResult = webhookEnvelopeSchema.safeParse(json)
    if (!parseResult.success) {
      console.warn('[webhook] Body shape invalid:', parseResult.error.issues)
      return jsonError('Invalid body', 400)
    }
    parsed = parseResult.data
  } catch (err) {
    console.warn('[webhook] JSON parse failed:', err instanceof Error ? err.message : 'unknown')
    return jsonError('Invalid JSON', 400)
  }

  // 4. Status guard (D-T4). Read current state via service-role client.
  const serviceClient = createServiceClient()
  const { data: existing, error: selectError } = await serviceClient
    .from('readings')
    .select('id, status, vision_features')
    .eq('id', parsed.reading_id)
    .maybeSingle()

  if (selectError) {
    console.error(`[webhook] SELECT failed for reading=${parsed.reading_id}:`, selectError.message)
    return jsonError('Database read failed', 500)
  }

  if (!existing) {
    // Reading vanished (e.g. discardReadingAction ran before webhook arrived).
    // Idempotent no-op — never resurrect a deleted reading.
    console.info(`[webhook] no-op: reading=${parsed.reading_id} not found`)
    return NextResponse.json({ ok: true, noop: 'reading_not_found' })
  }

  if (existing.status !== STATUS_PROCESSING) {
    // Status guard primary barrier — D-T4.
    console.info(
      `[webhook] no-op for reading=${parsed.reading_id} status=${existing.status} (guard requires '${STATUS_PROCESSING}')`,
    )
    return NextResponse.json({ ok: true, noop: 'status_guard' })
  }

  // 5. Defense-in-depth modal_call_id check (D-T5). Warn but proceed.
  const storedFeatures =
    (existing.vision_features as { processing_metadata?: { modal_call_id?: string } } | null) ?? null
  const storedCallId = storedFeatures?.processing_metadata?.modal_call_id ?? null
  if (
    storedCallId &&
    storedCallId !== 'pending' &&
    storedCallId !== parsed.modal_call_id
  ) {
    console.warn(
      `[webhook] modal_call_id mismatch reading=${parsed.reading_id} stored=${storedCallId} incoming=${parsed.modal_call_id}`,
    )
  }

  // 6. Atomic single UPDATE — D-F5 / D-PM2.
  // vision_features = full payload from worker; status = ready|failed; processed_at = now.
  // B3: when the worker omits `vision_features` on a failed payload (allowed
  // by the Zod schema's optional()+superRefine() — failed status doesn't require
  // it), substitute a minimal dict carrying processing_metadata.error_summary
  // so the listing tooltip in 05-14 can always render something meaningful
  // (D-F2 + D-PM1.error_summary). Success-path failures of this guard cannot
  // occur — superRefine rejects `status='ready'` without vision_features at 400.
  const visionFeaturesForWrite =
    parsed.vision_features ??
    {
      right_eye: null,
      left_eye: null,
      asymmetry_notes: [],
      processing_metadata: {
        modal_call_id: parsed.modal_call_id,
        warnings: [],
        error_summary: 'Falha temporária no processamento — tente novamente',
      },
    }

  const processedAt = new Date().toISOString()
  const { error: updateError } = await serviceClient
    .from('readings')
    .update({
      vision_features: visionFeaturesForWrite,
      status: parsed.status,
      processed_at: processedAt,
    })
    .eq('id', parsed.reading_id)
    .eq('status', STATUS_PROCESSING) // double-guard at SQL level — D-T4 race protection

  if (updateError) {
    console.error(`[webhook] UPDATE failed for reading=${parsed.reading_id}:`, updateError.message)
    return jsonError('Database write failed', 500)
  }

  // 7. Cache revalidation — D-T2.
  revalidatePath('/leituras')

  console.info(
    `[webhook] applied reading=${parsed.reading_id} status=${parsed.status} call_id=${parsed.modal_call_id}`,
  )
  return NextResponse.json({ ok: true })
}
