/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}))

import { useRouter } from 'next/navigation'
import { ReprocessButton } from './ReprocessButton'

const READING_ID = 'r-123'
const ORIGINAL_FETCH = global.fetch

function mockRouter(refresh = vi.fn()) {
  vi.mocked(useRouter).mockReturnValue({
    refresh,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  } as unknown as ReturnType<typeof useRouter>)
  return refresh
}

describe('ReprocessButton', () => {
  beforeEach(() => mockRouter())
  afterEach(() => {
    global.fetch = ORIGINAL_FETCH
    vi.clearAllMocks()
  })

  it('renders "Reprocessar" label', () => {
    render(<ReprocessButton readingId={READING_ID} status="failed" />)
    expect(screen.getByText('Reprocessar')).toBeInTheDocument()
    expect(screen.getByTestId('reprocess-button')).toBeInTheDocument()
  })

  it('is disabled when status="processing" (D-T3)', () => {
    render(<ReprocessButton readingId={READING_ID} status="processing" />)
    expect(screen.getByTestId('reprocess-button')).toBeDisabled()
  })

  it('is enabled when status="failed"', () => {
    render(<ReprocessButton readingId={READING_ID} status="failed" />)
    expect(screen.getByTestId('reprocess-button')).not.toBeDisabled()
  })

  it('POSTs to /api/readings/<id>/process on click', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
    global.fetch = fetchMock as typeof global.fetch
    render(<ReprocessButton readingId={READING_ID} status="failed" />)
    fireEvent.click(screen.getByTestId('reprocess-button'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(`/api/readings/${READING_ID}/process`)
    expect((init as RequestInit).method).toBe('POST')
  })

  it('calls router.refresh on 202', async () => {
    const refresh = mockRouter()
    global.fetch = vi.fn(async () =>
      new Response(null, { status: 202 }),
    ) as typeof global.fetch
    render(<ReprocessButton readingId={READING_ID} status="failed" />)
    fireEvent.click(screen.getByTestId('reprocess-button'))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('does NOT call router.refresh on 502', async () => {
    const refresh = mockRouter()
    global.fetch = vi.fn(async () =>
      new Response('fail', { status: 502 }),
    ) as typeof global.fetch
    render(<ReprocessButton readingId={READING_ID} status="failed" />)
    fireEvent.click(screen.getByTestId('reprocess-button'))
    await waitFor(() =>
      expect(screen.getByTestId('reprocess-button')).not.toBeDisabled(),
    )
    expect(refresh).not.toHaveBeenCalled()
  })

  it('disables button while POST is in flight', async () => {
    let resolveFetch!: (value: Response) => void
    global.fetch = vi.fn(() =>
      new Promise<Response>((resolve) => {
        resolveFetch = resolve
      }),
    ) as typeof global.fetch
    render(<ReprocessButton readingId={READING_ID} status="failed" />)
    fireEvent.click(screen.getByTestId('reprocess-button'))
    await waitFor(() =>
      expect(screen.getByTestId('reprocess-button')).toBeDisabled(),
    )
    resolveFetch(new Response(null, { status: 202 }))
    await waitFor(() =>
      expect(screen.getByTestId('reprocess-button')).not.toBeDisabled(),
    )
  })
})
