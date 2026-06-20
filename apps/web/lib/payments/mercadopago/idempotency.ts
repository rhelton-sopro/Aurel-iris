/**
 * Idempotência dos webhooks do Mercado Pago. O MP REENVIA (created→updated +
 * retries até 200) → deduplicar por `idempotencyKey` = `${paymentId}:${status}`
 * (parcial inclui o valor devolvido). Ver research/02.
 *
 * Reaproveita a tabela `asaas_webhook_events` (event_id PK) como store genérico
 * de eventos de webhook — sem migration nova. O event_id carrega a chave do MP;
 * event_type leva o prefixo 'mp:' pra distinguir a origem. Mesma mecânica 23505
 * = duplicate → no-op idempotente do webhook Asaas.
 *
 * Server-only — service-role client (webhook sem sessão).
 */
import 'server-only'
import type { Json } from '@/types/database'
import { createServiceClient } from '@/lib/supabase/service'
import type { NormalizedPaymentEvent } from '../types'

export type RecordEventResult =
  | { ok: true; first_seen: true }
  | { ok: true; first_seen: false }
  | { ok: false; error: string }

export async function recordMpEvent(
  event: NormalizedPaymentEvent,
): Promise<RecordEventResult> {
  const service = createServiceClient()
  const { error } = await service.from('asaas_webhook_events').insert({
    event_id: event.idempotencyKey,
    event_type: `mp:${event.kind}`,
    payment_id: event.providerPaymentId,
    payload: event as unknown as Json,
  })
  if (!error) return { ok: true, first_seen: true }
  if ((error as { code?: string }).code === '23505') {
    return { ok: true, first_seen: false } // duplicate = idempotent skip
  }
  console.error('[mp-idempotency] insert failed:', error.message)
  return { ok: false, error: error.message }
}

export async function markMpEventProcessed(idempotencyKey: string): Promise<void> {
  const service = createServiceClient()
  await service
    .from('asaas_webhook_events')
    .update({ processed_at: new Date().toISOString(), status: 'processed' })
    .eq('event_id', idempotencyKey)
}

/**
 * Remove a row de idempotência de um evento que falhou por erro TRANSIENTE de DB
 * (a aplicação NÃO foi feita) — sem isto a re-entrega cairia em no-op idempotente
 * e o crédito ficaria perdido. Best-effort.
 */
export async function unrecordMpEvent(idempotencyKey: string): Promise<void> {
  const service = createServiceClient()
  const { error } = await service
    .from('asaas_webhook_events')
    .delete()
    .eq('event_id', idempotencyKey)
  if (error) console.error('[mp-idempotency] unrecord failed:', error.message)
}
