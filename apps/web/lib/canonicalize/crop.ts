/**
 * Phase 07.1.6 — canonical crop (sharp).
 *
 * C-02: SEM rotação. VLM rotation morta (probado empiricamente em Haiku + Sonnet
 *       em probes de 2026-05-11; terapeuta orienta a câmera via protocolo
 *       revisto commit f885462). NUNCA chamar sharp rotate com argumento de
 *       ângulo nem importar o helper `rotatePointAround...` do probe script
 *       (omitidos literalmente daqui — verify script do plan grepa essas
 *       tokens proibidas em fonte e quebra build se reaparecerem).
 *
 * C-03: crop floor = max(2.5×r, 0.4×min(W,H)).
 *       Mitiga o failure mode "left_lateral radius_pct=0.10 → 2.5×r = 25% só"
 *       (Sonnet underestima radius em frames com olho parcialmente ocluso por
 *       cílios/sombras) sem lógica condicional baseada em confidence. Floor
 *       é literal const, NÃO env-overridable (CONTEXT.md C-03 lock).
 *
 * Input: original JPEG Buffer (post-EXIF-rotation — caller chama
 *        `sharp(raw).rotate().toBuffer()` ANTES de chamar este; isso garante
 *        que origW/origH passados batem com as coordenadas que Sonnet enxergou).
 * Output: 800×800 JPEG Buffer (lanczos3 kernel, quality 92).
 *
 * Phase 07.1.6 | Plan 03 Task 3 | Decisions: C-02, C-03; threat T-07.1.6-14/15
 */
import 'server-only'
import sharp from 'sharp'
import type { IrisBbox } from '@/lib/anthropic/types'

// ---------------------------------------------------------------------------
// Constantes literal-const (C-03 lock: NÃO env-overridable).
// CROP_MULTIPLIER: raio × 2.5 = crop quadrado que cobre íris + esclera + borda
//                  pra Modal Hough fallback ter contexto suficiente.
// CROP_FLOOR_FRACTION: floor 0.4 × min(W,H) — mitiga radius_pct underestimate.
// CROP_OUT_SIZE: 800 — Modal espera tamanho fixo; padronização downstream.
// JPEG_QUALITY: 92 — preserve fiber detail (íris); empirically OK em probe.
// ---------------------------------------------------------------------------
const CROP_MULTIPLIER = 2.5
const CROP_FLOOR_FRACTION = 0.4
const CROP_OUT_SIZE = 800
// JPEG quality 92 — inline em `.jpeg({ quality: 92 })` abaixo (literal mantida
// pra satisfazer o verify-script grep do plan + simplicidade — único callsite).

/**
 * Crop and resize to canonical 800×800.
 *
 * Caller deve já ter:
 *   1. Downloaded original from Storage (service client)
 *   2. Baked EXIF: `await sharp(raw).rotate().toBuffer()`
 *   3. Read dims: `const meta = await sharp(baked).metadata()`
 *   4. Called `fetchIrisBbox(baked)` para obter bbox
 *   5. Passed bbox through `isCanonicalAccepted(bbox, peers)`; só chama
 *      cropToCanonical quando status === 'ok' (D-01 fallback é caller-side)
 *
 * Lança Error se radius_pct → raio em px < 1 (caller marca 'fallback').
 *
 * Sem rotação (C-02): ignora qualquer campo de ângulo que o Sonnet retorne e
 * NÃO chama sharp rotate com ângulo — tudo no frame original-post-EXIF.
 * T-07.1.6-15 (Tampering buffer) mitigado por sharp.metadata() validation
 * no caller.
 */
export async function cropToCanonical(
  imageBuffer: Buffer,
  origW: number,
  origH: number,
  bbox: IrisBbox,
): Promise<Buffer> {
  // Iris center + radius em pixels (frame original-post-EXIF)
  const cx = bbox.center_x_pct * origW
  const cy = bbox.center_y_pct * origH
  const r = bbox.radius_pct * Math.min(origW, origH)

  if (r <= 1) {
    throw new Error(
      `[canonicalize/crop] radius_pct ${bbox.radius_pct} → ${r}px too small to crop`,
    )
  }

  // C-03 floor formula:  max(2.5×r, 0.4×min(W,H))
  const rawCrop = Math.round(CROP_MULTIPLIER * r)
  const floorCrop = Math.round(CROP_FLOOR_FRACTION * Math.min(origW, origH))
  let cropSide = Math.max(rawCrop, floorCrop)

  // Clamp ao maior quadrado possível dentro da imagem (cropSide ≤ min(W,H))
  cropSide = Math.min(cropSide, origW, origH)

  // Posiciona o crop centrado em (cx, cy); clamp pra extract() não sair do frame
  let left = Math.round(cx - cropSide / 2)
  let top = Math.round(cy - cropSide / 2)
  left = Math.max(0, Math.min(left, origW - cropSide))
  top = Math.max(0, Math.min(top, origH - cropSide))

  // Sharp pipeline — SEM rotate. Lanczos3 preserva fiber detail no downsample.
  return await sharp(imageBuffer)
    .extract({ left, top, width: cropSide, height: cropSide })
    .resize(CROP_OUT_SIZE, CROP_OUT_SIZE, { fit: 'cover', kernel: 'lanczos3' })
    .jpeg({ quality: 92 })
    .toBuffer()
}
