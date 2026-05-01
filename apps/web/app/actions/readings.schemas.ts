import { z } from 'zod'

export const createReadingSchema = z.object({
  client_id: z.string().uuid('client_id inválido'),
})

export const readingIdSchema = z.object({
  reading_id: z.string().uuid('reading_id inválido'),
})

export type ReadingFormState = {
  error?: Record<string, string[]> | string | null
  readingId?: string
}

export type DraftReading = {
  id: string
  created_at: string
  client_id: string
  client_name: string
  imagesCaptured: number
}
