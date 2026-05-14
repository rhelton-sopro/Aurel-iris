'use client'
/**
 * BilateralFindingsEditor — UI-SPEC FLAG-5 default: ALWAYS renders Card +
 * editable form in editor mode regardless of asymmetry_present value (so the
 * therapist can toggle it on if asymmetry was missed by the LLM pass).
 *
 * This is the editor analog of BilateralFindingsCard (Plan 07.4-06), which
 * returns null when !asymmetry_present. The editor explicitly opts out of
 * that omission rule.
 *
 * Phase 7.4 | Plan 07.4-07b | Decisões: D-UI2, UI-SPEC FLAG-5
 */
import { Pencil } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

import { BlockEditPane } from './BlockEditPane'
import type { ReportV2 } from '@/lib/anthropic/report-schema-shared'

type BilateralFindings = ReportV2['bilateral_findings']

export interface BilateralFindingsEditorProps {
  bilateral: BilateralFindings
  initialBilateral: BilateralFindings
  saving: boolean
  expanded: boolean
  onExpand: () => void
  onCancel: () => void
  onSave: () => void
  onChange: (next: BilateralFindings) => void
}

export function BilateralFindingsEditor({
  bilateral,
  initialBilateral,
  saving,
  expanded,
  onExpand,
  onCancel,
  onSave,
  onChange,
}: BilateralFindingsEditorProps) {
  const present = bilateral?.asymmetry_present ?? false
  const description = bilateral?.description ?? ''
  const isDirty = JSON.stringify(bilateral) !== JSON.stringify(initialBilateral)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Achados bilaterais</CardTitle>
          {!expanded && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onExpand}
              data-testid="editar-bilateral_findings"
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
            <div className="flex items-center gap-2">
              <Checkbox
                id="bilateral-present"
                data-testid="bilateral-present"
                checked={present}
                onCheckedChange={(checked) =>
                  onChange({
                    asymmetry_present: Boolean(checked),
                    description: bilateral?.description ?? null,
                  })
                }
              />
              <Label htmlFor="bilateral-present" className="text-sm">
                Assimetria bilateral presente
              </Label>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bilateral-desc" className="text-sm">
                Descrição
              </Label>
              <Textarea
                id="bilateral-desc"
                data-testid="bilateral-description"
                value={description}
                onChange={(e) =>
                  onChange({
                    asymmetry_present: present,
                    description: e.target.value === '' ? null : e.target.value,
                  })
                }
                className="min-h-[80px] text-sm"
              />
            </div>
          </BlockEditPane>
        ) : present ? (
          <p className="whitespace-pre-wrap text-base">
            {description || '(sem descrição)'}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sem assimetria registrada.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
