/**
 * Finalização pública da captura via convite. Equivalente token-authed
 * de finalizeReadingAction (lib/actions/readings.ts) — chama o pipeline
 * Modal + marca o token como queimado.
 *
 * Body (json): { reading_id: string, client_id: string }
 *
 * Passos:
 *   1. Valida token (não usado, não expirado)
 *   2. Confirma reading_id e client_id pertencem ao therapist do token
 *   3. Marca token used_at + used_by_client_id + used_by_reading_id
 *      (idempotente — markTokenUsed usa .is('used_at', null) WHERE)
 *   4. Dispara canonicalize + process via fetch interno COM SERVICE
 *      ROLE BEARER (não cookie — não há sessão). Os endpoints internos
 *      precisam aceitar auth alternativa. SE não aceitarem, a leitura
 *      fica em 'pending' e o terapeuta usa o botão "Reprocessar"
 *      manual (graceful degradation — mesmo princípio do finalize authed).
 *
 * NÃO bloqueia se trigger Modal falhar — fail-safe, terapeuta retentaria
 * via /leituras/[id] com seu próprio session token (RLS funciona porque
 * therapist_id da reading é dele).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateToken, markTokenUsed } from '@/lib/invite/tokens'
import { markReadingReady } from '@/lib/readings/mark-ready'
import { notifyTherapistCaptureComplete } from '@/lib/notifications/notify-therapist-capture-complete'

export const runtime = 'nodejs'

interface FinalizeBody {
  reading_id?: unknown
  client_id?: unknown
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  const validation = await validateToken(token)
  if (validation.status !== 'ok') {
    return NextResponse.json(
      { error: `Token ${validation.status}` },
      { status: validation.status === 'not_found' ? 404 : 410 },
    )
  }

  let body: FinalizeBody
  try {
    body = (await request.json()) as FinalizeBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const readingId = typeof body.reading_id === 'string' ? body.reading_id : null
  const clientId = typeof body.client_id === 'string' ? body.client_id : null
  if (!readingId || !/^[0-9a-f-]{36}$/i.test(readingId)) {
    return NextResponse.json({ error: 'reading_id inválido' }, { status: 400 })
  }
  if (!clientId || !/^[0-9a-f-]{36}$/i.test(clientId)) {
    return NextResponse.json({ error: 'client_id inválido' }, { status: 400 })
  }

  // Confirma pertencimento ao therapist do token.
  const service = createServiceClient()
  const { data: reading } = await service
    .from('readings')
    .select('id, therapist_id, client_id, status')
    .eq('id', readingId)
    .maybeSingle()
  if (!reading || reading.therapist_id !== validation.token.therapist_id) {
    return NextResponse.json({ error: 'reading não pertence ao convite' }, { status: 403 })
  }
  if (reading.client_id !== clientId) {
    return NextResponse.json({ error: 'client_id não bate com reading' }, { status: 400 })
  }

  // Queima o token — idempotente. Se 2 finalizes concorrem, só o 1º
  // grava (used_at IS NULL WHERE). O 2º entra silencioso sem erro.
  const markRes = await markTokenUsed(validation.token.id, clientId, readingId)
  if (markRes.error) {
    console.error(`[invite-finalize] markTokenUsed falhou token=${token}: ${markRes.error}`)
    // Não bloqueia — leitura continua válida; só o registro de uso falhou.
  }

  // Re-confirm consent se cliente era existente (token tinha client_id
  // pré-preenchido). Para cliente novo, o consent 'initial' já foi
  // gravado em completeInviteNewClientAction. Skip para cliente novo
  // (evita duplicata).
  if (validation.token.client_id) {
    const { data: currentTerm } = await service
      .from('consent_terms' as never)
      .select('version')
      .eq('is_current', true)
      .maybeSingle<{ version: string }>()
    if (currentTerm?.version) {
      await service.from('client_consents' as never).insert({
        client_id: clientId,
        reading_id: readingId,
        term_version: currentTerm.version,
        event_type: 'reconfirm_device',
        consent_channel: 'remote_link',
      } as never)
    }
  }

  // Idempotência (2026-05-22, caso Caroline): este endpoint vira segundo
  // caminho redundante. O primary é o auto-finalize em /api/convite/[token]/
  // upload quando o INSERT do 6º reading_image leva count=6 (markReadingReady
  // + markTokenUsed lá). Aqui só age se a reading ainda está em 'pending'
  // (auto-finalize ainda não rodou — ex: count check falhou, ou upload 6
  // chegou em paralelo com o finalize do client).
  if (reading.status === 'pending') {
    const readyRes = await markReadingReady({
      readingId,
      currentStatus: 'pending',
    })
    if (readyRes.error) {
      console.error(`[invite-finalize] markReadingReady falhou token=${token} reading=${readingId}: ${readyRes.error}`)
      // Não bloqueia o cliente — leitura/fotos estão salvas; terapeuta
      // pode usar "Reprocessar" em /leituras/[id] pra disparar manualmente.
    } else {
      // Notifica terapeuta: cliente terminou captura, análise rolando.
      // Caminho secundário (primário é o auto-finalize em upload route
      // quando count=6). CAS interno do markReadingReady garante que
      // apenas o caminho vencedor da race dispara o email. Non-fatal.
      try {
        await notifyTherapistCaptureComplete(readingId)
      } catch (err) {
        console.error(
          '[invite-finalize] notify falhou (non-fatal):',
          err instanceof Error ? err.message : err,
        )
      }
    }
  }

  return NextResponse.json({ ok: true })
}
