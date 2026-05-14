'use client'
/**
 * IntegrativeAxesEditor — add/remove/edit integrative_axes[] (Plan 07.4-07b).
 *
 * Editable per axis: axis_name (Input), status (Select), description (Textarea).
 * Add-axis appends { axis_name: '', status: 'latente', description: '' }.
 * Remove-axis splices by index.
 *
 * Server-side: classifyAllSystemsV2 (Plan 07.4-03) records this as a single
 * top-level 'integrative_axes' diff key (not per-axis_name — axis names aren't
 * stable IDs).
 *
 * Phase 7.4 | Plan 07.4-07b | Decisões: D-UI1, D-UI2
 */
import { Pencil, Trash2, Plus } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { safeArray } from '@/lib/utils'

import { BlockEditPane } from './BlockEditPane'
import { IntegrativeAxisItem } from './IntegrativeAxisItem'
import type { ReportV2, AxisStatus } from '@/lib/anthropic/report-schema-shared'

type Axis = ReportV2['integrative_axes'][number]

export interface IntegrativeAxesEditorProps {
  axes: Axis[]
  initialAxes: Axis[]
  saving: boolean
  expanded: boolean
  onExpand: () => void
  onCancel: () => void
  onSave: () => void
  onChange: (next: Axis[]) => void
}

export function IntegrativeAxesEditor({
  axes,
  initialAxes,
  saving,
  expanded,
  onExpand,
  onCancel,
  onSave,
  onChange,
}: IntegrativeAxesEditorProps) {
  const safeAxes = safeArray<Axis>(axes)
  const safeInitial = safeArray<Axis>(initialAxes)
  const isDirty = JSON.stringify(safeAxes) !== JSON.stringify(safeInitial)

  const updateAxis = (idx: number, patch: Partial<Axis>) => {
    const next = safeAxes.map((a, i) => (i === idx ? { ...a, ...patch } : a))
    onChange(next)
  }
  const removeAxis = (idx: number) => {
    onChange(safeAxes.filter((_, i) => i !== idx))
  }
  const addAxis = () => {
    onChange([
      ...safeAxes,
      { axis_name: '', status: 'latente' as AxisStatus, description: '' },
    ])
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Eixos integrativos</CardTitle>
          {!expanded && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onExpand}
              data-testid="editar-integrative_axes"
            >
              <Pencil className="size-4" aria-hidden /> Editar
            </Button>
          )}
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
            <div className="space-y-4">
              {safeAxes.map((axis, idx) => (
                <div
                  key={idx}
                  className="space-y-3 rounded-md border p-4"
                  data-testid={`axis-row-${idx}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`axis-name-${idx}`} className="text-sm">
                        Nome do eixo
                      </Label>
                      <Input
                        id={`axis-name-${idx}`}
                        data-testid={`axis-name-${idx}`}
                        value={axis.axis_name}
                        onChange={(e) =>
                          updateAxis(idx, { axis_name: e.target.value })
                        }
                      />
                    </div>
                    <div className="w-40 space-y-1">
                      <Label htmlFor={`axis-status-${idx}`} className="text-sm">
                        Status
                      </Label>
                      <Select
                        value={axis.status}
                        onValueChange={(v) =>
                          updateAxis(idx, { status: v as AxisStatus })
                        }
                      >
                        <SelectTrigger
                          id={`axis-status-${idx}`}
                          data-testid={`axis-status-${idx}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="latente">Latente</SelectItem>
                          <SelectItem value="inativo">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAxis(idx)}
                      aria-label={`Remover eixo ${axis.axis_name || idx + 1}`}
                      className="mt-7"
                      data-testid={`remove-axis-${idx}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`axis-desc-${idx}`} className="text-sm">
                      Descrição
                    </Label>
                    <Textarea
                      id={`axis-desc-${idx}`}
                      data-testid={`axis-description-${idx}`}
                      value={axis.description}
                      onChange={(e) =>
                        updateAxis(idx, { description: e.target.value })
                      }
                      className="min-h-[80px] text-sm"
                    />
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={addAxis}
                className="w-full sm:w-auto"
                data-testid="add-axis"
              >
                <Plus className="size-4" aria-hidden /> Adicionar eixo
              </Button>
            </div>
          </BlockEditPane>
        ) : safeAxes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum eixo registrado.</p>
        ) : (
          <div className="space-y-4">
            {safeAxes.map((axis, idx) => (
              <div key={`${axis.axis_name}-${idx}`}>
                <IntegrativeAxisItem
                  axisName={axis.axis_name}
                  status={axis.status}
                  description={axis.description}
                />
                {idx < safeAxes.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
