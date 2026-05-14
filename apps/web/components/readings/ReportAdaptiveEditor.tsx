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
 * All 8 block editors live in this file. 5 simple-text editors are inline
 * (executive_summary, constitutional_pattern, therapeutic_synthesis,
 * priority_focus, clinical_note). 3 array/object editors are delegated to
 * sub-components (Plan 07.4-07b):
 *  - SystemTendencyCardEditor — per-system_id card with 6 fields; one editor
 *    per system, independent expanded state via `expandedSystemId`.
 *  - IntegrativeAxesEditor — add/remove axes + per-axis form; full array
 *    replacement on save (diff classifier records top-level 'integrative_axes').
 *  - BilateralFindingsEditor — Checkbox + Textarea; always renders the form
 *    regardless of asymmetry_present (UI-SPEC FLAG-5).
 *
 * Per-system save path: parent owns the systems_with_tendency[] draft array,
 * sub-editor edits one system at a time, parent merges by system_id then
 * dispatches the FULL array to saveReportV2Delivered. Server-side
 * classifyAllSystemsV2 (Plan 07.4-03) computes per-system_id diff against
 * the current report_v2 (D-SCH3).
 *
 * Phase 7.4 | Plan 07.4-07 + 07.4-07b | Decisões: D-UI2, D-VOC3, D-VAL3, D-UI1, D-UI4, D-SCH3
 */
import { useMemo, useState, useTransition } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { saveReportV2Delivered, deliverReportV2 } from '@/app/actions/analise'
import { safeArray } from '@/lib/utils'
import type { ReportV2 } from '@/lib/anthropic/report-schema'
import type { AuditV2Result } from '@/lib/anthropic/types-v2'

import { AdvancedAnalysisCTA } from './AdvancedAnalysisCTA'
import { BilateralFindingsEditor } from './BilateralFindingsEditor'
import { BlockEditPane } from './BlockEditPane'
import { DeliverDialog } from './DeliverDialog'
import { IntegrativeAxesEditor } from './IntegrativeAxesEditor'
import { KeyTraitChipGroup } from './KeyTraitChipGroup'
import { SystemTendencyCardEditor } from './SystemTendencyCardEditor'
import { VocabularyAuditBanner } from './VocabularyAuditBanner'

type EditableKey =
  | 'executive_summary'
  | 'constitutional_pattern'
  | 'therapeutic_synthesis'
  | 'priority_focus'
  | 'clinical_note'
  // Plan 07.4-07b extends this union for the 2 top-level structured editors.
  // systems_with_tendency is NOT here — per-system expansion uses the
  // independent `expandedSystemId` state below (multiple systems can never be
  // open simultaneously, but the systems block is conceptually always "live"
  // because each card has its own Editar toggle).
  | 'integrative_axes'
  | 'bilateral_findings'

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
  // Per-system edit mode (Plan 07.4-07b): tracks which system_id (if any) is
  // currently expanded for editing. Independent from expandedKey because the
  // user opens systems by clicking the per-card Editar button — no top-level
  // toggle for the systems_with_tendency block.
  const [expandedSystemId, setExpandedSystemId] = useState<string | null>(null)
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
        3. Sistemas com tendência — Plan 07.4-07b sub-editor mount.
        One SystemTendencyCardEditor per system; per-system_id expanded state
        via expandedSystemId. Save dispatches the FULL systems_with_tendency
        array — server-side classifyAllSystemsV2 (D-SCH3) computes per-system_id
        diff against current report_v2.
      */}
      {draftSystems.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Sistemas com tendência</h2>
          <div className="space-y-6">
            {[...draftSystems]
              .sort((a, b) => b.tendency_grade - a.tendency_grade)
              .map((sys) => {
                const initialSys =
                  safeArray<ReportV2['systems_with_tendency'][number]>(
                    initial.systems_with_tendency,
                  ).find((s) => s.system_id === sys.system_id) ?? sys
                return (
                  <SystemTendencyCardEditor
                    key={sys.system_id}
                    system={sys}
                    initialSystem={initialSys}
                    saving={pending}
                    expanded={expandedSystemId === sys.system_id}
                    onExpand={() => setExpandedSystemId(sys.system_id)}
                    onCancel={() => {
                      // Revert this single system to initial; preserve other
                      // systems' in-flight edits in draft.
                      const nextSystems = safeArray<
                        ReportV2['systems_with_tendency'][number]
                      >(draft.systems_with_tendency).map((s) =>
                        s.system_id === sys.system_id ? initialSys : s,
                      )
                      setDraft({
                        ...draft,
                        systems_with_tendency: nextSystems,
                      })
                      setExpandedSystemId(null)
                    }}
                    onSave={() => {
                      // Save the FULL systems_with_tendency array. Server-side
                      // diff classifier (classifyAllSystemsV2, Plan 07.4-03)
                      // records the per-system_id delta — keyed by system_id
                      // per D-SCH3.
                      startTransition(async () => {
                        const result = await saveReportV2Delivered(readingId, {
                          systems_with_tendency: draft.systems_with_tendency,
                        })
                        if (result.error) {
                          toast.error(result.error)
                          return
                        }
                        toast.success(
                          'Sistema salvo. Você pode continuar revisando.',
                        )
                        setExpandedSystemId(null)
                      })
                    }}
                    onChange={(nextSys) => {
                      const nextSystems = safeArray<
                        ReportV2['systems_with_tendency'][number]
                      >(draft.systems_with_tendency).map((s) =>
                        s.system_id === sys.system_id ? nextSys : s,
                      )
                      setDraft({
                        ...draft,
                        systems_with_tendency: nextSystems,
                      })
                    }}
                  />
                )
              })}
          </div>
        </div>
      )}

      {/* 4. Eixos integrativos — Plan 07.4-07b sub-editor mount. */}
      <IntegrativeAxesEditor
        axes={draftAxes}
        initialAxes={safeArray<ReportV2['integrative_axes'][number]>(
          initial.integrative_axes,
        )}
        saving={pending}
        expanded={expandedKey === 'integrative_axes'}
        onExpand={() => setExpandedKey('integrative_axes')}
        onCancel={() => {
          setDraft({
            ...draft,
            integrative_axes: initial.integrative_axes,
          })
          setExpandedKey(null)
        }}
        onSave={() => handleSaveBlock('integrative_axes')}
        onChange={(nextAxes) =>
          setDraft({ ...draft, integrative_axes: nextAxes })
        }
      />

      {/* 5. Achados bilaterais — Plan 07.4-07b sub-editor mount; FLAG-5
          ensures the Card + form render unconditionally even when
          asymmetry_present=false. */}
      <BilateralFindingsEditor
        bilateral={draft.bilateral_findings}
        initialBilateral={initial.bilateral_findings}
        saving={pending}
        expanded={expandedKey === 'bilateral_findings'}
        onExpand={() => setExpandedKey('bilateral_findings')}
        onCancel={() => {
          setDraft({
            ...draft,
            bilateral_findings: initial.bilateral_findings,
          })
          setExpandedKey(null)
        }}
        onSave={() => handleSaveBlock('bilateral_findings')}
        onChange={(nextBilateral) =>
          setDraft({ ...draft, bilateral_findings: nextBilateral })
        }
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
