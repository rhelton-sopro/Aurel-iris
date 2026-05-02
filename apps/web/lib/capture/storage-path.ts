import type { Eye } from './iris-geometry'
import type { Angle } from './sequence'

/**
 * CONTEXT D-storage:
 *   - Recortado (UI/preview):  {therapist_id}/{reading_id}/recortadas/{eye}_{angle}.jpg
 *   - Original (Fase 5 / vision pipeline): {therapist_id}/{reading_id}/originais/{eye}_{angle}.jpg
 *
 * Bucket "iris-captures" tem RLS folder-based — auth.uid()::text deve igualar
 * o primeiro segmento da pasta (criado em 03-01 migration 0004). O therapist_id
 * permanece como folder[0] em ambos os esquemas; sub-pastas (originais/recortadas)
 * vêm depois e não afetam RLS.
 *
 * Convenção: storage_path em reading_images aponta para o RECORTADO (consumido
 * pela UI). O original é descoberto trocando "/recortadas/" por "/originais/".
 *
 * T-03-07-01: paths incluem therapist_id (RLS) + reading_id (UUID);
 * validação de segmento impede path traversal client-side.
 */

export function buildCroppedStoragePath(
  therapistId: string,
  readingId: string,
  eye: Eye,
  angle: Angle,
): string {
  validateSegment(therapistId, 'therapistId')
  validateSegment(readingId, 'readingId')
  return `${therapistId}/${readingId}/recortadas/${eye}_${angle}.jpg`
}

export function buildOriginalStoragePath(
  therapistId: string,
  readingId: string,
  eye: Eye,
  angle: Angle,
): string {
  validateSegment(therapistId, 'therapistId')
  validateSegment(readingId, 'readingId')
  return `${therapistId}/${readingId}/originais/${eye}_${angle}.jpg`
}

/**
 * @deprecated Use `buildCroppedStoragePath`. Kept for tests and callers que
 * ainda usam o esquema antigo `{therapist}/{reading}/{eye}_{angle}.jpg`.
 */
export function buildStoragePath(
  therapistId: string,
  readingId: string,
  eye: Eye,
  angle: Angle,
): string {
  return buildCroppedStoragePath(therapistId, readingId, eye, angle)
}

function validateSegment(value: string, name: string): void {
  if (!value || typeof value !== 'string') {
    throw new Error(`[storage-path] ${name} é obrigatório`)
  }
  if (value.includes('/') || value.includes('..') || value.includes('\\')) {
    throw new Error(`[storage-path] ${name} contém caracteres inválidos`)
  }
}
