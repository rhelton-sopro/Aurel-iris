/**
 * Shared Iris Codex report design tokens — single source of truth for the
 * editorial visual language used by BOTH report surfaces:
 *   - PDF  : lib/pdf/report-print-document.tsx (Gotenberg HTML/CSS)
 *   - Web  : components/readings/ReportReadView.tsx (therapist reading view)
 *
 * Plan 7.4-28 (UAT iter-4, CHANGE 6): the two surfaces had drifted; the
 * therapist's web view must feel like the same premium document they export.
 * Colors / type / spacing live here so a change propagates to both.
 *
 * Plain serializable values only (no CSS-in-JS) — the PDF builder interpolates
 * them into a CSS string; the web component spreads them into inline styles.
 *
 * Phase 7.4 | Plan 07.4-28 | Decisions: UAT-iter-4 CHANGE 6
 */

export const REPORT_COLORS = {
  teal: '#3D9B8C',
  tealLight: '#5BBFB0',
  tealDark: '#1E6B61',
  ink: '#1E1E1E',
  body: '#2A2A2A',
  mist: '#7A7A7A',
  white: '#FFFFFF',
  /** §14 letter background + §15 card border tint. */
  ivory: '#F2EDE4',
  cardBorder: '#E8E0D4',
} as const

/**
 * §15 Síntese Rápida card palette — per-card accent + 4%-tint background,
 * in subsection order: Fragilidades / Forças / Emoções a Cuidar / Potências /
 * Perfil e Temperamento / Aptidões. Shared so PDF + web cards match exactly.
 */
export const SINTESE_CARD_PALETTE = [
  { accent: '#C0392B', bg: '#FBF4F3' },
  { accent: '#3D9B8C', bg: '#F2F8F6' },
  { accent: '#C8920A', bg: '#FBF6E8' },
  { accent: '#5BBFB0', bg: '#EFF8F5' },
  { accent: '#1E6B61', bg: '#EEF3F1' },
  { accent: '#555555', bg: '#F4F4F2' },
] as const

export const REPORT_FONTS = {
  serif: 'Georgia, "Times New Roman", "Liberation Serif", serif',
} as const

/**
 * Spacing/typography scale. PDF uses pt/px (print); the web view maps these
 * to the closest Tailwind/CSS equivalents but reads the raw values for the
 * pieces that must be pixel-faithful (header height, breathing room).
 */
export const REPORT_LAYOUT = {
  /** Horizontal logo height in the running page header. */
  headerLogoHeightPx: 24,
  /** Header divider color + the breathing gap below it (CHANGE 1 + 3). */
  headerBreathingPx: 28,
  /** Gap above each section heading (between sections). */
  sectionGapPx: 48,
  /** Section title size. */
  sectionTitlePt: 22,
  /** "Em poucas palavras" essence phrase size. */
  essencePt: 22,
} as const

export type SinteseCardStyle = (typeof SINTESE_CARD_PALETTE)[number]
