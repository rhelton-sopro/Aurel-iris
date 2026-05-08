/**
 * Diff classifier (D-U2) — produz outputs jsonb canônicos a partir de
 * comparação per-section: edit_diff (detalhe per-key), zonas_editadas
 * (chaves alteradas), tipo_edicao (lista deduplicada de tipos).
 *
 * Usa `diff@9` `diffWords` (Myers algorithm, BSD, zero deps, TS-native ESM+CJS).
 * Threshold 30% de tokens alterados distingue 'corrigido' (<30%) vs 'reescrito'
 * (>=30%) per CONTEXT D-U2 (founder heuristic — pode ser recalibrada baseada
 * em dogfooding pós-Estágio 1).
 *
 * Outputs alimentam Server Action saveReportDelivered (07-09):
 *   - edit_diff: jsonb per-section detalhe pra debug humano
 *   - zonas_editadas: ReportSectionKey[] pra queries SQL agregadas
 *   - tipo_edicao: EditTipo[] dedup — sinal estruturado pra Fase 10 SAC
 *     aprender quais tipos de edits o terapeuta tipicamente faz
 *
 * server-only: protege contra `diff@9` ou regras heurísticas D-U2 vazarem
 * pro bundle do client. Validate em build via next.config (D-T1).
 *
 * Phase 7 | Plan 07-06 | Decisions: D-U2, RESEARCH §Pattern 4
 */
import 'server-only'
import { diffWords, type Change } from 'diff'
import type { ReportJsonb, ReportSectionKey, EditTipo } from './types'

/**
 * Threshold de tokens alterados que define a transição corrigido→reescrito.
 * D-U2 founder heuristic: edits abaixo de 30% são "ajustes pontuais", acima
 * de 30% são "reescrita substantiva". Comparação inclusive (>=) para
 * reescrito — i.e. 30% exato já é reescrito.
 */
const THRESHOLD_PCT = 30

/**
 * Resultado de classifyEdit per-section. Persistido em report.edit_diff
 * jsonb com chave = ReportSectionKey.
 */
export interface ClassifiedEdit {
  type: EditTipo
  diff_summary: string
  char_delta: number
  changed_pct: number
}

/**
 * Classifica edição entre `generated` (texto produzido pelo LLM) e
 * `delivered` (texto final salvo pelo terapeuta).
 *
 * Trim aplica antes de comparar: whitespace-only original conta como
 * 'adicionado' se o delivered tem conteúdo (defesa em profundidade contra
 * Sonnet emitindo `\n\n` placeholder e terapeuta preenchendo depois).
 */
export function classifyEdit(generated: string, delivered: string): ClassifiedEdit {
  const trimGen = (generated ?? '').trim()
  const trimDel = (delivered ?? '').trim()

  if (trimGen === trimDel) {
    return { type: 'none', diff_summary: '', char_delta: 0, changed_pct: 0 }
  }
  if (trimGen === '' && trimDel !== '') {
    return {
      type: 'adicionado',
      diff_summary: 'novo conteúdo adicionado',
      char_delta: trimDel.length - trimGen.length,
      changed_pct: 100,
    }
  }
  if (trimGen !== '' && trimDel === '') {
    return {
      type: 'removido',
      diff_summary: 'conteúdo removido',
      char_delta: trimDel.length - trimGen.length,
      changed_pct: 100,
    }
  }

  // Caso geral: ambos com conteúdo — diffWords token-level.
  const changes: Change[] = diffWords(trimGen, trimDel)
  const totalTokens = changes.reduce((sum, c) => sum + (c.count ?? 0), 0)
  const changedTokens = changes
    .filter((c) => c.added || c.removed)
    .reduce((sum, c) => sum + (c.count ?? 0), 0)
  const changedPct =
    totalTokens === 0 ? 0 : Math.round((changedTokens / totalTokens) * 100)

  return {
    type: changedPct >= THRESHOLD_PCT ? 'reescrito' : 'corrigido',
    diff_summary: summarizeChanges(changes),
    char_delta: trimDel.length - trimGen.length,
    changed_pct: changedPct,
  }
}

/**
 * Sumário humano-legível dos primeiros 3 chunks adicionados e removidos.
 * Usado em UI de debug + futura tela de SAC review (Fase 10).
 */
function summarizeChanges(changes: Change[]): string {
  const added: string[] = []
  const removed: string[] = []
  for (const c of changes) {
    if (c.added) {
      const v = c.value.trim()
      if (v) added.push(v)
    }
    if (c.removed) {
      const v = c.value.trim()
      if (v) removed.push(v)
    }
  }
  const addedTop = added.slice(0, 3).join(' | ')
  const removedTop = removed.slice(0, 3).join(' | ')
  const parts: string[] = []
  if (addedTop) parts.push(`+ ${addedTop}`)
  if (removedTop) parts.push(`- ${removedTop}`)
  // Garante string não-vazia mesmo quando added/removed contêm só whitespace
  // (improvável dado os early returns, mas defesa para diff_summary contract).
  return parts.join(' / ') || 'edição detectada'
}

/**
 * Output canônico de classifyAllSections — bate 1:1 com colunas D-U2 do
 * schema readings (07-01):
 *   - readings.edit_diff jsonb        ← edit_diff
 *   - readings.zonas_editadas text[]  ← zonas_editadas
 *   - readings.tipo_edicao text[]     ← tipo_edicao
 */
export interface SectionDiffs {
  edit_diff: Partial<Record<ReportSectionKey, ClassifiedEdit>>
  zonas_editadas: ReportSectionKey[]
  tipo_edicao: EditTipo[]
}

/**
 * Lista canônica das 14 chaves processadas. Chaves fora desta lista são
 * IGNORADAS (defesa contra Sonnet emitir chaves espúrias). Sincronizada
 * com types.ts ReportSectionKey union — adicionar chave aqui requer edit
 * coordenado em types.ts + parser.
 */
const ALL_REPORT_KEYS: ReportSectionKey[] = [
  '1_constituicao',
  '2_estrutural_fisica',
  '3_indicacoes_sistemicas',
  '4_toxemia',
  '5_psicoemocional',
  '6_cargas_temporais',
  '7_carencias_nutricionais',
  '8_simbolico_espiritual',
  '9_cuidados_integrativos',
  '10_potenciais_forcas',
  '11_afirmacoes_integracao',
  '12_sintese_integrativa',
  '13_mensagem_final',
  'encerramento_disclaimer',
]

/**
 * Itera sobre a união das chaves canônicas presentes em qualquer dos dois
 * reports, classifica cada par, e produz os 3 outputs canônicos D-U2.
 *
 * Chaves fora de `ALL_REPORT_KEYS` são ignoradas — Sonnet ocasionalmente
 * emite headings extras (ex: "14. Bibliografia"), e ignorá-las aqui evita
 * poluir tipo_edicao com tipos calculados sobre conteúdo não-estruturado.
 */
export function classifyAllSections(
  generated: ReportJsonb,
  delivered: ReportJsonb,
): SectionDiffs {
  const keys = new Set<ReportSectionKey>()
  for (const k of ALL_REPORT_KEYS) {
    if (k in generated || k in delivered) keys.add(k)
  }

  const editDiff: Partial<Record<ReportSectionKey, ClassifiedEdit>> = {}
  const zonasEditadas: ReportSectionKey[] = []
  const tiposSet = new Set<EditTipo>()

  for (const key of keys) {
    const classified = classifyEdit(generated[key] ?? '', delivered[key] ?? '')
    editDiff[key] = classified
    if (classified.type !== 'none') {
      zonasEditadas.push(key)
      tiposSet.add(classified.type)
    }
  }

  return {
    edit_diff: editDiff,
    zonas_editadas: zonasEditadas,
    tipo_edicao: Array.from(tiposSet),
  }
}
