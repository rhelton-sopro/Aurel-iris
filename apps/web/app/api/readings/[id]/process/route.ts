/**
 * POST /api/readings/[id]/process
 *
 * Triggers the Modal `analyze_iris_endpoint` for a reading owned by the
 * authenticated therapist. Same route is hit by:
 *   - finalizeReadingAction (auto, after 6/6 captures) — D-T1
 *   - the "Reprocessar" button on /leituras failed rows — D-T3
 *
 * Contract:
 *   - 401 when no Supabase session.
 *   - 404 when reading is not owned by the user OR status not in {pending, failed}.
 *   - 502 when Modal trigger fails (rollback to status='failed').
 *   - 202 with empty body on success.
 *
 * Honors:
 *   - D-T5 modal_call_id placeholder + replacement.
 *   - D-T6 TTL=600s on signed URLs.
 *   - D-F5 atomic UPDATE (single .update() call per phase).
 */
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  ModalTriggerError,
  triggerVisionPipeline,
  type ImageUrlEntry,
} from '@/lib/vision/modal-client'

export const runtime = 'nodejs'

const SIGNED_URL_TTL_SECONDS = 600 // D-T6
const STATUSES_RETRIGGERABLE = new Set(['pending', 'failed'])
const FALLBACK_ERROR_SUMMARY = 'Falha temporária no processamento — tente novamente' // D-E1

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: readingId } = await params

  // 1. Auth gate (user client)
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  // 2. Ownership + retriggerability guard (RLS-enforced via user client)
  const { data: reading, error: readingError } = await supabase
    .from('readings')
    .select('id, status, therapist_id')
    .eq('id', readingId)
    .eq('therapist_id', user.id)
    .single()
  if (readingError || !reading) {
    return NextResponse.json({ error: 'Reading not found' }, { status: 404 })
  }
  if (!STATUSES_RETRIGGERABLE.has(reading.status ?? '')) {
    return NextResponse.json(
      { error: `Reading status '${reading.status}' is not retriggerable` },
      { status: 404 },
    )
  }

  // 3. Fetch the 6 reading_images
  const { data: images, error: imagesError } = await supabase
    .from('reading_images')
    .select('eye, angle, storage_path')
    .eq('reading_id', readingId)
  if (imagesError || !images || images.length === 0) {
    return NextResponse.json({ error: 'No images for this reading' }, { status: 404 })
  }

  // 4. Generate signed URLs (TTL=600s per D-T6) — service client avoids RLS path tax
  const serviceClient = createServiceClient()
  const paths = images.map((img) => img.storage_path)
  const { data: signedData, error: signedError } = await serviceClient.storage
    .from('iris-captures')
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
  if (signedError || !signedData) {
    return NextResponse.json(
      { error: `Failed to generate signed URLs: ${signedError?.message ?? 'unknown'}` },
      { status: 500 },
    )
  }

  const imageUrls: ImageUrlEntry[] = images.map((img, idx) => {
    const signed = signedData[idx]
    if (!signed?.signedUrl) {
      throw new Error(`Missing signed URL for ${img.storage_path}`)
    }
    return {
      eye: img.eye as 'right' | 'left',
      angle: img.angle as 'frontal' | 'lateral' | 'backlight',
      url: signed.signedUrl,
    }
  })

  // 5. Pre-spawn UPDATE: status='processing' + placeholder modal_call_id (D-T5)
  const { error: preUpdateError } = await serviceClient
    .from('readings')
    .update({
      status: 'processing',
      vision_features: { processing_metadata: { modal_call_id: 'pending' } },
    })
    .eq('id', readingId)
  if (preUpdateError) {
    return NextResponse.json(
      { error: `Pre-spawn update failed: ${preUpdateError.message}` },
      { status: 500 },
    )
  }

  // 6. Call Modal endpoint
  let callId: string
  try {
    const result = await triggerVisionPipeline({ readingId, imageUrls })
    callId = result.callId
  } catch (err) {
    // Rollback to 'failed' so terapeuta sees a failure state and can Reprocessar.
    const errorMessage = err instanceof ModalTriggerError ? err.message : 'unknown'
    await serviceClient
      .from('readings')
      .update({
        status: 'failed',
        vision_features: {
          processing_metadata: {
            modal_call_id: 'failed',
            error_summary: FALLBACK_ERROR_SUMMARY,
          },
        },
      })
      .eq('id', readingId)
    revalidatePath('/leituras')
    return NextResponse.json(
      { error: `Modal trigger failed: ${errorMessage}` },
      { status: 502 },
    )
  }

  // 7. Post-spawn UPDATE: replace placeholder with real call_id (D-T5)
  await serviceClient
    .from('readings')
    .update({
      vision_features: { processing_metadata: { modal_call_id: callId } },
    })
    .eq('id', readingId)

  revalidatePath('/leituras')
  return new NextResponse(null, { status: 202 })
}
