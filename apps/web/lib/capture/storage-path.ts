import type { Eye } from './iris-geometry'
import type { Angle } from './sequence'

/**
 * CONTEXT D-storage:
 *   Path único: {therapist_id}/{reading_id}/originais/{eye}_{angle}.jpg
 *
 * O JPEG salvo é o ORIGINAL completo da câmera nativa — sem recompressão
 * mobile. O crop iridológico é responsabilidade do pipeline Modal (Fase 5),
 * que lê os arquivos sob `originais/` e produz o JSON de features.
 *
 * Bucket "iris-captures" tem RLS folder-based — auth.uid()::text deve igualar
 * o primeiro segmento da pasta (criado em 03-01 migration 0004). therapist_id
 * permanece como folder[0]; sub-pasta `originais` vem depois e não afeta RLS.
 *
 * T-03-07-01: validação de segmento impede path traversal client-side.
 */

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

function validateSegment(value: string, name: string): void {
  if (!value || typeof value !== 'string') {
    throw new Error(`[storage-path] ${name} é obrigatório`)
  }
  if (value.includes('/') || value.includes('..') || value.includes('\\')) {
    throw new Error(`[storage-path] ${name} contém caracteres inválidos`)
  }
}
