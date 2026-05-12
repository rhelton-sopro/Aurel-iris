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
  /** Phase 07.1.6 — signed URL para canonical_storage_path. null when canonical_storage_path IS NULL. */
  canonical_url: string | null
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
        Links válidos por 24h · canonical 800×800 quando disponível ·{' '}
        <span className="font-mono">(o)</span> = original full-size
      </p>
      <div className="flex flex-wrap gap-2">
        {signedUrls.map(entry => {
          const eyeLabel = EYE_LABEL[entry.eye] ?? entry.eye
          const angleLabel = ANGLE_LABEL[entry.angle] ?? entry.angle
          const baseFilename = `${entry.filename.replace(/\.jpg$/i, '')}`
          return (
            <span key={entry.filename} className="inline-flex items-center gap-1">
              {/* Phase 07.1.6: prefer canonical_url when available (800×800 cropped).
                  Founder workflow needs the canonical version to inspect what Modal
                  saw; fall back to original only when canonical_storage_path is NULL. */}
              <a
                href={entry.canonical_url ?? entry.url}
                download={
                  entry.canonical_url
                    ? `${baseFilename}_canonical.jpg`
                    : entry.filename
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border bg-background hover:bg-muted transition-colors"
              >
                <Download className="h-3 w-3" />
                {eyeLabel} {angleLabel}
                {entry.canonical_url ? null : (
                  <span className="text-muted-foreground"> (sem canonical)</span>
                )}
              </a>
              {/* Secondary link to original when canonical is the primary —
                  founder can still grab the full-size raw if needed for forensics. */}
              {entry.canonical_url ? (
                <a
                  href={entry.url}
                  download={entry.filename}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1"
                  title="Baixar original full-size"
                >
                  (o)
                </a>
              ) : null}
            </span>
          )
        })}
      </div>
    </div>
  )
}
