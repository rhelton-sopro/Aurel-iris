import { z } from 'zod'

// CONTEXT D-03/D-04 (Fase 4): enum unico de metodos de captura, exportado para
// reuso (UI pode importar para validar hidden inputs antes do submit, e o tipo
// CaptureMethod e' a fonte canonica da uniao 'mobile_camera' | 'desktop_upload').
// Compativel com o enum readings.capture_method ja existente no schema do banco
// (sem migration nesta fase).
export const CAPTURE_METHODS = ['mobile_camera', 'desktop_upload'] as const
export type CaptureMethod = (typeof CAPTURE_METHODS)[number]

export const createReadingSchema = z.object({
  client_id: z.string().uuid('client_id inválido'),
  // CONTEXT D-03: metodo vem do FormData (hidden input em new-reading-form.tsx).
  // Default 'mobile_camera' preserva compat retroativa com chamadas Fase 3 que
  // nao enviam o campo. Imutabilidade no draft (D-04) e' responsabilidade do
  // page.tsx do upload (guard se reading.capture_method === 'mobile_camera' ->
  // redirect /capturar) — nao do schema.
  method: z.enum(CAPTURE_METHODS).default('mobile_camera'),
})

export const readingIdSchema = z.object({
  reading_id: z.string().uuid('reading_id inválido'),
})

export type ReadingFormState = {
  error?: Record<string, string[]> | string | null
  readingId?: string
  warning?: string
}

export type DraftReading = {
  id: string
  created_at: string
  client_id: string
  client_name: string
  imagesCaptured: number
  // CONTEXT D-15: RecoveryBanner (Fase 9) usa capture_method para rotear
  // /upload?reading=<id>&resume=true vs /capturar?reading=<id>&resume=true.
  capture_method: CaptureMethod
}
