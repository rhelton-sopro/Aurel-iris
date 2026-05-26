import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// vi.hoisted: mocks declarados antes de qualquer import do módulo testado
const { mockFrom, mockMaybeSingle, mockGetUserById } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn()
  const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom = vi.fn(() => ({ select: mockSelect }))
  const mockGetUserById = vi.fn()

  return { mockFrom, mockMaybeSingle, mockGetUserById }
})

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    from: mockFrom,
    auth: {
      admin: {
        getUserById: mockGetUserById,
      },
    },
  })),
}))

// Salva o fetch original e substitui por mock
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { notifyTherapistReportReady } from './notify-report-ready'

const READING_ID = 'reading-abc-123'
const THERAPIST_ID = 'therapist-xyz-456'
const CLIENT_NAME = 'Cristiane Oliveira'
const THERAPIST_EMAIL = 'terapeuta@example.com'
const BASE_URL = 'https://iriscodex.com'

function makeReadingData(clientFullName = CLIENT_NAME) {
  return { client: { full_name: clientFullName } }
}
function makeProfileData(fullName = 'Ana Terapeuta') {
  return { full_name: fullName }
}
function makeAuthResult(email: string | null = THERAPIST_EMAIL) {
  return { data: { user: email ? { email } : null }, error: null }
}
function makeOkFetchResponse() {
  return {
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(''),
  }
}

beforeEach(() => {
  vi.clearAllMocks()

  // Default happy-path environment
  vi.stubEnv('RESEND_API_KEY', 'test-resend-key')
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', BASE_URL)
  vi.stubEnv('RESEND_FROM_EMAIL', '')

  // Default supabase responses: reading + profile + auth all return valid data
  // Promise.all order: reading, profile, authResult
  // mockFrom always returns { select: mockSelect } — set in vi.hoisted factory

  // by default, maybeSingle returns reading or profile based on mock order
  // We configure per-test when needed
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('notifyTherapistReportReady', () => {
  describe('Test 1: Sem RESEND_API_KEY → { sent: false, reason: "no_api_key" } + sem fetch', () => {
    it('retorna no_api_key e não chama fetch', async () => {
      vi.stubEnv('RESEND_API_KEY', '')
      // Force the env var undefined behavior by deleting it from process.env
      const originalKey = process.env.RESEND_API_KEY
      delete process.env.RESEND_API_KEY

      const result = await notifyTherapistReportReady(READING_ID, THERAPIST_ID)

      expect(result).toEqual({ sent: false, reason: 'no_api_key' })
      expect(mockFetch).not.toHaveBeenCalled()

      if (originalKey !== undefined) process.env.RESEND_API_KEY = originalKey
    })
  })

  describe('Test 2: Reading não encontrado → { sent: false, reason: "reading_not_found" }', () => {
    it('retorna reading_not_found quando maybeSingle retorna null', async () => {
      // Simula Promise.all([reading_null, profile_ok, auth_ok])
      let callCount = 0
      mockMaybeSingle.mockImplementation(async () => {
        callCount++
        if (callCount === 1) return { data: null, error: null } // reading
        return { data: makeProfileData(), error: null }
      })
      mockGetUserById.mockResolvedValue(makeAuthResult())

      const result = await notifyTherapistReportReady(READING_ID, THERAPIST_ID)

      expect(result).toEqual({ sent: false, reason: 'reading_not_found' })
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('Test 3: therapistEmail null → { sent: false, reason: "no_therapist_email" }', () => {
    it('retorna no_therapist_email quando auth não tem email', async () => {
      let callCount = 0
      mockMaybeSingle.mockImplementation(async () => {
        callCount++
        if (callCount === 1) return { data: makeReadingData(), error: null }
        return { data: makeProfileData(), error: null }
      })
      mockGetUserById.mockResolvedValue(makeAuthResult(null))

      const result = await notifyTherapistReportReady(READING_ID, THERAPIST_ID)

      expect(result).toEqual({ sent: false, reason: 'no_therapist_email' })
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('Test 4: Happy path → fetch chamado com payload correto + { sent: true }', () => {
    it('retorna { sent: true } e faz POST pro Resend com headers e body corretos', async () => {
      let callCount = 0
      mockMaybeSingle.mockImplementation(async () => {
        callCount++
        if (callCount === 1) return { data: makeReadingData(), error: null }
        return { data: makeProfileData(), error: null }
      })
      mockGetUserById.mockResolvedValue(makeAuthResult())
      mockFetch.mockResolvedValue(makeOkFetchResponse())

      const result = await notifyTherapistReportReady(READING_ID, THERAPIST_ID)

      expect(result).toEqual({ sent: true })
      expect(mockFetch).toHaveBeenCalledOnce()

      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe('https://api.resend.com/emails')
      expect(options.method).toBe('POST')
      expect(options.headers['Authorization']).toMatch(/^Bearer test-resend-key$/)
      expect(options.headers['Content-Type']).toBe('application/json')

      const body = JSON.parse(options.body as string)
      expect(body).toMatchObject({
        to: THERAPIST_EMAIL,
        subject: expect.stringContaining(CLIENT_NAME),
        text: expect.any(String),
        html: expect.any(String),
      })
      expect(body.from).toBeTruthy()
    })
  })

  describe('Test 5: Resend HTTP 4xx/5xx → { sent: false, reason: "resend_http_<status>" }', () => {
    it('retorna resend_http_422 em resposta HTTP 422', async () => {
      let callCount = 0
      mockMaybeSingle.mockImplementation(async () => {
        callCount++
        if (callCount === 1) return { data: makeReadingData(), error: null }
        return { data: makeProfileData(), error: null }
      })
      mockGetUserById.mockResolvedValue(makeAuthResult())
      mockFetch.mockResolvedValue({
        ok: false,
        status: 422,
        text: vi.fn().mockResolvedValue('Unprocessable Entity'),
      })

      const result = await notifyTherapistReportReady(READING_ID, THERAPIST_ID)

      expect(result).toEqual({ sent: false, reason: 'resend_http_422' })
    })

    it('retorna resend_http_500 em resposta HTTP 500', async () => {
      let callCount = 0
      mockMaybeSingle.mockImplementation(async () => {
        callCount++
        if (callCount === 1) return { data: makeReadingData(), error: null }
        return { data: makeProfileData(), error: null }
      })
      mockGetUserById.mockResolvedValue(makeAuthResult())
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Internal Server Error'),
      })

      const result = await notifyTherapistReportReady(READING_ID, THERAPIST_ID)

      expect(result).toEqual({ sent: false, reason: 'resend_http_500' })
    })
  })

  describe('Test 6: Resend fetch lança exceção (network error) → { sent: false, reason: "fetch_error" }', () => {
    it('retorna fetch_error quando fetch lança', async () => {
      let callCount = 0
      mockMaybeSingle.mockImplementation(async () => {
        callCount++
        if (callCount === 1) return { data: makeReadingData(), error: null }
        return { data: makeProfileData(), error: null }
      })
      mockGetUserById.mockResolvedValue(makeAuthResult())
      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await notifyTherapistReportReady(READING_ID, THERAPIST_ID)

      expect(result).toEqual({ sent: false, reason: 'fetch_error' })
    })
  })

  describe('Test 7: Sender default e override via RESEND_FROM_EMAIL', () => {
    it('usa "Iris Codex <noreply@iriscodex.com>" quando RESEND_FROM_EMAIL não definido', async () => {
      delete process.env.RESEND_FROM_EMAIL

      let callCount = 0
      mockMaybeSingle.mockImplementation(async () => {
        callCount++
        if (callCount === 1) return { data: makeReadingData(), error: null }
        return { data: makeProfileData(), error: null }
      })
      mockGetUserById.mockResolvedValue(makeAuthResult())
      mockFetch.mockResolvedValue(makeOkFetchResponse())

      await notifyTherapistReportReady(READING_ID, THERAPIST_ID)

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
      expect(body.from).toBe('Iris Codex <noreply@iriscodex.com>')
    })

    it('usa valor de RESEND_FROM_EMAIL quando definido', async () => {
      vi.stubEnv('RESEND_FROM_EMAIL', 'custom@example.com')

      let callCount = 0
      mockMaybeSingle.mockImplementation(async () => {
        callCount++
        if (callCount === 1) return { data: makeReadingData(), error: null }
        return { data: makeProfileData(), error: null }
      })
      mockGetUserById.mockResolvedValue(makeAuthResult())
      mockFetch.mockResolvedValue(makeOkFetchResponse())

      await notifyTherapistReportReady(READING_ID, THERAPIST_ID)

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
      expect(body.from).toBe('custom@example.com')
    })
  })

  describe('Test 8: Subject contém nome do cliente + "leitura" + corpo contém URL /leituras/{id}', () => {
    it('subject e URL estão corretos', async () => {
      let callCount = 0
      mockMaybeSingle.mockImplementation(async () => {
        callCount++
        if (callCount === 1) return { data: makeReadingData(), error: null }
        return { data: makeProfileData(), error: null }
      })
      mockGetUserById.mockResolvedValue(makeAuthResult())
      mockFetch.mockResolvedValue(makeOkFetchResponse())

      await notifyTherapistReportReady(READING_ID, THERAPIST_ID)

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
      // Subject must contain client name AND "leitura"
      expect(body.subject).toContain(CLIENT_NAME)
      expect(body.subject.toLowerCase()).toContain('leitura')
      // Both text and html must contain the reading URL
      const expectedUrl = `${BASE_URL}/leituras/${READING_ID}`
      expect(body.text).toContain(expectedUrl)
      expect(body.html).toContain(expectedUrl)
    })
  })

  describe('Test 9: LGPD — templates sem "diagnóstico", "tratamento" ou "cura"', () => {
    it('text e html body não contêm vocabulário proibido LGPD', async () => {
      let callCount = 0
      mockMaybeSingle.mockImplementation(async () => {
        callCount++
        if (callCount === 1) return { data: makeReadingData(), error: null }
        return { data: makeProfileData(), error: null }
      })
      mockGetUserById.mockResolvedValue(makeAuthResult())
      mockFetch.mockResolvedValue(makeOkFetchResponse())

      await notifyTherapistReportReady(READING_ID, THERAPIST_ID)

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
      const lgpdPattern = /\b(diagnóstico|tratamento|cura)\b/iu

      expect(lgpdPattern.test(body.text)).toBe(false)
      expect(lgpdPattern.test(body.html)).toBe(false)
    })
  })

  describe('Test 10: escapeHtml aplicado em clientName — XSS safe', () => {
    it('clientName com <script> é escapado no HTML body', async () => {
      const xssName = '<script>alert("xss")</script>'
      let callCount = 0
      mockMaybeSingle.mockImplementation(async () => {
        callCount++
        if (callCount === 1) return { data: makeReadingData(xssName), error: null }
        return { data: makeProfileData(), error: null }
      })
      mockGetUserById.mockResolvedValue(makeAuthResult())
      mockFetch.mockResolvedValue(makeOkFetchResponse())

      await notifyTherapistReportReady(READING_ID, THERAPIST_ID)

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
      // HTML body must NOT contain raw <script> tag
      expect(body.html).not.toContain('<script>')
      // Must contain the escaped version
      expect(body.html).toContain('&lt;script&gt;')
    })
  })
})
