import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { LocalDateTime } from '@/components/ui/local-date-time'
import { Badge } from '@/components/ui/badge'
import { PhotoGrid, type CalibrationPhoto } from '@/components/calibration/PhotoGrid'
import { FeaturesDisplay } from '@/components/calibration/FeaturesDisplay'
import { AnnotationForm } from '@/components/calibration/AnnotationForm'
import { CalibrationDiagnosisForm } from '@/components/calibration/CalibrationDiagnosisForm'
import { TechnicalReportCopyButton } from '@/components/calibration/TechnicalReportCopyButton'
import { PhotoDownloadButton } from '@/components/calibration/PhotoDownloadButton'
import { RecanonicalizeButton } from '@/components/calibration/RecanonicalizeButton'
import { ReparseReportButton } from '@/components/calibration/ReparseReportButton'

const SIGNED_URL_TTL_SECONDS = 600 // 10 minutes — inline display only.

export const dynamic = 'force-dynamic'

interface ReadingDetail {
  id: string
  created_at: string
  status: string | null
  vision_features: unknown
  // Phase 07.1.6 — jsonb CanonicalMetadata shape (status_summary + canonicalized_at).
  canonical_metadata: unknown
  client: { full_name: string | null; birth_date: string | null } | { full_name: string | null; birth_date: string | null }[] | null
}

interface ReadingImageRow {
  eye: string
  angle: string
  storage_path: string
  /** Phase 07.1.6 — canonical 800×800 crop path. NULL when canonicalize hasn't run or fell back. */
  canonical_storage_path: string | null
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

interface CalibrationDiagnosisRow {
  id: string
  reading_id: string
  diagnosis: string
  updated_at: string
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
      'id, created_at, status, vision_features, canonical_metadata, client:clients(full_name, birth_date)'
    )
    .eq('id', readingId)
    .maybeSingle()

  if (readingError || !reading) notFound()

  // 2. Fetch reading_images. Phase 07.1.6: also pull canonical_storage_path so
  // the inline PhotoGrid renders the 800×800 canonical crop when available
  // (founder needs to see what Modal actually consumed, not the raw originals).
  const { data: imagesRaw } = await supabase
    .from('reading_images')
    .select('eye, angle, storage_path, canonical_storage_path')
    .eq('reading_id', readingId)

  const images = (imagesRaw ?? []) as ReadingImageRow[]

  // 3. Generate signed URLs (TTL=600s — inline display).
  // Phase 07.1.6 UAT item 2: prefer canonical 800×800 crop when available so
  // the founder inspects the SAME image Modal received, not the raw original.
  let photos: CalibrationPhoto[] = []
  if (images.length > 0) {
    // Resolve per-image path: canonical_storage_path (800×800 crop) if set, else original.
    const paths = images.map(img => img.canonical_storage_path ?? img.storage_path)
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

  // 4. Fetch existing structured annotation (corpus / ML row).
  const { data: annotation } = await supabase
    .from('calibration_annotations')
    .select('*')
    .eq('reading_id', readingId)
    .maybeSingle()

  const existingAnnotation = annotation as CalibrationAnnotationRow | null

  // 5. Fetch existing free-text diagnosis (operational document row).
  const { data: diagnosis } = await supabase
    .from('calibration_diagnoses')
    .select('*')
    .eq('reading_id', readingId)
    .maybeSingle()

  const existingDiagnosis = diagnosis as CalibrationDiagnosisRow | null

  const client = getClient(reading.client as ReadingDetail['client'])

  // Phase 07.1.6 — canonical_metadata jsonb (CanonicalMetadata shape: status_summary + canonicalized_at).
  // NULL para readings pre-07.1.6 (D-05 backfill on-demand via RecanonicalizeButton) ou pre-finalize.
  const canonicalMeta = reading.canonical_metadata as {
    status_summary?: { ok?: number; fallback?: number; disabled?: number }
    canonicalized_at?: string
  } | null
  const okCount = canonicalMeta?.status_summary?.ok ?? 0
  const fallbackCount = canonicalMeta?.status_summary?.fallback ?? 0
  const disabledCount = canonicalMeta?.status_summary?.disabled ?? 0
  const totalCanonical = okCount + fallbackCount + disabledCount

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
        <div className="flex flex-wrap items-center gap-2">
          {/* Phase 07.1.6 — canonical_metadata badge (D-05 audit-ability). */}
          {totalCanonical > 0 ? (
            <Badge
              variant={fallbackCount > 0 || disabledCount > 0 ? 'secondary' : 'default'}
              className={fallbackCount === 0 && disabledCount === 0 ? 'bg-violet-600' : ''}
            >
              canonical {okCount}/{totalCanonical}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              canonical pendente
            </Badge>
          )}
          {existingDiagnosis && (
            <Badge variant="default" className="bg-blue-600">diagnóstico salvo</Badge>
          )}
          {existingAnnotation?.reviewed ? (
            <Badge variant="default" className="bg-emerald-600">corpus revisado</Badge>
          ) : existingAnnotation ? (
            <Badge variant="secondary">corpus anotado</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">corpus pendente</Badge>
          )}
        </div>
      </header>

      {/* ── Visual context ─────────────────────────────────────── */}
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

      {/* ── Iterative calibration loop (PRIMARY) ───────────────── */}
      <section className="space-y-3 border-t pt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Ciclo de calibração iterativo
        </h3>
        <p className="text-sm text-muted-foreground">
          Fluxo: copiar relatório técnico → colar em conversa externa →
          preencher 3 seções (anotação humana / diagnóstico comparativo /
          ação de calibração) → colar resultado abaixo e salvar.
        </p>
        <div className="flex flex-wrap items-start gap-3">
          <TechnicalReportCopyButton
            readingId={reading.id}
            clientName={client?.full_name ?? null}
            capturedAt={reading.created_at}
            features={reading.vision_features}
          />
          <PhotoDownloadButton readingId={reading.id} />
          <RecanonicalizeButton readingId={reading.id} />
          <ReparseReportButton readingId={reading.id} />
          <Link
            href={`/admin/calibration/${reading.id}/comparar`}
            className="inline-flex items-center gap-2 rounded-md border border-violet-600 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50"
          >
            Comparar SAM →
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <CalibrationDiagnosisForm
          readingId={reading.id}
          existingDiagnosis={existingDiagnosis?.diagnosis ?? null}
          diagnosisUpdatedAt={existingDiagnosis?.updated_at ?? null}
        />
      </section>

      {/* ── Structured corpus (SECONDARY — ML use, not blocking) ── */}
      <section className="space-y-3 border-t pt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Corpus estruturado (ML — opcional)
        </h3>
        <p className="text-sm text-muted-foreground">
          Campos categóricos para futura recalibração de centróides LAB (Wave B)
          e dataset de aprendizagem (Phase 10). Preenchimento opcional —
          o ciclo iterativo acima é o documento operacional principal.
        </p>
        <AnnotationForm
          readingId={reading.id}
          existingAnnotation={
            existingAnnotation
              ? {
                  reading_id: existingAnnotation.reading_id,
                  real_iris_color: existingAnnotation.real_iris_color,
                  real_constitution: existingAnnotation.real_constitution,
                  findings_correct: existingAnnotation.findings_correct,
                  findings_invented: existingAnnotation.findings_invented,
                  findings_missed: existingAnnotation.findings_missed,
                  notes: existingAnnotation.notes,
                  reviewed: existingAnnotation.reviewed,
                }
              : null
          }
        />
      </section>
    </div>
  )
}
