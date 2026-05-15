// Pure RSC — renders vision_features as a readable structured report (NOT JSON).
// Used by /admin/calibration/[id] for ground truth annotation.
// Source for the type shape: vision-service/pipeline/features.py extract_all().
import { safeArray } from '@/lib/utils'

interface IrisColorBlock {
  primary?: string | null
  secondary?: string | null
  central_heterochromia?: boolean | null
}

interface ConstitutionBlock {
  primary?: string | null
  secondary?: string | null
  distribution?: string | null
  confidence?: number | null
  indicators?: string[] | null
}

interface FiberDensityBlock {
  score?: number | null
  interpretation?: string | null
}

interface PupilBlock {
  centralization?: string | null
  shape?: string | null
  size_ratio?: number | null
}

interface CollaretteBlock {
  shape?: string | null
  diameter_ratio?: number | null
  decentralization?: string | null
}

interface RingFlag {
  present?: boolean | null
  count?: number | null
  intensity?: string | null
}

interface RingsBlock {
  nerve_rings?: RingFlag | null
  lymphatic_rosary?: RingFlag | null
  sodium_ring?: RingFlag | null
  senile_arc?: RingFlag | null
}

interface SectorFinding {
  type?: string | null
  depth?: string | null
  size_mm?: number | null
  intensity?: string | null
  // iter-6 FIX 13: pigment findings carry color (amarelo_ambar|laranja|
  // marrom_difuso) + extension (leve|moderado|denso).
  color?: string | null
  extension?: string | null
  [key: string]: unknown
}

interface SectorBlock {
  hour?: number | null
  zones?: string[] | null
  findings?: SectorFinding[] | null
}

interface EyeBlock {
  constitution?: ConstitutionBlock | null
  iris_color?: IrisColorBlock | null
  fiber_density?: FiberDensityBlock | null
  pupil?: PupilBlock | null
  collarette?: CollaretteBlock | null
  rings?: RingsBlock | null
  sectors?: SectorBlock[] | null
  image_quality?: { composite_score?: number | null; warnings?: string[] | null } | null
}

interface ProcessingMetadata {
  model_version?: string | null
  processing_time_ms?: number | null
  warnings?: string[] | null
  error_summary?: string | null
  modal_call_id?: string | null
}

interface VisionFeatures {
  right_eye?: EyeBlock | null
  left_eye?: EyeBlock | null
  asymmetry_notes?: string[] | null
  processing_metadata?: ProcessingMetadata | null
  constitution?: ConstitutionBlock | null
}

function fmtPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(1)}%`
}

function fmtConfidence(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toFixed(2)
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="text-sm">{children}</div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="text-muted-foreground min-w-[140px]">{label}:</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}

function ConstitutionCard({ data }: { data: ConstitutionBlock | null | undefined }) {
  if (!data) return <p className="text-muted-foreground italic">Não disponível</p>
  return (
    <div className="space-y-1">
      <Row label="Primary" value={data.primary ?? '—'} />
      {data.secondary && <Row label="Secondary" value={data.secondary} />}
      {data.distribution && <Row label="Distribution" value={data.distribution} />}
      <Row label="Confidence" value={fmtConfidence(data.confidence)} />
      {(() => {
        const indicators = safeArray<string>(data.indicators)
        return indicators.length > 0 ? (
          <Row label="Indicators" value={indicators.join(', ')} />
        ) : null
      })()}
    </div>
  )
}

function EyeCard({ eye, data }: { eye: 'OD' | 'OE'; data: EyeBlock | null | undefined }) {
  if (!data) {
    return (
      <div className="rounded-md border border-dashed p-4">
        <h4 className="text-base font-semibold mb-2">{eye}</h4>
        <p className="text-muted-foreground italic text-sm">Não processado.</p>
      </div>
    )
  }

  const sectorsWithFindings = safeArray<SectorBlock>(data.sectors).filter(
    s => Array.isArray(s.findings) && s.findings.length > 0,
  )
  const totalSectors = safeArray<SectorBlock>(data.sectors).length

  const ringsActive: { name: string; ring: RingFlag }[] = []
  if (data.rings) {
    if (data.rings.nerve_rings?.present) ringsActive.push({ name: 'Anéis nervosos', ring: data.rings.nerve_rings })
    if (data.rings.lymphatic_rosary?.present) ringsActive.push({ name: 'Rosário linfático', ring: data.rings.lymphatic_rosary })
    if (data.rings.sodium_ring?.present) ringsActive.push({ name: 'Anel de sódio', ring: data.rings.sodium_ring })
    if (data.rings.senile_arc?.present) ringsActive.push({ name: 'Arco senil', ring: data.rings.senile_arc })
  }

  return (
    <div className="rounded-md border p-4 space-y-3">
      <h4 className="text-base font-semibold">{eye}</h4>

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase">Cor da íris</p>
        <Row label="Primary" value={data.iris_color?.primary ?? '—'} />
        {data.iris_color?.secondary && <Row label="Secondary" value={data.iris_color.secondary} />}
        {data.iris_color?.central_heterochromia && (
          <Row label="Heterocromia central" value="sim" />
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase">Densidade de fibras</p>
        <Row label="Score" value={fmtPct(data.fiber_density?.score)} />
        <Row label="Interpretação" value={data.fiber_density?.interpretation ?? '—'} />
      </div>

      {data.collarette && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase">Coroa</p>
          <Row label="Shape" value={data.collarette.shape ?? '—'} />
          <Row label="Diameter ratio" value={fmtConfidence(data.collarette.diameter_ratio)} />
          <Row label="Decentralization" value={data.collarette.decentralization ?? '—'} />
        </div>
      )}

      {data.pupil && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase">Pupila</p>
          <Row label="Centralização" value={data.pupil.centralization ?? '—'} />
          <Row label="Shape" value={data.pupil.shape ?? '—'} />
          <Row label="Size ratio" value={fmtConfidence(data.pupil.size_ratio)} />
        </div>
      )}

      {ringsActive.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase">Anéis presentes</p>
          {ringsActive.map(({ name, ring }) => (
            <Row
              key={name}
              label={name}
              value={
                ring.intensity
                  ? `intensidade ${ring.intensity}${ring.count != null ? ` · ${ring.count}` : ''}`
                  : ring.count != null
                    ? `${ring.count}`
                    : 'presente'
              }
            />
          ))}
        </div>
      )}

      {sectorsWithFindings.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            Setores com achados ({sectorsWithFindings.length}/{totalSectors})
          </p>
          {sectorsWithFindings.map(sector => (
            <div key={sector.hour ?? 'unknown'} className="ml-2 mt-1">
              <p className="font-mono text-xs text-foreground">
                Setor {sector.hour ?? '?'} ({safeArray<string>(sector.zones).join(', ') || '—'}):
              </p>
              <ul className="ml-4 list-disc text-xs">
                {safeArray<SectorFinding>(sector.findings).map((f, i) => (
                  <li key={i}>
                    <span className="font-mono">{f.type ?? 'finding'}</span>
                    {f.color && ` · ${f.color}`}
                    {f.depth && ` · ${f.depth}`}
                    {f.size_mm != null && ` · ${f.size_mm} mm`}
                    {f.extension && ` · ${f.extension}`}
                    {f.intensity && ` · intensidade ${f.intensity}`}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {data.image_quality && (
        <div className="space-y-1 pt-2 border-t border-dashed">
          <p className="text-xs font-medium text-muted-foreground uppercase">Qualidade da imagem</p>
          <Row label="Composite score" value={fmtConfidence(data.image_quality.composite_score)} />
          {(() => {
            const warnings = safeArray<string>(data.image_quality?.warnings)
            return warnings.length > 0 ? (
              <Row label="Warnings" value={warnings.join(', ')} />
            ) : null
          })()}
        </div>
      )}
    </div>
  )
}

export function FeaturesDisplay({ features }: { features: unknown }) {
  const f = features as VisionFeatures | null

  if (!f) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center">
        <p className="text-muted-foreground italic">vision_features ausente.</p>
      </div>
    )
  }

  // Constitution may live at top-level OR per-eye. Prefer top-level if present.
  const topConstitution = f.constitution ?? f.right_eye?.constitution ?? f.left_eye?.constitution

  return (
    <div className="space-y-6">
      <Section title="Constituição (consenso)">
        <ConstitutionCard data={topConstitution} />
      </Section>

      <Section title="Por olho">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EyeCard eye="OD" data={f.right_eye} />
          <EyeCard eye="OE" data={f.left_eye} />
        </div>
      </Section>

      {(() => {
        const notes = safeArray<string>(f.asymmetry_notes)
        return notes.length > 0 ? (
          <Section title="Assimetria">
            <ul className="list-disc ml-6 space-y-0.5">
              {notes.map(note => (
                <li key={note} className="font-mono text-xs">{note}</li>
              ))}
            </ul>
          </Section>
        ) : null
      })()}

      {f.processing_metadata && (
        <Section title="Processamento">
          {f.processing_metadata.model_version && (
            <Row label="Model version" value={f.processing_metadata.model_version} />
          )}
          {f.processing_metadata.processing_time_ms != null && (
            <Row label="Duração" value={`${f.processing_metadata.processing_time_ms} ms`} />
          )}
          {f.processing_metadata.modal_call_id && (
            <Row label="Modal call id" value={f.processing_metadata.modal_call_id} />
          )}
          {(() => {
            const pmWarnings = safeArray<string>(f.processing_metadata?.warnings)
            return pmWarnings.length > 0 ? (
              <Row label="Warnings" value={pmWarnings.join(', ')} />
            ) : null
          })()}
          {f.processing_metadata.error_summary && (
            <Row label="Error summary" value={f.processing_metadata.error_summary} />
          )}
        </Section>
      )}
    </div>
  )
}

// Exported types so siblings (TechnicalReportCopyButton, AnnotationForm) reuse the shape.
export type {
  VisionFeatures,
  EyeBlock,
  IrisColorBlock,
  ConstitutionBlock,
  FiberDensityBlock,
  PupilBlock,
  CollaretteBlock,
  RingsBlock,
  SectorBlock,
  SectorFinding,
  ProcessingMetadata,
}
