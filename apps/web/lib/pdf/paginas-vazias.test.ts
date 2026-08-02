/**
 * O detector de páginas em branco precisa de teste porque o seu modo de falha é MENTIR:
 * se o reconhecimento de texto quebrar, ele diz "tudo vazio" ou "nada vazio" com a mesma
 * confiança. Foi o que aconteceu no protótipo — um regex que exigia `)` antes do `Tj` não
 * casava nada, porque o Chromium emite string HEXADECIMAL (`<002C> Tj`).
 */
import { describe, it, expect } from 'vitest'
import zlib from 'node:zlib'
// @ts-expect-error — .mjs sem tipos, compartilhado com a rota e com o script de propósito
import { paginasVazias } from './paginas-vazias.mjs'

/** Monta um PDF mínimo e válido o bastante para o parser: uma página por stream dado. */
function pdfFalso(streams: string[], comprimir = false): Buffer {
  const partes: Buffer[] = [Buffer.from('%PDF-1.7\n', 'latin1')]
  streams.forEach((conteudo, i) => {
    const pageObj = 10 + i * 2
    const contObj = pageObj + 1
    partes.push(Buffer.from(`${pageObj} 0 obj\n<< /Type /Page /Contents ${contObj} 0 R >>\nendobj\n`, 'latin1'))
    const corpo = comprimir ? zlib.deflateSync(Buffer.from(conteudo, 'latin1')) : Buffer.from(conteudo, 'latin1')
    const dict = comprimir
      ? `<< /Length ${corpo.length} /Filter /FlateDecode >>`
      : `<< /Length ${corpo.length} >>`
    partes.push(Buffer.from(`${contObj} 0 obj\n${dict}\nstream\n`, 'latin1'), corpo, Buffer.from('\nendstream\nendobj\n', 'latin1'))
  })
  return Buffer.concat(partes)
}

// como o Chromium realmente escreve texto: hexadecimal, não literal entre parênteses
const COM_TEXTO = 'BT /F4 12 Tf 1 0 0 -1 307 50 Tm <002C> Tj 8.6 0 Td <0035> Tj ET'
// a página em branco real tinha só as barras de cabeçalho/rodapé: retângulos, zero texto
const SEM_TEXTO = 'q 1 1 1 rg 0 0 727 960 re f Q 36 112 656 1 re f'

describe('paginasVazias', () => {
  it('acha a página sem texto e devolve o índice 1-based', () => {
    const r = paginasVazias(pdfFalso([COM_TEXTO, SEM_TEXTO, COM_TEXTO]))
    expect(r.ok).toBe(true)
    expect(r.total).toBe(3)
    expect(r.vazias).toEqual([2])
  })

  it('não acusa nada quando todas as páginas têm texto', () => {
    const r = paginasVazias(pdfFalso([COM_TEXTO, COM_TEXTO]))
    expect(r.vazias).toEqual([])
  })

  it('lê streams comprimidos com Flate — que é o que o Gotenberg produz', () => {
    const r = paginasVazias(pdfFalso([COM_TEXTO, SEM_TEXTO], true))
    expect(r.ok).toBe(true)
    expect(r.vazias).toEqual([2])
  })

  it('reconhece texto em string HEXADECIMAL, não só entre parênteses', () => {
    // regressão do protótipo: /\)\s*Tj/ não casa <002C> Tj e o detector mentia,
    // marcando TODAS as páginas como vazias.
    expect(paginasVazias(pdfFalso(['BT <0041> Tj ET'])).vazias).toEqual([])
    expect(paginasVazias(pdfFalso(['BT (A) Tj ET'])).vazias).toEqual([])
    expect(paginasVazias(pdfFalso(['BT [(A) -20 (B)] TJ ET'])).vazias).toEqual([])
  })

  it('é FAIL-OPEN: entrada que não é PDF não acusa página vazia', () => {
    // um detector quebrado nunca pode bloquear/alterar a entrega de um PDF provavelmente bom
    const r = paginasVazias(Buffer.from('isto não é um PDF'))
    expect(r.ok).toBe(false)
    expect(r.vazias).toEqual([])
  })

  it('ignora o nó /Pages da árvore e conta só as páginas de verdade', () => {
    const base = pdfFalso([COM_TEXTO, SEM_TEXTO])
    const comArvore = Buffer.concat([base, Buffer.from('99 0 obj\n<< /Type /Pages /Count 2 >>\nendobj\n', 'latin1')])
    const r = paginasVazias(comArvore)
    expect(r.total).toBe(2)
    expect(r.vazias).toEqual([2])
  })
})
