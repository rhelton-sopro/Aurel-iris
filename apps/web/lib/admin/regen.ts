import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { SectionCompleteness } from '@/lib/anthropic/types'

export interface RegenCandidate {
  id: string
  therapist_id: string
  client_name: string | null
  status: string | null
  report_generated_at: string | null
  created_at: string | null
  images_purged_at: string | null
  completeness: SectionCompleteness | null
}

/**
 * Triagem de regeneração (admin, 2026-06-03). Lista relatórios já gerados de
 * TODOS os terapeutas com o veredito de completude do gate de auditoria. Por
 * padrão só os INCOMPLETOS (o que precisa de resgate); `all` traz todos.
 *
 * Service-role (cross-therapist, fora do RLS) — a página /admin/regenerar já
 * faz o gate de founder. A AÇÃO de regenerar continua sendo founder-owned
 * (deep-link pra /leituras/[id]); aqui é só leitura/diagnóstico.
 */
export async function fetchRegenCandidates(opts: {
  all: boolean
}): Promise<RegenCandidate[]> {
  const service = createServiceClient()

  // images_purged_at é da migration 0043 — fora dos types gerados ainda.
  const { data } = await service
    .from('readings')
    .select(
      'id, therapist_id, status, report_generated_at, created_at, audit_metadata, images_purged_at, client:clients(full_name)' as never,
    )
    .not('report_generated', 'is', null)
    .order('report_generated_at', { ascending: false })
    .limit(300)

  const rows = (data ?? []) as unknown as Array<{
    id: string
    therapist_id: string
    status: string | null
    report_generated_at: string | null
    created_at: string | null
    images_purged_at: string | null
    audit_metadata: { section_completeness?: SectionCompleteness } | null
    client: { full_name?: string | null } | null
  }>

  const candidates: RegenCandidate[] = rows.map((r) => ({
    id: r.id,
    therapist_id: r.therapist_id,
    client_name: r.client?.full_name ?? null,
    status: r.status,
    report_generated_at: r.report_generated_at,
    created_at: r.created_at,
    images_purged_at: r.images_purged_at,
    completeness: r.audit_metadata?.section_completeness ?? null,
  }))

  if (opts.all) return candidates

  // Só incompletos: completeness presente e complete === false. Legados (sem
  // section_completeness) ficam de fora do filtro padrão — não há como saber e
  // a foto deles já foi embora.
  return candidates.filter((c) => c.completeness != null && !c.completeness.complete)
}
