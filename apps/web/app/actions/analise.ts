'use server'

/**
 * Server Actions for Phase 7 editor flow.
 *
 * - saveReportDelivered(readingId, reportDelivered):
 *     1. Auth + RLS check
 *     2. zod validation (passthrough — Pitfall 10)
 *     3. LGPD vocab audit on each value (BLOCK save if hit — D-A2)
 *     4. Load report_generated, classifyAllSections → edit_diff/zonas_editadas/tipo_edicao
 *     5. Atomic UPDATE: report_delivered, edit_diff, zonas_editadas, tipo_edicao,
 *        status='edited', report_delivered_at=NOW()
 *     6. Re-run runAudit on report_delivered → UPDATE audit_metadata
 *     7. revalidatePath
 *
 * - markReadingDelivered(readingId):
 *     1. Auth + RLS
 *     2. Re-run audit on report_delivered (defense in depth — D-A2)
 *     3. UPDATE: is_delivered=true, delivered_at=NOW()
 *     4. revalidatePath
 *
 * Phase 7 | Plan 07-10 | Decisions: D-U2, D-U3, D-A2
 *
 * Phase 7.4 Plan 10 (Direction Correction — see 07.4-CONTEXT.md DC-1..DC-10):
 *   `saveReportV2Delivered` + `deliverReportV2` were removed. Plan 11 will
 *   reintroduce v2 server actions designed around 14-section markdown.
 */
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { extractForbiddenHits, runAudit } from '@/lib/anthropic/audit'
import { classifyAllSections } from '@/lib/anthropic/diff'
import { ENCERRAMENTO_LITERAL } from '@/lib/anthropic/types'
import type { AuditMetadata, ReportJsonb } from '@/lib/anthropic/types'

import {
  readingIdSchema,
  reportDeliveredSchema,
} from './analise.schemas'

interface SaveResult {
  error?: string
  warning?: string
  success?: boolean
}

export async function saveReportDelivered(
  readingId: string,
  reportDelivered: Record<string, string>,
): Promise<SaveResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) redirect('/login')

  const idParsed = readingIdSchema.safeParse({ reading_id: readingId })
  if (!idParsed.success) return { error: 'reading_id inválido' }

  const bodyParsed = reportDeliveredSchema.safeParse(reportDelivered)
  if (!bodyParsed.success) return { error: 'Formato do relatório inválido' }

  // Defense in depth — D-A2 BLOCK save if forbidden vocab present in any value.
  const allHits = []
  for (const [key, value] of Object.entries(bodyParsed.data)) {
    if (typeof value !== 'string') continue
    allHits.push(...extractForbiddenHits(value, key))
  }
  if (allHits.length > 0) {
    const terms = Array.from(new Set(allHits.map((h) => h.term))).join(', ')
    return {
      error: `Não foi possível salvar: o texto ainda contém termos afirmativos (${terms}). Corrija e tente novamente.`,
    }
  }

  // Load report_generated for diff classification
  const { data: reading, error: readingError } = await supabase
    .from('readings')
    .select('id, therapist_id, report_generated, is_delivered')
    .eq('id', readingId)
    .eq('therapist_id', user.id)
    .single()
  if (readingError || !reading) return { error: 'Leitura não encontrada' }
  if (reading.is_delivered) return { error: 'Leitura já concluída — somente leitura.' }

  const generated = (reading.report_generated as ReportJsonb | null) ?? {}
  const delivered = bodyParsed.data as ReportJsonb
  delivered.encerramento_disclaimer = ENCERRAMENTO_LITERAL
  const diffs = classifyAllSections(generated, delivered)
  const audit = runAudit(delivered)

  const { error: updateError } = await supabase
    .from('readings')
    .update({
      report_delivered: delivered as never,
      edit_diff: diffs.edit_diff as never,
      zonas_editadas: diffs.zonas_editadas as never,
      tipo_edicao: diffs.tipo_edicao,
      status: 'edited',
      report_delivered_at: new Date().toISOString(),
      audit_metadata: audit as never,
    })
    .eq('id', readingId)

  if (updateError) return { error: `Falha ao salvar: ${updateError.message}` }

  revalidatePath(`/leituras/${readingId}`)
  revalidatePath(`/leituras/${readingId}/editar`)
  revalidatePath('/leituras')
  return { success: true }
}

interface DeliverResult {
  error?: string
  success?: boolean
}

export async function markReadingDelivered(readingId: string): Promise<DeliverResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) redirect('/login')

  const idParsed = readingIdSchema.safeParse({ reading_id: readingId })
  if (!idParsed.success) return { error: 'reading_id inválido' }

  // Defense in depth — re-audit antes da terminal flip
  const { data: reading, error: readingError } = await supabase
    .from('readings')
    .select('id, therapist_id, report_delivered, report_generated, is_delivered, audit_metadata')
    .eq('id', readingId)
    .eq('therapist_id', user.id)
    .single()
  if (readingError || !reading) return { error: 'Leitura não encontrada' }
  if (reading.is_delivered) return { error: 'Leitura já concluída' }

  // 2026-05-21 (founder UAT): se terapeuta não editou (report_delivered vazio),
  // entregar usa o report_generated como conteúdo final — não bloqueia mais.
  // Cópia explícita pra report_delivered congela o snapshot da entrega.
  const delivered = (reading.report_delivered as ReportJsonb | null)
  const generated = (reading.report_generated as ReportJsonb | null)
  const hasDelivered = delivered && Object.keys(delivered).length > 0
  const finalDelivered: ReportJsonb | null = hasDelivered ? delivered : generated
  if (!finalDelivered || Object.keys(finalDelivered).length === 0) {
    return { error: 'Relatório ainda não foi gerado. Aguarde a análise concluir.' }
  }

  // Guarda C — SC2: fail-closed em audit_metadata ausente/low_anchor_rate
  const audit = reading.audit_metadata as AuditMetadata | null
  if (!audit) {
    return { error: 'Auditoria de ancoragem ausente. Re-gere a análise para re-rodar a auditoria.' }
  }
  if (audit.low_anchor_rate !== false) {
    return { error: 'Âncora insuficiente — taxa de ancoragem abaixo de 95% nas seções clínicas. Edite e re-salve antes de concluir.' }
  }
  const allHits = []
  for (const [key, value] of Object.entries(finalDelivered)) {
    if (typeof value !== 'string') continue
    allHits.push(...extractForbiddenHits(value, key))
  }
  if (allHits.length > 0) {
    const terms = Array.from(new Set(allHits.map((h) => h.term))).join(', ')
    return {
      error: `Não foi possível concluir: corrija os termos afirmativos antes de concluir a leitura (${terms}).`,
    }
  }

  const updatePayload: Record<string, unknown> = {
    is_delivered: true,
    delivered_at: new Date().toISOString(),
  }
  // Congela o snapshot: se terapeuta não editou, copia o generated pra delivered.
  if (!hasDelivered) {
    updatePayload.report_delivered = finalDelivered as unknown as never
    updatePayload.report_delivered_at = new Date().toISOString()
    updatePayload.status = 'edited'
  }

  const { error: updateError } = await supabase
    .from('readings')
    .update(updatePayload as never)
    .eq('id', readingId)

  if (updateError) return { error: `Falha ao concluir: ${updateError.message}` }

  revalidatePath(`/leituras/${readingId}`)
  revalidatePath(`/leituras/${readingId}/editar`)
  revalidatePath('/leituras')
  return { success: true }
}
