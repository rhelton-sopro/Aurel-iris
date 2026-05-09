'use server'

/**
 * Server Actions for /admin/calibration tooling.
 *
 * Structured corpus (calibration_annotations, ML use):
 * - saveAnnotation(prev, formData) — UPSERT structured fields
 * - markReviewed(readingId) — set reviewed=true
 *
 * Operational document (calibration_diagnoses, free text from external analysis):
 * - saveCalibrationDiagnosis(prev, formData) — UPSERT free-text diagnosis
 *
 * All actions: founder gate via isFounderEmail (defense-in-depth — middleware
 * + layout already enforce).
 *
 * Phase 7.1 | Plan 07.1-03 + iterative-calibration follow-up.
 */
import { isFounderEmail } from '@/lib/auth/founder'
import {
  CONSTITUTION_OPTIONS,
  DIAGNOSIS_MAX_CHARS,
  IRIS_COLOR_OPTIONS,
  type AnnotationFormState,
  type DiagnosisFormState,
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

const diagnosisSchema = z.object({
  reading_id: z.string().uuid(),
  diagnosis: z.string().max(DIAGNOSIS_MAX_CHARS),
})

export async function saveCalibrationDiagnosis(
  _prev: DiagnosisFormState,
  formData: FormData,
): Promise<DiagnosisFormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isFounderEmail(user.email)) {
    return { error: 'Forbidden' }
  }

  const parsed = diagnosisSchema.safeParse({
    reading_id: formData.get('reading_id'),
    diagnosis: formData.get('diagnosis') ?? '',
  })

  if (!parsed.success) {
    return { error: 'Dados inválidos' }
  }

  const { error } = await supabase
    .from('calibration_diagnoses')
    .upsert(
      {
        reading_id: parsed.data.reading_id,
        diagnosed_by: user.id,
        diagnosis: parsed.data.diagnosis,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'reading_id' },
    )

  if (error) return { error: error.message }

  revalidatePath(`/admin/calibration/${parsed.data.reading_id}`)
  revalidatePath('/admin/calibration')
  return { ok: true }
}
