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
 */
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { extractForbiddenHits, runAudit } from '@/lib/anthropic/audit'
import { runAuditV2 } from '@/lib/anthropic/audit-v2'
import { classifyAllSections } from '@/lib/anthropic/diff'
import { classifyAllSystemsV2 } from '@/lib/anthropic/diff-v2'
import { reportV2Schema, type ReportV2 } from '@/lib/anthropic/report-schema'
import { ENCERRAMENTO_LITERAL } from '@/lib/anthropic/types'
import type { AuditMetadata, ReportJsonb } from '@/lib/anthropic/types'
import type { AuditV2Result, ReportV2EditDiff } from '@/lib/anthropic/types-v2'

import {
  readingIdSchema,
  reportDeliveredSchema,
  reportV2DeliveredSchema,
} from './analise.schemas'

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

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
  if (reading.is_delivered) return { error: 'Leitura já entregue ao cliente — somente leitura.' }

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

  // Defense in depth — re-audit report_delivered before terminal flip
  const { data: reading, error: readingError } = await supabase
    .from('readings')
    .select('id, therapist_id, report_delivered, is_delivered, audit_metadata')
    .eq('id', readingId)
    .eq('therapist_id', user.id)
    .single()
  if (readingError || !reading) return { error: 'Leitura não encontrada' }
  if (reading.is_delivered) return { error: 'Leitura já entregue ao cliente' }

  // Guarda D — CR-04: bloqueia entrega de relatório vazio
  const delivered = (reading.report_delivered as ReportJsonb | null)
  if (!delivered || Object.keys(delivered).length === 0) {
    return { error: 'Salve a edição antes de entregar ao cliente.' }
  }

  // Guarda C — SC2: fail-closed em audit_metadata ausente/low_anchor_rate
  const audit = reading.audit_metadata as AuditMetadata | null
  if (!audit || audit.low_anchor_rate !== false) {
    if (!audit) {
      return { error: 'Auditoria de ancoragem ausente ou pendente. Re-salve o relatório para re-rodar a auditoria.' }
    }
    return { error: 'Âncora insuficiente — taxa de ancoragem abaixo de 95% nas seções clínicas. Edite e re-salve antes de entregar.' }
  }
  const allHits = []
  for (const [key, value] of Object.entries(delivered)) {
    if (typeof value !== 'string') continue
    allHits.push(...extractForbiddenHits(value, key))
  }
  if (allHits.length > 0) {
    const terms = Array.from(new Set(allHits.map((h) => h.term))).join(', ')
    return {
      error: `Não foi possível entregar: corrija os termos afirmativos antes da entrega final (${terms}).`,
    }
  }

  const { error: updateError } = await supabase
    .from('readings')
    .update({ is_delivered: true, delivered_at: new Date().toISOString() })
    .eq('id', readingId)

  if (updateError) return { error: `Falha ao entregar: ${updateError.message}` }

  revalidatePath(`/leituras/${readingId}`)
  revalidatePath(`/leituras/${readingId}/editar`)
  revalidatePath('/leituras')
  return { success: true }
}

// === Phase 7.4 V2 server actions ===
// Phase 7.4 | Plan 07.4-05 | Decisões: D-UI2, D-VOC3, D-SCH3

interface SaveV2Result {
  error?: string
  warning?: string
  success?: boolean
  /** Returned for client to update VocabularyAuditBanner state. */
  audit?: AuditV2Result
}

/**
 * Per-block OR full-report save (D-UI2). NON-BLOCKING on audit hits (D-VOC3) —
 * persists the partial + records audit hits in audit_metadata for the banner.
 * Hard-gate on hits happens in `deliverReportV2` below.
 *
 * Phase 7.4 | Plan 07.4-05 | Decisões: D-UI2, D-VOC3, D-SCH3
 */
export async function saveReportV2Delivered(
  readingId: string,
  partial: Record<string, unknown>,
): Promise<SaveV2Result> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) redirect('/login')

  const idParsed = readingIdSchema.safeParse({ reading_id: readingId })
  if (!idParsed.success) return { error: 'reading_id inválido' }

  const partialParsed = reportV2DeliveredSchema.safeParse(partial)
  if (!partialParsed.success) {
    return {
      error: `Formato inválido: ${partialParsed.error.issues
        .map((i) => i.path.join('.'))
        .join(', ')}`,
    }
  }

  // Load current state — RLS-scoped via therapist_id (MEMORY: do NOT query auth.users)
  const { data: reading, error: readingError } = await supabase
    .from('readings')
    .select(
      'id, therapist_id, report_v2, report_v2_delivered, report_version, is_delivered',
    )
    .eq('id', readingId)
    .eq('therapist_id', user.id)
    .single()
  if (readingError || !reading) return { error: 'Leitura não encontrada' }
  if (reading.is_delivered)
    return { error: 'Análise já entregue — somente leitura.' }
  if (reading.report_version !== '2.0') {
    return {
      error: 'Leitura está em formato legado (1.0). Use o editor V1 para esta leitura.',
    }
  }

  // Merge partial onto current delivered (or onto generated if first edit)
  const currentDelivered =
    (reading.report_v2_delivered as ReportV2 | null) ??
    (reading.report_v2 as ReportV2 | null)
  if (!currentDelivered) return { error: 'Leitura sem relatório gerado.' }

  const merged: ReportV2 = {
    ...currentDelivered,
    ...partialParsed.data,
  } as ReportV2

  // Post-merge: priority_focus length-3 (zod schema doesn't enforce on partial input;
  // enforce on the merged result so per-block save of a different field doesn't trip).
  if (
    !Array.isArray(merged.priority_focus) ||
    merged.priority_focus.length !== 3
  ) {
    return { error: 'priority_focus deve ter exatamente 3 itens após a edição.' }
  }

  // Full-report zod validation on the merged result — defense in depth
  const fullParse = reportV2Schema.safeParse(merged)
  if (!fullParse.success) {
    return {
      error: `Validação falhou: ${fullParse.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    }
  }
  const validated = fullParse.data

  // Runtime audit — recorded but NON-BLOCKING (D-VOC3 split)
  const generated = (reading.report_v2 as ReportV2 | null) ?? null
  const audit = runAuditV2(validated, {
    json_validation_passed: true,
    retry_count: 0, // saved manually; retry only happens during generation
  })

  // Per-system_id + top-level diff
  const editDiff: ReportV2EditDiff = classifyAllSystemsV2(generated, validated)

  // Atomic UPDATE
  const { error: updateError } = await supabase
    .from('readings')
    .update({
      report_v2_delivered: validated as never,
      report_v2_edit_diff: editDiff as never,
      report_v2_delivered_at: new Date().toISOString(),
      audit_metadata: audit as never,
      status: 'edited',
    })
    .eq('id', readingId)

  if (updateError) return { error: `Falha ao salvar: ${updateError.message}` }

  revalidatePath(`/leituras/${readingId}`)
  revalidatePath(`/leituras/${readingId}/editar`)
  revalidatePath('/leituras')

  return { success: true, audit }
}

interface DeliverV2Result {
  error?: string
  success?: boolean
  hits?: AuditV2Result
}

/**
 * Final "Entregar ao cliente" gate (D-VOC3 hard-gate). Requires zero hits across
 * all 3 vocab categories. Flips is_delivered=true and freezes the analysis.
 *
 * Phase 7.4 | Plan 07.4-05 | Decisões: D-VOC3
 */
export async function deliverReportV2(readingId: string): Promise<DeliverV2Result> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) redirect('/login')

  const idParsed = readingIdSchema.safeParse({ reading_id: readingId })
  if (!idParsed.success) return { error: 'reading_id inválido' }

  const { data: reading, error: readingError } = await supabase
    .from('readings')
    .select(
      'id, therapist_id, report_v2, report_v2_delivered, report_version, is_delivered',
    )
    .eq('id', readingId)
    .eq('therapist_id', user.id)
    .single()
  if (readingError || !reading) return { error: 'Leitura não encontrada' }
  if (reading.is_delivered) return { error: 'Já entregue.' }
  if (reading.report_version !== '2.0')
    return { error: 'Leitura está em formato legado.' }

  const finalReport =
    (reading.report_v2_delivered as ReportV2 | null) ??
    (reading.report_v2 as ReportV2 | null)
  if (!finalReport) return { error: 'Sem relatório para entregar.' }

  // Re-run audit defense-in-depth — D-VOC3 hard-gate
  const audit = runAuditV2(finalReport, {
    json_validation_passed: true,
    retry_count: 0,
  })
  const totalHits =
    safeArray(audit.iridological_jargon).length +
    safeArray(audit.sopro_vocab).length +
    safeArray(audit.forbidden_vocab).length
  if (totalHits > 0) {
    return {
      error: `Não foi possível entregar: o texto ainda contém ${totalHits} termo(s) proibido(s). Revise os blocos sinalizados e tente novamente.`,
      hits: audit,
    }
  }

  const { error: updateError } = await supabase
    .from('readings')
    .update({
      is_delivered: true,
      delivered_at: new Date().toISOString(),
      audit_metadata: audit as never, // refresh with final clean audit
    })
    .eq('id', readingId)

  if (updateError) return { error: `Falha ao entregar: ${updateError.message}` }

  revalidatePath(`/leituras/${readingId}`)
  revalidatePath(`/leituras/${readingId}/editar`)
  revalidatePath('/leituras')

  return { success: true }
}
