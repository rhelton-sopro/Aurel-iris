'use client'

/**
 * BlockEditPane — generic edit toggle wrapper for inline per-block editing (D-UI2).
 *
 * Renders the form `children` followed by a Cancelar / Salvar bloco footer. The
 * caller owns the collapsed (read-only) rendering — this component only handles
 * the expanded edit pane. The caller toggles between read and edit modes.
 *
 * State machine (UI-SPEC line 433): collapsed → expanded → saving → saved →
 * collapsed. The "saved" toast is the caller's responsibility (Sonner from
 * the ReportAdaptiveEditor).
 *
 * Reused by Plan 07b: the 3 array/object sub-editors (SystemTendencyCardEditor,
 * IntegrativeAxesEditor, BilateralFindingsEditor) mount inside this same
 * wrapper alongside the 5 simple-text editors introduced in Plan 07.4-07.
 *
 * Phase 7.4 | Plan 07.4-07 | Decisões: D-UI2
 */
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

export interface BlockEditPaneProps {
  children: ReactNode
  isDirty: boolean
  saving: boolean
  onCancel: () => void
  onSave: () => void
}

export function BlockEditPane({
  children,
  isDirty,
  saving,
  onCancel,
  onSave,
}: BlockEditPaneProps) {
  return (
    <div className="space-y-4" data-testid="block-edit-pane">
      <div className="space-y-3">{children}</div>
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={onCancel}
          disabled={saving}
          data-testid="block-edit-pane-cancel"
        >
          Cancelar
        </Button>
        <Button
          variant="default"
          onClick={onSave}
          disabled={!isDirty || saving}
          data-testid="block-edit-pane-save"
        >
          {saving ? 'Salvando…' : 'Salvar bloco'}
        </Button>
      </div>
    </div>
  )
}
