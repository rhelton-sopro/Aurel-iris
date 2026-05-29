import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
global.fetch = fetchMock as unknown as typeof fetch

import { notifyCreditPurchaseConfirmed } from '../notify-credit-purchase-confirmed'

describe('notifyCreditPurchaseConfirmed', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    process.env.RESEND_API_KEY = 're_test'
  })

  it('does not throw when API key missing', async () => {
    delete process.env.RESEND_API_KEY
    await expect(
      notifyCreditPurchaseConfirmed({
        userEmail: 'x@y.com',
        packageName: 'Médio',
        leituras: 15,
        valueBrl: 745.5,
        expiresAt: '2027-05-27T00:00:00Z',
      }),
    ).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts to Resend with correct payload', async () => {
    fetchMock.mockResolvedValue(new Response('{"id":"em_123"}', { status: 200 }))
    await notifyCreditPurchaseConfirmed({
      userEmail: 'x@y.com',
      userName: 'Ana',
      packageName: 'Médio',
      leituras: 15,
      valueBrl: 745.5,
      expiresAt: '2027-05-27T00:00:00Z',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer re_test' }),
      }),
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.to).toBe('x@y.com')
    expect(body.subject).toContain('confirmada')
    expect(body.html).toContain('Ana')
    expect(body.html).toContain('745,50')
  })

  it('does not throw on HTTP 5xx', async () => {
    fetchMock.mockResolvedValue(new Response('error', { status: 500 }))
    await expect(
      notifyCreditPurchaseConfirmed({
        userEmail: 'x@y.com',
        packageName: 'Pequeno',
        leituras: 5,
        valueBrl: 298.5,
        expiresAt: '2027-05-27T00:00:00Z',
      }),
    ).resolves.toBeUndefined()
  })

  it('does not throw on fetch rejection', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))
    await expect(
      notifyCreditPurchaseConfirmed({
        userEmail: 'x@y.com',
        packageName: 'Avulsa',
        leituras: 1,
        valueBrl: 99.7,
        expiresAt: '2027-05-27T00:00:00Z',
      }),
    ).resolves.toBeUndefined()
  })

  it('escapes HTML in userName', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
    await notifyCreditPurchaseConfirmed({
      userEmail: 'x@y.com',
      userName: '<script>alert(1)</script>',
      packageName: 'Avulsa',
      leituras: 1,
      valueBrl: 99.7,
      expiresAt: '2027-05-27T00:00:00Z',
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.html).not.toContain('<script>')
    expect(body.html).toContain('&lt;script&gt;')
  })
})
