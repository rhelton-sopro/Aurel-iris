#!/usr/bin/env node
// scripts/reparse-reading.mjs
// Re-parse readings.report_raw_text and persist to report_generated WITHOUT
// burning a regeneration_count attempt.
//
// When the streaming parser misses section boundaries (e.g., heading-format
// drift in Sonnet's output), the raw stream is captured to report_raw_text
// (migration 0008) but report_generated is empty. This script applies the
// CURRENT parser regex against the saved raw and patches report_generated
// in place. Use after fixing the parser to recover lost reports without
// regenerating ($0.30 + 5min saved per reading + spares regen_count cap).
//
// Logic mirrors apps/web/lib/anthropic/parser.ts. Audit is also re-run to
// reflect the new sections accurately.
//
// Usage (run from apps/web/):
//   node --env-file=.env.local scripts/reparse-reading.mjs <readingId>
//
// Phase 7 debugging | added 2026-05-08 dogfooding session.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) {
  console.error('SUPABASE_URL is not set')
  process.exit(2)
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set')
  process.exit(2)
}
if (!SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ')) {
  console.error('SUPABASE_SERVICE_ROLE_KEY appears malformed (no eyJ prefix)')
  process.exit(2)
}

const readingId = process.argv[2]
if (!readingId) {
  console.error('Usage: node scripts/reparse-reading.mjs <readingId>')
  process.exit(1)
}

// Mirror of apps/web/lib/anthropic/types.ts SECTION_KEY_BY_NUMBER
// Plan 11 (Direction Correction DC-1) — remapped to 14 sections.
const SECTION_KEY_BY_NUMBER = {
  1: '1_constituicao_temperamento',
  2: '2_mapa_organico',
  3: '3_linha_tempo_emocional',
  4: '4_padroes_emocionais_ativos',
  5: '5_eixo_psicossomatico',
  6: '6_herancas_transgeracionais',
  7: '7_carencias_funcionais',
  8: '8_estado_mental_nervoso',
  9: '9_recursos_forcas',
  10: '10_dimensao_arquetipica',
  11: '11_sugestoes_integrativas',
  12: '12_roteiro_anamnese',
  13: '13_sintese_integrativa',
  14: '14_mensagem_cliente',
}

const ENCERRAMENTO_LITERAL = `Esta leitura iridológica é uma ferramenta de apoio à anamnese terapêutica.
Não constitui diagnóstico médico nem substitui avaliação clínica profissional.
Os achados aqui descritos são hipóteses a serem investigadas pelo terapeuta
em conjunto com o cliente, à luz de sua história de vida e contexto integral.`

// Mirror of apps/web/lib/anthropic/parser.ts findAllBoundaries + closeSections
function findAllBoundaries(buffer) {
  const re = /^#{2,3} (\d{1,2})\.\s+/gm
  const matches = []
  let m
  let lastNumber = 0
  while ((m = re.exec(buffer)) !== null) {
    const number = parseInt(m[1], 10)
    if (number < 1 || number > 14) continue
    if (number !== lastNumber + 1) continue
    lastNumber = number
    matches.push({ number, key: SECTION_KEY_BY_NUMBER[number], startIdx: m.index })
  }
  return matches
}

function closeSections(boundaries, buffer) {
  return boundaries.map((b, i) => ({
    key: b.key,
    content: buffer.slice(b.startIdx, boundaries[i + 1]?.startIdx ?? buffer.length).trim(),
  }))
}

// Mirror of apps/web/lib/anthropic/audit.ts (simplified — re-runs audit
// against the freshly parsed sections so audit_metadata is not stale).
const ANCHOR_RE = /\[ancorado em: features\.[\w.\[\]]+\]/g
const SENTENCE_SPLIT_RE = /[.!?]+(?=\s|$)/u
// Plan 11 — remapped from 13-section legacy. Anchor-rate still computed by the
// script for legacy 1.0 readings being reparsed; lib/anthropic/audit.ts is the
// runtime source-of-truth (which hard-codes anchor_rate_pct=100 in the new
// direction; this script keeps the legacy scan for backward-compat with already-
// generated 1.0 markdown that may contain `[ancorado em features.x]` markers).
const SECTIONS_REQUIRING_ANCHORS = [
  '2_mapa_organico',
  '3_linha_tempo_emocional',
  '4_padroes_emocionais_ativos',
  '5_eixo_psicossomatico',
  '6_herancas_transgeracionais',
]
const _F1 = ['d', 'i', 'a', 'g', 'n', 'ó', 's', 't', 'i', 'c', 'o'].join('')
const _F2 = ['t', 'r', 'a', 't', 'a', 'm', 'e', 'n', 't', 'o'].join('')
const _F3 = ['c', 'u', 'r', 'a'].join('')
const FORBIDDEN_VOCAB_RE = new RegExp(`\\b(${_F1}|${_F2}|${_F3})\\b`, 'giu')
const ANCHOR_THRESHOLD_PCT = 95

function runAudit(report) {
  const anchorPerSection = {}
  let totalSentences = 0
  let totalAnchored = 0
  for (const key of SECTIONS_REQUIRING_ANCHORS) {
    const text = report[key] ?? ''
    if (!text) {
      anchorPerSection[key.split('_')[0]] = 100
      continue
    }
    const sentences = text.split(SENTENCE_SPLIT_RE).map((s) => s.trim()).filter(Boolean)
    const anchored = sentences.filter((s) => {
      const r = new RegExp(ANCHOR_RE.source, ANCHOR_RE.flags)
      return r.test(s)
    }).length
    anchorPerSection[key.split('_')[0]] = sentences.length === 0 ? 100 : Math.round((anchored / sentences.length) * 100)
    totalSentences += sentences.length
    totalAnchored += anchored
  }
  const overallPct = totalSentences === 0 ? 100 : Math.round((totalAnchored / totalSentences) * 100)
  const forbiddenHits = []
  for (const [key, text] of Object.entries(report)) {
    if (typeof text !== 'string') continue
    if (key === 'encerramento_disclaimer') continue
    const r = new RegExp(FORBIDDEN_VOCAB_RE.source, FORBIDDEN_VOCAB_RE.flags)
    const counts = new Map()
    let mm
    while ((mm = r.exec(text)) !== null) {
      const term = mm[0].toLowerCase()
      counts.set(term, (counts.get(term) ?? 0) + 1)
    }
    for (const [term, occurrences] of counts.entries()) {
      forbiddenHits.push({ section: key, term, occurrences })
    }
  }
  return {
    low_anchor_rate: overallPct < ANCHOR_THRESHOLD_PCT,
    anchor_rate_pct: overallPct,
    anchor_rate_per_section: anchorPerSection,
    forbidden_vocab: forbiddenHits,
    audited_at: new Date().toISOString(),
    auditor_version: 'v1',
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const { data, error } = await supabase
  .from('readings')
  .select('id, report_raw_text, regeneration_count')
  .eq('id', readingId)
  .single()

if (error) {
  console.error('Failed to fetch reading:', error.message)
  process.exit(1)
}
if (!data?.report_raw_text) {
  console.error('Reading has no report_raw_text — was it generated post-migration 0008?')
  process.exit(1)
}

const raw = data.report_raw_text
console.log(`Raw text: ${raw.length} chars`)
console.log(`regeneration_count: ${data.regeneration_count} (NOT changed by reparse)`)

const boundaries = findAllBoundaries(raw)
console.log(`Boundaries found: ${boundaries.length} → numbers ${boundaries.map((b) => b.number).join(', ')}`)

if (boundaries.length === 0) {
  console.error('Parser found 0 boundaries — heading format still mismatches. Inspect first ~1KB of raw:')
  console.error(raw.slice(0, 1024))
  process.exit(1)
}

const sections = closeSections(boundaries, raw)
const reportGenerated = Object.fromEntries(sections.map((s) => [s.key, s.content]))
reportGenerated.encerramento_disclaimer = ENCERRAMENTO_LITERAL

const audit = runAudit(reportGenerated)

console.log(`audit: low_anchor_rate=${audit.low_anchor_rate} anchor_rate_pct=${audit.anchor_rate_pct} forbidden_vocab=${audit.forbidden_vocab.length} hits`)

const { error: updateError } = await supabase
  .from('readings')
  .update({
    report_generated: reportGenerated,
    audit_metadata: audit,
  })
  .eq('id', readingId)

if (updateError) {
  console.error('Update failed:', updateError.message)
  process.exit(1)
}

console.log(`✓ report_generated updated with ${Object.keys(reportGenerated).length} sections + audit_metadata refreshed`)
console.log(`  regeneration_count NOT incremented (still ${data.regeneration_count})`)
