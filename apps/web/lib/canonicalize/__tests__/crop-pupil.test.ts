/**
 * Testes do recorte por PUPILA (2026-07-26).
 *
 * Os dois invariantes que o caminho antigo violava e que estes testes travam:
 *   1. O centro NUNCA é deslocado — se falta espaço, a janela encolhe simétrica.
 *      (o caminho antigo fazia `left = min(left, W - side)`, empurrando a janela
 *      pra dentro do frame e descentralizando a íris)
 *   2. A verificação de íris inteira varre DE FORA PRA DENTRO, pra que o reflexo
 *      do flash — branco e dessaturado, igual à esclera — não seja confundido
 *      com esclera.
 */
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { cropAroundPupil, verifyIrisComplete } from '../crop'

/** Imagem sintética: fundo, disco de "íris" e opcionalmente um "reflexo" branco. */
async function synthEye(opts: {
  W: number
  H: number
  cx: number
  cy: number
  irisR: number
  background?: string
  irisColor?: string
  reflexR?: number
  markerAtCenter?: boolean
}): Promise<Buffer> {
  const {
    W,
    H,
    cx,
    cy,
    irisR,
    background = '#f2f2f0', // esclera: claro e dessaturado
    irisColor = '#4a6b3f', // íris: escura e saturada
    reflexR,
    markerAtCenter,
  } = opts
  const parts = [`<circle cx="${cx}" cy="${cy}" r="${irisR}" fill="${irisColor}"/>`]
  if (reflexR) {
    // reflexo do flash: ilha branca DENTRO da íris, descentrada
    parts.push(
      `<circle cx="${cx + irisR * 0.3}" cy="${cy - irisR * 0.2}" r="${reflexR}" fill="#ffffff"/>`,
    )
  }
  if (markerAtCenter) {
    parts.push(`<rect x="${cx - 5}" y="${cy - 5}" width="10" height="10" fill="#ff00ff"/>`)
  }
  const svg = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`,
  )
  return sharp({ create: { width: W, height: H, channels: 3, background } })
    .composite([{ input: svg }])
    .jpeg({ quality: 95 })
    .toBuffer()
}

/** O pixel central do recorte é o marcador magenta? (prova que o centro não deslocou) */
async function centerIsMarker(buf: Buffer): Promise<boolean> {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true })
  const i = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels
  const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
  return r > 180 && b > 180 && g < 120 // magenta
}

describe('cropAroundPupil', () => {
  it('entrega quadrado de 1000×1000 com a pupila no centro', async () => {
    const W = 3024
    const H = 4032
    const cx = 0.568
    const cy = 0.458
    const img = await synthEye({
      W,
      H,
      cx: cx * W,
      cy: cy * H,
      irisR: 316,
      markerAtCenter: true,
    })

    const out = await cropAroundPupil(img, W, H, cx, cy)

    expect(out.side).toBe(1000)
    expect(out.half).toBe(500)
    expect(out.shrunk).toBe(false)
    const meta = await sharp(out.buffer).metadata()
    expect(meta.width).toBe(1000)
    expect(meta.height).toBe(1000)
    expect(await centerIsMarker(out.buffer)).toBe(true)
  })

  it('NUNCA desloca o centro: perto da borda, encolhe simétrico', async () => {
    const W = 3024
    const H = 4032
    // pupila a 200px da borda esquerda → não cabem 500px de cada lado
    const cx = 200 / W
    const cy = 0.5
    const img = await synthEye({
      W,
      H,
      cx: 200,
      cy: cy * H,
      irisR: 150,
      markerAtCenter: true,
    })

    const out = await cropAroundPupil(img, W, H, cx, cy)

    expect(out.half).toBe(200) // encolheu pro espaço disponível
    expect(out.side).toBe(400)
    expect(out.shrunk).toBe(true)
    // o invariante: a pupila continua exatamente no centro do recorte
    expect(await centerIsMarker(out.buffer)).toBe(true)
  })

  it('aceita meia-janela customizada (caminho de alargamento 500→700)', async () => {
    const W = 3024
    const H = 4032
    const img = await synthEye({ W, H, cx: 0.5 * W, cy: 0.5 * H, irisR: 400 })
    const out = await cropAroundPupil(img, W, H, 0.5, 0.5, 700)
    expect(out.side).toBe(1400)
    expect(out.half).toBe(700)
  })

  it('lança quando a pupila está colada na borda (janela inutilizável)', async () => {
    const W = 3024
    const H = 4032
    const img = await synthEye({ W, H, cx: 30, cy: 0.5 * H, irisR: 20 })
    await expect(cropAroundPupil(img, W, H, 30 / W, 0.5)).rejects.toThrow(
      /janela inutilizável/,
    )
  })
})

describe('verifyIrisComplete', () => {
  it('confirma quando há esclera dos dois lados dentro do corte', async () => {
    // íris de raio 200 num corte de 1000 → sobra esclera de cada lado
    const crop = await synthEye({ W: 1000, H: 1000, cx: 500, cy: 500, irisR: 200 })
    const check = await verifyIrisComplete(crop)
    expect(check.complete).toBe(true)
    expect(check.limbus_a).toBeGreaterThan(150)
    expect(check.limbus_a).toBeLessThan(250)
    expect(check.limbus_b).toBeGreaterThan(150)
    expect(check.limbus_b).toBeLessThan(250)
  })

  it('NÃO confirma quando a íris encosta na borda do corte', async () => {
    // íris de raio 495 num corte de 1000 → praticamente nenhuma esclera
    const crop = await synthEye({ W: 1000, H: 1000, cx: 500, cy: 500, irisR: 495 })
    const check = await verifyIrisComplete(crop)
    expect(check.complete).toBe(false)
  })

  it('o reflexo do flash NÃO é confundido com esclera', async () => {
    // reflexo branco grande dentro da íris; varrendo de fora pra dentro,
    // o limbo achado tem que ser o da íris (~200), não a borda do reflexo
    const crop = await synthEye({
      W: 1000,
      H: 1000,
      cx: 500,
      cy: 500,
      irisR: 200,
      reflexR: 60,
    })
    const check = await verifyIrisComplete(crop)
    expect(check.complete).toBe(true)
    expect(check.limbus_a).toBeGreaterThan(150)
    expect(check.limbus_b).toBeGreaterThan(150)
  })
})
