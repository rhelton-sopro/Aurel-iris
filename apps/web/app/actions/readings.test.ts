import { describe, it, expect } from 'vitest'
import {
  createReadingSchema,
  readingIdSchema,
  CAPTURE_METHODS,
  type CaptureMethod,
  type DraftReading,
} from './readings.schemas'

// UUIDs válidos RFC 9562 (v4): 3o bloco começa com 4, 4o bloco começa com 8/9/a/b
// Zod v4 usa regex RFC estrita — UUIDs sintéticos como 1111..1111 são rejeitados.
const VALID_CLIENT_UUID = '865eaf2a-62b6-41b2-92ad-d601fd72705c'
const VALID_READING_UUID = '401288f4-0f02-43aa-bdee-16d501089dc9'

describe('createReadingSchema', () => {
  it('accepts a valid UUID client_id', () => {
    const r = createReadingSchema.safeParse({ client_id: VALID_CLIENT_UUID })
    expect(r.success).toBe(true)
  })

  it('rejects a non-UUID string', () => {
    const r = createReadingSchema.safeParse({ client_id: 'not-a-uuid' })
    expect(r.success).toBe(false)
  })

  it('rejects missing client_id', () => {
    const r = createReadingSchema.safeParse({})
    expect(r.success).toBe(false)
  })
})

describe('readingIdSchema', () => {
  it('accepts a valid UUID reading_id', () => {
    const r = readingIdSchema.safeParse({ reading_id: VALID_READING_UUID })
    expect(r.success).toBe(true)
  })

  it('rejects a non-UUID string', () => {
    const r = readingIdSchema.safeParse({ reading_id: 'foo' })
    expect(r.success).toBe(false)
  })
})

// CONTEXT D-03/D-04 — Phase 4 plan 04-02: createReadingSchema agora aceita method
// (enum mobile_camera | desktop_upload, default 'mobile_camera' para compat retroativa
// com chamadas Fase 3 que não enviam o campo).
describe('createReadingSchema (method field — Fase 4)', () => {
  it('uses default method=mobile_camera when omitted', () => {
    const r = createReadingSchema.safeParse({ client_id: VALID_CLIENT_UUID })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.method).toBe('mobile_camera')
  })

  it('accepts method=mobile_camera explicitly', () => {
    const r = createReadingSchema.safeParse({
      client_id: VALID_CLIENT_UUID,
      method: 'mobile_camera',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.method).toBe('mobile_camera')
  })

  it('accepts method=desktop_upload', () => {
    const r = createReadingSchema.safeParse({
      client_id: VALID_CLIENT_UUID,
      method: 'desktop_upload',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.method).toBe('desktop_upload')
  })

  it('rejects invalid method values', () => {
    const r = createReadingSchema.safeParse({
      client_id: VALID_CLIENT_UUID,
      method: 'random_method',
    })
    expect(r.success).toBe(false)
  })

  it('rejects empty string method', () => {
    const r = createReadingSchema.safeParse({
      client_id: VALID_CLIENT_UUID,
      method: '',
    })
    expect(r.success).toBe(false)
  })

  it('CAPTURE_METHODS is the canonical enum source', () => {
    expect(CAPTURE_METHODS).toEqual(['mobile_camera', 'desktop_upload'])
    // Type assertion smoke test (compiler-time check):
    const m: CaptureMethod = 'desktop_upload'
    expect(m).toBe('desktop_upload')
  })

  it('DraftReading type accepts capture_method field', () => {
    // Smoke test do tipo — se DraftReading não tiver capture_method, isto falha em compile-time.
    const draft: DraftReading = {
      id: VALID_READING_UUID,
      created_at: '2026-05-03T17:00:00Z',
      client_id: VALID_CLIENT_UUID,
      client_name: 'Cliente Teste',
      imagesCaptured: 3,
      capture_method: 'desktop_upload',
    }
    expect(draft.capture_method).toBe('desktop_upload')
  })
})
