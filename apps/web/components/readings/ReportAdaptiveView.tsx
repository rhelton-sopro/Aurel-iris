/**
 * ReportAdaptiveView — read-only adaptive renderer for report_v2 (D-UI1).
 *
 * Renders 8 top-level blocks in fixed order:
 *   1. Resumo executivo
 *   2. Padrão constitucional (+ KeyTraitChipGroup)
 *   3. Sistemas com tendência (sorted by tendency_grade desc; empty-state if [])
 *   4. Eixos integrativos (omitted entirely if [])
 *   5. Achados bilaterais (omitted if !asymmetry_present)
 *   6. Síntese terapêutica
 *   7. Foco prioritário (numbered 3 items)
 *   8. Nota clínica
 *   + footerSlot — Plan 07.4-07 mounts AdvancedAnalysisCTA here
 *
 * Legacy fallback (EditorAccordion for report_version='1.0') is handled by the
 * RSC page router (Plan 07.4-08), NOT here.
 *
 * RSC by default — no 'use client'. Type-only import from report-schema preserves
 * the server-only barrier (TS erases `import type` at compile time).
 *
 * Phase 7.4 | Plan 07.4-06 | Decisões: D-UI1
 */
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { safeArray } from '@/lib/utils'
import type { ReportV2 } from '@/lib/anthropic/report-schema'
import { SystemTendencyCard } from './SystemTendencyCard'
import { KeyTraitChipGroup } from './KeyTraitChipGroup'
import { IntegrativeAxisItem } from './IntegrativeAxisItem'
import { BilateralFindingsCard } from './BilateralFindingsCard'
import { PriorityFocusList } from './PriorityFocusList'
import { ClinicalNote } from './ClinicalNote'

export interface ReportAdaptiveViewProps {
  report: ReportV2
  /**
   * Render slot for AdvancedAnalysisCTA (Plan 07.4-07).
   * This plan only leaves the slot; Plan 07 mounts the component.
   */
  footerSlot?: ReactNode
}

export function ReportAdaptiveView({ report, footerSlot }: ReportAdaptiveViewProps) {
  const systems = safeArray<ReportV2['systems_with_tendency'][number]>(report.systems_with_tendency)
  // Defensive client-side sort by tendency_grade desc — even though the prompt
  // instructs Sonnet to emit sorted; do not trust LLM output for visual order.
  const sortedSystems = [...systems].sort((a, b) => b.tendency_grade - a.tendency_grade)

  const axes = safeArray<ReportV2['integrative_axes'][number]>(report.integrative_axes)
  const priorityFocus = safeArray<string>(report.priority_focus)
  const keyTraits = safeArray<string>(report.constitutional_pattern?.key_traits)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* 1. Resumo executivo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Resumo executivo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm prose-neutral max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {report.executive_summary}
            </ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* 2. Padrão constitucional */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Padrão constitucional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="prose prose-sm prose-neutral max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {report.constitutional_pattern?.description ?? ''}
            </ReactMarkdown>
          </div>
          <KeyTraitChipGroup traits={keyTraits} />
        </CardContent>
      </Card>

      {/* 3. Sistemas com tendência — adaptive */}
      {sortedSystems.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Sistemas com tendência</h2>
          <div className="space-y-6">
            {sortedSystems.map((sys) => (
              <SystemTendencyCard key={sys.system_id} system={sys} />
            ))}
          </div>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <h3 className="mb-2 text-lg font-semibold">
              Nenhuma tendência sistêmica relevante identificada nesta leitura.
            </h3>
            <p className="text-sm text-muted-foreground">
              O relatório destaca apenas sistemas com sinais clínicos significativos. A
              ausência de tendências listadas não indica ausência de informação — revise o
              resumo executivo, o padrão constitucional e os eixos integrativos.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 4. Eixos integrativos — omit when empty */}
      {axes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Eixos integrativos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {axes.map((axis, idx) => (
              <div key={`${axis.axis_name}-${idx}`}>
                <IntegrativeAxisItem
                  axisName={axis.axis_name}
                  status={axis.status}
                  description={axis.description}
                />
                {idx < axes.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 5. Achados bilaterais — omit when !asymmetry_present (internal to component) */}
      <BilateralFindingsCard
        asymmetryPresent={report.bilateral_findings?.asymmetry_present ?? false}
        description={report.bilateral_findings?.description ?? null}
      />

      {/* 6. Síntese terapêutica */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Síntese terapêutica</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm prose-neutral max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {report.therapeutic_synthesis}
            </ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* 7. Foco prioritário */}
      <PriorityFocusList items={priorityFocus} />

      {/* 8. Nota clínica */}
      <ClinicalNote note={report.clinical_note} />

      {/* AdvancedAnalysisCTA slot — filled by Plan 07.4-07 */}
      {footerSlot && <div className="mt-8">{footerSlot}</div>}
    </div>
  )
}
