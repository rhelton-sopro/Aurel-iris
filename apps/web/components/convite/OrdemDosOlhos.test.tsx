import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SEQUENCE } from '@/lib/capture/sequence'

import { OrdemDosOlhos } from './OrdemDosOlhos'

describe('OrdemDosOlhos — aviso na landing do convite', () => {
  it('escreve a ordem real da captura: 3 do esquerdo, depois 3 do direito', () => {
    render(<OrdemDosOlhos />)

    // Sanity: é isto que a captura faz hoje. Se mudar, o texto muda junto
    // (é derivado) — mas o teste avisa que a copy precisa ser relida.
    expect(SEQUENCE.map((s) => s.eye)).toEqual([
      'left', 'left', 'left', 'right', 'right', 'right',
    ])

    const texto = screen.getByText(/a ordem dos olhos importa/i).parentElement?.textContent ?? ''
    expect(texto).toContain('1ª, 2ª e 3ª fotos')
    expect(texto).toContain('4ª, 5ª e 6ª fotos')

    // Cada faixa de fotos casada com o olho certo — sem regex multilinha, que
    // exigiria flag acima do target do tsconfig.
    const iPrimeiras = texto.indexOf('1ª, 2ª e 3ª fotos')
    const iEsquerdo = texto.indexOf('ESQUERDO')
    const iUltimas = texto.indexOf('4ª, 5ª e 6ª fotos')
    const iDireito = texto.indexOf('DIREITO')
    expect(iEsquerdo).toBeGreaterThan(iPrimeiras)
    expect(iEsquerdo).toBeLessThan(iUltimas)
    expect(iDireito).toBeGreaterThan(iUltimas)
  })

  it('diz por que importa — instrução sem consequência ninguém lê', () => {
    render(<OrdemDosOlhos />)
    expect(screen.getByText(/a leitura sai trocada/i)).toBeTruthy()
    expect(screen.getByText(/comece pelo olho/i)).toBeTruthy()
  })
})
