import { describe, expect, it } from 'vitest'

import { isPartialRefundBlockedToday } from '../refund-policy'

// Regra Asaas: estorno PARCIAL só a partir do dia SEGUINTE (dia-calendário BRT).
describe('isPartialRefundBlockedToday', () => {
  it('bloqueia quando a compra foi no MESMO dia-calendário BRT', () => {
    // compra 2026-05-31 14:00 BRT (17:00 UTC); agora 2026-05-31 20:00 BRT
    const purchase = '2026-05-31T17:00:00.000Z'
    const now = new Date('2026-05-31T23:00:00.000Z') // 20:00 BRT mesmo dia
    expect(isPartialRefundBlockedToday(purchase, now)).toBe(true)
  })

  it('libera no dia SEGUINTE', () => {
    const purchase = '2026-05-31T17:00:00.000Z'
    const now = new Date('2026-06-01T12:00:00.000Z') // 09:00 BRT dia seguinte
    expect(isPartialRefundBlockedToday(purchase, now)).toBe(false)
  })

  it('cobre a virada de dia em BRT (não em UTC)', () => {
    // compra 31/05 22:00 BRT (01:00 UTC do dia 01/06). Ainda 31/05 em BRT às
    // 23:00 BRT (02:00 UTC 01/06) → mesmo dia BRT → bloqueado.
    const purchase = '2026-06-01T01:00:00.000Z' // 31/05 22:00 BRT
    const now = new Date('2026-06-01T02:00:00.000Z') // 31/05 23:00 BRT
    expect(isPartialRefundBlockedToday(purchase, now)).toBe(true)
    // 01/06 00:30 BRT (03:30 UTC) → dia seguinte BRT → liberado.
    const nowNextDay = new Date('2026-06-01T03:30:00.000Z')
    expect(isPartialRefundBlockedToday(purchase, nowNextDay)).toBe(false)
  })
})
