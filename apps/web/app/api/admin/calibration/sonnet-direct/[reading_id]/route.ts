/**
 * POST /api/admin/calibration/sonnet-direct/[reading_id]
 *
 * Phase 7.4 calibration harness — Column C (ANÁLISE DIRETA SONNET). Runs the
 * NO-pipeline / NO-RAG branch: Sonnet looks at the reading's 6 ORIGINAL
 * stored photos directly and produces the full 15-section report. Writes
 * ONLY to the dedicated `*_sonnet_direct` columns — production
 * `vision_features` / `report_generated` and the SAM columns are never
 * touched.
 *
 * Thin wrapper: founder gate (defense-in-depth; middleware also guards
 * /api/admin/*) + delegate to generateSonnetDirectReport. Needs NO Modal
 * (Column C bypasses segmentation entirely) — only ANTHROPIC_API_KEY.
 *
 * Cost: one Sonnet call with 6 images (~$0.05–0.15 input + output) — logged
 * to report_generations alongside the latency/token instrumentation.
 *
 * Phase 7.4 | Column C | calibration harness
 */
import 'server-only'
import { NextResponse } from 'next/server'

import { isFounderEmail } from '@/lib/auth/founder'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateSonnetDirectReport } from '@/lib/calibration/generate-sonnet-direct'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ reading_id: string }> },
): Promise<NextResponse> {
  const { reading_id: readingId } = await params

  // Founder gate (404 to non-founders — same as sibling admin routes).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isFounderEmail(user.email)) {
    return new NextResponse(null, { status: 404 })
  }

  const service = createServiceClient()
  const result = await generateSonnetDirectReport(service, readingId, user.id)

  if (!result.ok) {
    const httpStatus =
      result.status === 'reading_not_found'
        ? 404
        : result.status === 'no_images'
          ? 400
          : 502
    return NextResponse.json(result, { status: httpStatus })
  }

  return NextResponse.json(result)
}
