'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface SignedPhotoEntry {
  eye: string
  angle: string
  url: string
  filename: string
}

const EYE_LABEL: Record<string, string> = { right: 'OD', left: 'OE' }
const ANGLE_LABEL: Record<string, string> = {
  frontal: 'frontal',
  lateral: 'lateral',
  backlight: 'contraluz',
}

export function PhotoDownloadButton({ readingId }: { readingId: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const [signedUrls, setSignedUrls] = useState<SignedPhotoEntry[] | null>(null)

  async function handleFetch() {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/admin/calibration/photos/${encodeURIComponent(readingId)}`,
      )
      if (!response.ok) {
        toast.error(`Erro ao buscar fotos (${response.status})`)
        setSignedUrls(null)
        return
      }
      const json = (await response.json()) as { signedUrls?: SignedPhotoEntry[] }
      const urls = json.signedUrls ?? []
      if (urls.length === 0) {
        toast.warning('Nenhuma foto encontrada para esta leitura')
      }
      setSignedUrls(urls)
    } catch {
      toast.error('Falha de rede ao buscar fotos')
      setSignedUrls(null)
    } finally {
      setIsLoading(false)
    }
  }

  if (signedUrls === null) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleFetch}
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Gerando links...
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            Baixar fotos
          </>
        )}
      </Button>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Links válidos por 24h · clique em cada para baixar
      </p>
      <div className="flex flex-wrap gap-2">
        {signedUrls.map(entry => (
          <a
            key={entry.filename}
            href={entry.url}
            download={entry.filename}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border bg-background hover:bg-muted transition-colors"
          >
            <Download className="h-3 w-3" />
            {EYE_LABEL[entry.eye] ?? entry.eye} {ANGLE_LABEL[entry.angle] ?? entry.angle}
          </a>
        ))}
      </div>
    </div>
  )
}
