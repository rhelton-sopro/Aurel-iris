import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('createServiceClient', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    // server-only is a no-op in vitest (jsdom env shouldn't import this in real life)
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sk-test'
    const mod = await import('./service')
    expect(() => mod.createServiceClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const mod = await import('./service')
    expect(() => mod.createServiceClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)
  })

  it('returns a SupabaseClient when both env vars are set', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sk-test'
    const mod = await import('./service')
    const client = mod.createServiceClient()
    expect(client).toBeDefined()
    // Smoke check: client exposes from() and storage
    expect(typeof client.from).toBe('function')
    expect(client.storage).toBeDefined()
  })
})
