import type { Eye } from './iris-geometry'
import type { Angle } from './sequence'

/**
 * CONTEXT D-storage: path = {therapist_id}/{reading_id}/{eye}_{angle}.jpg
 *
 * Bucket "iris-captures" tem RLS folder-based — auth.uid()::text deve igualar
 * o primeiro segmento da pasta (criado em 03-01 migration 0004).
 *
 * T-03-07-01: buildStoragePath inclui therapist_id (RLS) + reading_id (UUID);
 * validação de segmento impede path traversal client-side.
 */
export function buildStoragePath(
  therapistId: string,
  readingId: string,
  eye: Eye,
  angle: Angle
): string {
  validateSegment(therapistId, 'therapistId')
  validateSegment(readingId, 'readingId')
  return `${therapistId}/${readingId}/${eye}_${angle}.jpg`
}

function validateSegment(value: string, name: string): void {
  if (!value || typeof value !== 'string') {
    throw new Error(`[storage-path] ${name} é obrigatório`)
  }
  if (value.includes('/') || value.includes('..') || value.includes('\\')) {
    throw new Error(`[storage-path] ${name} contém caracteres inválidos`)
  }
}
