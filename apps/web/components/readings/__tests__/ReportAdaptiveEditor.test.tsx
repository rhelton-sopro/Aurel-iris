/**
 * @vitest-environment jsdom
 */
// IMPLEMENTED BY: 07.4-07 (ReportAdaptiveEditor.tsx — inline per-block editor)
// Source: 07.4-VALIDATION.md, D-UI2, D-VOC3, FLAG-5, UI-SPEC §Surface 2.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the server-action module BEFORE the component import. The actions are
// invoked by the editor on Salvar bloco / Salvar alterações / Entregar.
vi.mock('@/app/actions/analise', () => ({
  saveReportV2Delivered: vi.fn(async () => ({ success: true })),
  deliverReportV2: vi.fn(async () => ({ success: true })),
}))

// Mock sonner toast to avoid mounting a real Toaster in jsdom.
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import {
  saveReportV2Delivered,
  deliverReportV2,
} from '@/app/actions/analise'
import { toast } from 'sonner'
import type { ReportV2 } from '@/lib/anthropic/report-schema'
import { ReportAdaptiveEditor } from '../ReportAdaptiveEditor'

const READING_ID = 'r-123'

function buildReport(overrides: Partial<ReportV2> = {}): ReportV2 {
  return {
    report_version: '2.0',
    executive_summary: 'Resumo executivo inicial.',
    constitutional_pattern: {
      description: 'Descrição da constituição.',
      key_traits: ['trait A', 'trait B'],
    },
    systems_with_tendency: [],
    integrative_axes: [],
    bilateral_findings: {
      asymmetry_present: false,
      description: null,
    },
    therapeutic_synthesis: 'Síntese terapêutica inicial.',
    priority_focus: ['Passo 1', 'Passo 2', 'Passo 3'],
    clinical_note: 'Nota clínica inicial.',
    advanced_analysis: {
      available: true,
      generated: false,
      credit_cost: 1,
    },
    ...overrides,
  }
}

describe('components/readings/ReportAdaptiveEditor (D-UI2, FLAG-5) — Plan 07.4-07', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('per-block Editar toggles edit pane (executive_summary)', () => {
    const report = buildReport()
    render(
      <ReportAdaptiveEditor
        readingId={READING_ID}
        generated={report}
        delivered={null}
        audit={null}
        isDelivered={false}
      />,
    )
    // Initially the textarea is NOT rendered.
    expect(
      screen.queryByTestId('textarea-executive_summary'),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('editar-executive_summary'))
    expect(
      screen.getByTestId('textarea-executive_summary'),
    ).toBeInTheDocument()
  })

  it('Cancelar reverts pending block changes', () => {
    const report = buildReport()
    render(
      <ReportAdaptiveEditor
        readingId={READING_ID}
        generated={report}
        delivered={null}
        audit={null}
        isDelivered={false}
      />,
    )
    fireEvent.click(screen.getByTestId('editar-executive_summary'))
    const textarea = screen.getByTestId(
      'textarea-executive_summary',
    ) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'edited inline' } })
    expect(screen.getByTestId('dirty-count')).toHaveTextContent(
      '1 blocos editados',
    )
    fireEvent.click(screen.getByTestId('block-edit-pane-cancel'))
    // Edit pane collapsed, dirty count back to 0.
    expect(
      screen.queryByTestId('textarea-executive_summary'),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('dirty-count')).toHaveTextContent(
      '0 blocos editados',
    )
  })

  it('Salvar bloco calls server action saveReportV2Delivered', async () => {
    const report = buildReport()
    render(
      <ReportAdaptiveEditor
        readingId={READING_ID}
        generated={report}
        delivered={null}
        audit={null}
        isDelivered={false}
      />,
    )
    fireEvent.click(screen.getByTestId('editar-executive_summary'))
    fireEvent.change(screen.getByTestId('textarea-executive_summary'), {
      target: { value: 'novo texto' },
    })
    fireEvent.click(screen.getByTestId('block-edit-pane-save'))
    await waitFor(() =>
      expect(saveReportV2Delivered).toHaveBeenCalledTimes(1),
    )
    expect(saveReportV2Delivered).toHaveBeenCalledWith(READING_ID, {
      executive_summary: 'novo texto',
    })
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Bloco salvo'),
      ),
    )
  })

  it('sticky footer shows "{n} blocos editados" count', () => {
    const report = buildReport()
    render(
      <ReportAdaptiveEditor
        readingId={READING_ID}
        generated={report}
        delivered={null}
        audit={null}
        isDelivered={false}
      />,
    )
    expect(screen.getByTestId('editor-sticky-footer')).toBeInTheDocument()
    expect(screen.getByTestId('dirty-count')).toHaveTextContent(
      '0 blocos editados',
    )

    // Edit two distinct blocks → dirty count should become 2.
    fireEvent.click(screen.getByTestId('editar-clinical_note'))
    fireEvent.change(screen.getByTestId('textarea-clinical_note'), {
      target: { value: 'nota nova' },
    })
    // Switch to therapeutic_synthesis without saving — first edit persists in
    // `draft` state.
    fireEvent.click(screen.getByTestId('editar-therapeutic_synthesis'))
    fireEvent.change(screen.getByTestId('textarea-therapeutic_synthesis'), {
      target: { value: 'sintese nova' },
    })
    expect(screen.getByTestId('dirty-count')).toHaveTextContent(
      '2 blocos editados',
    )
  })

  it('Salvar alterações posts cumulative diff and shows success toast', async () => {
    const report = buildReport()
    render(
      <ReportAdaptiveEditor
        readingId={READING_ID}
        generated={report}
        delivered={null}
        audit={null}
        isDelivered={false}
      />,
    )
    fireEvent.click(screen.getByTestId('editar-clinical_note'))
    fireEvent.change(screen.getByTestId('textarea-clinical_note'), {
      target: { value: 'nota final' },
    })
    fireEvent.click(screen.getByTestId('save-all'))
    await waitFor(() =>
      expect(saveReportV2Delivered).toHaveBeenCalledTimes(1),
    )
    const [argReadingId, argPayload] = vi.mocked(
      saveReportV2Delivered,
    ).mock.calls[0]!
    expect(argReadingId).toBe(READING_ID)
    expect((argPayload as Record<string, unknown>).clinical_note).toBe(
      'nota final',
    )
  })

  it('Salvar alterações button is disabled when no blocks dirty', () => {
    const report = buildReport()
    render(
      <ReportAdaptiveEditor
        readingId={READING_ID}
        generated={report}
        delivered={null}
        audit={null}
        isDelivered={false}
      />,
    )
    expect(screen.getByTestId('save-all')).toBeDisabled()
  })

  it('Entregar ao cliente opens DeliverDialog and calls deliverReportV2 on confirm', async () => {
    const report = buildReport()
    render(
      <ReportAdaptiveEditor
        readingId={READING_ID}
        generated={report}
        delivered={null}
        audit={null}
        isDelivered={false}
      />,
    )
    fireEvent.click(screen.getByTestId('deliver'))
    // Confirm button inside DeliverDialog renders the destructive variant.
    const confirm = await screen.findByText('Sim, entregar')
    fireEvent.click(confirm)
    await waitFor(() => expect(deliverReportV2).toHaveBeenCalledWith(READING_ID))
  })

  it('Entregar shows error toast and keeps editor open on hard-gate failure', async () => {
    vi.mocked(deliverReportV2).mockResolvedValueOnce({
      error: 'Não foi possível entregar: 2 termos proibidos.',
    })
    const report = buildReport()
    render(
      <ReportAdaptiveEditor
        readingId={READING_ID}
        generated={report}
        delivered={null}
        audit={null}
        isDelivered={false}
      />,
    )
    fireEvent.click(screen.getByTestId('deliver'))
    fireEvent.click(await screen.findByText('Sim, entregar'))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('termos proibidos'),
      ),
    )
  })

  it('renders read-only short-circuit when isDelivered=true', () => {
    const report = buildReport()
    render(
      <ReportAdaptiveEditor
        readingId={READING_ID}
        generated={report}
        delivered={report}
        audit={null}
        isDelivered={true}
      />,
    )
    expect(
      screen.queryByTestId('editar-executive_summary'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('Análise entregue — somente leitura.'),
    ).toBeInTheDocument()
  })

  it('renders VocabularyAuditBanner when audit has hits', () => {
    const report = buildReport()
    render(
      <ReportAdaptiveEditor
        readingId={READING_ID}
        generated={report}
        delivered={null}
        audit={{
          iridological_jargon: [],
          sopro_vocab: [],
          forbidden_vocab: [
            { field: 'executive_summary', term: 'diagnóstico', count: 1 },
          ],
          json_validation_passed: true,
          retry_count: 0,
          audited_at: '2026-01-01T00:00:00.000Z',
        }}
        isDelivered={false}
      />,
    )
    expect(screen.getByTestId('vocabulary-audit-banner')).toBeInTheDocument()
    expect(screen.getByText(/diagnóstico/)).toBeInTheDocument()
  })

  it('exposes Editar toggles for the 5 simple-text editable blocks (Plan 07b adds 3 more)', () => {
    const report = buildReport()
    render(
      <ReportAdaptiveEditor
        readingId={READING_ID}
        generated={report}
        delivered={null}
        audit={null}
        isDelivered={false}
      />,
    )
    expect(
      screen.getByTestId('editar-executive_summary'),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('editar-constitutional_pattern'),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('editar-therapeutic_synthesis'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('editar-priority_focus')).toBeInTheDocument()
    expect(screen.getByTestId('editar-clinical_note')).toBeInTheDocument()
    // The 3 structured blocks (systems / axes / bilateral) intentionally
    // have no editor in Plan 07.4-07 — Plan 07b adds them. Assert absence.
    expect(
      screen.queryByTestId('editar-systems_with_tendency'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('editar-integrative_axes'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('editar-bilateral_findings'),
    ).not.toBeInTheDocument()
  })

  it('priority_focus editor exposes 3 inputs and round-trips edits', () => {
    const report = buildReport()
    render(
      <ReportAdaptiveEditor
        readingId={READING_ID}
        generated={report}
        delivered={null}
        audit={null}
        isDelivered={false}
      />,
    )
    fireEvent.click(screen.getByTestId('editar-priority_focus'))
    expect(screen.getByTestId('input-priority_focus-0')).toBeInTheDocument()
    expect(screen.getByTestId('input-priority_focus-1')).toBeInTheDocument()
    expect(screen.getByTestId('input-priority_focus-2')).toBeInTheDocument()
    fireEvent.change(screen.getByTestId('input-priority_focus-1'), {
      target: { value: 'Passo 2 editado' },
    })
    expect(screen.getByTestId('dirty-count')).toHaveTextContent(
      '1 blocos editados',
    )
  })
})
