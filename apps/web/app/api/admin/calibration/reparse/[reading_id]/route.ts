/**
 * POST /api/admin/calibration/reparse/[reading_id]
 *
 * Re-parses `readings.report_raw_text` with the current parser and rewrites
 * `report_generated` + refreshed `audit_metadata`. Skips the Anthropic call.
 *
 * Use case: a regen produced a real LLM report (40KB buffer in report_raw_text)
 * but the parser missed every section boundary (e.g. f4408c23 2026-05-12 —
 * Sonnet drifted to `## §N — Title` format that the old regex didn't match).
 * The founder ships a parser fix, then hits THIS endpoint to recover the
 * original output WITHOUT burning another $0.30 regen.
 *
 * Founder-only (defense-in-depth admin gate; middleware also protects /admin/*
 * but /api/admin/* is a separate matcher). Service-role writes bypass RLS
 * because the founder owns the readings being inspected anyway.
 *
 * Side effects:
 *   - readings.report_generated overwritten with parsed sections + appended
 *     ENCERRAMENTO_LITERAL
 *   - readings.audit_metadata refreshed (audit re-runs over the new sections)
 *   - regeneration_count NOT incremented (no LLM call → not a regeneration)
 *   - regeneration_log NOT appended
 *
 * Response:
 *   { reading_id, sections_parsed, keys, buffer_length, audit_anchor_rate_pct }
 *
 * Phase 07.1.6 UAT-1 follow-up (2026-05-12).
 */
import 'server-only'
import { NextResponse } from 'next/server'

import { runAudit } from '@/lib/anthropic/audit'
import { findAllBoundaries, closeSections } from '@/lib/anthropic/parser'
import { ENCERRAMENTO_LITERAL, type ReportJsonb } from '@/lib/anthropic/types'
import { isFounderEmail } from '@/lib/auth/founder'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ reading_id: string }> },
): Promise<NextResponse> {
  const { reading_id: readingId } = await params

  // 1. Founder gate (defense-in-depth — middleware also guards /admin/*).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isFounderEmail(user.email)) {
    return new NextResponse(null, { status: 404 })
  }

  // 2. Service-role fetch report_raw_text (admin sees cross-therapist).
  const service = createServiceClient()
  const { data: reading, error: fetchError } = await service
    .from('readings')
    .select('id, report_raw_text')
    .eq('id', readingId)
    .single()
  if (fetchError || !reading) {
    return NextResponse.json({ error: 'Reading not found' }, { status: 404 })
  }

  const buffer = ((reading.report_raw_text as string | null) ?? '').trim()
  if (buffer.length === 0) {
    return NextResponse.json(
      {
        error:
          'No report_raw_text on this reading — nothing to re-parse. Run /analyze first to populate the buffer.',
      },
      { status: 400 },
    )
  }

  // 3. Re-parse with current parser (the same one /analyze uses post-stream).
  const boundaries = findAllBoundaries(buffer)

  // 3a. Diagnostic short-circuit: if parser found ZERO boundaries, return a
  //     forensic dump instead of overwriting report_generated with just the
  //     encerramento. This is the recovery surface for parser regex drift —
  //     founder sees exactly what's in the buffer + char codes of any
  //     heading-like lines without needing SQL access.
  if (boundaries.length === 0) {
    const headingCandidates: Array<{
      line: number
      preview: string
      starts_with_hashes: number
      first_30_char_codes: number[]
    }> = []
    const lines = buffer.split('\n')
    for (let i = 0; i < lines.length && headingCandidates.length < 10; i++) {
      const line = lines[i]!
      // Capture anything that LOOKS like a heading candidate — leading whitespace
      // optional, then 1+ hash, then non-space char. Permissive so we catch
      // whatever Sonnet emitted regardless of regex shape.
      if (/^\s*#+\s*\S/.test(line)) {
        headingCandidates.push({
          line: i,
          preview: line.slice(0, 100),
          starts_with_hashes: (line.match(/^\s*(#+)/) ?? ['', ''])[1]!.length,
          first_30_char_codes: Array.from(line.slice(0, 30)).map(c => c.codePointAt(0)!),
        })
      }
    }
    console.error(
      `[reparse-report] zero boundaries reading=${readingId} buffer_length=${buffer.length} heading_candidates=${headingCandidates.length}`,
    )
    return NextResponse.json(
      {
        reading_id: readingId,
        sections_parsed: 0,
        boundaries_found: 0,
        buffer_length: buffer.length,
        diagnostic: {
          sample_head: buffer.slice(0, 500),
          sample_head_char_codes: Array.from(buffer.slice(0, 50)).map(c =>
            c.codePointAt(0)!,
          ),
          heading_candidates: headingCandidates,
          has_crlf: buffer.includes('\r\n'),
          has_bare_cr: buffer.includes('\r') && !buffer.includes('\r\n'),
          has_bom: buffer.charCodeAt(0) === 0xfeff,
        },
      },
      { status: 200 },
    )
  }

  const closedSections = closeSections(boundaries, buffer)
  const completedSections: ReportJsonb = {}
  for (const section of closedSections) {
    completedSections[section.key] = section.content
  }
  // D-P3: encerramento_disclaimer is server-appended (parity with /analyze).
  completedSections.encerramento_disclaimer = ENCERRAMENTO_LITERAL

  // 4. Refresh audit over the re-parsed sections.
  const audit = runAudit(completedSections)

  // 5. Persist. NO regen_count increment — re-parse is a recovery action, not
  //    a regeneration. report_generated_at intentionally untouched to preserve
  //    the original generation timestamp for telemetry.
  const { error: writeError } = await service
    .from('readings')
    .update({
      report_generated: completedSections,
      audit_metadata: audit as unknown as never,
    })
    .eq('id', readingId)
  if (writeError) {
    return NextResponse.json(
      { error: `Failed to persist re-parsed report: ${writeError.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({
    reading_id: readingId,
    sections_parsed: Object.keys(completedSections).length,
    keys: Object.keys(completedSections),
    buffer_length: buffer.length,
    boundaries_found: boundaries.length,
    audit_anchor_rate_pct: audit.anchor_rate_pct,
  })
}
