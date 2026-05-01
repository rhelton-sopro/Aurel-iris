import { describe, it, expect } from 'vitest'
import { createReadingSchema, readingIdSchema } from './readings'

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
