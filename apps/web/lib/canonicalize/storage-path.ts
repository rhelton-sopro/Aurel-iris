/**
 * Phase 07.1.6 — canonical crop storage path.
 *
 * Mirror de `apps/web/lib/capture/storage-path.ts` (originais/), differing
 * ONLY na sub-pasta:
 *   {therapistId}/{readingId}/canonical/{eye}_{angle}.jpg
 *
 * Originais nunca são sobrescritos — `canonical/` é additive sibling de
 * `originais/`. O caller do upload usa este path em
 * `service.storage.from('iris-captures').upload(path, buf, { upsert: true })`
 * e em `reading_images.canonical_storage_path` (coluna nullable de
 * migration 0012_canonical_capture).
 *
 * RLS folder-based (bucket iris-captures, migration 0004) honra o primeiro
 * segmento `therapist_id`. Sub-pasta `canonical/` é transparente pra policy —
 * o bucket continua privado por terapeuta + service-role-only writes.
 *
 * T-03-07-01 segment validation replicated literal de storage-path.ts pra
 * defender contra path-traversal mesmo com input vindo de server-side state
 * (defense-in-depth: caller já passou auth gate em route.ts, mas reading_id
 * e therapist_id chegam aqui como strings opacas).
 *
 * Phase 07.1.6 | Plan 03 Task 1 | Decisions: C-01 (canonical via Sonnet bbox),
 * "Originais nunca sobrescritos" (must_haves)
 */
import type { Eye } from '@/lib/capture/iris-geometry'
import type { Angle } from '@/lib/capture/sequence'

export function buildCanonicalStoragePath(
  therapistId: string,
  readingId: string,
  eye: Eye,
  angle: Angle,
): string {
  validateSegment(therapistId, 'therapistId')
  validateSegment(readingId, 'readingId')
  return `${therapistId}/${readingId}/canonical/${eye}_${angle}.jpg`
}

function validateSegment(value: string, name: string): void {
  if (!value || typeof value !== 'string') {
    throw new Error(`[canonicalize/storage-path] ${name} é obrigatório`)
  }
  if (value.includes('/') || value.includes('..') || value.includes('\\')) {
    throw new Error(`[canonicalize/storage-path] ${name} contém caracteres inválidos`)
  }
}
