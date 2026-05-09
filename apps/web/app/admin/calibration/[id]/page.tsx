import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { LocalDateTime } from '@/components/ui/local-date-time'
import { Badge } from '@/components/ui/badge'
import { PhotoGrid, type CalibrationPhoto } from '@/components/calibration/PhotoGrid'
import { FeaturesDisplay } from '@/components/calibration/FeaturesDisplay'

const SIGNED_URL_TTL_SECONDS = 600 // 10 minutes — inline display only.

export const dynamic = 'force-dynamic'

interface ReadingDetail {
  id: string
  created_at: string
  status: string | null
  vision_features: unknown
  client: { full_name: string | null; birth_date: string | null } | { full_name: string | null; birth_date: string | null }[] | null
}

interface ReadingImageRow {
  eye: string
  angle: string
  storage_path: string
}

interface CalibrationAnnotationRow {
  id: string
  reading_id: string
  real_iris_color: string
  real_constitution: string
  findings_correct: string | null
  findings_invented: string | null
  findings_missed: string | null
  notes: string | null
  reviewed: boolean
  reviewed_at: string | null
  annotated_at: string
}

function getClient(client: ReadingDetail['client']): { full_name: string | null; birth_date: string | null } | null {
  if (!client) return null
  return Array.isArray(client) ? (client[0] ?? null) : client
}

export default async function CalibrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: readingId } = await params
  const supabase = createServiceClient()

  // 1. Fetch reading + client (service-role: admin sees cross-therapist).
  const { data: reading, error: readingError } = await supabase
    .from('readings')
    .select(
      'id, created_at, status, vision_features, client:clients(full_name, birth_date)'
    )
    .eq('id', readingId)
    .maybeSingle()

  if (readingError || !reading) notFound()

  // 2. Fetch reading_images.
  const { data: imagesRaw } = await supabase
    .from('reading_images')
    .select('eye, angle, storage_path')
    .eq('reading_id', readingId)

  const images = (imagesRaw ?? []) as ReadingImageRow[]

  // 3. Generate signed URLs (TTL=600s — inline display).
  let photos: CalibrationPhoto[] = []
  if (images.length > 0) {
    const paths = images.map(img => img.storage_path)
    const { data: signed, error: signedError } = await supabase.storage
      .from('iris-captures')
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)

    if (!signedError && signed) {
      photos = images
        .map((img, idx) => {
          const url = signed[idx]?.signedUrl
          if (!url) return null
          return {
            eye: img.eye as CalibrationPhoto['eye'],
            angle: img.angle as CalibrationPhoto['angle'],
            signedUrl: url,
          }
        })
        .filter((p): p is CalibrationPhoto => p !== null)
    }
  }

  // 4. Fetch existing annotation if present.
  const { data: annotation } = await supabase
    .from('calibration_annotations')
    .select('*')
    .eq('reading_id', readingId)
    .maybeSingle()

  const existingAnnotation = annotation as CalibrationAnnotationRow | null

  const client = getClient(reading.client as ReadingDetail['client'])

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/calibration"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Voltar para lista
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">
            Calibração — {client?.full_name ?? 'sem cliente'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Reading: <span className="font-mono text-xs">{reading.id}</span> ·{' '}
            Capturada: <LocalDateTime iso={reading.created_at} />
            {client?.birth_date && (
              <> · Nascimento: <span className="font-mono text-xs">{client.birth_date}</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {existingAnnotation?.reviewed ? (
            <Badge variant="default" className="bg-emerald-600">revisado</Badge>
          ) : existingAnnotation ? (
            <Badge variant="secondary">anotado</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">pendente</Badge>
          )}
          {existingAnnotation && (
            <span className="text-xs text-muted-foreground">
              última edição: <LocalDateTime iso={existingAnnotation.annotated_at} />
            </span>
          )}
        </div>
      </header>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Fotos da íris
        </h3>
        <PhotoGrid photos={photos} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pipeline output (vision_features)
        </h3>
        <FeaturesDisplay features={reading.vision_features} />
      </section>

      {/* T5 placeholder — AnnotationForm + saveAnnotation server action */}
      <section className="space-y-3 border-t pt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Ground truth (anotação)
        </h3>
        <p className="text-sm text-muted-foreground italic">
          AnnotationForm em construção (T5). Existing annotation:{' '}
          {existingAnnotation
            ? `${existingAnnotation.real_iris_color} / ${existingAnnotation.real_constitution}`
            : 'nenhuma'}
        </p>
      </section>

      {/* T6 placeholder — TechnicalReportCopyButton + PhotoDownloadButton */}
      <section className="space-y-3 border-t pt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Ferramentas
        </h3>
        <p className="text-sm text-muted-foreground italic">
          Botões de copy + download em construção (T6).
        </p>
      </section>
    </div>
  )
}
