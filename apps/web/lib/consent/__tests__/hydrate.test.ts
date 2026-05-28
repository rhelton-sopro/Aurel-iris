import { describe, expect, it } from 'vitest'

import { hydrateTerm, sha256 } from '../hydrate-term'

describe('hydrateTerm', () => {
  it('substitutes placeholders', () => {
    const tpl = 'Olá {{TITULAR_NOME}}, CPF {{TITULAR_CPF}}.'
    const r = hydrateTerm(tpl, { TITULAR_NOME: 'Ana', TITULAR_CPF: '123' })
    expect(r.hydrated).toBe('Olá Ana, CPF 123.')
  })

  it('leaves unknown placeholders as bracketed marker', () => {
    const r = hydrateTerm('X {{UNKNOWN}} Y', {})
    expect(r.hydrated).toBe('X [UNKNOWN] Y')
  })

  it('treats empty-string value as a bracketed marker (no blank gap)', () => {
    const r = hydrateTerm('CPF {{TITULAR_CPF}}', { TITULAR_CPF: '' })
    expect(r.hydrated).toBe('CPF [TITULAR_CPF]')
  })

  it('different vars produce different SHA256', () => {
    const a = hydrateTerm('Olá {{TITULAR_NOME}}', { TITULAR_NOME: 'Ana' })
    const b = hydrateTerm('Olá {{TITULAR_NOME}}', { TITULAR_NOME: 'Beto' })
    expect(a.sha256).not.toBe(b.sha256)
  })

  it('same template + vars produces stable SHA256', () => {
    const a = hydrateTerm('Olá', {})
    const b = hydrateTerm('Olá', {})
    expect(a.sha256).toBe(b.sha256)
  })

  it('sha256 helper matches known hash', () => {
    expect(sha256('test')).toBe(
      '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    )
  })
})
