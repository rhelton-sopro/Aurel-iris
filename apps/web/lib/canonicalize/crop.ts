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

// ===========================================================================
// MÉTODO PUPILA ±500 (2026-07-26) — substitui o caminho bbox+raio acima.
//
// Medido nas 6 fotos do founder (leitura c3841fbf), íris real ⌀356-632px:
//   - Caminho antigo: o floor (0.4×menor_lado = 1210px) GANHA em 6/6 — o
//     `2.5×raio` nunca entra em foto de 12MP. Ou seja, a janela é fixa em 1210px
//     e depois reduzida pra 800 → o modelo recebe a íris a ⌀362px, ocupando 16%
//     da área do frame (84% dos tokens de imagem são pálpebra, cílio e pele).
//     Na frontal do founder ~52px da íris ficaram FORA do quadro, e o gate não
//     detecta (centro 0.42 está dentro de [0.2,0.8], raio inflado dentro de
//     [0.05,0.3], e os pares concordam entre si → nenhum outlier).
//   - Caminho novo: ±500px da pupila na resolução CHEIA → íris ⌀632px inteira e
//     centrada, 63% do frame. 1,75× de resolução linear, ~3× os pixels de íris.
//
// POR QUE JANELA FIXA e não proporcional ao raio: nenhuma fonte mede o raio da
// íris com erro aceitável (ver o cabeçalho de ./pupil-center.ts). Uma constante
// não propaga erro; um raio errado propaga. Nas 6 fotos, ±500 conteve a íris
// inteira com 149-253px de folga usando o centro REAL do Sonnet 5 (erro 35-129px).
//
// 1000×1000 = 1,0 MP: cabe no orçamento de imagem do Sonnet 4.6 (~1,15 MP) SEM
// redução, e folgado no Sonnet 5 / Opus (3,75 MP). Custo de imagem no Stage 1
// sobe de ~5.120 para ~8.000 tokens na leitura (≈ +2 centavos de dólar).
// ===========================================================================

/** Meia-janela: 500px pra cada lado da pupila → quadrado de 1000×1000. */
const PUPIL_HALF_WINDOW = 500
/** Quando a verificação não confirma a íris inteira, tenta uma janela maior. */
const PUPIL_HALF_WINDOW_WIDE = 700

export interface PupilCropResult {
  buffer: Buffer
  /** Lado do quadrado entregue (1000 no caso normal; menor se a pupila estava perto da borda). */
  side: number
  /** Meia-janela efetivamente usada. */
  half: number
  /** true quando a janela foi encolhida por falta de espaço no frame. */
  shrunk: boolean
}

/**
 * Recorta um quadrado centrado na PUPILA.
 *
 * REGRA DURA: o centro nunca é deslocado. Se não há `half` px de espaço em algum
 * lado, a janela ENCOLHE simétrica (perde margem, mantém a íris centrada). O
 * caminho antigo fazia o oposto — empurrava a janela pra dentro do frame
 * (`left = min(left, W - cropSide)`), e é assim que a íris sai descentrada e
 * cortada sem ninguém perceber.
 *
 * Sem resize: o quadrado sai na resolução nativa do original (não faz sentido
 * ampliar — não adiciona informação e custa token).
 *
 * @param half - meia-janela em px no frame pós-EXIF (default 500)
 */
export async function cropAroundPupil(
  imageBuffer: Buffer,
  origW: number,
  origH: number,
  centerXPct: number,
  centerYPct: number,
  half: number = PUPIL_HALF_WINDOW,
): Promise<PupilCropResult> {
  const cx = Math.round(centerXPct * origW)
  const cy = Math.round(centerYPct * origH)

  // Encolhe simétrico — NUNCA desloca o centro.
  const effHalf = Math.min(half, cx, cy, origW - cx, origH - cy)
  if (effHalf < 100) {
    throw new Error(
      `[canonicalize/crop] pupila a ${effHalf}px da borda do frame — janela inutilizável`,
    )
  }
  const side = effHalf * 2

  const buffer = await sharp(imageBuffer)
    .extract({ left: cx - effHalf, top: cy - effHalf, width: side, height: side })
    .jpeg({ quality: 92 })
    .toBuffer()

  return { buffer, side, half: effHalf, shrunk: effHalf < half }
}

export interface IrisCompleteCheck {
  /** Distância (px do centro) onde a esclera termina do lado nasal. null = não encontrada. */
  limbus_a: number | null
  /** Idem, lado oposto. */
  limbus_b: number | null
  /** true quando há faixa de esclera dos DOIS lados dentro do corte. */
  complete: boolean
}

/**
 * Verifica se a íris está INTEIRA dentro do corte, sem precisar do raio.
 *
 * Mecanismo: caminha DE FORA PRA DENTRO na linha horizontal do centro, dos dois
 * lados, procurando o fim de uma faixa de "branco" (claro + dessaturado = esclera).
 * Se existe esclera dos dois lados antes de chegar na íris, a íris terminou dentro
 * do quadro.
 *
 * POR QUE DE FORA PRA DENTRO: de dentro pra fora o reflexo do flash — que é branco
 * e dessaturado — é confundido com esclera (medido: numa das fotos a varredura
 * de-dentro-pra-fora "achou esclera" a 64px do centro, onde a íris tem raio 179).
 * O reflexo é uma ilha cercada de íris; a esclera encosta na borda do olho.
 *
 * LIMITE CONHECIDO: em foto de contraluz mole, a transição íris→esclera perde
 * contraste e a faixa não é encontrada — retorna complete=false. Isso é
 * SINALIZAR, não reprovar: o caller decide (alarga a janela, e se ainda não
 * confirmar, registra na diagnóstica). Nas 6 fotos do teste, confirmou 4 e
 * sinalizou as 2 de contraluz. Também NÃO serve como medidor de raio (erro de
 * 6% a 74%) — só como confirmação binária.
 */
export async function verifyIrisComplete(
  cropBuffer: Buffer,
): Promise<IrisCompleteCheck> {
  const { data: px, info } = await sharp(cropBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true })
  const W = info.width
  const H = info.height
  const ch = info.channels
  const cx = Math.round(W / 2)
  const cy = Math.round(H / 2)

  const isWhite = (x: number, y: number): boolean => {
    const i = (y * W + x) * ch
    const r = px[i] / 255
    const g = px[i + 1] / 255
    const b = px[i + 2] / 255
    const mx = Math.max(r, g, b)
    const mn = Math.min(r, g, b)
    const sat = mx === 0 ? 0 : (mx - mn) / mx
    return mx > WHITE_LIGHTNESS_MIN && sat < WHITE_SATURATION_MAX
  }

  /** Maioria de uma faixa vertical curta é branca nesta distância? (sobrevive a vaso) */
  const bandIsWhite = (d: number, dir: -1 | 1): boolean => {
    let white = 0
    let total = 0
    for (let k = -BAND_HALF; k <= BAND_HALF; k += BAND_STEP) {
      const x = cx + dir * d
      const y = cy + k
      if (x < 0 || x >= W || y < 0 || y >= H) continue
      total++
      if (isWhite(x, y)) white++
    }
    return total > 0 && white >= Math.ceil(total * BAND_WHITE_FRACTION)
  }

  const scanInward = (dir: -1 | 1): number | null => {
    let sawWhite = false
    let start: number | null = null
    for (let d = cx - 2; d >= SCAN_MIN_RADIUS; d--) {
      if (bandIsWhite(d, dir)) {
        if (!sawWhite) {
          sawWhite = true
          start = d
        }
      } else if (sawWhite && start !== null) {
        // Faixa branca terminou: se era larga o suficiente, este é o limbo.
        if (start - d >= MIN_SCLERA_WIDTH) return d
        sawWhite = false
        start = null // faixa curta = ruído (vaso, cílio claro) — segue procurando
      }
    }
    return null
  }

  const limbus_a = scanInward(-1)
  const limbus_b = scanInward(+1)
  return { limbus_a, limbus_b, complete: limbus_a !== null && limbus_b !== null }
}

// Limiares da verificação — literais, calibrados nas 6 fotos do founder.
const WHITE_LIGHTNESS_MIN = 0.6
const WHITE_SATURATION_MAX = 0.2
const BAND_HALF = 12
const BAND_STEP = 4
const BAND_WHITE_FRACTION = 0.7
/** Não procura esclera dentro deste raio — ali é pupila/íris central. */
const SCAN_MIN_RADIUS = 60
/** Faixa branca precisa desta largura pra contar como esclera (e não vaso/cílio). */
const MIN_SCLERA_WIDTH = 20

export { PUPIL_HALF_WINDOW, PUPIL_HALF_WINDOW_WIDE }
