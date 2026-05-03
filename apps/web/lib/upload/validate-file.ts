// apps/web/lib/upload/validate-file.ts
// Sem 'use client' / 'use server' — lib pura (roda no browser, sem IO).
//
// CONTEXT D-10 (validação técnica mínima MIME + tamanho).
// CONTEXT D-12 (limite 25 MB por foto).
//
// Esta lib é a primeira barreira de defesa em camadas (ASVS L1 V12.1.1/V12.1.2).
// O VLM gate (Wave 3) e o Storage RLS (Fase 1) são as barreiras subsequentes.
// Mensagens em pt-BR neutras — nenhum vocabulário proibido (LGPD).

const MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB — CONTEXT D-12

/** MIMEs aceitos diretamente. HEIC/HEIF são aceitos como input, mas passam por
 *  convertHeicToJpeg antes de chegar no VLM (CONTEXT D-11). */
export const ACCEPTED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

/** MIMEs que requerem conversão client-side antes de qualquer processamento. */
export const HEIC_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/heic',
  'image/heif',
])

export interface FileValidationResult {
  ok: boolean
  error?: string
  needsHeicConversion?: boolean
}

/**
 * Valida MIME type e tamanho do arquivo antes de qualquer processamento.
 * Puro e síncrono — sem IO. Mensagens pt-BR neutras (sem vocabulário proibido LGPD).
 *
 * Fallback por extensão: alguns SOs (Windows < 11, macOS antigos) omitem MIME
 * para .heic/.heif. Sempre comparar a extensão também — defesa em profundidade
 * para a UX de drag-and-drop não rejeitar HEICs legítimos por causa de MIME ausente.
 */
export function validateUploadFile(file: File): FileValidationResult {
  const mime = file.type.toLowerCase()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  const isHeic = HEIC_MIME_TYPES.has(mime) || ext === 'heic' || ext === 'heif'
  const isAccepted = ACCEPTED_MIME_TYPES.has(mime) || isHeic

  if (!isAccepted) {
    return {
      ok: false,
      error: 'Formato não suportado. Use JPEG, PNG, WebP ou HEIC.',
    }
  }

  // Limite inclusivo: file.size === MAX_SIZE_BYTES é aceito (boundary).
  if (file.size > MAX_SIZE_BYTES) {
    return {
      ok: false,
      error: 'Foto muito grande, máximo 25 MB. Verifique o formato (RAW e PNG não comprimido podem exceder o limite).',
    }
  }

  return { ok: true, needsHeicConversion: isHeic }
}
