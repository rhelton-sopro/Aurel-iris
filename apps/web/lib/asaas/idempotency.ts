/**
 * Idempotency guard for inbound Asaas webhooks.
 *
 * Isolates the INSERT into `asaas_webhook_events` with handling of PG 23505
 * (unique_violation on the event_id PK). A duplicate event_id means Asaas
 * re-delivered the same webhook — the handler (plano 08-04) treats first_seen:
 * false as an idempotent no-op and returns 200 (replay mitigation T-08-02-05).
 *
 * Server-only — uses the service-role Supabase client (bypasses RLS; webhook
 * has no authenticated user session).
 */
import 'server-only'
import type { Json } from '@/types/database'
import { createServiceClient } from '@/lib/supabase/service'
import type { AsaasWebhookEnvelope } from './types'

export type RecordEventResult =
  | { ok: true; first_seen: true }
  | { ok: true; first_seen: false } // duplicate event_id = idempotent skip
  | { ok: false; error: string }

export async function recordWebhookEvent(
  envelope: AsaasWebhookEnvelope,
): Promise<RecordEventResult> {
  const service = createServiceClient()
  const { error } = await service.from('asaas_webhook_events').insert({
    event_id: envelope.id,
    event_type: envelope.event,
    payment_id: envelope.payment.id,
    payload: envelope as unknown as Json,
  })
  if (!error) return { ok: true, first_seen: true }
  // PG 23505 = unique_violation; event_id PK already exists = duplicate webhook
  if ((error as { code?: string }).code === '23505') {
    return { ok: true, first_seen: false }
  }
  console.error('[asaas-idempotency] insert failed:', error.message)
  return { ok: false, error: error.message }
}

export async function markEventProcessed(eventId: string): Promise<void> {
  const service = createServiceClient()
  await service
    .from('asaas_webhook_events')
    .update({ processed_at: new Date().toISOString(), status: 'processed' })
    .eq('event_id', eventId)
}
