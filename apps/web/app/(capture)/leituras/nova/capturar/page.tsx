import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Smartphone } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CaptureClient } from './capture-client'

/**
 * Detecta mobile via UA. Conservador: se NÃO contém marcador mobile claro,
 * assume desktop. iPadOS moderno reporta "Macintosh" — se quiser permitir
 * iPad, adicione 'Macintosh' aqui (cuidado: vai casar Mac também).
 *
 * Caso founder UAT 2026-05-22: founder abriu "Continuar" no PC pra leitura
 * iniciada em mobile_camera — CaptureClient é UI mobile-only (getUserMedia
 * + <input capture="environment">), quebra em desktop. Em vez de tentar
 * fazer responsive, bloqueia gracioso com mensagem clara.
 */
function isMobileUserAgent(ua: string): boolean {
  return /Mobi|Android|iPhone|iPod/i.test(ua)
}

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

  // Gate UA: CaptureClient é UI mobile-only. Em desktop o getUserMedia +
  // <input capture="environment"> ficam quebrados. Em vez de tentar fazer
  // responsive (escopo grande, edge cases de detecção de webcam, etc),
  // mostra tela clara explicando que precisa do celular.
  const ua = (await headers()).get('user-agent') ?? ''
  const isMobile = isMobileUserAgent(ua)
  if (!isMobile) {
    const capturedCount = reading.reading_images?.length ?? 0
    return (
      <div className="mx-auto max-w-md px-4 py-12 space-y-6 text-center">
        <Smartphone className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Continue do celular</h1>
          <p className="text-sm text-muted-foreground">
            Esta captura foi iniciada no modo <strong>celular</strong> e precisa
            ser continuada do mesmo dispositivo. A câmera do computador não está
            calibrada para a leitura iridológica.
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/30 p-4 text-left space-y-1.5 text-sm">
          <p className="font-medium">O que fazer:</p>
          <ol className="list-decimal pl-5 space-y-1 text-foreground/80">
            <li>Abra <strong>iriscodex.com/leituras</strong> no seu celular.</li>
            <li>Faça login com a mesma conta.</li>
            <li>Procure a leitura desta cliente e toque em <strong>Continuar</strong>.</li>
          </ol>
          {capturedCount > 0 && (
            <p className="pt-2 text-xs text-muted-foreground">
              Já capturou {capturedCount} de 6 fotos — as fotos já enviadas estão
              salvas. Você retoma do ponto onde parou.
            </p>
          )}
        </div>
        <Link
          href="/leituras"
          className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
        >
          Voltar para leituras
        </Link>
      </div>
    )
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
