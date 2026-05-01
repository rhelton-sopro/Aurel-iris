import { describe, it, expect } from 'vitest'
import { createReadingSchema, readingIdSchema } from './readings'

describe('createReadingSchema', () => {
  it('accepts a valid UUID client_id', () => {
    const r = createReadingSchema.safeParse({ client_id: '11111111-1111-1111-1111-111111111111' })
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
    const r = readingIdSchema.safeParse({ reading_id: '22222222-2222-2222-2222-222222222222' })
    expect(r.success).toBe(true)
  })

  it('rejects a non-UUID string', () => {
    const r = readingIdSchema.safeParse({ reading_id: 'foo' })
    expect(r.success).toBe(false)
  })
})
