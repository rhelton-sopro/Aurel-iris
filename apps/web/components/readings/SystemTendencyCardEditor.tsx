'use client'
/**
 * SystemTendencyCardEditor — per-system card editor (Plan 07.4-07b, sibling of Plan 07.4-07).
 *
 * 6 editable fields per system (D-UI4 + D-SCH3 + UI-SPEC §Surface 2 lines 263-267):
 *   - tendency_grade (Select 1-5)
 *   - tendency_label (Select TENDENCY_LABELS enum)
 *   - clinical_description (Textarea, markdown)
 *   - associated_manifestations[] (Textarea "Uma manifestação por linha")
 *   - investigation_points[] (Textarea "Um ponto de investigação por linha")
 *   - therapeutic_direction (Textarea, markdown)
 *
 * Parent ReportAdaptiveEditor manages the systems_with_tendency[] draft. This
 * component is a controlled editor: receives one SystemTendency + onChange to
 * report edited value back. Parent re-assembles full array and calls
 * saveReportV2Delivered({ systems_with_tendency: nextArray }).
 *
 * Per-system_id diff happens server-side in classifyAllSystemsV2 (Plan 07.4-03).
 *
 * system_id and system_name are READ-ONLY (system_id is enum-bound, system_name
 * is derived display string — not editable per UI-SPEC line 263).
 *
 * Phase 7.4 | Plan 07.4-07b | Decisões: D-UI1, D-UI2, D-UI4, D-SCH3
 */
import { Pencil } from 'lucide-react'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { safeArray } from '@/lib/utils'

import { BlockEditPane } from './BlockEditPane'
import { GradeBadge } from './GradeBadge'
import { GradeBar } from './GradeBar'
import {
  TENDENCY_LABELS,
  type SystemTendency,
  type TendencyLabel,
} from '@/lib/anthropic/report-schema'

const GRADE_TO_LABEL: Record<1 | 2 | 3 | 4 | 5, TendencyLabel> = {
  1: 'leve',
  2: 'leve-moderada',
  3: 'moderada',
  4: 'alta',
  5: 'muito alta',
}

export interface SystemTendencyCardEditorProps {
  system: SystemTendency
  initialSystem: SystemTendency // for isDirty comparison + Cancel revert
  saving: boolean
  expanded: boolean
  onExpand: () => void
  onCancel: () => void
  onSave: () => void
  onChange: (next: SystemTendency) => void
}

export function SystemTendencyCardEditor({
  system,
  initialSystem,
  saving,
  expanded,
  onExpand,
  onCancel,
  onSave,
  onChange,
}: SystemTendencyCardEditorProps) {
  const grade = system.tendency_grade as 1 | 2 | 3 | 4 | 5
  const isDirty = JSON.stringify(system) !== JSON.stringify(initialSystem)
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
            {!expanded && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onExpand}
                data-testid={`editar-system-${system.system_id}`}
              >
                <Pencil className="size-4" aria-hidden /> Editar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {expanded ? (
          <BlockEditPane
            isDirty={isDirty}
            saving={saving}
            onCancel={onCancel}
            onSave={onSave}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`grade-${system.system_id}`} className="text-sm">
                  Grade (1-5)
                </Label>
                <Select
                  value={String(grade)}
                  onValueChange={(v) => {
                    const nextGrade = Number(v) as 1 | 2 | 3 | 4 | 5
                    onChange({
                      ...system,
                      tendency_grade: nextGrade,
                      // Auto-sync label to grade (user can override afterwards
                      // via the Label select below)
                      tendency_label: GRADE_TO_LABEL[nextGrade],
                    })
                  }}
                >
                  <SelectTrigger
                    id={`grade-${system.system_id}`}
                    data-testid={`system-grade-${system.system_id}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((g) => (
                      <SelectItem key={g} value={String(g)}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor={`label-${system.system_id}`} className="text-sm">
                  Rótulo da tendência
                </Label>
                <Select
                  value={system.tendency_label}
                  onValueChange={(v) =>
                    onChange({ ...system, tendency_label: v as TendencyLabel })
                  }
                >
                  <SelectTrigger
                    id={`label-${system.system_id}`}
                    data-testid={`system-label-${system.system_id}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TENDENCY_LABELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor={`desc-${system.system_id}`} className="text-sm">
                Descrição clínica
              </Label>
              <Textarea
                id={`desc-${system.system_id}`}
                data-testid={`system-description-${system.system_id}`}
                value={system.clinical_description}
                onChange={(e) =>
                  onChange({ ...system, clinical_description: e.target.value })
                }
                className="min-h-[180px] text-sm"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`man-${system.system_id}`} className="text-sm">
                  Manifestações associadas
                </Label>
                <Textarea
                  id={`man-${system.system_id}`}
                  data-testid={`system-manifestations-${system.system_id}`}
                  value={manifestations.join('\n')}
                  onChange={(e) =>
                    onChange({
                      ...system,
                      associated_manifestations: e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Uma manifestação por linha"
                  className="min-h-[120px] text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`inv-${system.system_id}`} className="text-sm">
                  Pontos para investigação
                </Label>
                <Textarea
                  id={`inv-${system.system_id}`}
                  data-testid={`system-investigations-${system.system_id}`}
                  value={investigations.join('\n')}
                  onChange={(e) =>
                    onChange({
                      ...system,
                      investigation_points: e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Um ponto de investigação por linha"
                  className="min-h-[120px] text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor={`dir-${system.system_id}`} className="text-sm">
                Direção terapêutica
              </Label>
              <Textarea
                id={`dir-${system.system_id}`}
                data-testid={`system-direction-${system.system_id}`}
                value={system.therapeutic_direction}
                onChange={(e) =>
                  onChange({ ...system, therapeutic_direction: e.target.value })
                }
                className="min-h-[120px] text-sm"
              />
            </div>
          </BlockEditPane>
        ) : (
          <>
            <p className="whitespace-pre-wrap text-base">
              {system.clinical_description}
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold">
                  Manifestações associadas
                </h4>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {manifestations.map((m, idx) => (
                    <li key={`m-${idx}`}>{m}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">
                  Pontos para investigação
                </h4>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {investigations.map((p, idx) => (
                    <li key={`p-${idx}`}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-4 rounded-md bg-muted/50 p-4">
              <h4 className="mb-2 text-sm font-semibold">Direção terapêutica</h4>
              <p className="text-sm">{system.therapeutic_direction}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
