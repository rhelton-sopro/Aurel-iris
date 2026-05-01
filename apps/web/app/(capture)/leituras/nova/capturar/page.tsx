import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CaptureClient } from './capture-client'

export default async function CapturarPage({
  searchParams,
}: {
  searchParams: Promise<{ reading?: string; resume?: string }>
}) {
  const { reading: readingId, resume } = await searchParams

  if (!readingId) {
    redirect('/leituras/nova')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS de readings filtra automaticamente para auth.uid() = therapist_id
  // Se o readingId não pertence ao terapeuta, a query retorna null → redirect
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

  // Se não encontra (não é dono OU id inválido) → volta para /leituras/nova
  if (!reading || error) {
    redirect('/leituras/nova')
  }

  // Se reading já saiu de pending (foi para Fase 5 processing/ready/edited),
  // não faz sentido retornar para captura — manda para /leituras
  if (reading.status !== 'pending') {
    redirect('/leituras')
  }

  // Estrutura do client name vinda do select pode ser objeto ou array
  const clientObj = Array.isArray(reading.clients) ? reading.clients[0] : reading.clients
  const clientName = (clientObj as { full_name?: string } | null)?.full_name ?? 'Cliente'

  return (
    <CaptureClient
      readingId={reading.id}
      therapistId={user.id}
      clientName={clientName}
      capturedSlots={(reading.reading_images ?? []).map((img: { eye: string; angle: string }) => ({ eye: img.eye, angle: img.angle }))}
      resumeMode={resume === 'true'}
    />
  )
}
