import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { Json } from '@/types/database'

import type { AuditEventType } from './events'

export interface AuditEventInput {
  event_type: AuditEventType
  actor_user_id?: string | null
  actor_email?: string | null
  target_type?: 'reading' | 'client' | 'credit' | 'consent' | 'profile' | null
  target_id?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Best-effort audit log. NUNCA throwa pra caller.
 * Phase 8 LGPD-04 básico (D-15) — eventos persistidos pra forensics, não autorização.
 *
 * Use em qualquer server action / route handler / webhook após operação bem-sucedida.
 */
export async function logAuditEvent(event: AuditEventInput): Promise<void> {
  try {
    const service = createServiceClient()
    const { error } = await service.from('audit_events').insert({
      event_type: event.event_type,
      actor_user_id: event.actor_user_id ?? null,
      actor_email: event.actor_email ?? null,
      target_type: event.target_type ?? null,
      target_id: event.target_id ?? null,
      // metadata é jsonb no schema; Record<string, unknown> não é estruturalmente
      // assignável ao tipo recursivo Json gerado pelo Supabase — cast no boundary.
      metadata: (event.metadata ?? null) as Json,
    })
    if (error) {
      console.warn(
        `[audit] insert failed type=${event.event_type}:`,
        error.message,
      )
    }
  } catch (err) {
    // Non-fatal — never break the caller's flow
    console.warn('[audit] catch:', err instanceof Error ? err.message : err)
  }
}
