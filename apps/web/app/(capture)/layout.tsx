import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Captura de leitura | Iris Codex',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default async function CaptureLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  // Defesa em profundidade — middleware já protege /leituras/* mas server layouts
  // devem verificar identidade independentemente (padrão T-02-06 da Fase 2)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    redirect('/login')
  }

  return (
    <div className="min-h-[100dvh] bg-black flex flex-col text-white">
      {children}
    </div>
  )
}
