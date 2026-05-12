/**
 * POST /api/capture/canonicalize
 *
 * Server-side canonicalize endpoint (Phase 07.1.6). Único entry point para
 * canonical capture pipeline:
 *   - finalizeReadingAction (Wave 2 Plan 05) — chama via internal fetch após 6/6 uploads
 *   - /admin/calibration "Re-canonicalizar" button (Wave 2 Plan 06) — chama via client fetch
 *
 * Idempotente (D-05): re-chamar com mesmo readingId regenera os canonical crops
 * sobre os originais inalterados; canonical_storage_path é overwrite via service-role
 * dentro do orchestrator. Originais (storage_path) NUNCA são tocados.
 *
 * Contract:
 *   POST { "readingId": "<uuid>" }
 *   200 { "results": CanonicalizeResult[], "metadata": CanonicalMetadata, "status_summary": {...} }
 *   400 — body inválido / readingId ausente
 *   401 — sem sessão Supabase
 *   404 — reading não pertence ao user
 *   500 — falha não-recuperável no orchestrator (Sonnet API down, Storage down, etc.)
 *
 * D-01 enforcement: o endpoint NÃO retorna 500 quando alguns crops caem em
 * 'fallback' — o orchestrator (canonicalizeReading) absorve falhas per-imagem
 * e devolve um CanonicalizeResult com canonical_status='fallback'. Endpoint
 * só retorna 500 em falha sistêmica (Sonnet API totalmente down, Storage 5xx
 * em todas as imagens, etc.).
 *
 * D-04 enforcement: env-flag CANONICAL_CAPTURE_ENABLED é checada DENTRO de
 * canonicalizeReading (Plan 03 index.ts). Quando 'false', orchestrator
 * retorna 6× canonical_status='disabled' e o caller (process route Plan 05)
 * cai pra storage_path automaticamente. Endpoint NÃO re-checa a env var.
 *
 * Threat mitigations (T-07.1.6-16..22):
 *   - Auth gate via supabase.auth.getUser() (T-16 spoofing)
 *   - Ownership via .eq('therapist_id', user.id).single() (T-16 spoofing — cross-tenant readingId → 404)
 *   - Body type-check rejeita non-string readingId com 400 (T-17 tampering)
 *   - 500 response inclui name+message somente (sem stack ao cliente; T-19 information disclosure)
 *   - Endpoint NÃO dispara o pipeline de visão downstream (esse disparo permanece em process/route.ts em Wave 2)
 *
 * Phase 07.1.6 | Plan 04 Task 1 | Decisions: C-04, C-05, D-01, D-04, D-05
 */
import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { canonicalizeReading } from '@/lib/canonicalize'

// Force Node.js runtime — sharp + Anthropic SDK não rodam em Edge.
export const runtime = 'nodejs'

interface CanonicalizeRequestBody {
  readingId?: unknown
  /**
   * Optional Phase 07.1.6 UAT item 2 follow-up: when true and canonicalize
   * succeeds, the route also resets reading.status to 'pending' and re-fires
   * the Modal pipeline via /api/readings/{id}/process so Modal consumes the
   * freshly-uploaded canonical crops (not the stale originals from any prior
   * Modal run). Used by /admin/calibration Re-canonicalizar button.
   */
  reprocessModal?: unknown
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Parse + validate body
  let body: CanonicalizeRequestBody
  try {
    body = (await request.json()) as CanonicalizeRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (typeof body.readingId !== 'string' || body.readingId.length === 0) {
    return NextResponse.json(
      { error: 'readingId (string) required' },
      { status: 400 },
    )
  }
  const readingId = body.readingId
  const reprocessModal = body.reprocessModal === true

  // 2. Auth gate (user session — RLS-enforced client)
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  // 3. Ownership check (RLS-enforced via user client; .eq('therapist_id', user.id)
  //    é defense-in-depth — readings RLS já filtra por user, mas o gate explícito
  //    cobre eventual policy drift e produz 404 determinístico em cross-tenant
  //    readingId tampering tentatives — T-07.1.6-16.
  //
  //    NB: nunca consultar auth.users daqui (authenticated role lacks SELECT
  //    no schema auth) — user.id da sessão basta para o ownership match.
  const { data: reading, error: readingError } = await supabase
    .from('readings')
    .select('id, therapist_id')
    .eq('id', readingId)
    .eq('therapist_id', user.id)
    .single()
  if (readingError || !reading) {
    return NextResponse.json({ error: 'Reading not found' }, { status: 404 })
  }

  // 4. Delegate to orchestrator (canonicalizeReading usa service-role internamente
  //    para bypass RLS nos writes; auth+ownership já validados acima).
  //
  //    Não invocamos o vision pipeline nem revalidatePath aqui — o dispatch
  //    downstream permanece responsabilidade do process route (Wave 2 Plan 05
  //    atualiza-o a resolver canonical_storage_path ?? storage_path);
  //    revalidatePath é responsabilidade do caller (finalize action ou admin client).
  try {
    const { results, metadata } = await canonicalizeReading(readingId, user.id)

    // Phase 07.1.6 UAT item 2 follow-up: optionally re-fire Modal so it picks up
    // the freshly-uploaded canonical crops. Without this, /admin/calibration
    // Re-canonicalizar updates canonical_storage_path but Modal's existing
    // vision_features stays stale → report uses old Modal output.
    //
    // Best-effort: failure here does not roll back canonicalize. The canonical
    // crops are already persisted; the founder can still manually click
    // "Reprocessar" if this trigger fails.
    let modalTriggered = false
    let modalTriggerError: string | null = null
    if (reprocessModal) {
      try {
        // Step 1: service-role status reset to 'pending'. Process route's gate
        // accepts {'pending', 'failed'} only; if status is 'ready' / 'delivered'
        // it would 404. Service-role bypasses RLS — caller already passed auth
        // + ownership gates above, so this UPDATE is authorized.
        const service = createServiceClient()
        const { error: resetError } = await service
          .from('readings')
          .update({ status: 'pending' })
          .eq('id', readingId)
        if (resetError) {
          throw new Error(`status reset failed: ${resetError.message}`)
        }

        // Step 2: internal fetch to process route with cookie forwarded
        // (mirror of finalizeReadingAction pattern). Process route now sees
        // canonical_storage_path populated and signs canonical URLs for Modal.
        const cookieStore = await cookies()
        const cookieHeader = cookieStore.toString()
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
        const triggerRes = await fetch(`${baseUrl}/api/readings/${readingId}/process`, {
          method: 'POST',
          headers: { Cookie: cookieHeader },
          cache: 'no-store',
        })
        if (triggerRes.status === 202) {
          modalTriggered = true
        } else {
          const detail = await triggerRes.text().catch(() => '')
          throw new Error(`process route returned ${triggerRes.status}: ${detail.slice(0, 200)}`)
        }
      } catch (err) {
        modalTriggerError = err instanceof Error ? err.message : String(err)
        console.error(
          `[api/capture/canonicalize] reprocessModal failed reading=${readingId}:`,
          modalTriggerError,
        )
      }
    }

    return NextResponse.json(
      {
        results,
        metadata,
        status_summary: metadata.status_summary,
        modal_triggered: modalTriggered,
        ...(modalTriggerError ? { modal_trigger_error: modalTriggerError } : {}),
      },
      { status: 200 },
    )
  } catch (err) {
    const errorMessage =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    console.error(
      `[api/capture/canonicalize] error reading=${readingId}:`,
      errorMessage,
      err instanceof Error && err.stack ? `\n${err.stack}` : '',
    )
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
