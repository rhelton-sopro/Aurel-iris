// Shared constants for the /admin/calibration tooling.
//
// Lives OUTSIDE app/actions/calibration.ts because that file uses the
// 'use server' directive — Next.js treats every export from a 'use server'
// file as a Server Action (RPC stub). Constant arrays exported from there
// arrive at client components as opaque RPC references in production builds,
// not as arrays — calling .map() on them throws "X.map is not a function".
//
// Anti-pattern that bit us in Phase 7.1 (PLAN 07.1-03):
//   // app/actions/calibration.ts
//   'use server'
//   export const IRIS_COLOR_OPTIONS = [...] as const  // ← BAD: not an async function
//
// Correct pattern: declare consts/types in a non-server module and import
// from BOTH the server actions file (zod enums) AND the client form
// (option mapping).
import type { Database } from '@/types/database'

export const IRIS_COLOR_OPTIONS = [
  'azul',
  'verde',
  'castanho',
  'mista_biliar',
  'mista_hematogenea',
  'outra',
] as const

export const CONSTITUTION_OPTIONS = [
  'linfatica',
  'biliar',
  'hematogenea',
  'mista_biliar',
  'mista_hematogenea',
  'neurogenica',
] as const

export type IrisColorOption = (typeof IRIS_COLOR_OPTIONS)[number]
export type ConstitutionOption = (typeof CONSTITUTION_OPTIONS)[number]

// Form action state — referenced by both AnnotationForm (RCC, useActionState)
// and saveAnnotation (server action return type). Lives here for the same
// 'use server' export hygiene reason.
export type AnnotationFormState = {
  ok?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

// Convenience type alias — kept here so any consumer that needs the row shape
// without round-tripping through Database['public']['Tables']['...'] can grab it.
export type CalibrationAnnotationRow =
  Database['public']['Tables']['calibration_annotations']['Row']
