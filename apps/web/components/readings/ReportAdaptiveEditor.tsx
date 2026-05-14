'use client'

/**
 * ReportAdaptiveEditor — editable adaptive renderer for report_v2 (D-UI2).
 *
 * Per UI-SPEC §Surface 2 + §Layout Patterns:
 *  - Mirrors `ReportAdaptiveView` structure
 *  - Each block-Card has a top-right "Editar" toggle (collapsed = prose,
 *    expanded = form). Form lives inside `BlockEditPane` with Cancelar /
 *    Salvar bloco footer.
 *  - Sticky bottom footer: `{n} blocos editados` counter + `Salvar alterações`
 *    (cumulative diff save) + `Entregar ao cliente` (hard-gate via
 *    `deliverReportV2`).
 *  - `VocabularyAuditBanner` rendered at the top when `audit_metadata` has
 *    hits or jsonValidationFailed=true.
 *  - `AdvancedAnalysisCTA` rendered above the sticky footer for visual
 *    consistency with the read-only view.
 *
 * Scope (Plan 07.4-07):
 *  - 5 simple-text block editors live inline here: executive_summary,
 *    constitutional_pattern (description + key_traits), therapeutic_synthesis,
 *    priority_focus (3 inputs), clinical_note.
 *  - The 3 structured block editors (systems_with_tendency,
 *    integrative_axes, bilateral_findings) are delivered by Plan 07b which
 *    extends this file by mounting sub-editor components inside the same
 *    BlockEditPane toggle pattern. Until then those 3 blocks render in
 *    VIEW mode only (read-only Card content) so the user can still see
 *    the data but cannot edit it.
 *
 * FLAG-5 (UI-SPEC line 273): bilateral_findings form renders unconditionally
 * in the editor regardless of asymmetry_present. That toggle is implemented
 * by Plan 07b's BilateralFindingsEditor sub-editor. In Plan 07's interim
 * view-mode rendering, we still always show the card so the user knows the
 * block exists.
 *
 * Phase 7.4 | Plan 07.4-07 | Decisões: D-UI2, D-VOC3, D-VAL3
 */
import { useMemo, useState, useTransition } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

import { saveReportV2Delivered, deliverReportV2 } from '@/app/actions/analise'
import { safeArray } from '@/lib/utils'
import type { ReportV2 } from '@/lib/anthropic/report-schema'
import type { AuditV2Result } from '@/lib/anthropic/types-v2'

import { AdvancedAnalysisCTA } from './AdvancedAnalysisCTA'
import { BilateralFindingsCard } from './BilateralFindingsCard'
import { BlockEditPane } from './BlockEditPane'
import { DeliverDialog } from './DeliverDialog'
import { IntegrativeAxisItem } from './IntegrativeAxisItem'
import { KeyTraitChipGroup } from './KeyTraitChipGroup'
import { SystemTendencyCard } from './SystemTendencyCard'
import { VocabularyAuditBanner } from './VocabularyAuditBanner'

type EditableKey =
  | 'executive_summary'
  | 'constitutional_pattern'
  | 'therapeutic_synthesis'
  | 'priority_focus'
  | 'clinical_note'

const ALL_KEYS: ReadonlyArray<keyof ReportV2> = [
  'executive_summary',
  'constitutional_pattern',
  'systems_with_tendency',
  'integrative_axes',
  'bilateral_findings',
  'therapeutic_synthesis',
  'priority_focus',
  'clinical_note',
]

export interface ReportAdaptiveEditorProps {
  readingId: string
  generated: ReportV2
  delivered: ReportV2 | null
  audit: AuditV2Result | null
  jsonValidationFailed?: boolean
  isDelivered: boolean
}

export function ReportAdaptiveEditor({
  readingId,
  generated,
  delivered,
  audit,
  jsonValidationFailed,
  isDelivered,
}: ReportAdaptiveEditorProps) {
  // Source of truth: delivered ?? generated. Local state tracks in-flight edits.
  const initial = useMemo<ReportV2>(
    () => delivered ?? generated,
    [delivered, generated],
  )
  const [draft, setDraft] = useState<ReportV2>(initial)
  const [expandedKey, setExpandedKey] = useState<EditableKey | null>(null)
  const [pending, startTransition] = useTransition()
  const [deliverDialogOpen, setDeliverDialogOpen] = useState(false)

  // Dirty count = number of top-level keys where draft differs from initial.
  // Use JSON.stringify for structural equality on nested objects/arrays.
  const dirtyCount = useMemo(() => {
    let count = 0
    for (const key of ALL_KEYS) {
      if (JSON.stringify(draft[key]) !== JSON.stringify(initial[key])) count++
    }
    return count
  }, [draft, initial])

  const handleSaveBlock = (key: EditableKey) => {
    startTransition(async () => {
      const partial = { [key]: draft[key] }
      const result = await saveReportV2Delivered(readingId, partial)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Bloco salvo. Você pode continuar revisando.')
      setExpandedKey(null)
    })
  }

  const handleSaveAll = () => {
    startTransition(async () => {
      const result = await saveReportV2Delivered(
        readingId,
        draft as unknown as Record<string, unknown>,
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Alterações salvas. Você pode continuar revisando.')
    })
  }

  const handleDeliver = () => {
    startTransition(async () => {
      const result = await deliverReportV2(readingId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Análise entregue. O cliente pode receber o relatório.')
      setDeliverDialogOpen(false)
    })
  }

  // Once delivered → read-only short-circuit. The page route (Plan 07.4-08)
  // is expected to render `ReportAdaptiveView` directly in this case, but
  // we defensively short-circuit here too so a state flip mid-session can't
  // present an editable surface.
  if (isDelivered) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="border-muted">
          <CardContent className="py-4 text-sm text-muted-foreground">
            Análise entregue — somente leitura.
          </CardContent>
        </Card>
      </div>
    )
  }

  const draftSystems = safeArray<ReportV2['systems_with_tendency'][number]>(
    draft.systems_with_tendency,
  )
  const draftAxes = safeArray<ReportV2['integrative_axes'][number]>(
    draft.integrative_axes,
  )
  const draftPriorityFocus = safeArray<string>(draft.priority_focus)
  const draftKeyTraits = safeArray<string>(draft.constitutional_pattern?.key_traits)

  return (
    <div
      className="mx-auto max-w-3xl space-y-6 pb-24"
      data-testid="report-adaptive-editor"
    >
      <VocabularyAuditBanner
        audit={audit}
        jsonValidationFailed={jsonValidationFailed}
      />

      {/* 1. Resumo executivo */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Resumo executivo</CardTitle>
            {expandedKey !== 'executive_summary' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedKey('executive_summary')}
                data-testid="editar-executive_summary"
              >
                <Pencil className="size-4" aria-hidden /> Editar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {expandedKey === 'executive_summary' ? (
            <BlockEditPane
              isDirty={draft.executive_summary !== initial.executive_summary}
              saving={pending}
              onCancel={() => {
                setDraft({ ...draft, executive_summary: initial.executive_summary })
                setExpandedKey(null)
              }}
              onSave={() => handleSaveBlock('executive_summary')}
            >
              <Label htmlFor="executive_summary" className="text-sm">
                Texto do bloco
              </Label>
              <Textarea
                id="executive_summary"
                value={draft.executive_summary}
                onChange={(e) =>
                  setDraft({ ...draft, executive_summary: e.target.value })
                }
                className="min-h-[120px] text-sm"
                data-testid="textarea-executive_summary"
              />
              <p className="text-xs text-muted-foreground">
                {draft.executive_summary.length} caracteres
                {draft.executive_summary !== generated.executive_summary && (
                  <span className="ml-2">· editado</span>
                )}
              </p>
            </BlockEditPane>
          ) : (
            <p className="whitespace-pre-wrap text-base leading-relaxed">
              {draft.executive_summary}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 2. Padrão constitucional */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Padrão constitucional</CardTitle>
            {expandedKey !== 'constitutional_pattern' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedKey('constitutional_pattern')}
                data-testid="editar-constitutional_pattern"
              >
                <Pencil className="size-4" aria-hidden /> Editar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {expandedKey === 'constitutional_pattern' ? (
            <BlockEditPane
              isDirty={
                JSON.stringify(draft.constitutional_pattern) !==
                JSON.stringify(initial.constitutional_pattern)
              }
              saving={pending}
              onCancel={() => {
                setDraft({
                  ...draft,
                  constitutional_pattern: initial.constitutional_pattern,
                })
                setExpandedKey(null)
              }}
              onSave={() => handleSaveBlock('constitutional_pattern')}
            >
              <Label htmlFor="cp_desc" className="text-sm">
                Descrição
              </Label>
              <Textarea
                id="cp_desc"
                value={draft.constitutional_pattern.description}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    constitutional_pattern: {
                      ...draft.constitutional_pattern,
                      description: e.target.value,
                    },
                  })
                }
                className="min-h-[120px] text-sm"
                data-testid="textarea-constitutional_pattern-description"
              />
              <Label htmlFor="cp_traits" className="text-sm">
                Características-chave (uma por linha)
              </Label>
              <Textarea
                id="cp_traits"
                value={safeArray<string>(
                  draft.constitutional_pattern.key_traits,
                ).join('\n')}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    constitutional_pattern: {
                      ...draft.constitutional_pattern,
                      key_traits: e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                  })
                }
                placeholder="Uma característica por linha"
                className="min-h-[80px] text-sm"
                data-testid="textarea-constitutional_pattern-key_traits"
              />
            </BlockEditPane>
          ) : (
            <>
              <p className="whitespace-pre-wrap text-base">
                {draft.constitutional_pattern.description}
              </p>
              <KeyTraitChipGroup traits={draftKeyTraits} />
            </>
          )}
        </CardContent>
      </Card>

      {/*
        3. Sistemas com tendência, 4. Eixos integrativos, 5. Achados bilaterais —
        SUB-EDITOR MOUNT POINTS for Plan 07b.

        Plan 07b will extend this file by replacing the read-only renderings
        below with edit-mode wrappers powered by:
          - SystemTendencyCardEditor (mounts inside BlockEditPane per system_id)
          - IntegrativeAxesEditor (mounts inside BlockEditPane for the array)
          - BilateralFindingsEditor (mounts inside BlockEditPane, always-render
            regardless of asymmetry_present — FLAG-5)

        Plan 07.4-07 (current) renders these blocks in VIEW mode so the user can
        still see the data while the structured editors are pending.
      */}
      {draftSystems.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Sistemas com tendência</h2>
          <div className="space-y-6">
            {[...draftSystems]
              .sort((a, b) => b.tendency_grade - a.tendency_grade)
              .map((sys) => (
                <SystemTendencyCard key={sys.system_id} system={sys} />
              ))}
          </div>
        </div>
      )}

      {draftAxes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Eixos integrativos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {draftAxes.map((axis, idx) => (
              <div key={`${axis.axis_name}-${idx}`}>
                <IntegrativeAxisItem
                  axisName={axis.axis_name}
                  status={axis.status}
                  description={axis.description}
                />
                {idx < draftAxes.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <BilateralFindingsCard
        asymmetryPresent={draft.bilateral_findings?.asymmetry_present ?? false}
        description={draft.bilateral_findings?.description ?? null}
      />

      {/* 6. Síntese terapêutica */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Síntese terapêutica</CardTitle>
            {expandedKey !== 'therapeutic_synthesis' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedKey('therapeutic_synthesis')}
                data-testid="editar-therapeutic_synthesis"
              >
                <Pencil className="size-4" aria-hidden /> Editar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {expandedKey === 'therapeutic_synthesis' ? (
            <BlockEditPane
              isDirty={
                draft.therapeutic_synthesis !== initial.therapeutic_synthesis
              }
              saving={pending}
              onCancel={() => {
                setDraft({
                  ...draft,
                  therapeutic_synthesis: initial.therapeutic_synthesis,
                })
                setExpandedKey(null)
              }}
              onSave={() => handleSaveBlock('therapeutic_synthesis')}
            >
              <Label htmlFor="ts" className="text-sm">
                Texto do bloco
              </Label>
              <Textarea
                id="ts"
                value={draft.therapeutic_synthesis}
                onChange={(e) =>
                  setDraft({ ...draft, therapeutic_synthesis: e.target.value })
                }
                className="min-h-[120px] text-sm"
                data-testid="textarea-therapeutic_synthesis"
              />
            </BlockEditPane>
          ) : (
            <p className="whitespace-pre-wrap text-base">
              {draft.therapeutic_synthesis}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 7. Foco prioritário — 3 fixed inputs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Foco prioritário</CardTitle>
            {expandedKey !== 'priority_focus' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedKey('priority_focus')}
                data-testid="editar-priority_focus"
              >
                <Pencil className="size-4" aria-hidden /> Editar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {expandedKey === 'priority_focus' ? (
            <BlockEditPane
              isDirty={
                JSON.stringify(draft.priority_focus) !==
                JSON.stringify(initial.priority_focus)
              }
              saving={pending}
              onCancel={() => {
                setDraft({ ...draft, priority_focus: initial.priority_focus })
                setExpandedKey(null)
              }}
              onSave={() => handleSaveBlock('priority_focus')}
            >
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-1">
                    <Label htmlFor={`pf_${i}`} className="text-sm">
                      {i + 1}.
                    </Label>
                    <Input
                      id={`pf_${i}`}
                      value={draftPriorityFocus[i] ?? ''}
                      onChange={(e) => {
                        const next = [...draftPriorityFocus]
                        while (next.length < 3) next.push('')
                        next[i] = e.target.value
                        setDraft({
                          ...draft,
                          priority_focus: next.slice(0, 3),
                        })
                      }}
                      data-testid={`input-priority_focus-${i}`}
                    />
                  </div>
                ))}
              </div>
            </BlockEditPane>
          ) : (
            <ol className="space-y-2">
              {draftPriorityFocus.map((item, idx) => (
                <li key={idx} className="text-base">
                  <span className="font-semibold text-muted-foreground">
                    {idx + 1}.
                  </span>{' '}
                  {item}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* 8. Nota clínica */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Nota clínica</CardTitle>
            {expandedKey !== 'clinical_note' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedKey('clinical_note')}
                data-testid="editar-clinical_note"
              >
                <Pencil className="size-4" aria-hidden /> Editar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {expandedKey === 'clinical_note' ? (
            <BlockEditPane
              isDirty={draft.clinical_note !== initial.clinical_note}
              saving={pending}
              onCancel={() => {
                setDraft({ ...draft, clinical_note: initial.clinical_note })
                setExpandedKey(null)
              }}
              onSave={() => handleSaveBlock('clinical_note')}
            >
              <Label htmlFor="cn" className="text-sm">
                Texto do bloco
              </Label>
              <Textarea
                id="cn"
                value={draft.clinical_note}
                onChange={(e) =>
                  setDraft({ ...draft, clinical_note: e.target.value })
                }
                className="min-h-[80px] text-sm"
                data-testid="textarea-clinical_note"
              />
            </BlockEditPane>
          ) : (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {draft.clinical_note}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Advanced analysis placeholder — visible in editor for visual consistency. */}
      <div className="mt-8">
        <AdvancedAnalysisCTA />
      </div>

      {/* Sticky footer */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur"
        data-testid="editor-sticky-footer"
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-3">
          <div
            className="text-sm text-muted-foreground"
            data-testid="dirty-count"
          >
            {dirtyCount} blocos editados
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSaveAll}
              disabled={pending || dirtyCount === 0}
              data-testid="save-all"
            >
              {pending ? 'Salvando…' : 'Salvar alterações'}
            </Button>
            <Button
              variant="default"
              onClick={() => setDeliverDialogOpen(true)}
              disabled={pending}
              data-testid="deliver"
            >
              Entregar ao cliente
            </Button>
          </div>
        </div>
      </div>

      <DeliverDialog
        open={deliverDialogOpen}
        onOpenChange={setDeliverDialogOpen}
        onConfirm={handleDeliver}
        pending={pending}
      />
    </div>
  )
}
