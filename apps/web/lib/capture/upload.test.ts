import { describe, it, expect, vi } from 'vitest'
import { uploadCaptureImage, uploadWithRetry, type UploadArgs } from './upload'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function makeMockSupabase(opts: { storageFails?: boolean; dbFails?: boolean } = {}) {
  const upload = vi.fn().mockResolvedValue({
    error: opts.storageFails ? { message: 'storage err' } : null,
  })
  const upsert = vi.fn().mockResolvedValue({
    error: opts.dbFails ? { message: 'db err' } : null,
  })
  return {
    storage: { from: vi.fn(() => ({ upload })) },
    from: vi.fn(() => ({ upsert })),
    _spies: { upload, upsert },
  } as unknown as SupabaseClient<Database> & {
    _spies: { upload: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> }
  }
}

const baseArgs = (sb: SupabaseClient<Database>): UploadArgs => ({
  supabase: sb,
  blob: new Blob([new Uint8Array(10)], { type: 'image/jpeg' }),
  width: 3840,
  height: 2160,
  therapistId: '11111111-1111-1111-1111-111111111111',
  readingId: '22222222-2222-2222-2222-222222222222',
  eye: 'right',
  angle: 'frontal',
  qualityScore: 0.85,
})

describe('uploadCaptureImage', () => {
  it('uploads to iris-captures bucket at originais/ subfolder', async () => {
    const sb = makeMockSupabase()
    await uploadCaptureImage(baseArgs(sb))
    expect((sb as unknown as { storage: { from: ReturnType<typeof vi.fn> } }).storage.from).toHaveBeenCalledWith('iris-captures')
    const callArgs = (sb as unknown as { _spies: { upload: ReturnType<typeof vi.fn> } })._spies.upload.mock.calls[0]
    expect(callArgs[0]).toBe(
      '11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/originais/right_frontal.jpg',
    )
    expect(callArgs[2]).toMatchObject({ contentType: 'image/jpeg', upsert: true })
  })

  it('upserts reading_images with onConflict on (reading_id, eye, angle)', async () => {
    const sb = makeMockSupabase()
    await uploadCaptureImage(baseArgs(sb))
    const upsertCall = (sb as unknown as { _spies: { upsert: ReturnType<typeof vi.fn> } })._spies.upsert.mock.calls[0]
    expect(upsertCall[1]).toMatchObject({ onConflict: 'reading_id,eye,angle' })
    expect(upsertCall[0]).toMatchObject({
      eye: 'right',
      angle: 'frontal',
      quality_score: 0.85,
      width: 3840,
      height: 2160,
      storage_path: expect.stringContaining('originais/right_frontal.jpg'),
    })
  })

  it('throws on storage error', async () => {
    const sb = makeMockSupabase({ storageFails: true })
    await expect(uploadCaptureImage(baseArgs(sb))).rejects.toThrow(/storage falhou/)
  })

  it('throws on db error', async () => {
    const sb = makeMockSupabase({ dbFails: true })
    await expect(uploadCaptureImage(baseArgs(sb))).rejects.toThrow(/insert reading_images/)
  })

  it('respects pre-aborted signal', async () => {
    const sb = makeMockSupabase()
    const ac = new AbortController()
    ac.abort()
    await expect(uploadCaptureImage({ ...baseArgs(sb), signal: ac.signal })).rejects.toThrow(/abortado/)
  })
})

describe('uploadWithRetry', () => {
  it('retries on failure (timer skipped via vi.useFakeTimers)', async () => {
    vi.useFakeTimers()
    let calls = 0
    const sb = makeMockSupabase()
    ;(sb as unknown as { storage: { from: ReturnType<typeof vi.fn> } }).storage.from = vi.fn(() => ({
      upload: vi.fn(async () => {
        calls++
        if (calls < 2) return { error: { message: 'transient' } }
        return { error: null }
      }),
    }))

    const promise = uploadWithRetry(baseArgs(sb))
    await vi.advanceTimersByTimeAsync(2000)
    await promise
    expect(calls).toBe(2)

    vi.useRealTimers()
  })

  it('throws after maxAttempts failures', async () => {
    vi.useFakeTimers()
    const sb = makeMockSupabase({ storageFails: true })
    const promise = uploadWithRetry(baseArgs(sb), 2)
    const exp = expect(promise).rejects.toThrow(/storage falhou/)
    await vi.advanceTimersByTimeAsync(5000)
    await exp
    vi.useRealTimers()
  })

  it('does not retry on AbortError', async () => {
    const sb = makeMockSupabase()
    const ac = new AbortController()
    ac.abort()
    await expect(uploadWithRetry({ ...baseArgs(sb), signal: ac.signal })).rejects.toThrow(/abortado/)
  })
})
