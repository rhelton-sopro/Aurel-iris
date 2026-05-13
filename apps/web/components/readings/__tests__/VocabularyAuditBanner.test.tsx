/**
 * @vitest-environment jsdom
 */
// IMPLEMENTED BY: 07.4-07 (VocabularyAuditBanner.tsx — non-dismissible audit banner)
// Plan 07.4-00 RED scaffold. Source: 07.4-VALIDATION.md, D-VOC3.
import { describe, it, expect } from 'vitest'

describe('components/readings/VocabularyAuditBanner (D-VOC3) — Plan 07.4-07', () => {
  it('renders nothing when audit_metadata is null', () => {
    expect.fail('NOT IMPLEMENTED — Plan 07.4-07 (null-audit short-circuit)')
  })

  it('renders 1 banner per non-empty hit category (jargão / sopro / forbidden)', () => {
    expect.fail('NOT IMPLEMENTED — Plan 07.4-07 (per-category banner)')
  })

  it('banner is non-dismissible (no close button)', () => {
    expect.fail('NOT IMPLEMENTED — Plan 07.4-07 (non-dismissible discipline)')
  })
})
