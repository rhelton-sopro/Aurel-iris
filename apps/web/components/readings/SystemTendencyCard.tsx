/**
 * SystemTendencyCard — read-only card per system_id (D-UI1).
 *
 * Visual structure per UI-SPEC §Layout Patterns lines 354-376:
 *   Header: {system_name} + GradeBadge + GradeBar
 *   Body: {clinical_description} markdown
 *   2-col grid: associated_manifestations | investigation_points
 *   Highlighted footer (bg-muted/50): "Direção terapêutica" + {therapeutic_direction}
 *
 * Edit-mode wrapper (Editar toggle + BlockEditPane) is the editor's responsibility —
 * Plan 07.4-07 wraps this in ReportAdaptiveEditor.
 *
 * Phase 7.4 | Plan 07.4-06 | Decisões: D-UI1
 */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { safeArray } from '@/lib/utils'
import { GradeBadge } from './GradeBadge'
import { GradeBar } from './GradeBar'
import type { SystemTendency } from '@/lib/anthropic/report-schema-shared'

export interface SystemTendencyCardProps {
  system: SystemTendency
}

export function SystemTendencyCard({ system }: SystemTendencyCardProps) {
  // tendency_grade is constrained to 1-5 by zod schema upstream; cast for the
  // GradeBar/GradeBadge prop types (T-07.4-06-04 — bar handles any int with `i <= grade`).
  const grade = system.tendency_grade as 1 | 2 | 3 | 4 | 5
  const manifestations = safeArray<string>(system.associated_manifestations)
  const investigations = safeArray<string>(system.investigation_points)

  return (
    <Card data-system-id={system.system_id}>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-semibold">{system.system_name}</h3>
          <div className="flex items-center gap-3">
            <GradeBadge grade={grade} label={system.tendency_label} />
            <GradeBar grade={grade} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="prose prose-sm prose-neutral max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {system.clinical_description}
          </ReactMarkdown>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-semibold">Manifestações associadas</h4>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {manifestations.map((m, idx) => (
                <li key={`m-${idx}`}>{m}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold">Pontos para investigação</h4>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {investigations.map((p, idx) => (
                <li key={`p-${idx}`}>{p}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-md bg-muted/50 p-4">
          <h4 className="mb-2 text-sm font-semibold">Direção terapêutica</h4>
          <div className="prose prose-sm prose-neutral max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {system.therapeutic_direction}
            </ReactMarkdown>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
