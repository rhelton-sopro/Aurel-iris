import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UploadClient } from './upload-client'

/**
 * Tela do wizard de upload desktop.
 *
 * Ponto de entrada: /leituras/nova/upload?reading=<uuid>
 *   - reading deve estar em status='pending' e capture_method='desktop_upload'.
 *   - Reading é criada por createReadingAction (formData.method='desktop_upload')
 *     a partir de /leituras/nova (CONTEXT D-01, D-03).
 *
 * Guards:
 *   1. Sem ?reading                                           -> redirect /leituras/nova.
 *   2. Reading nao encontrado (RLS bloqueia se nao e dono)    -> redirect /leituras/nova.
 *   3. CONTEXT D-04: capture_method='mobile_camera'           -> redirect /capturar?reading=<id>.
 *      (Metodo e imutavel uma vez criado; URL trocada cai no fluxo correto.)
 *   4. Reading status !== 'pending'                           -> redirect /leituras (ja finalizou).
 *
 * Substitui o placeholder herdado da Fase 3.
 */
export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ reading?: string; resume?: string }>
}) {
  const { reading: readingId, resume } = await searchParams

  if (!readingId) {
    redirect('/leituras/nova')
  }

  const supabase = await createClient()
  // T-02-01 / T-02-06: getUser() server-side, nunca getSession.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS de readings filtra automaticamente para auth.uid() = therapist_id.
  // Se o readingId nao pertence ao terapeuta, a query retorna null -> redirect.
  const { data: reading, error } = await supabase
    .from('readings')
    .select(`
      id,
      status,
      capture_method,
      client_id,
      created_at,
      clients(full_name),
      reading_images(id, eye, angle, quality_score, storage_path)
    `)
    .eq('id', readingId)
    .single()

  if (!reading || error) {
    redirect('/leituras/nova')
  }

  // CONTEXT D-04: metodo e imutavel apos criacao. URL para o fluxo errado
  // -> redireciona para o fluxo correto, mantendo o reading.
  if (reading.capture_method === 'mobile_camera') {
    redirect(`/leituras/nova/capturar?reading=${readingId}`)
  }

  // Reading ja saiu de pending (Fase 5 processing/ready/edited) -- nao tem
  // sentido voltar pra captura.
  if (reading.status !== 'pending') {
    redirect('/leituras')
  }

  // Estrutura do client name vinda do select pode ser objeto ou array.
  const clientObj = Array.isArray(reading.clients) ? reading.clients[0] : reading.clients
  const clientName = (clientObj as { full_name?: string } | null)?.full_name ?? 'Cliente'

  return (
    <UploadClient
      readingId={reading.id}
      therapistId={user.id}
      clientName={clientName}
      capturedSlots={(reading.reading_images ?? []).map(
        (img: { eye: string; angle: string }) => ({ eye: img.eye, angle: img.angle }),
      )}
      resumeMode={resume === 'true'}
    />
  )
}
