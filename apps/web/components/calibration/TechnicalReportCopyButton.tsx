'use client'

import { useState } from 'react'
import { Copy, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { safeArray } from '@/lib/utils'
import type {
  VisionFeatures,
  EyeBlock,
  ConstitutionBlock,
  RingsBlock,
  SectorBlock,
} from './FeaturesDisplay'

interface TechnicalReportCopyButtonProps {
  readingId: string
  clientName: string | null
  capturedAt: string | null
  features: unknown
}

interface SignedPhotoEntry {
  eye: string
  angle: string
  url: string
  filename: string
}

const EYE_LABEL_LONG: Record<string, string> = {
  right: 'OD (olho direito)',
  left: 'OE (olho esquerdo)',
}

const ANGLE_LABEL_LONG: Record<string, string> = {
  frontal: 'frontal',
  lateral: 'lateral',
  backlight: 'contraluz',
}

function fmtPctText(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'NA'
  return `${(value * 100).toFixed(1)}%`
}

function fmtConfText(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'NA'
  return value.toFixed(2)
}

function constitutionLines(prefix: string, c: ConstitutionBlock | null | undefined): string[] {
  if (!c) return [`${prefix}não disponível`]
  const lines: string[] = []
  if (c.primary) lines.push(`${prefix}Primary: ${c.primary} (conf=${fmtConfText(c.confidence)})`)
  if (c.secondary) lines.push(`${prefix}Secondary: ${c.secondary}`)
  if (c.distribution) lines.push(`${prefix}Distribution: ${c.distribution}`)
  const indicators = safeArray<string>(c.indicators)
  if (indicators.length > 0) {
    lines.push(`${prefix}Indicators: ${indicators.join(', ')}`)
  }
  return lines
}

function ringsLines(rings: RingsBlock | null | undefined): string[] {
  if (!rings) return []
  const out: string[] = []
  if (rings.nerve_rings?.present) {
    const r = rings.nerve_rings
    out.push(
      `    Anéis nervosos: ${r.intensity ?? 'presente'}${r.count != null ? ` (${r.count})` : ''}`,
    )
  }
  if (rings.lymphatic_rosary?.present) out.push('    Rosário linfático: presente')
  if (rings.sodium_ring?.present) out.push('    Anel de sódio: presente')
  if (rings.senile_arc?.present) out.push('    Arco senil: presente')
  return out
}

function sectorLines(sectors: SectorBlock[] | null | undefined): string[] {
  const lines: string[] = []
  for (const s of safeArray<SectorBlock>(sectors)) {
    const findings = safeArray<NonNullable<SectorBlock['findings']>[number]>(s.findings)
    if (findings.length === 0) continue
    lines.push(`    Setor ${s.hour ?? '?'} (${safeArray<string>(s.zones).join(', ')}):`)
    for (const f of findings) {
      const parts: string[] = [f.type ?? 'finding']
      if (f.color) parts.push(f.color)
      if (f.depth) parts.push(f.depth)
      if (f.size_mm != null) parts.push(`${f.size_mm} mm`)
      if (f.extension) parts.push(f.extension)
      if (f.intensity) parts.push(`intensidade ${f.intensity}`)
      lines.push(`      - ${parts.join(' · ')}`)
    }
  }
  return lines
}

function eyeBlock(label: 'OD' | 'OE', eye: EyeBlock | null | undefined): string[] {
  const lines: string[] = []
  lines.push('')
  lines.push(`OLHO ${label === 'OD' ? 'DIREITO' : 'ESQUERDO'}`)
  if (!eye) {
    lines.push('  não processado')
    return lines
  }
  if (eye.iris_color) {
    lines.push(`  Cor da íris: ${eye.iris_color.primary ?? 'NA'}`)
    if (eye.iris_color.secondary) lines.push(`    secondary: ${eye.iris_color.secondary}`)
    if (eye.iris_color.central_heterochromia) lines.push('    heterocromia central: sim')
  }
  if (eye.fiber_density) {
    lines.push(
      `  Densidade de fibras: ${fmtPctText(eye.fiber_density.score)} (${eye.fiber_density.interpretation ?? 'NA'})`,
    )
  }
  if (eye.collarette) {
    lines.push(
      `  Coroa: ${eye.collarette.shape ?? 'NA'} · diameter ratio ${fmtConfText(eye.collarette.diameter_ratio)} · ${eye.collarette.decentralization ?? 'NA'}`,
    )
  }
  if (eye.pupil) {
    lines.push(
      `  Pupila: ${eye.pupil.shape ?? 'NA'} · ${eye.pupil.centralization ?? 'NA'} · size ratio ${fmtConfText(eye.pupil.size_ratio)}`,
    )
  }
  const rings = ringsLines(eye.rings)
  if (rings.length > 0) {
    lines.push('  Anéis presentes:')
    lines.push(...rings)
  }
  const sectors = sectorLines(eye.sectors)
  if (sectors.length > 0) {
    lines.push('  Setores com achados:')
    lines.push(...sectors)
  }
  if (eye.image_quality) {
    const warnings = safeArray<string>(eye.image_quality.warnings)
    lines.push(
      `  Qualidade da imagem: composite ${fmtConfText(eye.image_quality.composite_score)}` +
        (warnings.length > 0 ? ` · warnings: ${warnings.join(', ')}` : ''),
    )
  }
  return lines
}

function fmtCapturedAt(iso: string | null): string | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    })
  } catch {
    return iso
  }
}

function photosBlock(photos: SignedPhotoEntry[]): string[] {
  if (photos.length === 0) {
    return ['', 'FOTOS', '  (nenhuma foto registrada)']
  }
  const lines: string[] = ['', 'FOTOS (links válidos por 24h)']
  // Sort canonical: OD first, then OE; within each: frontal | lateral | backlight
  const order = ['frontal', 'lateral', 'backlight']
  const sorted = [...photos].sort((a, b) => {
    if (a.eye !== b.eye) return a.eye === 'right' ? -1 : 1
    return order.indexOf(a.angle) - order.indexOf(b.angle)
  })
  for (const p of sorted) {
    const eye = EYE_LABEL_LONG[p.eye] ?? p.eye
    const angle = ANGLE_LABEL_LONG[p.angle] ?? p.angle
    lines.push(`  ${eye} · ${angle}:`)
    lines.push(`    ${p.url}`)
  }
  return lines
}

function footerSections(): string[] {
  return [
    '',
    '═════════════════════════════════════════════════════════════',
    'ANOTAÇÃO HUMANA',
    '═════════════════════════════════════════════════════════════',
    '(observação visual do iridologista — cor real, constituição',
    ' real, achados percebidos, contexto clínico do cliente)',
    '',
    '',
    '═════════════════════════════════════════════════════════════',
    'DIAGNÓSTICO COMPARATIVO',
    '═════════════════════════════════════════════════════════════',
    '(diff entre o output do pipeline acima e a observação humana —',
    ' falsos positivos, falsos negativos, drift de classificação,',
    ' hipóteses sobre fonte do erro)',
    '',
    '',
    '═════════════════════════════════════════════════════════════',
    'AÇÃO DE CALIBRAÇÃO PROPOSTA',
    '═════════════════════════════════════════════════════════════',
    '(o que precisa ser feito no código — qual módulo, qual',
    ' parâmetro, qual fixture; estimar esforço e prioridade)',
    '',
  ]
}

function buildText(
  props: TechnicalReportCopyButtonProps,
  photos: SignedPhotoEntry[],
): string {
  const f = (props.features ?? {}) as VisionFeatures
  const lines: string[] = []

  // ── Header ────────────────────────────────────────────────────
  lines.push('═════════════════════════════════════════════════════════════')
  lines.push(`LEITURA TÉCNICA — ${props.readingId}`)
  lines.push('═════════════════════════════════════════════════════════════')
  if (props.clientName) lines.push(`Cliente: ${props.clientName}`)
  const captured = fmtCapturedAt(props.capturedAt)
  if (captured) lines.push(`Capturado: ${captured}`)

  // ── Photos ────────────────────────────────────────────────────
  for (const line of photosBlock(photos)) lines.push(line)

  // ── Constitution ──────────────────────────────────────────────
  lines.push('')
  lines.push('CONSTITUIÇÃO (consenso)')
  const topConstitution = f.constitution ?? f.right_eye?.constitution ?? f.left_eye?.constitution
  for (const line of constitutionLines('  ', topConstitution)) lines.push(line)

  // ── Per-eye ───────────────────────────────────────────────────
  for (const line of eyeBlock('OD', f.right_eye)) lines.push(line)
  for (const line of eyeBlock('OE', f.left_eye)) lines.push(line)

  // ── Asymmetry ─────────────────────────────────────────────────
  const asymmetry = safeArray<string>(f.asymmetry_notes)
  if (asymmetry.length > 0) {
    lines.push('')
    lines.push('ASSIMETRIA')
    for (const note of asymmetry) lines.push(`  - ${note}`)
  }

  // ── Processing metadata ───────────────────────────────────────
  if (f.processing_metadata) {
    lines.push('')
    lines.push('PROCESSAMENTO')
    if (f.processing_metadata.model_version) {
      lines.push(`  model_version: ${f.processing_metadata.model_version}`)
    }
    if (f.processing_metadata.processing_time_ms != null) {
      lines.push(`  duração: ${f.processing_metadata.processing_time_ms} ms`)
    }
    if (f.processing_metadata.modal_call_id) {
      lines.push(`  modal_call_id: ${f.processing_metadata.modal_call_id}`)
    }
    const pmWarnings = safeArray<string>(f.processing_metadata.warnings)
    if (pmWarnings.length > 0) {
      lines.push(`  warnings: ${pmWarnings.join(', ')}`)
    }
    if (f.processing_metadata.error_summary) {
      lines.push(`  error_summary: ${f.processing_metadata.error_summary}`)
    }
  }

  // ── Footer (3 empty sections for human/AI fill) ───────────────
  for (const line of footerSections()) lines.push(line)

  return lines.join('\n')
}

async function fetchSignedUrls(readingId: string): Promise<SignedPhotoEntry[]> {
  const resp = await fetch(
    `/api/admin/calibration/photos/${encodeURIComponent(readingId)}`,
  )
  if (!resp.ok) {
    throw new Error(`Failed to fetch signed URLs (${resp.status})`)
  }
  const json = (await resp.json()) as { signedUrls?: SignedPhotoEntry[] }
  return safeArray<SignedPhotoEntry>(json.signedUrls)
}

export function TechnicalReportCopyButton(props: TechnicalReportCopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  async function handleCopy() {
    setIsLoading(true)
    try {
      const photos = await fetchSignedUrls(props.readingId)
      const text = buildText(props, photos)
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success(
        photos.length > 0
          ? `Relatório copiado (${photos.length} fotos · TTL 24h)`
          : 'Relatório copiado (sem fotos)',
      )
      window.setTimeout(() => setCopied(false), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'erro desconhecido'
      toast.error(`Falha ao copiar — ${msg}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="default"
      size="default"
      onClick={handleCopy}
      disabled={isLoading}
      aria-busy={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Gerando links + montando relatório...
        </>
      ) : copied ? (
        <>
          <Check className="mr-2 h-4 w-4" />
          Copiado — cole na conversa externa
        </>
      ) : (
        <>
          <Copy className="mr-2 h-4 w-4" />
          Copiar relatório técnico (com fotos + template)
        </>
      )}
    </Button>
  )
}
