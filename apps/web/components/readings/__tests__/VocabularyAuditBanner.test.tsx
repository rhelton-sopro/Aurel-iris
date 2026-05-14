/**
 * @vitest-environment jsdom
 */
// IMPLEMENTED BY: 07.4-07 (VocabularyAuditBanner.tsx — non-dismissible audit banner)
// Source: 07.4-VALIDATION.md, D-VOC3, UI-SPEC line 175 (non-dismissible).
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { VocabularyAuditBanner } from '../VocabularyAuditBanner'
import type { AuditV2Result } from '@/lib/anthropic/types-v2'

function buildAudit(partial: Partial<AuditV2Result> = {}): AuditV2Result {
  return {
    iridological_jargon: [],
    sopro_vocab: [],
    forbidden_vocab: [],
    json_validation_passed: true,
    retry_count: 0,
    audited_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('components/readings/VocabularyAuditBanner (D-VOC3) — Plan 07.4-07', () => {
  it('renders nothing when audit_metadata is null', () => {
    const { container } = render(<VocabularyAuditBanner audit={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when all 3 hit categories are empty', () => {
    const { container } = render(
      <VocabularyAuditBanner audit={buildAudit()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders 1 banner per non-empty hit category (jargão / sopro / forbidden)', () => {
    const audit = buildAudit({
      iridological_jargon: [
        { field: 'executive_summary', term: 'constituição linfática', count: 1 },
      ],
      sopro_vocab: [
        { field: 'clinical_note', term: 'centelha divina', count: 1 },
      ],
      forbidden_vocab: [
        { field: 'therapeutic_synthesis', term: 'diagnóstico', count: 1 },
      ],
    })
    render(<VocabularyAuditBanner audit={audit} />)

    const banner = screen.getByTestId('vocabulary-audit-banner')
    expect(banner).toBeInTheDocument()

    // Three Alert blocks, one per category.
    expect(
      banner.querySelector('[data-audit-kind="iridological_jargon"]'),
    ).toBeInTheDocument()
    expect(
      banner.querySelector('[data-audit-kind="sopro_vocab"]'),
    ).toBeInTheDocument()
    expect(
      banner.querySelector('[data-audit-kind="forbidden_vocab"]'),
    ).toBeInTheDocument()

    // The term is surfaced in copy.
    expect(banner).toHaveTextContent('constituição linfática')
    expect(banner).toHaveTextContent('centelha divina')
    expect(banner).toHaveTextContent('diagnóstico')
  })

  it('renders only banners for non-empty categories', () => {
    const audit = buildAudit({
      forbidden_vocab: [
        { field: 'executive_summary', term: 'cura', count: 1 },
      ],
    })
    render(<VocabularyAuditBanner audit={audit} />)
    const banner = screen.getByTestId('vocabulary-audit-banner')
    expect(
      banner.querySelector('[data-audit-kind="forbidden_vocab"]'),
    ).toBeInTheDocument()
    expect(
      banner.querySelector('[data-audit-kind="iridological_jargon"]'),
    ).not.toBeInTheDocument()
    expect(
      banner.querySelector('[data-audit-kind="sopro_vocab"]'),
    ).not.toBeInTheDocument()
  })

  it('renders json_validation_failed alert when flag is set', () => {
    render(
      <VocabularyAuditBanner audit={null} jsonValidationFailed />,
    )
    const banner = screen.getByTestId('vocabulary-audit-banner')
    expect(
      banner.querySelector('[data-audit-kind="json_validation_failed"]'),
    ).toBeInTheDocument()
    expect(banner).toHaveTextContent(/Erro de geração/i)
  })

  it('banner is non-dismissible (no close button)', () => {
    const audit = buildAudit({
      forbidden_vocab: [
        { field: 'executive_summary', term: 'cura', count: 1 },
      ],
    })
    render(<VocabularyAuditBanner audit={audit} />)
    const banner = screen.getByTestId('vocabulary-audit-banner')
    // No close button, no dismiss button, no [aria-label*="close" i]
    expect(banner.querySelector('button')).toBeNull()
    expect(banner.querySelectorAll('[aria-label*="fechar" i]')).toHaveLength(0)
    expect(banner.querySelectorAll('[aria-label*="close" i]')).toHaveLength(0)
  })

  it('coerces non-array hit fields via safeArray (MEMORY rule — jsonb drift)', () => {
    // Simulate drifted jsonb shape: hits is somehow not an array. Banner must
    // not throw and must render nothing if no other hits surface.
    const drifted = buildAudit({
      iridological_jargon: 'not-an-array' as unknown as never,
      sopro_vocab: null as unknown as never,
    })
    const { container } = render(<VocabularyAuditBanner audit={drifted} />)
    expect(container).toBeEmptyDOMElement()
  })
})
