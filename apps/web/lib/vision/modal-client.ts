/**
 * Thin HTTP client for the Modal `analyze_iris_endpoint` web endpoint.
 *
 * Pattern: RESEARCH.md Pattern 2 + Pitfall 1. The npm `modal` JS SDK does
 * not yet support `.spawn()` (April 2026); the canonical 2026 path is to
 * call the FastAPI endpoint exposed by `@modal.fastapi_endpoint(method='POST')`
 * via `fetch()` with `Modal-Key`/`Modal-Secret` proxy auth headers.
 */
import 'server-only'

export const MODAL_ENDPOINT_TIMEOUT_MS = 10_000 // ample for sync spawn return (<1s typical)

export interface ImageUrlEntry {
  eye: 'right' | 'left'
  angle: 'frontal' | 'lateral' | 'backlight'
  url: string
}

export interface TriggerArgs {
  readingId: string
  imageUrls: ImageUrlEntry[]
}

export interface TriggerResult {
  callId: string
}

export class ModalTriggerError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'ModalTriggerError'
  }
}

export async function triggerVisionPipeline(args: TriggerArgs): Promise<TriggerResult> {
  const endpoint = process.env.MODAL_ANALYZE_ENDPOINT_URL
  const tokenId = process.env.MODAL_TOKEN_ID
  const tokenSecret = process.env.MODAL_TOKEN_SECRET
  if (!endpoint) throw new ModalTriggerError('MODAL_ANALYZE_ENDPOINT_URL is not set')
  if (!tokenId) throw new ModalTriggerError('MODAL_TOKEN_ID is not set')
  if (!tokenSecret) throw new ModalTriggerError('MODAL_TOKEN_SECRET is not set')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), MODAL_ENDPOINT_TIMEOUT_MS)

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Modal-Key': tokenId,
        'Modal-Secret': tokenSecret,
      },
      body: JSON.stringify({
        reading_id: args.readingId,
        image_urls: args.imageUrls,
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new ModalTriggerError(
        `Modal trigger failed: ${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ''}`,
        res.status,
      )
    }

    const json = (await res.json()) as { call_id?: string }
    if (!json.call_id) throw new ModalTriggerError('Modal response missing call_id')
    return { callId: json.call_id }
  } finally {
    clearTimeout(timeoutId)
  }
}
