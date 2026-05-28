import { beforeEach, describe, expect, it, vi } from 'vitest'

const insertMock = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({ insert: insertMock }),
  }),
}))

import { logAuditEvent } from '../log'

describe('logAuditEvent', () => {
  beforeEach(() => {
    insertMock.mockReset()
  })

  it('inserts event into audit_events', async () => {
    insertMock.mockResolvedValue({ error: null })
    await logAuditEvent({
      event_type: 'auth.login',
      actor_user_id: 'user-1',
      actor_email: 'x@y.com',
      metadata: { ip: '1.2.3.4' },
    })
    expect(insertMock).toHaveBeenCalledOnce()
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'auth.login',
        actor_user_id: 'user-1',
        actor_email: 'x@y.com',
        target_type: null,
        target_id: null,
        metadata: { ip: '1.2.3.4' },
      }),
    )
  })

  it('does not throw when insert returns error', async () => {
    insertMock.mockResolvedValue({ error: { message: 'connection refused' } })
    await expect(
      logAuditEvent({ event_type: 'auth.login' }),
    ).resolves.toBeUndefined()
  })

  it('does not throw when insert rejects', async () => {
    insertMock.mockRejectedValue(new Error('boom'))
    await expect(
      logAuditEvent({ event_type: 'auth.login' }),
    ).resolves.toBeUndefined()
  })

  it('passes optional fields as null when omitted', async () => {
    insertMock.mockResolvedValue({ error: null })
    await logAuditEvent({ event_type: 'reading.created' })
    expect(insertMock).toHaveBeenCalledWith({
      event_type: 'reading.created',
      actor_user_id: null,
      actor_email: null,
      target_type: null,
      target_id: null,
      metadata: null,
    })
  })
})
