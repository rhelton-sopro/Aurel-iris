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

/**
 * WR-05: remove a row de idempotência de um evento que falhou por erro
 * TRANSIENTE de DB (a ativação do crédito NÃO foi aplicada). Sem isto, o
 * event_id PK já gravado faria a re-entrega do Asaas cair em first_seen:false
 * (200 no-op idempotente) e o crédito ficaria PERMANENTEMENTE perdido.
 *
 * Removendo a row, a re-entrega do Asaas volta como first_seen:true e
 * reprocessa. Só é chamado no caminho de db_error (transiente) — eventos
 * already-processed / invalid / no-op mantêm a row e retornam 200.
 *
 * Best-effort: se o DELETE em si falhar, o pior caso é o comportamento antigo
 * (200 idempotente na re-entrega), nunca pior que isso.
 */
export async function unrecordWebhookEvent(eventId: string): Promise<void> {
  const service = createServiceClient()
  const { error } = await service
    .from('asaas_webhook_events')
    .delete()
    .eq('event_id', eventId)
  if (error) {
    console.error(
      '[asaas-idempotency] unrecord (rollback) failed:',
      error.message,
    )
  }
}
