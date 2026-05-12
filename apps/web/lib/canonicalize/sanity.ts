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

// D-02 cross-angle outlier threshold — empirical right_frontal delta foi
// 0.10 from median; 0.08 catches it com folga, sem flagear ruído normal
// entre 3 ângulos do mesmo olho. STRICT > (boundary não-outlier).
const CROSS_ANGLE_OUTLIER_THRESHOLD = 0.08

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
  if (!bbox.valid) return 'fallback'
  if (!isGeometricallySane(bbox)) return 'fallback'
  if (isCrossAngleOutlier(bbox, peers)) return 'fallback'
  return 'ok'
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
