// Canonical list of audit event types. Usado em logAuditEvent + downstream queries.
// LGPD-04 básico (D-15): logar eventos críticos de identidade + dados + transação.

export type AuditEventType =
  // Auth lifecycle
  | 'auth.login'
  | 'auth.signup'
  // Consent (LGPD-01)
  | 'consent.term_signed'
  | 'consent.term_version_changed'
  // Reading lifecycle
  | 'reading.created'
  | 'reading.images_uploaded'
  | 'reading.analyzed'
  | 'reading.delivered'
  // Billing
  | 'credit.purchase_initiated'
  | 'credit.purchase_confirmed'
  | 'credit.reserved'
  | 'credit.consumed'
  | 'credit.released'
  | 'credit.refunded'
  | 'credit.expired'
  | 'credit.expiring_warning' // WARN-4: notificação 30/7/0 dias antes do expired terminal
  | 'trial.started'
  | 'trial.ended'
  // LGPD requests
  | 'lgpd.deletion_requested'
  // Admin (internal_use bypass tracking)
  | 'admin.internal_use_used'

export const AUDIT_EVENT_TYPES: ReadonlySet<AuditEventType> = new Set([
  'auth.login',
  'auth.signup',
  'consent.term_signed',
  'consent.term_version_changed',
  'reading.created',
  'reading.images_uploaded',
  'reading.analyzed',
  'reading.delivered',
  'credit.purchase_initiated',
  'credit.purchase_confirmed',
  'credit.reserved',
  'credit.consumed',
  'credit.released',
  'credit.refunded',
  'credit.expired',
  'credit.expiring_warning',
  'trial.started',
  'trial.ended',
  'lgpd.deletion_requested',
  'admin.internal_use_used',
])
