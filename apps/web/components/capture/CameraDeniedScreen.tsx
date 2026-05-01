'use client'

import Link from 'next/link'
import { CameraOff } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import type { CameraErrorType } from '@/hooks/use-camera'

interface CameraDeniedScreenProps {
  errorType: CameraErrorType | null
  onRetry: () => void | Promise<void>
}

const HEADING: Record<string, string> = {
  NotAllowedError: 'Permissão da câmera negada',
  NotFoundError: 'Câmera não disponível',
  NotReadableError: 'Câmera em uso por outro app',
  OverconstrainedError: 'Câmera traseira não disponível',
  AbortError: 'Falha ao acessar a câmera',
  SecurityError: 'Conexão insegura',
  UnknownError: 'Câmera não disponível',
}

export function CameraDeniedScreen({ errorType, onRetry }: CameraDeniedScreenProps) {
  const heading = errorType ? (HEADING[errorType] ?? HEADING.UnknownError) : HEADING.UnknownError

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[100dvh] gap-6 px-6 py-12 bg-background text-foreground">
      <CameraOff className="h-16 w-16 text-destructive" aria-hidden="true" />
      <div className="text-center space-y-2 max-w-md">
        <h1 className="text-xl font-semibold">{heading}</h1>
        <p className="text-sm text-muted-foreground">
          Para registrar as imagens da íris, o app precisa de acesso à câmera traseira do seu celular.
        </p>
      </div>

      <Alert className="max-w-md">
        <AlertTitle>Como reabilitar a câmera</AlertTitle>
        <AlertDescription className="space-y-2 text-sm">
          <p><strong>iPhone (Safari):</strong> Ajustes &gt; Safari &gt; Câmera &gt; Permitir.</p>
          <p><strong>Android (Chrome):</strong> Toque no cadeado da barra &gt; Permissões do site &gt; Câmera.</p>
          <p><strong>Computador (Chrome):</strong> Cadeado &gt; Permissões do site &gt; Câmera &gt; Permitir.</p>
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-3 w-full max-w-md">
        <Button onClick={() => void onRetry()} className="h-12">
          Tentar novamente
        </Button>
        <Link
          href="/leituras/nova/upload"
          className={cn(buttonVariants({ variant: 'ghost' }), 'h-12')}
        >
          Continuar via upload no computador
        </Link>
      </div>
    </div>
  )
}
