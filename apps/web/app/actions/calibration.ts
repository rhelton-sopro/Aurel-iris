'use server'

/**
 * Server Actions for /admin/calibration ground-truth annotations.
 *
 * - saveAnnotation(prev, formData):
 *     1. Auth + founder gate (defense-in-depth — middleware + layout already enforce)
 *     2. Zod validation
 *     3. UPSERT by reading_id (UNIQUE constraint guarantees one row per reading)
 *     4. revalidatePath
 *
 * - markReviewed(readingId):
 *     1. Auth + founder gate
 *     2. UPDATE reviewed=true, reviewed_at=NOW()
 *     3. revalidatePath
 *
 * Phase 7.1 | Plan 07.1-03 Task 5.
 */
import { isFounderEmail } from '@/lib/auth/founder'
import {
  CONSTITUTION_OPTIONS,
  IRIS_COLOR_OPTIONS,
  type AnnotationFormState,
} from '@/lib/calibration/constants'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// NOTE: Do NOT export non-async values (constants, types) from this file.
// Files marked 'use server' treat every export as a Server Action (RPC stub).
// Constants imported by client components from a 'use server' file arrive
// as opaque references in production builds, breaking .map() / .length / etc.
// Shared constants live in '@/lib/calibration/constants' instead.

const annotationSchema = z.object({
  reading_id: z.string().uuid(),
  real_iris_color: z.enum(IRIS_COLOR_OPTIONS),
  real_constitution: z.enum(CONSTITUTION_OPTIONS),
  findings_correct: z.string().max(4000).default(''),
  findings_invented: z.string().max(4000).default(''),
  findings_missed: z.string().max(4000).default(''),
  notes: z.string().max(4000).default(''),
})

export async function saveAnnotation(
  _prev: AnnotationFormState,
  formData: FormData,
): Promise<AnnotationFormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isFounderEmail(user.email)) {
    return { error: 'Forbidden' }
  }

  const parsed = annotationSchema.safeParse({
    reading_id: formData.get('reading_id'),
    real_iris_color: formData.get('real_iris_color'),
    real_constitution: formData.get('real_constitution'),
    findings_correct: formData.get('findings_correct') ?? '',
    findings_invented: formData.get('findings_invented') ?? '',
    findings_missed: formData.get('findings_missed') ?? '',
    notes: formData.get('notes') ?? '',
  })

  if (!parsed.success) {
    return {
      error: 'Dados inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const { error } = await supabase
    .from('calibration_annotations')
    .upsert(
      {
        ...parsed.data,
        annotated_by: user.id,
        annotated_at: new Date().toISOString(),
        // Re-saving an annotation flips back to 'anotado' (not reviewed) so the
        // founder must explicitly mark reviewed again after editing.
        reviewed: false,
        reviewed_at: null,
      },
      { onConflict: 'reading_id' },
    )

  if (error) return { error: error.message }

  revalidatePath(`/admin/calibration/${parsed.data.reading_id}`)
  revalidatePath('/admin/calibration')
  return { ok: true }
}

export async function markReviewed(
  readingId: string,
): Promise<AnnotationFormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isFounderEmail(user.email)) {
    return { error: 'Forbidden' }
  }

  const idParsed = z.string().uuid().safeParse(readingId)
  if (!idParsed.success) return { error: 'reading_id inválido' }

  const { error } = await supabase
    .from('calibration_annotations')
    .update({ reviewed: true, reviewed_at: new Date().toISOString() })
    .eq('reading_id', idParsed.data)

  if (error) return { error: error.message }

  revalidatePath(`/admin/calibration/${idParsed.data}`)
  revalidatePath('/admin/calibration')
  return { ok: true }
}
