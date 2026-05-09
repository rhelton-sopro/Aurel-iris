'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
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
      if (f.depth) parts.push(f.depth)
      if (f.size_mm != null) parts.push(`${f.size_mm} mm`)
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

function buildText(props: TechnicalReportCopyButtonProps): string {
  const f = (props.features ?? {}) as VisionFeatures
  const lines: string[] = []
  lines.push(`LEITURA TÉCNICA — ${props.readingId}`)
  if (props.clientName) lines.push(`Cliente: ${props.clientName}`)
  if (props.capturedAt) lines.push(`Capturado: ${props.capturedAt}`)
  lines.push('')

  lines.push('CONSTITUIÇÃO (consenso)')
  const topConstitution = f.constitution ?? f.right_eye?.constitution ?? f.left_eye?.constitution
  for (const line of constitutionLines('  ', topConstitution)) lines.push(line)

  for (const line of eyeBlock('OD', f.right_eye)) lines.push(line)
  for (const line of eyeBlock('OE', f.left_eye)) lines.push(line)

  const asymmetry = safeArray<string>(f.asymmetry_notes)
  if (asymmetry.length > 0) {
    lines.push('')
    lines.push('ASSIMETRIA')
    for (const note of asymmetry) lines.push(`  - ${note}`)
  }

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

  return lines.join('\n')
}

export function TechnicalReportCopyButton(props: TechnicalReportCopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const text = buildText(props)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Relatório técnico copiado')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Falha ao copiar — tente novamente')
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
      {copied ? (
        <>
          <Check className="mr-2 h-4 w-4" />
          Copiado
        </>
      ) : (
        <>
          <Copy className="mr-2 h-4 w-4" />
          Copiar relatório técnico
        </>
      )}
    </Button>
  )
}
