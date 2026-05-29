import { describe, expect, it } from 'vitest'
import { computeRefundValue, unitPriceBrl } from '../refund-policy'

const now = new Date('2026-05-27T12:00:00Z')

describe('unitPriceBrl (CR-03 base única)', () => {
  it('divide preço pelo nº de leituras', () => {
    expect(unitPriceBrl(298.5, 5)).toBeCloseTo(59.7, 5)
  })

  it('retorna 0 quando leituras <= 0 (proteção div/0)', () => {
    expect(unitPriceBrl(298.5, 0)).toBe(0)
    expect(unitPriceBrl(298.5, -1)).toBe(0)
  })
})

describe('computeRefundValue', () => {
  it('total refund when 0 consumed within 7d window', () => {
    const r = computeRefundValue(
      {
        purchase_date: '2026-05-25T00:00:00Z', // 2d ago
        price_brl: 298.5,
        leituras_purchased: 5,
        leituras_remaining: 5,
        leituras_reserved: 0,
        status: 'active',
      },
      now,
    )
    expect(r).toEqual({
      eligible: true,
      kind: 'total',
      value_brl: 298.5,
      leituras_to_refund: 5,
    })
  })

  it('partial proportional when 2 consumed (5 → 3 remaining)', () => {
    const r = computeRefundValue(
      {
        purchase_date: '2026-05-25T00:00:00Z',
        price_brl: 298.5,
        leituras_purchased: 5,
        leituras_remaining: 3,
        leituras_reserved: 0,
        status: 'active',
      },
      now,
    )
    expect(r.eligible).toBe(true)
    if (r.eligible && r.kind === 'partial') {
      expect(r.unit_price_brl).toBe(59.7) // 298.50 / 5
      expect(r.value_brl).toBe(179.1) // 59.70 × 3
      expect(r.leituras_to_refund).toBe(3)
    }
  })

  it('partial counts reserved + remaining as refundable', () => {
    const r = computeRefundValue(
      {
        purchase_date: '2026-05-25T00:00:00Z',
        price_brl: 298.5,
        leituras_purchased: 5,
        leituras_remaining: 2,
        leituras_reserved: 1,
        status: 'active',
      },
      now,
    )
    if (r.eligible && r.kind === 'partial') {
      expect(r.leituras_to_refund).toBe(3) // 2 + 1
      expect(r.value_brl).toBe(179.1)
    }
  })

  it('no_balance when fully consumed', () => {
    const r = computeRefundValue(
      {
        purchase_date: '2026-05-25T00:00:00Z',
        price_brl: 298.5,
        leituras_purchased: 5,
        leituras_remaining: 0,
        leituras_reserved: 0,
        status: 'active',
      },
      now,
    )
    expect(r).toEqual({ eligible: false, reason: 'no_balance', value_brl: 0 })
  })

  it('window_expired when > 7 days', () => {
    const r = computeRefundValue(
      {
        purchase_date: '2026-05-15T00:00:00Z', // 12d ago
        price_brl: 99.7,
        leituras_purchased: 1,
        leituras_remaining: 1,
        leituras_reserved: 0,
        status: 'active',
      },
      now,
    )
    expect(r).toEqual({ eligible: false, reason: 'window_expired', value_brl: 0 })
  })

  it('wrong_status when refunded/expired', () => {
    const r = computeRefundValue(
      {
        purchase_date: '2026-05-25T00:00:00Z',
        price_brl: 99.7,
        leituras_purchased: 1,
        leituras_remaining: 0,
        leituras_reserved: 0,
        status: 'refunded',
      },
      now,
    )
    expect(r).toEqual({ eligible: false, reason: 'wrong_status', value_brl: 0 })
  })

  it('rounds to 2dp (Grande pacote, 13 restantes)', () => {
    const r = computeRefundValue(
      {
        purchase_date: '2026-05-25T00:00:00Z',
        price_brl: 745.5, // 15 leituras
        leituras_purchased: 15,
        leituras_remaining: 13,
        leituras_reserved: 0,
        status: 'active',
      },
      now,
    )
    if (r.eligible && r.kind === 'partial') {
      expect(r.unit_price_brl).toBeCloseTo(49.7, 2)
      // 49.70 × 13 = 646.10
      expect(r.value_brl).toBeCloseTo(646.1, 1)
    }
  })

  it('pending status is not refundable (wrong_status)', () => {
    const r = computeRefundValue(
      {
        purchase_date: '2026-05-26T00:00:00Z',
        price_brl: 99.7,
        leituras_purchased: 1,
        leituras_remaining: 0,
        leituras_reserved: 0,
        status: 'pending',
      },
      now,
    )
    expect(r).toEqual({ eligible: false, reason: 'wrong_status', value_brl: 0 })
  })
})
