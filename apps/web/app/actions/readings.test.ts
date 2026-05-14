import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createReadingSchema,
  readingIdSchema,
  CAPTURE_METHODS,
  type CaptureMethod,
  type DraftReading,
} from './readings.schemas'

// Mocks hoisted por vitest — declarados aqui para cobrir a action import abaixo.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    // Espelha Next.js redirect() — lança para curto-circuitar o corpo da action.
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    toString: () => 'sb-access-token=test-token; sb-refresh-token=test-refresh',
  })),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
  })),
}))

import { finalizeReadingAction } from './readings'

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

// CONTEXT D-15 (Fase 4 — Plan 04-07): smoke test do contrato DraftReading.capture_method
// que a Fase 9 (RecoveryBanner UI) vai consumir. Esta fase entrega APENAS o backend hook —
// o componente RecoveryBanner.tsx visual ficou explicitamente deferido pra Fase 9 alinhado
// com STATE.md ("RecoveryBanner D-12 e PWAInstallBanner D-14 deferidos pra Fase 9 — polish
// pré-beta"). Os testes abaixo documentam:
//   1. Shape do DraftReading (compile-time + runtime) com ambos os valores de capture_method.
//   2. Lógica de roteamento que Fase 9 implementará (forward — same source of truth).
//   3. Vocabulário neutro (sem termos LGPD-proibidos).
// TypeScript já rejeita capture_method='other_value' em compile-time (CaptureMethod = enum
// canônico em readings.schemas.ts) — não testável runtime, mas garantido pelo tsc.
describe('DraftReading shape (Phase 4 — D-15 recovery routing)', () => {
  it('accepts capture_method=mobile_camera', () => {
    const draft: DraftReading = {
      id: VALID_READING_UUID,
      created_at: '2026-05-03T00:00:00.000Z',
      client_id: VALID_CLIENT_UUID,
      client_name: 'Test Client',
      imagesCaptured: 3,
      capture_method: 'mobile_camera',
    }
    expect(draft.capture_method).toBe('mobile_camera')
  })

  it('accepts capture_method=desktop_upload', () => {
    const draft: DraftReading = {
      id: VALID_READING_UUID,
      created_at: '2026-05-03T00:00:00.000Z',
      client_id: VALID_CLIENT_UUID,
      client_name: 'Test Client',
      imagesCaptured: 0,
      capture_method: 'desktop_upload',
    }
    expect(draft.capture_method).toBe('desktop_upload')
  })

  it('uses capture_method to determine recovery route (forward to Fase 9)', () => {
    const draft: DraftReading = {
      id: VALID_READING_UUID,
      created_at: '2026-05-03T00:00:00.000Z',
      client_id: VALID_CLIENT_UUID,
      client_name: 'Test Client',
      imagesCaptured: 0,
      capture_method: 'desktop_upload',
    }
    // Lógica que a Fase 9 RecoveryBanner.tsx vai usar:
    const expectedRoute = draft.capture_method === 'desktop_upload'
      ? `/leituras/nova/upload?reading=${draft.id}&resume=true`
      : `/leituras/nova/capturar?reading=${draft.id}&resume=true`
    expect(expectedRoute).toBe(`/leituras/nova/upload?reading=${draft.id}&resume=true`)
  })

  it('mobile_camera draft routes to /capturar', () => {
    const draft: DraftReading = {
      id: VALID_READING_UUID,
      created_at: '2026-05-03T00:00:00.000Z',
      client_id: VALID_CLIENT_UUID,
      client_name: 'Test Client',
      imagesCaptured: 2,
      capture_method: 'mobile_camera',
    }
    const expectedRoute = draft.capture_method === 'desktop_upload'
      ? `/leituras/nova/upload?reading=${draft.id}&resume=true`
      : `/leituras/nova/capturar?reading=${draft.id}&resume=true`
    expect(expectedRoute).toBe(`/leituras/nova/capturar?reading=${draft.id}&resume=true`)
  })
})

// ---------------------------------------------------------------------------
// Phase 5 (plan 05-13): finalizeReadingAction trigger semantics
// ---------------------------------------------------------------------------

const READING_ID = '550e8400-e29b-41d4-a716-446655440000'
const ORIGINAL_FETCH = globalThis.fetch

describe('finalizeReadingAction — Phase 5 trigger', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://iris-codex.test'
  })
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH
    vi.clearAllMocks()
  })

  it('calls POST /api/readings/<id>/process with cookie + no-store cache (Phase 07.1.6: also POSTs canonicalize first)', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
    globalThis.fetch = fetchMock as typeof globalThis.fetch

    await expect(finalizeReadingAction(READING_ID)).rejects.toThrow(
      /NEXT_REDIRECT:\/leituras/,
    )

    // Phase 07.1.6 Plan 05: finalize agora dispara 2 fetches —
    //   1) POST /api/capture/canonicalize (fire-and-forget, D-01 never blocks)
    //   2) POST /api/readings/<id>/process (Modal trigger, D-T1)
    // Validamos ambos os contratos abaixo.
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // Call 1: canonicalize (fire-and-forget, must come BEFORE Modal trigger)
    const [canonicalUrl, canonicalInit] = fetchMock.mock.calls[0]!
    expect(canonicalUrl).toBe('https://iris-codex.test/api/capture/canonicalize')
    expect((canonicalInit as RequestInit).method).toBe('POST')
    const canonicalHeaders = (canonicalInit as RequestInit).headers as Record<string, string>
    expect(canonicalHeaders.Cookie).toContain('sb-access-token=test-token')
    expect(canonicalHeaders['Content-Type']).toBe('application/json')
    expect((canonicalInit as RequestInit).body).toBe(
      JSON.stringify({ readingId: READING_ID }),
    )
    expect((canonicalInit as RequestInit).cache).toBe('no-store')

    // Call 2: Modal trigger (preserved Phase 5 contract)
    const [url, init] = fetchMock.mock.calls[1]!
    expect(url).toBe(`https://iris-codex.test/api/readings/${READING_ID}/process`)
    expect((init as RequestInit).method).toBe('POST')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers.Cookie).toContain('sb-access-token=test-token')
    expect((init as RequestInit).cache).toBe('no-store')
  })

  it('redirects to /leituras on 202 (D-T2)', async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 202 })) as typeof globalThis.fetch

    await expect(finalizeReadingAction(READING_ID)).rejects.toThrow(
      /NEXT_REDIRECT:\/leituras/,
    )
  })

  it('returns soft-warn on 502 — no redirect, no error throw', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('Modal trigger failed', { status: 502 }),
    ) as typeof globalThis.fetch

    const result = await finalizeReadingAction(READING_ID)
    expect(result).toEqual({
      warning: expect.stringContaining(
        'Captura salva, mas o processamento automático falhou',
      ),
    })
  })

  it('returns soft-warn on 4xx — no redirect, no error throw', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('Reading not found', { status: 404 }),
    ) as typeof globalThis.fetch

    const result = await finalizeReadingAction(READING_ID)
    expect(result).toMatchObject({
      warning: expect.stringContaining('Reprocessar'),
    })
  })

  it('returns soft-warn on fetch network throw — never propagates', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof globalThis.fetch

    const result = await finalizeReadingAction(READING_ID)
    expect(result).toMatchObject({
      warning: expect.stringContaining('Reprocessar'),
    })
  })

  it('returns error (not warning) when reading_id is invalid (Zod gate) — trigger NOT called', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
    globalThis.fetch = fetchMock as typeof globalThis.fetch

    const result = await finalizeReadingAction('not-a-uuid')
    expect(result).toMatchObject({ error: 'reading_id inválido' })
    // CRITICAL: trigger NOT called when validation fails.
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
