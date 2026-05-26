/**
 * Testes para fetchDogfoodingProgress — Fase 9 / ONBOARD-04 / D-05
 *
 * Usa vi.useFakeTimers + vi.setSystemTime('2026-05-26T12:00:00Z') pra
 * controlar "hoje" de forma determinística em todos os casos.
 *
 * Mock chain: createClient → from('readings').select().eq().gte().order()
 * Retorna { data: ReadingRow[] | null }
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Hoist mocks antes do import do módulo a testar.
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import {
  fetchDogfoodingProgress,
  DOGFOODING_START_DATE,
  WEEKLY_THRESHOLD,
  CONSECUTIVE_WEEKS_REQUIRED,
} from './dogfooding'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Cria uma mock row de reading com created_at e is_self via client JOIN. */
function row(created_at: string, is_self: boolean) {
  return { created_at, client: { is_self } }
}

/**
 * Monta o mock completo da cadeia supabase:
 * createClient() → from().select().eq().gte().order()
 */
function mockSupabaseWithReadings(readings: ReturnType<typeof row>[]) {
  const orderMock = vi.fn().mockResolvedValue({ data: readings, error: null })
  const gteMock = vi.fn(() => ({ order: orderMock }))
  const eqMock = vi.fn(() => ({ gte: gteMock }))
  const selectMock = vi.fn(() => ({ eq: eqMock }))
  const fromMock = vi.fn(() => ({ select: selectMock }))
  const client = { from: fromMock }
  ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(client)
  return { fromMock, selectMock, eqMock, gteMock, orderMock }
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('fetchDogfoodingProgress', () => {
  // Fixa "hoje" em 2026-05-26 (terça-feira) — ~11 dias após DOGFOODING_START_DATE.
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-26T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // ── Test 1 ──────────────────────────────────────────────────────────────────
  it('T1: sem founderUserId → retorna zeros sem chamar supabase', async () => {
    const result = await fetchDogfoodingProgress(null)

    expect(result.startDate).toBe(DOGFOODING_START_DATE)
    expect(result.weeksElapsed).toBe(0)
    expect(result.weeklyRows).toEqual([])
    expect(result.gateClosedAt).toBeNull()
    expect(result.consecutiveQualifyingWeeks).toBe(0)
    expect(createClient).not.toHaveBeenCalled()
  })

  // ── Test 2 ──────────────────────────────────────────────────────────────────
  it('T2: com founderUserId mas zero readings → buckets vazios + consecutiveQualifyingWeeks=0', async () => {
    mockSupabaseWithReadings([])

    const result = await fetchDogfoodingProgress('founder-uid-001')

    // Zero readings — buckets devem existir mas com counts zerados.
    expect(result.weeklyRows.length).toBeGreaterThan(0)
    for (const w of result.weeklyRows) {
      expect(w.real_count).toBe(0)
      expect(w.self_count).toBe(0)
      expect(w.qualifies).toBe(false)
    }
    expect(result.consecutiveQualifyingWeeks).toBe(0)
    expect(result.gateClosedAt).toBeNull()
  })

  // ── Test 3 ──────────────────────────────────────────────────────────────────
  it('T3: 3 semanas consecutivas com 3+ is_self=false → consecutiveQualifyingWeeks=3 + gateClosedAt preenchido', async () => {
    // Semana 1: 2026-05-11..17 (segunda 2026-05-11) — mas start é 2026-05-15 (quinta)
    // Semana da semana ISO de 2026-05-15 = segunda 2026-05-11.
    // Vamos usar 3 readings pra semana de 2026-05-11:
    //   2026-05-15 (quinta), 2026-05-16 (sexta), 2026-05-17 (sábado)
    // Semana 2: 2026-05-18..24 — 3 readings em 2026-05-19, 20, 21
    // Semana 3: 2026-05-25..31 — 3 readings em 2026-05-25, 26, 27 (hoje=26, ok)
    const readings = [
      row('2026-05-15T10:00:00Z', false),
      row('2026-05-16T10:00:00Z', false),
      row('2026-05-17T10:00:00Z', false),
      row('2026-05-19T10:00:00Z', false),
      row('2026-05-20T10:00:00Z', false),
      row('2026-05-21T10:00:00Z', false),
      row('2026-05-25T10:00:00Z', false),
      row('2026-05-26T10:00:00Z', false),
      row('2026-05-26T11:00:00Z', false),
    ]
    mockSupabaseWithReadings(readings)

    const result = await fetchDogfoodingProgress('founder-uid-001')

    expect(result.consecutiveQualifyingWeeks).toBe(CONSECUTIVE_WEEKS_REQUIRED) // 3
    expect(result.gateClosedAt).not.toBeNull()
  })

  // ── Test 4 ──────────────────────────────────────────────────────────────────
  it('T4: mix is_self=true (autoexame) e is_self=false — só false conta pro qualifies', async () => {
    // 4 autoexames + 2 reais na mesma semana (2026-05-25..31) → NÃO qualifica (real_count=2 < 3)
    const readings = [
      row('2026-05-25T10:00:00Z', true),
      row('2026-05-25T11:00:00Z', true),
      row('2026-05-25T12:00:00Z', true),
      row('2026-05-25T13:00:00Z', true),
      row('2026-05-25T14:00:00Z', false),
      row('2026-05-26T10:00:00Z', false),
    ]
    mockSupabaseWithReadings(readings)

    const result = await fetchDogfoodingProgress('founder-uid-001')

    // Encontra a semana de 2026-05-25
    const weekOf25 = result.weeklyRows.find((w) => w.week_start === '2026-05-25')
    expect(weekOf25).toBeDefined()
    expect(weekOf25!.self_count).toBe(4)
    expect(weekOf25!.real_count).toBe(2)
    expect(weekOf25!.qualifies).toBe(false) // 2 < WEEKLY_THRESHOLD=3
  })

  // ── Test 5 ──────────────────────────────────────────────────────────────────
  it('T5: streak quebrada → consecutiveQualifyingWeeks conta só a mais recente', async () => {
    // Semana 1 (2026-05-11): 3 reais — qualifica
    // Semana 2 (2026-05-18): 1 real — NÃO qualifica (quebra streak)
    // Semana 3 (2026-05-25): 3 reais — qualifica
    // Streak mais recente = 1 semana (não 2 acumuladas)
    const readings = [
      // Semana 1
      row('2026-05-15T10:00:00Z', false),
      row('2026-05-16T10:00:00Z', false),
      row('2026-05-17T10:00:00Z', false),
      // Semana 2 — quebra
      row('2026-05-19T10:00:00Z', false),
      // Semana 3
      row('2026-05-25T10:00:00Z', false),
      row('2026-05-25T11:00:00Z', false),
      row('2026-05-26T10:00:00Z', false),
    ]
    mockSupabaseWithReadings(readings)

    const result = await fetchDogfoodingProgress('founder-uid-001')

    // Streak recente = semana 3 apenas → 1
    expect(result.consecutiveQualifyingWeeks).toBe(1)
    expect(result.gateClosedAt).toBeNull() // 1 < CONSECUTIVE_WEEKS_REQUIRED=3
  })

  // ── Test 6 ──────────────────────────────────────────────────────────────────
  it('T6: weeklyRows deve vir em ordem DESC por week_start (mais recente primeiro)', async () => {
    mockSupabaseWithReadings([])

    const result = await fetchDogfoodingProgress('founder-uid-001')

    // Verifica que cada week_start é ≥ ao próximo
    for (let i = 0; i < result.weeklyRows.length - 1; i++) {
      expect(result.weeklyRows[i].week_start >= result.weeklyRows[i + 1].week_start).toBe(true)
    }
  })

  // ── Test 7 ──────────────────────────────────────────────────────────────────
  it('T7: week_label em formato pt-BR "DD/MM–DD/MM"', async () => {
    mockSupabaseWithReadings([])

    const result = await fetchDogfoodingProgress('founder-uid-001')

    // Cada label deve casar com padrão DD/MM–DD/MM
    for (const w of result.weeklyRows) {
      expect(w.week_label).toMatch(/^\d{2}\/\d{2}–\d{2}\/\d{2}$/)
    }
  })

  // ── Test 8 ──────────────────────────────────────────────────────────────────
  it('T8: edge case — DOGFOODING_START_DATE (2026-05-15) cai em semana ISO que começa em 2026-05-11', async () => {
    mockSupabaseWithReadings([])

    const result = await fetchDogfoodingProgress('founder-uid-001')

    // Semana mais antiga nas rows (última no array DESC) deve ter week_start = 2026-05-11
    // pois 2026-05-15 (quinta) pertence à semana ISO que começa na segunda 2026-05-11.
    const oldestWeek = result.weeklyRows[result.weeklyRows.length - 1]
    expect(oldestWeek.week_start).toBe('2026-05-11')
  })
})
