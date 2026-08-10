import { describe, expect, it } from 'vitest'

import { SEQUENCE, EYE_LABEL } from '@/lib/capture/sequence'

import { buildClientMessage } from './mensagem-cliente'

const URL = 'https://iriscodex.com/convite/abc123'

describe('mensagem pro cliente — ordem dos olhos', () => {
  // O motivo desta trava (founder 2026-08-10): cliente estava começando pelo
  // olho DIREITO mesmo com o app avisando foto a foto, e a leitura saía com os
  // dois lados trocados. A mensagem passou a dizer a ordem ANTES de ele abrir o
  // link. Se a SEQUENCE mudar e ninguém reescrever o texto, a mensagem vira
  // instrução ERRADA — pior que instrução nenhuma. Este teste é o alarme.
  it('a ordem escrita na mensagem é a mesma de SEQUENCE', () => {
    const olhos = SEQUENCE.map((s) => s.eye)
    const primeiro = EYE_LABEL[olhos[0]] // 'esquerdo'
    const ultimo = EYE_LABEL[olhos[olhos.length - 1]] // 'direito'
    const trocaEm = olhos.findIndex((e) => e !== olhos[0])

    // Se algum destes falhar, é a SEQUENCE que mudou — reescreva a mensagem.
    expect(primeiro).toBe('esquerdo')
    expect(ultimo).toBe('direito')
    expect(trocaEm).toBe(3)
    expect(SEQUENCE).toHaveLength(6)

    const msg = buildClientMessage(URL)
    expect(msg).toContain('1ª, 2ª e 3ª fotos — olho ESQUERDO')
    expect(msg).toContain('4ª, 5ª e 6ª fotos — olho DIREITO')
    expect(msg).toContain('Comece pelo olho ESQUERDO')
  })

  it('o olho que abre a mensagem é o que abre a captura', () => {
    const msg = buildClientMessage(URL)
    const posEsquerdo = msg.indexOf('ESQUERDO')
    const posDireito = msg.indexOf('DIREITO')
    const esquerdoVemPrimeiro = posEsquerdo < posDireito

    expect(esquerdoVemPrimeiro).toBe(SEQUENCE[0].eye === 'left')
  })

  it('leva o link e o prazo de 7 dias', () => {
    const msg = buildClientMessage(URL)
    expect(msg).toContain(URL)
    expect(msg).toContain('7 dias')
    expect(msg).toContain('24 horas')
  })

  it('não usa negrito de WhatsApp (a mensagem também vai por e-mail/SMS)', () => {
    expect(buildClientMessage(URL)).not.toContain('*')
  })
})
