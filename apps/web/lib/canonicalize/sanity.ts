/**
 * Phase 07.1.6 canonical capture — trust gate (pure functions).
 *
 * D-02: combo geometric sanity + cross-angle outlier detection.
 *   - Geometric: bbox center coord in [0.20, 0.80] E radius_pct in [0.05, 0.30]
 *     (centrais 60% do frame; catches "bbox em canto" + "radius cobrindo
 *     metade do rosto").
 *   - Cross-angle: bbox é outlier se |coord_axis - median(peers.coord_axis)|
 *     > 0.08 em X ou Y. Strict > (boundary delta = 0.08 NÃO é outlier).
 *
 * D-03: sem retry — gate failed → fallback direto, sem rephrasing/cascade.
 *
 * Pure module: NO 'server-only', NO async, NO I/O, NO Anthropic/Supabase
 * imports. Math only. Tests rodam em <1s.
 *
 * Thresholds são literais const, NÃO env-overridable (CONTEXT.md §Specifics
 * empirical lock — derivados de Nailli e85ea7de probe + founder visual review).
 *
 * Phase 07.1.6 | Plan 02
 */
import type { IrisBbox, CanonicalStatus } from '@/lib/anthropic/types'

// ---------------------------------------------------------------------------
// D-02 geometric sanity bounds — empirical (founder visual review):
// center coord ∈ [0.20, 0.80] (centrais 60% do frame)
// radius_pct ∈ [0.05, 0.30] (catches "bbox em canto" + "radius 0.40 cobrindo
// meio rosto"). Bounds INCLUSIVE (>= / <=).
// ---------------------------------------------------------------------------
const GEOM_CENTER_MIN = 0.2
const GEOM_CENTER_MAX = 0.8
const GEOM_RADIUS_MIN = 0.05
const GEOM_RADIUS_MAX = 0.3

// D-02 cross-angle outlier threshold.
// Initial empirical lock (Nailli e85ea7de probe, 2026-05-11): 0.08.
// Relaxed to 0.18 after Phase 07.1.6 UAT item 1 (reading f4408c23, 2026-05-12):
// 5/6 photos fell back with cross_angle deltas 0.09–0.16 — all geometrically
// sane, all consistent with the camera-tilt capture protocol (3 angles per
// eye intentionally produce a measurable lateral shift of the iris in-frame).
// 0.18 is empirically grounded (>max observed natural shift 0.16, < a
// pathological "Sonnet pointed at the eyelid" outlier ≥ 0.25). STRICT >
// (boundary não-outlier).
const CROSS_ANGLE_OUTLIER_THRESHOLD = 0.18

/** Empirical thresholds exported para diagnóstico (gate_diagnostics.context). */
export const GATE_THRESHOLDS = {
  geom_center_min: GEOM_CENTER_MIN,
  geom_center_max: GEOM_CENTER_MAX,
  geom_radius_min: GEOM_RADIUS_MIN,
  geom_radius_max: GEOM_RADIUS_MAX,
  cross_angle_outlier: CROSS_ANGLE_OUTLIER_THRESHOLD,
} as const

/**
 * Reasons a bbox can fail the gate. Diagnostic enum — each row in
 * canonical_metadata.gate_diagnostics carries a subset of these.
 * Empty array (status='ok') means all gates passed.
 */
export type GateFailReason =
  | 'invalid'
  | 'geom_center_x'
  | 'geom_center_y'
  | 'geom_radius'
  | 'cross_angle_x'
  | 'cross_angle_y'

export interface GateDiagnostic {
  status: CanonicalStatus
  fail_reasons: GateFailReason[]
  /** Peer set used for cross-angle median (other angles of same eye). */
  peer_count: number
  median_x_pct: number | null
  median_y_pct: number | null
  /** abs(center_axis - median_axis); null when peer_count < 2 */
  delta_x_pct: number | null
  delta_y_pct: number | null
}

/**
 * Geometric sanity: bbox center deve estar nos centrais 60% do frame
 * E radius_pct dentro de [0.05, 0.30]. Bounds são INCLUSIVE.
 *
 * NaN-safe: comparações `>=`/`<=` retornam false para NaN, automaticamente
 * caindo em 'fallback' branch upstream (defesa em profundidade contra
 * Spoofing — T-07.1.6-08 do threat model).
 */
export function isGeometricallySane(bbox: IrisBbox): boolean {
  return (
    bbox.center_x_pct >= GEOM_CENTER_MIN &&
    bbox.center_x_pct <= GEOM_CENTER_MAX &&
    bbox.center_y_pct >= GEOM_CENTER_MIN &&
    bbox.center_y_pct <= GEOM_CENTER_MAX &&
    bbox.radius_pct >= GEOM_RADIUS_MIN &&
    bbox.radius_pct <= GEOM_RADIUS_MAX
  )
}

/**
 * Cross-angle outlier: para os 3 ângulos do mesmo olho, calcular median de
 * peers.center_x e peers.center_y; bbox é outlier se delta > 0.08 em
 * qualquer eixo. Strict > (boundary delta = 0.08 NÃO é outlier).
 *
 * Returns false quando peers.length < 2 (não dá pra calcular median
 * confiável com 0-1 peer). Isso é seguro: durante warm-up ou se Sonnet
 * falhar em 2/3 ângulos do mesmo olho, a heurística cross-angle não roda
 * e o gate cai apenas em isGeometricallySane.
 */
export function isCrossAngleOutlier(bbox: IrisBbox, peers: IrisBbox[]): boolean {
  if (peers.length < 2) return false
  const medianX = median(peers.map(p => p.center_x_pct))
  const medianY = median(peers.map(p => p.center_y_pct))
  return (
    Math.abs(bbox.center_x_pct - medianX) > CROSS_ANGLE_OUTLIER_THRESHOLD ||
    Math.abs(bbox.center_y_pct - medianY) > CROSS_ANGLE_OUTLIER_THRESHOLD
  )
}

/**
 * D-02 combined gate: 'ok' iff bbox.valid AND geometrically sane AND
 * não-outlier vs peers. Qualquer falha → 'fallback'.
 *
 * D-01 + D-03: sem retry. Quando 'fallback', caller (Wave 1 index.ts)
 * passa a imagem ORIGINAL ao Modal pra essa foto específica e marca
 * `processing_metadata.canonical_status='fallback'`.
 *
 * NOTE: 'disabled' status NÃO é retornado por este gate — é setado pelo
 * orchestrator quando CANONICAL_CAPTURE_ENABLED=false (D-04 kill-switch).
 */
export function isCanonicalAccepted(
  bbox: IrisBbox,
  peers: IrisBbox[],
): CanonicalStatus {
  return diagnoseCanonical(bbox, peers).status
}

/**
 * Same gate as `isCanonicalAccepted`, but returns structured diagnostic info
 * (fail reasons, peer median, deltas) for observability. Orchestrator writes
 * this per-photo into `canonical_metadata.gate_diagnostics` so the founder can
 * query Supabase Studio and tune thresholds empirically without redeploying
 * to add log lines.
 *
 * Behavioral parity with `isCanonicalAccepted`: same boundary semantics
 * (geometric bounds INCLUSIVE; cross-angle delta STRICT >; peer_count<2
 * skips cross-angle check). Adding this function does NOT change which
 * photos pass the gate.
 */
export function diagnoseCanonical(
  bbox: IrisBbox,
  peers: IrisBbox[],
): GateDiagnostic {
  const fail_reasons: GateFailReason[] = []

  if (!bbox.valid) fail_reasons.push('invalid')

  // Geometric gate — evaluate each axis independently so the founder
  // can see WHICH axis blew it (e.g. center_x out of range but center_y fine).
  if (bbox.center_x_pct < GEOM_CENTER_MIN || bbox.center_x_pct > GEOM_CENTER_MAX) {
    fail_reasons.push('geom_center_x')
  }
  if (bbox.center_y_pct < GEOM_CENTER_MIN || bbox.center_y_pct > GEOM_CENTER_MAX) {
    fail_reasons.push('geom_center_y')
  }
  if (bbox.radius_pct < GEOM_RADIUS_MIN || bbox.radius_pct > GEOM_RADIUS_MAX) {
    fail_reasons.push('geom_radius')
  }

  // Cross-angle gate (peer_count<2 → skipped, same as isCrossAngleOutlier).
  let median_x_pct: number | null = null
  let median_y_pct: number | null = null
  let delta_x_pct: number | null = null
  let delta_y_pct: number | null = null
  if (peers.length >= 2) {
    median_x_pct = median(peers.map(p => p.center_x_pct))
    median_y_pct = median(peers.map(p => p.center_y_pct))
    delta_x_pct = Math.abs(bbox.center_x_pct - median_x_pct)
    delta_y_pct = Math.abs(bbox.center_y_pct - median_y_pct)
    if (delta_x_pct > CROSS_ANGLE_OUTLIER_THRESHOLD) fail_reasons.push('cross_angle_x')
    if (delta_y_pct > CROSS_ANGLE_OUTLIER_THRESHOLD) fail_reasons.push('cross_angle_y')
  }

  return {
    status: fail_reasons.length === 0 ? 'ok' : 'fallback',
    fail_reasons,
    peer_count: peers.length,
    median_x_pct,
    median_y_pct,
    delta_x_pct,
    delta_y_pct,
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Median of a numeric array (even-length = mean of 2 middle values).
 * Pure: copia o array antes de sort pra não mutar input.
 * Called only via isCrossAngleOutlier — não exportado.
 */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}
