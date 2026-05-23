/**
 * Upload público de captura via convite — service-role bypassa RLS após
 * validação do token. NÃO substitui a rota authed (capture/upload flow
 * normal); é a contraparte pra path `/convite/[token]/capturar` onde o
 * cliente não tem sessão Supabase.
 *
 * Aceita multipart/form-data com:
 *   blob              : arquivo JPEG da câmera
 *   reading_id        : uuid da reading (criada antes em /convite/[token]/capturar)
 *   eye               : 'left'|'right'
 *   angle             : 'frontal'|'lateral'|'backlight'
 *   width, height     : dims (number)
 *   quality_score     : float 0..1 (vindo do gate Haiku client-side)
 *
 * Segurança:
 *   - Valida token (não usado, não expirado, existe)
 *   - reading_id PRECISA bater com used_by_reading_id do token (setado
 *     pela /convite/[token]/capturar quando cria a reading)
 *   - therapist_id derivado do token (nunca do cliente)
 *
 * NÃO marca used_at — isso vive no /finalize (uma única queima).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateToken, markTokenUsed } from '@/lib/invite/tokens'
import { buildOriginalStoragePath } from '@/lib/capture/storage-path'
import { markReadingReady } from '@/lib/readings/mark-ready'
import { notifyTherapistCaptureComplete } from '@/lib/notifications/notify-therapist-capture-complete'

export const runtime = 'nodejs'

const BUCKET = 'iris-captures'
const VALID_EYES = ['left', 'right'] as const
const VALID_ANGLES = ['frontal', 'lateral', 'backlight'] as const

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

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'invalid multipart body' }, { status: 400 })
  }

  const blob = form.get('blob')
  const readingId = form.get('reading_id')
  const eye = form.get('eye')
  const angle = form.get('angle')
  const widthRaw = form.get('width')
  const heightRaw = form.get('height')
  const qualityRaw = form.get('quality_score')

  if (!(blob instanceof Blob)) {
    return NextResponse.json({ error: 'blob ausente' }, { status: 400 })
  }
  if (typeof readingId !== 'string' || !/^[0-9a-f-]{36}$/i.test(readingId)) {
    return NextResponse.json({ error: 'reading_id inválido' }, { status: 400 })
  }
  if (typeof eye !== 'string' || !VALID_EYES.includes(eye as typeof VALID_EYES[number])) {
    return NextResponse.json({ error: 'eye inválido' }, { status: 400 })
  }
  if (typeof angle !== 'string' || !VALID_ANGLES.includes(angle as typeof VALID_ANGLES[number])) {
    return NextResponse.json({ error: 'angle inválido' }, { status: 400 })
  }
  const width = Number(widthRaw)
  const height = Number(heightRaw)
  const qualityScore = Number(qualityRaw)
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(qualityScore)) {
    return NextResponse.json({ error: 'width/height/quality_score inválidos' }, { status: 400 })
  }

  // Reading PRECISA pertencer ao mesmo therapist do token. Sem essa
  // checagem, um attacker que descobriu o token poderia subir foto pra
  // qualquer reading_id arbitrária.
  const service = createServiceClient()
  const { data: reading } = await service
    .from('readings')
    .select('id, therapist_id')
    .eq('id', readingId)
    .maybeSingle()
  if (!reading || reading.therapist_id !== validation.token.therapist_id) {
    return NextResponse.json({ error: 'reading não pertence ao convite' }, { status: 403 })
  }
  // Defesa em profundidade (2026-05-22): além do therapist match, exige que
  // a reading seja exatamente a vinculada ao token (used_by_reading_id
  // pré-setado em /convite/[token]/capturar quando cria/retoma a reading).
  // Protege contra 2 abas simultâneas: a aba perdedora do race no UPDATE
  // do used_by_reading_id para de uploadar (recebe 403).
  if (validation.token.used_by_reading_id && reading.id !== validation.token.used_by_reading_id) {
    return NextResponse.json({ error: 'reading não vinculada ao convite atual' }, { status: 403 })
  }

  const therapistId = validation.token.therapist_id
  const path = buildOriginalStoragePath(
    therapistId,
    readingId,
    eye as 'left' | 'right',
    angle as 'frontal' | 'lateral' | 'backlight',
  )

  // Storage upload (service-role bypassa RLS folder-based de storage.objects).
  const { error: storageErr } = await service.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (storageErr) {
    console.error(`[invite-upload] storage falhou token=${token} reading=${readingId}: ${storageErr.message}`)
    return NextResponse.json({ error: 'storage falhou' }, { status: 502 })
  }

  // Insert reading_images via service-role (RLS authed bypassed).
  const { error: insertErr } = await service.from('reading_images').upsert(
    {
      reading_id: readingId,
      eye: eye as 'left' | 'right',
      angle: angle as 'frontal' | 'lateral' | 'backlight',
      storage_path: path,
      quality_score: qualityScore,
      width,
      height,
    },
    { onConflict: 'reading_id,eye,angle' },
  )
  if (insertErr) {
    console.error(`[invite-upload] reading_images falhou token=${token} reading=${readingId}: ${insertErr.message}`)
    return NextResponse.json({ error: 'reading_images falhou' }, { status: 502 })
  }

  // Caso Caroline (2026-05-22): cliente terminou os 6 uploads mas finalize
  // do client falhou silenciosamente (network blip / aba fechada / iOS
  // background-kill entre o último upload e o redirect). Reading ficava
  // órfã em 'pending' pra sempre, sem botão de ação pro terapeuta.
  //
  // Fix server-side: derivar "captura completa" do estado do banco em vez
  // de cooperação do client. Quando o INSERT acima leva a count=6, este
  // handler — que JÁ rodou com sucesso (storage + DB) — marca ready +
  // queima token. Idempotente: markReadingReady só age se status='pending'
  // (CAS interno); markTokenUsed só age se used_at IS NULL.
  //
  // Race safety: count=6 é determinístico no Postgres. Se 5 e 6 chegam
  // paralelos, apenas UM request vê count=6; os outros veem ≤5 e ignoram.
  //
  // /api/convite/[token]/finalize continua como segundo caminho redundante
  // (idempotente — se status já não-pending, retorna ok sem refazer).
  const { count: imgCount, error: countErr } = await service
    .from('reading_images')
    .select('id', { count: 'exact', head: true })
    .eq('reading_id', readingId)

  if (!countErr && imgCount === 6) {
    const { data: readingNow } = await service
      .from('readings')
      .select('status, client_id')
      .eq('id', readingId)
      .maybeSingle()

    if (readingNow?.status === 'pending') {
      const readyRes = await markReadingReady({
        readingId,
        currentStatus: 'pending',
      })
      if (readyRes.error) {
        // Non-fatal: upload sucedeu (resposta abaixo retorna ok). Reading
        // segue pending — terapeuta pode usar Reprocessar em /leituras/[id].
        console.error(
          `[invite-upload] auto-finalize markReadingReady falhou token=${token} reading=${readingId}: ${readyRes.error}`,
        )
      } else if (readingNow.client_id) {
        const markRes = await markTokenUsed(
          validation.token.id,
          readingNow.client_id,
          readingId,
        )
        if (markRes.error) {
          console.error(
            `[invite-upload] auto-finalize markTokenUsed falhou token=${token}: ${markRes.error}`,
          )
        } else {
          console.log(
            `[invite-upload] auto-finalize OK token=${token} reading=${readingId} (count=6 atingido)`,
          )
        }
        // Notifica terapeuta: cliente terminou captura, análise rolando.
        // Dentro do guard `if (status === 'pending')` que precede o
        // markReadingReady — apenas UM caminho dispara (CAS race-safe).
        // Non-fatal.
        try {
          await notifyTherapistCaptureComplete(readingId)
        } catch (err) {
          console.error(
            '[invite-upload] notify falhou (non-fatal):',
            err instanceof Error ? err.message : err,
          )
        }
      }
    }
  }

  return NextResponse.json({ path })
}
