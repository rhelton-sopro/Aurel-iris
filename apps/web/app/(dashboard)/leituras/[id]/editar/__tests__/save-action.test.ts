// audit-vocabulary:allowlist — este arquivo de teste inclui a string 'diagnóstico'
// como fixture de input para validar o BLOCK do vocab gate (D-A2 defesa em profundidade).
// Justificativa idêntica a lib/anthropic/types.ts: o termo está em contexto de teste
// semântico e é necessário para cobrir o comportamento de bloqueio de forma significativa.
// Marker honrado por apps/web/scripts/audit-vocabulary.mjs (file-level skip).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ENCERRAMENTO_LITERAL } from '@/lib/anthropic/types'

// ---------------------------------------------------------------------------
// Mocks — declarados ANTES do import do action (vitest hoisting)
// ---------------------------------------------------------------------------

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ toString: (): string => 'sb-access-token=test' })),
}))

vi.mock('@/lib/anthropic/audit', () => ({
  runAudit: vi.fn(() => ({
    low_anchor_rate: false,
    anchor_rate_pct: 100,
    anchor_rate_per_section: {},
    forbidden_vocab: [],
    audited_at: '2026-05-08T15:00:00Z',
    auditor_version: 'v1',
  })),
  extractForbiddenHits: vi.fn(() => []),
}))

vi.mock('@/lib/anthropic/diff', () => ({
  classifyAllSections: vi.fn(() => ({
    edit_diff: {},
    zonas_editadas: [],
    tipo_edicao: [],
  })),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Imports após mocks
// ---------------------------------------------------------------------------

import { saveReportDelivered, markReadingDelivered } from '@/app/actions/analise'
import { createClient } from '@/lib/supabase/server'
import { extractForbiddenHits } from '@/lib/anthropic/audit'

// ---------------------------------------------------------------------------
// Constantes de teste
// ---------------------------------------------------------------------------

// UUIDs válidos RFC 9562 (v4): zod rejeita UUIDs sintéticos
const VALID_READING_UUID = '401288f4-0f02-43aa-bdee-16d501089dc9'

const VALID_AUDIT_META = {
  low_anchor_rate: false,
  anchor_rate_pct: 100,
  anchor_rate_per_section: {},
  forbidden_vocab: [],
  audited_at: '2026-05-08T15:00:00Z',
  auditor_version: 'v1' as const,
}

const VALID_REPORT_DELIVERED = {
  '1_constituicao_temperamento': 'Texto válido da seção',
}

// ---------------------------------------------------------------------------
// Helper: factory de mock supabase parametrizável
// ---------------------------------------------------------------------------

function createMockSupabase(opts: {
  user?: { id: string } | null
  reading?: Record<string, unknown> | null
  readingError?: { message: string } | null
  updateError?: { message: string } | null
}) {
  const update = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: opts.updateError ?? null }),
  }))
  const single = vi.fn().mockResolvedValue({
    data: opts.reading ?? null,
    error: opts.readingError ?? null,
  })
  const fromChain = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({ single })),
      })),
    })),
    update,
  }
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: opts.user === null ? null : (opts.user ?? { id: 'user-1' }) },
        error: opts.user === null ? { message: 'no session' } : null,
      }),
    },
    from: vi.fn(() => fromChain),
    __update: update,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => vi.clearAllMocks())

describe('saveReportDelivered (D-A2 + WR-08 + CR-05)', () => {
  it('BLOCK quando is_delivered=true (WR-08 terminal-state gate)', async () => {
    const supabaseMock = createMockSupabase({
      reading: {
        id: VALID_READING_UUID,
        therapist_id: 'user-1',
        report_generated: {},
        is_delivered: true,
      },
    })
    vi.mocked(createClient).mockResolvedValueOnce(supabaseMock as never)

    const result = await saveReportDelivered(VALID_READING_UUID, VALID_REPORT_DELIVERED)

    expect(result.error).toBe('Leitura já entregue ao cliente — somente leitura.')
    expect(supabaseMock.__update).not.toHaveBeenCalled()
  })

  it('overrides encerramento_disclaimer com ENCERRAMENTO_LITERAL (CR-05 SC4 D-P3)', async () => {
    const supabaseMock = createMockSupabase({
      reading: {
        id: VALID_READING_UUID,
        therapist_id: 'user-1',
        report_generated: { '1_constituicao_temperamento': 'texto gerado' },
        is_delivered: false,
      },
    })
    vi.mocked(createClient).mockResolvedValueOnce(supabaseMock as never)

    const result = await saveReportDelivered(VALID_READING_UUID, {
      '1_constituicao_temperamento': 'texto editado',
      encerramento_disclaimer: 'TENTATIVA DE BYPASS',
    })

    expect(result.success).toBe(true)
    // Verificar que o update foi chamado com encerramento_disclaimer = ENCERRAMENTO_LITERAL
    expect(supabaseMock.__update).toHaveBeenCalled()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const updateArg = (supabaseMock.__update.mock.calls as unknown as Array<[Record<string, unknown>]>)[0][0]
    const reportDelivered = updateArg.report_delivered as Record<string, string>
    expect(reportDelivered.encerramento_disclaimer).toBe(ENCERRAMENTO_LITERAL)
  })

  it('BLOCK save com vocab proibido (D-A2 — regression após patch)', async () => {
    vi.mocked(extractForbiddenHits).mockReturnValueOnce([
      { term: 'diagnóstico', section: '1_constituicao_temperamento', occurrences: 1 },
    ])

    const supabaseMock = createMockSupabase({
      reading: {
        id: VALID_READING_UUID,
        therapist_id: 'user-1',
        report_generated: {},
        is_delivered: false,
      },
    })
    vi.mocked(createClient).mockResolvedValueOnce(supabaseMock as never)

    const result = await saveReportDelivered(VALID_READING_UUID, {
      '1_constituicao_temperamento': 'texto com diagnóstico',
    })

    expect(result.error).toContain('diagnóstico')
    expect(supabaseMock.__update).not.toHaveBeenCalled()
  })

  it('redirects to /login quando user é null', async () => {
    const supabaseMock = createMockSupabase({ user: null })
    vi.mocked(createClient).mockResolvedValueOnce(supabaseMock as never)

    await expect(
      saveReportDelivered(VALID_READING_UUID, VALID_REPORT_DELIVERED),
    ).rejects.toThrow('/login')
  })
})

describe('markReadingDelivered (CR-04 + SC2 + WR-08-existing)', () => {
  it('BLOCK quando report_delivered é null (CR-04 empty-content gate)', async () => {
    const supabaseMock = createMockSupabase({
      reading: {
        id: VALID_READING_UUID,
        therapist_id: 'user-1',
        report_delivered: null,
        is_delivered: false,
        audit_metadata: VALID_AUDIT_META,
      },
    })
    vi.mocked(createClient).mockResolvedValueOnce(supabaseMock as never)

    const result = await markReadingDelivered(VALID_READING_UUID)

    expect(result.error).toBe('Salve a edição antes de entregar ao cliente.')
    expect(supabaseMock.__update).not.toHaveBeenCalled()
  })

  it('BLOCK quando report_delivered é objeto vazio {} (CR-04)', async () => {
    const supabaseMock = createMockSupabase({
      reading: {
        id: VALID_READING_UUID,
        therapist_id: 'user-1',
        report_delivered: {},
        is_delivered: false,
        audit_metadata: VALID_AUDIT_META,
      },
    })
    vi.mocked(createClient).mockResolvedValueOnce(supabaseMock as never)

    const result = await markReadingDelivered(VALID_READING_UUID)

    expect(result.error).toBe('Salve a edição antes de entregar ao cliente.')
    expect(supabaseMock.__update).not.toHaveBeenCalled()
  })

  it('BLOCK quando audit_metadata.low_anchor_rate=true (SC2 gate)', async () => {
    const supabaseMock = createMockSupabase({
      reading: {
        id: VALID_READING_UUID,
        therapist_id: 'user-1',
        report_delivered: VALID_REPORT_DELIVERED,
        is_delivered: false,
        audit_metadata: {
          low_anchor_rate: true,
          anchor_rate_pct: 87,
          anchor_rate_per_section: { '2_mapa_organico': 0.8 },
          forbidden_vocab: [],
          audited_at: '2026-05-08T15:00:00Z',
          auditor_version: 'v1',
        },
      },
    })
    vi.mocked(createClient).mockResolvedValueOnce(supabaseMock as never)

    const result = await markReadingDelivered(VALID_READING_UUID)

    expect(result.error).toBe(
      'Âncora insuficiente — taxa de ancoragem abaixo de 95% nas seções clínicas. Edite e re-salve antes de entregar.',
    )
    expect(supabaseMock.__update).not.toHaveBeenCalled()
  })

  it('BLOCK quando audit_metadata é null — fail-closed (SC2 missing audit)', async () => {
    const supabaseMock = createMockSupabase({
      reading: {
        id: VALID_READING_UUID,
        therapist_id: 'user-1',
        report_delivered: VALID_REPORT_DELIVERED,
        is_delivered: false,
        audit_metadata: null,
      },
    })
    vi.mocked(createClient).mockResolvedValueOnce(supabaseMock as never)

    const result = await markReadingDelivered(VALID_READING_UUID)

    expect(result.error).toBe(
      'Auditoria de ancoragem ausente ou pendente. Re-salve o relatório para re-rodar a auditoria.',
    )
    expect(supabaseMock.__update).not.toHaveBeenCalled()
  })

  it('happy path — flip is_delivered=true quando todos os gates passam', async () => {
    const supabaseMock = createMockSupabase({
      reading: {
        id: VALID_READING_UUID,
        therapist_id: 'user-1',
        report_delivered: VALID_REPORT_DELIVERED,
        is_delivered: false,
        audit_metadata: VALID_AUDIT_META,
      },
    })
    vi.mocked(createClient).mockResolvedValueOnce(supabaseMock as never)

    const result = await markReadingDelivered(VALID_READING_UUID)

    expect(result.success).toBe(true)
    expect(supabaseMock.__update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_delivered: true,
        delivered_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
      }),
    )
  })

  // TODO: integration test em 07-UAT — requer mock elaborado de RPC supabase
  it.todo('classifyAllSections é chamado com (report_generated, delivered) — produz edit_diff per-key — TODO: integration test em 07-UAT')
  it.todo('audit_metadata atualizado com runAudit(delivered) pós-save — TODO: integration test em 07-UAT')
  it.todo('revalidatePath chamado para 3 paths — TODO: requires elaborate mock surface')
})
